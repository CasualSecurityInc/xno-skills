import { NOMS } from '@openrai/nano-core';
import { ProgressNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { buildNanoStateBlockHex } from './state-block.js';
import { decodeNanoAddress } from './nano-address.js';
import { nanoToRaw, rawToNano } from './convert.js';
import { validateAddress } from './validate.js';
import { type ReceivableItem, type NanoRpcErrorResponse, type AccountInfoResponse } from './rpc.js';
import { generateId, type TransactionRecord, type XnoConfig } from './state-store.js';
import { getWalletProxy, listWalletsProxy, signAndSendProxy, signMessageProxy, type OwsWalletLike } from './ows.js';

export const DEFAULT_TIMEOUT_MS = 15000;
export const DEFAULT_REPRESENTATIVE = 'nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4';
const ZERO_32_HEX = '0'.repeat(64);
const MOCK_TX_HASH = '0'.repeat(64);

export type NanoActionStep =
  | 'resolve_wallet'
  | 'resolve_account'
  | 'fetch_account_info'
  | 'fetch_balance'
  | 'fetch_receivable'
  | 'build_block'
  | 'sign_with_ows'
  | 'submit_block'
  | 'persist_history'
  | 'verify_message';

export class NanoActionError extends Error {
  code: string;
  step: NanoActionStep;
  retriable: boolean;
  details?: Record<string, unknown>;

  constructor(code: string, step: NanoActionStep, message: string, options: { retriable?: boolean; details?: Record<string, unknown> } = {}) {
    super(message);
    this.name = 'NanoActionError';
    this.code = code;
    this.step = step;
    this.retriable = options.retriable ?? false;
    this.details = options.details;
  }
}

export type ProgressReporter = (progress: number, total: number, message: string) => Promise<void>;

export type NanoActionContext = {
  config: XnoConfig;
  appendTransaction?: (record: TransactionRecord) => void;
  reportProgress?: ProgressReporter;
};

export type NanoReaders = {
  accountInfo: (address: string) => Promise<AccountInfoResponse | NanoRpcErrorResponse>;
  accountBalance: (address: string) => Promise<{ balance: string; pending: string }>;
  receivable: (address: string, count: number) => Promise<ReceivableItem[]>;
};

export type NanoWalletAccount = {
  walletName: string;
  index: number;
  address: string;
  chainId: string;
};

export type NanoWalletSummary = {
  name: string;
  createdAt: string;
  address?: string;
};

export type PendingSummary = {
  address: string;
  blocks: ReceivableItem[];
};

export type AddressSummary = {
  wallet: string;
  address: string;
};

export type BalanceSummary = {
  address: string;
  balanceRaw: string;
  pendingRaw: string;
  balanceXno: string;
  pendingXno: string;
};

export type HistorySummary = TransactionRecord[];

export type SubmitBlockResult = {
  hash: string;
  address: string;
  subtype: 'send' | 'receive' | 'open' | 'change';
};

export type ReceiveResult = {
  address: string;
  received: Array<{ hash: string; amountRaw: string }>;
  balanceRaw: string;
  balanceXno: string;
};

export type SendResult = {
  hash: string;
  from: string;
  to: string;
  amountRaw: string;
  amountXno: string;
};

export type ChangeResult = {
  hash: string;
  address: string;
  representative: string;
};

export type SignMessageResult = {
  address: string;
  signature: string;
};

export type VerifyMessageResult = {
  valid: boolean;
};

function effectiveTimeoutMs(config: XnoConfig): number {
  return config.timeoutMs || DEFAULT_TIMEOUT_MS;
}

function requireRepresentativeAddress(config: XnoConfig, explicit?: string): string {
  const rep = (explicit || config.defaultRepresentative || '').trim();
  if (!rep) return DEFAULT_REPRESENTATIVE;
  const validation = validateAddress(rep);
  if (!validation.valid) {
    throw new NanoActionError('INVALID_REPRESENTATIVE', 'build_block', `Invalid representative address: ${validation.error}`, { details: { representative: rep } });
  }
  return rep;
}

function wrapError(error: unknown, code: string, step: NanoActionStep, message: string, details?: Record<string, unknown>, retriable = false): never {
  if (error instanceof NanoActionError) throw error;
  const inner = error instanceof Error ? error.message : String(error);
  throw new NanoActionError(code, step, `${message}: ${inner}`, { retriable, details: { ...details, cause: inner } });
}

function isRpcError(resp: NanoRpcErrorResponse | AccountInfoResponse): resp is NanoRpcErrorResponse {
  return typeof (resp as any)?.error === 'string';
}

export async function createProgressReporter(server: { notification: (notification: unknown) => Promise<void> }, progressToken?: string | number): Promise<ProgressReporter | undefined> {
  if (progressToken === undefined) return undefined;
  return async (progress: number, total: number, message: string) => {
    await server.notification({
      method: 'notifications/progress',
      params: {
        progressToken,
        progress,
        total,
        message,
      },
    });
  };
}

async function report(ctx: NanoActionContext, progress: number, total: number, message: string): Promise<void> {
  process.stderr.write(`[xno-mcp] ${message}\n`);
  if (ctx.reportProgress) {
    await ctx.reportProgress(progress, total, message);
  }
}

export async function listNanoWallets(): Promise<NanoWalletSummary[]> {
  const wallets = await listWalletsProxy();
  return wallets.map((wallet) => ({
    name: wallet.name,
    createdAt: wallet.createdAt,
    address: wallet.accounts.find((account) => account.address.startsWith('nano_'))?.address,
  }));
}

export async function resolveNanoWalletAccount(walletName: string, index = 0): Promise<NanoWalletAccount> {
  const wallet = await getWalletProxy(walletName);
  if (!wallet) {
    throw new NanoActionError('OWS_WALLET_NOT_FOUND', 'resolve_wallet', `OWS wallet not found: ${walletName}`, { details: { walletName } });
  }

  const account = wallet.accounts.find((entry) =>
    (entry.chainId === 'nano' || entry.chainId.startsWith('nano:')) &&
    entry.derivationPath.endsWith(`/${index}`)
  ) || wallet.accounts.filter((entry) => entry.address.startsWith('nano_'))[index];

  if (!account) {
    throw new NanoActionError('NANO_ACCOUNT_NOT_FOUND', 'resolve_account', `Nano account at index ${index} not found in OWS wallet ${walletName}`, {
      details: { walletName, index },
    });
  }

  return {
    walletName,
    index,
    address: account.address,
    chainId: account.chainId,
  };
}

export async function getNanoAddress(walletName: string, index = 0): Promise<AddressSummary> {
  const account = await resolveNanoWalletAccount(walletName, index);
  return { wallet: walletName, address: account.address };
}

export async function getNanoBalance(walletName: string, readers: NanoReaders, ctx: NanoActionContext, index = 0): Promise<BalanceSummary> {
  const account = await resolveNanoWalletAccount(walletName, index);
  try {
    const balance = await readers.accountBalance(account.address);
    return {
      address: account.address,
      balanceRaw: balance.balance,
      pendingRaw: balance.pending,
      balanceXno: rawToNano(balance.balance),
      pendingXno: rawToNano(balance.pending),
    };
  } catch (error) {
    wrapError(error, 'BALANCE_LOOKUP_FAILED', 'fetch_balance', `Failed to fetch balance for ${account.address}`, { walletName, address: account.address }, true);
  }
}

export async function getNanoPending(walletName: string, readers: NanoReaders, ctx: NanoActionContext, options: { index?: number; count?: number } = {}): Promise<PendingSummary> {
  const index = options.index ?? 0;
  const count = options.count ?? 10;
  const account = await resolveNanoWalletAccount(walletName, index);
  try {
    const blocks = await readers.receivable(account.address, count);
    return { address: account.address, blocks };
  } catch (error) {
    wrapError(error, 'RECEIVABLE_LOOKUP_FAILED', 'fetch_receivable', `Failed to fetch pending blocks for ${account.address}`, { walletName, address: account.address }, true);
  }
}

export async function executeReceive(
  walletName: string,
  rpcUrl: string | undefined,
  ctx: NanoActionContext,
  readers: NanoReaders,
  options: { index?: number; count?: number; onlyHash?: string; representative?: string } = {},
): Promise<ReceiveResult> {
  const index = options.index ?? 0;
  const count = options.count ?? 10;
  const account = await resolveNanoWalletAccount(walletName, index);

  await report(ctx, 1, 5, `receive: account_info for ${account.address}`);
  let info: AccountInfoResponse | NanoRpcErrorResponse;
  try {
    info = await readers.accountInfo(account.address);
  } catch (error) {
    wrapError(error, 'ACCOUNT_INFO_LOOKUP_FAILED', 'fetch_account_info', `Failed to fetch account info for ${account.address}`, { walletName, address: account.address }, true);
  }

  const opened = !isRpcError(info);
  const representative = opened ? (info as AccountInfoResponse).representative : requireRepresentativeAddress(ctx.config, options.representative);
  if (!representative) {
    throw new NanoActionError('REPRESENTATIVE_REQUIRED', 'build_block', `Representative address missing for account ${account.address}`, {
      details: { walletName, address: account.address },
    });
  }

  await report(ctx, 2, 5, `receive: receivable for ${account.address}`);
  let receivable: ReceivableItem[];
  try {
    receivable = await readers.receivable(account.address, count);
  } catch (error) {
    wrapError(error, 'RECEIVABLE_LOOKUP_FAILED', 'fetch_receivable', `Failed to fetch pending blocks for ${account.address}`, { walletName, address: account.address }, true);
  }

  const pending = options.onlyHash ? receivable.filter((item) => item.hash === options.onlyHash) : receivable;
  if (!pending.length) {
    const bal = opened ? (info as AccountInfoResponse).balance : '0';
    return { address: account.address, received: [], balanceRaw: bal, balanceXno: rawToNano(bal) };
  }

  await report(ctx, 3, 5, `receive: building block for ${pending[0].hash}`);
  const previous = opened ? (info as AccountInfoResponse).frontier : ZERO_32_HEX;
  const currentBalance = opened ? BigInt((info as AccountInfoResponse).balance) : 0n;
  const amountRaw = pending.reduce((sum, item) => sum + BigInt(item.amount), 0n).toString();
  const newBalance = (currentBalance + BigInt(amountRaw)).toString();
  const blockHex = buildNanoStateBlockHex({
    accountPublicKey: decodeNanoAddress(account.address).publicKey,
    previous,
    representativePublicKey: decodeNanoAddress(representative).publicKey,
    balanceRaw: newBalance,
    link: pending[0].hash,
  });

  await report(ctx, 4, 5, `receive: submitting ${opened ? 'receive' : 'open'} block for ${account.address}`);
  let submitted;
  try {
    submitted = await signAndSendProxy(walletName, account.chainId, blockHex, undefined, index, rpcUrl);
  } catch (error) {
    wrapError(error, 'BLOCK_SUBMIT_FAILED', 'submit_block', `Failed to submit ${opened ? 'receive' : 'open'} block for ${account.address}`, {
      walletName,
      address: account.address,
      subtype: opened ? 'receive' : 'open',
    }, true);
  }

  await report(ctx, 5, 5, `receive: persisted ${submitted.txHash}`);
  ctx.appendTransaction?.({
    id: generateId(),
    owsWalletId: walletName,
    accountIndex: index,
    address: account.address,
    type: 'receive',
    amountRaw,
    counterparty: pending[0].source ?? '',
    hash: submitted.txHash,
    timestamp: new Date().toISOString(),
  });

  return {
    address: account.address,
    received: pending.map((item) => ({ hash: submitted.txHash, amountRaw: item.amount })),
    balanceRaw: newBalance,
    balanceXno: rawToNano(newBalance),
  };
}

export async function executeSend(
  walletName: string,
  rpcUrl: string | undefined,
  ctx: NanoActionContext,
  readers: NanoReaders,
  destination: string,
  amountXno: string,
  options: { index?: number } = {},
): Promise<SendResult> {
  const index = options.index ?? 0;
  const account = await resolveNanoWalletAccount(walletName, index);
  const amountRaw = nanoToRaw(amountXno);

  await report(ctx, 1, 4, `send: account_info for ${account.address}`);
  let info: AccountInfoResponse | NanoRpcErrorResponse;
  try {
    info = await readers.accountInfo(account.address);
  } catch (error) {
    wrapError(error, 'ACCOUNT_INFO_LOOKUP_FAILED', 'fetch_account_info', `Failed to fetch account info for ${account.address}`, { walletName, address: account.address }, true);
  }

  if (isRpcError(info)) {
    throw new NanoActionError('ACCOUNT_UNOPENED', 'fetch_account_info', 'Account unopened.', { details: { walletName, address: account.address } });
  }

  const destinationValidation = validateAddress(destination);
  if (!destinationValidation.valid || !destinationValidation.publicKey) {
    throw new NanoActionError('INVALID_DESTINATION', 'build_block', `Invalid destination address: ${destinationValidation.error}`, { details: { destination } });
  }

  const currentBalance = BigInt(info.balance);
  if (BigInt(amountRaw) > currentBalance) {
    throw new NanoActionError('INSUFFICIENT_BALANCE', 'build_block', 'Insufficient balance.', {
      details: { address: account.address, currentBalance: info.balance, amountRaw },
    });
  }

  await report(ctx, 2, 4, `send: building block for ${destination}`);
  const blockHex = buildNanoStateBlockHex({
    accountPublicKey: decodeNanoAddress(account.address).publicKey,
    previous: info.frontier,
    representativePublicKey: decodeNanoAddress(info.representative || DEFAULT_REPRESENTATIVE).publicKey,
    balanceRaw: (currentBalance - BigInt(amountRaw)).toString(),
    link: destinationValidation.publicKey,
  });

  await report(ctx, 3, 4, `send: submitting block for ${account.address}`);
  let submitted;
  try {
    submitted = await signAndSendProxy(walletName, account.chainId, blockHex, undefined, index, rpcUrl);
  } catch (error) {
    wrapError(error, 'BLOCK_SUBMIT_FAILED', 'submit_block', `Failed to submit send block for ${account.address}`, {
      walletName,
      address: account.address,
      destination,
    }, true);
  }

  await report(ctx, 4, 4, `send: persisted ${submitted.txHash}`);
  ctx.appendTransaction?.({
    id: generateId(),
    owsWalletId: walletName,
    accountIndex: index,
    address: account.address,
    type: 'send',
    amountRaw,
    counterparty: destination,
    hash: submitted.txHash,
    timestamp: new Date().toISOString(),
  });

  return { hash: submitted.txHash, from: account.address, to: destination, amountRaw, amountXno };
}

export async function executeChange(
  walletName: string,
  rpcUrl: string | undefined,
  ctx: NanoActionContext,
  readers: NanoReaders,
  representative: string,
  options: { index?: number } = {},
): Promise<ChangeResult> {
  const index = options.index ?? 0;
  const account = await resolveNanoWalletAccount(walletName, index);
  const repValidation = validateAddress(representative);
  if (!repValidation.valid || !repValidation.publicKey) {
    throw new NanoActionError('INVALID_REPRESENTATIVE', 'build_block', `Invalid representative address: ${repValidation.error}`, { details: { representative } });
  }

  await report(ctx, 1, 4, `change: account_info for ${account.address}`);
  let info: AccountInfoResponse | NanoRpcErrorResponse;
  try {
    info = await readers.accountInfo(account.address);
  } catch (error) {
    wrapError(error, 'ACCOUNT_INFO_LOOKUP_FAILED', 'fetch_account_info', `Failed to fetch account info for ${account.address}`, { walletName, address: account.address }, true);
  }

  if (isRpcError(info)) {
    throw new NanoActionError('ACCOUNT_UNOPENED', 'fetch_account_info', 'Account unopened.', { details: { walletName, address: account.address } });
  }

  await report(ctx, 2, 4, `change: building block for ${account.address}`);
  const blockHex = buildNanoStateBlockHex({
    accountPublicKey: decodeNanoAddress(account.address).publicKey,
    previous: info.frontier,
    representativePublicKey: repValidation.publicKey,
    balanceRaw: info.balance,
    link: ZERO_32_HEX,
  });

  await report(ctx, 3, 4, `change: submitting block for ${account.address}`);
  let submitted;
  try {
    submitted = await signAndSendProxy(walletName, account.chainId, blockHex, undefined, index, rpcUrl);
  } catch (error) {
    wrapError(error, 'BLOCK_SUBMIT_FAILED', 'submit_block', `Failed to submit change block for ${account.address}`, {
      walletName,
      address: account.address,
      representative,
    }, true);
  }

  await report(ctx, 4, 4, `change: persisted ${submitted.txHash}`);
  ctx.appendTransaction?.({
    id: generateId(),
    owsWalletId: walletName,
    accountIndex: index,
    address: account.address,
    type: 'change',
    amountRaw: '0',
    counterparty: representative,
    hash: submitted.txHash,
    timestamp: new Date().toISOString(),
  });

  return { hash: submitted.txHash, address: account.address, representative };
}

export async function submitPreparedBlock(
  walletName: string,
  rpcUrl: string | undefined,
  ctx: NanoActionContext,
  txHex: string,
  subtype: 'send' | 'receive' | 'open' | 'change',
  options: { index?: number } = {},
): Promise<SubmitBlockResult> {
  const index = options.index ?? 0;
  const account = await resolveNanoWalletAccount(walletName, index);
  await report(ctx, 1, 2, `submit-block: submitting ${subtype} block for ${account.address}`);

  let submitted;
  try {
    submitted = await signAndSendProxy(walletName, account.chainId, txHex, undefined, index, rpcUrl);
  } catch (error) {
    wrapError(error, 'BLOCK_SUBMIT_FAILED', 'submit_block', `Failed to submit prepared ${subtype} block for ${account.address}`, {
      walletName,
      address: account.address,
      subtype,
    }, true);
  }

  await report(ctx, 2, 2, `submit-block: persisted ${submitted.txHash}`);
  return { hash: submitted.txHash, address: account.address, subtype };
}

export async function signWalletMessage(walletName: string, message: string, options: { index?: number } = {}): Promise<SignMessageResult> {
  const index = options.index ?? 0;
  const account = await resolveNanoWalletAccount(walletName, index);
  try {
    const result = await signMessageProxy(walletName, account.chainId, message, undefined, undefined, index);
    return { address: account.address, signature: result.signature };
  } catch (error) {
    wrapError(error, 'MESSAGE_SIGN_FAILED', 'sign_with_ows', `Failed to sign message for ${account.address}`, { walletName, address: account.address });
  }
}

export function verifyNanoMessage(address: string, _message: string, _signature: string): VerifyMessageResult {
  const validation = validateAddress(address);
  if (!validation.valid || !validation.publicKey) {
    throw new NanoActionError('INVALID_ADDRESS', 'verify_message', `Invalid address: ${validation.error}`, { details: { address } });
  }
  throw new NanoActionError(
    'MESSAGE_VERIFY_UNSUPPORTED',
    'verify_message',
    'Nano off-chain message verification is not supported: no canonical standard exists. Define an ecosystem convention before enabling this.',
    { details: { address } },
  );
}

export function toToolSuccess(result: unknown, structuredContent?: Record<string, unknown>) {
  const derivedStructured = structuredContent ?? (typeof result === 'object' && result !== null && !Array.isArray(result)
    ? result as Record<string, unknown>
    : undefined);
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    structuredContent: derivedStructured,
  };
}

export function toToolError(error: unknown) {
  if (error instanceof NanoActionError) {
    return {
      content: [{ type: 'text', text: `Error [${error.code}] at ${error.step}: ${error.message}` }],
      structuredContent: {
        code: error.code,
        step: error.step,
        message: error.message,
        retriable: error.retriable,
        details: error.details ?? {},
      },
      isError: true,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    structuredContent: {
      code: 'INTERNAL_ERROR',
      step: 'submit_block',
      message,
      retriable: false,
      details: {},
    },
    isError: true,
  };
}
