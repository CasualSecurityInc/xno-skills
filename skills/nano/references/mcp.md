# xno-skills mcp

```
Usage: xno-skills mcp [options]

Start the MCP server or view configuration instructions

Options:
  -h, --help  display help for command

Configuration for popular AI agent harnesses:

Preferred (global install — avoids npx concurrency handshake failures):

  npm install -g xno-skills@4.6.1

1. Claude Desktop / Cursor / Roo Code (in config.json):
{
  "mcpServers": {
    "xno": {
      "command": "xno-skills",
      "args": ["mcp"]
    }
  }
}

2. Gemini CLI:
  gemini mcp add xno xno-skills mcp

3. Claude Code:
  claude mcp add xno xno-skills mcp

Fallback (if global install is not possible):

1. Claude Desktop / Cursor / Roo Code (in config.json):
{
  "mcpServers": {
    "xno": {
      "command": "npx",
      "args": ["-y", "xno-skills@4.6.1", "mcp"]
    }
  }
}

2. Gemini CLI:
  gemini mcp add xno npx -y xno-skills@4.6.1 mcp

3. Claude Code:
  claude mcp add xno npx -y xno-skills@4.6.1 mcp

To run the MCP server directly in this terminal:
  xno-skills mcp        (if globally installed)
  npx -y xno-skills mcp (fallback)
```
