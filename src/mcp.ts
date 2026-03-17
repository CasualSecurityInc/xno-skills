import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { generateSeed, generateMnemonic, seedToMnemonic, mnemonicToSeed, validateMnemonic } from "./seed.js";
import { deriveAddressLegacy } from "./address-legacy.js";
import { deriveAddressBIP44 } from "./address-bip44.js";
import { validateAddress } from "./validate.js";
import { nanoToRaw, rawToNano } from "./convert.js";
import { generateAsciiQr, buildNanoUri } from "./qr.js";
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
import { localWorkGenerate, getThresholdForSubtype } from "./pow.js";
import { version } from "./version.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const server = new Server(
  {
    name: "xno-mcp",
    version: version,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

type McpConfig = {
  rpcUrl?: string;
  workUrl?: string;
  timeoutMs?: number;
  persistWallets?: boolean;
  defaultRepresentative?: string;
  useLocalPow?: boolean;
  maxSendXno?: string;
};

type WalletFormat = "bip39" | "legacy";

type Wallet =
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

// Well-known public RPC nodes (for convenience - users should use their own nodes for production)
const WELL_KNOWN_RPC_NODES = [
  "https://rpc.nano.org",
  "https://app.natrium.io/api/rpc",
  "https://rainstorm.city/api",
  "https://nanonode.cc/api",
  "https://node.somenano.site/api",
];

// Well-known representatives (trusted, high-uptime)
const WELL_KNOWN_REPRESENTATIVES = [
  "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4", // Nano Foundation #1
  "nano_1stofnrxuz3cai7ze75o174bpm7scwj9jn3nxsn8ntzg784jf1gzn1jjdkou", // Nano Foundation #2
  "nano_1anrzcuwe64rwxzcco8dkhpyxpi8kd7zsjc1oeimpc3ppca4mrjtwnqposrs", // Nano Foundation #7
];

const DEFAULT_PERSIST_WALLETS = (() => {
  const env = process.env.XNO_MCP_PERSIST_WALLETS;
  if (env !== undefined) return env === 'true';
  return true;
})();

type PaymentRequestStatus = 'pending' | 'partial' | 'funded' | 'received' | 'refunded' | 'cancelled';

type PaymentRequest = {
  id: string;
  walletName: string;
  accountIndex: number;
  address: string;
  amountRaw: string;
  reason: string;
  status: PaymentRequestStatus;
  createdAt: string;
  updatedAt: string;
  receivedBlocks: { sendHash: string; source: string; amountRaw: string; receiveHash?: string }[];
};

type TransactionRecord = {
  id: string;
  walletName: string;
  accountIndex: number;
  address: string;
  type: 'send' | 'receive';
  amountRaw: string;
  counterparty: string;
  hash: string;
  paymentRequestId?: string;
  timestamp: string;
};

const DEFAULT_MAX_SEND_XNO = (() => {
  const env = process.env.XNO_MAX_SEND;
  if (env !== undefined && env.trim()) return env.trim();
  return "1.0";
})();

const state = {
  config: { persistWallets: DEFAULT_PERSIST_WALLETS } as McpConfig,
  wallets: new Map<string, Wallet>(),
  paymentRequests: new Map<string, PaymentRequest>(),
  transactions: [] as TransactionRecord[],
};

// Get the directory where this module is installed (similar to MCP memory server)
// This ensures config/wallets are stored in a predictable location relative to the package
function getInstalledDir(): string {
  // ESM: use import.meta.url; CJS: use __dirname
  // @ts-ignore
  const url = typeof import.meta?.url === 'string' ? import.meta.url : null;
  if (url) {
    return path.dirname(fileURLToPath(url));
  }
  // @ts-ignore - __dirname is available in CJS
  return __dirname;
}

function getHomeDir(): string {
  // Priority: 1. Environment variable, 2. Installed package directory
  const envHome = process.env.XNO_MCP_HOME;
  if (envHome && envHome.trim()) return path.resolve(envHome);
  return path.join(getInstalledDir(), ".xno-mcp");
}

function getConfigPath(): string {
  const envPath = process.env.XNO_MCP_CONFIG_PATH;
  if (envPath && envPath.trim()) return path.resolve(envPath);
  return path.join(getHomeDir(), "config.json");
}

function getWalletsPath(): string {
  const envPath = process.env.XNO_MCP_PURSES_PATH;
  if (envPath && envPath.trim()) return path.resolve(envPath);
  return path.join(getHomeDir(), "wallets.json");
}

function getPaymentRequestsPath(): string {
  const envPath = process.env.XNO_MCP_REQUESTS_PATH;
  if (envPath && envPath.trim()) return path.resolve(envPath);
  return path.join(getHomeDir(), "requests.json");
}

function getTransactionsPath(): string {
  const envPath = process.env.XNO_MCP_TRANSACTIONS_PATH;
  if (envPath && envPath.trim()) return path.resolve(envPath);
  return path.join(getHomeDir(), "transactions.json");
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

  if (state.config.persistWallets) {
    const persisted = loadJsonFile<{ wallets: Wallet[] }>(getWalletsPath());
    if (persisted?.wallets?.length) {
      for (const p of persisted.wallets) state.wallets.set(p.name, p);
    }
  }

  const persistedRequests = loadJsonFile<{ requests: PaymentRequest[] }>(getPaymentRequestsPath());
  if (persistedRequests?.requests?.length) {
    for (const r of persistedRequests.requests) state.paymentRequests.set(r.id, r);
  }

  const persistedTransactions = loadJsonFile<{ transactions: TransactionRecord[] }>(getTransactionsPath());
  if (persistedTransactions?.transactions?.length) {
    state.transactions = persistedTransactions.transactions;
  }
}

function persistConfig() {
  saveJsonFile(getConfigPath(), state.config);
}

function persistWallets() {
  if (!state.config.persistWallets) return;
  saveJsonFile(getWalletsPath(), { wallets: Array.from(state.wallets.values()) });
}

function persistPaymentRequests() {
  saveJsonFile(getPaymentRequestsPath(), { requests: Array.from(state.paymentRequests.values()) });
}

function persistTransactions() {
  saveJsonFile(getTransactionsPath(), { transactions: state.transactions });
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function effectiveRpcUrl(explicit?: string): string {
  const url = (
    explicit ||
    state.config.rpcUrl ||
    process.env.NANO_RPC_URL ||
    ""
  );
  return url;
}

function effectiveDefaultRepresentative(): string {
  return state.config.defaultRepresentative || WELL_KNOWN_REPRESENTATIVES[0];
}

function rpcUrlErrorMessage(): string {
  return (
    "Missing RPC URL. Options:\n" +
    "1. Set via config_set: { \"rpcUrl\": \"https://rpc.nano.org\" }\n" +
    "2. Pass as parameter: { \"rpcUrl\": \"https://rpc.nano.org\" }\n" +
    "3. Set environment variable: NANO_RPC_URL=https://rpc.nano.org\n" +
    "Well-known public nodes: https://rpc.nano.org, https://app.natrium.io/api/rpc, https://nanonode.cc/api"
  );
}

function effectiveWorkUrl(explicit?: string): string {
  return explicit || state.config.workUrl || effectiveRpcUrl() || "";
}

function effectiveTimeoutMs(explicit?: number): number {
  return explicit ?? state.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

function effectiveUseLocalPow(explicit?: boolean): boolean {
  // Default to true - use local PoW instead of remote work_generate
  return explicit ?? state.config.useLocalPow ?? true;
}

function deriveWalletAccount(wallet: Wallet, index: number) {
  if (!Number.isInteger(index) || index < 0) throw new Error("index must be a non-negative integer");
  if (wallet.format === "bip39") return deriveAddressBIP44(wallet.mnemonic, index, wallet.passphrase);
  return deriveAddressLegacy(wallet.seed, index);
}

const ZERO_32_HEX = "0".repeat(64);

function requireRepresentativeAddress(explicit?: string): string {
  const rep = (explicit || state.config.defaultRepresentative || "").trim();
  if (!rep) {
    // Use a well-known representative as fallback
    const defaultRep = WELL_KNOWN_REPRESENTATIVES[0];
    const v = validateAddress(defaultRep);
    if (!v.valid) throw new Error(`Invalid default representative: ${v.error}`);
    return defaultRep;
  }
  const v = validateAddress(rep);
  if (!v.valid) throw new Error(`Invalid representative address: ${v.error}`);
  return rep;
}

function walletToPublicSummary(wallet: Wallet, count: number = 1) {
  const accounts: { index: number; address: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = deriveWalletAccount(wallet, i);
    accounts.push({ index: i, address: d.address });
  }
  return {
    name: wallet.name,
    format: wallet.format,
    createdAt: wallet.createdAt,
    accounts,
  };
}

function effectiveMaxSendRaw(): string {
  const xno = state.config.maxSendXno ?? DEFAULT_MAX_SEND_XNO;
  return nanoToRaw(xno);
}

function enforceMaxSend(amountRaw: string): void {
  const maxRaw = BigInt(effectiveMaxSendRaw());
  if (BigInt(amountRaw) > maxRaw) {
    const capXno = state.config.maxSendXno ?? DEFAULT_MAX_SEND_XNO;
    throw new Error(
      `Send amount exceeds max-send cap of ${capXno} XNO. ` +
      `Ask the operator to raise the limit via config_set({ maxSendXno: "..." }).`
    );
  }
}

type AutoReceiveResult = {
  received: { sendHash: string; source: string; amountRaw: string; receiveHash: string }[];
  newFrontier: string;
  newBalance: string;
};

async function autoReceivePending(opts: {
  wallet: Wallet;
  index: number;
  acct: { address: string; publicKey: string; privateKey: string };
  rpcUrl: string;
  workUrl: string;
  timeoutMs: number;
  useLocalPow: boolean;
  frontier: string;
  balance: string;
  representativeAddress: string;
  repPublicKey: string;
  maxCount?: number;
}): Promise<AutoReceiveResult> {
  const receivable = await rpcReceivable(opts.rpcUrl, opts.acct.address, opts.maxCount ?? 10, { timeoutMs: opts.timeoutMs });
  if (!receivable.length) return { received: [], newFrontier: opts.frontier, newBalance: opts.balance };

  let previous = opts.frontier;
  let balanceRaw = opts.balance;
  const received: AutoReceiveResult["received"] = [];

  for (const p of receivable) {
    const amountRaw = String(p.amount);
    const newBalance = (BigInt(balanceRaw) + BigInt(amountRaw)).toString();
    const workRoot = previous !== ZERO_32_HEX ? previous : opts.acct.publicKey;
    const link = p.hash;

    const blockHash = hashNanoStateBlock({
      accountPublicKey: opts.acct.publicKey,
      previous,
      representativePublicKey: opts.repPublicKey,
      balanceRaw: newBalance,
      link,
    });
    const signature = nanoSignBlake2b(blockHash, opts.acct.privateKey);
    const subtype = previous === ZERO_32_HEX ? "open" : "receive";

    let work: string;
    if (opts.useLocalPow) {
      work = (await localWorkGenerate(workRoot, getThresholdForSubtype(subtype))).work;
    } else {
      work = (await rpcWorkGenerate(opts.workUrl, workRoot, { timeoutMs: opts.timeoutMs })).work;
    }

    const block = {
      type: "state",
      account: opts.acct.address,
      previous,
      representative: opts.representativeAddress,
      balance: newBalance,
      link,
      signature,
      work,
    };

    const processed = await rpcProcess(opts.rpcUrl, block, subtype as any, { timeoutMs: opts.timeoutMs });
    received.push({ sendHash: p.hash, source: p.source ?? "", amountRaw, receiveHash: processed.hash });

    state.transactions.push({
      id: generateId(),
      walletName: opts.wallet.name,
      accountIndex: opts.index,
      address: opts.acct.address,
      type: "receive",
      amountRaw,
      counterparty: p.source ?? "",
      hash: processed.hash,
      timestamp: new Date().toISOString(),
    });

    previous = processed.hash;
    balanceRaw = newBalance;
  }

  persistTransactions();
  return { received, newFrontier: previous, newBalance: balanceRaw };
}

loadStateFromDisk();

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        uriTemplate: "wallet://{name}",
        name: "Wallet Status",
        description: "Status and balances for a named xno-mcp wallet",
        mimeType: "application/json",
      },
      {
        uriTemplate: "wallet://{name}/account/{index}",
        name: "Wallet Account Details",
        description: "Specific details and pending blocks for a wallet account",
        mimeType: "application/json",
      },
    ],
  };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = Array.from(state.wallets.keys()).map((name) => ({
    uri: `wallet://${name}`,
    name: `Wallet ${name}`,
    description: `Wallet ${name} in xno-mcp`,
    mimeType: "application/json",
  }));
  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const walletMatch = /^wallet:\/\/([^/]+)$/.exec(uri);
  const accountMatch = /^wallet:\/\/([^/]+)\/account\/(\d+)$/.exec(uri);

  const rpcUrl = effectiveRpcUrl();
  const timeoutMs = effectiveTimeoutMs();

  if (walletMatch) {
    const name = walletMatch[1];
    const wallet = state.wallets.get(name);
    if (!wallet) throw new Error(`Wallet not found: ${name}`);

    const count = 5;
    const addresses: string[] = [];
    const accounts: { index: number; address: string }[] = [];
    for (let i = 0; i < count; i++) {
      const address = deriveWalletAccount(wallet, i).address;
      accounts.push({ index: i, address });
      addresses.push(address);
    }

    let balances: any = {};
    let frontiers: any = {};
    if (rpcUrl) {
      try {
        balances = await rpcAccountsBalances(rpcUrl, addresses, { timeoutMs }).catch(() => ({}));
        frontiers = await rpcAccountsFrontiers(rpcUrl, addresses, { timeoutMs }).catch(() => ({}));
      } catch (e) {}
    }

    const rows = accounts.map((a) => {
      const b = balances?.balances?.[a.address];
      const opened = Boolean(frontiers?.frontiers?.[a.address]);
      return {
        ...a,
        opened,
        balanceRaw: b?.balance ?? "0",
        pendingRaw: b?.pending ?? "0",
        balanceXno: rawToNano(b?.balance ?? "0"),
        pendingXno: rawToNano(b?.pending ?? "0"),
      };
    });

    const data = {
      name: wallet.name,
      format: wallet.format,
      createdAt: wallet.createdAt,
      rows,
    };

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  if (accountMatch) {
    const name = accountMatch[1];
    const index = parseInt(accountMatch[2], 10);
    const wallet = state.wallets.get(name);
    if (!wallet) throw new Error(`Wallet not found: ${name}`);

    const acct = deriveWalletAccount(wallet, index);
    let info: any = { error: "Account unopened or network error" };
    let receivable: any[] = [];

    if (rpcUrl) {
      try {
        info = await rpcAccountInfo(rpcUrl, acct.address, { timeoutMs }).catch((e) => ({ error: String(e) }));
        receivable = await rpcReceivable(rpcUrl, acct.address, 10, { timeoutMs }).catch(() => []);
      } catch (e) {}
    }

    const opened = !(typeof info?.error === "string");
    const data = {
      name: wallet.name,
      index,
      address: acct.address,
      opened,
      info,
      pendingBlocks: receivable,
    };

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unsupported resource URI: ${uri}`);
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "config_get",
        description: "Get xno-mcp defaults (RPC URL, representative, timeouts, persistence). Use this to check current configuration.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "config_set",
        description: "Set xno-mcp defaults. RECOMMENDED: Set rpcUrl and defaultRepresentative once to avoid repeating them in every call. Example: { \"rpcUrl\": \"https://rpc.nano.org\", \"defaultRepresentative\": \"nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4\" }",
        inputSchema: {
          type: "object",
          properties: {
            rpcUrl: { type: "string", description: "Default Nano node RPC URL. Well-known public nodes: https://rpc.nano.org, https://app.natrium.io/api/rpc, https://nanonode.cc/api" },
            workUrl: { type: "string", description: "Optional work_generate RPC URL (defaults to rpcUrl). Most nodes support work_generate." },
            timeoutMs: { type: "number", description: "Default RPC timeout in ms", default: DEFAULT_TIMEOUT_MS },
            persistWallets: {
              type: "boolean",
              description:
                "Persist wallets to disk (plaintext JSON in .xno-mcp). Keep false unless you understand the risk.",
              default: false,
            },
            useLocalPow: {
              type: "boolean",
              description: "Use local PoW (WASM/WebGPU) instead of remote work_generate RPC. Default true.",
              default: true,
            },
            defaultRepresentative: {
              type: "string",
              description:
                "Default representative address for opening accounts. Used by wallet_receive when account is unopened. Well-known reps: nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4 (Nano Foundation #1)",
            },
            maxSendXno: {
              type: "string",
              description:
                `Max XNO per send transaction. Default: ${DEFAULT_MAX_SEND_XNO} XNO. Also settable via XNO_MAX_SEND env var.`,
            },
          },
        },
      },
      {
        name: "wallet_create",
        description:
          "Create a named wallet (custodial wallet in xno-mcp). Returns addresses only (no seed/mnemonic).",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Wallet name (unique key)" },
            format: { type: "string", description: "bip39 (default) or legacy", default: "bip39" },
            words: { type: "number", description: "BIP39 word count (12/15/18/21/24). Only for format=bip39.", default: 24 },
            passphrase: { type: "string", description: "Optional BIP39 passphrase (only for format=bip39)", default: "" },
            mnemonic: { type: "string", description: "Optional existing mnemonic to import" },
            seed: { type: "string", description: "Optional existing raw seed to import (legacy format only)" },
            count: { type: "number", description: "How many initial account indexes to return", default: 1 },
            overwrite: { type: "boolean", description: "Overwrite if wallet already exists", default: false },
          },
          required: ["name"],
        },
      },
      {
        name: "wallet_list",
        description: "List wallets currently held by xno-mcp",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "wallet_addresses",
        description: "Get addresses for a named wallet (derive on demand; secrets stay in xno-mcp)",
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
        name: "wallet_balance",
        description: "Check balance/pending for a wallet account. NOTE: Returns 0 balance for unopened accounts. Use wallet_probe_balances to see which accounts are opened.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            index: { type: "number", default: 0 },
            rpcUrl: { type: "string", description: "Nano node RPC URL. If not set, uses rpcUrl from config or NANO_RPC_URL env var." },
            includeXno: { type: "boolean", default: true },
            timeoutMs: { type: "number", default: DEFAULT_TIMEOUT_MS },
          },
          required: ["name"],
        },
      },
      {
        name: "wallet_probe_balances",
        description:
          "Check first N account indexes for a wallet via RPC, including whether each account is opened (frontier exists)",
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
        name: "wallet_receive",
        description:
          "Receive pending Nano blocks for a wallet account. CRITICAL: Nano transfers show as 'pending' until you call this. For unopened accounts (first receive), a representative is required - pass 'representative' or set defaultRepresentative in config_set. Well-known reps: nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4 (Nano Foundation #1).",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            index: { type: "number", default: 0 },
            count: { type: "number", description: "Max pending blocks to receive", default: 10 },
            onlyHash: { type: "string", description: "If set, only receive this pending send block hash" },
            representative: { type: "string", description: "Representative address for unopened accounts. If not set, uses defaultRepresentative from config or a well-known representative." },
            rpcUrl: { type: "string", description: "Nano node RPC URL. If not set, uses rpcUrl from config or NANO_RPC_URL env var." },
            workUrl: { type: "string", description: "Work generation RPC URL (defaults to rpcUrl)" },
            includeXno: { type: "boolean", default: true },
            timeoutMs: { type: "number", default: DEFAULT_TIMEOUT_MS },
            useLocalPow: { type: "boolean", description: "Use local PoW instead of remote work_generate RPC. Default true.", default: true },
          },
          required: ["name"],
        },
      },
      {
        name: "wallet_send",
        description:
          `Send Nano from a wallet account. Max send per transaction: ${state.config.maxSendXno ?? DEFAULT_MAX_SEND_XNO} XNO (change via config_set or XNO_MAX_SEND env var). Account must be opened and have sufficient balance.`,
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            index: { type: "number", default: 0 },
            destination: { type: "string", description: "Destination nano_... address" },
            amountRaw: { type: "string", description: "Amount in raw (string)" },
            amountXno: { type: "string", description: "Amount in XNO (string; will be converted to raw)" },
            rpcUrl: { type: "string", description: "Nano node RPC URL. If not set, uses rpcUrl from config or NANO_RPC_URL env var." },
            workUrl: { type: "string", description: "Work generation RPC URL (defaults to rpcUrl)" },
            includeXno: { type: "boolean", default: true },
            timeoutMs: { type: "number", default: DEFAULT_TIMEOUT_MS },
            useLocalPow: { type: "boolean", description: "Use local PoW instead of remote work_generate RPC. Default true.", default: true },
          },
          required: ["name", "destination"],
        },
      },
      {
        name: "payment_request_create",
        description: "Create a payment request. Reuses an existing wallet account or creates a new wallet if needed. Returns address, QR-ready URI, and request ID for tracking.",
        inputSchema: {
          type: "object",
          properties: {
            walletName: { type: "string", description: "Wallet name (optional - will auto-select or create)" },
            accountIndex: { type: "number", default: 0 },
            amountXno: { type: "string" },
            reason: { type: "string" },
          },
          required: ["amountXno", "reason"],
        },
      },
      {
        name: "payment_request_status",
        description: "Check payment request status. Shows funding progress, received blocks, and source addresses.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      {
        name: "payment_request_receive",
        description: "Check for and receive pending funds for a payment request. Call this after the operator says they've sent funds.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      {
        name: "payment_request_list",
        description: "List all payment requests, optionally filtered by status.",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by status" },
            walletName: { type: "string" },
          },
        },
      },
      {
        name: "payment_request_refund",
        description: "Prepare or execute a refund for a payment request. If multiple source addresses exist, returns candidates for user confirmation. NEVER auto-refund without confirmation when sources are ambiguous.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            confirmAddress: { type: "string", description: "Required when multiple sources exist" },
            execute: { type: "boolean", description: "When true, actually sends the refund", default: false },
          },
          required: ["id"],
        },
      },
      {
        name: "wallet_history",
        description: "View transaction history for a wallet account. Shows sends, receives, and linked payment requests.",
        inputSchema: {
          type: "object",
          properties: {
            walletName: { type: "string" },
            accountIndex: { type: "number", default: 0 },
            limit: { type: "number", default: 20 },
          },
          required: ["walletName"],
        },
      },
      {
        name: "generate_wallet",
        description: "Generate a new Nano wallet (default: BIP39 derivation). WARNING: This returns the mnemonic/seed in the response. For custodial wallets where secrets should stay hidden, use wallet_create instead.",
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
        description: "Query a Nano node for account balance + pending. NOTE: Returns 0 for unopened accounts. Well-known public RPC nodes: https://rpc.nano.org, https://app.natrium.io/api/rpc, https://nanonode.cc/api",
        inputSchema: {
          type: "object",
          properties: {
            address: { type: "string" },
            rpcUrl: { type: "string", description: "Nano node RPC URL. Well-known public nodes: https://rpc.nano.org, https://app.natrium.io/api/rpc" },
            includeXno: { type: "boolean", default: true },
            timeoutMs: { type: "number", default: 15000 },
          },
          required: ["address"],
        },
      },
      {
        name: "probe_mnemonic",
        description: "Try bip39 + legacy derivations and probe first N indexes via RPC. Helps resolve 24-word mnemonic ambiguity by checking which derivation has opened accounts/balances.",
        inputSchema: {
          type: "object",
          properties: {
            mnemonic: { type: "string" },
            passphrase: { type: "string", default: "" },
            count: { type: "number", default: 5 },
            rpcUrl: { type: "string", description: "Nano node RPC URL. Well-known public nodes: https://rpc.nano.org, https://app.natrium.io/api/rpc" },
            timeoutMs: { type: "number", default: 15000 },
          },
          required: ["mnemonic"],
        },
      },

      {
        name: "generate_qr",
        description: "Generate an ASCII QR code for a Nano address, optionally with an amount. Returns the QR as text art.",
        inputSchema: {
          type: "object",
          properties: {
            address: { type: "string", description: "Nano address (nano_...)" },
            amountXno: { type: "string", description: "Optional amount in XNO" },
          },
          required: ["address"],
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
        const persistWalletsFlag = (args as any)?.persistWallets as boolean | undefined;
        const useLocalPowFlag = (args as any)?.useLocalPow as boolean | undefined;
        const defaultRepresentative = (args as any)?.defaultRepresentative as string | undefined;

        if (rpcUrl !== undefined) state.config.rpcUrl = rpcUrl;
        if (workUrl !== undefined) state.config.workUrl = workUrl;
        if (timeoutMs !== undefined) state.config.timeoutMs = timeoutMs;
        if (persistWalletsFlag !== undefined) state.config.persistWallets = persistWalletsFlag;
        if (useLocalPowFlag !== undefined) state.config.useLocalPow = useLocalPowFlag;
        if (defaultRepresentative !== undefined) state.config.defaultRepresentative = defaultRepresentative;

        const maxSendXno = (args as any)?.maxSendXno as string | undefined;
        if (maxSendXno !== undefined) state.config.maxSendXno = maxSendXno;

        persistConfig();
        if (state.config.persistWallets) persistWallets();

        return { content: [{ type: "text", text: JSON.stringify(state.config, null, 2) }] };
      }

      case "wallet_create": {
        const walletName = String((args as any)?.name || "").trim();
        if (!walletName) throw new Error("Wallet name is required");

        const overwrite = Boolean((args as any)?.overwrite);
        if (!overwrite && state.wallets.has(walletName)) throw new Error(`Wallet already exists: ${walletName}`);

        const format = String((args as any)?.format || "bip39").toLowerCase() as WalletFormat;
        const importedMnemonic = (args as any)?.mnemonic as string | undefined;
        const importedSeed = (args as any)?.seed as string | undefined;
        const createdAt = new Date().toISOString();
        let wallet: Wallet;

        if (format === "bip39") {
          const passphrase = String((args as any)?.passphrase || "");
          if (importedMnemonic) {
             if (!validateMnemonic(importedMnemonic)) throw new Error("Invalid BIP39 mnemonic");
             wallet = { name: walletName, format: "bip39", mnemonic: importedMnemonic, passphrase, createdAt };
          } else {
             const words = (args as any)?.words ?? 24;
             const mnemonic = generateMnemonic(words);
             wallet = { name: walletName, format: "bip39", mnemonic, passphrase, createdAt };
          }
        } else if (format === "legacy") {
          if (importedSeed) {
             const mnemonic = seedToMnemonic(importedSeed);
             wallet = { name: walletName, format: "legacy", seed: importedSeed, mnemonic, createdAt };
          } else if (importedMnemonic) {
             const seed = mnemonicToSeed(importedMnemonic);
             wallet = { name: walletName, format: "legacy", seed, mnemonic: importedMnemonic, createdAt };
          } else {
             const seed = generateSeed();
             const mnemonic = seedToMnemonic(seed);
             wallet = { name: walletName, format: "legacy", seed, mnemonic, createdAt };
          }
        } else {
          throw new Error("Invalid format. Use bip39 or legacy.");
        }

        state.wallets.set(walletName, wallet);
        persistWallets();

        const count = Math.max(1, Math.min(100, (args as any)?.count ?? 1));
        const summary = walletToPublicSummary(wallet, count);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ...summary,
                  note:
                    "This is a custodial wallet held by xno-mcp. Secrets are not returned by default.",
                  persistence: state.config.persistWallets ? "enabled" : "memory-only",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "wallet_list": {
        const list = Array.from(state.wallets.values()).map((p) => ({
          name: p.name,
          format: p.format,
          createdAt: p.createdAt,
        }));
        return { content: [{ type: "text", text: JSON.stringify({ wallets: list }, null, 2) }] };
      }

      case "wallet_addresses": {
        const walletName = String((args as any)?.name || "").trim();
        const wallet = state.wallets.get(walletName);
        if (!wallet) throw new Error(`Unknown wallet: ${walletName}`);

        const fromIndex = Math.max(0, (args as any)?.fromIndex ?? 0);
        const count = Math.max(1, Math.min(100, (args as any)?.count ?? 5));

        const accounts: { index: number; address: string }[] = [];
        for (let i = 0; i < count; i++) {
          const idx = fromIndex + i;
          accounts.push({ index: idx, address: deriveWalletAccount(wallet, idx).address });
        }

        return { content: [{ type: "text", text: JSON.stringify({ name: wallet.name, format: wallet.format, accounts }, null, 2) }] };
      }

      case "wallet_balance": {
        const walletName = String((args as any)?.name || "").trim();
        const wallet = state.wallets.get(walletName);
        if (!wallet) throw new Error(`Unknown wallet: ${walletName}`);

        const index = ((args as any)?.index as number | undefined) ?? 0;
        const includeXno = ((args as any)?.includeXno as boolean | undefined) ?? true;
        const timeoutMs = effectiveTimeoutMs((args as any)?.timeoutMs as number | undefined);
        const rpcUrl = effectiveRpcUrl((args as any)?.rpcUrl as string | undefined);
        if (!rpcUrl) throw new Error(rpcUrlErrorMessage());

        const address = deriveWalletAccount(wallet, index).address;

        const bal = await rpcAccountBalance(rpcUrl, address, { timeoutMs });
        const out: any = { name: wallet.name, format: wallet.format, index, address, balanceRaw: bal.balance, pendingRaw: bal.pending };
        if (includeXno) {
          out.balanceXno = rawToNano(bal.balance);
          out.pendingXno = rawToNano(bal.pending);
        }
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      }

      case "wallet_probe_balances": {
        const walletName = String((args as any)?.name || "").trim();
        const wallet = state.wallets.get(walletName);
        if (!wallet) throw new Error(`Unknown wallet: ${walletName}`);

        const count = Math.max(1, Math.min(100, (args as any)?.count ?? 5));
        const timeoutMs = effectiveTimeoutMs((args as any)?.timeoutMs as number | undefined);
        const rpcUrl = effectiveRpcUrl((args as any)?.rpcUrl as string | undefined);
        if (!rpcUrl) throw new Error(rpcUrlErrorMessage());

        const addresses: string[] = [];
        const accounts: { index: number; address: string }[] = [];
        for (let i = 0; i < count; i++) {
          const address = deriveWalletAccount(wallet, i).address;
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

        return { content: [{ type: "text", text: JSON.stringify({ name: wallet.name, format: wallet.format, rows }, null, 2) }] };
      }

      case "wallet_receive": {
        const walletName = String((args as any)?.name || "").trim();
        const wallet = state.wallets.get(walletName);
        if (!wallet) throw new Error(`Unknown wallet: ${walletName}`);

        const index = Math.max(0, (args as any)?.index ?? 0);
        const maxCount = Math.max(1, Math.min(100, (args as any)?.count ?? 10));
        const onlyHash = (args as any)?.onlyHash ? String((args as any)?.onlyHash).trim() : "";
        if (onlyHash && !/^[0-9a-fA-F]{64}$/.test(onlyHash)) throw new Error("onlyHash must be 32-byte hex (64 hex characters)");

        const rpcUrl = effectiveRpcUrl((args as any)?.rpcUrl as string | undefined);
        const workUrl = effectiveWorkUrl((args as any)?.workUrl as string | undefined);
        if (!rpcUrl) throw new Error(rpcUrlErrorMessage());
        if (!workUrl) throw new Error("Missing work URL. Set xno-mcp config workUrl, pass workUrl, or set rpcUrl (workUrl defaults to rpcUrl).");

        const timeoutMs = effectiveTimeoutMs((args as any)?.timeoutMs as number | undefined);
        const includeXno = (args as any)?.includeXno ?? true;

        const acct = deriveWalletAccount(wallet, index);
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
            name: wallet.name,
            format: wallet.format,
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
          
          const subtype = previous === ZERO_32_HEX ? "open" : "receive";
          const useLocalPow = effectiveUseLocalPow((args as any)?.useLocalPow as boolean | undefined);
          
          let work: string;
          if (useLocalPow) {
            work = (await localWorkGenerate(workRoot, getThresholdForSubtype(subtype))).work;
          } else {
            if (!workUrl) throw new Error("Missing work URL. Set xno-mcp config workUrl, pass workUrl, or set rpcUrl (workUrl defaults to rpcUrl).");
            work = (await rpcWorkGenerate(workUrl, workRoot, { timeoutMs })).work;
          }

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

          state.transactions.push({
            id: generateId(),
            walletName: wallet.name,
            accountIndex: index,
            address: acct.address,
            type: "receive",
            amountRaw,
            counterparty: p.source ?? "",
            hash: processed.hash,
            timestamp: new Date().toISOString(),
          });

          previous = processed.hash;
          balanceRaw = newBalance;
        }

        persistTransactions();

        const out: any = {
          name: wallet.name,
          format: wallet.format,
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

      case "wallet_send": {
        const walletName = String((args as any)?.name || "").trim();
        const wallet = state.wallets.get(walletName);
        if (!wallet) throw new Error(`Unknown wallet: ${walletName}`);

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
        if (!rpcUrl) throw new Error(rpcUrlErrorMessage());
        if (!workUrl) throw new Error("Missing work URL. Set xno-mcp config workUrl, pass workUrl, or set rpcUrl (workUrl defaults to rpcUrl).");

        const timeoutMs = effectiveTimeoutMs((args as any)?.timeoutMs as number | undefined);
        const includeXno = (args as any)?.includeXno ?? true;

        const acct = deriveWalletAccount(wallet, index);
        const info = await rpcAccountInfo(rpcUrl, acct.address, { timeoutMs });
        if (typeof (info as any)?.error === "string") {
          throw new Error(
            "Account is unopened (no transaction history). You must receive funds first using wallet_receive. " +
            "For unopened accounts, wallet_receive requires a representative (pass 'representative' parameter or set defaultRepresentative in config)."
          );
        }

        let previous = String((info as any).frontier);
        const representativeAddress = String((info as any).representative || "");
        const repVal = validateAddress(representativeAddress);
        if (!repVal.valid || !repVal.publicKey) throw new Error(`Invalid representative from RPC: ${repVal.error}`);

        const useLocalPow = effectiveUseLocalPow((args as any)?.useLocalPow as boolean | undefined);

        let currentBalance = BigInt(String((info as any).balance));
        const sendAmount = BigInt(amountRaw);

        if (sendAmount > currentBalance) {
          const autoRx = await autoReceivePending({
            wallet, index, acct, rpcUrl, workUrl,
            timeoutMs, useLocalPow,
            frontier: previous,
            balance: currentBalance.toString(),
            representativeAddress,
            repPublicKey: repVal.publicKey,
          });
          if (autoRx.received.length > 0) {
            previous = autoRx.newFrontier;
            currentBalance = BigInt(autoRx.newBalance);
          }
        }

        if (sendAmount > currentBalance) throw new Error("Insufficient balance");

        enforceMaxSend(amountRaw);

        const newBalance = (currentBalance - sendAmount).toString();

        const blockHash = hashNanoStateBlock({
          accountPublicKey: acct.publicKey,
          previous,
          representativePublicKey: repVal.publicKey,
          balanceRaw: newBalance,
          link: destVal.publicKey,
        });
        const signature = nanoSignBlake2b(blockHash, acct.privateKey);
        let work: string;
        if (useLocalPow) {
          work = (await localWorkGenerate(previous, 'send')).work;
        } else {
          if (!workUrl) throw new Error("Missing work URL. Set xno-mcp config workUrl, pass workUrl, or set rpcUrl (workUrl defaults to rpcUrl).");
          work = (await rpcWorkGenerate(workUrl, previous, { timeoutMs })).work;
        }

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

        state.transactions.push({
          id: generateId(),
          walletName: wallet.name,
          accountIndex: index,
          address: acct.address,
          type: "send",
          amountRaw,
          counterparty: destination,
          hash: processed.hash,
          timestamp: new Date().toISOString(),
        });
        persistTransactions();

        const out: any = {
          name: wallet.name,
          format: wallet.format,
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

      case "payment_request_create": {
        const amountXno = String((args as any)?.amountXno || "").trim();
        if (!amountXno) throw new Error("amountXno is required");
        const reason = String((args as any)?.reason || "").trim();
        if (!reason) throw new Error("reason is required");
        const accountIndex = Math.max(0, (args as any)?.accountIndex ?? 0);

        let walletName = String((args as any)?.walletName || "").trim();
        let wallet: Wallet;

        if (walletName) {
          const found = state.wallets.get(walletName);
          if (!found) throw new Error(`Unknown wallet: ${walletName}`);
          wallet = found;
        } else if (state.wallets.size === 1) {
          wallet = Array.from(state.wallets.values())[0];
          walletName = wallet.name;
        } else if (state.wallets.size === 0) {
          walletName = "default";
          const mnemonic = generateMnemonic(24);
          wallet = { name: walletName, format: "bip39", mnemonic, passphrase: "", createdAt: new Date().toISOString() };
          state.wallets.set(walletName, wallet);
          persistWallets();
        } else {
          throw new Error("Multiple wallets exist. Specify walletName.");
        }

        const acct = deriveWalletAccount(wallet, accountIndex);
        const amountRaw = nanoToRaw(amountXno);
        const now = new Date().toISOString();
        const id = generateId();

        const request: PaymentRequest = {
          id,
          walletName,
          accountIndex,
          address: acct.address,
          amountRaw,
          reason,
          status: "pending",
          createdAt: now,
          updatedAt: now,
          receivedBlocks: [],
        };

        state.paymentRequests.set(id, request);
        persistPaymentRequests();

        const qr = await generateAsciiQr(acct.address, amountXno);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              id,
              address: acct.address,
              amountXno,
              amountRaw,
              nanoUri: `nano:${acct.address}?amount=${amountRaw}`,
              qr,
              reason,
              status: request.status,
              walletName,
              accountIndex,
              note: "Share the address, nano: URI, or QR code with the operator. Call payment_request_receive after they send funds.",
            }, null, 2),
          }],
        };
      }

      case "payment_request_status": {
        const id = String((args as any)?.id || "").trim();
        if (!id) throw new Error("id is required");
        const request = state.paymentRequests.get(id);
        if (!request) throw new Error(`Payment request not found: ${id}`);

        const rpcUrl = effectiveRpcUrl();
        const timeoutMs = effectiveTimeoutMs();

        let onChain: any = null;
        if (rpcUrl) {
          try {
            const bal = await rpcAccountBalance(rpcUrl, request.address, { timeoutMs });
            onChain = {
              balanceRaw: bal.balance,
              pendingRaw: bal.pending,
              balanceXno: rawToNano(bal.balance),
              pendingXno: rawToNano(bal.pending),
            };
          } catch {}
        }

        const sources = [...new Set(request.receivedBlocks.map((b) => b.source))];
        const totalReceivedRaw = request.receivedBlocks.reduce((acc, b) => acc + BigInt(b.amountRaw), 0n).toString();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ...request,
              amountXno: rawToNano(request.amountRaw),
              totalReceivedRaw,
              totalReceivedXno: rawToNano(totalReceivedRaw),
              sourceAddresses: sources,
              onChain,
            }, null, 2),
          }],
        };
      }

      case "payment_request_receive": {
        const id = String((args as any)?.id || "").trim();
        if (!id) throw new Error("id is required");
        const request = state.paymentRequests.get(id);
        if (!request) throw new Error(`Payment request not found: ${id}`);

        const wallet = state.wallets.get(request.walletName);
        if (!wallet) throw new Error(`Wallet not found: ${request.walletName}`);

        const rpcUrl = effectiveRpcUrl();
        const workUrl = effectiveWorkUrl();
        if (!rpcUrl) throw new Error(rpcUrlErrorMessage());
        if (!workUrl) throw new Error("Missing work URL. Set xno-mcp config workUrl, pass workUrl, or set rpcUrl (workUrl defaults to rpcUrl).");

        const timeoutMs = effectiveTimeoutMs();
        const index = request.accountIndex;
        const acct = deriveWalletAccount(wallet, index);

        const info = await rpcAccountInfo(rpcUrl, acct.address, { timeoutMs });
        const openedBefore = !(typeof (info as any)?.error === "string");
        let previous = openedBefore ? String((info as any).frontier) : ZERO_32_HEX;
        let balanceRaw = openedBefore ? String((info as any).balance) : "0";
        const representativeAddress = openedBefore
          ? String((info as any).representative || "")
          : requireRepresentativeAddress(undefined);

        const repVal = validateAddress(representativeAddress);
        if (!repVal.valid || !repVal.publicKey) throw new Error(`Invalid representative address: ${repVal.error}`);

        const receivable = await rpcReceivable(rpcUrl, acct.address, 10, { timeoutMs });
        if (!receivable.length) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ id, status: request.status, message: "No pending blocks found.", address: acct.address }, null, 2),
            }],
          };
        }

        const received: any[] = [];
        for (const p of receivable) {
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
          const subtype = previous === ZERO_32_HEX ? "open" : "receive";
          const work = (await localWorkGenerate(workRoot, getThresholdForSubtype(subtype))).work;

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

          request.receivedBlocks.push({
            sendHash: p.hash,
            source: p.source ?? "",
            amountRaw,
            receiveHash: processed.hash,
          });

          state.transactions.push({
            id: generateId(),
            walletName: wallet.name,
            accountIndex: index,
            address: acct.address,
            type: "receive",
            amountRaw,
            counterparty: p.source ?? "",
            hash: processed.hash,
            paymentRequestId: id,
            timestamp: new Date().toISOString(),
          });

          previous = processed.hash;
          balanceRaw = newBalance;
        }

        const totalReceivedRaw = request.receivedBlocks.reduce((acc, b) => acc + BigInt(b.amountRaw), 0n).toString();
        const requestedBig = BigInt(request.amountRaw);
        const receivedBig = BigInt(totalReceivedRaw);
        if (receivedBig >= requestedBig) {
          request.status = receivedBig > requestedBig ? "funded" : "received";
        } else if (receivedBig > 0n) {
          request.status = "partial";
        }
        request.updatedAt = new Date().toISOString();

        persistPaymentRequests();
        persistTransactions();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              id,
              status: request.status,
              received,
              totalReceivedRaw,
              totalReceivedXno: rawToNano(totalReceivedRaw),
              requestedRaw: request.amountRaw,
              requestedXno: rawToNano(request.amountRaw),
              balanceRaw,
              balanceXno: rawToNano(balanceRaw),
            }, null, 2),
          }],
        };
      }

      case "payment_request_list": {
        const statusFilter = (args as any)?.status as string | undefined;
        const walletNameFilter = (args as any)?.walletName as string | undefined;

        let requests = Array.from(state.paymentRequests.values());
        if (statusFilter) requests = requests.filter((r) => r.status === statusFilter);
        if (walletNameFilter) requests = requests.filter((r) => r.walletName === walletNameFilter);

        const out = requests.map((r) => ({
          ...r,
          amountXno: rawToNano(r.amountRaw),
          totalReceivedRaw: r.receivedBlocks.reduce((acc, b) => acc + BigInt(b.amountRaw), 0n).toString(),
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ count: out.length, requests: out }, null, 2),
          }],
        };
      }

      case "payment_request_refund": {
        const id = String((args as any)?.id || "").trim();
        if (!id) throw new Error("id is required");
        const request = state.paymentRequests.get(id);
        if (!request) throw new Error(`Payment request not found: ${id}`);

        const execute = Boolean((args as any)?.execute);
        const confirmAddress = (args as any)?.confirmAddress as string | undefined;

        const sourceMap = new Map<string, bigint>();
        for (const b of request.receivedBlocks) {
          sourceMap.set(b.source, (sourceMap.get(b.source) ?? 0n) + BigInt(b.amountRaw));
        }

        const sources = Array.from(sourceMap.entries()).map(([address, amountRaw]) => ({
          address,
          amountRaw: amountRaw.toString(),
          amountXno: rawToNano(amountRaw.toString()),
        }));

        if (!execute) {
          if (sources.length === 0) throw new Error("No funds received to refund");
          if (sources.length === 1) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  refundTo: sources[0].address,
                  amountRaw: sources[0].amountRaw,
                  amountXno: sources[0].amountXno,
                  ready: true,
                  message: "Single source. Set execute=true and confirmAddress to proceed.",
                }, null, 2),
              }],
            };
          }
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                candidates: sources,
                ready: false,
                message: "Multiple sources detected. Specify confirmAddress to select refund destination.",
              }, null, 2),
            }],
          };
        }

        if (!confirmAddress) throw new Error("confirmAddress is required when execute=true");
        const knownSource = sourceMap.get(confirmAddress);
        if (!knownSource) throw new Error(`confirmAddress is not a known source for this payment request`);

        const wallet = state.wallets.get(request.walletName);
        if (!wallet) throw new Error(`Wallet not found: ${request.walletName}`);

        const rpcUrl = effectiveRpcUrl();
        const workUrl = effectiveWorkUrl();
        if (!rpcUrl) throw new Error(rpcUrlErrorMessage());

        const timeoutMs = effectiveTimeoutMs();
        const index = request.accountIndex;
        const acct = deriveWalletAccount(wallet, index);

        const destVal = validateAddress(confirmAddress);
        if (!destVal.valid || !destVal.publicKey) throw new Error(`Invalid confirmAddress: ${destVal.error}`);

        const info = await rpcAccountInfo(rpcUrl, acct.address, { timeoutMs });
        if (typeof (info as any)?.error === "string") throw new Error("Account is unopened, cannot send refund");

        const previous = String((info as any).frontier);
        const representativeAddress = String((info as any).representative || "");
        const repVal = validateAddress(representativeAddress);
        if (!repVal.valid || !repVal.publicKey) throw new Error(`Invalid representative from RPC: ${repVal.error}`);

        const amountRaw = knownSource.toString();
        const currentBalance = BigInt(String((info as any).balance));
        const sendAmount = BigInt(amountRaw);
        if (sendAmount > currentBalance) throw new Error("Insufficient balance for refund");
        enforceMaxSend(amountRaw);
        const newBalance = (currentBalance - sendAmount).toString();

        const blockHash = hashNanoStateBlock({
          accountPublicKey: acct.publicKey,
          previous,
          representativePublicKey: repVal.publicKey,
          balanceRaw: newBalance,
          link: destVal.publicKey,
        });
        const signature = nanoSignBlake2b(blockHash, acct.privateKey);
        const work = (await localWorkGenerate(previous, 'send')).work;

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

        request.status = "refunded";
        request.updatedAt = new Date().toISOString();

        state.transactions.push({
          id: generateId(),
          walletName: wallet.name,
          accountIndex: index,
          address: acct.address,
          type: "send",
          amountRaw,
          counterparty: confirmAddress,
          hash: processed.hash,
          paymentRequestId: id,
          timestamp: new Date().toISOString(),
        });

        persistPaymentRequests();
        persistTransactions();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              id,
              status: request.status,
              refundTo: confirmAddress,
              amountRaw,
              amountXno: rawToNano(amountRaw),
              sendHash: processed.hash,
            }, null, 2),
          }],
        };
      }

      case "wallet_history": {
        const walletName = String((args as any)?.walletName || "").trim();
        if (!walletName) throw new Error("walletName is required");
        const accountIndex = (args as any)?.accountIndex as number | undefined;
        const limit = Math.max(1, Math.min(500, (args as any)?.limit ?? 20));

        let txs = state.transactions.filter((t) => t.walletName === walletName);
        if (accountIndex !== undefined) txs = txs.filter((t) => t.accountIndex === accountIndex);

        txs = txs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);

        const out = txs.map((t) => ({
          ...t,
          amountXno: rawToNano(t.amountRaw),
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ walletName, accountIndex, count: out.length, transactions: out }, null, 2),
          }],
        };
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
          '';
        const includeXno = (args?.includeXno as boolean | undefined) ?? true;
        const timeoutMs = (args?.timeoutMs as number | undefined) ?? 15000;

        if (!rpcUrl) throw new Error(rpcUrlErrorMessage());

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
          '';

        if (!rpcUrl) throw new Error(rpcUrlErrorMessage());
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



      case "generate_qr": {
        const address = String((args as any)?.address || "").trim();
        if (!address) throw new Error("address is required");
        const v = validateAddress(address);
        if (!v.valid) throw new Error(`Invalid address: ${v.error}`);

        const amountXno = (args as any)?.amountXno as string | undefined;
        const uri = buildNanoUri(address, amountXno);
        const qr = await generateAsciiQr(address, amountXno);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ address, amountXno: amountXno ?? null, nanoUri: uri, qr }, null, 2),
          }],
        };
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
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
xno-mcp v${version}: A Model Context Protocol companion server for the xno-skills collection of Nano (XNO) tools

Usage:
  xno-mcp [options]

Options:
  --help, -h          Show this help message

Environment Variables:
  XNO_MCP_HOME        Home directory for config and wallets (default: <installed-dir>/.xno-mcp)
  XNO_MCP_CONFIG_PATH Exact path for config.json (overrides HOME)
  XNO_MCP_PURSES_PATH Exact path for wallets.json (overrides HOME)
  XNO_MAX_SEND            Max send per transaction in XNO (default: 1.0)
  NANO_RPC_URL        Fallback for RPC URL

To start the server, simply run it without arguments (it speaks JSON-RPC over stdio).
`);
    process.exit(0);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
