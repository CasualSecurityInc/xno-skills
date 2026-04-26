import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { validateAddress } from "./validate.js";
import { decodeNanoAddress } from "./nano-address.js";
import { nanoToRaw, rawToNano } from "./convert.js";
import { generateAsciiQr, buildNanoUri } from "./qr.js";
import {
  rpcAccountBalance,
  rpcAccountsBalances,
  rpcAccountsFrontiers,
  rpcAccountInfo,
  rpcReceivable,
  rpcProcess,
} from "./rpc.js";
import { hashNanoStateBlock } from "./state-block.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { NanoClient, NOMS } from "@openrai/nano-core";
import { THRESHOLD__OPEN_RECEIVE, THRESHOLD__SEND_CHANGE } from "nano-pow-with-fallback";
import { listWallets, getWallet, signTransaction } from "@open-wallet-standard/core";
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

// Mock OWS for testing if requested
const useMockOws = process.env.XNO_MCP_MOCK_OWS === 'true';

const listWalletsProxy = useMockOws 
  ? async () => [{ name: 'A', createdAt: new Date().toISOString() }]
  : listWallets;

const getWalletProxy = useMockOws
  ? async (name: string) => {
      if (name === 'A') {
        return {
          name: 'A',
          createdAt: new Date().toISOString(),
          accounts: [{
            address: 'nano_1link1111111111111111111111111111111111111111111111111111111',
            chainId: 'nano',
            derivationPath: "m/44'/165'/0'/0/0"
          }]
        };
      }
      return null;
    }
  : getWallet;

const signTransactionProxy = useMockOws
  ? async (wallet: string, chain: string, tx: string) => ({ signature: '0'.repeat(128) })
  : signTransaction;

type McpConfig = {
  rpcUrl?: string;
  workPeerUrl?: string;
  timeoutMs?: number;
  defaultRepresentative?: string;
  useWorkPeer?: boolean;
  maxSendXno?: string;
};

const DEFAULT_TIMEOUT_MS = 15000;

type PaymentRequestStatus = 'pending' | 'partial' | 'funded' | 'received' | 'refunded' | 'cancelled';

