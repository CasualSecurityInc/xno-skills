import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { generateAsciiQr } from './qr.js';
import { rpcAccountBalance, rpcAccountsBalances, rpcAccountsFrontiers, rpcAccountInfo, rpcReceivable } from './rpc.js';
import { nanoToRaw, rawToNano } from './convert.js';
import { validateAddress } from './validate.js';
import { version } from './version.js';
import { NOMS, NanoClient, WorkProvider } from '@openrai/nano-core';
import {
  DEFAULT_TIMEOUT_MS,
  createProgressReporter,
  executeChange,
  executeReceive,
  executeSend,
  getNanoAddress,
  getNanoBalance,
  getNanoPending,
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

const server = new Server(
  {
    name: 'xno-mcp',
    version,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

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

  const client = NanoClient.initialize({
    rpc: rpc.length > 0 ? rpc : undefined,
    workProvider: WorkProvider.auto({
      ...(work.length > 0 ? { urls: work } : {}),
      timeoutMs: workTimeoutMs,
    }),
  });

  if (!explicitRpc && !explicitWork) {
    state.nanoClient = client;
  }

  return client;
}

function readersFor(rpcUrl?: string): NanoReaders {
  const client = getNanoClient(rpcUrl);
  const timeoutMs = state.config.timeoutMs || DEFAULT_TIMEOUT_MS;
  return {
    accountInfo: (address: string) => rpcAccountInfo(client, address, { timeoutMs }),
    accountBalance: (address: string) => rpcAccountBalance(client, address, { timeoutMs }),
    receivable: (address: string, count: number) => rpcReceivable(client, address, count, { timeoutMs }),
  };
}

function persistConfig(): void {
  saveConfig(state.config);
}

function persistPaymentRequests(): void {
  savePaymentRequests(state.paymentRequests.values());
}

function persistTransactions(): void {
  saveTransactions(state.transactions);
}

function appendTransaction(record: TransactionRecord): void {
  state.transactions.push(record);
  persistTransactions();
}

function ctxWithProgress(progressToken?: string | number) {
  return {
    config: state.config,
    appendTransaction,
    reportProgress: progressToken !== undefined ? (progress: number, total: number, message: string) =>
      server.notification({
        method: 'notifications/progress',
        params: {
          progressToken,
          progress,
          total,
          message,
        },
      }) : undefined,
  };
}

function parseToolName(name: string): string {
  switch (name) {
    case 'wallet_list':
      return 'wallets';
    case 'wallet_balance':
      return 'balance';
    case 'wallet_receive':
      return 'receive';
    case 'wallet_send':
      return 'send';
    case 'wallet_history':
      return 'history';
    default:
      return name;
  }
}

function walletNameFromArgs(args: any): string {
  return String(args?.wallet ?? args?.name ?? args?.walletName ?? '');
}

function walletIndexFromArgs(args: any): number {
  return Number(args?.index ?? args?.accountIndex ?? 0);
}

function historyFor(walletName: string, index?: number, limit = 20): TransactionRecord[] {
  let txs = state.transactions.filter((entry) => entry.owsWalletId === walletName);
  if (index !== undefined) txs = txs.filter((entry) => entry.accountIndex === index);
  return txs.slice(0, limit);
}

async function checkOwsHealth() {
  try {
    const wallets = await listWalletsProxy();
    return { status: 'Ready', walletCount: wallets.length, mode: process.env.XNO_MCP_MOCK_OWS === 'true' ? 'Mock' : 'Native' };
  } catch (error: any) {
    return { status: 'Error', message: error.message, mode: 'Native' };
  }
}

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: [
    {
      uriTemplate: 'wallet://{name}',
      name: 'OWS Wallet Status',
      description: 'Status and balances for an OWS wallet',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'wallet://{name}/account/{index}',
      name: 'OWS Account Details',
      description: 'Specific details for an OWS Nano account',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const wallets = await listNanoWallets();
  return {
    resources: wallets.map((wallet) => ({
      uri: `wallet://${wallet.name}`,
      name: `Wallet ${wallet.name}`,
      description: `Nano account summary for OWS wallet ${wallet.name}`,
      mimeType: 'application/json',
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const walletMatch = /^wallet:\/\/([^/]+)$/.exec(uri);
  const accountMatch = /^wallet:\/\/([^/]+)\/account\/(\d+)$/.exec(uri);

  if (walletMatch) {
    const wallet = walletMatch[1];
    const address = await getNanoAddress(wallet);
    const balance = await getNanoBalance(wallet, readersFor(), { config: state.config }, 0);
    const pending = await getNanoPending(wallet, readersFor(), { config: state.config }, { index: 0, count: 10 });
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ wallet, address, balance, pending }, null, 2),
      }],
    };
  }

  if (accountMatch) {
    const wallet = accountMatch[1];
    const index = Number(accountMatch[2]);
    const address = await getNanoAddress(wallet, index);
    const balance = await getNanoBalance(wallet, readersFor(), { config: state.config }, index);
    const pending = await getNanoPending(wallet, readersFor(), { config: state.config }, { index, count: 10 });
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ wallet, index, address, balance, pending }, null, 2),
      }],
    };
  }

  throw new Error(`Unsupported resource URI: ${uri}`);
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'config_get', description: 'Read current xno-mcp configuration (advanced).', inputSchema: { type: 'object', properties: {} } },
    {
      name: 'config_set',
      description: 'Update xno-mcp configuration (advanced).',
      inputSchema: {
        type: 'object',
        properties: {
          rpcUrl: { type: 'string' },
          workPeerUrl: { type: 'string' },
          timeoutMs: { type: 'number' },
          defaultRepresentative: { type: 'string' },
          maxSendXno: { type: 'string' },
        },
      },
    },
    { name: 'wallets', description: 'List OWS wallets that have Nano accounts.', inputSchema: { type: 'object', properties: {} } },
    {
      name: 'address',
      description: 'Show the Nano address for an OWS wallet.',
      inputSchema: { type: 'object', properties: { wallet: { type: 'string' }, index: { type: 'number', default: 0 } }, required: ['wallet'] },
    },
    {
      name: 'balance',
      description: 'Show Nano balance and pending amount for an OWS wallet.',
      inputSchema: { type: 'object', properties: { wallet: { type: 'string' }, index: { type: 'number', default: 0 } }, required: ['wallet'] },
    },
    {
      name: 'pending',
      description: 'List Nano receivable blocks for an OWS wallet.',
      inputSchema: { type: 'object', properties: { wallet: { type: 'string' }, index: { type: 'number', default: 0 }, count: { type: 'number', default: 10 } }, required: ['wallet'] },
    },
    {
      name: 'receive',
      description: 'Receive pending Nano blocks for an OWS wallet. Automatically handles open vs receive.',
      inputSchema: {
        type: 'object',
        properties: {
          wallet: { type: 'string' },
          index: { type: 'number', default: 0 },
          count: { type: 'number', default: 10 },
          onlyHash: { type: 'string' },
          representative: { type: 'string' },
          rpcUrl: { type: 'string' },
        },
        required: ['wallet'],
      },
    },
    {
      name: 'send',
      description: `Send Nano from an OWS wallet. Max per transaction: ${state.config.maxSendXno || DEFAULT_MAX_SEND_XNO} XNO.`,
      inputSchema: {
        type: 'object',
        properties: {
          wallet: { type: 'string' },
          index: { type: 'number', default: 0 },
          destination: { type: 'string' },
          amountXno: { type: 'string' },
          rpcUrl: { type: 'string' },
        },
        required: ['wallet', 'destination', 'amountXno'],
      },
    },
    {
      name: 'change',
      description: 'Submit a Nano change block to update representative for an OWS wallet.',
      inputSchema: {
        type: 'object',
        properties: {
          wallet: { type: 'string' },
          index: { type: 'number', default: 0 },
          representative: { type: 'string' },
          rpcUrl: { type: 'string' },
        },
        required: ['wallet', 'representative'],
      },
    },
    {
      name: 'submit_block',
      description: 'Sign and submit a prepared Nano block hex using an OWS wallet.',
      inputSchema: {
        type: 'object',
        properties: {
          wallet: { type: 'string' },
          index: { type: 'number', default: 0 },
          txHex: { type: 'string' },
          subtype: { type: 'string', enum: ['send', 'receive', 'open', 'change'] },
          rpcUrl: { type: 'string' },
        },
        required: ['wallet', 'txHex', 'subtype'],
      },
    },
    {
      name: 'history',
      description: 'View Nano transaction history tracked by xno-skills for an OWS wallet.',
      inputSchema: {
        type: 'object',
        properties: { wallet: { type: 'string' }, index: { type: 'number' }, limit: { type: 'number', default: 20 } },
        required: ['wallet'],
      },
    },
    {
      name: 'sign_message',
      description: 'Sign a Nano off-chain message with an OWS wallet.',
      inputSchema: {
        type: 'object',
        properties: { wallet: { type: 'string' }, index: { type: 'number', default: 0 }, message: { type: 'string' } },
        required: ['wallet', 'message'],
      },
    },
    {
      name: 'verify_message',
      description: 'Verify a Nano off-chain message signature.',
      inputSchema: {
        type: 'object',
        properties: { address: { type: 'string' }, message: { type: 'string' }, signature: { type: 'string' } },
        required: ['address', 'message', 'signature'],
      },
    },
    { name: 'convert_units', description: 'Convert between Nano units.', inputSchema: { type: 'object', properties: { amount: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['amount', 'from', 'to'] } },
    { name: 'validate_address', description: 'Validate a Nano address.', inputSchema: { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] } },
    { name: 'rpc_account_balance', description: 'Check any Nano account balance via RPC.', inputSchema: { type: 'object', properties: { address: { type: 'string' }, rpcUrl: { type: 'string' } }, required: ['address'] } },
    { name: 'generate_qr', description: 'Generate ASCII QR for a Nano address.', inputSchema: { type: 'object', properties: { address: { type: 'string' }, amountXno: { type: 'string' } }, required: ['address'] } },
    { name: 'ows_health_check', description: 'Check if the OWS wallet daemon is reachable and responding correctly.', inputSchema: { type: 'object', properties: {} } },
    { name: 'payment_request_create', description: 'Create a tracked Nano payment request using an OWS wallet.', inputSchema: { type: 'object', properties: { walletName: { type: 'string' }, accountIndex: { type: 'number', default: 0 }, amountXno: { type: 'string' }, reason: { type: 'string' } }, required: ['walletName', 'amountXno', 'reason'] } },
    { name: 'payment_request_status', description: 'Check payment request status.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    { name: 'payment_request_receive', description: 'Receive pending funds for a payment request.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    { name: 'payment_request_list', description: 'List payment requests.', inputSchema: { type: 'object', properties: { status: { type: 'string' }, walletName: { type: 'string' } } } },
    { name: 'payment_request_refund', description: 'Refund a payment request.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, execute: { type: 'boolean', default: false }, confirmAddress: { type: 'string' } }, required: ['id'] } },

    { name: 'wallet_list', description: 'Deprecated alias for wallets.', inputSchema: { type: 'object', properties: {} } },
    { name: 'wallet_balance', description: 'Deprecated alias for balance.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, index: { type: 'number', default: 0 } }, required: ['name'] } },
    { name: 'wallet_receive', description: 'Deprecated alias for receive.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, index: { type: 'number', default: 0 }, count: { type: 'number', default: 10 }, onlyHash: { type: 'string' }, representative: { type: 'string' }, rpcUrl: { type: 'string' } }, required: ['name'] } },
    { name: 'wallet_send', description: `Deprecated alias for send. Max per transaction: ${state.config.maxSendXno || DEFAULT_MAX_SEND_XNO} XNO.`, inputSchema: { type: 'object', properties: { name: { type: 'string' }, index: { type: 'number', default: 0 }, destination: { type: 'string' }, amountXno: { type: 'string' }, rpcUrl: { type: 'string' } }, required: ['name', 'destination', 'amountXno'] } },
    { name: 'wallet_history', description: 'Deprecated alias for history.', inputSchema: { type: 'object', properties: { walletName: { type: 'string' }, accountIndex: { type: 'number' }, limit: { type: 'number', default: 20 } }, required: ['walletName'] } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = request.params.arguments as any;
  const name = parseToolName(request.params.name);
  const progressToken = request.params._meta?.progressToken;
  const ctx = ctxWithProgress(progressToken);

  try {
    switch (name) {
      case 'config_get':
        return toToolSuccess(state.config);

      case 'config_set': {
        if (args?.rpcUrl !== undefined) state.config.rpcUrl = String(args.rpcUrl);
        if (args?.workPeerUrl !== undefined) state.config.workPeerUrl = String(args.workPeerUrl);
        if (args?.timeoutMs !== undefined) state.config.timeoutMs = Number(args.timeoutMs);
        if (args?.defaultRepresentative !== undefined) state.config.defaultRepresentative = String(args.defaultRepresentative);
        if (args?.maxSendXno !== undefined) state.config.maxSendXno = String(args.maxSendXno);
        state.nanoClient = undefined;
        persistConfig();
        return toToolSuccess(state.config);
      }

      case 'wallets':
        return toToolSuccess(await listNanoWallets());

      case 'address': {
        const wallet = walletNameFromArgs(args);
        const index = walletIndexFromArgs(args);
        return toToolSuccess(await getNanoAddress(wallet, index));
      }

      case 'balance': {
        const wallet = walletNameFromArgs(args);
        const index = walletIndexFromArgs(args);
        return toToolSuccess(await getNanoBalance(wallet, readersFor(String(args?.rpcUrl ?? '')), ctx, index));
      }

      case 'pending': {
        const wallet = walletNameFromArgs(args);
        const index = walletIndexFromArgs(args);
        const count = Number(args?.count ?? 10);
        return toToolSuccess(await getNanoPending(wallet, readersFor(String(args?.rpcUrl ?? '')), ctx, { index, count }));
      }

      case 'receive': {
        const wallet = walletNameFromArgs(args);
        const index = walletIndexFromArgs(args);
        const count = Number(args?.count ?? 10);
        const res = await executeReceive(wallet, String(args?.rpcUrl ?? ''), ctx, readersFor(String(args?.rpcUrl ?? '')), {
          index,
          count,
          onlyHash: args?.onlyHash ? String(args.onlyHash) : undefined,
          representative: args?.representative ? String(args.representative) : undefined,
        });
        return toToolSuccess(res);
      }

      case 'send': {
        const wallet = walletNameFromArgs(args);
        const index = walletIndexFromArgs(args);
        const res = await executeSend(
          wallet,
          String(args?.rpcUrl ?? ''),
          ctx,
          readersFor(String(args?.rpcUrl ?? '')),
          String(args?.destination),
          String(args?.amountXno),
          { index },
        );
        return toToolSuccess(res);
      }

      case 'change': {
        const wallet = walletNameFromArgs(args);
        const index = walletIndexFromArgs(args);
        const res = await executeChange(
          wallet,
          String(args?.rpcUrl ?? ''),
          ctx,
          readersFor(String(args?.rpcUrl ?? '')),
          String(args?.representative),
          { index },
        );
        return toToolSuccess(res);
      }

      case 'submit_block': {
        const wallet = walletNameFromArgs(args);
        const index = walletIndexFromArgs(args);
        const subtype = String(args?.subtype) as 'send' | 'receive' | 'open' | 'change';
        return toToolSuccess(await submitPreparedBlock(wallet, String(args?.rpcUrl ?? ''), ctx, String(args?.txHex), subtype, { index }));
      }

      case 'history': {
        const wallet = walletNameFromArgs(args);
        const index = args?.index !== undefined || args?.accountIndex !== undefined ? walletIndexFromArgs(args) : undefined;
        const limit = Number(args?.limit ?? 20);
        return toToolSuccess(historyFor(wallet, index, limit));
      }

      case 'sign_message': {
        const wallet = walletNameFromArgs(args);
        const index = walletIndexFromArgs(args);
        return toToolSuccess(await signWalletMessage(wallet, String(args?.message), { index }));
      }

      case 'verify_message':
        return toToolSuccess(verifyNanoMessage(String(args?.address), String(args?.message), String(args?.signature)));

      case 'convert_units': {
        const amount = String(args?.amount);
        const from = String(args?.from).toLowerCase();
        const to = String(args?.to).toLowerCase();
        const raw = from === 'xno' ? nanoToRaw(amount) : amount;
        const result = to === 'xno' ? rawToNano(raw) : raw;
        return { content: [{ type: 'text', text: result }] };
      }

      case 'validate_address':
        return toToolSuccess(validateAddress(String(args?.address)));

      case 'rpc_account_balance': {
        const client = getNanoClient(String(args?.rpcUrl ?? ''));
        return toToolSuccess(await rpcAccountBalance(client, String(args?.address), { timeoutMs: state.config.timeoutMs || DEFAULT_TIMEOUT_MS }));
      }

      case 'generate_qr':
        return { content: [{ type: 'text', text: await generateAsciiQr(String(args?.address), String(args?.amountXno ?? '')) }] };

      case 'ows_health_check':
        return toToolSuccess(await checkOwsHealth());

      case 'payment_request_create': {
        const walletName = String(args?.walletName);
        const accountIndex = Number(args?.accountIndex ?? 0);
        const amountXno = String(args?.amountXno);
        const reason = String(args?.reason);
        const address = await getNanoAddress(walletName, accountIndex);
        const id = generateId();
        const requestRecord: PaymentRequest = {
          id,
          owsWalletId: walletName,
          accountIndex,
          address: address.address,
          amountRaw: nanoToRaw(amountXno),
          reason,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          receivedBlocks: [],
        };
        state.paymentRequests.set(id, requestRecord);
        persistPaymentRequests();
        const qr = await generateAsciiQr(address.address, amountXno);
        return toToolSuccess({ id, address: address.address, amountXno, qr });
      }

      case 'payment_request_status': {
        const requestRecord = state.paymentRequests.get(String(args?.id));
        if (!requestRecord) throw new Error('Not found');
        return toToolSuccess(requestRecord);
      }

      case 'payment_request_receive': {
        const requestRecord = state.paymentRequests.get(String(args?.id));
        if (!requestRecord) throw new Error('Not found');
        return toToolSuccess(await executeReceive(requestRecord.owsWalletId, undefined, ctx, readersFor(), {
          index: requestRecord.accountIndex,
          count: 10,
        }));
      }

      case 'payment_request_list': {
        let list = Array.from(state.paymentRequests.values());
        if (args?.status) list = list.filter((entry) => entry.status === String(args.status));
        if (args?.walletName) list = list.filter((entry) => entry.owsWalletId === String(args.walletName));
        return toToolSuccess(list);
      }

      case 'payment_request_refund': {
        const requestRecord = state.paymentRequests.get(String(args?.id));
        if (!requestRecord) throw new Error('Not found');
        if (!Boolean(args?.execute)) return { content: [{ type: 'text', text: 'Set execute: true to refund.' }] };
        return toToolSuccess(await executeSend(
          requestRecord.owsWalletId,
          undefined,
          ctx,
          readersFor(),
          String(args?.confirmAddress),
          rawToNano(requestRecord.amountRaw),
          { index: requestRecord.accountIndex },
        ));
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    return toToolError(error);
  }
});

export async function runMcpServer() {
  const transport = new StdioServerTransport();

  process.stderr.write(`[xno-mcp] Starting v${version}...\n`);

  const shutdown = async () => {
    process.stderr.write('[xno-mcp] Shutting down...\n');
    try {
      await server.close();
    } catch {}
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await server.connect(transport);
    process.stderr.write('[xno-mcp] Connected to stdio.\n');
  } catch (error: any) {
    process.stderr.write(`[xno-mcp] Connection failed: ${error.message}\n`);
    process.exit(1);
  }
}
