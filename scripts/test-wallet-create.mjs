import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const cli = (...args) => execFileSync('xno-skills', args, { encoding: 'utf8' });
const create = (name, ...flags) => ['wallet', 'create', '--name', name, ...flags];

function expectFailure(args, message) {
  const result = spawnSync('xno-skills', args, { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, message);
}

function checkWallet(wallet, name) {
  assert.deepEqual(Object.keys(wallet).sort(), ['address', 'name']);
  assert.equal(wallet.name, name);
  assert.match(wallet.address, /^nano_[13][13456789abcdefghijkmnopqrstuwxyz]{59}$/);
}

if (process.argv.includes('--missing-ows')) {
  expectFailure(create('missing'), /Reinstall xno-skills with optional dependencies/);
} else {
  assert.equal(spawnSync('ows', ['--version']).error?.code, 'ENOENT');
  const text = cli(...create('text-wallet'))
    .trim()
    .split('\n');
  assert.equal(text[0], 'Created Nano wallet "text-wallet"');
  checkWallet({ name: 'text-wallet', address: text[1] }, 'text-wallet');
  const wallet = JSON.parse(cli(...create('cli-wallet', '--json')));
  checkWallet(wallet, 'cli-wallet');
  expectFailure(['wallet', 'create'], /required option.*--name/);
  expectFailure(create(' '), /must not be blank/);
  expectFailure(create('cli-wallet'), /already exists|duplicate/i);
  // OWS supports Nano state-block signing. Keep the test block entirely offline.
  const { signTransaction } = await import('@open-wallet-standard/core');
  const { publicKey } = JSON.parse(cli('validate', wallet.address, '--json'));
  const unsigned = ['06'.padStart(64, '0'), publicKey, '0'.repeat(64), publicKey, '0'.repeat(32), '1'.repeat(64)];
  const { signature } = signTransaction(wallet.name, 'nano', unsigned.join(''));
  assert.match(signature, /^[0-9a-f]{128}$/i);

  const client = new Client({ name: 'wallet-create-acceptance', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: 'xno-skills', args: ['mcp'], env: process.env });
  try {
    await client.connect(transport);
    async function call(name, args) {
      const result = await client.callTool({ name, arguments: args });
      assert.ok(!result.isError, JSON.stringify(result.content));
      return JSON.parse(result.content[0].text);
    }
    checkWallet(await call('wallet_create', { name: 'mcp-wallet' }), 'mcp-wallet');
    for (const [args, message] of [
      [{}, /name/],
      [{ name: ' ' }, /must not be blank/],
      [{ name: 'mcp-wallet' }, /already exists|duplicate/i],
    ]) {
      const result = await client.callTool({ name: 'wallet_create', arguments: args });
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, message);
    }
    for (const wallets of [JSON.parse(cli('wallets', '--json')), await call('wallet_list', {})]) {
      assert.deepEqual(wallets.map(({ name }) => name).sort(), ['cli-wallet', 'mcp-wallet', 'text-wallet']);
    }
  } finally {
    await client.close();
  }
}
console.log('Wallet creation acceptance checks passed.');
