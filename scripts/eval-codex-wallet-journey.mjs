#!/usr/bin/env node
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { listWallets } = require('@open-wallet-standard/core');

function usage(message) {
  if (message) console.error(`error: ${message}`);
  console.error('Usage: npm run eval:codex-wallet-journey -- --model <model> --source-wallet <name> --upstream-rpc <url> --out <dir> [--vault <dir>] [--min-source-raw <raw>]');
  process.exit(2);
}

function options(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: npm run eval:opencode-wallet-journey -- --source-wallet <name> --upstream-rpc <url> --out <dir> [--vault <dir>] [--min-source-raw <raw>]');
    process.exit(0);
  }
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || !argv[i + 1]) usage(`invalid argument ${argv[i] ?? ''}`);
    result[argv[i].slice(2)] = argv[i + 1];
  }
  for (const key of ['source-wallet', 'upstream-rpc', 'out']) if (!result[key]) usage(`--${key} is required`);
  result.runner ??= 'codex';
  if (!['codex', 'opencode'].includes(result.runner)) usage('--runner must be codex or opencode');
  if (result.runner === 'codex' && !result.model) usage('--model is required for the Codex runner');
  if (result.runner === 'opencode') result.model ??= 'kilo/kilo-auto/free';
  return result;
}

const args = options(process.argv.slice(2));
const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = resolve(args.out);
const vault = resolve(args.vault ?? process.env.OWS_VAULT_PATH ?? join(process.env.HOME ?? '', '.ows'));
// A retry must never collide with wallets left intentionally intact by an earlier
// evaluation. Keep the arm/run labels while adding an invocation-unique suffix.
const evalNonce = `${Date.now().toString(36)}-${process.pid.toString(36)}`;
const minSourceRaw = BigInt(args['min-source-raw'] ?? '1');
const maxSendXno = process.env.XNO_MAX_SEND ?? '1.0';
const maxSendRaw = BigInt(maxSendXno.includes('.') ? `${maxSendXno.split('.')[0]}.${maxSendXno.split('.')[1]}`.replace('.', '').padEnd(31, '0') : `${maxSendXno}${'0'.repeat(30)}`);

function currentAccounts() {
  return new Set(listWallets(vault).flatMap((wallet) => wallet.accounts.filter((account) => account.address.startsWith('nano_')).map((account) => account.address)));
}

function walletAddress(name) {
  const wallet = listWallets(vault).find((candidate) => candidate.name === name);
  return wallet?.accounts.find((account) => account.address.startsWith('nano_'))?.address;
}

async function rpc(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`upstream RPC returned ${response.status}`);
  return response.json();
}

function jsonl(value) { return `${JSON.stringify(value)}\n`; }

function observedRoutes(jsonlText) {
  const routes = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const item = value;
    if (typeof item.type === 'string' && /(tool|function|command)/i.test(item.type)) {
      routes.push({ type: item.type, name: item.name ?? item.tool_name ?? item.command ?? item.call_id, arguments: item.arguments ?? item.input ?? item.command });
    }
    Object.values(item).forEach(visit);
  };
  for (const line of jsonlText.split('\n')) {
    try { visit(JSON.parse(line)); } catch { /* ignore incomplete/non-JSON lines */ }
  }
  return routes;
}

const sourceAddress = walletAddress(args['source-wallet']);
if (!sourceAddress) usage(`OWS source wallet not found or has no Nano account: ${args['source-wallet']}`);
const balance = await rpc(args['upstream-rpc'], { action: 'account_balance', account: sourceAddress });
const initialRaw = BigInt(balance.balance ?? '0');
// The tenth transfer is one 1024th of the original balance. Keep it and the post-run source balance above the requested floor.
if (initialRaw / 1024n < minSourceRaw || initialRaw / 2n > maxSendRaw) {
  usage(`source balance cannot safely fund ten half-transfers within XNO_MAX_SEND=${maxSendXno} and min-source-raw=${minSourceRaw}`);
}

