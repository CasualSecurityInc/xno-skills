import { NOMS } from '@openrai/nano-core';
import { ProgressNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { buildNanoStateBlockHex, hashNanoStateBlockHex, parseNanoStateBlockHex, type StateBlockHashInput } from './state-block.js';
import { decodeNanoAddress, publicKeyToNanoAddress } from './nano-address.js';
import { nanoToRaw, rawToNano } from './convert.js';
import { validateAddress } from './validate.js';
import { type ReceivableItem, type NanoRpcErrorResponse, type AccountInfoResponse, type AccountHistoryEntry } from './rpc.js';
import { generateId, type TransactionRecord, type XnoConfig } from './state-store.js';
import { getWalletProxy, listWalletsProxy, signTransactionProxy, signMessageProxy, type OwsWalletLike } from './ows.js';
import { THRESHOLD__OPEN_RECEIVE, THRESHOLD__SEND_CHANGE } from 'nano-pow-with-fallback';

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
  | 'fetch_history'
  | 'fetch_info'
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
  accountHistory: (address: string, count: number) => Promise<AccountHistoryEntry[]>;
  workGenerate?: (hash: string, difficulty: string) => Promise<string>;
  process?: (block: Record<string, unknown>, subtype: 'send' | 'receive' | 'open' | 'change') => Promise<{ hash: string }>;
  powTimeoutMs?: number;
};

export type NanoWalletAccount = {
  walletName: string;
  index: number;
  address: string;
  chainId: string;
};

export type NanoWalletSummary = {
  id?: string;
  name: string;
  createdAt: string;
  address?: string;
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
  pendingBlocks: ReceivableItem[];
};

export type HistorySummary = AccountHistoryEntry[];

export type AccountInfoSummary = {
  address: string;
  balanceRaw: string;
  pendingRaw: string;
  balanceXno: string;
  pendingXno: string;
  representative?: string;
  frontier?: string;
  blockCount?: string;
  weightRaw?: string;
  weightXno?: string;
};

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

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

/**
 * Sign a block with OWS, generate PoW via the configured WorkProvider (local-first),
 * then broadcast via rpcProcess. This replaces the monolithic OWS signAndSend which
 * uses a hardcoded rpc.nano.to endpoint for PoW regardless of config.
 */
async function signWorkAndProcess(
  walletName: string,
  chainId: string,
  blockInput: StateBlockHashInput,
  subtype: 'send' | 'receive' | 'open' | 'change',
  index: number,
  readers: NanoReaders,
): Promise<{ txHash: string }> {
  const blockHex = buildNanoStateBlockHex(blockInput);
  const blockHash = hashNanoStateBlockHex(blockInput);

  // 1. Sign with OWS (key custody only — no PoW, no broadcast)
  let signResult: { signature: string };
  try {
    signResult = await signTransactionProxy(walletName, chainId, blockHex, undefined, index);
  } catch (error) {
    wrapError(error, 'BLOCK_SIGN_FAILED', 'sign_with_ows', `OWS failed to sign ${subtype} block`, { walletName });
  }

  // 2. Generate PoW via WorkProvider (local-first: WebGPU → WebGL → WASM → remote)
  const difficulty = (subtype === 'open' || subtype === 'receive') ? THRESHOLD__OPEN_RECEIVE : THRESHOLD__SEND_CHANGE;
  const workRoot = subtype === 'open' ? blockInput.accountPublicKey : blockInput.previous;

  let work: string;
  if (readers.workGenerate) {
    const powTimeoutMs = Math.max(readers.powTimeoutMs ?? 60_000, 30_000);
    try {
      work = await withTimeout(
        readers.workGenerate(workRoot, difficulty),
        powTimeoutMs,
        `PoW generation timed out after ${powTimeoutMs}ms`,
      );
    } catch (error) {
      wrapError(error, 'POW_FAILED', 'submit_block', `PoW generation failed for ${subtype} block`, {}, true);
    }
  } else {
    // Fallback: ask OWS to do it the old way (legacy path, no config control)
    try {
      const result = await signTransactionProxy(walletName, chainId, blockHex, undefined, index);
      // We already signed above; this path signals misconfiguration — raise loudly
      void result;
    } catch (_) {}
    throw new NanoActionError('POW_UNAVAILABLE', 'submit_block', 'workGenerate not provided in readers — cannot generate PoW independently of OWS', { details: { subtype } });
  }

  // 3. Broadcast via rpcProcess
  if (!readers.process) {
    throw new NanoActionError('PROCESS_UNAVAILABLE', 'submit_block', 'process not provided in readers — cannot broadcast block', { details: { subtype } });
  }

  const accountPublicKey = blockInput.accountPublicKey;
  const account = publicKeyToNanoAddress(accountPublicKey);
  const broadcastBlock: Record<string, unknown> = {
    type: 'state',
    account,
    previous: blockInput.previous,
    representative: publicKeyToNanoAddress(blockInput.representativePublicKey),
    balance: blockInput.balanceRaw,
    link: blockInput.link,
    link_as_account: publicKeyToNanoAddress(blockInput.link),
    signature: signResult.signature.toUpperCase(),
    work: work.toUpperCase(),
  };

  let processed: { hash: string };
  try {
    processed = await readers.process(broadcastBlock, subtype);
  } catch (error) {
    wrapError(error, 'BLOCK_SUBMIT_FAILED', 'submit_block', `Failed to broadcast ${subtype} block`, {}, true);
  }

  return { txHash: processed.hash };
}

