#!/usr/bin/env node
/**
 * Generate mcpb/server-card.json by introspecting the MCP tool definitions.
 * Run after the ESM build (needs dist/esm/mcp.js compiled output).
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mcpEntry = resolve(__dirname, '../bin/xno-mcp');
const outputPath = resolve(__dirname, '../mcpb/server-card.json');

if (!existsSync(mcpEntry)) {
  console.error('[generate-server-card] bin/xno-mcp not found. Run tsc first.');
  process.exit(1);
}

import { spawn } from 'node:child_process';

function requestToolList() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [mcpEntry], {
      env: { ...process.env, XNO_MCP_MOCK_OWS: 'true' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buffer = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Timeout waiting for tools/list response'));
    }, 10000);

    child.stdout.on('data', (d) => {
      buffer += d.toString();
      for (const line of buffer.split('\n')) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.result?.tools !== undefined) {
            clearTimeout(timeout);
            child.stdin.end();
            child.kill();
            resolve(msg.result.tools);
            return;
          }
        } catch { /* not JSON, ignore */ }
      }
    });

    child.stderr.on('data', (d) => {
      // Suppress stderr noise during scan
    });

    // MCP initialize request
    const init = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smithery-scanner', version: '1.0.0' } } });
    const toolsList = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    child.stdin.write(init + '\n');
    setTimeout(() => child.stdin.write(toolsList + '\n'), 500);
  });
}

let tools;
try {
  tools = await requestToolList();
} catch (err) {
  console.error('[generate-server-card] Failed to query tools:', err.message);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

const card = {
  serverInfo: {
    name: pkg.name,
    version: pkg.version,
  },
  authentication: {
    required: false,
    schemes: [],
  },
  tools,
  resources: [],
  prompts: [],
};

writeFileSync(outputPath, JSON.stringify(card, null, 2));
console.log(`[generate-server-card] Wrote ${tools.length} tools to ${outputPath}`);
