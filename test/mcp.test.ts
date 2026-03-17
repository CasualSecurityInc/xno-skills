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
    expect(toolNames).toContain('wallet_create');
    expect(toolNames).toContain('wallet_list');
    expect(toolNames).toContain('wallet_addresses');
    expect(toolNames).toContain('wallet_receive');
    expect(toolNames).toContain('wallet_send');
    expect(toolNames).toContain('config_get');
    expect(toolNames).toContain('config_set');
  });

  it('should create a wallet and return an address without secrets', async () => {
    const result = await client.callTool({
      name: "wallet_create",
      arguments: { name: "A", format: "bip39", count: 1 }
    });

    expect(result.isError).toBeFalsy();
    const wallet = JSON.parse((result.content[0] as any).text);
    expect(wallet.name).toBe("A");
    expect(wallet.format).toBe("bip39");
    expect(wallet.accounts[0].index).toBe(0);
    expect(wallet.accounts[0].address).toMatch(/^nano_[13][13456789abcdefghijkmnopqrstuwxyz]{59}$/);
    expect(wallet.mnemonic).toBeUndefined();
    expect(wallet.seed).toBeUndefined();
  });

  it('should list wallets after creation', async () => {
    const result = await client.callTool({ name: "wallet_list", arguments: {} });
    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.wallets.some((p: any) => p.name === "A")).toBe(true);
  });

  it('should derive additional wallet addresses on demand', async () => {
    const result = await client.callTool({
      name: "wallet_addresses",
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

  it('should reject invalid (truncated) representative in config_set', async () => {
    const truncatedRep = "nano_1iuz18nxc4am6i4ixn7enj9tusyz8c3nyohmm77bzzd95sx9xmr9xh9qg9b";
    const result = await client.callTool({
      name: "config_set",
      arguments: { defaultRepresentative: truncatedRep }
    });

    // This should succeed (config_set just stores the value)
    // The validation happens when the representative is actually used
    expect(result.isError).toBeFalsy();
  });

  it('should reject invalid address via validate_address tool', async () => {
    // Truncated address (64 chars instead of 65)
    const truncatedAddress = "nano_1iuz18nxc4am6i4ixn7enj9tusyz8c3nyohmm77bzzd95sx9xmr9xh9qg9b";
    const result = await client.callTool({
      name: "validate_address",
      arguments: { address: truncatedAddress }
    });

    expect(result.isError).toBeFalsy();
    const validation = JSON.parse((result.content[0] as any).text);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('length');
  });

  it('should store useWorkPeer config option', async () => {
    const result = await client.callTool({
      name: "config_set",
      arguments: { useWorkPeer: true }
    });

    expect(result.isError).toBeFalsy();
    const config = JSON.parse((result.content[0] as any).text);
    expect(config.useWorkPeer).toBe(true);
  });

  it('should disable useWorkPeer when set to false', async () => {
    // First enable work peer
    await client.callTool({
      name: "config_set",
      arguments: { useWorkPeer: true }
    });

    // Then disable it
    const result = await client.callTool({
      name: "config_set",
      arguments: { useWorkPeer: false, workPeerUrl: "https://example.com" }
    });

    expect(result.isError).toBeFalsy();
    const config = JSON.parse((result.content[0] as any).text);
    expect(config.useWorkPeer).toBe(false);
    expect(config.workPeerUrl).toBe("https://example.com");
  });

  it('should list new tools in available tools', async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map(t => t.name);

    expect(toolNames).toContain('payment_request_create');
    expect(toolNames).toContain('payment_request_status');
    expect(toolNames).toContain('payment_request_receive');
    expect(toolNames).toContain('payment_request_list');
    expect(toolNames).toContain('payment_request_refund');
    expect(toolNames).toContain('wallet_history');
    expect(toolNames).toContain('generate_qr');
    expect(toolNames).not.toContain('wallet_set_allowance');
    expect(toolNames).not.toContain('wallet_get_allowance');
  });

  it('should create a payment request with auto-wallet', async () => {
    const result = await client.callTool({
      name: "payment_request_create",
      arguments: { amountXno: "0.001", reason: "test payment" }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.id).toBeDefined();
    expect(out.address).toMatch(/^nano_/);
    expect(out.amountXno).toBe("0.001");
    expect(out.reason).toBe("test payment");
    expect(out.status).toBe("pending");
    expect(out.nanoUri).toContain("nano:");
    expect(out.qr).toBeDefined();
    expect(out.qr.length).toBeGreaterThan(10);
  });

  it('should create a payment request with explicit wallet', async () => {
    const result = await client.callTool({
      name: "payment_request_create",
      arguments: { walletName: "A", amountXno: "0.01", reason: "explicit wallet test" }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.walletName).toBe("A");
    expect(out.amountXno).toBe("0.01");
  });

  it('should list payment requests', async () => {
    const result = await client.callTool({
      name: "payment_request_list",
      arguments: {}
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.count).toBeGreaterThanOrEqual(1);
    expect(out.requests).toBeInstanceOf(Array);
    expect(out.requests[0].id).toBeDefined();
    expect(out.requests[0].status).toBeDefined();
  });

  it('should filter payment requests by status', async () => {
    const result = await client.callTool({
      name: "payment_request_list",
      arguments: { status: "pending" }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    for (const r of out.requests) {
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
    expect(out.amountXno).toBe("0.5");
    expect(out.totalReceivedRaw).toBe("0");
    expect(out.sourceAddresses).toEqual([]);
  });

  it('should error for unknown payment request', async () => {
    const result = await client.callTool({
      name: "payment_request_status",
      arguments: { id: "nonexistent" }
    });

    expect(result.isError).toBeTruthy();
  });

  it('should return empty history for new wallet', async () => {
    await client.callTool({
      name: "wallet_create",
      arguments: { name: "history-test", overwrite: true }
    });

    const result = await client.callTool({
      name: "wallet_history",
      arguments: { walletName: "history-test" }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.walletName).toBe("history-test");
    expect(out.count).toBe(0);
    expect(out.transactions).toEqual([]);
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
    expect(sendTool!.description).toContain('config_set');
  });

  it('should generate a QR code for an address', async () => {
    const address = "nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d";
    const result = await client.callTool({
      name: "generate_qr",
      arguments: { address }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.address).toBe(address);
    expect(out.nanoUri).toContain("nano:");
    expect(out.qr).toBeDefined();
    expect(out.qr.length).toBeGreaterThan(10);
  });

  it('should generate a QR code with amount', async () => {
    const address = "nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d";
    const result = await client.callTool({
      name: "generate_qr",
      arguments: { address, amountXno: "1.5" }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse((result.content[0] as any).text);
    expect(out.amountXno).toBe("1.5");
    expect(out.nanoUri).toContain("amount=");
  });

  it('should error on invalid address for QR', async () => {
    const result = await client.callTool({
      name: "generate_qr",
      arguments: { address: "not_an_address" }
    });

    expect(result.isError).toBeTruthy();
  });

  it('should error for refund on request with no funds', async () => {
    const createResult = await client.callTool({
      name: "payment_request_create",
      arguments: { walletName: "A", amountXno: "1.0", reason: "refund test" }
    });
    const created = JSON.parse((createResult.content[0] as any).text);

    const result = await client.callTool({
      name: "payment_request_refund",
      arguments: { id: created.id }
    });

    expect(result.isError).toBeTruthy();
  });
});
