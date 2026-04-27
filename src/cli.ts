#!/usr/bin/env node

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { validateAddress } from './validate.js';
import { nanoToRaw, rawToNano, knanoToRaw, mnanoToRaw } from './convert.js';
import { generateAsciiQr, buildNanoUri } from './qr.js';
import { rpcAccountBalance, rpcAccountsBalances, rpcAccountsFrontiers, rpcAccountInfo, rpcReceivable, type AccountInfoResponse, type NanoRpcErrorResponse } from './rpc.js';
import { decodeNanoAddress } from './nano-address.js';
import { nanoGetPublicKeyFromPrivateKey } from './ed25519-blake2b.js';
import { buildNanoStateBlockHex } from './state-block.js';
import { NanoClient, NOMS } from '@openrai/nano-core';
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

function checkOwsCli(): { status: string; label: string; color: string } {
  const disableNpx = process.env.XNO_SKILLS_DISABLE_NPX === 'true';
  
  // 1. Check if 'ows' is available natively
  try {
    execSync('ows --version', { stdio: 'ignore' });
    return { status: 'Ready (Native)', label: '✓', color: '\x1b[1;32m' }; // Bold Green
  } catch (e) {}

  if (disableNpx) {
    return { status: 'Disabled (npx off)', label: '✗', color: '\x1b[1;31m' }; // Bold Red
  }

  // 2. Check if it works via npx
  try {
    execSync('npx -y @open-wallet-standard/core --version', { stdio: 'ignore' });
    return { status: 'Ready (npx)', label: '✓', color: '\x1b[1;32m' }; // Bold Green
  } catch (e) {
    return { status: 'Missing (OWS CLI)', label: '!', color: '\x1b[1;33m' }; // Bold Yellow/Orange
  }
}

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

const info = checkOwsCli();
const statusLine = `${info.color}${info.label}${reset} \x1b[1mOWS Integration:\x1b[0m ${info.status}`;
const fullDescription = `${logo}\n\n${statusLine}`;

const program = new Command();

program
  .name(programName)
  .description(fullDescription)
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
      console.log(asciiQr);
      console.log(address);
      if (options.amount) {
        console.log(`${options.amount} XNO`);
      }
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

// Sign command (NOMS)
program
  .command('sign')
  .description('Sign a NOMS message with a private key')
  .argument('<message>', 'The message text to sign')
  .requiredOption('-k, --key <hex>', 'Private key in hex')
  .option('-j, --json', 'Output in JSON format')
  .action((message: string, options: { key: string; json?: boolean }) => {
    try {
      const signature = NOMS.signMessage(message, options.key);
      const pk = nanoGetPublicKeyFromPrivateKey(options.key);
      
      if (options.json) {
        console.log(JSON.stringify({ message, signature, publicKey: pk }, null, 2));
      } else {
        console.log(`Signature: ${signature}`);
        console.log(`Public Key: ${pk}`);
      }
    } catch (e: any) {
      console.error(`Error: ${e?.message ?? e}`);
      process.exit(1);
    }
  });

// Verify command (NOMS)
program
  .command('verify')
  .description('Verify a NOMS message signature')
  .argument('<address>', 'Nano address or public key')
  .argument('<message>', 'The original message text')
  .argument('<signature>', 'The hex-encoded signature')
  .option('-j, --json', 'Output in JSON format')
  .action((address: string, message: string, signature: string, options: { json?: boolean }) => {
    try {
      const v = validateAddress(address);
      if (!v.valid) {
        console.error(`Invalid address: ${v.error}`);
        process.exit(1);
      }

      const valid = NOMS.verifyMessage(message, signature, v.publicKey!);

      if (options.json) {
        console.log(JSON.stringify({ address, message, signature, valid }, null, 2));
      } else {
        if (valid) {
          console.log('✅ Signature is VALID');
        } else {
          console.error('❌ Signature is INVALID');
          process.exit(1);
        }
      }
    } catch (e: any) {
      console.error(`Error: ${e?.message ?? e}`);
      process.exit(1);
    }
  });

// RPC helpers
const rpcCmd = program
  .command('rpc')
  .description('Query a Nano node RPC');

