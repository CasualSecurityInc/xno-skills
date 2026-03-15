import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { generateSeed, generateMnemonic, seedToMnemonic, mnemonicToSeed, validateMnemonic } from "./seed.js";
import { deriveAddressLegacy } from "./address-legacy.js";
import { deriveAddressBIP44 } from "./address-bip44.js";
import { validateAddress } from "./validate.js";
import { nanoToRaw, rawToNano } from "./convert.js";
import {
  rpcAccountBalance,
  rpcAccountsBalances,
  rpcAccountsFrontiers,
  rpcAccountInfo,
  rpcReceivable,
  rpcWorkGenerate,
  rpcProcess,
} from "./rpc.js";
import { hashNanoStateBlock } from "./state-block.js";
import { nanoSignBlake2b } from "./ed25519-blake2b.js";
import fs from "node:fs";
import path from "node:path";

const server = new Server(
  {
    name: "xno-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

type McpConfig = {
  rpcUrl?: string;
  workUrl?: string;
  timeoutMs?: number;
  persistPurses?: boolean;
  defaultRepresentative?: string;
};

type PurseFormat = "bip39" | "legacy";

type Purse =
  | {
      name: string;
      format: "bip39";
      mnemonic: string;
      passphrase: string;
      createdAt: string;
    }
  | {
      name: string;
      format: "legacy";
      seed: string;
      mnemonic: string;
      createdAt: string;
    };

const DEFAULT_TIMEOUT_MS = 15000;
const state = {
  config: {} as McpConfig,
  purses: new Map<string, Purse>(),
};

function getHomeDir(): string {
  const envHome = process.env.XNO_MCP_HOME || process.env.NANO_MCP_HOME;
  if (envHome && envHome.trim()) return path.resolve(envHome);
  return path.resolve(process.cwd(), ".xno-mcp");
}

function getConfigPath(): string {
  const envPath = process.env.XNO_MCP_CONFIG_PATH;
  if (envPath && envPath.trim()) return path.resolve(envPath);
  return path.join(getHomeDir(), "config.json");
}

function getPursesPath(): string {
  const envPath = process.env.XNO_MCP_PURSES_PATH;
  if (envPath && envPath.trim()) return path.resolve(envPath);
  return path.join(getHomeDir(), "purses.json");
}

function loadJsonFile<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function saveJsonFile(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
}

function loadStateFromDisk() {
  const config = loadJsonFile<McpConfig>(getConfigPath());
  if (config) state.config = config;

  if (state.config.persistPurses) {
    const persisted = loadJsonFile<{ purses: Purse[] }>(getPursesPath());
    if (persisted?.purses?.length) {
      for (const p of persisted.purses) state.purses.set(p.name, p);
    }
  }
}

function persistConfig() {
  saveJsonFile(getConfigPath(), state.config);
}

function persistPurses() {
  if (!state.config.persistPurses) return;
  saveJsonFile(getPursesPath(), { purses: Array.from(state.purses.values()) });
}

function effectiveRpcUrl(explicit?: string): string {
  return (
    explicit ||
    state.config.rpcUrl ||
    process.env.XNO_MCP_RPC_URL ||
    process.env.NANO_RPC_URL ||
    process.env.XNO_RPC_URL ||
    ""
  );
}

function effectiveWorkUrl(explicit?: string): string {
  return explicit || state.config.workUrl || effectiveRpcUrl() || "";
}

function effectiveTimeoutMs(explicit?: number): number {
  return explicit ?? state.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

function derivePurseAccount(purse: Purse, index: number) {
  if (!Number.isInteger(index) || index < 0) throw new Error("index must be a non-negative integer");
  if (purse.format === "bip39") return deriveAddressBIP44(purse.mnemonic, index, purse.passphrase);
  return deriveAddressLegacy(purse.seed, index);
}

const ZERO_32_HEX = "0".repeat(64);

function requireRepresentativeAddress(explicit?: string): string {
  const rep = (explicit || state.config.defaultRepresentative || "").trim();
  if (!rep) throw new Error("Missing representative. Pass representative or set config_set { defaultRepresentative: \"nano_...\" }.");
  const v = validateAddress(rep);
  if (!v.valid) throw new Error(`Invalid representative address: ${v.error}`);
  return rep;
}

function purseToPublicSummary(purse: Purse, count: number = 1) {
  const accounts: { index: number; address: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = derivePurseAccount(purse, i);
    accounts.push({ index: i, address: d.address });
  }
  return {
    name: purse.name,
    format: purse.format,
    createdAt: purse.createdAt,
    accounts,
  };
}

loadStateFromDisk();

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "config_get",
        description: "Get xno-mcp defaults (RPC URL, timeouts, persistence)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "config_set",
        description: "Set xno-mcp defaults (RPC URL, timeouts, persistence)",
        inputSchema: {
          type: "object",
          properties: {
            rpcUrl: { type: "string", description: "Default Nano node RPC URL" },
            workUrl: { type: "string", description: "Optional work_generate RPC URL (defaults to rpcUrl)" },
            timeoutMs: { type: "number", description: "Default RPC timeout in ms", default: DEFAULT_TIMEOUT_MS },
            persistPurses: {
              type: "boolean",
              description:
                "Persist purses to disk (plaintext JSON in .xno-mcp). Keep false unless you understand the risk.",
              default: false,
            },
            defaultRepresentative: {
              type: "string",
              description:
                "Default representative address for opening accounts (used by purse_receive when account is unopened).",
            },
          },
        },
      },
      {
        name: "purse_create",
        description:
          "Create a named purse (custodial wallet in xno-mcp). Returns addresses only (no seed/mnemonic).",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Purse name (unique key)" },
            format: { type: "string", description: "bip39 (default) or legacy", default: "bip39" },
            words: { type: "number", description: "BIP39 word count (12/15/18/21/24). Only for format=bip39.", default: 24 },
            passphrase: { type: "string", description: "Optional BIP39 passphrase (only for format=bip39)", default: "" },
            count: { type: "number", description: "How many initial account indexes to return", default: 1 },
            overwrite: { type: "boolean", description: "Overwrite if purse already exists", default: false },
          },
          required: ["name"],
        },
      },
      {
        name: "purse_list",
        description: "List purses currently held by xno-mcp",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "purse_addresses",
        description: "Get addresses for a named purse (derive on demand; secrets stay in xno-mcp)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            fromIndex: { type: "number", default: 0 },
            count: { type: "number", default: 5 },
          },
          required: ["name"],
        },
      },
      {
        name: "purse_balance",
        description: "Check balance/pending for a purse account index via RPC (uses xno-mcp defaults)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            index: { type: "number", default: 0 },
            rpcUrl: { type: "string" },
            includeXno: { type: "boolean", default: true },
            timeoutMs: { type: "number", default: DEFAULT_TIMEOUT_MS },
          },
          required: ["name"],
        },
      },
      {
        name: "purse_probe_balances",
        description:
          "Check first N account indexes for a purse via RPC, including whether each account is opened (frontier exists)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            count: { type: "number", default: 5 },
            rpcUrl: { type: "string" },
            timeoutMs: { type: "number", default: DEFAULT_TIMEOUT_MS },
          },
          required: ["name"],
        },
      },
      {
        name: "purse_receive",
        description:
          "Receive pending blocks for a purse account index (sign + work_generate + process). Requires RPC + work support.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            index: { type: "number", default: 0 },
            count: { type: "number", description: "Max pending blocks to receive", default: 10 },
            onlyHash: { type: "string", description: "If set, only receive this pending send block hash" },
            representative: { type: "string", description: "Representative address to use when opening an unopened account" },
            rpcUrl: { type: "string" },
            workUrl: { type: "string" },
            includeXno: { type: "boolean", default: true },
            timeoutMs: { type: "number", default: DEFAULT_TIMEOUT_MS },
          },
          required: ["name"],
        },
      },
      {
        name: "purse_send",
        description:
          "Send funds from a purse account index (sign + work_generate + process). Requires opened account with balance.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            index: { type: "number", default: 0 },
            destination: { type: "string", description: "Destination nano_... address" },
            amountRaw: { type: "string", description: "Amount in raw (string)" },
            amountXno: { type: "string", description: "Amount in XNO (string; will be converted to raw)" },
            rpcUrl: { type: "string" },
            workUrl: { type: "string" },
            includeXno: { type: "boolean", default: true },
            timeoutMs: { type: "number", default: DEFAULT_TIMEOUT_MS },
          },
          required: ["name", "destination"],
        },
      },
      {
        name: "generate_wallet",
        description: "Generate a new Nano wallet (default: BIP39 derivation)",
        inputSchema: {
          type: "object",
          properties: {
            format: { type: "string", description: "bip39 (default) or legacy", default: "bip39" },
            words: { type: "number", description: "BIP39 word count (12/15/18/21/24). Only for format=bip39.", default: 24 },
            passphrase: { type: "string", description: "Optional BIP39 passphrase (only for format=bip39)", default: "" },
            index: { type: "number", description: "Account index", default: 0 },
          },
        },
      },
      {
        name: "derive_address",
        description: "Derive a Nano address from a mnemonic/seed (supports bip39 + legacy)",
        inputSchema: {
          type: "object",
          properties: {
            mnemonic: { type: "string" },
            seed: { type: "string" },
            index: { type: "number", default: 0 },
            format: { type: "string", description: "auto (default), bip39, legacy", default: "auto" },
            passphrase: { type: "string", description: "Optional BIP39 passphrase (only for bip39)", default: "" },
            both: { type: "boolean", description: "When format=auto and mnemonic is 24 words, return both derivations", default: false },
          },
        },
      },
      {
        name: "convert_units",
        description: "Convert between Nano units (xno, raw)",
        inputSchema: {
          type: "object",
          properties: {
            amount: { type: "string" },
            from: { type: "string" },
            to: { type: "string" },
          },
          required: ["amount", "from", "to"],
        },
      },
      {
        name: "validate_address",
        description: "Validate a Nano address and extract public key",
        inputSchema: {
          type: "object",
          properties: {
            address: { type: "string" },
          },
          required: ["address"],
        },
      },
      {
        name: "rpc_account_balance",
        description: "Query a Nano node for account balance + pending (requires RPC URL/network access)",
        inputSchema: {
          type: "object",
          properties: {
            address: { type: "string" },
            rpcUrl: { type: "string", description: "Nano node RPC URL (or set NANO_RPC_URL / XNO_RPC_URL)" },
            includeXno: { type: "boolean", default: true },
            timeoutMs: { type: "number", default: 15000 },
          },
          required: ["address"],
        },
      },
      {
        name: "probe_mnemonic",
        description: "Try bip39 + legacy derivations and probe first N indexes via RPC (helps resolve 24-word ambiguity)",
        inputSchema: {
          type: "object",
          properties: {
            mnemonic: { type: "string" },
            passphrase: { type: "string", default: "" },
            count: { type: "number", default: 5 },
            rpcUrl: { type: "string", description: "Nano node RPC URL (or set NANO_RPC_URL / XNO_RPC_URL)" },
            timeoutMs: { type: "number", default: 15000 },
          },
          required: ["mnemonic"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "config_get": {
        return { content: [{ type: "text", text: JSON.stringify(state.config, null, 2) }] };
      }

      case "config_set": {
        const rpcUrl = (args as any)?.rpcUrl as string | undefined;
        const workUrl = (args as any)?.workUrl as string | undefined;
        const timeoutMs = (args as any)?.timeoutMs as number | undefined;
        const persistPursesFlag = (args as any)?.persistPurses as boolean | undefined;
        const defaultRepresentative = (args as any)?.defaultRepresentative as string | undefined;

        if (rpcUrl !== undefined) state.config.rpcUrl = rpcUrl;
        if (workUrl !== undefined) state.config.workUrl = workUrl;
        if (timeoutMs !== undefined) state.config.timeoutMs = timeoutMs;
        if (persistPursesFlag !== undefined) state.config.persistPurses = persistPursesFlag;
        if (defaultRepresentative !== undefined) state.config.defaultRepresentative = defaultRepresentative;

        persistConfig();
        if (state.config.persistPurses) persistPurses();

        return { content: [{ type: "text", text: JSON.stringify(state.config, null, 2) }] };
      }

      case "purse_create": {
        const purseName = String((args as any)?.name || "").trim();
        if (!purseName) throw new Error("Purse name is required");

        const overwrite = Boolean((args as any)?.overwrite);
        if (!overwrite && state.purses.has(purseName)) throw new Error(`Purse already exists: ${purseName}`);

        const format = String((args as any)?.format || "bip39").toLowerCase() as PurseFormat;
        const createdAt = new Date().toISOString();
        let purse: Purse;

        if (format === "bip39") {
          const words = (args as any)?.words ?? 24;
          const passphrase = String((args as any)?.passphrase || "");
          const mnemonic = generateMnemonic(words);
          purse = { name: purseName, format: "bip39", mnemonic, passphrase, createdAt };
        } else if (format === "legacy") {
          const seed = generateSeed();
          const mnemonic = seedToMnemonic(seed);
          purse = { name: purseName, format: "legacy", seed, mnemonic, createdAt };
        } else {
          throw new Error("Invalid format. Use bip39 or legacy.");
        }

        state.purses.set(purseName, purse);
        persistPurses();

        const count = Math.max(1, Math.min(100, (args as any)?.count ?? 1));
        const summary = purseToPublicSummary(purse, count);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ...summary,
                  note:
                    "This is a custodial purse held by xno-mcp. Secrets are not returned by default.",
                  persistence: state.config.persistPurses ? "enabled" : "memory-only",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "purse_list": {
        const list = Array.from(state.purses.values()).map((p) => ({
          name: p.name,
          format: p.format,
          createdAt: p.createdAt,
        }));
        return { content: [{ type: "text", text: JSON.stringify({ purses: list }, null, 2) }] };
      }

      case "purse_addresses": {
        const purseName = String((args as any)?.name || "").trim();
        const purse = state.purses.get(purseName);
        if (!purse) throw new Error(`Unknown purse: ${purseName}`);

        const fromIndex = Math.max(0, (args as any)?.fromIndex ?? 0);
        const count = Math.max(1, Math.min(100, (args as any)?.count ?? 5));

        const accounts: { index: number; address: string }[] = [];
        for (let i = 0; i < count; i++) {
          const idx = fromIndex + i;
          accounts.push({ index: idx, address: derivePurseAccount(purse, idx).address });
        }

        return { content: [{ type: "text", text: JSON.stringify({ name: purse.name, format: purse.format, accounts }, null, 2) }] };
      }

      case "purse_balance": {
        const purseName = String((args as any)?.name || "").trim();
        const purse = state.purses.get(purseName);
        if (!purse) throw new Error(`Unknown purse: ${purseName}`);

        const index = ((args as any)?.index as number | undefined) ?? 0;
        const includeXno = ((args as any)?.includeXno as boolean | undefined) ?? true;
        const timeoutMs = effectiveTimeoutMs((args as any)?.timeoutMs as number | undefined);
        const rpcUrl = effectiveRpcUrl((args as any)?.rpcUrl as string | undefined);
        if (!rpcUrl) throw new Error("Missing RPC URL. Set xno-mcp config rpcUrl, pass rpcUrl, or set NANO_RPC_URL / XNO_RPC_URL.");

        const address = derivePurseAccount(purse, index).address;

        const bal = await rpcAccountBalance(rpcUrl, address, { timeoutMs });
        const out: any = { name: purse.name, format: purse.format, index, address, balanceRaw: bal.balance, pendingRaw: bal.pending };
        if (includeXno) {
          out.balanceXno = rawToNano(bal.balance);
          out.pendingXno = rawToNano(bal.pending);
        }
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      }

      case "purse_probe_balances": {
        const purseName = String((args as any)?.name || "").trim();
        const purse = state.purses.get(purseName);
        if (!purse) throw new Error(`Unknown purse: ${purseName}`);

        const count = Math.max(1, Math.min(100, (args as any)?.count ?? 5));
        const timeoutMs = effectiveTimeoutMs((args as any)?.timeoutMs as number | undefined);
        const rpcUrl = effectiveRpcUrl((args as any)?.rpcUrl as string | undefined);
        if (!rpcUrl) throw new Error("Missing RPC URL. Set xno-mcp config rpcUrl, pass rpcUrl, or set NANO_RPC_URL / XNO_RPC_URL.");

        const addresses: string[] = [];
        const accounts: { index: number; address: string }[] = [];
        for (let i = 0; i < count; i++) {
          const address = derivePurseAccount(purse, i).address;
          accounts.push({ index: i, address });
          addresses.push(address);
        }

        const balances = await rpcAccountsBalances(rpcUrl, addresses, { timeoutMs });
        const frontiers = await rpcAccountsFrontiers(rpcUrl, addresses, { timeoutMs });

        const rows = accounts.map((a) => {
          const b = balances.balances?.[a.address];
          const opened = Boolean(frontiers.frontiers?.[a.address]);
          return {
            ...a,
            opened,
            balanceRaw: b?.balance ?? "0",
            pendingRaw: b?.pending ?? "0",
            balanceXno: rawToNano(b?.balance ?? "0"),
            pendingXno: rawToNano(b?.pending ?? "0"),
          };
        });

        return { content: [{ type: "text", text: JSON.stringify({ name: purse.name, format: purse.format, rows }, null, 2) }] };
      }

      case "purse_receive": {
        const purseName = String((args as any)?.name || "").trim();
        const purse = state.purses.get(purseName);
        if (!purse) throw new Error(`Unknown purse: ${purseName}`);

        const index = Math.max(0, (args as any)?.index ?? 0);
        const maxCount = Math.max(1, Math.min(100, (args as any)?.count ?? 10));
        const onlyHash = (args as any)?.onlyHash ? String((args as any)?.onlyHash).trim() : "";
        if (onlyHash && !/^[0-9a-fA-F]{64}$/.test(onlyHash)) throw new Error("onlyHash must be 32-byte hex (64 hex characters)");

        const rpcUrl = effectiveRpcUrl((args as any)?.rpcUrl as string | undefined);
        const workUrl = effectiveWorkUrl((args as any)?.workUrl as string | undefined);
        if (!rpcUrl) throw new Error("Missing RPC URL. Set xno-mcp config rpcUrl, pass rpcUrl, or set NANO_RPC_URL / XNO_RPC_URL.");
        if (!workUrl) throw new Error("Missing work URL. Set xno-mcp config workUrl, pass workUrl, or set rpcUrl.");

        const timeoutMs = effectiveTimeoutMs((args as any)?.timeoutMs as number | undefined);
        const includeXno = (args as any)?.includeXno ?? true;

        const acct = derivePurseAccount(purse, index);
        const info = await rpcAccountInfo(rpcUrl, acct.address, { timeoutMs });

        const openedBefore = !(typeof (info as any)?.error === "string");
        let previous = openedBefore ? String((info as any).frontier) : ZERO_32_HEX;
        let balanceRaw = openedBefore ? String((info as any).balance) : "0";
        const representativeAddress = openedBefore
          ? String((info as any).representative || "")
          : requireRepresentativeAddress((args as any)?.representative as string | undefined);

        const repVal = validateAddress(representativeAddress);
        if (!repVal.valid || !repVal.publicKey) throw new Error(`Invalid representative address: ${repVal.error}`);

        const receivable = await rpcReceivable(rpcUrl, acct.address, maxCount, { timeoutMs });
        const pending = onlyHash ? receivable.filter((r) => r.hash.toLowerCase() === onlyHash.toLowerCase()) : receivable;

        if (!pending.length) {
          const out: any = {
            name: purse.name,
            format: purse.format,
            index,
            address: acct.address,
            openedBefore,
            representative: representativeAddress,
            received: [],
            balanceRaw,
            pendingCount: receivable.length,
          };
          if (includeXno) out.balanceXno = rawToNano(balanceRaw);
          return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
        }

        const received: any[] = [];
        for (const p of pending.slice(0, maxCount)) {
          const amountRaw = String(p.amount);
          const newBalance = (BigInt(balanceRaw) + BigInt(amountRaw)).toString();

          const workRoot = previous !== ZERO_32_HEX ? previous : acct.publicKey;
          const link = p.hash;

          const blockHash = hashNanoStateBlock({
            accountPublicKey: acct.publicKey,
            previous,
            representativePublicKey: repVal.publicKey,
            balanceRaw: newBalance,
            link,
          });
          const signature = nanoSignBlake2b(blockHash, acct.privateKey);
          const work = (await rpcWorkGenerate(workUrl, workRoot, { timeoutMs })).work;

          const subtype = previous === ZERO_32_HEX ? "open" : "receive";
          const block = {
            type: "state",
            account: acct.address,
            previous,
            representative: representativeAddress,
            balance: newBalance,
            link,
            signature,
            work,
          };

          const processed = await rpcProcess(rpcUrl, block, subtype as any, { timeoutMs });
          received.push({
            sendHash: p.hash,
            source: p.source,
            amountRaw,
            receiveHash: processed.hash,
            subtype,
          });

          previous = processed.hash;
          balanceRaw = newBalance;
        }

        const out: any = {
          name: purse.name,
          format: purse.format,
          index,
          address: acct.address,
          representative: representativeAddress,
          openedBefore,
          received,
          balanceRaw,
        };
        if (includeXno) out.balanceXno = rawToNano(balanceRaw);
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      }

      case "purse_send": {
        const purseName = String((args as any)?.name || "").trim();
        const purse = state.purses.get(purseName);
        if (!purse) throw new Error(`Unknown purse: ${purseName}`);

        const index = Math.max(0, (args as any)?.index ?? 0);
        const destination = String((args as any)?.destination || "").trim();
        const destVal = validateAddress(destination);
        if (!destVal.valid || !destVal.publicKey) throw new Error(`Invalid destination address: ${destVal.error}`);

        const amountRawArg = (args as any)?.amountRaw as string | undefined;
        const amountXnoArg = (args as any)?.amountXno as string | undefined;
        if ((amountRawArg && amountXnoArg) || (!amountRawArg && !amountXnoArg)) {
          throw new Error("Provide exactly one of amountRaw or amountXno");
        }
        const amountRaw = amountRawArg ? String(amountRawArg) : nanoToRaw(String(amountXnoArg));
        if (!/^\d+$/.test(amountRaw)) throw new Error("amount must be a non-negative integer string");
        if (BigInt(amountRaw) <= 0n) throw new Error("amount must be > 0");

        const rpcUrl = effectiveRpcUrl((args as any)?.rpcUrl as string | undefined);
        const workUrl = effectiveWorkUrl((args as any)?.workUrl as string | undefined);
        if (!rpcUrl) throw new Error("Missing RPC URL. Set xno-mcp config rpcUrl, pass rpcUrl, or set NANO_RPC_URL / XNO_RPC_URL.");
        if (!workUrl) throw new Error("Missing work URL. Set xno-mcp config workUrl, pass workUrl, or set rpcUrl.");

        const timeoutMs = effectiveTimeoutMs((args as any)?.timeoutMs as number | undefined);
        const includeXno = (args as any)?.includeXno ?? true;

        const acct = derivePurseAccount(purse, index);
        const info = await rpcAccountInfo(rpcUrl, acct.address, { timeoutMs });
        if (typeof (info as any)?.error === "string") throw new Error("Account is unopened. Receive funds first (purse_receive).");

        const previous = String((info as any).frontier);
        const representativeAddress = String((info as any).representative || "");
        const repVal = validateAddress(representativeAddress);
        if (!repVal.valid || !repVal.publicKey) throw new Error(`Invalid representative from RPC: ${repVal.error}`);

        const currentBalance = BigInt(String((info as any).balance));
        const sendAmount = BigInt(amountRaw);
        if (sendAmount > currentBalance) throw new Error("Insufficient balance");
        const newBalance = (currentBalance - sendAmount).toString();

        const blockHash = hashNanoStateBlock({
          accountPublicKey: acct.publicKey,
          previous,
          representativePublicKey: repVal.publicKey,
          balanceRaw: newBalance,
          link: destVal.publicKey,
        });
        const signature = nanoSignBlake2b(blockHash, acct.privateKey);
        const work = (await rpcWorkGenerate(workUrl, previous, { timeoutMs })).work;

        const block = {
          type: "state",
          account: acct.address,
          previous,
          representative: representativeAddress,
          balance: newBalance,
          link: destVal.publicKey,
          signature,
          work,
        };
        const processed = await rpcProcess(rpcUrl, block, "send", { timeoutMs });

        const out: any = {
          name: purse.name,
          format: purse.format,
          index,
          from: acct.address,
          to: destination,
          amountRaw,
          sendHash: processed.hash,
          balanceRaw: newBalance,
        };
        if (includeXno) {
          out.amountXno = rawToNano(amountRaw);
          out.balanceXno = rawToNano(newBalance);
        }

        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      }

      case "generate_wallet": {
        const format = String((args as any)?.format || 'bip39').toLowerCase();
        const index = (args as any)?.index ?? 0;
        if (format === 'bip39') {
          const words = (args as any)?.words ?? 24;
          const passphrase = (args as any)?.passphrase ?? '';
          const mnemonic = generateMnemonic(words);
          const derived = deriveAddressBIP44(mnemonic, index, passphrase);
          return { content: [{ type: "text", text: JSON.stringify({ format, index, mnemonic, ...derived }, null, 2) }] };
        }
        if (format === 'legacy') {
          const seed = generateSeed();
          const mnemonic = seedToMnemonic(seed);
          const derived = deriveAddressLegacy(seed, index);
          return { content: [{ type: "text", text: JSON.stringify({ format, index, mnemonic, seed, ...derived }, null, 2) }] };
        }
        throw new Error("Invalid format. Use bip39 or legacy.");
      }

      case "derive_address": {
        const mnemonic = (args as any)?.mnemonic as string | undefined;
        const seed = (args as any)?.seed as string | undefined;
        const index = ((args as any)?.index as number | undefined) ?? 0;
        const format = String((args as any)?.format || 'auto').toLowerCase();
        const passphrase = String((args as any)?.passphrase || '');
        const both = Boolean((args as any)?.both);

        const haveMnemonic = Boolean(mnemonic && mnemonic.trim().length > 0);
        const haveSeed = Boolean(seed && seed.trim().length > 0);
        if (!haveMnemonic && !haveSeed) throw new Error("Mnemonic or seed required");

        if (format === 'legacy') {
          const seedHex = haveSeed ? seed! : mnemonicToSeed(mnemonic!);
          const result = deriveAddressLegacy(seedHex, index);
          return { content: [{ type: "text", text: JSON.stringify({ format: 'legacy', index, ...result }, null, 2) }] };
        }

        if (format === 'bip39') {
          if (!haveMnemonic) throw new Error("bip39 derivation requires mnemonic");
          if (!validateMnemonic(mnemonic!)) throw new Error("Invalid BIP39 mnemonic");
          const result = deriveAddressBIP44(mnemonic!, index, passphrase);
          return { content: [{ type: "text", text: JSON.stringify({ format: 'bip39', index, ...result }, null, 2) }] };
        }

        // auto
        if (haveMnemonic) {
          const wc = mnemonic!.trim().split(/\s+/).filter(Boolean).length;
          if (!validateMnemonic(mnemonic!)) throw new Error("Invalid BIP39 mnemonic");
          const bip39 = deriveAddressBIP44(mnemonic!, index, passphrase);
          if (both && wc === 24) {
            const seedHex = mnemonicToSeed(mnemonic!);
            const legacy = deriveAddressLegacy(seedHex, index);
            return { content: [{ type: "text", text: JSON.stringify({ format: 'auto', index, bip39, legacy }, null, 2) }] };
          }
          return { content: [{ type: "text", text: JSON.stringify({ format: 'bip39', index, ...bip39 }, null, 2) }] };
        }

        // seed-only auto: treat as legacy seed
        const legacy = deriveAddressLegacy(seed!, index);
        return { content: [{ type: "text", text: JSON.stringify({ format: 'legacy', index, ...legacy }, null, 2) }] };
      }

      case "convert_units": {
        const amount = args?.amount as string;
        const from = (args?.from as string).toLowerCase();
        const to = (args?.to as string).toLowerCase();
        
        let raw: string;
        if (from === "xno" || from === "nano") raw = nanoToRaw(amount);
        else if (from === "raw") raw = amount;
        else throw new Error("Unsupported from unit");

        let result: string;
        if (to === "xno" || to === "nano") result = rawToNano(raw);
        else if (to === "raw") result = raw;
        else throw new Error("Unsupported to unit");

        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "validate_address": {
        const address = args?.address as string;
        const result = validateAddress(address);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "rpc_account_balance": {
        const address = args?.address as string;
        const rpcUrl =
          (args?.rpcUrl as string | undefined) ||
          process.env.NANO_RPC_URL ||
          process.env.XNO_RPC_URL ||
          '';
        const includeXno = (args?.includeXno as boolean | undefined) ?? true;
        const timeoutMs = (args?.timeoutMs as number | undefined) ?? 15000;

        if (!rpcUrl) throw new Error("Missing RPC URL. Provide rpcUrl or set NANO_RPC_URL / XNO_RPC_URL.");

        const bal = await rpcAccountBalance(rpcUrl, address, { timeoutMs });
        const out: any = { address, balanceRaw: bal.balance, pendingRaw: bal.pending };
        if (includeXno) {
          out.balanceXno = rawToNano(bal.balance);
          out.pendingXno = rawToNano(bal.pending);
        }

        return {
          content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
        };
      }

      case "probe_mnemonic": {
        const mnemonic = (args as any)?.mnemonic as string;
        const passphrase = String((args as any)?.passphrase || '');
        const count = Math.max(1, Math.min(100, ((args as any)?.count as number | undefined) ?? 5));
        const timeoutMs = ((args as any)?.timeoutMs as number | undefined) ?? 15000;
        const rpcUrl =
          ((args as any)?.rpcUrl as string | undefined) ||
          process.env.NANO_RPC_URL ||
          process.env.XNO_RPC_URL ||
          '';

        if (!rpcUrl) throw new Error("Missing RPC URL. Provide rpcUrl or set NANO_RPC_URL / XNO_RPC_URL.");
        if (!validateMnemonic(mnemonic)) throw new Error("Invalid BIP39 mnemonic");

        const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length;
        const out: any = { mnemonicWordCount: wordCount, count, bip39: [], legacy: [] };

        const addresses: string[] = [];
        for (let i = 0; i < count; i++) {
          const d = deriveAddressBIP44(mnemonic, i, passphrase);
          out.bip39.push({ index: i, address: d.address });
          addresses.push(d.address);
        }
        if (wordCount === 24) {
          const legacySeed = mnemonicToSeed(mnemonic);
          for (let i = 0; i < count; i++) {
            const d = deriveAddressLegacy(legacySeed, i);
            out.legacy.push({ index: i, address: d.address });
            addresses.push(d.address);
          }
        }

        const balances = await rpcAccountsBalances(rpcUrl, addresses, { timeoutMs });
        const frontiers = await rpcAccountsFrontiers(rpcUrl, addresses, { timeoutMs });
        const annotate = (arr: any[]) => arr.map((x) => {
          const b = balances.balances?.[x.address];
          const opened = Boolean(frontiers.frontiers?.[x.address]);
          return {
            ...x,
            opened,
            balanceRaw: b?.balance ?? '0',
            pendingRaw: b?.pending ?? '0',
          };
        });
        out.bip39 = annotate(out.bip39);
        out.legacy = annotate(out.legacy);
        const bip39Hit = out.bip39.some((x: any) => x.opened || x.balanceRaw !== '0' || x.pendingRaw !== '0');
        const legacyHit = out.legacy.some((x: any) => x.opened || x.balanceRaw !== '0' || x.pendingRaw !== '0');
        out.likelyFormat = bip39Hit && !legacyHit ? 'bip39' : legacyHit && !bip39Hit ? 'legacy' : 'ambiguous';

        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
