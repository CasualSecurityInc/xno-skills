import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const bin = path.join(root, 'bin/xno-skills');
const envHome = mkdtempSync(path.join(tmpdir(), 'xno-rpc-parity-'));
const run = promisify(execFile);

function text(result: unknown): string {
  return (result as { content: Array<{ text: string }> }).content[0].text;
}

describe('wallet RPC endpoint parity', () => {
  let preferred: Server;
  let saved: Server;
  let preferredUrl: string;
  let savedUrl: string;
  let preferredCalls = 0;
  let savedCalls = 0;

  beforeAll(async () => {
    const endpoint = (which: 'preferred' | 'saved') =>
      createServer(async (request, response) => {
        for await (const _chunk of request) {
          /* consume request */
        }
        if (which === 'preferred') preferredCalls += 1;
        else savedCalls += 1;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ balance: '42', pending: '0' }));
      });
    preferred = endpoint('preferred');
    saved = endpoint('saved');
    await Promise.all([
      new Promise<void>((done) => preferred.listen(0, '127.0.0.1', done)),
      new Promise<void>((done) => saved.listen(0, '127.0.0.1', done)),
    ]);
    const preferredAddress = preferred.address();
    const savedAddress = saved.address();
    if (!preferredAddress || typeof preferredAddress === 'string' || !savedAddress || typeof savedAddress === 'string')
      throw new Error('failed to start test endpoints');
    preferredUrl = `http://127.0.0.1:${preferredAddress.port}`;
    savedUrl = `http://127.0.0.1:${savedAddress.port}`;
    writeFileSync(path.join(envHome, 'config.json'), JSON.stringify({ rpcUrl: savedUrl }));
  });

  afterAll(async () => {
    await Promise.all([
      new Promise<void>((done) => preferred.close(() => done())),
      new Promise<void>((done) => saved.close(() => done())),
    ]);
    rmSync(envHome, { recursive: true, force: true });
  });

  const testEnv = () => ({
    ...process.env,
    XNO_MCP_MOCK_OWS: 'true',
    XNO_MCP_HOME: envHome,
    NANO_RPC_URL: preferredUrl,
  });

  it('CLI wallet actions select NANO_RPC_URL ahead of saved rpcUrl', async () => {
    const { stdout } = await run('node', [bin, 'balance', '--wallet', 'A', '--json'], {
      env: testEnv(),
      encoding: 'utf8',
    });
    const result = JSON.parse(stdout);
    expect(result.balanceRaw).toBe('42');
  });

  it('MCP wallet actions select the same effective endpoint', async () => {
    const client = new Client({ name: 'rpc-surface-parity', version: '1.0.0' }, { capabilities: {} });
    const transport = new StdioClientTransport({ command: 'node', args: [bin, 'mcp'], env: testEnv() });
    await client.connect(transport);
    const result = await client.callTool({ name: 'wallet_balance', arguments: { wallet: 'A' } });
    expect(JSON.parse(text(result)).balanceRaw).toBe('42');
    await client.close();
  });

  it('never contacts the saved endpoint when NANO_RPC_URL is set', () => {
    expect(preferredCalls).toBeGreaterThanOrEqual(2);
    expect(savedCalls).toBe(0);
  });
});
