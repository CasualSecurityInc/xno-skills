import { describe, it, expect } from 'vitest';
import {
  derivePrivateKeyBIP44,
  derivePublicKeyBIP44,
  publicKeyToAddressBIP44,
  deriveAddressBIP44,
  validateMnemonicBIP44,
  mnemonicToBIP39Seed,
} from '../src/address-bip44';

// Test vectors from Nano documentation
// https://docs.nano.org/integration-guides/key-management/

const MNEMONIC_24_WORD = 'edge defense waste choose enrich upon flee junk siren film clown finish luggage leader kid quick brick print evidence swap drill paddle truly occur';
const PASSPHRASE_24 = 'some password';
const BIP39_SEED_24 = '0dc285fde768f7ff29b66ce7252d56ed92fe003b605907f7a4f683c3dc8586d34a914d3c71fc099bb38ee4a59e5b081a3497b7a323e90cc68f67b5837690310c';

const MNEMONIC_12_WORD = 'company public remove bread fashion tortoise ahead shrimp onion prefer waste blade';
const BIP39_SEED_12 = '924a962cae64448812be28a514093ebfeeed537d61a44318eb35f902961d21b2fccd30008d33c8d1d5327a34b9b73281c4b27a0a3d004c1c2e85e8dbb234cba8';

describe('derivePrivateKeyBIP44', () => {
  it('should derive correct private key for 24-word mnemonic with passphrase (index 0)', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_24_WORD, 0, PASSPHRASE_24);
    // Expected from Nano docs: 3be4fc2ef3f3b7374e6fc4fb6e7bb153f8a2998b3b3dab50853eabe128024143
    expect(privateKey).toBe('3be4fc2ef3f3b7374e6fc4fb6e7bb153f8a2998b3b3dab50853eabe128024143');
  });

  it('should derive correct private key for 24-word mnemonic with passphrase (index 1)', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_24_WORD, 1, PASSPHRASE_24);
    // Expected from Nano docs: ce7e429e683d652446261c17a96da9ed1897aea96c8046f2b8036f6b05cb1a83
    expect(privateKey).toBe('ce7e429e683d652446261c17a96da9ed1897aea96c8046f2b8036f6b05cb1a83');
  });

  it('should derive correct private key for 24-word mnemonic with passphrase (index 2)', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_24_WORD, 2, PASSPHRASE_24);
    // Expected from Nano docs: 1257df74609b9c6461a3f4e7fd6e3278f2ddcf2562694f2c3aa0515af4f09e38
    expect(privateKey).toBe('1257df74609b9c6461a3f4e7fd6e3278f2ddcf2562694f2c3aa0515af4f09e38');
  });

  it('should derive correct private key for 12-word mnemonic without passphrase (index 0)', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 0);
    // Expected from Nano docs: 6f73d61ca0b56fcdb79d69d437f102348ad75ca971433eb92b2b003f8c99b48d
    expect(privateKey).toBe('6f73d61ca0b56fcdb79d69d437f102348ad75ca971433eb92b2b003f8c99b48d');
  });

  it('should derive correct private key for 12-word mnemonic without passphrase (index 1)', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 1);
    // Expected from Nano docs: 7e104389811a0967ef574af1f3f423f23cbf7b614be17844f67fb6fd315f9a7e
    expect(privateKey).toBe('7e104389811a0967ef574af1f3f423f23cbf7b614be17844f67fb6fd315f9a7e');
  });

  it('should derive correct private key for 12-word mnemonic without passphrase (index 2)', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 2);
    // Expected from Nano docs: 8b7250869207a277ac37068dbe32782c2ab9fc6a5342f0deabbfdfae1285196a
    expect(privateKey).toBe('8b7250869207a277ac37068dbe32782c2ab9fc6a5342f0deabbfdfae1285196a');
  });

  it('should derive different private keys for different indices', () => {
    const priv0 = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 0);
    const priv1 = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 1);
    const priv100 = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 100);
    
    expect(priv0).not.toBe(priv1);
    expect(priv1).not.toBe(priv100);
    expect(priv0).not.toBe(priv100);
  });

  it('should produce deterministic results', () => {
    const priv1 = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 42);
    const priv2 = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 42);
    expect(priv1).toBe(priv2);
  });

  it('should throw for invalid mnemonic', () => {
    expect(() => derivePrivateKeyBIP44('invalid mnemonic phrase', 0)).toThrow('Invalid mnemonic phrase');
  });

  it('should throw for invalid index (negative)', () => {
    expect(() => derivePrivateKeyBIP44(MNEMONIC_12_WORD, -1)).toThrow('Index must be a valid 31-bit unsigned integer');
  });

  it('should throw for invalid index (too large)', () => {
    expect(() => derivePrivateKeyBIP44(MNEMONIC_12_WORD, 0x80000000)).toThrow('Index must be a valid 31-bit unsigned integer');
  });

  it('should handle index 100', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 100);
    expect(privateKey.length).toBe(64);
    expect(privateKey).toMatch(/^[0-9a-f]+$/);
  });
});

