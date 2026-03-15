import { describe, it, expect } from 'vitest';
import { nanoGetPublicKeyFromPrivateKey, nanoSignBlake2b, nanoVerifyBlake2b } from '../src/ed25519-blake2b';
import { derivePublicKeyLegacy } from '../src/address-legacy';
import { hashNanoStateBlockHex } from '../src/state-block';

describe('ed25519-blake2b (Nano)', () => {
  it('matches existing public key derivation', () => {
    const privateKey = '0000000000000000000000000000000000000000000000000000000000000000';
    expect(nanoGetPublicKeyFromPrivateKey(privateKey)).toBe(derivePublicKeyLegacy(privateKey));
  });

  it('signs and verifies a 32-byte digest', () => {
    const privateKey = '0000000000000000000000000000000000000000000000000000000000000000';
    const publicKey = nanoGetPublicKeyFromPrivateKey(privateKey);
    const msgHex = hashNanoStateBlockHex({
      accountPublicKey: publicKey,
      previous: '0'.repeat(64),
      representativePublicKey: publicKey,
      balanceRaw: '0',
      link: '0'.repeat(64),
    });
    const msg = Buffer.from(msgHex, 'hex');

    const sig = nanoSignBlake2b(msg, privateKey);
    expect(sig).toMatch(/^[0-9a-f]{128}$/i);
    expect(nanoVerifyBlake2b(msg, sig, publicKey)).toBe(true);

    const msg2 = Buffer.from(hashNanoStateBlockHex({
      accountPublicKey: publicKey,
      previous: '0'.repeat(64),
      representativePublicKey: publicKey,
      balanceRaw: '1',
      link: '0'.repeat(64),
    }), 'hex');
    expect(nanoVerifyBlake2b(msg2, sig, publicKey)).toBe(false);
  });
});

