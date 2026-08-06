#!/usr/bin/env node

import { Command } from 'commander';
import { validateAddress } from './validate.js';
import { nanoToRaw, rawToNano } from './convert.js';
import { generateAsciiQr, buildNanoUri, generateSvgQr } from './qr.js';
import { rpcAccountBalance, rpcAccountInfo, rpcReceivable, rpcAccountHistory, rpcProbeCaps, rpcProcess, nanoRpcCall, type AccountInfoResponse, type NanoRpcErrorResponse } from './rpc.js';
import { decodeNanoAddress } from './nano-address.js';
import { nanoGetPublicKeyFromPrivateKey } from './ed25519-blake2b.js';
import { buildNanoStateBlockHex } from './state-block.js';
import { normalizeRemoteWorkDifficulty } from './work-threshold.js';
import { NanoClient, WorkProvider, NOMS } from '@openrai/nano-core';
import { version } from './version.js';
import { getSystemInfo, formatSystemInfo, getEffectiveLocalPowRecommended } from './meta.js';
import { resolveEffectiveWorkUrls, resolveEffectiveRpcUrls, DEFAULT_RPC_URLS } from './config.js';
import {
  DEFAULT_REPRESENTATIVE,
  DEFAULT_TIMEOUT_MS,
  executeChange,
  executeReceive,
  executeSend,
  getNanoBalance,
  getNanoHistory,
  getNanoAccountInfo,
  isRpcError,
  listNanoWallets,
  signWalletMessage,
  submitPreparedBlock,
  toToolError,
  verifyNanoMessage,
} from './nano-actions.js';
import { loadConfig, loadTransactions, type XnoConfig } from './state-store.js';

import { getAsciiArtBanner } from './banner.js';

const program = new Command();
const config: XnoConfig = loadConfig();
const transactions = loadTransactions();

function logTiming(scope: string, message: string): void {
  process.stderr.write(`[${scope}] ${message}\n`);
}

function elapsedMs(startedAt: number): number {
  return Date.now() - startedAt;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function effectivePowTimeoutMs(config: XnoConfig): number {
  return config.powTimeoutMs ?? (config.timeoutMs ? config.timeoutMs * 4 : 60_000);
}

function getNanoClient(options?: { urls?: string[] }): NanoClient {
  const rpcUrls = options?.urls?.length ? options.urls : resolveEffectiveRpcUrls(undefined, config);
  const rpcTimeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const powTimeoutMs = effectivePowTimeoutMs(config);
  logTiming(
    'xno-cli',
    `NanoClient init rpc=[${rpcUrls.join(',') || '(defaults)'}] rpcTimeoutMs=${rpcTimeoutMs} powTimeoutMs=${powTimeoutMs}`,
  );
  return NanoClient.initialize({
    rpc: rpcUrls.length > 0 ? rpcUrls : DEFAULT_RPC_URLS,
    workProvider: WorkProvider.auto({
      localTimeoutMs: powTimeoutMs,
      profiler: { mode: 'auto', preferLocalAboveMhs: 0, cacheStrategy: 'memory' },
    }),
  });
}

let gpuProbeLogged = false;

function readersFor(options?: { urls?: string[] }) {
  const client = getNanoClient(options);
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  return {
    accountInfo: (address: string) => rpcAccountInfo(client, address, { timeoutMs }),
    accountBalance: (address: string) => rpcAccountBalance(client, address, { timeoutMs }),
    receivable: (address: string, count: number) => rpcReceivable(client, address, count, { timeoutMs }),
    accountHistory: (address: string, count: number) => rpcAccountHistory(client, address, count, { timeoutMs }),
    workGenerate: async (hash: string, difficulty: string) => {
      let preferLocal = true;
      try {
        const { recommendLocalPow } = await import('nano-rspow-node');
        preferLocal = getEffectiveLocalPowRecommended(recommendLocalPow);
      } catch (e) {
        // ignore
      }

      const workUrls = !preferLocal ? resolveEffectiveWorkUrls(config) : [];


      if (!gpuProbeLogged) {
        gpuProbeLogged = true;
        if (preferLocal) {
          logTiming('xno-cli', 'Probing for GPU acceleration (OpenCL warning on systems without GPU is expected)...');
        }
      }
      const startedAt = Date.now();

      if (workUrls.length > 0) {
        const difficultyHex = normalizeRemoteWorkDifficulty(difficulty);
        logTiming('xno-cli', `pow.generate start hash=${hash.slice(0, 12)} difficulty=${difficultyHex} remote=${workUrls.join(',')}`);
        try {
          const workClient = getNanoClient({ urls: workUrls });
          const res = await nanoRpcCall<{ work: string }>(
            workClient,
            { action: 'work_generate', hash, difficulty: difficultyHex },
            { timeoutMs: effectivePowTimeoutMs(config) }
          );
          logTiming('xno-cli', `pow.generate ok remote elapsedMs=${elapsedMs(startedAt)}`);
          return res.work;
        } catch (error) {
          logTiming('xno-cli', `pow.generate remote fail elapsedMs=${elapsedMs(startedAt)} error=${describeError(error)}, falling back to local`);
        }
      }

      logTiming('xno-cli', `pow.generate start hash=${hash.slice(0, 12)} difficulty=${difficulty} local=true`);
      try {
        const work = await client.workProvider.generate(hash, difficulty);
        logTiming('xno-cli', `pow.generate ok elapsedMs=${elapsedMs(startedAt)}`);
        return work;
      } catch (error) {
        logTiming('xno-cli', `pow.generate fail elapsedMs=${elapsedMs(startedAt)} error=${describeError(error)}`);
        throw error;
      }
    },
    process: async (block: Record<string, unknown>, subtype: 'send' | 'receive' | 'open' | 'change') => {
      const startedAt = Date.now();
      logTiming('xno-cli', `rpc.process start subtype=${subtype}`);
      try {
        const result = await rpcProcess(client, block, subtype, { timeoutMs });
        logTiming('xno-cli', `rpc.process ok subtype=${subtype} elapsedMs=${elapsedMs(startedAt)} hash=${result.hash}`);
        return result;
      } catch (error) {
        logTiming('xno-cli', `rpc.process fail subtype=${subtype} elapsedMs=${elapsedMs(startedAt)} error=${describeError(error)}`);
        throw error;
      }
    },
  };
}

function printJsonOrText(result: unknown, options?: { json?: boolean }, text?: () => void): void {
  if (options?.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (text) text();
  else console.log(JSON.stringify(result, null, 2));
}

function exitWithError(error: unknown): never {
  const result = toToolError(error as Error);
  console.error((result.content[0] as any).text);
  process.exit(1);
}

program
  .version(version)
  .description(getAsciiArtBanner())
  .option('-q, --quiet', 'Suppress non-essential output');

program.on('--help', () => {
  // kept for subcommand compat
});

program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  (thisCommand as any).globalOpts = {
    quiet: opts.quiet || false,
  };
});