await mkdir(outDir, { recursive: true, mode: 0o700 });
const guardLog = [];
const guard = createServer(async (request, response) => {
  let text = '';
  for await (const chunk of request) text += chunk;
  let payload;
  try { payload = JSON.parse(text); } catch { response.writeHead(400).end('invalid JSON'); return; }
  let guardEntry;
  if (payload.action === 'process') {
    const block = payload.block ?? {};
    const accounts = currentAccounts();
    const account = block.account;
    const subtype = payload.subtype;
    let reason;
    if (typeof account !== 'string' || !accounts.has(account)) reason = 'block account is not a current OWS Nano account';
    else if (subtype === 'send' && (typeof block.link_as_account !== 'string' || !accounts.has(block.link_as_account))) reason = 'send destination is not a current OWS Nano account';
    guardEntry = { at: new Date().toISOString(), action: 'process', subtype, account, destination: block.link_as_account, allowed: !reason, reason };
    guardLog.push(guardEntry);
    if (reason) {
      response.writeHead(403, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: `guard rejected publish: ${reason}` }));
      return;
    }
  }
  try {
    const upstream = await rpc(args['upstream-rpc'], payload);
    if (guardEntry && typeof upstream?.hash === 'string') guardEntry.hash = upstream.hash;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(upstream));
  } catch (error) {
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
});
await new Promise((resolveGuard) => guard.listen(0, '127.0.0.1', resolveGuard));
const address = guard.address();
if (!address || typeof address === 'string') throw new Error('could not bind local guard');
const guardUrl = `http://127.0.0.1:${address.port}`;

// Refuse to run if Codex cannot apply its network-disabled sandbox to a probe. The journey itself uses
// workspace-write with only the run directory plus the OWS vault added as writable locations.
const sandboxState = JSON.stringify({
  permissionProfile: {
    type: 'managed',
    file_system: {
      type: 'restricted',
      // Codex needs its platform runtime paths readable to launch a probe; only the
      // repository/output paths (and the vault reopened below) are writable.
      entries: [
        { path: { type: 'special', value: { kind: 'root' } }, access: 'read' },
        ...[process.cwd(), outDir].map((path) => ({ path: { type: 'path', path }, access: 'write' })),
      ],
    },
    network: 'restricted',
  },
  codexLinuxSandboxExe: null,
  sandboxCwd: `file://${process.cwd()}`,
  useLegacyLandlock: false,
});
const sandboxProbe = spawnSync('codex', ['sandbox', '--sandbox-state-json', sandboxState, '--sandbox-state-disable-network', '--sandbox-state-readable-root', vault, '--', '/usr/bin/true'], { encoding: 'utf8' });
if (sandboxProbe.status !== 0) {
  const detail = sandboxProbe.stderr || sandboxProbe.stdout || `exit=${sandboxProbe.status ?? 'null'} signal=${sandboxProbe.signal ?? 'none'}`;
  const suffix = sandboxProbe.status === 134 || sandboxProbe.signal === 'SIGABRT'
    ? ' The host Codex sandbox provider aborted; refusing to run an unsandboxed wallet evaluation.'
    : '';
  throw new Error(`Codex sandbox preflight failed (${detail.trim()}).${suffix}`);
}

