# Configuration Reference

On-demand configuration reference for `xno-mcp` / xno-skills. Load this when you need override precedence, env vars, or set/reset semantics.

## Defaults (zero-config)

- Public RPC nodes (`rainstorm.city`, `nanoslo.0x.no/proxy`, `rpc.nano.to`)
- PoW: local WASM/GPU by default; falls back to remote via the first RPC node when local is not performant
- Representative: `nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4`
- Max per send: `1.0 XNO`

## Config file behavior

`xno-mcp` reads configuration from a JSON file on disk. It reloads the file before every operation, so manual edits take effect immediately. No restart required.

### Override precedence

**Remote PoW URL** (resolved in order):
1. `NANO_WORK_URL` env var
2. saved config `workUrl`
3. `NANO_RPC_URL` env var
4. saved config `rpcUrl`
5. default primary RPC node

**RPC endpoint list** (normal traffic):
1. explicit tool argument `rpcUrl`
2. saved config `rpcUrl`
3. `NANO_RPC_URL` env var
4. default RPC node list

### Setting values

```json
{ "name": "config_set", "arguments": { "workUrl": "https://my-node.example/api" } }
```

### Resetting values

Setting a string field to `""` or `null` clears the saved override (falls back to defaults):
```json
{ "name": "config_set", "arguments": { "workUrl": "" } }
```

Setting a number field to `null` clears the saved override:
```json
{ "name": "config_set", "arguments": { "powTimeoutMs": null } }
```

Omitted fields are preserved unchanged.
