#!/usr/bin/env node

import { Command } from 'commander';
import { validateAddress } from './validate.js';
import { nanoToRaw, rawToNano, knanoToRaw, mnanoToRaw } from './convert.js';
import { generateAsciiQr, buildNanoUri } from './qr.js';
import { rpcAccountBalance, rpcAccountInfo, rpcReceivable, rpcProbeCaps, type AccountInfoResponse, type NanoRpcErrorResponse } from './rpc.js';
import { decodeNanoAddress } from './nano-address.js';
import { nanoGetPublicKeyFromPrivateKey } from './ed25519-blake2b.js';
import { buildNanoStateBlockHex } from './state-block.js';
import { NanoClient, WorkProvider, NOMS } from '@openrai/nano-core';
import { version } from './version.js';
import {
  DEFAULT_REPRESENTATIVE,
  DEFAULT_TIMEOUT_MS,
  executeChange,
  executeReceive,
  executeSend,
  getNanoBalance,
  getNanoPending,
  listNanoWallets,
  signWalletMessage,
  submitPreparedBlock,
  toToolError,
  verifyNanoMessage,
} from './nano-actions.js';
import { loadConfig, loadTransactions, type XnoConfig } from './state-store.js';

const whiteFg=`\x1b[38;2;255;255;255m`
const greyFg=`\x1b[38;2;155;155;155m`
const blueFg=`\x1b[38;2;37;156;233m`
const marineBg=`\x1b[48;2;31;32;76m`
const reset=`\x1b[0m`
const logo=String.raw`MB[K
   __W/\\/\\\\\\B____W/\\\\\\\\\B_____W/\\/\\\\\\B_______W/\\\\\B____[K
    _W\/\\\G////W\\\B__W\G////////W\\\B___W\/\\\G////W\\\B____W/\\\G///W\\\B__[K
     _W\/\\\B__W\/G/W\\\B___W/\\\\\\\\\\B__W\/\\\B__W\/G/W\\\B__W/\\\B__W\/G/W\\B__[K
      _W\/\\\B___W\/\\\B__W/\\\G/////W\\\B__W\/\\\B___W\/\\\B_W\/G/W\\\B__W/\\\B__[K
       _W\/\\\B___W\/\\\B_W\//\\\\\\\/\B___W\/\\\B___W\/\\\B__W\/G//W\\\\/B____[K
        _W\/G//B____W\/G//B___W\/G///////W\/G/B__W\/G//B____W\/G//B_____W\/G////B_____[K
                                                  WMxno-skills v${version}[K
[K[0m

Interact with the Nano ($XNO / Ӿ) cryptocurrency`
.replaceAll('W',whiteFg)
.replaceAll('G',greyFg)
.replaceAll('B',blueFg)
.replaceAll('M',marineBg)

function getFullDescription(): string {
  return logo;
}

const program = new Command();
const config: XnoConfig = loadConfig();
const transactions = loadTransactions();

const DEFAULT_RPC_URLS = [
  'https://rainstorm.city/api',
  'https://nanoslo.0x.no/proxy',
];

function getNanoClient(options?: { url?: string }): NanoClient {
  const rpc = options?.url || config.rpcUrl || process.env.NANO_RPC_URL;
  const work = config.workPeerUrl || process.env.XNO_WORK_URL;
  return NanoClient.initialize({
    rpc: rpc ? [rpc] : DEFAULT_RPC_URLS,
    workProvider: WorkProvider.auto({
      ...(work ? { urls: work.split(',').filter(Boolean) } : {}),
      timeoutMs: config.timeoutMs || DEFAULT_TIMEOUT_MS,
    }),
  });
}

function readersFor(options?: { url?: string }) {
  const client = getNanoClient(options);
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  return {
    accountInfo: (address: string) => rpcAccountInfo(client, address, { timeoutMs }),
    accountBalance: (address: string) => rpcAccountBalance(client, address, { timeoutMs }),
    receivable: (address: string, count: number) => rpcReceivable(client, address, count, { timeoutMs }),
  };
}

function isRpcError(resp: any): resp is NanoRpcErrorResponse {
  return typeof resp?.error === 'string';
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
  .option('-q, --quiet', 'Suppress non-essential output');

program.addHelpText('beforeAll', getFullDescription() + '\n');
program.on('--help', () => {
  // kept for subcommand compat — banner already printed via addHelpText('beforeAll')
});

program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  (thisCommand as any).globalOpts = {
    quiet: opts.quiet || false,
  };
});

