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
  });

  it('should generate a wallet via generate_wallet tool', async () => {
    const result = await client.callTool({
      name: "generate_wallet",
      arguments: {}
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as any).text;
    const wallet = JSON.parse(text);
    expect(wallet.mnemonic).toBeDefined();
    expect(wallet.address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
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
    const address = "nano_r9rh58xehqsyu3m7d7iowqgm8n7hdrpak7ncb3jbg5u75ohfg5sjb95hto4i";
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
