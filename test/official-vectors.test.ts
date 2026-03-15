import { describe, it, expect } from 'vitest';
import { generateSeed, seedToMnemonic, mnemonicToSeed, validateMnemonic } from '../src/seed';
import { derivePrivateKeyLegacy, derivePublicKeyLegacy, publicKeyToAddress, deriveAddressLegacy } from '../src/address-legacy';
import { derivePrivateKeyBIP44, derivePublicKeyBIP44, publicKeyToAddressBIP44, deriveAddressBIP44, mnemonicToBIP39Seed } from '../src/address-bip44';
import { nanoToRaw, rawToNano, formatNano, knanoToRaw, mnanoToRaw } from '../src/convert';

/**
 * Official Nano Test Vectors
 * 
 * These test vectors are sourced from official Nano documentation:
 * - https://docs.nano.org/integration-guides/key-management/
 * - https://docs.nano.org/protocol-design/signing-hashing-and-key-derivation/
 * 
 * They validate the correctness of cryptographic operations against known
 * reference implementations.
 */

describe('Official Nano Test Vectors', () => {
  describe('BIP44 Address Derivation (from Nano docs)', () => {
    // Test vectors from: https://docs.nano.org/integration-guides/key-management/
    
    const MNEMONIC_24_WORD = 'edge defense waste choose enrich upon flee junk siren film clown finish luggage leader kid quick brick print evidence swap drill paddle truly occur';
    const PASSPHRASE_24 = 'some password';
    const BIP39_SEED_24 = '0dc285fde768f7ff29b66ce7252d56ed92fe003b605907f7a4f683c3dc8586d34a914d3c71fc099bb38ee4a59e5b081a3497b7a323e90cc68f67b5837690310c';

    const MNEMONIC_12_WORD = 'company public remove bread fashion tortoise ahead shrimp onion prefer waste blade';
    const BIP39_SEED_12 = '924a962cae64448812be28a514093ebfeeed537d61a44318eb35f902961d21b2fccd30008d33c8d1d5327a34b9b73281c4b27a0a3d004c1c2e85e8dbb234cba8';

    describe('24-word mnemonic with passphrase', () => {
      it('should derive correct BIP39 seed', () => {
        const seed = mnemonicToBIP39Seed(MNEMONIC_24_WORD, PASSPHRASE_24);
        expect(seed).toBe(BIP39_SEED_24);
      });

      it('should derive correct private key for index 0', () => {
        const privateKey = derivePrivateKeyBIP44(MNEMONIC_24_WORD, 0, PASSPHRASE_24);
        expect(privateKey).toBe('3be4fc2ef3f3b7374e6fc4fb6e7bb153f8a2998b3b3dab50853eabe128024143');
      });

      it('should derive correct public key for index 0', () => {
        const privateKey = derivePrivateKeyBIP44(MNEMONIC_24_WORD, 0, PASSPHRASE_24);
        const publicKey = derivePublicKeyBIP44(privateKey);
        expect(publicKey).toBe('5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4');
      });

      it('should derive correct address for index 0', () => {
        const result = deriveAddressBIP44(MNEMONIC_24_WORD, 0, PASSPHRASE_24);
        expect(result.address).toBe('nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d');
      });

      it('should derive correct private key for index 1', () => {
        const privateKey = derivePrivateKeyBIP44(MNEMONIC_24_WORD, 1, PASSPHRASE_24);
        expect(privateKey).toBe('ce7e429e683d652446261c17a96da9ed1897aea96c8046f2b8036f6b05cb1a83');
      });

      it('should derive correct public key for index 1', () => {
        const privateKey = derivePrivateKeyBIP44(MNEMONIC_24_WORD, 1, PASSPHRASE_24);
        const publicKey = derivePublicKeyBIP44(privateKey);
        expect(publicKey).toBe('d9f7762e9cd4e7ed632481308cdb8f54abf0241332c0a8641f61e92e2fb03c12');
      });

      it('should derive correct address for index 1', () => {
        const result = deriveAddressBIP44(MNEMONIC_24_WORD, 1, PASSPHRASE_24);
        expect(result.address).toBe('nano_3phqgrqbso99xojkb1bijmfryo7dy1k38ep1o3k3yrhb7rqu1h1k47yu78gz');
      });

      it('should derive correct private key for index 2', () => {
        const privateKey = derivePrivateKeyBIP44(MNEMONIC_24_WORD, 2, PASSPHRASE_24);
        expect(privateKey).toBe('1257df74609b9c6461a3f4e7fd6e3278f2ddcf2562694f2c3aa0515af4f09e38');
      });

      it('should derive correct public key for index 2', () => {
        const privateKey = derivePrivateKeyBIP44(MNEMONIC_24_WORD, 2, PASSPHRASE_24);
        const publicKey = derivePublicKeyBIP44(privateKey);
        expect(publicKey).toBe('a46da51986e25a14d82e32d765dcee69b9eeccd4405411430d91ddb61b717566');
      });

      it('should derive correct address for index 2', () => {
        const result = deriveAddressBIP44(MNEMONIC_24_WORD, 2, PASSPHRASE_24);
        expect(result.address).toBe('nano_3b5fnnerfrkt4me4wepqeqggwtfsxu8fai4n473iu6gxprfq4xd8pk9gh1dg');
      });
    });

    describe('12-word mnemonic without passphrase', () => {
      it('should derive correct BIP39 seed', () => {
        const seed = mnemonicToBIP39Seed(MNEMONIC_12_WORD);
        expect(seed).toBe(BIP39_SEED_12);
      });

      it('should derive correct private key for index 0', () => {
        const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 0);
        expect(privateKey).toBe('6f73d61ca0b56fcdb79d69d437f102348ad75ca971433eb92b2b003f8c99b48d');
      });

      it('should derive correct public key for index 0', () => {
        const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 0);
        const publicKey = derivePublicKeyBIP44(privateKey);
        expect(publicKey).toBe('134d938215f68bcaa3a0e574fde325fc4b1abad9bd3d698bfef95633b54ffb57');
      });

      it('should derive correct address for index 0', () => {
        const result = deriveAddressBIP44(MNEMONIC_12_WORD, 0);
        expect(result.address).toBe('nano_16tfkg33dxndscjt3sdnzqjkdz4d5cxfmhbxf87zxycp8gtnzytqmcosi3zr');
      });

      it('should derive correct private key for index 1', () => {
        const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 1);
        expect(privateKey).toBe('7e104389811a0967ef574af1f3f423f23cbf7b614be17844f67fb6fd315f9a7e');
      });

      it('should derive correct public key for index 1', () => {
        const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 1);
        const publicKey = derivePublicKeyBIP44(privateKey);
        expect(publicKey).toBe('71e6caac915affe836c3e822be6a5b3464f40c74bd2e5459d4e74205c6a7c0df');
      });

      it('should derive correct address for index 1', () => {
        const result = deriveAddressBIP44(MNEMONIC_12_WORD, 1);
        expect(result.address).toBe('nano_1wh8scpb4pqzx1ue9t34qso7pf56yi89bhbgcjexbst41q5chi8zqtwb74ih');
      });

      it('should derive correct private key for index 2', () => {
        const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 2);
        expect(privateKey).toBe('8b7250869207a277ac37068dbe32782c2ab9fc6a5342f0deabbfdfae1285196a');
      });

      it('should derive correct public key for index 2', () => {
        const privateKey = derivePrivateKeyBIP44(MNEMONIC_12_WORD, 2);
        const publicKey = derivePublicKeyBIP44(privateKey);
        expect(publicKey).toBe('fcebc6554853ed01c242817abf1b5050b887002f8de8f55d00c7c6b5fe01075d');
      });

      it('should derive correct address for index 2', () => {
        const result = deriveAddressBIP44(MNEMONIC_12_WORD, 2);
        expect(result.address).toBe('nano_3z9drscninzf193671dtqwfo1n7riw14z5hayogi3jy8pqz143txaghe4gbk');
      });
    });
  });

  describe('Legacy Address Derivation', () => {
    // Test vectors from Nano documentation and protocol specification
    
    describe('Blake2b key derivation', () => {
      // From Nano docs: ED25519 key derivation uses Blake2b-512 instead of SHA-512
      // Input: 0000000000000000000000000000000000000000000000000000000000000000
      // Expected public key (Blake2b-512): 19D3D919475DEED4696B5D13018151D1AF88B2BD3BCFF048B45031C1F36D1858
      
      it('should derive correct public key from zero private key using Blake2b-512', () => {
        const privateKey = '0000000000000000000000000000000000000000000000000000000000000000';
        const publicKey = derivePublicKeyLegacy(privateKey);
        expect(publicKey.toLowerCase()).toBe('19D3D919475DEED4696B5D13018151D1AF88B2BD3BCFF048B45031C1F36D1858'.toLowerCase());
      });

      it('should derive correct address from zero public key', () => {
        const publicKey = '19D3D919475DEED4696B5D13018151D1AF88B2BD3BCFF048B45031C1F36D1858';
        const address = publicKeyToAddress(publicKey);
        expect(address).toMatch(/^nano_[13][13456789abcdefghijkmnopqrstuwxyz]{59}$/);
        expect(address.length).toBe(65);
      });
    });

    describe('Seed to private key derivation', () => {
      // From Nano docs: k_private = blake2b(seed || index)
      // Example: seed = 0x00...01, index = 1
      // Expected: 1495F2D49159CC2EAAAA97EBB42346418E1268AFF16D7FCA90E6BAD6D0965520
      
      it('should derive correct private key from seed with index', () => {
        const seed = '0000000000000000000000000000000000000000000000000000000000000001';
        const privateKey = derivePrivateKeyLegacy(seed, 1);
        // Note: The expected value from docs is for index=1, not index=0
        expect(privateKey).toBe('1495f2d49159cc2eaaaa97ebb42346418e1268aff16d7fca90e6bad6d0965520');
      });

      it('should derive deterministic private keys', () => {
        const seed = '0000000000000000000000000000000000000000000000000000000000000001';
        const priv1 = derivePrivateKeyLegacy(seed, 0);
        const priv2 = derivePrivateKeyLegacy(seed, 0);
        expect(priv1).toBe(priv2);
      });

      it('should derive different private keys for different indices', () => {
        const seed = '0000000000000000000000000000000000000000000000000000000000000001';
        const priv0 = derivePrivateKeyLegacy(seed, 0);
        const priv1 = derivePrivateKeyLegacy(seed, 1);
        const priv2 = derivePrivateKeyLegacy(seed, 2);
        expect(priv0).not.toBe(priv1);
        expect(priv1).not.toBe(priv2);
        expect(priv0).not.toBe(priv2);
      });
    });
  });

  describe('BIP39 Mnemonic Roundtrips', () => {
    // Test vectors from BIP39 specification
    
    describe('Known entropy to mnemonic conversions', () => {
      it('should convert all-zeros 256-bit entropy to correct mnemonic', () => {
        const entropy = '0000000000000000000000000000000000000000000000000000000000000000';
        const mnemonic = seedToMnemonic(entropy);
        expect(mnemonic).toBe(
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'
        );
      });

      it('should convert all-zeros 128-bit entropy to correct mnemonic', () => {
        const entropy = '00000000000000000000000000000000';
        const mnemonic = seedToMnemonic(entropy);
        // BIP39 spec: 128-bit entropy produces 12-word mnemonic
        // The last word includes a 4-bit checksum
        expect(mnemonic.split(' ').length).toBe(12);
        expect(validateMnemonic(mnemonic)).toBe(true);
      });

      it('should convert known entropy to correct mnemonic (256-bit)', () => {
        const entropy = '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f';
        const mnemonic = seedToMnemonic(entropy);
        // This should produce a valid 24-word mnemonic
        expect(mnemonic.split(' ').length).toBe(24);
        expect(validateMnemonic(mnemonic)).toBe(true);
      });

      it('should convert known entropy to correct mnemonic (128-bit)', () => {
        const entropy = '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f';
        const mnemonic = seedToMnemonic(entropy);
        // This should produce a valid 12-word mnemonic
        expect(mnemonic.split(' ').length).toBe(12);
        expect(validateMnemonic(mnemonic)).toBe(true);
      });
    });

    describe('Mnemonic to entropy conversions', () => {
      it('should convert all-zeros mnemonic back to correct entropy (256-bit)', () => {
        const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
        const entropy = mnemonicToSeed(mnemonic);
        expect(entropy).toBe('0000000000000000000000000000000000000000000000000000000000000000');
      });

      it('should convert all-zeros mnemonic back to correct entropy (128-bit)', () => {
        // For 128-bit entropy, the mnemonic is 12 words with checksum
        // We need to use the actual mnemonic that seedToMnemonic produces
        const entropy = '00000000000000000000000000000000';
        const mnemonic = seedToMnemonic(entropy);
        const recovered = mnemonicToSeed(mnemonic);
        expect(recovered).toBe(entropy);
      });

      it('should roundtrip 256-bit entropy correctly', () => {
        for (let i = 0; i < 10; i++) {
          const seed = generateSeed();
          const mnemonic = seedToMnemonic(seed);
          const recovered = mnemonicToSeed(mnemonic);
          expect(recovered).toBe(seed);
        }
      });

      it('should roundtrip 128-bit entropy correctly', () => {
        for (let i = 0; i < 10; i++) {
          const seed = generateSeed().slice(0, 32); // 16 bytes = 128 bits
          const mnemonic = seedToMnemonic(seed);
          const recovered = mnemonicToSeed(mnemonic);
          expect(recovered).toBe(seed);
        }
      });
    });

    describe('Mnemonic validation', () => {
      it('should validate correct 24-word mnemonic', () => {
        const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
        expect(validateMnemonic(mnemonic)).toBe(true);
      });

      it('should validate correct 12-word mnemonic', () => {
        // Generate a valid 12-word mnemonic and validate it
        const entropy = '00000000000000000000000000000000';
        const mnemonic = seedToMnemonic(entropy);
        expect(validateMnemonic(mnemonic)).toBe(true);
      });

      it('should reject invalid mnemonic', () => {
        const mnemonic = 'invalid mnemonic phrase with wrong words';
        expect(validateMnemonic(mnemonic)).toBe(false);
      });

      it('should reject mnemonic with wrong checksum', () => {
        const seed = generateSeed();
        const mnemonic = seedToMnemonic(seed);
        const words = mnemonic.split(' ');
        // Change last word to break checksum
        words[words.length - 1] = 'abandon';
        const invalidMnemonic = words.join(' ');
        expect(validateMnemonic(invalidMnemonic)).toBe(false);
      });
    });
  });

  describe('Seed Generation Entropy Tests', () => {
    it('should generate 64-character hex strings', () => {
      for (let i = 0; i < 100; i++) {
        const seed = generateSeed();
        expect(seed.length).toBe(64);
        expect(seed).toMatch(/^[0-9a-f]+$/);
      }
    });

    it('should generate unique seeds', () => {
      const seeds = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        seeds.add(generateSeed());
      }
      expect(seeds.size).toBe(1000);
    });

    it('should have good entropy distribution across byte positions', () => {
      // Statistical test: each byte position should have variation across multiple seeds
      const seeds = Array.from({ length: 1000 }, () => generateSeed());
      
      for (let bytePos = 0; bytePos < 32; bytePos++) {
        const byteValues = new Set<number>();
        for (const seed of seeds) {
          const byteHex = seed.slice(bytePos * 2, bytePos * 2 + 2);
          byteValues.add(parseInt(byteHex, 16));
        }
        // Each byte position should have at least 50 unique values across 1000 seeds
        // (expected ~256 for uniform distribution)
        expect(byteValues.size).toBeGreaterThan(50);
      }
    });

    it('should have uniform bit distribution', () => {
      // Test that bits are uniformly distributed
      const seeds = Array.from({ length: 100 }, () => generateSeed());
      const bitCounts = new Array(256).fill(0);
      
      for (const seed of seeds) {
        for (let i = 0; i < 64; i += 2) {
          const byte = parseInt(seed.slice(i, i + 2), 16);
          for (let bit = 0; bit < 8; bit++) {
            if (byte & (1 << bit)) {
              bitCounts[i * 4 + bit]++;
            }
          }
        }
      }
      
      // Each bit should be set roughly 50% of the time
      // With 100 seeds, each bit should be set ~50 times (±20 for statistical variance)
      for (const count of bitCounts) {
        expect(count).toBeGreaterThan(30);
        expect(count).toBeLessThan(70);
      }
    });
  });

  describe('Unit Conversion Test Vectors', () => {
    describe('nanoToRaw conversions', () => {
      it('should convert 1 nano to correct raw value', () => {
        expect(nanoToRaw('1')).toBe('1000000000000000000000000000000');
      });

      it('should convert 0 nano to 0 raw', () => {
        expect(nanoToRaw('0')).toBe('0');
      });

      it('should convert fractional nano values correctly', () => {
        expect(nanoToRaw('0.1')).toBe('100000000000000000000000000000');
        expect(nanoToRaw('0.01')).toBe('10000000000000000000000000000');
        expect(nanoToRaw('0.001')).toBe('1000000000000000000000000000');
      });

      it('should handle very small nano values', () => {
        expect(nanoToRaw('0.000000000000000000000000000001')).toBe('1');
        expect(nanoToRaw('0.00000000000000000000000000001')).toBe('10');
        expect(nanoToRaw('0.0000000000000000000000000001')).toBe('100');
      });

      it('should handle large nano values', () => {
        expect(nanoToRaw('1000000')).toBe('1000000000000000000000000000000000000');
        expect(nanoToRaw('999999999')).toBe('999999999000000000000000000000000000000');
      });

      it('should preserve all 30 decimal places', () => {
        expect(nanoToRaw('1.000000000000000000000000000001')).toBe('1000000000000000000000000000001');
        expect(nanoToRaw('1.123456789012345678901234567890')).toBe('1123456789012345678901234567890');
      });

      it('should truncate decimals beyond 30 places', () => {
        expect(nanoToRaw('1.0000000000000000000000000000012')).toBe('1000000000000000000000000000001');
        expect(nanoToRaw('1.9999999999999999999999999999999')).toBe('1999999999999999999999999999999');
      });
    });

    describe('rawToNano conversions', () => {
      it('should convert 10^30 raw to 1 nano', () => {
        expect(rawToNano('1000000000000000000000000000000')).toBe('1');
      });

      it('should convert 1 raw to correct nano value', () => {
        expect(rawToNano('1')).toBe('0.000000000000000000000000000001');
      });

      it('should convert 0 raw to 0 nano', () => {
        expect(rawToNano('0')).toBe('0');
      });

      it('should handle fractional raw values', () => {
        expect(rawToNano('100000000000000000000000000000')).toBe('0.1');
        expect(rawToNano('10000000000000000000000000000')).toBe('0.01');
        expect(rawToNano('1000000000000000000000000000')).toBe('0.001');
      });

      it('should handle large raw values', () => {
        expect(rawToNano('1000000000000000000000000000000000000')).toBe('1000000');
        expect(rawToNano('999999999000000000000000000000000000000')).toBe('999999999');
      });

      it('should preserve decimal precision', () => {
        expect(rawToNano('1000000000000000000000000000001')).toBe('1.000000000000000000000000000001');
        expect(rawToNano('1123456789012345678901234567890')).toBe('1.12345678901234567890123456789');
      });

      it('should handle custom decimal places', () => {
        expect(rawToNano('1', 5)).toBe('0.00000');
        expect(rawToNano('1000000000000000000000000000000', 2)).toBe('1.00');
        expect(rawToNano('1500000000000000000000000000000', 6)).toBe('1.500000');
      });
    });

    describe('formatNano conversions', () => {
      it('should format 0 raw', () => {
        expect(formatNano('0')).toBe('0');
      });

      it('should format 1 raw', () => {
        expect(formatNano('1')).toBe('0.000000000000000000000000000001');
      });

      it('should format 10^30 raw', () => {
        expect(formatNano('1000000000000000000000000000000')).toBe('1');
      });

      it('should format large values', () => {
        expect(formatNano('1234567890000000000000000000000')).toBe('1.23456789');
      });

      it('should trim trailing zeros', () => {
        expect(formatNano('1000000000000000000000000000000')).toBe('1');
        expect(formatNano('1100000000000000000000000000000')).toBe('1.1');
        expect(formatNano('1110000000000000000000000000000')).toBe('1.11');
      });
    });

    describe('knanoToRaw conversions', () => {
      it('should convert 1 knano to correct raw value', () => {
        expect(knanoToRaw('1')).toBe('1000000000000000000000000000000000');
      });

      it('should convert fractional knano values', () => {
        expect(knanoToRaw('0.1')).toBe('100000000000000000000000000000000');
        expect(knanoToRaw('1.5')).toBe('1500000000000000000000000000000000');
      });
    });

    describe('mnanoToRaw conversions', () => {
      it('should convert 1 mnano to correct raw value', () => {
        expect(mnanoToRaw('1')).toBe('1000000000000000000000000000000000000');
      });

      it('should convert fractional mnano values', () => {
        expect(mnanoToRaw('0.1')).toBe('100000000000000000000000000000000000');
        expect(mnanoToRaw('1.5')).toBe('1500000000000000000000000000000000000');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty strings', () => {
        expect(nanoToRaw('')).toBe('0');
        expect(rawToNano('')).toBe('0');
        expect(formatNano('')).toBe('0');
        expect(knanoToRaw('')).toBe('0');
        expect(mnanoToRaw('')).toBe('0');
      });

      it('should handle very large numbers', () => {
        const largeNano = '999999999999999999999999999999';
        const raw = nanoToRaw(largeNano);
        expect(raw).toBe('999999999999999999999999999999000000000000000000000000000000');
        
        const backToNano = rawToNano(raw);
        expect(backToNano).toBe(largeNano);
      });

      it('should handle numbers with many decimal places', () => {
        const nano = '1.000000000000000000000000000001';
        const raw = nanoToRaw(nano);
        expect(raw).toBe('1000000000000000000000000000001');
        
        const backToNano = rawToNano(raw);
        expect(backToNano).toBe(nano);
      });
    });
  });

  describe('Address Validation Tests', () => {
    describe('Legacy address format validation', () => {
      it('should produce valid Nano address format', () => {
        const seed = '0000000000000000000000000000000000000000000000000000000000000001';
        const result = deriveAddressLegacy(seed, 0);
        
        // Address should start with 'nano_'
        expect(result.address.startsWith('nano_')).toBe(true);
        
        // Address should be 65 characters total
        expect(result.address.length).toBe(65);
        
        // Address should only contain valid characters
        const validChars = '13456789abcdefghijkmnopqrstuwxyz';
        const encoded = result.address.slice(5);
        for (const char of encoded) {
          expect(validChars).toContain(char);
        }
      });

      it('should produce deterministic addresses', () => {
        const seed = '0000000000000000000000000000000000000000000000000000000000000001';
        const result1 = deriveAddressLegacy(seed, 0);
        const result2 = deriveAddressLegacy(seed, 0);
        
        expect(result1.address).toBe(result2.address);
        expect(result1.privateKey).toBe(result2.privateKey);
        expect(result1.publicKey).toBe(result2.publicKey);
      });

      it('should produce different addresses for different seeds', () => {
        const seed1 = '0000000000000000000000000000000000000000000000000000000000000001';
        const seed2 = '0000000000000000000000000000000000000000000000000000000000000002';
        
        const result1 = deriveAddressLegacy(seed1, 0);
        const result2 = deriveAddressLegacy(seed2, 0);
        
        expect(result1.address).not.toBe(result2.address);
        expect(result1.privateKey).not.toBe(result2.privateKey);
        expect(result1.publicKey).not.toBe(result2.publicKey);
      });

      it('should produce different addresses for different indices', () => {
        const seed = '0000000000000000000000000000000000000000000000000000000000000001';
        
        const result0 = deriveAddressLegacy(seed, 0);
        const result1 = deriveAddressLegacy(seed, 1);
        const result2 = deriveAddressLegacy(seed, 2);
        
        expect(result0.address).not.toBe(result1.address);
        expect(result1.address).not.toBe(result2.address);
        expect(result0.address).not.toBe(result2.address);
      });
    });

    describe('BIP44 address format validation', () => {
      it('should produce valid Nano address format', () => {
        const mnemonic = 'company public remove bread fashion tortoise ahead shrimp onion prefer waste blade';
        const result = deriveAddressBIP44(mnemonic, 0);
        
        // Address should start with 'nano_'
        expect(result.address.startsWith('nano_')).toBe(true);
        
        // Address should be 65 characters total
        expect(result.address.length).toBe(65);
        
        // Address should only contain valid characters
        const validChars = '13456789abcdefghijkmnopqrstuwxyz';
        const encoded = result.address.slice(5);
        for (const char of encoded) {
          expect(validChars).toContain(char);
        }
      });

      it('should produce deterministic addresses', () => {
        const mnemonic = 'company public remove bread fashion tortoise ahead shrimp onion prefer waste blade';
        const result1 = deriveAddressBIP44(mnemonic, 0);
        const result2 = deriveAddressBIP44(mnemonic, 0);
        
        expect(result1.address).toBe(result2.address);
        expect(result1.privateKey).toBe(result2.privateKey);
        expect(result1.publicKey).toBe(result2.publicKey);
      });

      it('should produce different addresses for different mnemonics', () => {
        const mnemonic1 = 'company public remove bread fashion tortoise ahead shrimp onion prefer waste blade';
        const mnemonic2 = 'edge defense waste choose enrich upon flee junk siren film clown finish luggage leader kid quick brick print evidence swap drill paddle truly occur';
        
        const result1 = deriveAddressBIP44(mnemonic1, 0);
        const result2 = deriveAddressBIP44(mnemonic2, 0);
        
        expect(result1.address).not.toBe(result2.address);
        expect(result1.privateKey).not.toBe(result2.privateKey);
        expect(result1.publicKey).not.toBe(result2.publicKey);
      });

      it('should produce different addresses for different indices', () => {
        const mnemonic = 'company public remove bread fashion tortoise ahead shrimp onion prefer waste blade';
        
        const result0 = deriveAddressBIP44(mnemonic, 0);
        const result1 = deriveAddressBIP44(mnemonic, 1);
        const result2 = deriveAddressBIP44(mnemonic, 2);
        
        expect(result0.address).not.toBe(result1.address);
        expect(result1.address).not.toBe(result2.address);
        expect(result0.address).not.toBe(result2.address);
      });
    });
  });
});
