import { describe, it, expect } from 'vitest';
import { NOMS } from '@openrai/nano-core';
import { verifyNanoMessage } from '../src/nano-actions';
import { nanoGetPublicKeyFromPrivateKey } from '../src/ed25519-blake2b';
import { publicKeyToNanoAddress } from '../src/nano-address';

// `verify` advertised "Verify a NOMS message signature" and threw
// MESSAGE_VERIFY_UNSUPPORTED for every input ("no canonical standard exists"), while NOMS is
// implemented in this repo's own dependency and used by sign and by this suite. The function
// now verifies via NOMS.Reported as pursekeeper skill item 5 / initiative #6.
const PRIVATE_KEY = '0000000000000000000000000000000000000000000000000000000000000000';
const MESSAGE = 'I am me.';

describe('verifyNanoMessage — NOMS verification', () => {
  it('verifies a signature produced by the same toolkit', () => {
    const publicKey = nanoGetPublicKeyFromPrivateKey(PRIVATE_KEY);
    const signature = NOMS.signMessage(MESSAGE, PRIVATE_KEY);
    const result = verifyNanoMessage(publicKey, MESSAGE, signature);
    expect(result.valid).toBe(true);
  });

  it('verifies a signature against a nano_ address, not just a bare public key', () => {
    const publicKey = nanoGetPublicKeyFromPrivateKey(PRIVATE_KEY);
    const signature = NOMS.signMessage(MESSAGE, PRIVATE_KEY);
    // Round-trip via the address form of the same key.
    const address = publicKeyToNanoAddress(publicKey);
    const result = verifyNanoMessage(address, MESSAGE, signature);
    expect(result.valid).toBe(true);
  });

  it('rejects a signature over a different message', () => {
    const publicKey = nanoGetPublicKeyFromPrivateKey(PRIVATE_KEY);
    const signature = NOMS.signMessage(MESSAGE, PRIVATE_KEY);
    const result = verifyNanoMessage(publicKey, 'I am NOT me.', signature);
    expect(result.valid).toBe(false);
  });

  it('rejects a well-formed but wrong signature', () => {
    const publicKey = nanoGetPublicKeyFromPrivateKey(PRIVATE_KEY);
    const result = verifyNanoMessage(publicKey, MESSAGE, 'a'.repeat(128));
    expect(result.valid).toBe(false);
  });

  it('does not claim to be unable to verify — no MESSAGE_VERIFY_UNSUPPORTED for a valid input', () => {
    const publicKey = nanoGetPublicKeyFromPrivateKey(PRIVATE_KEY);
    const signature = NOMS.signMessage(MESSAGE, PRIVATE_KEY);
    // The defect was a thrown MESSAGE_VERIFY_UNSUPPORTED here.
    expect(() => verifyNanoMessage(publicKey, MESSAGE, signature)).not.toThrow();
  });

  it('rejects a signature that is not 128 hex', () => {
    const publicKey = nanoGetPublicKeyFromPrivateKey(PRIVATE_KEY);
    expect(() => verifyNanoMessage(publicKey, MESSAGE, 'abc')).toThrow(/128 hex/i);
  });

  it('still rejects a bad address', () => {
    const signature = NOMS.signMessage(MESSAGE, PRIVATE_KEY);
    expect(() => verifyNanoMessage('not-an-address', MESSAGE, signature)).toThrow(/Invalid address/i);
  });
});