export function isRpcError(resp: NanoRpcErrorResponse | AccountInfoResponse): resp is NanoRpcErrorResponse {
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
    id: wallet.id,
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

export async function getNanoBalance(walletName: string, readers: NanoReaders, ctx: NanoActionContext, index = 0, count = 10): Promise<BalanceSummary> {
  const account = await resolveNanoWalletAccount(walletName, index);
  try {
    const balance = await readers.accountBalance(account.address);
    let pendingBlocks: ReceivableItem[] = [];
    if (balance.pending && balance.pending !== '0') {
      pendingBlocks = await readers.receivable(account.address, count);
    }
    return {
      address: account.address,
      balanceRaw: balance.balance,
      pendingRaw: balance.pending,
      balanceXno: rawToNano(balance.balance),
      pendingXno: rawToNano(balance.pending),
      pendingBlocks,
    };
  } catch (error) {
    wrapError(error, 'BALANCE_LOOKUP_FAILED', 'fetch_balance', `Failed to fetch balance for ${account.address}`, { walletName, address: account.address }, true);
  }
}

export async function getNanoHistory(walletName: string, readers: NanoReaders, ctx: NanoActionContext, options: { index?: number; count?: number } = {}): Promise<HistorySummary> {
  const index = options.index ?? 0;
  const count = options.count ?? 10;
  const account = await resolveNanoWalletAccount(walletName, index);
  try {
    const history = await readers.accountHistory(account.address, count);
    return history;
  } catch (error) {
    wrapError(error, 'HISTORY_LOOKUP_FAILED', 'fetch_history', `Failed to fetch history for ${account.address}`, { walletName, address: account.address }, true);
  }
}

export async function getNanoAccountInfo(
  options: { wallet?: string; address?: string; index?: number },
  readers: NanoReaders,
  ctx: NanoActionContext
): Promise<AccountInfoSummary> {
  let targetAddress = options.address;
  if (!targetAddress) {
    if (!options.wallet) throw new Error('Either wallet or address must be provided');
    const account = await resolveNanoWalletAccount(options.wallet, options.index ?? 0);
    targetAddress = account.address;
  } else {
    const v = validateAddress(targetAddress);
    if (!v.valid) throw new Error(`Invalid address: ${v.error}`);
  }

  try {
    const info = await readers.accountInfo(targetAddress);
    if ('error' in info) {
      if (info.error === 'Account not found') {
        return {
          address: targetAddress,
          balanceRaw: '0',
          pendingRaw: '0',
          balanceXno: '0',
          pendingXno: '0',
        };
      }
      throw new Error(info.error);
    }

    return {
      address: targetAddress,
      balanceRaw: info.balance,
      pendingRaw: info.pending ?? '0',
      balanceXno: rawToNano(info.balance),
      pendingXno: rawToNano(info.pending ?? '0'),
      representative: info.representative,
      frontier: info.frontier,
      blockCount: info.block_count,
      weightRaw: info.weight,
      weightXno: info.weight ? rawToNano(info.weight) : undefined,
    };
  } catch (error) {
    wrapError(error, 'INFO_LOOKUP_FAILED', 'fetch_info', `Failed to fetch info for ${targetAddress}`, { address: targetAddress }, true);
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

  const received: Array<{ hash: string; amountRaw: string }> = [];
  let currentFrontier = opened ? (info as AccountInfoResponse).frontier : ZERO_32_HEX;
  let currentBalance = opened ? BigInt((info as AccountInfoResponse).balance) : 0n;
  let isOpened = opened;

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    const subtype = isOpened ? 'receive' : 'open';
    const newBalance = (currentBalance + BigInt(item.amount)).toString();

    await report(ctx, 3, 5, `receive: building ${subtype} block ${i + 1}/${pending.length} for ${item.hash}`);
    const blockInput: StateBlockHashInput = {
      accountPublicKey: decodeNanoAddress(account.address).publicKey,
      previous: currentFrontier,
      representativePublicKey: decodeNanoAddress(representative).publicKey,
      balanceRaw: newBalance,
      link: item.hash,
    };

    await report(ctx, 4, 5, `receive: submitting ${subtype} block ${i + 1}/${pending.length} for ${account.address}`);
    let submitted;
    try {
      submitted = await signWorkAndProcess(walletName, account.chainId, blockInput, subtype, index, readers);
    } catch (error) {
      wrapError(error, 'BLOCK_SUBMIT_FAILED', 'submit_block', `Failed to submit ${subtype} block for ${account.address}`, {
        walletName,
        address: account.address,
        subtype,
      }, true);
    }

    received.push({ hash: submitted.txHash, amountRaw: item.amount });
    currentFrontier = submitted.txHash;
    currentBalance = BigInt(newBalance);
    isOpened = true;

    ctx.appendTransaction?.({
      id: generateId(),
      owsWalletId: walletName,
      accountIndex: index,
      address: account.address,
      type: 'receive',
      amountRaw: item.amount,
      counterparty: item.source ?? '',
      hash: submitted.txHash,
      timestamp: new Date().toISOString(),
    });
  }

  await report(ctx, 5, 5, `receive: persisted ${received.length} block(s)`);

  return {
    address: account.address,
    received,
    balanceRaw: currentBalance.toString(),
    balanceXno: rawToNano(currentBalance.toString()),
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
  const sendBlockInput: StateBlockHashInput = {
    accountPublicKey: decodeNanoAddress(account.address).publicKey,
    previous: info.frontier,
    representativePublicKey: decodeNanoAddress(info.representative || DEFAULT_REPRESENTATIVE).publicKey,
    balanceRaw: (currentBalance - BigInt(amountRaw)).toString(),
    link: destinationValidation.publicKey,
  };

  await report(ctx, 3, 4, `send: submitting block for ${account.address}`);
  let submitted;
  try {
    submitted = await signWorkAndProcess(walletName, account.chainId, sendBlockInput, 'send', index, readers);
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
  const changeBlockInput: StateBlockHashInput = {
    accountPublicKey: decodeNanoAddress(account.address).publicKey,
    previous: info.frontier,
    representativePublicKey: repValidation.publicKey,
    balanceRaw: info.balance,
    link: ZERO_32_HEX,
  };

  await report(ctx, 3, 4, `change: submitting block for ${account.address}`);
  let submitted;
  try {
    submitted = await signWorkAndProcess(walletName, account.chainId, changeBlockInput, 'change', index, readers);
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
  readers: NanoReaders,
  txHex: string,
  subtype: 'send' | 'receive' | 'open' | 'change',
  options: { index?: number } = {},
): Promise<SubmitBlockResult> {
  const index = options.index ?? 0;
  const account = await resolveNanoWalletAccount(walletName, index);
  await report(ctx, 1, 2, `submit-block: submitting ${subtype} block for ${account.address}`);

  const blockInput = parseNanoStateBlockHex(txHex);
  let submitted;
  try {
    submitted = await signWorkAndProcess(walletName, account.chainId, blockInput, subtype, index, readers);
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
