import { blake2b } from '@noble/hashes/blake2b.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { ed25519 } from '@noble/curves/ed25519.js';

const ED25519_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');

function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let n = 0n;
  for (let i = 0; i < bytes.length; i++) {
    n += BigInt(bytes[i]) << BigInt(8 * i);
  }
  return n;
}

function bigIntToBytesLE(n: bigint, length: number): Uint8Array {
  if (n < 0n) throw new Error('Negative bigint not supported');
  const out = new Uint8Array(length);
  let x = n;
  for (let i = 0; i < length; i++) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  if (x !== 0n) throw new Error(`Bigint does not fit in ${length} bytes`);
  return out;
}

function modL(n: bigint): bigint {
  const x = n % ED25519_ORDER;
  return x < 0n ? x + ED25519_ORDER : x;
}

function hash512(...parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const msg = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    msg.set(p, o);
    o += p.length;
  }
  return blake2b(msg, { dkLen: 64 });
}

function expandSecretKey(privateKey32: Uint8Array): { scalar: bigint; prefix: Uint8Array; publicKey: Uint8Array } {
  if (privateKey32.length !== 32) throw new Error('Private key must be 32 bytes');

  const h = blake2b(privateKey32, { dkLen: 64 });
  const aBytes = new Uint8Array(h.slice(0, 32));
  aBytes[0] &= 248;
  aBytes[31] &= 127;
  aBytes[31] |= 64;

  let scalar = bytesToBigIntLE(aBytes);
  if (scalar === 0n || scalar >= ED25519_ORDER) {
    scalar = scalar % ED25519_ORDER;
    if (scalar === 0n) scalar = 1n;
  }
  const prefix = new Uint8Array(h.slice(32, 64));
  const publicKey = ed25519.Point.BASE.multiply(scalar).toBytes();

  return { scalar, prefix, publicKey };
}

export function nanoGetPublicKeyFromPrivateKey(privateKeyHex: string): string {
  const sk = hexToBytes(privateKeyHex);
  if (sk.length !== 32) throw new Error('Private key must be 32 bytes (64 hex characters)');
  const { publicKey } = expandSecretKey(sk);
  return bytesToHex(publicKey);
}

export function nanoSignBlake2b(message32: Uint8Array, privateKeyHex: string): string {
  if (!(message32 instanceof Uint8Array) || message32.length !== 32) {
    throw new Error('Message must be a 32-byte digest (block hash)');
  }

  const sk = hexToBytes(privateKeyHex);
  if (sk.length !== 32) throw new Error('Private key must be 32 bytes (64 hex characters)');

  const { scalar: a, prefix, publicKey: A } = expandSecretKey(sk);

  const r = modL(bytesToBigIntLE(hash512(prefix, message32)));
  const R = ed25519.Point.BASE.multiply(r).toBytes();

  const k = modL(bytesToBigIntLE(hash512(R, A, message32)));
  const S = modL(r + k * a);

  const sig = new Uint8Array(64);
  sig.set(R, 0);
  sig.set(bigIntToBytesLE(S, 32), 32);
  return bytesToHex(sig);
}

export function nanoVerifyBlake2b(message32: Uint8Array, signatureHex: string, publicKeyHex: string): boolean {
  try {
    if (!(message32 instanceof Uint8Array) || message32.length !== 32) return false;

    const sig = hexToBytes(signatureHex);
    if (sig.length !== 64) return false;

    const pk = hexToBytes(publicKeyHex);
    if (pk.length !== 32) return false;

    const Rbytes = sig.slice(0, 32);
    const Sbytes = sig.slice(32, 64);
    const S = bytesToBigIntLE(Sbytes);
    if (S >= ED25519_ORDER) return false;

    const R = ed25519.Point.fromHex(bytesToHex(Rbytes));
    const A = ed25519.Point.fromHex(bytesToHex(pk));

    const k = modL(bytesToBigIntLE(hash512(Rbytes, pk, message32)));
    const SB = ed25519.Point.BASE.multiply(S);
    const RpluskA = R.add(A.multiply(k));
    return SB.equals(RpluskA);
  } catch {
    return false;
  }
}
