#!/usr/bin/env node

import { Command } from 'commander';
import { generateSeed, generateMnemonic, seedToMnemonic, mnemonicToSeed, validateMnemonic } from './seed.js';
import { deriveAddressLegacy } from './address-legacy.js';
import { deriveAddressBIP44 } from './address-bip44.js';
import { validateAddress } from './validate.js';
import { nanoToRaw, rawToNano, knanoToRaw, mnanoToRaw } from './convert.js';
import { generateAsciiQr, buildNanoUri } from './qr.js';
import { rpcAccountBalance, rpcAccountsBalances, rpcAccountsFrontiers } from './rpc.js';
import { pkg, version } from './version.js';

const programName = pkg.name;

async function readAllStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function mnemonicWordCount(mnemonic: string): number {
  return mnemonic.trim().split(/\s+/).filter(Boolean).length;
}

function warnUnsafeMnemonicArg(): void {
  console.error(
    'Warning: passing a mnemonic on the command line can leak via shell history, logs, or process lists.\n' +
    'Prefer `--stdin` (e.g. `read -s MN; echo \"$MN\" | xno-skills wallet from-mnemonic --stdin ...`) or an offline workflow.'
  );
}

const whiteFg=`\x1b[38;2;255;255;255m`
const greyFg=`\x1b[38;2;155;155;155m`
const blueFg=`\x1b[38;2;37;156;233m`
const marineBg=`\x1b[48;2;31;32;76m`
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

const program = new Command();

program
  .name(programName)
  .description(logo)
  .version(version)
  .option('-q, --quiet', 'Suppress non-essential output');

// Global options accessible via hook
program
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    (thisCommand as any).globalOpts = {
      quiet: opts.quiet || false,
    };
  });

// Wallet command group
const walletCmd = program
  .command('wallet')
  .description('Wallet operations');

walletCmd
  .command('create')
  .description('Create a new wallet')
  .option('-f, --format <format>', 'Derivation format: bip39 (default) or legacy', 'bip39')
  .option('-w, --words <n>', 'BIP39 word count (12/15/18/21/24). Only used for --format bip39.', (v) => parseInt(v, 10), 24)
  .option('-p, --passphrase <passphrase>', 'Optional BIP39 passphrase (only for --format bip39)')
  .option('-i, --index <n>', 'Account index (default: 0)', (v) => parseInt(v, 10), 0)
  .option('-s, --seed', 'Output hex seed')
  .option('-m, --mnemonic', 'Output 24-word mnemonic phrase')
  .option('-j, --json', 'Output in JSON format')
  .action((options) => {
    const format = String(options.format || 'bip39').toLowerCase();

    if (format !== 'bip39' && format !== 'legacy') {
      console.error(`Error: Invalid format '${options.format}'. Use 'bip39' or 'legacy'.`);
      process.exit(1);
    }

    if (options.seed && format !== 'legacy') {
      console.error(`Error: --seed is only supported for --format legacy.`);
      process.exit(1);
    }

    let mnemonic: string;
    let seed: string | undefined;
    let addressResult: { address: string; privateKey: string; publicKey: string };

    if (format === 'bip39') {
      mnemonic = generateMnemonic(options.words);
      addressResult = deriveAddressBIP44(mnemonic, options.index, options.passphrase || '');
    } else {
      seed = generateSeed();
      mnemonic = seedToMnemonic(seed);
      addressResult = deriveAddressLegacy(seed, options.index);
    }

    if (options.json) {
      const out: any = {
        format,
        index: options.index,
        mnemonic,
        address: addressResult.address,
        privateKey: addressResult.privateKey,
        publicKey: addressResult.publicKey,
      };
      if (format === 'legacy') out.seed = seed;
      console.log(JSON.stringify(out, null, 2));
    } else if (options.mnemonic) {
      console.log(mnemonic);
    } else if (options.seed) {
      console.log(seed);
    } else {
      if (format === 'legacy') console.log(`Seed: ${seed}`);
      console.log(`Mnemonic: ${mnemonic}`);
      console.log(`Address: ${addressResult.address}`);
    }
  });

