# payment_create (MCP tool)

Create a tracked inbound Nano payment request against an OWS wallet.

```json
{ "name": "payment_create", "arguments": { "walletName": "my-wallet", "amountXno": "0.1", "reason": "testing payment flow" } }
```

| Argument | Required | Notes |
|---|---|---|
| `walletName` | yes | OWS wallet that will receive the funds |
| `amountXno` | yes | Requested amount in XNO |
| `reason` | yes | Description shown to the payer |
| `accountIndex` | no | OWS only supports `0` |

Returns: `nano:` URI, target address, and request ID.

Workflow and rules: see Payment Requests in SKILL.md. Always check existing wallets/balances first.