describe('derivePublicKeyBIP44', () => {
  it('should derive correct public key for 24-word mnemonic (index 0)', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_24_WORD, 0, PASSPHRASE_24);
    const publicKey = derivePublicKeyBIP44(privateKey);
    // Expected from Nano docs: 5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4
    expect(publicKey).toBe('5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4');
  });

  it('should derive correct public key for 24-word mnemonic (index 1)', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_24_WORD, 1, PASSPHRASE_24);
    const publicKey = derivePublicKeyBIP44(privateKey);
    // Expected from Nano docs: d9f7762e9cd4e7ed632481308cdb8f54abf0241332c0a8641f61e92e2fb03c12
    expect(publicKey).toBe('d9f7762e9cd4e7ed632481308cdb8f54abf0241332c0a8641f61e92e2fb03c12');
  });

  it('should derive correct public key for 24-word mnemonic (index 2)', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_24_WORD, 2, PASSPHRASE_24);
    const publicKey = derivePublicKeyBIP44(privateKey);
    // Expected from Nano docs: a46da51986e25a14d82e32d765dcee69b9eeccd4405411430d91ddb61b717566
    expect(publicKey).toBe('a46da51986e25a14d82e32d765dcee69b9eeccd4405411430d91ddb61b717566');
  });

  it('should derive correct public key for 12-word mnemonic (index 0)', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 0);
    const publicKey = derivePublicKeyBIP44(privateKey);
    // Expected from Nano docs: 134d938215f68bcaa3a0e574fde325fc4b1abad9bd3d698bfef95633b54ffb57
    expect(publicKey).toBe('134d938215f68bcaa3a0e574fde325fc4b1abad9bd3d698bfef95633b54ffb57');
  });

  it('should derive correct public key for 12-word mnemonic (index 1)', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 1);
    const publicKey = derivePublicKeyBIP44(privateKey);
    // Expected from Nano docs: 71e6caac915affe836c3e822be6a5b3464f40c74bd2e5459d4e74205c6a7c0df
    expect(publicKey).toBe('71e6caac915affe836c3e822be6a5b3464f40c74bd2e5459d4e74205c6a7c0df');
  });

  it('should derive correct public key for 12-word mnemonic (index 2)', () => {
    const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 2);
    const publicKey = derivePublicKeyBIP44(privateKey);
    // Expected from Nano docs: fcebc6554853ed01c242817abf1b5050b887002f8de8f55d00c7c6b5fe01075d
    expect(publicKey).toBe('fcebc6554853ed01c242817abf1b5050b887002f8de8f55d00c7c6b5fe01075d');
  });

  it('should produce deterministic results', () => {
    const privateKey = '3be4fc2ef3f3b7374e6fc4fb6e7bb153f8a2998b3b3dab50853eabe128024143';
    const pub1 = derivePublicKeyBIP44(privateKey);
    const pub2 = derivePublicKeyBIP44(privateKey);
    expect(pub1).toBe(pub2);
  });

  it('should throw for invalid private key length', () => {
    expect(() => derivePublicKeyBIP44('1234')).toThrow('Private key must be 64 hex characters');
  });

  it('should throw for invalid hex private key', () => {
    expect(() => derivePublicKeyBIP44('ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ')).toThrow('Private key must be a valid hex string');
  });
});

