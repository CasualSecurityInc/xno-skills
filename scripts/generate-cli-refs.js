#!/usr/bin/env node
/**
 * Generate CLI reference docs for each xno-skills subcommand.
 * Writes skills/nano/references/<subcommand>.md for every subcommand.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const refsDir = resolve(__dirname, '../skills/nano/references');
const cliPath = resolve(__dirname, '../src/cli.ts');

function runHelp(args) {
  try {
    return execSync(`npx tsx ${cliPath} ${args} --help`, {
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch (e) {
    // Some subcommands may error on --help if they require positional args
    return e.stdout || e.stderr || '';
  }
}

// Discover top-level commands from --help
const topHelp = runHelp('');
const lines = topHelp.split('\n');

// Collect subcommands: we look for lines that start with 2+ spaces and have a word
// before options. This is fragile; better to use commander introspection.
// Actually, let's just hardcode the known subcommands based on the CLI source.
// We can discover them by reading src/cli.ts but that's complex.
// Simpler: known list from our CLI.

const subcommands = [
  'wallets',
  'balance',
  'receive',
  'send',
  'change-rep',
  'submit-block',
  'history',
  'info',
  'convert',
  'qr',
  'validate',
  'sign',
  'verify',
  'rpc account-balance',
  'rpc receivable',
  'rpc account-info',
  'rpc probe-caps',
  'block send',
  'block receive',
  'block change',
  'mcp',
];

if (!existsSync(refsDir)) mkdirSync(refsDir, { recursive: true });

for (const cmd of subcommands) {
  const help = runHelp(cmd);
  const filename = cmd.replace(/ /g, '_') + '.md';
  const content = `# xno-skills ${cmd}

\`\`\`
${help.trim()}
\`\`\`
`;
  writeFileSync(resolve(refsDir, filename), content);
  console.log(`[generate-cli-refs] Wrote ${filename}`);
}

console.log(`[generate-cli-refs] Done. ${subcommands.length} reference files in ${refsDir}`);