type PaymentRequest = {
  id: string;
  owsWalletId: string;
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
  owsWalletId: string;
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

type McpState = {
  config: McpConfig;
  paymentRequests: Map<string, PaymentRequest>;
  transactions: TransactionRecord[];
  nanoClient?: NanoClient;
};

const state: McpState = {
  config: {} as McpConfig,
  paymentRequests: new Map<string, PaymentRequest>(),
  transactions: [] as TransactionRecord[],
};

function getNanoClient(explicitRpc?: string, explicitWork?: string): NanoClient {
  const rpc = (explicitRpc || state.config.rpcUrl || process.env.NANO_RPC_URL || "").split(',').filter(Boolean);
  const work = (explicitWork || state.config.workPeerUrl || process.env.XNO_WORK_URL || "").split(',').filter(Boolean);

  // If we already have a client and the requested overrides match (or are absent), reuse it.
  if (state.nanoClient && !explicitRpc && !explicitWork) {
    return state.nanoClient;
  }

  const client = NanoClient.initialize({
    rpc: rpc.length > 0 ? rpc : undefined,
    work: work.length > 0 ? work : undefined,
  });

  if (!explicitRpc && !explicitWork) {
    state.nanoClient = client;
  }

  return client;
}

function getInstalledDir(): string {
  // @ts-ignore
  const url = typeof import.meta?.url === 'string' ? import.meta.url : null;
  if (url) {
    return path.dirname(fileURLToPath(url));
  }
  // @ts-ignore
  return __dirname;
}

function getHomeDir(): string {
  const envHome = process.env.XNO_MCP_HOME;
  if (envHome && envHome.trim()) return path.resolve(envHome);
  return path.join(getInstalledDir(), ".xno-mcp");
}

function getConfigPath(): string {
  const envPath = process.env.XNO_MCP_CONFIG_PATH;
  if (envPath && envPath.trim()) return path.resolve(envPath);
  return path.join(getHomeDir(), "config.json");
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

function persistPaymentRequests() {
  saveJsonFile(getPaymentRequestsPath(), { requests: Array.from(state.paymentRequests.values()) });
}

function persistTransactions() {
  saveJsonFile(getTransactionsPath(), { transactions: state.transactions });
}

async function getOwsAccount(walletName: string, index: number = 0) {
  const wallet = await getWalletProxy(walletName);
  if (!wallet) throw new Error(`OWS wallet not found: ${walletName}`);
  
  const account = wallet.accounts.find((a: any) => 
    (a.chainId === "nano" || a.chainId.startsWith("nano:")) && 
    a.derivationPath.endsWith(`/${index}`)
  );
  
  if (!account) {
    const nanoAccts = wallet.accounts.filter((a: any) => a.address.startsWith("nano_"));
    if (nanoAccts[index]) return nanoAccts[index];
    throw new Error(`Nano account at index ${index} not found in OWS wallet ${walletName}`);
  }
  return account;
}

const ZERO_32_HEX = "0".repeat(64);

function requireRepresentativeAddress(explicit?: string): string {
  const rep = (explicit || state.config.defaultRepresentative || "").trim();
  if (!rep) {
    const defaultRep = "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4";
    const v = validateAddress(defaultRep);
    if (!v.valid) throw new Error(`Invalid default representative: ${v.error}`);
    return defaultRep;
  }
  const v = validateAddress(rep);
  if (!v.valid) throw new Error(`Invalid representative address: ${v.error}`);
  return rep;
}

function effectiveTimeoutMs(explicit?: number): number {
  return explicit || state.config.timeoutMs || DEFAULT_TIMEOUT_MS;
}

function enforceMaxSend(amountRaw: string): void {
  const xno = state.config.maxSendXno ?? DEFAULT_MAX_SEND_XNO;
  const maxRaw = BigInt(nanoToRaw(xno));
  if (BigInt(amountRaw) > maxRaw) {
    throw new Error(
      `Send amount exceeds max-send cap of ${xno} XNO. ` +
      `Ask the operator to raise the limit via config_set({ maxSendXno: "..." }).`
    );
  }
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

loadStateFromDisk();

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        uriTemplate: "wallet://{name}",
        name: "OWS Wallet Status",
        description: "Status and balances for an OWS wallet",
        mimeType: "application/json",
      },
      {
        uriTemplate: "wallet://{name}/account/{index}",
        name: "OWS Account Details",
        description: "Specific details for an OWS Nano account",
        mimeType: "application/json",
      },
    ],
  };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const wallets = await listWalletsProxy();
  const resources = wallets.map((w: any) => ({
    uri: `wallet://${w.name}`,
    name: `Wallet ${w.name}`,
    description: `OWS Wallet ${w.name}`,
    mimeType: "application/json",
  }));
  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const walletMatch = /^wallet:\/\/([^/]+)$/.exec(uri);
  const accountMatch = /^wallet:\/\/([^/]+)\/account\/(\d+)$/.exec(uri);

  const client = getNanoClient();
  const timeoutMs = effectiveTimeoutMs();

  if (walletMatch) {
    const name = walletMatch[1];
    const wallet = await getWalletProxy(name);
    if (!wallet) throw new Error(`Wallet not found: ${name}`);

    const nanoAccts = wallet.accounts.filter((a: any) => a.address.startsWith("nano_")).slice(0, 5);
    const addresses = nanoAccts.map((a: any) => a.address);

    let balances: any = {};
    let frontiers: any = {};
    try {
      balances = await rpcAccountsBalances(client, addresses, { timeoutMs }).catch(() => ({}));
      frontiers = await rpcAccountsFrontiers(client, addresses, { timeoutMs }).catch(() => ({}));
    } catch (e) {}

    const rows = nanoAccts.map((a: any, i: number) => {
      const b = balances?.balances?.[a.address];
      const opened = Boolean(frontiers?.frontiers?.[a.address]);
      return {
        index: i,
        address: a.address,
        opened,
        balanceRaw: b?.balance ?? "0",
        pendingRaw: b?.pending ?? "0",
        balanceXno: rawToNano(b?.balance ?? "0"),
        pendingXno: rawToNano(b?.pending ?? "0"),
      };
    });

    const data = {
      name: wallet.name,
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
    const acct = await getOwsAccount(name, index);

    let info: any = { error: "Account unopened or network error" };
    let receivable: any[] = [];

    try {
      info = await rpcAccountInfo(client, acct.address, { timeoutMs }).catch((e) => ({ error: String(e) }));
      receivable = await rpcReceivable(client, acct.address, 10, { timeoutMs }).catch(() => []);
    } catch (e) {}

    const opened = !(typeof info?.error === "string");
    const data = {
      name,
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
        description: "Read current xno-mcp configuration (RPC URLs, etc.)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "config_set",
        description: "Update xno-mcp configuration.",
        inputSchema: {
          type: "object",
          properties: {
            rpcUrl: { type: "string" },
            workPeerUrl: { type: "string" },
            timeoutMs: { type: "number" },
            defaultRepresentative: { type: "string" },
            maxSendXno: { type: "string" },
          },
        },
      },
      {
        name: "wallet_list",
        description: "List YOUR OWS wallets.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "wallet_balance",
        description: "Check YOUR OWS wallet's balance and pending amount.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "OWS wallet name" },
            index: { type: "number", default: 0 },
            rpcUrl: { type: "string" },
            includeXno: { type: "boolean", default: true },
          },
          required: ["name"],
        },
      },
      {
        name: "wallet_receive",
        description: "Receive pending Nano blocks into YOUR OWS wallet.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "OWS wallet name" },
            index: { type: "number", default: 0 },
            count: { type: "number", default: 10 },
            onlyHash: { type: "string" },
            representative: { type: "string" },
            rpcUrl: { type: "string" },
          },
          required: ["name"],
        },
      },
      {
        name: "wallet_send",
        description: `Send Nano FROM YOUR OWS wallet. Max per transaction: ${state.config.maxSendXno || "1.0"} XNO.`,
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "OWS wallet name" },
            index: { type: "number", default: 0 },
            destination: { type: "string" },
            amountXno: { type: "string" },
            rpcUrl: { type: "string" },
          },
          required: ["name", "destination", "amountXno"],
        },
      },
      {
        name: "payment_request_create",
        description: "Create a payment request to receive XNO using an OWS wallet.",
        inputSchema: {
          type: "object",
          properties: {
            walletName: { type: "string" },
            accountIndex: { type: "number", default: 0 },
            amountXno: { type: "string" },
            reason: { type: "string" },
          },
          required: ["walletName", "amountXno", "reason"],
        },
      },
      {
        name: "payment_request_status",
        description: "Check payment request status.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
      {
        name: "payment_request_receive",
        description: "Receive pending funds for a payment request.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
      {
        name: "payment_request_list",
        description: "List payment requests.",
        inputSchema: {
          type: "object",
          properties: { status: { type: "string" }, walletName: { type: "string" } },
        },
      },
      {
        name: "payment_request_refund",
        description: "Refund a payment request.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" }, execute: { type: "boolean", default: false }, confirmAddress: { type: "string" } },
          required: ["id"],
        },
      },
      {
        name: "wallet_history",
        description: "View OWS wallet transaction history.",
        inputSchema: {
          type: "object",
          properties: { walletName: { type: "string" }, accountIndex: { type: "number" }, limit: { type: "number", default: 20 } },
          required: ["walletName"],
        },
      },
      {
        name: "convert_units",
        description: "Convert between Nano units (xno, raw)",
        inputSchema: {
          type: "object",
          properties: { amount: { type: "string" }, from: { type: "string" }, to: { type: "string" } },
          required: ["amount", "from", "to"],
        },
      },
      {
        name: "validate_address",
        description: "Validate a Nano address.",
        inputSchema: { type: "object", properties: { address: { type: "string" } }, required: ["address"] },
      },
      {
        name: "rpc_account_balance",
        description: "Check ANY Nano account's balance via RPC.",
        inputSchema: {
          type: "object",
          properties: { address: { type: "string" }, rpcUrl: { type: "string" } },
          required: ["address"],
        },
      },
      {
        name: "generate_qr",
        description: "Generate ASCII QR code for a Nano address.",
        inputSchema: {
          type: "object",
          properties: { address: { type: "string" }, amountXno: { type: "string" } },
          required: ["address"],
        },
      },
      {
        name: "sign_message",
        description: "Sign an off-chain message using YOUR OWS wallet.",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" }, index: { type: "number", default: 0 }, message: { type: "string" } },
          required: ["name", "message"],
        },
      },
      {
        name: "verify_message",
        description: "Verify an off-chain message signature.",
        inputSchema: {
          type: "object",
          properties: { address: { type: "string" }, message: { type: "string" }, signature: { type: "string" } },
          required: ["address", "message", "signature"],
        },
      },
    ],
  };
});