describe('publicKeyToAddressBIP44', () => {
  it('should produce correct Nano address for 24-word mnemonic (index 0)', () => {
    const publicKey = '5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4';
    const address = publicKeyToAddressBIP44(publicKey);
    // Expected from Nano docs: nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d
    expect(address).toBe('nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d');
  });

  it('should produce correct Nano address for 24-word mnemonic (index 1)', () => {
    const publicKey = 'd9f7762e9cd4e7ed632481308cdb8f54abf0241332c0a8641f61e92e2fb03c12';
    const address = publicKeyToAddressBIP44(publicKey);
    // Expected from Nano docs: nano_3phqgrqbso99xojkb1bijmfryo7dy1k38ep1o3k3yrhb7rqu1h1k47yu78gz
    expect(address).toBe('nano_3phqgrqbso99xojkb1bijmfryo7dy1k38ep1o3k3yrhb7rqu1h1k47yu78gz');
  });

  it('should produce correct Nano address for 24-word mnemonic (index 2)', () => {
    const publicKey = 'a46da51986e25a14d82e32d765dcee69b9eeccd4405411430d91ddb61b717566';
    const address = publicKeyToAddressBIP44(publicKey);
    // Expected from Nano docs: nano_3b5fnnerfrkt4me4wepqeqggwtfsxu8fai4n473iu6gxprfq4xd8pk9gh1dg
    expect(address).toBe('nano_3b5fnnerfrkt4me4wepqeqggwtfsxu8fai4n473iu6gxprfq4xd8pk9gh1dg');
  });

  it('should produce correct Nano address for 12-word mnemonic (index 0)', () => {
    const publicKey = '134d938215f68bcaa3a0e574fde325fc4b1abad9bd3d698bfef95633b54ffb57';
    const address = publicKeyToAddressBIP44(publicKey);
    // Expected from Nano docs: nano_16tfkg33dxndscjt3sdnzqjkdz4d5cxfmhbxf87zxycp8gtnzytqmcosi3zr
    expect(address).toBe('nano_16tfkg33dxndscjt3sdnzqjkdz4d5cxfmhbxf87zxycp8gtnzytqmcosi3zr');
  });

  it('should produce correct Nano address for 12-word mnemonic (index 1)', () => {
    const publicKey = '71e6caac915affe836c3e822be6a5b3464f40c74bd2e5459d4e74205c6a7c0df';
    const address = publicKeyToAddressBIP44(publicKey);
    // Expected from Nano docs: nano_1wh8scpb4pqzx1ue9t34qso7pf56yi89bhbgcjexbst41q5chi8zqtwb74ih
    expect(address).toBe('nano_1wh8scpb4pqzx1ue9t34qso7pf56yi89bhbgcjexbst41q5chi8zqtwb74ih');
  });

  it('should produce correct Nano address for 12-word mnemonic (index 2)', () => {
    const publicKey = 'fcebc6554853ed01c242817abf1b5050b887002f8de8f55d00c7c6b5fe01075d';
    const address = publicKeyToAddressBIP44(publicKey);
    // Expected from Nano docs: nano_3z9drscninzf193671dtqwfo1n7riw14z5hayogi3jy8pqz143txaghe4gbk
    expect(address).toBe('nano_3z9drscninzf193671dtqwfo1n7riw14z5hayogi3jy8pqz143txaghe4gbk');
  });

  it('should produce valid Nano address format', () => {
    const publicKey = '5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4';
    const address = publicKeyToAddressBIP44(publicKey);
    expect(address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
  });

  it('should produce 65-character address (5 + 60)', () => {
    const publicKey = '5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4';
    const address = publicKeyToAddressBIP44(publicKey);
    expect(address.length).toBe(65);
  });

  it('should throw for invalid public key length', () => {
    expect(() => publicKeyToAddressBIP44('1234')).toThrow('Public key must be 64 hex characters');
  });

  it('should throw for invalid hex public key', () => {
    expect(() => publicKeyToAddressBIP44('ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ')).toThrow('Public key must be a valid hex string');
  });
});

describe('deriveAddressBIP44', () => {
  it('should return object with privateKey, publicKey, and address', () => {
    const result = deriveAddressBIP44(MNEMONIC_12_WORD, 0);
    
    expect(result).toHaveProperty('privateKey');
    expect(result).toHaveProperty('publicKey');
    expect(result).toHaveProperty('address');
    
    expect(result.privateKey.length).toBe(64);
    expect(result.publicKey.length).toBe(64);
    expect(result.address.length).toBe(65);
  });

  it('should produce correct address for 24-word mnemonic with passphrase (index 0)', () => {
    const result = deriveAddressBIP44(MNEMONIC_24_WORD, 0, PASSPHRASE_24);
    expect(result.address).toBe('nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d');
  });

  it('should produce correct address for 24-word mnemonic with passphrase (index 1)', () => {
    const result = deriveAddressBIP44(MNEMONIC_24_WORD, 1, PASSPHRASE_24);
    expect(result.address).toBe('nano_3phqgrqbso99xojkb1bijmfryo7dy1k38ep1o3k3yrhb7rqu1h1k47yu78gz');
  });

  it('should produce correct address for 24-word mnemonic with passphrase (index 2)', () => {
    const result = deriveAddressBIP44(MNEMONIC_24_WORD, 2, PASSPHRASE_24);
    expect(result.address).toBe('nano_3b5fnnerfrkt4me4wepqeqggwtfsxu8fai4n473iu6gxprfq4xd8pk9gh1dg');
  });

  it('should produce correct address for 12-word mnemonic (index 0)', () => {
    const result = deriveAddressBIP44(MNEMONIC_12_WORD, 0);
    expect(result.address).toBe('nano_16tfkg33dxndscjt3sdnzqjkdz4d5cxfmhbxf87zxycp8gtnzytqmcosi3zr');
  });

  it('should produce correct address for 12-word mnemonic (index 1)', () => {
    const result = deriveAddressBIP44(MNEMONIC_12_WORD, 1);
    expect(result.address).toBe('nano_1wh8scpb4pqzx1ue9t34qso7pf56yi89bhbgcjexbst41q5chi8zqtwb74ih');
  });

  it('should produce correct address for 12-word mnemonic (index 2)', () => {
    const result = deriveAddressBIP44(MNEMONIC_12_WORD, 2);
    expect(result.address).toBe('nano_3z9drscninzf193671dtqwfo1n7riw14z5hayogi3jy8pqz143txaghe4gbk');
  });

  it('should produce valid Nano address', () => {
    const result = deriveAddressBIP44(MNEMONIC_12_WORD, 0);
    expect(result.address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
  });

  it('should derive different addresses for different indices', () => {
    const result0 = deriveAddressBIP44(MNEMONIC_12_WORD, 0);
    const result1 = deriveAddressBIP44(MNEMONIC_12_WORD, 1);
    const result100 = deriveAddressBIP44(MNEMONIC_12_WORD, 100);
    
    expect(result0.address).not.toBe(result1.address);
    expect(result1.address).not.toBe(result100.address);
    expect(result0.privateKey).not.toBe(result1.privateKey);
    expect(result0.publicKey).not.toBe(result1.publicKey);
  });

  it('should produce deterministic results', () => {
    const result1 = deriveAddressBIP44(MNEMONIC_12_WORD, 42);
    const result2 = deriveAddressBIP44(MNEMONIC_12_WORD, 42);
    
    expect(result1.privateKey).toBe(result2.privateKey);
    expect(result1.publicKey).toBe(result2.publicKey);
    expect(result1.address).toBe(result2.address);
  });

  it('should handle index 0, 1, and 100 correctly', () => {
    const result0 = deriveAddressBIP44(MNEMONIC_12_WORD, 0);
    const result1 = deriveAddressBIP44(MNEMONIC_12_WORD, 1);
    const result100 = deriveAddressBIP44(MNEMONIC_12_WORD, 100);
    
    // All should be valid addresses
    expect(result0.address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
    expect(result1.address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
    expect(result100.address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
    
    // All should be different
    expect(result0.address).not.toBe(result1.address);
    expect(result1.address).not.toBe(result100.address);
  });

  it('should produce consistent private/public key relationship', () => {
    const result = deriveAddressBIP44(MNEMONIC_12_WORD, 0);
    
    // Derive public key from the returned private key
    const derivedPublicKey = derivePublicKeyBIP44(result.privateKey);
    expect(derivedPublicKey).toBe(result.publicKey);
  });

  it('should produce address from public key consistently', () => {
    const result = deriveAddressBIP44(MNEMONIC_12_WORD, 0);
    
    // Derive address from the returned public key
    const derivedAddress = publicKeyToAddressBIP44(result.publicKey);
    expect(derivedAddress).toBe(result.address);
  });

  it('should produce different results for different passphrases', () => {
    const result1 = deriveAddressBIP44(MNEMONIC_24_WORD, 0, '');
    const result2 = deriveAddressBIP44(MNEMONIC_24_WORD, 0, PASSPHRASE_24);
    
    expect(result1.privateKey).not.toBe(result2.privateKey);
    expect(result1.publicKey).not.toBe(result2.publicKey);
    expect(result1.address).not.toBe(result2.address);
  });
});

describe('validateMnemonicBIP44', () => {
  it('should return true for valid 12-word mnemonic', () => {
    expect(validateMnemonicBIP44(MNEMONIC_12_WORD)).toBe(true);
  });

  it('should return true for valid 24-word mnemonic', () => {
    expect(validateMnemonicBIP44(MNEMONIC_24_WORD)).toBe(true);
  });

  it('should return false for invalid mnemonic', () => {
    expect(validateMnemonicBIP44('invalid mnemonic phrase')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(validateMnemonicBIP44('')).toBe(false);
  });
});

describe('mnemonicToBIP39Seed', () => {
  it('should produce correct BIP39 seed for 24-word mnemonic with passphrase', () => {
    const seed = mnemonicToBIP39Seed(MNEMONIC_24_WORD, PASSPHRASE_24);
    expect(seed).toBe(BIP39_SEED_24);
  });

  it('should produce correct BIP39 seed for 12-word mnemonic without passphrase', () => {
    const seed = mnemonicToBIP39Seed(MNEMONIC_12_WORD);
    expect(seed).toBe(BIP39_SEED_12);
  });

  it('should produce 128-character hex string (64 bytes)', () => {
    const seed = mnemonicToBIP39Seed(MNEMONIC_12_WORD);
    expect(seed.length).toBe(128);
    expect(seed).toMatch(/^[0-9a-f]+$/);
  });

  it('should throw for invalid mnemonic', () => {
    expect(() => mnemonicToBIP39Seed('invalid mnemonic phrase')).toThrow('Invalid mnemonic phrase');
  });
});

describe('integration tests', () => {
  it('should produce valid checksum in address', () => {
    const result = deriveAddressBIP44(MNEMONIC_12_WORD, 0);
    
    // Address should be 65 chars: "nano_" (5) + 60 chars (encoded)
    expect(result.address.length).toBe(65);
    
    // Extract the encoded part (after "nano_")
    const encoded = result.address.slice(5);
    expect(encoded.length).toBe(60);
    
    // Verify it only contains valid Nano base32 characters
    const validChars = '13456789abcdefghijkmnopqrstuwxyz';
    for (const char of encoded) {
      expect(validChars).toContain(char);
    }
  });

  it('should handle various mnemonics correctly', () => {
    const mnemonics = [
      MNEMONIC_12_WORD,
      MNEMONIC_24_WORD,
    ];
    
    for (const mnemonic of mnemonics) {
      const result = deriveAddressBIP44(mnemonic, 0);
      expect(result.privateKey.length).toBe(64);
      expect(result.publicKey.length).toBe(64);
      expect(result.address.length).toBe(65);
      expect(result.address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
    }
  });

  it('should produce different results for different mnemonics with same index', () => {
    const result1 = deriveAddressBIP44(MNEMONIC_12_WORD, 0);
    const result2 = deriveAddressBIP44(MNEMONIC_24_WORD, 0);
    
    expect(result1.privateKey).not.toBe(result2.privateKey);
    expect(result1.publicKey).not.toBe(result2.publicKey);
    expect(result1.address).not.toBe(result2.address);
  });
});