rpcCmd
  .command('account-balance')
  .description('Fetch account balance and pending amount')
  .argument('<address>', 'Nano address')
  .option('--url <url>', 'RPC URL (default: use zero-config public nodes)')
  .option('--timeout-ms <ms>', 'Timeout in milliseconds', (v) => parseInt(v, 10), 15000)
  .option('--xno', 'Also include XNO-formatted values')
  .option('-j, --json', 'Output in JSON format')
  .action(async (address: string, options: { url?: string; timeoutMs: number; xno?: boolean; json?: boolean }) => {
    const client = getNanoClient(options);

    try {
      const bal = await rpcAccountBalance(client, address, { timeoutMs: options.timeoutMs });
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

// Block construction helpers (for use with `ows sign tx --chain nano` / `ows send-tx --chain nano`)
const blockCmd = program
  .command('block')
  .description('Build raw state blocks for OWS signing');

const ZERO_HASH = '0'.repeat(64);
const DEFAULT_REP = 'nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4';

function getNanoClient(options: { url?: string }): NanoClient {
  const rpc = options.url || process.env.NANO_RPC_URL;
  return NanoClient.initialize({
    rpc: rpc ? [rpc] : undefined,
  });
}

function isRpcError(resp: any): resp is NanoRpcErrorResponse {
  return typeof resp?.error === 'string';
}

blockCmd
  .command('send')
  .description('Build an unsigned send block')
  .requiredOption('-a, --account <address>', 'Sender nano_ address')
  .requiredOption('-t, --to <address>', 'Recipient nano_ address')
  .requiredOption('--amount-xno <xno>', 'Amount to send in XNO')
  .option('--url <url>', 'RPC URL (default: use zero-config public nodes)')
  .option('-j, --json', 'Output JSON with block hex + hash + metadata')
  .action(async (options: { account: string; to: string; amountXno: string; url?: string; json?: boolean }) => {
    const client = getNanoClient(options);

    try {
      const senderPk = decodeNanoAddress(options.account).publicKey;
      const recipientPk = decodeNanoAddress(options.to).publicKey;

      const info = await rpcAccountInfo(client, options.account) as AccountInfoResponse | NanoRpcErrorResponse;
      if (isRpcError(info)) {
        console.error(`Error: account not opened (${info.error}). Cannot send from an unopened account.`);
        process.exit(1);
      }

      const currentBalance = BigInt(info.balance);
      const sendRaw = BigInt(nanoToRaw(options.amountXno));
      if (sendRaw <= 0n) { console.error('Error: amount must be positive.'); process.exit(1); }
      if (sendRaw > currentBalance) {
        console.error(`Error: insufficient balance. Have ${rawToNano(info.balance)} XNO, sending ${options.amountXno} XNO.`);
        process.exit(1);
      }

      const newBalance = currentBalance - sendRaw;
      const repPk = info.representative
        ? decodeNanoAddress(info.representative).publicKey
        : decodeNanoAddress(DEFAULT_REP).publicKey;

      const blockHex = buildNanoStateBlockHex({
        accountPublicKey: senderPk,
        previous: info.frontier,
        representativePublicKey: repPk,
        balanceRaw: newBalance.toString(),
        link: recipientPk,
      });

      if (options.json) {
        console.log(JSON.stringify({
          blockHex,
          account: options.account,
          to: options.to,
          amountRaw: sendRaw.toString(),
          newBalanceRaw: newBalance.toString(),
          previous: info.frontier,
        }, null, 2));
      } else {
        console.log(blockHex);
      }
    } catch (e: any) {
      console.error(`Error: ${e?.message ?? e}`);
      process.exit(1);
    }
  });

blockCmd
  .command('receive')
  .description('Build an unsigned receive block')
  .requiredOption('-a, --account <address>', 'Recipient nano_ address')
  .option('--hash <blockhash>', 'Hash of the pending send block (auto-detected if omitted)')
  .option('--amount-raw <raw>', 'Amount in raw (auto-detected if omitted)')
  .option('--amount-xno <xno>', 'Amount in XNO (auto-detected if omitted)')
  .option('--url <url>', 'RPC URL (default: use zero-config public nodes)')
  .option('-j, --json', 'Output JSON with block hex + hash + metadata')
  .action(async (options: { account: string; hash?: string; amountRaw?: string; amountXno?: string; url?: string; json?: boolean }) => {
    const client = getNanoClient(options);

    try {
      if (options.amountRaw && options.amountXno) {
        console.error('Error: specify --amount-raw or --amount-xno, not both.');
        process.exit(1);
      }

      const acctPk = decodeNanoAddress(options.account).publicKey;

      // Resolve hash and amount. If --hash is given without an amount, we must
      // look up that specific block's amount — NOT grab the first pending block's amount,
      // which could be a completely different transaction.
      let hash = options.hash;
      let amountRaw = options.amountRaw || (options.amountXno ? nanoToRaw(options.amountXno) : undefined);
      if (hash && !amountRaw) {
        console.error('Error: when --hash is provided, --amount-raw or --amount-xno is also required.');
        process.exit(1);
      }
      if (!hash) {
        const pending = await rpcReceivable(client, options.account, 1);
        if (pending.length === 0) {
          console.error('Error: no receivable blocks found for this account.');
          process.exit(1);
        }
        hash = pending[0].hash;
        amountRaw = amountRaw || pending[0].amount;
        const xno = rawToNano(amountRaw);
        console.error(`Auto-detected pending block: ${hash} (${xno} XNO)`);
      }

      let info: AccountInfoResponse | NanoRpcErrorResponse;
      try {
        info = await rpcAccountInfo(client, options.account) as AccountInfoResponse | NanoRpcErrorResponse;
      } catch (e: any) {
        // If account_info fails for any reason, assume unopened if we have pending blocks
        info = { error: 'Account not found' };
      }
      
      const isOpen = !isRpcError(info);

      const previous = isOpen ? info.frontier : ZERO_HASH;
      const currentBalance = isOpen ? BigInt(info.balance) : 0n;
      const repPk = isOpen && info.representative
        ? decodeNanoAddress(info.representative).publicKey
        : decodeNanoAddress(DEFAULT_REP).publicKey;

      const receiveRaw = BigInt(amountRaw!);
      if (receiveRaw <= 0n) { console.error('Error: amount-raw must be positive.'); process.exit(1); }
      const newBalance = currentBalance + receiveRaw;

      const blockHex = buildNanoStateBlockHex({
        accountPublicKey: acctPk,
        previous,
        representativePublicKey: repPk,
        balanceRaw: newBalance.toString(),
        link: hash,
      });

      if (options.json) {
        console.log(JSON.stringify({
          blockHex,
          account: options.account,
          sendBlockHash: hash,
          amountRaw,
          newBalanceRaw: newBalance.toString(),
          previous,
          subtype: isOpen ? 'receive' : 'open',
        }, null, 2));
      } else {
        console.log(blockHex);
      }
    } catch (e: any) {
      console.error(`Error: ${e?.message ?? e}`);
      process.exit(1);
    }
  });

// Also add `rpc receivable` since it's needed to find pending blocks
rpcCmd
  .command('receivable')
  .description('List receivable blocks for an account')
  .argument('<address>', 'Nano address')
  .option('--url <url>', 'RPC URL (default: use zero-config public nodes)')
  .option('-c, --count <n>', 'Max blocks to return', (v) => parseInt(v, 10), 10)
  .option('-j, --json', 'Output in JSON format')
  .action(async (address: string, options: { url?: string; count: number; json?: boolean }) => {
    const client = getNanoClient(options);

    try {
      const items = await rpcReceivable(client, address, options.count);
      if (options.json) {
        console.log(JSON.stringify({ account: address, blocks: items }, null, 2));
      } else if (items.length === 0) {
        console.log('No receivable blocks.');
      } else {
        for (const item of items) {
          const xno = rawToNano(item.amount);
          console.log(`${item.hash}  ${xno} XNO${item.source ? `  from ${item.source}` : ''}`);
        }
      }
    } catch (e: any) {
      console.error(`Error: ${e?.message ?? e}`);
      process.exit(1);
    }
  });

// Also add `rpc account-info` for completeness
rpcCmd
  .command('account-info')
  .description('Fetch account info including frontier and balance')
  .argument('<address>', 'Nano address')
  .option('--url <url>', 'RPC URL (default: use zero-config public nodes)')
  .option('--xno', 'Also include XNO-formatted balance')
  .option('-j, --json', 'Output in JSON format')
  .action(async (address: string, options: { url?: string; xno?: boolean; json?: boolean }) => {
    const client = getNanoClient(options);

    try {
      const info = await rpcAccountInfo(client, address) as AccountInfoResponse | NanoRpcErrorResponse;
      if (isRpcError(info)) {
        if (options.json) {
          console.log(JSON.stringify({ account: address, opened: false }, null, 2));
        } else {
          console.log('Account not opened (no blocks published).');
        }
        return;
      }

      if (options.json) {
        const out: any = {
          account: address,
          opened: true,
          frontier: info.frontier,
          balanceRaw: info.balance,
          representative: info.representative,
        };
        if (options.xno) out.balanceXno = rawToNano(info.balance);
        console.log(JSON.stringify(out, null, 2));
      } else {
        console.log(`Frontier: ${info.frontier}`);
        console.log(`Balance (raw): ${info.balance}`);
        if (options.xno) console.log(`Balance (XNO): ${rawToNano(info.balance)}`);
        if (info.representative) console.log(`Representative: ${info.representative}`);
      }
    } catch (e: any) {
      console.error(`Error: ${e?.message ?? e}`);
      process.exit(1);
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
    } catch (e: any) {
      console.error(`Failed to start MCP server: ${e?.message ?? e}`);
      process.exit(1);
    }
  });

program.configureHelp({
  showGlobalOptions: true
});

program.parse(process.argv);
