import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '../bin/xno-skills');

describe('End-to-End Integration', () => {
  describe('CLI Operations', () => {
    it('should convert units with high precision via CLI', () => {
      const input = '1.000000000000000000000000000001';
      const output = execSync(`node ${CLI_PATH} convert ${input} xno --json`).toString();
      const result = JSON.parse(output);
      expect(result.raw).toBe('1000000000000000000000000000001');
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
