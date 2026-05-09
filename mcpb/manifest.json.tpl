{
  "manifest_version": "0.2",
  "name": "xno-skills",
  "version": "{{VERSION}}",
  "description": "Nano (XNO) MCP server — send, receive, check balances, manage payment requests, and track transactions. For wallet creation and management, also install the ows skill: npx skills add -a -g -y open-wallet-standard/core/ows",
  "author": {
    "name": "Casual Security Inc",
    "url": "https://github.com/CasualSecurityInc/xno-skills"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/CasualSecurityInc/xno-skills"
  },
  "server": {
    "type": "node",
    "entry_point": "server/dist/esm/mcp.js",
    "mcp_config": {
      "command": "node",
      "args": [
        "${__dirname}/server/dist/esm/mcp.js"
      ],
      "env": {
        "XNO_MAX_SEND": "${user_config.XNO_MAX_SEND}",
        "NANO_RPC_URL": "${user_config.NANO_RPC_URL}",
        "XNO_WORK_URL": "${user_config.XNO_WORK_URL}",
        "XNO_MCP_HOME": "${user_config.XNO_MCP_HOME}"
      }
    }
  },
  "compatibility": {
    "platforms": ["darwin", "linux"]
  },
  "user_config": {
    "XNO_MAX_SEND": {
      "type": "string",
      "title": "Max Send (XNO)",
      "description": "Maximum XNO allowed per send transaction",
      "default": "1.0"
    },
    "NANO_RPC_URL": {
      "type": "string",
      "title": "Nano RPC URL",
      "description": "Override the default public Nano node RPC endpoint"
    },
    "XNO_WORK_URL": {
      "type": "string",
      "title": "Work Peer URL",
      "description": "Override the remote proof-of-work endpoint"
    },
    "XNO_MCP_HOME": {
      "type": "directory",
      "title": "State Directory",
      "description": "Directory for config, payment requests, and transaction state"
    }
  }
}
