# Troubleshooting Reference

On-demand recovery procedures for the Nano skill. Entry point: run `system_diag` / `xno-skills diag` first (see SKILL.md).

## "RPC request failed: All endpoints exhausted"

Almost always transient (rate limiting, brief node restart). Follow in order, stopping as soon as one works:

| Step | Action |
|---|---|
| 1 | Wait 5 s. Retry with identical arguments. |
| 2 | `config_set({ rpcUrl: "https://rainstorm.city/api" })`, retry. |
| 3 | `config_set({ rpcUrl: "https://nanoslo.0x.no/proxy" })`, retry. |
| 4 | `config_set({ rpcUrl: "https://rpc.nano.to" })`, retry. |
| 5 | Try any other public node, retry. |
| 6 | `config_set({ rpcUrl: "" })` to reset. **Stop — report to user.** |

Calling `config_set` with a new `rpcUrl` creates a fresh `NanoClient`, bypassing the exponential backoff cooldown on default endpoints.

**Prohibited at every step**: custom scripts, curl, CLI `block` commands, manual PoW.

## MCP Server Crashes & "Not connected" Errors

- **OWS is an in-process library, NOT a daemon**: There is no background "OWS daemon" or wallet service running. `@open-wallet-standard/core` is a library loaded entirely in-process by the MCP server and CLI.
- **"Not connected" from MCP client**: If an MCP client/agent receives a "Not connected" error on `wallet_balance` or any other tool, it typically means the underlying `xno-mcp` server process has crashed (usually due to a Rust native addon panic during PoW or backend initialization) or was terminated. It does **not** mean a background daemon is down.

## PoW failures (`POW_FAILED` / timeout)

**PoW is done locally by default.** xno-skills uses WASM-based Proof of Work that runs in-process — no external work peer is required.

On first use, the system probes local backends to build a local-first execution plan. This probe itself runs real PoW and may take 5–15 seconds — this is normal and happens on the first PoW operation in a process.

**Diagnose in order, stopping at the first resolution:**

| Step | Check | Action |
|---|---|---|
| 1 | Was this the very first `send`/`receive` on a fresh MCP or CLI process? | Allow for first-use warmup. Retry the operation once. |
| 2 | Did the error say "Timed out after 10000ms"? | That is the local WASM per-backend timeout. It means WASM itself failed or is unavailable. Check Node.js version (`node --version`) — WASM PoW requires Node 16+. |
| 3 | Is the system under heavy CPU load? | WASM PoW is CPU-bound. A send block requires ~8× more work than receive. Wait for load to drop, then retry. |
