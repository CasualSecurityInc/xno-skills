# payment_receive (MCP tool)

Claim inbound funds for a tracked payment request and report status.

```json
{ "name": "payment_receive", "arguments": { "id": "<request-id>" } }
```

Returns status: `pending`, `partial`, `funded`, or `received`.

- `pending` / `partial`: tell the user how much more is needed (for `partial`).
- Never claim receipt without calling this tool — pending is not received in Nano.
- If the operator asks "did you get it?", always re-check, even if you checked before.

Related queries: `payment_status` (single request by ID), `payment_list` (list requests, filterable by wallet/status).
