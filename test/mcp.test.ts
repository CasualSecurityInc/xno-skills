import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createServer, type Server } from 'node:http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_BIN_PATH = path.resolve(__dirname, '../bin/xno-skills');

function getText(result: unknown): string {
  return ((((result as any).content) as any[])[0] as any).text;
}

describe('MCP Server Integration', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let rpcServer: Server;
  let rpcUrl: string;

  function mcpEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      XNO_MCP_MOCK_OWS: "true",
      NANO_RPC_URL: rpcUrl,
      NANO_WORK_URL: rpcUrl,
    };
  }

  beforeAll(async () => {
    rpcServer = createServer((req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405).end();
        return;
      }

      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        const payload = JSON.parse(body || '{}');
        const action = payload.action;
        let response: unknown;

        if (action === 'version') {
          response = {
            rpc_version: '1',
            store_version: '26',
            protocol_version: '21',
            node_vendor: 'Nano V26.1',
            network: 'live',
          };
        } else if (action === 'block_count') {
          response = { count: '100', unchecked: '0', cemented: '90' };
        } else if (action === 'process') {
          response = { error: 'Block work is less than threshold' };
        } else if (action === 'work_generate') {
          response = { work: 'f'.repeat(16) };
        } else if (action === 'account_history') {
          response = { history: [] };
        } else if (action === 'account_balance') {
          response = { balance: '0', pending: '0' };
        } else if (action === 'account_info') {
          response = { error: 'Account not found' };
        } else if (action === 'receivable' || action === 'accounts_pending') {
          response = { blocks: {} };
        } else {
          response = { error: `unsupported action: ${action}` };
        }

        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(response));
      });
    });

    await new Promise<void>((resolve) => {
      rpcServer.listen(0, '127.0.0.1', resolve);
    });
    const address = rpcServer.address();
    if (!address || typeof address === 'string') throw new Error('failed to start RPC test server');
    rpcUrl = `http://127.0.0.1:${address.port}`;
  });

  it('should start and connect successfully (Handshake test)', async () => {
    const testClient = new Client(
      { name: "startup-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const testTransport = new StdioClientTransport({
      command: "node",
      args: [MCP_BIN_PATH, "mcp"],
      env: mcpEnv()
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
      env: mcpEnv()
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
    if (rpcServer) {
      await new Promise<void>((resolve) => rpcServer.close(() => resolve()));
    }
  });

  it('should list all available tools', async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map(t => t.name);
    
    expect(toolNames).not.toContain('generate_wallet');
    expect(toolNames).not.toContain('derive_address');
    expect(toolNames).toContain('util_convert');
    expect(toolNames).toContain('util_validate');
    expect(toolNames).not.toContain('wallet_create');
    expect(toolNames).toContain('wallet_list');
    expect(toolNames).not.toContain('wallet_addresses');
    expect(toolNames).toContain('wallet_receive');
    expect(toolNames).toContain('wallet_send');
    expect(toolNames).toContain('config_get');
    expect(toolNames).toContain('config_set');
  });

  it('should convert units via util_convert tool', async () => {
    const result = await client.callTool({
      name: "util_convert",
      arguments: {
        amount: "1",
        from: "xno",
        to: "raw"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(getText(result)).toBe("1000000000000000000000000000000");
  });

  it('should list wallets using OWS', async () => {
    const result = await client.callTool({ name: "wallet_list", arguments: {} });
    expect(result.isError).toBeFalsy();
    const out = JSON.parse(getText(result));
    expect(out.some((p: any) => p.name === "A")).toBe(true);
  });

  it('should validate an address via util_validate tool', async () => {
    const address = "nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d";
    const result = await client.callTool({
      name: "util_validate",
      arguments: { address }
    });

    expect(result.isError).toBeFalsy();
    const validation = JSON.parse(getText(result));
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
    const config = JSON.parse(getText(result));
    expect(config.defaultRepresentative).toBe(validRep);
  });

  it('should create a payment request with explicit OWS wallet', async () => {
    const result = await client.callTool({
      name: "payment_create",
      arguments: { walletName: "A", amountXno: "0.01", reason: "explicit wallet test" }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse(getText(result));
    expect(out.id).toBeDefined();
    expect(out.amountXno).toBe("0.01");
  });

  it('should list payment requests', async () => {
    const result = await client.callTool({
      name: "payment_list",
      arguments: {}
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse(getText(result));
    expect(out).toBeInstanceOf(Array);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].id).toBeDefined();
  });

  it('should filter payment requests by status', async () => {
    const result = await client.callTool({
      name: "payment_list",
      arguments: { status: "pending" }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse(getText(result));
    for (const r of out) {
      expect(r.status).toBe("pending");
    }
  });

  it('should check payment request status', async () => {
    const createResult = await client.callTool({
      name: "payment_create",
      arguments: { walletName: "A", amountXno: "0.5", reason: "status check test" }
    });
    const created = JSON.parse(getText(createResult));

    const result = await client.callTool({
      name: "payment_status",
      arguments: { id: created.id }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse(getText(result));
    expect(out.id).toBe(created.id);
    expect(out.status).toBe("pending");
    expect(out.amountRaw).toBe("500000000000000000000000000000");
  });

  it('should error for unknown payment request', async () => {
    const result = await client.callTool({
      name: "payment_status",
      arguments: { id: "nonexistent" }
    });

    expect(result.isError).toBeTruthy();
  });

  it('should return on-chain history for OWS wallet', async () => {
    const result = await client.callTool({
      name: "wallet_history",
      arguments: { wallet: "A" }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse(getText(result));
    expect(out).toBeInstanceOf(Array);
  });

  it('should set maxSendXno via config_set', async () => {
    const result = await client.callTool({
      name: "config_set",
      arguments: { maxSendXno: "5.0" }
    });

    expect(result.isError).toBeFalsy();
    const config = JSON.parse(getText(result));
    expect(config.maxSendXno).toBe("5.0");
  });

  it('should set powTimeoutMs via config_set', async () => {
    const result = await client.callTool({
      name: "config_set",
      arguments: { powTimeoutMs: 45000 }
    });

    expect(result.isError).toBeFalsy();
    const config = JSON.parse(getText(result));
    expect(config.powTimeoutMs).toBe(45000);
  });

  it('should show maxSendXno in config_get', async () => {
    const result = await client.callTool({
      name: "config_get",
      arguments: {}
    });

    expect(result.isError).toBeFalsy();
    const config = JSON.parse(getText(result));
    expect(config.maxSendXno).toBe("5.0");
  });

  it('should embed max-send cap in wallet_send tool description', async () => {
    const result = await client.listTools();
    const sendTool = result.tools.find(t => t.name === 'wallet_send');
    expect(sendTool).toBeDefined();
    expect(sendTool!.description).toContain('per-transaction limit');
  });

  it('should return health status via wallet_ows_health tool', async () => {
    const result = await client.callTool({
      name: "wallet_ows_health",
      arguments: {}
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse(getText(result));
    expect(out.status).toBe("Ready");
    expect(out.mode).toBe("Mock");
  });

  it('should probe RPC capabilities including work_generate', async () => {
    const result = await client.callTool({
      name: "rpc_probe_caps",
      arguments: { rpcUrl, timeoutMs: 1000 }
    });

    expect(result.isError).toBeFalsy();
    const out = JSON.parse(getText(result));
    expect(out.url).toBe(rpcUrl);
    expect(out.reachable).toBe(true);
    expect(out.caps.jsonRpc).toBeDefined();
    expect(out.caps.jsonRpc.ok).toBe(true);
    expect(out.caps.version).toBeDefined();
    expect(out.caps.version.ok).toBe(true);
    expect(out.caps.blockCount).toBeDefined();
    expect(out.caps.blockCount.ok).toBe(true);
    expect(out.caps.processInvalid).toBeDefined();
    expect(typeof out.caps.processInvalid.ok).toBe('boolean');
    expect(typeof out.caps.processInvalid.status).toBe('string');
    expect(out.caps.workGenerate).toBeDefined();
    expect(typeof out.caps.workGenerate.ok).toBe('boolean');
    expect(typeof out.caps.workGenerate.latencyMs).toBe('number');
    expect(typeof out.caps.workGenerate.status).toBe('string');
  }, 15000);

  it('should generate a QR code for an address', async () => {
    const address = "nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d";
    const result = await client.callTool({
      name: "util_qr",
      arguments: { address }
    });

    expect(result.isError).toBeFalsy();
    const out = (result.content as any)[0].text;
    expect(out).toContain("▄");
  });

  it('should list resources (wallet-status template)', async () => {
    const result = await client.listResources();
    expect(result.resources).toBeInstanceOf(Array);
    const walletA = result.resources.find((r: any) => r.uri === 'xno-wallet://A');
    expect(walletA).toBeDefined();
    expect(walletA!.name).toBe('A');
  });

  it('should list resource templates', async () => {
    const result = await client.listResourceTemplates();
    const templateUris = result.resourceTemplates.map((t: any) => t.uriTemplate);
    expect(templateUris).toContain('xno-wallet://{name}');
    expect(templateUris).toContain('xno-wallet://{name}/account/{index}');
    expect(templateUris).toContain('xno-wallet://{name}/history');
  });

  it('should read xno-payment-requests://list resource', async () => {
    const result = await client.readResource({ uri: 'xno-payment-requests://list' });
    expect(result.contents).toBeInstanceOf(Array);
    expect(result.contents.length).toBeGreaterThan(0);
    const text = (result.contents[0] as any).text;
    const parsed = JSON.parse(text);
    expect(parsed).toBeInstanceOf(Array);
  });

  it('should read xno-wallet://A resource', async () => {
    const result = await client.readResource({ uri: 'xno-wallet://A' });
    expect(result.contents).toBeInstanceOf(Array);
    const parsed = JSON.parse((result.contents[0] as any).text);
    expect(parsed.wallet).toBe('A');
    expect(parsed.address).toBeDefined();
  });
});
