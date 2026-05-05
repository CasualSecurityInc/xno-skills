import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generateAsciiQr, generateSvgQr } from './qr.js';
import { rpcAccountBalance, rpcAccountsBalances, rpcAccountsFrontiers, rpcAccountInfo, rpcReceivable, rpcAccountHistory, rpcWorkGenerate, rpcProcess, rpcProbeCaps } from './rpc.js';
import { nanoToRaw, rawToNano } from './convert.js';
import { validateAddress } from './validate.js';
import { decodeNanoAddress } from './nano-address.js';
import { buildNanoStateBlockHex } from './state-block.js';
import { version } from './version.js';
import { NOMS, NanoClient, WorkProvider } from '@openrai/nano-core';
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_REPRESENTATIVE,
  executeChange,
  executeReceive,
  executeSend,
  getNanoAddress,
  getNanoBalance,
  getNanoHistory,
  getNanoAccountInfo,
  isRpcError,
  listNanoWallets,
  resolveNanoWalletAccount,
  signWalletMessage,
  submitPreparedBlock,
  toToolError,
  toToolSuccess,
  verifyNanoMessage,
  type NanoReaders,
} from './nano-actions.js';
import {
  generateId,
  loadConfig,
  loadPaymentRequests,
  loadTransactions,
  saveConfig,
  savePaymentRequests,
  saveTransactions,
  type PaymentRequest,
  type TransactionRecord,
  type XnoConfig,
} from './state-store.js';
import { listWalletsProxy } from './ows.js';

// ---------------------------------------------------------------------------
// Server instance
// ---------------------------------------------------------------------------

const mcpServer = new McpServer(
  { name: 'xno-mcp', version },
  { capabilities: { tools: {}, resources: {} } },
);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type McpState = {
  config: XnoConfig;
  paymentRequests: Map<string, PaymentRequest>;
  transactions: TransactionRecord[];
  nanoClient?: NanoClient;
};

const state: McpState = {
  config: loadConfig(),
  paymentRequests: loadPaymentRequests(),
  transactions: loadTransactions(),
};

const DEFAULT_MAX_SEND_XNO = (() => {
  const env = process.env.XNO_MAX_SEND;
  if (env !== undefined && env.trim()) return env.trim();
  return '1.0';
})();

