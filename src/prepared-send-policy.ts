import { nanoToRaw } from './convert.js';
import { decodeNanoAddress } from './nano-address.js';
import type { AccountInfoResponse } from './rpc.js';
import type { StateBlockHashInput } from './state-block.js';

export type PreparedBlockSubtype = 'send' | 'receive' | 'open' | 'change';
export type PreparedBlockPolicyErrorCode = 'MAX_SEND_EXCEEDED' | 'INVALID_PREPARED_BLOCK';

export class PreparedBlockPolicyError extends Error {
  constructor(
    readonly code: PreparedBlockPolicyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PreparedBlockPolicyError';
  }
}

export type PreparedBlockPolicyResult = {
  actualSubtype: PreparedBlockSubtype;
  amountRaw?: string;
  maxSendRaw?: string;
};

function invalidPreparedBlock(message: string): never {
  throw new PreparedBlockPolicyError('INVALID_PREPARED_BLOCK', message);
}

/**
 * Enforce prepared-block policy at the signing boundary.
 *
 * block_send intentionally emits an unsigned artifact without applying maxSendXno.
 * This validation must remain in submitPreparedBlock so every signing path, including
 * hand-built hex, is checked immediately before OWS is asked to sign.
 */
export function validatePreparedBlockPolicy(
  block: StateBlockHashInput,
  walletAddress: string,
  accountInfo: AccountInfoResponse | null,
  maxSendXno: string,
  declaredSubtype: PreparedBlockSubtype,
): PreparedBlockPolicyResult {
  const walletPublicKey = decodeNanoAddress(walletAddress).publicKey.toLowerCase();
  if (block.accountPublicKey.toLowerCase() !== walletPublicKey) {
    invalidPreparedBlock('Prepared block account does not match the selected wallet account.');
  }

  if (declaredSubtype === 'open') {
    if (!/^0{64}$/i.test(block.previous)) {
      invalidPreparedBlock('Prepared open block must have a zero previous hash.');
    }
    return { actualSubtype: 'open' };
  }

  if (!accountInfo) {
    invalidPreparedBlock('Account info is required for a prepared block on an opened account.');
  }
  if (block.previous.toLowerCase() !== accountInfo.frontier.toLowerCase()) {
    invalidPreparedBlock('Prepared block is stale; rebuild it from the current frontier.');
  }

  const currentBalance = BigInt(accountInfo.balance);
  const nextBalance = BigInt(block.balanceRaw);
  const actualSubtype: PreparedBlockSubtype =
    nextBalance < currentBalance ? 'send' : nextBalance > currentBalance ? 'receive' : 'change';

  if (declaredSubtype !== actualSubtype) {
    invalidPreparedBlock(`Prepared block balance implies ${actualSubtype}, not declared subtype ${declaredSubtype}.`);
  }

  if (actualSubtype !== 'send') return { actualSubtype };

  const amountRaw = currentBalance - nextBalance;
  const maxSendRaw = BigInt(nanoToRaw(maxSendXno));
  if (amountRaw > maxSendRaw) {
    throw new PreparedBlockPolicyError(
      'MAX_SEND_EXCEEDED',
      `Prepared send amount exceeds maxSendXno (${maxSendXno} XNO).`,
    );
  }

  return { actualSubtype, amountRaw: amountRaw.toString(), maxSendRaw: maxSendRaw.toString() };
}