async function handleWalletReceive(args: any) {
  const { name: walletName, index = 0, count = 10, onlyHash, representative: explicitRep, rpcUrl: explicitRpc } = args;
  const acct = await getOwsAccount(walletName, index);
  const client = getNanoClient(explicitRpc);

  const info = await rpcAccountInfo(client, acct.address);
  const opened = !(typeof (info as any).error === 'string');
  let previous = opened ? (info as any).frontier : ZERO_32_HEX;
  let balanceRaw = opened ? (info as any).balance : "0";
  const rep = opened ? (info as any).representative : requireRepresentativeAddress(explicitRep);
  const repVal = validateAddress(rep);

  const receivable = await rpcReceivable(client, acct.address, count);
  const pending = onlyHash ? receivable.filter(r => r.hash === onlyHash) : receivable;
  if (!pending.length) return { address: acct.address, message: "No pending blocks" };

  const received = [];

  for (const p of pending) {
    const newBalance = (BigInt(balanceRaw) + BigInt(p.amount)).toString();
    const workRoot = previous !== ZERO_32_HEX ? previous : decodeNanoAddress(acct.address).publicKey;
    const blockHash = hashNanoStateBlock({
      accountPublicKey: decodeNanoAddress(acct.address).publicKey,
      previous,
      representativePublicKey: repVal.publicKey!,
      balanceRaw: newBalance,
      link: p.hash,
    });

    const signResult = await signTransactionProxy(walletName, acct.chainId, bytesToHex(blockHash));
    const subtype = previous === ZERO_32_HEX ? "open" : "receive";
    const difficulty = THRESHOLD__OPEN_RECEIVE;
    
    const work = await client.workProvider.generate(workRoot, difficulty);

    const block = { type: "state", account: acct.address, previous, representative: rep, balance: newBalance, link: p.hash, signature: signResult.signature, work };
    const processed = await rpcProcess(client, block, subtype as any);

    received.push({ hash: processed.hash, amountRaw: p.amount });
    state.transactions.push({ id: generateId(), owsWalletId: walletName, accountIndex: index, address: acct.address, type: 'receive', amountRaw: p.amount, counterparty: p.source ?? "", hash: processed.hash, timestamp: new Date().toISOString() });
    previous = processed.hash;
    balanceRaw = newBalance;
  }
  persistTransactions();
  return { address: acct.address, received, balanceXno: rawToNano(balanceRaw) };
}

