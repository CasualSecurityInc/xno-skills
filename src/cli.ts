#!/usr/bin/env node

import { Command } from 'commander';
import { generateSeed, seedToMnemonic, mnemonicToSeed } from './seed.js';
import { deriveAddressLegacy } from './address-legacy.js';
import { validateAddress } from './validate.js';
import { nanoToRaw, rawToNano, knanoToRaw, mnanoToRaw } from './convert.js';
import { generateAsciiQr, buildNanoUri } from './qr.js';
import { pkg, version } from './version.js';

const programName = pkg.name;

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
  .option('-s, --seed', 'Output hex seed')
  .option('-m, --mnemonic', 'Output 24-word mnemonic phrase')
  .option('-j, --json', 'Output in JSON format')
  .action((options) => {
    const seed = generateSeed();
    const mnemonic = seedToMnemonic(seed);
    const addressResult = deriveAddressLegacy(seed, 0);

    if (options.json) {
      console.log(JSON.stringify({
        seed,
        mnemonic,
        address: addressResult.address,
        privateKey: addressResult.privateKey,
        publicKey: addressResult.publicKey
      }, null, 2));
    } else if (options.mnemonic) {
      console.log(mnemonic);
    } else if (options.seed) {
      console.log(seed);
    } else {
      console.log(`Seed: ${seed}`);
      console.log(`Mnemonic: ${mnemonic}`);
      console.log(`Address: ${addressResult.address}`);
    }
  });

walletCmd
  .command('from-mnemonic')
  .description('Create wallet from mnemonic phrase')
  .argument('<mnemonic>', '12/24-word mnemonic phrase')
  .option('-j, --json', 'Output in JSON format')
  .action((mnemonic: string, options) => {
    try {
      const seed = mnemonicToSeed(mnemonic);
      const addressResult = deriveAddressLegacy(seed, 0);

      if (options.json) {
        console.log(JSON.stringify({
          seed,
          mnemonic,
          address: addressResult.address,
          privateKey: addressResult.privateKey,
          publicKey: addressResult.publicKey
        }, null, 2));
      } else {
        console.log(`Address: ${addressResult.address}`);
      }
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
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

program.configureHelp({
  showGlobalOptions: true
});

program.parse(process.argv);