program
  .command('wallets')
  .description('List OWS wallets that have Nano accounts')
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
  .description('Show Nano balance and pending amount for an OWS wallet')
  .requiredOption('--wallet <name>', 'OWS wallet name')
  // .option('--index <n>', 'Nano account index', (value) => parseInt(value, 10), 0)
  .option('-j, --json', 'Output in JSON format')
  .action(async (options: { wallet: string; json?: boolean }) => {
    try {
      const result = await getNanoBalance(options.wallet, readersFor(), { config }, 0);
      printJsonOrText(result, options, () => {
        console.log(`Address: ${result.address}`);
        console.log(`Balance: ${result.balanceXno} XNO`);
        console.log(`Pending: ${result.pendingXno} XNO`);
      });
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command('pending')
  .description('List receivable Nano blocks for an OWS wallet')
  .requiredOption('--wallet <name>', 'OWS wallet name')
  // .option('--index <n>', 'Nano account index', (value) => parseInt(value, 10), 0)
  .option('--count <n>', 'Max receivable blocks to return', (value) => parseInt(value, 10), 10)
  .option('-j, --json', 'Output in JSON format')
  .action(async (options: { wallet: string; count: number; json?: boolean }) => {
    try {
      const result = await getNanoPending(options.wallet, readersFor(), { config }, { index: 0, count: options.count });
      printJsonOrText(result, options, () => {
        if (result.blocks.length === 0) {
          console.log('No receivable blocks.');
          return;
        }
        for (const block of result.blocks) {
          console.log(`${block.hash}  ${rawToNano(block.amount)} XNO${block.source ? `  from ${block.source}` : ''}`);
        }
      });
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command('receive')
  .description('Receive pending Nano blocks for an OWS wallet')
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
  .description('Send Nano from an OWS wallet')
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
  .command('change')
  .description('Submit a Nano change representative block')
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
  .description('Sign and submit a prepared Nano block hex using an OWS wallet')
  .requiredOption('--wallet <name>', 'OWS wallet name')
  .requiredOption('--tx-hex <hex>', 'Prepared unsigned Nano block hex')
  .requiredOption('--subtype <type>', 'Block subtype: send, receive, open, or change')
  // .option('--index <n>', 'Nano account index', (value) => parseInt(value, 10), 0)
  .option('-j, --json', 'Output in JSON format')
  .action(async (options: { wallet: string; txHex: string; subtype: 'send' | 'receive' | 'open' | 'change'; json?: boolean }) => {
    try {
      const result = await submitPreparedBlock(options.wallet, config.rpcUrl || process.env.NANO_RPC_URL, { config }, options.txHex, options.subtype, { index: 0 });
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
  .description('Show Nano transaction history tracked by xno-skills for an OWS wallet')
  .requiredOption('--wallet <name>', 'OWS wallet name')
  // .option('--index <n>', 'Nano account index')
  .option('--limit <n>', 'Max entries to show', (value) => parseInt(value, 10), 20)
  .option('-j, --json', 'Output in JSON format')
  .action((options: { wallet: string; limit: number; json?: boolean }) => {
    let history = transactions.filter((entry) => entry.owsWalletId === options.wallet);
    history = history.slice(0, options.limit);
    printJsonOrText(history, options, () => {
      if (history.length === 0) {
        console.log('No tracked transactions.');
        return;
      }
      for (const entry of history) {
        console.log(`${entry.timestamp}  ${entry.type}  ${entry.hash}`);
      }
    });
  });

program
  .command('sign-message')
  .description('Sign a Nano off-chain message with an OWS wallet')
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

program
  .command('verify-message')
  .description('Verify a Nano off-chain message signature')
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
  .description('Convert between XNO units')
  .argument('<amount>', 'Value to convert')
  .argument('<from>', 'Source unit: xno, raw, mnano, or knano')
  .option('-j, --json', 'Output in JSON format')
  .action((amount: string, from: string, options: { json?: boolean }) => {
    const normalizeUnit = (unit: string): string => {
      const value = unit.toLowerCase();
      if (value === 'xno' || value === 'nano') return 'xno';
      if (value === 'raw' || value === 'rai') return 'raw';
      if (value === 'mnano' || value === 'mrai') return 'mnano';
      if (value === 'knano' || value === 'krai') return 'knano';
      return value;
    };

    const fromUnit = normalizeUnit(from);

    let rawValue: string;
    switch (fromUnit) {
      case 'xno': rawValue = nanoToRaw(amount); break;
      case 'mnano': rawValue = mnanoToRaw(amount); break;
      case 'knano': rawValue = knanoToRaw(amount); break;
      case 'raw': rawValue = amount; break;
      default:
        console.error(`Unknown source unit: ${fromUnit}. Use xno, raw, mnano, or knano.`);
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
  .description('Generate a QR code for a Nano address')
  .argument('<address>', 'Nano address')
  .option('--amount-xno <amount>', 'Include amount in XNO')
  .option('-j, --json', 'Output in JSON format')
  .action(async (address: string, options: { amountXno?: string; json?: boolean }) => {
    const validation = validateAddress(address);
    if (!validation.valid) {
      console.error(`Invalid address: ${validation.error}`);
      process.exit(1);
    }
    try {
      const content = buildNanoUri(address, options.amountXno);
      const qr = await generateAsciiQr(address, options.amountXno);
      printJsonOrText({ address, amountXno: options.amountXno ?? null, content, qr }, options, () => {
        console.log(qr);
        console.log(address);
        if (options.amountXno) console.log(`${options.amountXno} XNO`);
      });
    } catch (error: any) {
      console.error(`Error: ${error?.message ?? error}`);
      process.exit(1);
    }
  });

program
  .command('validate')
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

const rpcCmd = program.command('rpc').description('Query a Nano node RPC');

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
      const client = getNanoClient({ url: options.url });
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
      const client = getNanoClient({ url: options.url });
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
      const client = getNanoClient({ url: options.url });
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
  .description('Probe a Nano node RPC for capabilities (version, ledger-read, remote PoW)')
  .argument('[url]', 'RPC URL to probe (defaults to configured/env URL)')
  .option('--timeout-ms <ms>', 'Timeout per probe in milliseconds', (v) => parseInt(v, 10), 10000)
  .option('-j, --json', 'Output raw JSON result')
  .action(async (url: string | undefined, options: { timeoutMs: number; json?: boolean }) => {
    try {
      const target = url || config.rpcUrl || process.env.NANO_RPC_URL || DEFAULT_RPC_URLS[0];
      const client = getNanoClient({ url: target });
      const result = await rpcProbeCaps(client, target, { timeoutMs: options.timeoutMs });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      const tick = (ok: boolean) => (ok ? '✓' : '✗');
      const ms = (n: number) => `${n}ms`;

      console.log(`\nProbing: ${result.url}`);
      console.log(`─────────────────────────────────────────`);
      console.log(`  Reachable       ${tick(result.reachable)}  (${ms(result.pingMs)})`);
      if (result.reachable) {
        console.log(`  Node vendor     ${result.nodeVendor || '(unknown)'}`);
        console.log(`  Network         ${result.network || '(unknown)'}`);
        console.log(`  Protocol        ${result.protocolVersion || '(unknown)'}`);
      }
      console.log(`─────────────────────────────────────────`);
      console.log(`  version         ${tick(result.caps.version.ok)}  (${ms(result.caps.version.latencyMs)})`);
      if (!result.caps.version.ok && result.caps.version.detail) {
        console.log(`                  ${result.caps.version.detail}`);
      }
      console.log(`  block_count     ${tick(result.caps.blockCount.ok)}  (${ms(result.caps.blockCount.latencyMs)})${result.blockCount ? `  count=${result.blockCount} cemented=${result.cementedCount ?? '?'}` : ''}`);
      if (!result.caps.blockCount.ok && result.caps.blockCount.detail) {
        console.log(`                  ${result.caps.blockCount.detail}`);
      }
      console.log(`  work_generate   ${tick(result.caps.workGenerate.ok)}  (${ms(result.caps.workGenerate.latencyMs)})${result.caps.workGenerate.detail ? `  [${result.caps.workGenerate.detail}]` : ''}`);
      console.log(`─────────────────────────────────────────\n`);

      if (!result.reachable) process.exit(1);
    } catch (error) {
      exitWithError(error);
    }
  });

const blockCmd = program.command('block').description('Build unsigned Nano state blocks for manual/expert workflows');

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
      const client = getNanoClient({ url: options.url });
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
      const client = getNanoClient({ url: options.url });
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
      const client = getNanoClient({ url: options.url });
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

1. Claude Desktop / Cursor / Roo Code (in config.json):
{
  "mcpServers": {
    "xno": {
      "command": "npx",
      "args": ["-y", "xno-skills@latest", "mcp"]
    }
  }
}

2. Gemini CLI:
  gemini mcp add xno npx -y xno-skills@latest mcp

3. Claude Code:
  claude mcp add xno npx -y xno-skills@latest mcp

To run the MCP server directly in this terminal:
  npx -y xno-skills mcp
`;

program
  .command('mcp')
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

program.parse(process.argv);
