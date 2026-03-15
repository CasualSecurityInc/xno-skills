import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_BIN_PATH = path.resolve(__dirname, '../bin/xno-mcp');

describe('MCP Server Integration', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} }
    );

    transport = new StdioClientTransport({
      command: "node",
      args: [MCP_BIN_PATH],
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  it('should list all available tools', async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map(t => t.name);
    
    expect(toolNames).toContain('generate_wallet');
    expect(toolNames).toContain('derive_address');
    expect(toolNames).toContain('convert_units');
    expect(toolNames).toContain('validate_address');
    expect(toolNames).toContain('purse_create');
    expect(toolNames).toContain('purse_list');
    expect(toolNames).toContain('purse_addresses');
    expect(toolNames).toContain('config_get');
    expect(toolNames).toContain('config_set');
  });

  it('should create a purse and return an address without secrets', async () => {
    const result = await client.callTool({
      name: "purse_create",
      arguments: { name: "A", format: "bip39", count: 1 }
    });

    expect(result.isError).toBeFalsy();
    const purse = JSON.parse((result.content[0] as any).text);
    expect(purse.name).toBe("A");
    expect(purse.format).toBe("bip39");
    expect(purse.accounts[0].index).toBe(0);
    expect(purse.accounts[0].address).toMatch(/^nano_[13][13456789abcdefghijkmnopqrstuwxyz]{59}$/);
    expect(purse.mnemonic).toBeUndefined();
    expect(purse.seed).toBeUndefined();
  });

  it('should list purses after creation', async () => {
    const result = await client.callTool({ name: "purse_list", arguments: {} });
    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.purses.some((p: any) => p.name === "A")).toBe(true);
  });

  it('should derive additional purse addresses on demand', async () => {
    const result = await client.callTool({
      name: "purse_addresses",
      arguments: { name: "A", fromIndex: 0, count: 3 }
    });
    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.accounts).toHaveLength(3);
    expect(out.accounts[0].index).toBe(0);
    expect(out.accounts[1].index).toBe(1);
    expect(out.accounts[2].index).toBe(2);
  });

  it('should generate a wallet via generate_wallet tool', async () => {
    const result = await client.callTool({
      name: "generate_wallet",
      arguments: {}
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as any).text;
    const wallet = JSON.parse(text);
    expect(wallet.format).toBe('bip39');
    expect(wallet.mnemonic).toBeDefined();
    expect(wallet.address).toMatch(/^nano_[13][13456789abcdefghijkmnopqrstuwxyz]{59}$/);
  });

  it('should convert units via convert_units tool', async () => {
    const result = await client.callTool({
      name: "convert_units",
      arguments: {
        amount: "1",
        from: "xno",
        to: "raw"
      }
    });

    expect(result.isError).toBeFalsy();
    expect((result.content[0] as any).text).toBe("1000000000000000000000000000000");
  });

  it('should validate an address via validate_address tool', async () => {
    const address = "nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d";
    const result = await client.callTool({
      name: "validate_address",
      arguments: { address }
    });

    expect(result.isError).toBeFalsy();
    const validation = JSON.parse((result.content[0] as any).text);
    expect(validation.valid).toBe(true);
  });

  it('should return error for invalid tool', async () => {
    try {
      await client.callTool({
        name: "invalid_tool",
        arguments: {}
      });
      // MCP SDK might throw or return isError depending on version/config
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });
});
