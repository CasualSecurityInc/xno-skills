import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { version } from './version.js';

const require = createRequire(import.meta.url);

export type InvocationMethod =
  | 'npm-global'
  | 'npm-local'
  | 'npx'
  | 'bun-global'
  | 'bunx'
  | 'pnpm-global'
  | 'pnpm-dlx'
  | 'source'
  | 'unknown';

export type EnvVarEntry = {
  name: string;
  defaultValue: string;
  effectiveValue: string | undefined;
  description: string;
};

export type SystemInfo = {
  xnoSkills: {
    version: string;
    path: string;
    invocation: InvocationMethod;
  };
  ows: {
    version: string;
    path: string;
  } | null;
  environment: {
    mockOws: boolean;
    nanoRpcUrl?: string;
    xnoWorkUrl?: string;
    xnoMcpHome?: string;
  };
  envVars: EnvVarEntry[];
};

function detectInvocation(): InvocationMethod {
  const scriptPath = process.argv[1] || '';
  const npmExecPath = process.env.npm_execpath || '';

  if (scriptPath.includes('_npx') || scriptPath.includes('.npm/_npx')) return 'npx';
  if (npmExecPath.includes('npx')) return 'npx';
  if (scriptPath.includes('.bun/bin') || scriptPath.includes('.bun/install')) return 'bun-global';
  if (scriptPath.includes('pnpm-store') || scriptPath.includes('.pnpm')) {
    return scriptPath.includes('_npx') ? 'pnpm-dlx' : 'pnpm-global';
  }
  if (scriptPath.includes('/usr/local/lib/node_modules') ||
      scriptPath.includes('/opt/homebrew/lib/node_modules') ||
      scriptPath.includes('/usr/lib/node_modules')) return 'npm-global';
  if (scriptPath.includes('/node_modules/.bin/')) return 'npm-local';
  if (scriptPath.endsWith('.ts') || scriptPath.includes('/src/')) return 'source';
  return 'unknown';
}

function getOwsInfo(): { version: string; path: string } | null {
  try {
    const pkgPath = require.resolve('@open-wallet-standard/core/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return { version: pkg.version, path: dirname(pkgPath) };
  } catch {
    return null;
  }
}

function getEnvVars(): EnvVarEntry[] {
  return [
    {
      name: 'XNO_MAX_SEND',
      defaultValue: '1.0',
      effectiveValue: process.env.XNO_MAX_SEND,
      description: 'Maximum XNO per send transaction',
    },
    {
      name: 'NANO_RPC_URL',
      defaultValue: '(public nodes)',
      effectiveValue: process.env.NANO_RPC_URL,
      description: 'Override primary Nano node RPC endpoint',
    },
    {
      name: 'XNO_WORK_URL',
      defaultValue: '(same as RPC)',
      effectiveValue: process.env.XNO_WORK_URL,
      description: 'Override remote proof-of-work endpoint',
    },
    {
      name: 'XNO_MCP_HOME',
      defaultValue: '<installed-dir>/.xno-mcp',
      effectiveValue: process.env.XNO_MCP_HOME,
      description: 'Directory for config, requests, and transaction state',
    },
    {
      name: 'XNO_MCP_MOCK_OWS',
      defaultValue: 'false',
      effectiveValue: process.env.XNO_MCP_MOCK_OWS,
      description: 'Use mock OWS wallet for dev/testing',
    },
    {
      name: 'XNO_MCP_CONFIG_PATH',
      defaultValue: '$XNO_MCP_HOME/config.json',
      effectiveValue: process.env.XNO_MCP_CONFIG_PATH,
      description: 'Override config.json path',
    },
    {
      name: 'XNO_MCP_REQUESTS_PATH',
      defaultValue: '$XNO_MCP_HOME/requests.json',
      effectiveValue: process.env.XNO_MCP_REQUESTS_PATH,
      description: 'Override payment requests path',
    },
    {
      name: 'XNO_MCP_TRANSACTIONS_PATH',
      defaultValue: '$XNO_MCP_HOME/transactions.json',
      effectiveValue: process.env.XNO_MCP_TRANSACTIONS_PATH,
      description: 'Override transaction ledger path',
    },
  ];
}

export function getSystemInfo(): SystemInfo {
  const scriptPath = process.argv[1] || 'unknown';

  return {
    xnoSkills: {
      version,
      path: scriptPath,
      invocation: detectInvocation(),
    },
    ows: getOwsInfo(),
    environment: {
      mockOws: process.env.XNO_MCP_MOCK_OWS === 'true',
      nanoRpcUrl: process.env.NANO_RPC_URL,
      xnoWorkUrl: process.env.XNO_WORK_URL,
      xnoMcpHome: process.env.XNO_MCP_HOME,
    },
    envVars: getEnvVars(),
  };
}

export function formatSystemInfo(info: SystemInfo): string {
  const lines: string[] = [];
  lines.push(`xno-skills ${info.xnoSkills.version}`);
  lines.push(`  path:    ${info.xnoSkills.path}`);
  lines.push(`  invoked: ${info.xnoSkills.invocation}`);

  if (info.ows) {
    lines.push(`ows ${info.ows.version}`);
    lines.push(`  path: ${info.ows.path}`);
  } else {
    lines.push('ows: not found');
  }

  lines.push('environment:');
  lines.push(`  mockOws: ${info.environment.mockOws}`);
  if (info.environment.nanoRpcUrl) lines.push(`  NANO_RPC_URL: ${info.environment.nanoRpcUrl}`);
  if (info.environment.xnoWorkUrl) lines.push(`  XNO_WORK_URL: ${info.environment.xnoWorkUrl}`);
  if (info.environment.xnoMcpHome) lines.push(`  XNO_MCP_HOME: ${info.environment.xnoMcpHome}`);

  lines.push('');
  lines.push('env vars:');
  for (const v of info.envVars) {
    const eff = v.effectiveValue !== undefined ? v.effectiveValue : '(unset)';
    lines.push(`  ${v.name}`);
    lines.push(`    default:  ${v.defaultValue}`);
    lines.push(`    current:  ${eff}`);
    lines.push(`    ${v.description}`);
  }

  return lines.join('\n');
}
