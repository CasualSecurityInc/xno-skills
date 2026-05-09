# xno-skills mcp

```
Usage: cli mcp [options]

Start the MCP server or view configuration instructions

Options:
  -h, --help  display help for command

Configuration for popular AI agent harnesses:

1. Claude Desktop / Cursor / Roo Code (in config.json):
{
  "mcpServers": {
    "xno": {
      "command": "npx",
      "args": ["-y", "xno-skills@latest", "mcp"]
    }
  }
}

2. Gemini CLI:
  gemini mcp add xno npx -y xno-skills@latest mcp

3. Claude Code:
  claude mcp add xno npx -y xno-skills@latest mcp

To run the MCP server directly in this terminal:
  npx -y xno-skills mcp
```