const DEFAULT_RPC_URLS = [
  'https://rainstorm.city/api',
  'https://nanoslo.0x.no/proxy',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNanoClient(explicitRpc?: string, explicitWork?: string): NanoClient {
  const rpc = (explicitRpc || state.config.rpcUrl || process.env.NANO_RPC_URL || '').split(',').filter(Boolean);
  const work = (explicitWork || state.config.workPeerUrl || process.env.XNO_WORK_URL || '').split(',').filter(Boolean);

  if (state.nanoClient && !explicitRpc && !explicitWork) {
    return state.nanoClient;
  }

  const workTimeoutMs = state.config.timeoutMs || DEFAULT_TIMEOUT_MS;
  process.stderr.write(
    `[xno-mcp] NanoClient init — rpc=[${rpc.join(',') || '(defaults)'}] work=[${work.join(',') || '(defaults)'}] workTimeoutMs=${workTimeoutMs}\n`,
  );

  const effectiveRpc = rpc.length > 0 ? rpc : DEFAULT_RPC_URLS;
  const workUrls = work.length > 0 ? work : effectiveRpc;

  const client = NanoClient.initialize({
    rpc: effectiveRpc,
    workProvider: WorkProvider.auto({
      urls: workUrls,
      timeoutMs: workTimeoutMs,
    }),
  });

  if (!explicitRpc && !explicitWork) {
    state.nanoClient = client;
  }

  return client;
}

function readersFor(explicitRpcUrl?: string): NanoReaders {
  const effectiveRpc = explicitRpcUrl || state.config.rpcUrl || undefined;
  const client = getNanoClient(effectiveRpc);
  const timeoutMs = state.config.timeoutMs || DEFAULT_TIMEOUT_MS;
  return {
    accountInfo: (address: string) => rpcAccountInfo(client, address, { timeoutMs }),
    accountBalance: (address: string) => rpcAccountBalance(client, address, { timeoutMs }),
    receivable: (address: string, count: number) => rpcReceivable(client, address, count, { timeoutMs }),
    accountHistory: (address: string, count: number) => rpcAccountHistory(client, address, count, { timeoutMs }),
    workGenerate: (hash: string, difficulty: string) => client.workProvider.generate(hash, difficulty),
    process: (block: Record<string, unknown>, subtype: 'send' | 'receive' | 'open' | 'change') =>
      rpcProcess(client, block, subtype, { timeoutMs }),
    powTimeoutMs: state.config.timeoutMs ? state.config.timeoutMs * 4 : 60_000,
  };
}

function persistConfig(): void { saveConfig(state.config); }
function persistPaymentRequests(): void { savePaymentRequests(state.paymentRequests.values()); }
function persistTransactions(): void { saveTransactions(state.transactions); }

function appendTransaction(record: TransactionRecord): void {
  state.transactions.push(record);
  persistTransactions();
}

function makeProgressReporter(sendNotification: (n: any) => Promise<void>, progressToken?: string | number) {
  if (progressToken === undefined) return undefined;
  return (progress: number, total: number, message: string) =>
    sendNotification({
      method: 'notifications/progress',
      params: { progressToken, progress, total, message },
    });
}

function walletNameFromArgs(args: any): string {
  return String(args?.wallet ?? args?.name ?? args?.walletName ?? '');
}

function walletIndexFromArgs(args: any): number {
  const index = Number(args?.index ?? args?.accountIndex ?? 0);
  if (index !== 0) {
    throw new Error(`OWS wallets only support account index 0. Requested index: ${index}`);
  }
  return index;
}

async function checkOwsHealth() {
  try {
    const wallets = await listWalletsProxy();
    return { status: 'Ready', walletCount: wallets.length, mode: process.env.XNO_MCP_MOCK_OWS === 'true' ? 'Mock' : 'Native' };
  } catch (error: any) {
    return { status: 'Error', message: error.message, mode: 'Native' };
  }
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

mcpServer.registerResource(
  'payment-requests',
  'xno-payment-requests://list',
  {
    title: 'Nano Payment Requests List',
    description: 'List of all Nano payment requests tracked by xno-skills',
    mimeType: 'application/json',
  },
  async (uri) => ({
    contents: [{
      uri: uri.toString(),
      mimeType: 'application/json',
      text: JSON.stringify(Array.from(state.paymentRequests.values()), null, 2),
    }],
  }),
);

mcpServer.registerResource(
  'wallet-status',
  new ResourceTemplate('xno-wallet://{name}', {
    list: async () => {
      const wallets = await listNanoWallets();
      return {
        resources: wallets.map((wallet) => ({
          uri: `xno-wallet://${wallet.name}`,
          name: wallet.name,
          title: `Nano wallet ${wallet.name}`,
          description: `Nano account summary for OWS wallet ${wallet.name}${wallet.id ? ` (${wallet.id})` : ''}`,
          mimeType: 'application/json',
        })),
      };
    },
  }),
  {
    title: 'OWS Nano Wallet Status',
    description: 'Status and balances for an OWS Nano wallet',
    mimeType: 'application/json',
  },
  async (uri, { name }) => {
    const wallet = String(name);
    const address = await getNanoAddress(wallet);
    const balance = await getNanoBalance(wallet, readersFor(), { config: state.config }, 0);
    return {
      contents: [{
        uri: uri.toString(),
        mimeType: 'application/json',
        text: JSON.stringify({ wallet, address, balance }, null, 2),
      }],
    };
  },
);

mcpServer.registerResource(
  'wallet-account',
  new ResourceTemplate('xno-wallet://{name}/account/{index}', { list: undefined }),
  {
    title: 'OWS Nano Account Details',
    description: 'Details for an OWS Nano account',
    mimeType: 'application/json',
  },
  async (uri, { name, index: indexVar }) => {
    const wallet = String(name);
    const index = Number(indexVar);
    if (index !== 0) throw new Error(`OWS wallets only support account index 0. Requested index: ${index}`);
    const address = await getNanoAddress(wallet, index);
    const balance = await getNanoBalance(wallet, readersFor(), { config: state.config }, index);
    return {
      contents: [{
        uri: uri.toString(),
        mimeType: 'application/json',
        text: JSON.stringify({ wallet, index, address, balance }, null, 2),
      }],
    };
  },
);

mcpServer.registerResource(
  'wallet-history',
  new ResourceTemplate('xno-wallet://{name}/history', { list: undefined }),
  {
    title: 'OWS Nano Wallet Transaction History',
    description: 'Transaction history for an OWS Nano wallet',
    mimeType: 'application/json',
  },
  async (uri, { name }) => {
    const wallet = String(name);
    const txs = await getNanoHistory(wallet, readersFor(), { config: state.config }, { count: 100 });
    return {
      contents: [{
        uri: uri.toString(),
        mimeType: 'application/json',
        text: JSON.stringify(txs, null, 2),
      }],
    };
  },
);

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

mcpServer.registerTool('config_get', {
  description: 'Read current xno-mcp configuration (advanced).',
  inputSchema: {},
}, async () => toToolSuccess(state.config));

mcpServer.registerTool('config_set', {
  description: 'Update xno-mcp configuration (advanced).',
  inputSchema: {
    rpcUrl: z.string().optional(),
    workPeerUrl: z.string().optional(),
    timeoutMs: z.number().optional(),
    defaultRepresentative: z.string().optional(),
    maxSendXno: z.string().optional(),
  },
}, async (args) => {
  if (args.rpcUrl !== undefined) state.config.rpcUrl = args.rpcUrl;
  if (args.workPeerUrl !== undefined) state.config.workPeerUrl = args.workPeerUrl;
  if (args.timeoutMs !== undefined) state.config.timeoutMs = args.timeoutMs;
  if (args.defaultRepresentative !== undefined) state.config.defaultRepresentative = args.defaultRepresentative;
  if (args.maxSendXno !== undefined) state.config.maxSendXno = args.maxSendXno;
  state.nanoClient = undefined;
  persistConfig();
  return toToolSuccess(state.config);
});

mcpServer.registerTool('wallets', {
  description: 'List OWS wallets that have Nano accounts.',
  inputSchema: {},
}, async () => toToolSuccess(await listNanoWallets()));

mcpServer.registerTool('address', {
  description: 'Show the Nano address for an OWS wallet.',
  inputSchema: { wallet: z.string(), index: z.number().default(0) },
}, async (args) => toToolSuccess(await getNanoAddress(args.wallet, args.index)));

mcpServer.registerTool('balance', {
  description: 'Show Nano balance and pending amount for an OWS wallet. Also lists pending receivable blocks.',
  inputSchema: { wallet: z.string(), index: z.number().default(0), count: z.number().default(10), rpcUrl: z.string().optional() },
}, async (args, extra) => {
  try {
    const ctx = { config: state.config, appendTransaction, reportProgress: makeProgressReporter(extra.sendNotification, extra._meta?.progressToken) };
    return toToolSuccess(await getNanoBalance(args.wallet, readersFor(args.rpcUrl), ctx, args.index, args.count));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('receive', {
  description: 'Receive pending Nano blocks for an OWS wallet. Automatically handles open vs receive.',
  inputSchema: {
    wallet: z.string(),
    index: z.number().default(0),
    count: z.number().default(10),
    onlyHash: z.string().optional(),
    representative: z.string().optional(),
    rpcUrl: z.string().optional(),
  },
}, async (args, extra) => {
  try {
    const ctx = { config: state.config, appendTransaction, reportProgress: makeProgressReporter(extra.sendNotification, extra._meta?.progressToken) };
    return toToolSuccess(await executeReceive(args.wallet, args.rpcUrl, ctx, readersFor(args.rpcUrl), {
      index: args.index,
      count: args.count,
      onlyHash: args.onlyHash,
      representative: args.representative,
    }));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('send', {
  description: `Send Nano from an OWS wallet. Max per transaction: ${state.config.maxSendXno || DEFAULT_MAX_SEND_XNO} XNO.`,
  inputSchema: {
    wallet: z.string(),
    index: z.number().default(0),
    destination: z.string(),
    amountXno: z.string(),
    rpcUrl: z.string().optional(),
  },
}, async (args, extra) => {
  try {
    const ctx = { config: state.config, appendTransaction, reportProgress: makeProgressReporter(extra.sendNotification, extra._meta?.progressToken) };
    return toToolSuccess(await executeSend(args.wallet, args.rpcUrl, ctx, readersFor(args.rpcUrl), args.destination, args.amountXno, { index: args.index }));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('change_rep', {
  description: 'Submit a Nano change block to update representative for an OWS wallet.',
  inputSchema: {
    wallet: z.string(),
    index: z.number().default(0),
    representative: z.string(),
    rpcUrl: z.string().optional(),
  },
}, async (args, extra) => {
  try {
    const ctx = { config: state.config, appendTransaction, reportProgress: makeProgressReporter(extra.sendNotification, extra._meta?.progressToken) };
    return toToolSuccess(await executeChange(args.wallet, args.rpcUrl, ctx, readersFor(args.rpcUrl), args.representative, { index: args.index }));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('submit_block', {
  description: 'Sign and submit a prepared Nano block hex using an OWS wallet.',
  inputSchema: {
    wallet: z.string(),
    index: z.number().default(0),
    txHex: z.string(),
    subtype: z.enum(['send', 'receive', 'open', 'change']),
    rpcUrl: z.string().optional(),
  },
}, async (args, extra) => {
  try {
    const ctx = { config: state.config, appendTransaction, reportProgress: makeProgressReporter(extra.sendNotification, extra._meta?.progressToken) };
    return toToolSuccess(await submitPreparedBlock(args.wallet, args.rpcUrl, ctx, readersFor(args.rpcUrl), args.txHex, args.subtype, { index: args.index }));
  } catch (error) { return toToolError(error); }
});

/* TODO: Unhide once NOMS PR is merged into OWS core
mcpServer.registerTool('sign_message', { ... }, async (args) => { ... });
mcpServer.registerTool('verify_message', { ... }, async (args) => { ... });
*/

mcpServer.registerTool('convert_units', {
  description: 'Convert between Nano units.',
  inputSchema: { amount: z.string(), from: z.string(), to: z.string() },
}, async (args) => {
  const raw = args.from.toLowerCase() === 'xno' ? nanoToRaw(args.amount) : args.amount;
  const result = args.to.toLowerCase() === 'xno' ? rawToNano(raw) : raw;
  return { content: [{ type: 'text' as const, text: result }] };
});

mcpServer.registerTool('validate_address', {
  description: 'Validate a Nano address.',
  inputSchema: { address: z.string() },
}, async (args) => toToolSuccess(validateAddress(args.address)));

mcpServer.registerTool('probe_caps', {
  description: 'Probe a Nano node RPC for capabilities (version, ledger-read, remote PoW).',
  inputSchema: { rpcUrl: z.string().optional() },
}, async (args) => {
  try {
    const targetUrl = args.rpcUrl ?? (state.config.rpcUrl || process.env.NANO_RPC_URL || DEFAULT_RPC_URLS[0]);
    const client = getNanoClient(targetUrl);
    return toToolSuccess(await rpcProbeCaps(client, targetUrl, { timeoutMs: state.config.timeoutMs || DEFAULT_TIMEOUT_MS }));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('rpc_account_balance', {
  description: 'Check any Nano account balance via RPC.',
  inputSchema: { address: z.string(), rpcUrl: z.string().optional() },
}, async (args) => {
  try {
    const client = getNanoClient(args.rpcUrl);
    return toToolSuccess(await rpcAccountBalance(client, args.address, { timeoutMs: state.config.timeoutMs || DEFAULT_TIMEOUT_MS }));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('rpc_account_info', {
  description: 'Fetch account info including frontier and balance via RPC.',
  inputSchema: { address: z.string(), rpcUrl: z.string().optional() },
}, async (args) => {
  try {
    const client = getNanoClient(args.rpcUrl);
    return toToolSuccess(await rpcAccountInfo(client, args.address, { timeoutMs: state.config.timeoutMs || DEFAULT_TIMEOUT_MS }));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('rpc_receivable', {
  description: 'List receivable blocks for an account via RPC.',
  inputSchema: { address: z.string(), count: z.number().default(10), rpcUrl: z.string().optional() },
}, async (args) => {
  try {
    const client = getNanoClient(args.rpcUrl);
    return toToolSuccess(await rpcReceivable(client, args.address, args.count, { timeoutMs: state.config.timeoutMs || DEFAULT_TIMEOUT_MS }));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('block_build_send', {
  description: 'Build an unsigned send block hex.',
  inputSchema: { account: z.string(), to: z.string(), amountXno: z.string(), rpcUrl: z.string().optional() },
}, async (args) => {
  try {
    const client = getNanoClient(args.rpcUrl);
    const senderPk = decodeNanoAddress(args.account).publicKey;
    const recipientPk = decodeNanoAddress(args.to).publicKey;
    const info = await rpcAccountInfo(client, args.account, { timeoutMs: state.config.timeoutMs || DEFAULT_TIMEOUT_MS });
    if (isRpcError(info)) throw new Error(`Account not opened: ${info.error}`);
    const currentBalance = BigInt(info.balance);
    const sendRaw = BigInt(nanoToRaw(args.amountXno));
    if (sendRaw <= 0n) throw new Error('Amount must be positive');
    if (sendRaw > currentBalance) throw new Error('Insufficient balance');
    const blockHex = buildNanoStateBlockHex({
      accountPublicKey: senderPk,
      previous: info.frontier,
      representativePublicKey: decodeNanoAddress(info.representative || DEFAULT_REPRESENTATIVE).publicKey,
      balanceRaw: (currentBalance - sendRaw).toString(),
      link: recipientPk,
    });
    return toToolSuccess({ blockHex, account: args.account, to: args.to, amountRaw: sendRaw.toString(), previous: info.frontier });
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('block_build_receive', {
  description: 'Build an unsigned receive block hex.',
  inputSchema: { account: z.string(), hash: z.string().optional(), amountRaw: z.string().optional(), rpcUrl: z.string().optional() },
}, async (args) => {
  try {
    const client = getNanoClient(args.rpcUrl);
    let hash = args.hash;
    let amountRaw = args.amountRaw;
    if (!hash) {
      const pending = await rpcReceivable(client, args.account, 1, { timeoutMs: state.config.timeoutMs || DEFAULT_TIMEOUT_MS });
      if (pending.length === 0) throw new Error('No receivable blocks found');
      hash = pending[0].hash;
      amountRaw = pending[0].amount;
    }
    if (!amountRaw) throw new Error('amountRaw is required if hash is provided');
    const info = await rpcAccountInfo(client, args.account, { timeoutMs: state.config.timeoutMs || DEFAULT_TIMEOUT_MS }).catch(() => ({ error: 'Account not found' } as any));
    const opened = !isRpcError(info);
    const previous = opened ? info.frontier : '0'.repeat(64);
    const currentBalance = opened ? BigInt(info.balance) : 0n;
    const blockHex = buildNanoStateBlockHex({
      accountPublicKey: decodeNanoAddress(args.account).publicKey,
      previous,
      representativePublicKey: decodeNanoAddress(opened ? info.representative || DEFAULT_REPRESENTATIVE : DEFAULT_REPRESENTATIVE).publicKey,
      balanceRaw: (currentBalance + BigInt(amountRaw)).toString(),
      link: hash,
    });
    return toToolSuccess({ blockHex, account: args.account, sendBlockHash: hash, amountRaw, previous, subtype: opened ? 'receive' : 'open' });
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('block_build_change', {
  description: 'Build an unsigned change block hex.',
  inputSchema: { account: z.string(), representative: z.string(), rpcUrl: z.string().optional() },
}, async (args) => {
  try {
    const client = getNanoClient(args.rpcUrl);
    const rep = validateAddress(args.representative);
    if (!rep.valid || !rep.publicKey) throw new Error(`Invalid representative address: ${rep.error}`);
    const info = await rpcAccountInfo(client, args.account, { timeoutMs: state.config.timeoutMs || DEFAULT_TIMEOUT_MS });
    if (isRpcError(info)) throw new Error(`Account not opened: ${info.error}`);
    const blockHex = buildNanoStateBlockHex({
      accountPublicKey: decodeNanoAddress(args.account).publicKey,
      previous: info.frontier,
      representativePublicKey: rep.publicKey,
      balanceRaw: info.balance,
      link: '0'.repeat(64),
    });
    return toToolSuccess({ blockHex, account: args.account, representative: args.representative, previous: info.frontier });
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('generate_qr', {
  description: 'Generate ASCII or SVG QR for a Nano address.',
  inputSchema: { address: z.string(), amountXno: z.string().optional(), format: z.enum(['ascii', 'svg']).default('ascii') },
}, async (args) => {
  if (args.format === 'svg') return { content: [{ type: 'text' as const, text: generateSvgQr(args.address, args.amountXno) }] };
  return { content: [{ type: 'text' as const, text: await generateAsciiQr(args.address, args.amountXno) }] };
});

mcpServer.registerTool('info', {
  description: 'Discover the current state and representative of any Nano account.',
  inputSchema: { wallet: z.string().optional(), address: z.string().optional() },
}, async (args) => {
  try {
    if (!args.wallet && !args.address) throw new Error("Either 'wallet' or 'address' must be provided");
    if (args.wallet && args.address) throw new Error("Cannot specify both 'wallet' and 'address'");
    return toToolSuccess(await getNanoAccountInfo({ wallet: args.wallet, address: args.address }, readersFor(), { config: state.config }));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('ows_health_check', {
  description: 'Check if the OWS wallet daemon is reachable and responding correctly.',
  inputSchema: {},
}, async () => toToolSuccess(await checkOwsHealth()));

mcpServer.registerTool('history', {
  description: 'View Nano transaction history tracked by xno-skills for an OWS wallet.',
  inputSchema: { wallet: z.string(), index: z.number().optional(), limit: z.number().default(20) },
}, async (args) => {
  try {
    const ctx = { config: state.config, appendTransaction };
    return toToolSuccess(await getNanoHistory(args.wallet, readersFor(), ctx, { index: args.index ?? 0, count: args.limit }));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('payment_request_create', {
  description: 'Create a tracked Nano payment request using an OWS wallet.',
  inputSchema: { walletName: z.string(), accountIndex: z.number().default(0), amountXno: z.string(), reason: z.string() },
}, async (args) => {
  try {
    const address = await getNanoAddress(args.walletName, args.accountIndex);
    const id = generateId();
    const requestRecord: PaymentRequest = {
      id,
      owsWalletId: args.walletName,
      accountIndex: args.accountIndex,
      address: address.address,
      amountRaw: nanoToRaw(args.amountXno),
      reason: args.reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      receivedBlocks: [],
    };
    state.paymentRequests.set(id, requestRecord);
    persistPaymentRequests();
    const qr = await generateAsciiQr(address.address, args.amountXno);
    return toToolSuccess({ id, address: address.address, amountXno: args.amountXno, qr });
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('payment_request_list', {
  description: 'List payment requests.',
  inputSchema: { walletName: z.string().optional(), status: z.string().optional() },
}, async (args) => {
  let list = Array.from(state.paymentRequests.values());
  if (args.walletName) list = list.filter(r => r.owsWalletId === args.walletName);
  if (args.status) list = list.filter(r => r.status === args.status);
  return toToolSuccess(list);
});

mcpServer.registerTool('payment_request_status', {
  description: 'Check payment request status.',
  inputSchema: { id: z.string() },
}, async (args) => {
  const rec = state.paymentRequests.get(args.id);
  if (!rec) return toToolError(new Error('Not found'));
  return toToolSuccess(rec);
});

mcpServer.registerTool('payment_request_receive', {
  description: 'Receive pending funds for a payment request.',
  inputSchema: { id: z.string() },
}, async (args, extra) => {
  try {
    const rec = state.paymentRequests.get(args.id);
    if (!rec) throw new Error('Not found');
    const ctx = { config: state.config, appendTransaction, reportProgress: makeProgressReporter(extra.sendNotification, extra._meta?.progressToken) };
    return toToolSuccess(await executeReceive(rec.owsWalletId, undefined, ctx, readersFor(), { index: rec.accountIndex, count: 10 }));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('payment_request_refund', {
  description: 'Refund a payment request.',
  inputSchema: { id: z.string(), execute: z.boolean().default(false), confirmAddress: z.string().optional() },
}, async (args, extra) => {
  try {
    const rec = state.paymentRequests.get(args.id);
    if (!rec) throw new Error('Not found');
    if (!args.execute) return { content: [{ type: 'text' as const, text: 'Set execute: true to refund.' }] };
    const ctx = { config: state.config, appendTransaction, reportProgress: makeProgressReporter(extra.sendNotification, extra._meta?.progressToken) };
    return toToolSuccess(await executeSend(rec.owsWalletId, undefined, ctx, readersFor(), String(args.confirmAddress), rawToNano(rec.amountRaw), { index: rec.accountIndex }));
  } catch (error) { return toToolError(error); }
});

// Deprecated aliases
mcpServer.registerTool('wallet_list', {
  description: 'Deprecated alias for wallets.',
  inputSchema: {},
}, async () => toToolSuccess(await listNanoWallets()));

mcpServer.registerTool('wallet_balance', {
  description: 'Deprecated alias for balance.',
  inputSchema: { name: z.string(), index: z.number().default(0), rpcUrl: z.string().optional() },
}, async (args, extra) => {
  try {
    const ctx = { config: state.config, appendTransaction, reportProgress: makeProgressReporter(extra.sendNotification, extra._meta?.progressToken) };
    return toToolSuccess(await getNanoBalance(args.name, readersFor(args.rpcUrl), ctx, args.index));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('wallet_receive', {
  description: 'Deprecated alias for receive.',
  inputSchema: {
    name: z.string(),
    index: z.number().default(0),
    count: z.number().default(10),
    onlyHash: z.string().optional(),
    representative: z.string().optional(),
    rpcUrl: z.string().optional(),
  },
}, async (args, extra) => {
  try {
    const ctx = { config: state.config, appendTransaction, reportProgress: makeProgressReporter(extra.sendNotification, extra._meta?.progressToken) };
    return toToolSuccess(await executeReceive(args.name, args.rpcUrl, ctx, readersFor(args.rpcUrl), {
      index: args.index,
      count: args.count,
      onlyHash: args.onlyHash,
      representative: args.representative,
    }));
  } catch (error) { return toToolError(error); }
});

mcpServer.registerTool('wallet_send', {
  description: `Deprecated alias for send. Max per transaction: ${state.config.maxSendXno || DEFAULT_MAX_SEND_XNO} XNO.`,
  inputSchema: {
    name: z.string(),
    index: z.number().default(0),
    destination: z.string(),
    amountXno: z.string(),
    rpcUrl: z.string().optional(),
  },
}, async (args, extra) => {
  try {
    const ctx = { config: state.config, appendTransaction, reportProgress: makeProgressReporter(extra.sendNotification, extra._meta?.progressToken) };
    return toToolSuccess(await executeSend(args.name, args.rpcUrl, ctx, readersFor(args.rpcUrl), args.destination, args.amountXno, { index: args.index }));
  } catch (error) { return toToolError(error); }
});

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

export async function runMcpServer() {
  const transport = new StdioServerTransport();

  process.stderr.write(`[xno-mcp] Starting v${version}...\n`);

  const shutdown = async () => {
    process.stderr.write('[xno-mcp] Shutting down...\n');
    try {
      await mcpServer.close();
    } catch { }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await mcpServer.connect(transport);
    process.stderr.write('[xno-mcp] Connected to stdio.\n');
  } catch (error: any) {
    process.stderr.write(`[xno-mcp] Connection failed: ${error.message}\n`);
    process.exit(1);
  }
}