program
  .command('wallets')
  .helpGroup('Wallet Operations')
  .description('List wallets that have Nano accounts')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options: { json?: boolean }) => {
    try {
      const wallets = await listNanoWallets();
      printJsonOrText(wallets, options, () => {
        for (const wallet of wallets) {
          console.log(`${wallet.name.padEnd(24)}\t${wallet.address ?? ''}`);
        }
      });
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command('balance')
  .helpGroup('Wallet Operations')
  .description('Show balance and pending amount')
  .requiredOption('--wallet <name>', 'OWS wallet name')
  .option('--count <n>', 'Max receivable blocks to return if pending > 0', (value) => parseInt(value, 10), 10)
  .option('-j, --json', 'Output in JSON format')
  .action(async (options: { wallet: string; count: number; json?: boolean }) => {
    try {
      const result = await getNanoBalance(options.wallet, readersFor(), { config }, 0, options.count);
      printJsonOrText(result, options, () => {
        console.log(`Address: ${result.address}`);
        console.log(`Balance: ${result.balanceXno} XNO`);
        console.log(`Pending: ${result.pendingXno} XNO`);
        if (result.pendingBlocks.length > 0) {
          for (const block of result.pendingBlocks) {
            console.log(`${block.hash}  ${rawToNano(block.amount)} XNO${block.source ? `  from ${block.source}` : ''}`);
          }
        }
      });
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command('receive')
  .helpGroup('Wallet Operations')
  .description('Receive pending blocks')
  .requiredOption('--wallet <name>', 'OWS wallet name')
  // .option('--index <n>', 'Nano account index', (value) => parseInt(value, 10), 0)
  .option('--hash <hash>', 'Receive only this send block hash')
  .option('--count <n>', 'Max receivable blocks to consider', (value) => parseInt(value, 10), 10)
  .option('-j, --json', 'Output in JSON format')
  .action(async (options: { wallet: string; hash?: string; count: number; json?: boolean }) => {
    try {
      const result = await executeReceive(options.wallet, config.rpcUrl || process.env.NANO_RPC_URL, { config }, readersFor(), {
        index: 0,
        count: options.count,
        onlyHash: options.hash,
      });
      printJsonOrText(result, options, () => {
        if (result.received.length === 0) {
          console.log('No pending blocks.');
          return;
        }
        for (const entry of result.received) {
          console.log(`Received ${rawToNano(entry.amountRaw)} XNO in block ${entry.hash}`);
        }
        console.log(`Balance: ${result.balanceXno} XNO`);
      });
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command('send')
  .helpGroup('Wallet Operations')
  .description('Send Nano')
  .requiredOption('--wallet <name>', 'OWS wallet name')
  .requiredOption('--to <address>', 'Destination Nano address')
  .requiredOption('--amount-xno <xno>', 'Amount to send in XNO')
  // .option('--index <n>', 'Nano account index', (value) => parseInt(value, 10), 0)
  .option('-j, --json', 'Output in JSON format')
  .action(async (options: { wallet: string; to: string; amountXno: string; json?: boolean }) => {
    try {
      const result = await executeSend(options.wallet, config.rpcUrl || process.env.NANO_RPC_URL, { config }, readersFor(), options.to, options.amountXno, { index: 0 });
      printJsonOrText(result, options, () => {
        console.log(`Hash: ${result.hash}`);
        console.log(`From: ${result.from}`);
        console.log(`To: ${result.to}`);
        console.log(`Amount: ${result.amountXno} XNO`);
      });
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command('change-rep')
  .helpGroup('Wallet Operations')
  .description('Submit a change representative block')
  .requiredOption('--wallet <name>', 'OWS wallet name')
  .requiredOption('--representative <address>', 'New Nano representative address')
  // .option('--index <n>', 'Nano account index', (value) => parseInt(value, 10), 0)
  .option('-j, --json', 'Output in JSON format')
  .action(async (options: { wallet: string; representative: string; json?: boolean }) => {
    try {
      const result = await executeChange(options.wallet, config.rpcUrl || process.env.NANO_RPC_URL, { config }, readersFor(), options.representative, { index: 0 });
      printJsonOrText(result, options, () => {
        console.log(`Hash: ${result.hash}`);
        console.log(`Address: ${result.address}`);
        console.log(`Representative: ${result.representative}`);
      });
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command('submit-block')
  .helpGroup('Wallet Operations')
  .description('Sign and submit a prepared block hex')
  .requiredOption('--wallet <name>', 'OWS wallet name')
  .requiredOption('--tx-hex <hex>', 'Prepared unsigned Nano block hex')
  .requiredOption('--subtype <type>', 'Block subtype: send, receive, open, or change')
  // .option('--index <n>', 'Nano account index', (value) => parseInt(value, 10), 0)
  .option('-j, --json', 'Output in JSON format')
  .action(async (options: { wallet: string; txHex: string; subtype: 'send' | 'receive' | 'open' | 'change'; json?: boolean }) => {
    try {
      const result = await submitPreparedBlock(options.wallet, config.rpcUrl || process.env.NANO_RPC_URL, { config }, readersFor(), options.txHex, options.subtype, { index: 0 });
      printJsonOrText(result, options, () => {
        console.log(`Hash: ${result.hash}`);
        console.log(`Address: ${result.address}`);
        console.log(`Subtype: ${result.subtype}`);
      });
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command('history')
  .helpGroup('Wallet Operations')
  .description('Show transaction history')
  .requiredOption('--wallet <name>', 'OWS wallet name')
  .option('--limit <n>', 'Max entries to show', (value) => parseInt(value, 10), 20)
  .option('-j, --json', 'Output in JSON format')
  .action(async (options: { wallet: string; limit: number; json?: boolean }) => {
    try {
      const history = await getNanoHistory(options.wallet, readersFor(), { config }, { index: 0, count: options.limit });
      printJsonOrText(history, options, () => {
        if (history.length === 0) {
          console.log('No transactions found.');
          return;
        }
        for (const entry of history) {
          const date = new Date(Number(entry.local_timestamp) * 1000).toISOString();
          const amountXno = rawToNano(entry.amount);
          console.log(`${date}  ${entry.type.padEnd(8)}  ${amountXno.padStart(14)} XNO  ${entry.hash}`);
        }
      });
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command('info')
  .helpGroup('Utilities')
  .description('Discover the current state and representative of any Nano account')
  .option('--wallet <name>', 'OWS wallet name')
  .option('--address <address>', 'Nano address to inspect')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options: { wallet?: string; address?: string; json?: boolean }) => {
    if (!options.wallet && !options.address) {
      console.error("error: required option '--wallet <name>' or '--address <address>' not specified");
      process.exit(1);
    }
    if (options.wallet && options.address) {
      console.error("error: cannot specify both '--wallet' and '--address'");
      process.exit(1);
    }
    try {
      const info = await getNanoAccountInfo({ wallet: options.wallet, address: options.address }, readersFor(), { config });
      printJsonOrText(info, options, () => {
        console.log(`Address:        ${info.address}`);
        console.log(`Balance:        ${info.balanceXno} XNO`);
        console.log(`Pending:        ${info.pendingXno} XNO`);
        if (info.representative) console.log(`Representative: ${info.representative}`);
        if (info.frontier) console.log(`Frontier:       ${info.frontier}`);
        if (info.blockCount) console.log(`Block Count:    ${info.blockCount}`);
        if (info.weightXno) console.log(`Weight:         ${info.weightXno} XNO`);
      });
    } catch (error) {
      exitWithError(error);
    }
  });

// TODO: Unhide once NOMS PR is merged into OWS core
program
  .command('sign-message', { hidden: true })
  .helpGroup('Cryptography & Signing')
  .description('Sign an off-chain message')
  .requiredOption('--wallet <name>', 'OWS wallet name')
  .requiredOption('--message <text>', 'Message text to sign')
  // .option('--index <n>', 'Nano account index', (value) => parseInt(value, 10), 0)
  .option('-j, --json', 'Output in JSON format')
  .action(async (options: { wallet: string; message: string; json?: boolean }) => {
    try {
      const result = await signWalletMessage(options.wallet, options.message, { index: 0 });
      printJsonOrText(result, options, () => {
        console.log(`Address: ${result.address}`);
        console.log(`Signature: ${result.signature}`);
      });
    } catch (error) {
      exitWithError(error);
    }
  });

// TODO: Unhide once NOMS PR is merged into OWS core
program
  .command('verify-message', { hidden: true })
  .helpGroup('Cryptography & Signing')
  .description('Verify an off-chain message signature')
  .requiredOption('--address <addr>', 'Nano address or public key')
  .requiredOption('--message <text>', 'Original message text')
  .requiredOption('--signature <hex>', 'Hex-encoded signature')
  .option('-j, --json', 'Output in JSON format')
  .action((options: { address: string; message: string; signature: string; json?: boolean }) => {
    try {
      const result = verifyNanoMessage(options.address, options.message, options.signature);
      printJsonOrText(result, options, () => {
        if (result.valid) console.log('Signature is VALID');
        else {
          console.error('Signature is INVALID');
          process.exit(1);
        }
      });
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command('convert')
  .helpGroup('Utilities')
  .description('Convert between XNO units')
  .argument('<amount>', 'Value to convert')
  .argument('<from>', 'Source unit: xno or raw')
  .option('-j, --json', 'Output in JSON format')
  .action((amount: string, from: string, options: { json?: boolean }) => {
    const normalizeUnit = (unit: string): string => {
      const value = unit.toLowerCase();
      if (value === 'xno' || value === 'nano') return 'xno';
      if (value === 'raw' || value === 'rai') return 'raw';
      return value;
    };

    const fromUnit = normalizeUnit(from);

    let rawValue: string;
    switch (fromUnit) {
      case 'xno': rawValue = nanoToRaw(amount); break;
      case 'raw': rawValue = amount; break;
      default:
        console.error(`Unknown source unit: ${fromUnit}. Use xno or raw.`);
        process.exit(1);
    }

    const xno = rawToNano(rawValue);
    const result = { input: amount, inputUnit: fromUnit, raw: rawValue, xno };
    printJsonOrText(result, options, () => {
      console.log(`raw: ${rawValue}`);
      console.log(`xno: ${xno}`);
    });
  });

program
  .command('qr')
  .helpGroup('Utilities')
  .description('Generate a QR code for a Nano address')
  .argument('<address>', 'Nano address')
  .option('--amount-xno <amount>', 'Include amount in XNO')
  .option('--format <format>', 'QR code format (ascii or svg)', 'ascii')
  .option('-j, --json', 'Output in JSON format')
  .action(async (address: string, options: { amountXno?: string; format?: string; json?: boolean }) => {
    const validation = validateAddress(address);
    if (!validation.valid) {
      console.error(`Invalid address: ${validation.error}`);
      process.exit(1);
    }
    try {
      const content = buildNanoUri(address, options.amountXno);
      const format = options.format === 'svg' ? 'svg' : 'ascii';
      const qr = format === 'svg' ? generateSvgQr(address, options.amountXno) : await generateAsciiQr(address, options.amountXno);
      printJsonOrText({ address, amountXno: options.amountXno ?? null, content, format, qr }, options, () => {
        console.log(qr);
      });
    } catch (error: any) {
      console.error(`Error: ${error?.message ?? error}`);
      process.exit(1);
    }
  });

program
  .command('validate')
  .helpGroup('Utilities')
  .description('Validate a Nano address or block hash')
  .argument('<input>', 'Address or block hash to validate')
  .option('-j, --json', 'Output in JSON format')
  .action((input: string, options: { json?: boolean }) => {
    const result = validateAddress(input);
    const out = { address: input, ...result };
    printJsonOrText(out, options, () => {
      if (result.valid) {
        console.log('Valid Nano address');
        if (result.publicKey) console.log(`Public Key: ${result.publicKey}`);
      } else {
        console.error(`Invalid: ${result.error}`);
        process.exit(1);
      }
    });
  });

program
  .command('sign')
  .helpGroup('Cryptography & Signing')
  .description('Sign a NOMS message with a private key')
  .argument('<message>', 'The message text to sign')
  .requiredOption('-k, --key <hex>', 'Private key in hex')
  .option('-j, --json', 'Output in JSON format')
  .action((message: string, options: { key: string; json?: boolean }) => {
    try {
      const signature = NOMS.signMessage(message, options.key);
      const publicKey = nanoGetPublicKeyFromPrivateKey(options.key);
      printJsonOrText({ message, signature, publicKey }, options, () => {
        console.log(`Signature: ${signature}`);
        console.log(`Public Key: ${publicKey}`);
      });
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command('verify')
  .helpGroup('Cryptography & Signing')
  .description('Verify a NOMS message signature')
  .argument('<address>', 'Nano address or public key')
  .argument('<message>', 'The original message text')
  .argument('<signature>', 'The hex-encoded signature')
  .option('-j, --json', 'Output in JSON format')
  .action((address: string, message: string, signature: string, options: { json?: boolean }) => {
    try {
      const result = verifyNanoMessage(address, message, signature);
      printJsonOrText({ address, message, signature, valid: result.valid }, options, () => {
        if (result.valid) console.log('Signature is VALID');
        else {
          console.error('Signature is INVALID');
          process.exit(1);
        }
      });
    } catch (error) {
      exitWithError(error);
    }
  });

const rpcCmd = program.command('rpc').helpGroup('Advanced & RPC').description('Query a Nano node RPC');

rpcCmd
  .command('account-balance')
  .description('Fetch account balance and pending amount')
  .argument('<address>', 'Nano address')
  .option('--url <url>', 'RPC URL override')
  .option('--timeout-ms <ms>', 'Timeout in milliseconds', (value) => parseInt(value, 10), 15000)
  .option('--xno', 'Also include XNO-formatted values')
  .option('-j, --json', 'Output in JSON format')
  .action(async (address: string, options: { url?: string; timeoutMs: number; xno?: boolean; json?: boolean }) => {
    try {
      const client = getNanoClient({ urls: options.url ? options.url.split(',').filter(Boolean) : undefined });
      const result = await rpcAccountBalance(client, address, { timeoutMs: options.timeoutMs });
      const out: any = {
        address,
        balanceRaw: result.balance,
        pendingRaw: result.pending,
        balanceXno: rawToNano(result.balance),
        pendingXno: rawToNano(result.pending),
      };
      if (options.xno) {
        // xno fields already included; flag kept for backward compat
      }
      printJsonOrText(out, options, () => {
        console.log(`Balance (raw): ${result.balance}`);
        console.log(`Pending (raw): ${result.pending}`);
        if (options.xno) {
          console.log(`Balance (XNO): ${rawToNano(result.balance)}`);
          console.log(`Pending (XNO): ${rawToNano(result.pending)}`);
        }
      });
    } catch (error) {
      exitWithError(error);
    }
  });

rpcCmd
  .command('receivable')
  .description('List receivable blocks for an account')
  .argument('<address>', 'Nano address')
  .option('--url <url>', 'RPC URL override')
  .option('--count <n>', 'Max blocks to return', (value) => parseInt(value, 10), 10)
  .option('-j, --json', 'Output in JSON format')
  .action(async (address: string, options: { url?: string; count: number; json?: boolean }) => {
    try {
      const client = getNanoClient({ urls: options.url ? options.url.split(',').filter(Boolean) : undefined });
      const items = await rpcReceivable(client, address, options.count, { timeoutMs: config.timeoutMs || DEFAULT_TIMEOUT_MS });
      printJsonOrText({ account: address, blocks: items }, options, () => {
        if (items.length === 0) {
          console.log('No receivable blocks.');
          return;
        }
        for (const item of items) {
          console.log(`${item.hash}  ${rawToNano(item.amount)} XNO${item.source ? `  from ${item.source}` : ''}`);
        }
      });
    } catch (error) {
      exitWithError(error);
    }
  });

rpcCmd
  .command('account-info')
  .description('Fetch account info including frontier and balance')
  .argument('<address>', 'Nano address')
  .option('--url <url>', 'RPC URL override')
  .option('--xno', 'Also include XNO-formatted balance')
  .option('-j, --json', 'Output in JSON format')
  .action(async (address: string, options: { url?: string; xno?: boolean; json?: boolean }) => {
    try {
      const client = getNanoClient({ urls: options.url ? options.url.split(',').filter(Boolean) : undefined });
      const info = await rpcAccountInfo(client, address, { timeoutMs: config.timeoutMs || DEFAULT_TIMEOUT_MS });
      if (isRpcError(info)) {
        printJsonOrText({ account: address, opened: false }, options, () => console.log('Account not opened (no blocks published).'));
        return;
      }
      const out: any = {
        account: address,
        opened: true,
        frontier: info.frontier,
        balanceRaw: info.balance,
        balanceXno: rawToNano(info.balance),
        representative: info.representative,
      };
      if (options.xno) {
        // balanceXno already included; flag kept for backward compat
      }
      printJsonOrText(out, options, () => {
        console.log(`Frontier: ${info.frontier}`);
        console.log(`Balance (raw): ${info.balance}`);
        if (options.xno) console.log(`Balance (XNO): ${rawToNano(info.balance)}`);
        if (info.representative) console.log(`Representative: ${info.representative}`);
      });
    } catch (error) {
      exitWithError(error);
    }
  });

rpcCmd
  .command('probe-caps')
  .description('Probe Nano node RPC capabilities (JSON RPC, version, ledger-read, process, remote PoW)')
  .argument('[url]', 'RPC URL(s) to probe, comma-separated (defaults to configured/env URL)')
  .option('--timeout-ms <ms>', 'Timeout per probe in milliseconds', (v) => parseInt(v, 10), 10000)
  .option('-j, --json', 'Output raw JSON result')
  .action(async (url: string | undefined, options: { timeoutMs: number; json?: boolean }) => {
    try {
      const target = url || config.rpcUrl || process.env.NANO_RPC_URL || DEFAULT_RPC_URLS[0];
      const client = getNanoClient({ urls: target ? target.split(',').filter(Boolean) : undefined });
      const result = await rpcProbeCaps(client, target, { timeoutMs: options.timeoutMs });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      const tick = (ok: boolean) => (ok ? '✓' : '✗');
      const ms = (n: number) => `${n}ms`;
      const results = result.results ?? [result];

      for (const item of results) {
        console.log(`\nProbing: ${item.url}`);
        console.log(`─────────────────────────────────────────`);
        console.log(`  Reachable       ${tick(item.reachable)}  (${ms(item.pingMs)})`);
        console.log(`  JSON RPC        ${tick(item.caps.jsonRpc.ok)}  (${ms(item.caps.jsonRpc.latencyMs)})  ${item.caps.jsonRpc.status}`);
        if (item.caps.jsonRpc.detail) {
          console.log(`                  ${item.caps.jsonRpc.detail}`);
        }
        if (item.reachable) {
          console.log(`  Node vendor     ${item.nodeVendor || '(unknown)'}`);
          console.log(`  Network         ${item.network || '(unknown)'}`);
          console.log(`  Protocol        ${item.protocolVersion || '(unknown)'}`);
        }
        console.log(`─────────────────────────────────────────`);
        console.log(`  version         ${tick(item.caps.version.ok)}  (${ms(item.caps.version.latencyMs)})  ${item.caps.version.status}`);
        if (!item.caps.version.ok && item.caps.version.detail) {
          console.log(`                  ${item.caps.version.detail}`);
        }
        console.log(`  block_count     ${tick(item.caps.blockCount.ok)}  (${ms(item.caps.blockCount.latencyMs)})  ${item.caps.blockCount.status}${item.blockCount ? `  count=${item.blockCount} cemented=${item.cementedCount ?? '?'}` : ''}`);
        if (!item.caps.blockCount.ok && item.caps.blockCount.detail) {
          console.log(`                  ${item.caps.blockCount.detail}`);
        }
        console.log(`  process invalid ${tick(item.caps.processInvalid.ok)}  (${ms(item.caps.processInvalid.latencyMs)})  ${item.caps.processInvalid.status}`);
        if (item.caps.processInvalid.detail) {
          console.log(`                  ${item.caps.processInvalid.detail}`);
        }
        console.log(`  work_generate   ${tick(item.caps.workGenerate.ok)}  (${ms(item.caps.workGenerate.latencyMs)})  ${item.caps.workGenerate.status}`);
        if (item.caps.workGenerate.detail) {
          console.log(`                  ${item.caps.workGenerate.detail}`);
        }
        console.log(`─────────────────────────────────────────`);
      }
      console.log('');

      if (!result.reachable) process.exit(1);
    } catch (error) {
      exitWithError(error);
    }
  });

const blockCmd = program.command('block').helpGroup('Advanced & RPC').description('Build unsigned Nano state blocks for manual/expert workflows');

const ZERO_HASH = '0'.repeat(64);

blockCmd
  .command('send')
  .description('Build an unsigned send block')
  .requiredOption('-a, --account <address>', 'Sender Nano address')
  .requiredOption('-t, --to <address>', 'Recipient Nano address')
  .requiredOption('--amount-xno <xno>', 'Amount to send in XNO')
  .option('--url <url>', 'RPC URL override')
  .option('-j, --json', 'Output JSON with block hex + metadata')
  .action(async (options: { account: string; to: string; amountXno: string; url?: string; json?: boolean }) => {
    try {
      const client = getNanoClient({ urls: options.url ? options.url.split(',').filter(Boolean) : undefined });
      const senderPk = decodeNanoAddress(options.account).publicKey;
      const recipientPk = decodeNanoAddress(options.to).publicKey;
      const info = await rpcAccountInfo(client, options.account, { timeoutMs: config.timeoutMs || DEFAULT_TIMEOUT_MS });
      if (isRpcError(info)) {
        console.error(`Error: account not opened (${info.error}). Cannot send from an unopened account.`);
        process.exit(1);
      }
      const currentBalance = BigInt(info.balance);
      const sendRaw = BigInt(nanoToRaw(options.amountXno));
      if (sendRaw <= 0n) {
        console.error('Error: amount must be positive.');
        process.exit(1);
      }
      if (sendRaw > currentBalance) {
        console.error(`Error: insufficient balance. Have ${rawToNano(info.balance)} XNO, sending ${options.amountXno} XNO.`);
        process.exit(1);
      }
      const blockHex = buildNanoStateBlockHex({
        accountPublicKey: senderPk,
        previous: info.frontier,
        representativePublicKey: decodeNanoAddress(info.representative || DEFAULT_REPRESENTATIVE).publicKey,
        balanceRaw: (currentBalance - sendRaw).toString(),
        link: recipientPk,
      });
      printJsonOrText({ blockHex, account: options.account, to: options.to, amountRaw: sendRaw.toString(), previous: info.frontier }, options, () => console.log(blockHex));
    } catch (error) {
      exitWithError(error);
    }
  });

blockCmd
  .command('receive')
  .description('Build an unsigned receive block')
  .requiredOption('-a, --account <address>', 'Recipient Nano address')
  .option('--hash <blockhash>', 'Hash of the pending send block')
  .option('--amount-raw <raw>', 'Amount in raw')
  .option('--amount-xno <xno>', 'Amount in XNO')
  .option('--url <url>', 'RPC URL override')
  .option('-j, --json', 'Output JSON with block hex + metadata')
  .action(async (options: { account: string; hash?: string; amountRaw?: string; amountXno?: string; url?: string; json?: boolean }) => {
    try {
      if (options.amountRaw && options.amountXno) {
        console.error('Error: specify --amount-raw or --amount-xno, not both.');
        process.exit(1);
      }
      const client = getNanoClient({ urls: options.url ? options.url.split(',').filter(Boolean) : undefined });
      const accountPk = decodeNanoAddress(options.account).publicKey;
      let hash = options.hash;
      let amountRaw = options.amountRaw || (options.amountXno ? nanoToRaw(options.amountXno) : undefined);
      if (hash && !amountRaw) {
        console.error('Error: when --hash is provided, --amount-raw or --amount-xno is also required.');
        process.exit(1);
      }
      if (!hash) {
        const pending = await rpcReceivable(client, options.account, 1, { timeoutMs: config.timeoutMs || DEFAULT_TIMEOUT_MS });
        if (pending.length === 0) {
          console.error('Error: no receivable blocks found for this account.');
          process.exit(1);
        }
        hash = pending[0].hash;
        amountRaw = amountRaw || pending[0].amount;
        console.error(`Auto-detected pending block: ${hash} (${rawToNano(amountRaw)} XNO)`);
      }
      let info = await rpcAccountInfo(client, options.account, { timeoutMs: config.timeoutMs || DEFAULT_TIMEOUT_MS }).catch(() => ({ error: 'Account not found' } as NanoRpcErrorResponse));
      const opened = !isRpcError(info);
      const previous = opened ? info.frontier : ZERO_HASH;
      const currentBalance = opened ? BigInt(info.balance) : 0n;
      const blockHex = buildNanoStateBlockHex({
        accountPublicKey: accountPk,
        previous,
        representativePublicKey: decodeNanoAddress(opened ? info.representative || DEFAULT_REPRESENTATIVE : DEFAULT_REPRESENTATIVE).publicKey,
        balanceRaw: (currentBalance + BigInt(amountRaw!)).toString(),
        link: hash!,
      });
      printJsonOrText({ blockHex, account: options.account, sendBlockHash: hash, amountRaw, previous, subtype: opened ? 'receive' : 'open' }, options, () => console.log(blockHex));
    } catch (error) {
      exitWithError(error);
    }
  });

blockCmd
  .command('change')
  .description('Build an unsigned change block')
  .requiredOption('-a, --account <address>', 'Nano account address')
  .requiredOption('--representative <address>', 'New Nano representative address')
  .option('--url <url>', 'RPC URL override')
  .option('-j, --json', 'Output JSON with block hex + metadata')
  .action(async (options: { account: string; representative: string; url?: string; json?: boolean }) => {
    try {
      const rep = validateAddress(options.representative);
      if (!rep.valid || !rep.publicKey) {
        console.error(`Error: invalid representative address (${rep.error}).`);
        process.exit(1);
      }
      const client = getNanoClient({ urls: options.url ? options.url.split(',').filter(Boolean) : undefined });
      const info = await rpcAccountInfo(client, options.account, { timeoutMs: config.timeoutMs || DEFAULT_TIMEOUT_MS });
      if (isRpcError(info)) {
        console.error(`Error: account not opened (${info.error}). Cannot change representative on an unopened account.`);
        process.exit(1);
      }
      const blockHex = buildNanoStateBlockHex({
        accountPublicKey: decodeNanoAddress(options.account).publicKey,
        previous: info.frontier,
        representativePublicKey: rep.publicKey,
        balanceRaw: info.balance,
        link: ZERO_HASH,
      });
      printJsonOrText({ blockHex, account: options.account, representative: options.representative, previous: info.frontier }, options, () => console.log(blockHex));
    } catch (error) {
      exitWithError(error);
    }
  });

const mcpHelp = `
Configuration for popular AI agent harnesses:

Preferred (global install — avoids npx concurrency handshake failures):

  npm install -g xno-skills@4.5.2

1. Claude Desktop / Cursor / Roo Code (in config.json):
{
  "mcpServers": {
    "xno": {
      "command": "xno-skills",
      "args": ["mcp"]
    }
  }
}

2. Gemini CLI:
  gemini mcp add xno xno-skills mcp

3. Claude Code:
  claude mcp add xno xno-skills mcp

Fallback (if global install is not possible):

1. Claude Desktop / Cursor / Roo Code (in config.json):
{
  "mcpServers": {
    "xno": {
      "command": "npx",
      "args": ["-y", "xno-skills@4.5.2", "mcp"]
    }
  }
}

2. Gemini CLI:
  gemini mcp add xno npx -y xno-skills@4.5.2 mcp

3. Claude Code:
  claude mcp add xno npx -y xno-skills@4.5.2 mcp

To run the MCP server directly in this terminal:
  xno-skills mcp        (if globally installed)
  npx -y xno-skills mcp (fallback)
`;

program
  .command('diag')
  .helpGroup('System')
  .description('Show diagnostics and system information')
  .option('-j, --json', 'Output in JSON format')
  .option('--retune', 'Rerun PoW profiling and overwrite cached tuning')
  .action(async (options: { json?: boolean, retune?: boolean }) => {
    if (options.retune) {
      try {
        const { clearPowTuningCache, recommendLocalPow } = await import('nano-rspow-node');
        clearPowTuningCache();
        recommendLocalPow(); // repopulates cache
        console.log('PoW tuning cache cleared and retuned.');
      } catch (e) {
        console.error('Failed to retune:', e);
      }
    }
    let localPowRecommended = false;
    try {
      const { recommendLocalPow } = await import('nano-rspow-node');
      localPowRecommended = getEffectiveLocalPowRecommended(recommendLocalPow);
    } catch (e) {}
    const effectiveWorkUrls = resolveEffectiveWorkUrls(config);
    const info = getSystemInfo({
      localPowRecommended,
      effectiveRpcUrls: resolveEffectiveRpcUrls(undefined, config),
      effectiveWorkUrls,
    });
    
    if (options.json) {
      console.log(JSON.stringify(info, null, 2));
    } else {
      console.log(formatSystemInfo(info));
    }
  });

program
  .command('mcp')
  .helpGroup('System')
  .description('Start the MCP server or view configuration instructions')
  .addHelpText('after', mcpHelp)
  .action(async () => {
    try {
      const { runMcpServer } = await import('./mcp.js');
      await runMcpServer();
    } catch (error: any) {
      console.error(`Failed to start MCP server: ${error?.message ?? error}`);
      process.exit(1);
    }
  });

program.configureHelp({ showGlobalOptions: true });

// NanoClient's HTTP connection pool keeps the event loop alive after commands
// complete. Force a clean exit for short-lived CLI commands; the MCP server
// (a long-running process) handles its own lifecycle.
const isMcp = process.argv.includes('mcp');
program.parseAsync(process.argv).then(() => {
  if (!isMcp) process.exit(0);
});
