import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { generateSeed, seedToMnemonic, mnemonicToSeed } from "./seed.js";
import { deriveAddressLegacy } from "./address-legacy.js";
import { validateAddress } from "./validate.js";
import { nanoToRaw, rawToNano } from "./convert.js";

const server = new Server(
  {
    name: "xno-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_wallet",
        description: "Generate a new Nano wallet (mnemonic, seed, and address)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "derive_address",
        description: "Derive a Nano address from a mnemonic or seed",
        inputSchema: {
          type: "object",
          properties: {
            mnemonic: { type: "string" },
            seed: { type: "string" },
            index: { type: "number", default: 0 },
          },
        },
      },
      {
        name: "convert_units",
        description: "Convert between Nano units (xno, raw)",
        inputSchema: {
          type: "object",
          properties: {
            amount: { type: "string" },
            from: { type: "string" },
            to: { type: "string" },
          },
          required: ["amount", "from", "to"],
        },
      },
      {
        name: "validate_address",
        description: "Validate a Nano address and extract public key",
        inputSchema: {
          type: "object",
          properties: {
            address: { type: "string" },
          },
          required: ["address"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "generate_wallet": {
        const seed = generateSeed();
        const mnemonic = seedToMnemonic(seed);
        const { address } = deriveAddressLegacy(seed, 0);
        return {
          content: [{ type: "text", text: JSON.stringify({ mnemonic, seed, address }, null, 2) }],
        };
      }

      case "derive_address": {
        const mnemonic = args?.mnemonic as string;
        const seed = args?.seed as string || (mnemonic ? mnemonicToSeed(mnemonic) : "");
        const index = (args?.index as number) || 0;
        
        if (!seed) throw new Error("Mnemonic or seed required");
        
        const result = deriveAddressLegacy(seed, index);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "convert_units": {
        const amount = args?.amount as string;
        const from = (args?.from as string).toLowerCase();
        const to = (args?.to as string).toLowerCase();
        
        let raw: string;
        if (from === "xno" || from === "nano") raw = nanoToRaw(amount);
        else if (from === "raw") raw = amount;
        else throw new Error("Unsupported from unit");

        let result: string;
        if (to === "xno" || to === "nano") result = rawToNano(raw);
        else if (to === "raw") result = raw;
        else throw new Error("Unsupported to unit");

        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "validate_address": {
        const address = args?.address as string;
        const result = validateAddress(address);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
