import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  | 'source'     // running from source (tsx, dev mode)
  | 'unknown';

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
};

function detectInvocation(): InvocationMethod {
  // Best-effort detection without 42 burning hoops.
  // Heuristics based on script path and npm env vars.

  const scriptPath = process.argv[1] || '';
  const npmExecPath = process.env.npm_execpath || '';

  // npx leaves a tell in the path or npm_execpath
  if (scriptPath.includes('_npx') || scriptPath.includes('.npm/_npx')) {
    return 'npx';
  }
  if (npmExecPath.includes('npx')) {
    return 'npx';
  }

  // bunx
  if (scriptPath.includes('.bun/bin') || scriptPath.includes('.bun/install')) {
    return 'bun-global';
  }

  // pnpm dlx
  if (scriptPath.includes('pnpm-store') || scriptPath.includes('.pnpm')) {
    if (scriptPath.includes('_npx')) return 'pnpm-dlx';
    return 'pnpm-global';
  }

  // npm global
  if (scriptPath.includes('/usr/local/lib/node_modules') ||
      scriptPath.includes('/opt/homebrew/lib/node_modules') ||
      scriptPath.includes('/usr/lib/node_modules')) {
    return 'npm-global';
  }

  // npm local (inside project node_modules/.bin)
  if (scriptPath.includes('/node_modules/.bin/')) {
    return 'npm-local';
  }

  // Running from source (tsx, ts-node, etc.)
  if (scriptPath.endsWith('.ts') || scriptPath.includes('/src/')) {
    return 'source';
  }

  return 'unknown';
}

function getOwsInfo(): { version: string; path: string } | null {
  try {
    const pkgPath = require.resolve('@open-wallet-standard/core/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return {
      version: pkg.version,
      path: dirname(pkgPath),
    };
  } catch {
    return null;
  }
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

  return lines.join('\n');
}