async function handleWalletSend(args: any) {
  const { name: walletName, index = 0, destination, amountXno, rpcUrl: explicitRpc } = args;
  const acct = await getOwsAccount(walletName, index);
  const client = getNanoClient(explicitRpc);

  const amountRaw = nanoToRaw(amountXno);
  enforceMaxSend(amountRaw);

  const info = await rpcAccountInfo(client, acct.address);
  if (typeof (info as any).error === 'string') throw new Error("Account unopened.");

  const currentBalance = BigInt((info as any).balance);
  if (BigInt(amountRaw) > currentBalance) throw new Error("Insufficient balance.");

  const newBalance = (currentBalance - BigInt(amountRaw)).toString();
  const destVal = validateAddress(destination);
  const repVal = validateAddress((info as any).representative);

  const blockHash = hashNanoStateBlock({
    accountPublicKey: decodeNanoAddress(acct.address).publicKey,
    previous: (info as any).frontier,
    representativePublicKey: repVal.publicKey!,
    balanceRaw: newBalance,
    link: destVal.publicKey!,
  });

  const signResult = await signTransactionProxy(walletName, acct.chainId, bytesToHex(blockHash));
  const work = await client.workProvider.generate((info as any).frontier, THRESHOLD__SEND_CHANGE);

  const block = { type: "state", account: acct.address, previous: (info as any).frontier, representative: (info as any).representative, balance: newBalance, link: destVal.publicKey!, signature: signResult.signature, work };
  const processed = await rpcProcess(client, block, "send");

  state.transactions.push({ id: generateId(), owsWalletId: walletName, accountIndex: index, address: acct.address, type: 'send', amountRaw, counterparty: destination, hash: processed.hash, timestamp: new Date().toISOString() });
  persistTransactions();
  return { hash: processed.hash, from: acct.address, to: destination, amountXno };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "config_get":
        return { content: [{ type: "text", text: JSON.stringify(state.config, null, 2) }] };

      case "config_set": {
        const c = args as any;
        let changed = false;
        if (c.rpcUrl !== undefined) { state.config.rpcUrl = String(c.rpcUrl); changed = true; }
        if (c.workPeerUrl !== undefined) { state.config.workPeerUrl = String(c.workPeerUrl); changed = true; }
        if (c.timeoutMs !== undefined) state.config.timeoutMs = Number(c.timeoutMs);
        if (c.defaultRepresentative !== undefined) state.config.defaultRepresentative = String(c.defaultRepresentative);
        if (c.maxSendXno !== undefined) state.config.maxSendXno = String(c.maxSendXno);
        
        if (changed) {
          state.nanoClient = undefined;
        }
        
        persistConfig();
        return { content: [{ type: "text", text: JSON.stringify(state.config, null, 2) }] };
      }

      case "wallet_list": {
        const wallets = await listWalletsProxy();
        return { content: [{ type: "text", text: JSON.stringify(wallets.map(w => ({ name: w.name, createdAt: w.createdAt })), null, 2) }] };
      }

      case "wallet_balance": {
        const walletName = String((args as any)?.name);
        const index = Number((args as any)?.index ?? 0);
        const acct = await getOwsAccount(walletName, index);
        const client = getNanoClient(String((args as any)?.rpcUrl ?? ""));
        const bal = await rpcAccountBalance(client, acct.address, { timeoutMs: effectiveTimeoutMs() });
        const out: any = { address: acct.address, balanceRaw: bal.balance, pendingRaw: bal.pending };
        if ((args as any)?.includeXno !== false) {
          out.balanceXno = rawToNano(bal.balance);
          out.pendingXno = rawToNano(bal.pending);
        }
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
      }

      case "wallet_receive": {
        const res = await handleWalletReceive(args);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      case "wallet_send": {
        const res = await handleWalletSend(args);
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      case "payment_request_create": {
        const walletName = String((args as any)?.walletName);
        const accountIndex = Number((args as any)?.accountIndex ?? 0);
        const amountXno = String((args as any)?.amountXno);
        const reason = String((args as any)?.reason);
        
        const acct = await getOwsAccount(walletName, accountIndex);
        const amountRaw = nanoToRaw(amountXno);
        const id = generateId();
        const request: PaymentRequest = { id, owsWalletId: walletName, accountIndex, address: acct.address, amountRaw, reason, status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), receivedBlocks: [] };
        state.paymentRequests.set(id, request);
        persistPaymentRequests();
        const qr = await generateAsciiQr(acct.address, amountXno);
        return { content: [{ type: "text", text: JSON.stringify({ id, address: acct.address, amountXno, qr }, null, 2) }] };
      }

      case "payment_request_status": {
        const request = state.paymentRequests.get(String((args as any)?.id));
        if (!request) throw new Error("Not found");
        return { content: [{ type: "text", text: JSON.stringify(request, null, 2) }] };
      }

      case "payment_request_receive": {
        const request = state.paymentRequests.get(String((args as any)?.id));
        if (!request) throw new Error("Not found");
        const res = await handleWalletReceive({ name: request.owsWalletId, index: request.accountIndex });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      case "payment_request_list": {
        let list = Array.from(state.paymentRequests.values());
        const status = (args as any)?.status;
        const walletName = (args as any)?.walletName;
        if (status) list = list.filter(r => r.status === String(status));
        if (walletName) list = list.filter(r => r.owsWalletId === String(walletName));
        return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
      }

      case "payment_request_refund": {
        const id = String((args as any)?.id);
        const execute = Boolean((args as any)?.execute);
        const confirmAddress = String((args as any)?.confirmAddress);
        
        const request = state.paymentRequests.get(id);
        if (!request) throw new Error("Not found");
        if (!execute) return { content: [{ type: "text", text: "Set execute: true to refund." }] };
        
        const res = await handleWalletSend({ name: request.owsWalletId, index: request.accountIndex, destination: confirmAddress, amountXno: rawToNano(request.amountRaw) });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }

      case "wallet_history": {
        const walletName = String((args as any)?.walletName);
        const accountIndex = (args as any)?.accountIndex !== undefined ? Number((args as any)?.accountIndex) : undefined;
        const limit = Number((args as any)?.limit ?? 20);
        
        let txs = state.transactions.filter(t => t.owsWalletId === walletName);
        if (accountIndex !== undefined) txs = txs.filter(t => t.accountIndex === accountIndex);
        return { content: [{ type: "text", text: JSON.stringify(txs.slice(0, limit), null, 2) }] };
      }

      case "convert_units": {
        const amount = String((args as any)?.amount);
        const from = String((args as any)?.from).toLowerCase();
        const to = String((args as any)?.to).toLowerCase();
        let raw = from === 'xno' ? nanoToRaw(amount) : amount;
        let res = to === 'xno' ? rawToNano(raw) : raw;
        return { content: [{ type: "text", text: res }] };
      }

      case "validate_address":
        return { content: [{ type: "text", text: JSON.stringify(validateAddress(String((args as any)?.address)), null, 2) }] };

      case "rpc_account_balance": {
        const client = getNanoClient(String((args as any)?.rpcUrl ?? ""));
        const bal = await rpcAccountBalance(client, String((args as any)?.address));
        return { content: [{ type: "text", text: JSON.stringify(bal, null, 2) }] };
      }

      case "generate_qr": {
        const qr = await generateAsciiQr(String((args as any)?.address), String((args as any)?.amountXno ?? ""));
        return { content: [{ type: "text", text: qr }] };
      }

      case "sign_message": {
        const walletName = String((args as any)?.name);
        const index = Number((args as any)?.index ?? 0);
        const message = String((args as any)?.message);
        
        const acct = await getOwsAccount(walletName, index);
        const hash = NOMS.hashMessage(message);
        const signResult = await signTransactionProxy(walletName, acct.chainId, hash);
        return { content: [{ type: "text", text: JSON.stringify({ address: acct.address, signature: signResult.signature }, null, 2) }] };
      }

      case "verify_message": {
        const address = String((args as any)?.address);
        const message = String((args as any)?.message);
        const signature = String((args as any)?.signature);
        const v = validateAddress(address);
        const valid = NOMS.verifyMessage(message, signature, v.publicKey!);
        return { content: [{ type: "text", text: JSON.stringify({ valid }, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
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
