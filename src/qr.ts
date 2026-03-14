import qrcode from 'qrcode-terminal';
import { nanoToRaw } from './convert.js';

function normalizeAmount(amount?: string | number): string | undefined {
  if (amount === undefined || amount === null) {
    return undefined;
  }

  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) {
      throw new Error('Invalid Nano amount');
    }

    const asString = amount.toString();
    if (!/[eE]/.test(asString)) {
      return asString;
    }

    const fixed = amount.toFixed(30).replace(/\.?0+$/, '');
    return fixed === '' ? '0' : fixed;
  }

  const trimmed = amount.trim();
  return trimmed === '' ? undefined : trimmed;
}

function formatNanoUri(address: string, amount?: string | number): string {
  let uri = `nano:${address}`;
  const amountString = normalizeAmount(amount);

  if (amountString) {
    const rawAmount = nanoToRaw(amountString);
    if (rawAmount !== '0') {
      uri += `?amount=${rawAmount}`;
    }
  }

  return uri;
}

export function buildNanoUri(address: string, amount?: string | number): string {
  return formatNanoUri(address, amount);
}

export function generateAsciiQr(address: string, amount?: string | number): Promise<string> {
  const uri = formatNanoUri(address, amount);

  return new Promise((resolve, reject) => {
    try {
      qrcode.generate(uri, { small: true }, (qrcodeString) => {
        resolve(qrcodeString);
      });
    } catch (error) {
      reject(error);
    }
  });
}