walletCmd
  .command('from-mnemonic')
  .description('Create wallet from mnemonic phrase')
  .argument('[mnemonic]', 'BIP39 mnemonic (12/15/18/21/24 words). If omitted, use --stdin or --mnemonic-env.')
  .option('-f, --format <format>', 'Import format: auto (default), bip39, or legacy', 'auto')
  .option('-p, --passphrase <passphrase>', 'Optional BIP39 passphrase (only for bip39)')
  .option('-i, --index <n>', 'Account index (default: 0)', (v) => parseInt(v, 10), 0)
  .option('--both', 'When format=auto and mnemonic is 24 words, output both bip39 and legacy derivations (JSON only)')
  .option('--stdin', 'Read mnemonic from stdin (recommended; avoids shell history)')
  .option('--mnemonic-env <name>', 'Read mnemonic from env var (e.g. XNO_MNEMONIC)')
  .option('-j, --json', 'Output in JSON format')
  .action(async (mnemonicArg: string | undefined, options) => {
    try {
      let mnemonic = mnemonicArg;
      if (options.mnemonicEnv) {
        mnemonic = process.env[String(options.mnemonicEnv)];
      } else if (options.stdin) {
        mnemonic = (await readAllStdin()).trim();
      }
      if (!mnemonic) throw new Error('Mnemonic required (pass as argument, or use --stdin / --mnemonic-env).');

      if (mnemonicArg && !options.stdin && !options.mnemonicEnv) warnUnsafeMnemonicArg();

      const wordCount = mnemonicWordCount(mnemonic);
      if (!validateMnemonic(mnemonic)) throw new Error('Invalid BIP39 mnemonic');

      const format = String(options.format || 'auto').toLowerCase();
      if (!['auto', 'bip39', 'legacy'].includes(format)) {
        throw new Error(`Invalid format '${options.format}'. Use auto, bip39, or legacy.`);
      }

      const deriveLegacy = () => {
        if (wordCount !== 24) throw new Error('Legacy mnemonic import requires 24 words');
        const seed = mnemonicToSeed(mnemonic);
        return { seed, ...deriveAddressLegacy(seed, options.index) };
      };

      const deriveBip39 = () => deriveAddressBIP44(mnemonic, options.index, options.passphrase || '');

      if (options.both && (!options.json || format !== 'auto' || wordCount !== 24)) {
        throw new Error('--both is only valid with --json, --format auto, and a 24-word mnemonic');
      }

      if (format === 'legacy') {
        const legacy = deriveLegacy();
        if (options.json) {
          console.log(JSON.stringify({ format: 'legacy', index: options.index, mnemonic, ...legacy }, null, 2));
        } else {
          console.log(`Address: ${legacy.address}`);
        }
        return;
      }

      if (format === 'bip39' || (format === 'auto' && wordCount !== 24)) {
        const bip39 = deriveBip39();
        if (options.json) {
          console.log(JSON.stringify({ format: 'bip39', index: options.index, mnemonic, ...bip39 }, null, 2));
        } else {
          console.log(`Address: ${bip39.address}`);
        }
        return;
      }

      // format=auto and 24-word mnemonic: ambiguous; prefer BIP39 by default.
      if (options.both) {
        const bip39 = deriveBip39();
        const legacy = deriveLegacy();
        console.log(JSON.stringify({ format: 'auto', index: options.index, mnemonic, bip39, legacy }, null, 2));
        return;
      }

      const bip39 = deriveBip39();

      if (options.json) {
        console.log(JSON.stringify({
          format: 'bip39',
          index: options.index,
          mnemonic,
          address: bip39.address,
          privateKey: bip39.privateKey,
          publicKey: bip39.publicKey
        }, null, 2));
      } else {
        console.log(`Address: ${bip39.address}`);
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  });

walletCmd
  .command('probe-mnemonic')
  .description('Try bip39 + legacy derivations and probe first N indexes via RPC (helps resolve ambiguity)')
  .argument('[mnemonic]', 'BIP39 mnemonic (12/15/18/21/24 words). If omitted, use --stdin or --mnemonic-env.')
  .option('-p, --passphrase <passphrase>', 'Optional BIP39 passphrase (only affects bip39)')
  .option('-c, --count <n>', 'How many account indexes to check per format', (v) => parseInt(v, 10), 5)
  .option('--url <url>', 'RPC URL (or set NANO_RPC_URL)')
  .option('--stdin', 'Read mnemonic from stdin (recommended; avoids shell history)')
  .option('--mnemonic-env <name>', 'Read mnemonic from env var (e.g. XNO_MNEMONIC)')
  .option('--json', 'Output JSON')
  .action(async (mnemonicArg: string | undefined, options: { passphrase?: string; count: number; url?: string; json?: boolean; stdin?: boolean; mnemonicEnv?: string }) => {
    const rpcUrl = options.url || process.env.NANO_RPC_URL;
    if (!rpcUrl) {
      console.error('Missing RPC URL. Pass --url or set NANO_RPC_URL.');
      process.exit(1);
    }

    let mnemonic = mnemonicArg;
    if (options.mnemonicEnv) {
      mnemonic = process.env[String(options.mnemonicEnv)];
    } else if (options.stdin) {
      mnemonic = (await readAllStdin()).trim();
    }
    if (!mnemonic) {
      console.error('Mnemonic required (pass as argument, or use --stdin / --mnemonic-env).');
      process.exit(1);
    }

    if (mnemonicArg && !options.stdin && !options.mnemonicEnv) warnUnsafeMnemonicArg();

    if (!validateMnemonic(mnemonic)) {
      console.error('Invalid BIP39 mnemonic.');
      process.exit(1);
    }

    const wordCount = mnemonicWordCount(mnemonic);
    const count = Math.max(1, Math.min(100, options.count || 5));

    const results: any = { mnemonicWordCount: wordCount, count, bip39: [], legacy: [] };
    const allAddresses: string[] = [];

    for (let i = 0; i < count; i++) {
      const bip39 = deriveAddressBIP44(mnemonic, i, options.passphrase || '');
      results.bip39.push({ index: i, address: bip39.address });
      allAddresses.push(bip39.address);
    }

    if (wordCount === 24) {
      const legacySeed = mnemonicToSeed(mnemonic);
      for (let i = 0; i < count; i++) {
        const legacy = deriveAddressLegacy(legacySeed, i);
        results.legacy.push({ index: i, address: legacy.address });
        allAddresses.push(legacy.address);
      }
    }

    try {
      const balances = await rpcAccountsBalances(rpcUrl, allAddresses);
      const frontiers = await rpcAccountsFrontiers(rpcUrl, allAddresses);

      const annotate = (arr: any[]) => arr.map((x) => {
        const b = balances.balances?.[x.address];
        const opened = Boolean(frontiers.frontiers?.[x.address]);
        return {
          ...x,
          opened,
          balanceRaw: b?.balance ?? '0',
          pendingRaw: b?.pending ?? '0',
          balanceXno: rawToNano(b?.balance ?? '0'),
          pendingXno: rawToNano(b?.pending ?? '0'),
        };
      });

      results.bip39 = annotate(results.bip39);
      results.legacy = annotate(results.legacy);

      const bip39Hit = results.bip39.some((x: any) => x.opened || x.balanceRaw !== '0' || x.pendingRaw !== '0');
      const legacyHit = results.legacy.some((x: any) => x.opened || x.balanceRaw !== '0' || x.pendingRaw !== '0');
      results.likelyFormat = bip39Hit && !legacyHit ? 'bip39' : legacyHit && !bip39Hit ? 'legacy' : 'ambiguous';
    } catch (e: any) {
      console.error(`Error: ${e?.message ?? e}`);
      process.exit(1);
    }

    if (options.json) console.log(JSON.stringify(results, null, 2));
    else {
      console.log(`Likely format: ${results.likelyFormat}`);
      for (const row of results.bip39) console.log(`bip39[${row.index}] ${row.address} opened=${row.opened} bal=${row.balanceXno} pending=${row.pendingXno}`);
      for (const row of results.legacy) console.log(`legacy[${row.index}] ${row.address} opened=${row.opened} bal=${row.balanceXno} pending=${row.pendingXno}`);
    }
  });

// Convert command
program
  .command('convert')
  .description('Convert between XNO units')
  .argument('<amount>', 'Value to convert')
  .argument('[from]', 'Source unit (xno, raw, mnano, knano)')
  .option('-t, --to <unit>', 'Target unit (xno, raw, mnano, knano)')
  .option('-j, --json', 'Output in JSON format')
  .action((amount: string, from: string | undefined, options: { to?: string; json?: boolean }) => {
    const normalizeUnit = (unit: string): string => {
      const u = unit.toLowerCase();
      if (u === 'xno' || u === 'nano') return 'xno';
      if (u === 'raw' || u === 'rai') return 'raw';
      if (u === 'mnano' || u === 'mrai') return 'mnano';
      if (u === 'knano' || u === 'krai') return 'knano';
      return u;
    };

    const toUnit = normalizeUnit(options.to || from || 'xno');
    const fromUnit = normalizeUnit(from || 'xno');

    let rawValue: string;

    switch (fromUnit) {
      case 'xno':
        rawValue = nanoToRaw(amount);
        break;
      case 'mnano':
        rawValue = mnanoToRaw(amount);
        break;
      case 'knano':
        rawValue = knanoToRaw(amount);
        break;
      case 'raw':
        rawValue = amount;
        break;
      default:
        console.error(`Unknown source unit: ${fromUnit}`);
        process.exit(1);
    }

    let result: string;

    switch (toUnit) {
      case 'xno':
        result = rawToNano(rawValue);
        break;
      case 'mnano':
        result = rawToNano(rawValue, 24);
        break;
      case 'knano':
        result = rawToNano(rawValue, 27);
        break;
      case 'raw':
        result = rawValue;
        break;
      default:
        console.error(`Unknown target unit: ${toUnit}`);
        process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify({
        from: amount,
        fromUnit,
        to: result,
        toUnit
      }, null, 2));
    } else {
      console.log(`${amount} ${fromUnit} = ${result} ${toUnit}`);
    }
  });

// QR code command
program
  .command('qr')
  .description('Generate QR code for address or amount')
  .argument('<address>', 'Nano address')
  .option('-a, --amount <amount>', 'Include amount in Nano (decimal)')
  .option('-j, --json', 'Output in JSON format')
  .action(async (address: string, options: { amount?: string; json?: boolean }) => {
    const validation = validateAddress(address);
    if (!validation.valid) {
      console.error(`Invalid address: ${validation.error}`);
      process.exit(1);
    }

    let content: string;
    try {
      content = buildNanoUri(address, options.amount);
    } catch (error: any) {
      console.error(`Invalid amount: ${options.amount}`);
      process.exit(1);
    }

    let asciiQr: string;
    try {
      asciiQr = await generateAsciiQr(address, options.amount);
    } catch (error: any) {
      console.error(`Failed to generate QR: ${error?.message ?? error}`);
      process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify({
        address,
        amount: options.amount ?? null,
        content,
        qr: asciiQr
      }, null, 2));
    } else {
      console.log(`${asciiQr}\n${content}`);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate Nano address or block')
  .argument('<input>', 'Address or block hash to validate')
  .option('-j, --json', 'Output in JSON format')
  .action((input: string, options: { json?: boolean }) => {
    const result = validateAddress(input);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.valid) {
        console.log('Valid Nano address');
        if (result.publicKey) console.log(`Public Key: ${result.publicKey}`);
      } else {
        console.error(`Invalid: ${result.error}`);
        process.exit(1);
      }
    }
  });

// RPC helpers
const rpcCmd = program
  .command('rpc')
  .description('Query a Nano node RPC (requires network access)');

rpcCmd
  .command('account-balance')
  .description('Fetch account balance + pending (raw) from a Nano node')
  .argument('<address>', 'Nano address')
  .option('--url <url>', 'RPC URL (or set NANO_RPC_URL)')
  .option('--timeout-ms <ms>', 'Timeout in milliseconds', (v) => parseInt(v, 10), 15000)
  .option('--xno', 'Also include XNO-formatted values')
  .option('-j, --json', 'Output in JSON format')
  .action(async (address: string, options: { url?: string; timeoutMs: number; xno?: boolean; json?: boolean }) => {
    const rpcUrl = options.url || process.env.NANO_RPC_URL;
    if (!rpcUrl) {
      console.error('Missing RPC URL. Pass --url or set NANO_RPC_URL.');
      process.exit(1);
    }

    try {
      const bal = await rpcAccountBalance(rpcUrl, address, { timeoutMs: options.timeoutMs });
      const out: any = { address, balanceRaw: bal.balance, pendingRaw: bal.pending };
      if (options.xno) {
        out.balanceXno = rawToNano(bal.balance);
        out.pendingXno = rawToNano(bal.pending);
      }

      if (options.json) console.log(JSON.stringify(out, null, 2));
      else {
        console.log(`Balance (raw): ${bal.balance}`);
        console.log(`Pending (raw): ${bal.pending}`);
        if (options.xno) {
          console.log(`Balance (XNO): ${rawToNano(bal.balance)}`);
          console.log(`Pending (XNO): ${rawToNano(bal.pending)}`);
        }
      }
    } catch (e: any) {
      console.error(`Error: ${e?.message ?? e}`);
      process.exit(1);
    }
  });

program.configureHelp({
  showGlobalOptions: true
});

program.parse(process.argv);
