#!/usr/bin/env node

import { Command } from 'commander';
import { generateSeed, seedToMnemonic, mnemonicToSeed } from './seed.js';
import { deriveAddressLegacy } from './address-legacy.js';
import { validateAddress } from './validate.js';
import { nanoToRaw, rawToNano, knanoToRaw, mnanoToRaw } from './convert.js';

const logo = `
\x1b[34m   _   ___ ___ _____\x1b[0m
\x1b[34m  | | / __| _ \\ _ \\__|\x1b[0m
\x1b[34m  | |_| (_|  _/ __/ _|\x1b[0m
\x1b[34m   _\\___|___|_|\\___(_)\x1b[0m
\x1b[34m  |_|\\___| Nano cryptocurrency\x1b[0m
`;

const program = new Command();

console.log(logo);

program

program
  .name('xno')
  .description('XNO CLI - Interact with the Nano cryptocurrency')
  .version('0.1.0')
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
  .option('-a, --amount <amount>', 'Include amount in QR')
  .option('-j, --json', 'Output in JSON format')
  .action((address: string, options: { amount?: string; json?: boolean }) => {
    const validation = validateAddress(address);
    if (!validation.valid) {
      console.error(`Invalid address: ${validation.error}`);
      process.exit(1);
    }
    
    let qrContent = address;
    if (options.amount) {
      qrContent += '?amount=' + options.amount;
    }
    
    const displayContent = address + (options.amount ? '?amount=' + options.amount : '');
    const asciiQr = generateAsciiQr(qrContent, displayContent);
    
    if (options.json) {
      console.log(JSON.stringify({
        address,
        amount: options.amount || null,
        content: qrContent,
        qr: asciiQr
      }, null, 2));
    } else {
      console.log(asciiQr);
    }
  });

function generateAsciiQr(content: string, displayContent?: string): string {
  const hash = simpleHash(content);
  const size = 21;
  
  let result = '';
  
  result += '█'.repeat(size + 2) + '\n';
  
  for (let y = 0; y < size; y++) {
    result += '█';
    for (let x = 0; x < size; x++) {
      const val = ((hash + x * 7 + y * 13) % 100) > 45;
      result += val ? '█' : ' ';
    }
    result += '█\n';
  }
  
  result += '█'.repeat(size + 2) + '\n';
  const display = displayContent || content;
  result += '\n' + display.substring(0, 25) + (display.length > 25 ? '...' : '');
  
  return result;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

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
