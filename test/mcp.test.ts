import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_BIN_PATH = path.resolve(__dirname, '../bin/xno-skills');

describe('MCP Server Integration', () => {
  let client: Client;
  let transport: StdioClientTransport;

  it('should start and connect successfully (Handshake test)', async () => {
    const testClient = new Client(
      { name: "startup-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const testTransport = new StdioClientTransport({
      command: "node",
      args: [MCP_BIN_PATH, "mcp"],
      env: { ...process.env, XNO_MCP_MOCK_OWS: "true" }
    });

    // This is the core "it starts" check
    await expect(testClient.connect(testTransport)).resolves.not.toThrow();
    await testClient.close();
  }, 10000); // 10s timeout for startup

  beforeAll(async () => {
    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} }
    );

    transport = new StdioClientTransport({
      command: "node",
      args: [MCP_BIN_PATH, "mcp"],
      env: { ...process.env, XNO_MCP_MOCK_OWS: "true" }
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
    
    expect(toolNames).not.toContain('generate_wallet');
    expect(toolNames).not.toContain('derive_address');
    expect(toolNames).toContain('convert_units');
    expect(toolNames).toContain('validate_address');
    expect(toolNames).not.toContain('wallet_create');
    expect(toolNames).toContain('wallet_list');
    expect(toolNames).not.toContain('wallet_addresses');
    expect(toolNames).toContain('wallet_receive');
    expect(toolNames).toContain('wallet_send');
    expect(toolNames).toContain('config_get');
    expect(toolNames).toContain('config_set');
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

  it('should list wallets using OWS', async () => {
    const result = await client.callTool({ name: "wallet_list", arguments: {} });
    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.some((p: any) => p.name === "A")).toBe(true);
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
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  it('should accept valid representative in config_set', async () => {
    const validRep = "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4";
    const result = await client.callTool({
      name: "config_set",
      arguments: { defaultRepresentative: validRep }
    });

    expect(result.isError).toBeFalsy();
    const config = JSON.parse((result.content[0] as any).text);
    expect(config.defaultRepresentative).toBe(validRep);
  });

  it('should create a payment request with explicit OWS wallet', async () => {
    const result = await client.callTool({
      name: "payment_request_create",
      arguments: { walletName: "A", amountXno: "0.01", reason: "explicit wallet test" }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.id).toBeDefined();
    expect(out.amountXno).toBe("0.01");
  });

  it('should list payment requests', async () => {
    const result = await client.callTool({
      name: "payment_request_list",
      arguments: {}
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out).toBeInstanceOf(Array);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].id).toBeDefined();
  });

  it('should filter payment requests by status', async () => {
    const result = await client.callTool({
      name: "payment_request_list",
      arguments: { status: "pending" }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    for (const r of out) {
      expect(r.status).toBe("pending");
    }
  });

  it('should check payment request status', async () => {
    const createResult = await client.callTool({
      name: "payment_request_create",
      arguments: { walletName: "A", amountXno: "0.5", reason: "status check test" }
    });
    const created = JSON.parse((createResult.content[0] as any).text);

    const result = await client.callTool({
      name: "payment_request_status",
      arguments: { id: created.id }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.id).toBe(created.id);
    expect(out.status).toBe("pending");
    expect(out.amountRaw).toBe("500000000000000000000000000000");
  });

  it('should error for unknown payment request', async () => {
    const result = await client.callTool({
      name: "payment_request_status",
      arguments: { id: "nonexistent" }
    });

    expect(result.isError).toBeTruthy();
  });

  it('should return empty history for new OWS wallet', async () => {
    const result = await client.callTool({
      name: "wallet_history",
      arguments: { walletName: "A" }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out).toBeInstanceOf(Array);
    expect(out).toHaveLength(0);
  });

  it('should set maxSendXno via config_set', async () => {
    const result = await client.callTool({
      name: "config_set",
      arguments: { maxSendXno: "5.0" }
    });

    expect(result.isError).toBeFalsy();
    const config = JSON.parse((result.content[0] as any).text);
    expect(config.maxSendXno).toBe("5.0");
  });

  it('should show maxSendXno in config_get', async () => {
    const result = await client.callTool({
      name: "config_get",
      arguments: {}
    });

    expect(result.isError).toBeFalsy();
    const config = JSON.parse((result.content[0] as any).text);
    expect(config.maxSendXno).toBe("5.0");
  });

  it('should embed max-send cap in wallet_send tool description', async () => {
    const result = await client.listTools();
    const sendTool = result.tools.find(t => t.name === 'wallet_send');
    expect(sendTool).toBeDefined();
    expect(sendTool!.description).toContain('XNO');
  });

  it('should return health status via ows_health_check tool', async () => {
    const result = await client.callTool({
      name: "ows_health_check",
      arguments: {}
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.status).toBe("Ready");
    expect(out.mode).toBe("Mock");
  });

  it('should generate a QR code for an address', async () => {
    const address = "nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d";
    const result = await client.callTool({
      name: "generate_qr",
      arguments: { address }
    });

    expect(result.isError).toBeFalsy();
    const out = (result.content[0] as any).text;
    expect(out).toContain("▄");
  });
});
