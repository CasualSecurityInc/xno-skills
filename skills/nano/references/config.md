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

### Spending-limit trust boundary

`maxSendXno` is enforced immediately before signing both normal sends and prepared send blocks.

- If `XNO_MAX_SEND` is set by the owner, it is a hard ceiling.
- Saved `maxSendXno` may make that ceiling lower, never higher.
- Without either value, the default ceiling is `1.0 XNO`.
- The agent-accessible `config_set` tool may only **tighten** the current effective ceiling. It cannot raise the limit or reset it to a higher value.
- Raising or loosening the ceiling is deliberately out-of-band: the owner must edit the config file or environment outside the agent tool call.

This prevents an agent from bypassing a send policy by temporarily increasing `maxSendXno`, sending, and then restoring the old value.
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
