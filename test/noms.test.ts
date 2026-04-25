import { describe, it, expect } from 'vitest';
import { NOMS } from '@openrai/nano-core';
import { validateAddress } from '../src/validate';
import { derivePublicKeyLegacy } from '../src/address-legacy';

describe('NOMS (Nano Off-chain Message Signing)', () => {
  it('should sign and verify a message "I am me."', () => {
    const message = 'I am me.';
    const privateKey = '0000000000000000000000000000000000000000000000000000000000000000';
    const publicKey = derivePublicKeyLegacy(privateKey);
    
    const signature = NOMS.signMessage(message, privateKey);
    expect(signature).toBeDefined();
    expect(signature.length).toBe(128); // 64 bytes in hex

    const isValid = NOMS.verifyMessage(message, signature, publicKey);
    expect(isValid).toBe(true);
  });

  it('should verify the example from the user', () => {
    // User example:
    // Signature: 3de8620fb30967916d3dc36cd09eba9a633d1678b986fbc31b70ae2834db25a898085bbce32b744aef42ed56b5c001ffebd5516e78c9f22c678dde2d8bdc150a
    // Message: I am me.
    // Address: nano_1qmbhidbruqqg85rqu9nhd178uo46oocons95ukgaoesp97aes511rrotf3b

    const signature = '3de8620fb30967916d3dc36cd09eba9a633d1678b986fbc31b70ae2834db25a898085bbce32b744aef42ed56b5c001ffebd5516e78c9f22c678dde2d8bdc150a';
    const message = 'I am me.';
    const address = 'nano_1hfrig58wzrg4pzqen17cyannpy1173oi7jz7zd6srjsqjh7ozcgec9uyo9n';

    const v = validateAddress(address);
    expect(v.valid).toBe(true);
    expect(v.publicKey).toBeDefined();

    const isValid = NOMS.verifyMessage(message, signature, v.publicKey!);
    expect(isValid).toBe(true);
  });

  it('should fail verification if message is changed', () => {
    const message = 'I am me.';
    const privateKey = '0000000000000000000000000000000000000000000000000000000000000000';
    const publicKey = '3b65511019678a1007a8124b24e45c70c0bbdec29d3335b2e66e850b694b28c8';
    
    const signature = NOMS.signMessage(message, privateKey);
    const isValid = NOMS.verifyMessage('I am NOT me.', signature, publicKey);
    expect(isValid).toBe(false);
  });
});
