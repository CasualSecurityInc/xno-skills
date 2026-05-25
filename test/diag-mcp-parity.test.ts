import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN_PATH = path.resolve(__dirname, '../bin/xno-skills');

type SystemInfo = {
  xnoSkills: { version: string; path: string; invocation: string };
  ows: { version: string; path: string } | null;
  environment: { mockOws: boolean };
  envVars: Array<{ name: string; defaultValue: string; effectiveValue: string | undefined; description: string }>;
  localPowRecommended: boolean;
  effectiveRpcUrls: string[];
  effectiveWorkUrls: string[];
};

function getText(result: unknown): string {
  return ((((result as any).content) as any[])[0] as any).text;
}

describe('diag parity: CLI --json vs MCP system_diag', () => {
  let mcpDiag: SystemInfo;
  let cliDiag: SystemInfo;

  beforeAll(async () => {
    cliDiag = JSON.parse(execSync(`node "${BIN_PATH}" diag --json`, {
      encoding: 'utf8',
      env: { ...process.env, XNO_MCP_MOCK_OWS: 'true' },
    })) as SystemInfo;

    const client = new Client(
      { name: 'diag-parity-test', version: '1.0.0' },
      { capabilities: {} },
    );
    const transport = new StdioClientTransport({
      command: 'node',
      args: [BIN_PATH, 'mcp'],
      env: { ...process.env, XNO_MCP_MOCK_OWS: 'true' },
    });
    await client.connect(transport);
    const result = await client.callTool({ name: 'system_diag', arguments: {} });
    mcpDiag = JSON.parse(getText(result)) as SystemInfo;
    await client.close();
  }, 30_000);

  it('reports same xnoSkills version', () => {
    expect(cliDiag.xnoSkills.version).toBe(mcpDiag.xnoSkills.version);
  });

  it('reports same OWS version and path', () => {
    expect(cliDiag.ows?.version).toBe(mcpDiag.ows?.version);
    expect(cliDiag.ows?.path).toBe(mcpDiag.ows?.path);
  });

  it('reports same localPowRecommended', () => {
    expect(cliDiag.localPowRecommended).toBe(mcpDiag.localPowRecommended);
  });

  it('reports same effectiveRpcUrls', () => {
    expect(cliDiag.effectiveRpcUrls).toEqual(mcpDiag.effectiveRpcUrls);
  });

  it('reports same effectiveWorkUrls', () => {
    expect(cliDiag.effectiveWorkUrls).toEqual(mcpDiag.effectiveWorkUrls);
  });

  it('reports same envVar structure (names, defaults, descriptions)', () => {
    const stripValues = (vars: SystemInfo['envVars']) =>
      vars.map(({ name, defaultValue, description }) => ({ name, defaultValue, description }));
    expect(stripValues(cliDiag.envVars)).toEqual(stripValues(mcpDiag.envVars));
  });

  it('reports same environment.mockOws', () => {
    expect(cliDiag.environment.mockOws).toBe(mcpDiag.environment.mockOws);
  });
});
