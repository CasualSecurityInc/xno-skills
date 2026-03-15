import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '../bin/xno-skills');

describe('End-to-End Integration', () => {
  describe('CLI Operations', () => {
    it('should generate a new wallet and validate its address using CLI', () => {
      // 1. Generate wallet via CLI
      const createOutput = execSync(`node ${CLI_PATH} wallet create --json`).toString();
      const wallet = JSON.parse(createOutput);
      
      expect(wallet.format).toBe('bip39');
      expect(wallet.mnemonic).toBeDefined();
      expect(wallet.address).toMatch(/^nano_[13][13456789abcdefghijkmnopqrstuwxyz]{59}$/);
      
      // 2. Validate the generated address using CLI
      const validateOutput = execSync(`node ${CLI_PATH} validate ${wallet.address} --json`).toString();
      const validation = JSON.parse(validateOutput);
      expect(validation.valid).toBe(true);
    });

    it('should restore a wallet from a mnemonic via CLI', async () => {
      // Mnemonic for seed 0...01
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon diesel';
      
      const restoreOutput = execSync(`node ${CLI_PATH} wallet from-mnemonic --stdin --json`, { input: mnemonic }).toString();
      const wallet = JSON.parse(restoreOutput);
      
      const { deriveAddressBIP44 } = await import('../src/address-bip44');
      expect(wallet.address).toBe(deriveAddressBIP44(mnemonic, 0, '').address);
      expect(wallet.mnemonic).toBe(mnemonic);
    });

    it('should restore a wallet from mnemonic via stdin (safer)', async () => {
      const mnemonic = 'company public remove bread fashion tortoise ahead shrimp onion prefer waste blade';
      const restoreOutput = execSync(`node ${CLI_PATH} wallet from-mnemonic --stdin --json`, { input: mnemonic }).toString();
      const wallet = JSON.parse(restoreOutput);

      const { deriveAddressBIP44 } = await import('../src/address-bip44');
      expect(wallet.address).toBe(deriveAddressBIP44(mnemonic, 0, '').address);
      expect(wallet.mnemonic).toBe(mnemonic);
    });

    it('should convert units with high precision via CLI', () => {
      const input = '1.000000000000000000000000000001';
      const output = execSync(`node ${CLI_PATH} convert ${input} xno --to raw --json`).toString();
      const result = JSON.parse(output);
      expect(result.to).toBe('1000000000000000000000000000001');
    });

    it('should fail with a proper error on invalid CLI input', () => {
      try {
        execSync(`node ${CLI_PATH} qr nano_invalid 2>/dev/null`);
        throw new Error('Should have failed');
      } catch (error: any) {
        // Expected failure
        expect(error.status).not.toBe(0);
      }
    });
  });

  describe('Core Library High-Level Flow', () => {
    it('should maintain perfect precision through a full roundtrip', async () => {
      const { nanoToRaw, rawToNano } = await import('../src/index.js');
      const maxPrecisionXno = '1.000000000000000000000000000001'; // 30 decimal places
      const raw = nanoToRaw(maxPrecisionXno);
      const back = rawToNano(raw);
      expect(back).toBe(maxPrecisionXno);
    });
  });
});