const codexVersion = spawnSync('codex', ['--version'], { encoding: 'utf8' }).stdout.trim();
const runResults = [];
try {
  for (const arm of ['cli', 'mcp']) {
    for (let run = 1; run <= 5; run += 1) {
      const recipient = `xno-interface-eval-${arm}-${evalNonce}-${run}`;
      if (walletAddress(recipient)) throw new Error(`refusing to reuse existing evaluation wallet: ${recipient}`);
      const runDir = join(outDir, `${arm}-${run}`);
      await mkdir(runDir, { recursive: true, mode: 0o700 });
      const prompt = `Using the OWS wallet named "${args['source-wallet']}", create a new wallet named "${recipient}". Transfer half of "${args['source-wallet']}"’s confirmed XNO balance to the new wallet’s Nano address, then receive it. Report the new address and received amount.`;
      const preTransferBalance = await rpc(args['upstream-rpc'], { action: 'account_balance', account: sourceAddress });
      const expectedRaw = BigInt(preTransferBalance.balance ?? '0') / 2n;
      const guardStart = guardLog.length;
      let command;
      const childEnv = { ...process.env, NANO_RPC_URL: guardUrl, NANO_WORK_URL: guardUrl, XNO_MCP_HOME: join(runDir, 'xno-state') };
      if (args.runner === 'codex') {
        command = ['exec', '--json', '--sandbox', 'workspace-write', '--ask-for-approval', 'never', '--cd', runDir, '--add-dir', vault, '--model', args.model, '--output-last-message', join(runDir, 'last-message.txt')];
        if (arm === 'mcp') command.push('-c', `mcp_servers.xno_skills={command="${join(repoRoot, 'bin/xno-skills')}",args=["mcp"],env={NANO_RPC_URL="${guardUrl}",NANO_WORK_URL="${guardUrl}",XNO_MCP_HOME="${join(runDir, 'xno-state')}"}}`);
      } else {
        command = ['run', '--format', 'json', '--auto', '--dir', runDir, '--model', args.model];
        if (arm === 'mcp') {
          await writeFile(join(runDir, 'opencode.json'), JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp: { xno_skills: { type: 'local', command: [join(repoRoot, 'bin/xno-skills'), 'mcp'], environment: { NANO_RPC_URL: guardUrl, NANO_WORK_URL: guardUrl, XNO_MCP_HOME: join(runDir, 'xno-state') }, enabled: true } } }, null, 2), { mode: 0o600 });
        }
      }
      command.push(prompt);
      const startedAt = Date.now();
      const child = spawn(args.runner, command, { cwd: runDir, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
      let jsonlOutput = ''; let stderr = '';
      child.stdout.on('data', (chunk) => { jsonlOutput += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      const exitCode = await new Promise((resolveExit) => child.on('close', resolveExit));
      await writeFile(join(runDir, 'codex.jsonl'), jsonlOutput, { mode: 0o600 });
      await writeFile(join(runDir, 'codex.stderr.txt'), stderr, { mode: 0o600 });
      const recipientAddress = walletAddress(recipient);
      const recipientBalance = recipientAddress ? await rpc(args['upstream-rpc'], { action: 'account_balance', account: recipientAddress }) : { balance: '0' };
      const runGuardLog = guardLog.slice(guardStart);
      const publishes = runGuardLog.filter((entry) => entry.allowed && (entry.account === sourceAddress || entry.account === recipientAddress));
      const sourceSends = publishes.filter((entry) => entry.subtype === 'send' && entry.account === sourceAddress && entry.destination === recipientAddress);
      const receives = publishes.filter((entry) => (entry.subtype === 'open' || entry.subtype === 'receive') && entry.account === recipientAddress);
      const verified = exitCode === 0 && recipientAddress && BigInt(recipientBalance.balance ?? '0') === expectedRaw && sourceSends.length === 1 && receives.length === 1 && !runGuardLog.some((entry) => !entry.allowed);
      runResults.push({ arm, run, recipient, recipientAddress, expectedRaw: expectedRaw.toString(), recipientBalanceRaw: recipientBalance.balance ?? '0', exitCode, elapsedMs: Date.now() - startedAt, sourceSendBlocks: sourceSends.map((entry) => entry.hash), receiveBlocks: receives.map((entry) => entry.hash), observedRoutes: observedRoutes(jsonlOutput), verified, runner: args.runner, model: args.model, runnerVersion: args.runner === 'codex' ? codexVersion : spawnSync('opencode', ['--version'], { encoding: 'utf8' }).stdout.trim() });
    }
  }
} finally {
  await new Promise((resolveClose) => guard.close(resolveClose));
}
await writeFile(join(outDir, 'guard.jsonl'), guardLog.map(jsonl).join(''), { mode: 0o600 });
const verifiedByArm = Object.fromEntries(['cli', 'mcp'].map((arm) => [arm, runResults.filter((result) => result.arm === arm && result.verified).length]));
await writeFile(join(outDir, 'report.json'), JSON.stringify({ promptTemplate: 'fixed wallet journey', runner: args.runner, model: args.model, sourceWallet: args['source-wallet'], sourceAddress, initialRaw: initialRaw.toString(), guardUrl, codexVersion: args.runner === 'codex' ? codexVersion : undefined, verifiedByArm, results: runResults, note: 'Token use is intentionally omitted unless the runner event stream contains an authoritative per-run count.' }, null, 2), { mode: 0o600 });
console.log(JSON.stringify(runResults, null, 2));
if (verifiedByArm.cli !== 5 || verifiedByArm.mcp !== 5) process.exitCode = 1;
