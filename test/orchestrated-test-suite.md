# Nano MCP v3 Real-Mode Test Suite

## Goal
Exercise all 27 renamed MCP tools through the `casualsecurityinc/nano` skill against **real** OWS wallets. The agent discovers wallet names dynamically — no hardcoded names, no mock mode.

## Environment

- MCP server: `xno-mcp` (local stdio)
- Skill: `casualsecurityinc/nano`
- **Real mode only**: `XNO_MCP_MOCK_OWS` must be unset. Uses actual OWS wallets with real keys.
- **Safety**: The test only sends tiny amounts (0.01 XNO) to the wallet's own address (self-send is valid and free). Block-building steps are unsigned (no funds moved). Payment requests are tracked locally, not on-chain.

## Instructions for the Orchestrator

1. **Ensure real mode**: `unset XNO_MCP_MOCK_OWS` (or verify it's not set)
2. **Reset local state** before each run: `rm -rf ~/.xno-mcp/requests.json ~/.xno-mcp/transactions.json`
3. **Process sequentially** — state flows between steps
4. **Dynamic substitution**: After Step 1, capture the first wallet name and substitute `<wallet>` in all subsequent prompts
5. **Dynamic substitution**: After Step 2, capture the wallet's address and substitute `<address>` in all subsequent prompts
6. **For each step**, delegate to a subagent with:
   > The user said: "[USER_PROMPT]"
   > Use the nano skill. Call the appropriate xno-mcp tool. Return the tool name, arguments, and raw response.
7. **Capture results** in the pass/fail table
8. **Stop on first failure** and report: what the agent tried, what tool it called (if any), and the error

## Dynamic Variables

| Variable | Source | Steps Used |
|----------|--------|------------|
| `<wallet>` | Step 1: first wallet name from `wallet.list` | 2, 6–8, 16–20, 22–24 |
| `<address>` | Step 2: address from `wallet.address` for `<wallet>` | 9–11, 16, 20–22 |
| `<hex>` | Step 20: `blockHex` from `block.send` response | 23 |
| `<payment-id>` | Step 24: `id` from `payment.create` response | 26–28 |

## Test Steps

### Phase 0: Environment Check

- [ ] **Step 0**: "What versions are running and how was xno-skills invoked?"
  - Expected: `system.info` {}
  - Verify: mockOws is false, OWS is found

### Phase 1: Setup / Discovery

- [ ] **Step 1**: "What wallets do I have?"
  - Expected: `wallet.list` {}
  - Capture: first wallet name → `<wallet>`

- [ ] **Step 2**: "What's the Nano address for my wallet <wallet>?"
  - Expected: `wallet.address` {"wallet": "<wallet>"}
  - Capture: address → `<address>`

- [ ] **Step 3**: "Is the wallet signing daemon working?"
  - Expected: `wallet.ows_health` {}

- [ ] **Step 4**: "What's the current server configuration?"
  - Expected: `config.get` {}

- [ ] **Step 5**: "I want to raise my spending limit to 5 XNO."
  - Expected: `config.set` {"maxSendXno": "5.0"}

### Phase 2: Reading State

- [ ] **Step 6**: "Check the balance on wallet <wallet>. Tell me if there's anything pending too."
  - Expected: `wallet.balance` {"wallet": "<wallet>", "count": 10}

- [ ] **Step 7**: "Give me everything about wallet <wallet> — frontier, representative, balance, the works."
  - Expected: `wallet.info` {"wallet": "<wallet>"}

- [ ] **Step 8**: "Show me the last 20 transactions for wallet <wallet>."
  - Expected: `wallet.history` {"wallet": "<wallet>", "limit": 20}

- [ ] **Step 9**: "How much XNO does <address> have according to the network?"
  - Expected: `rpc.account_balance` {"address": "<address>"}

- [ ] **Step 10**: "Get the full account info for that same address from the network."
  - Expected: `rpc.account_info` {"address": "<address>"}

- [ ] **Step 11**: "Are there any pending receivable blocks for <address>?"
  - Expected: `rpc.receivable` {"address": "<address>", "count": 10}

- [ ] **Step 12**: "Does the node I'm connected to support remote proof of work?"
  - Expected: `rpc.probe` {}

### Phase 3: Utilities

- [ ] **Step 13**: "Is nano_1invalid a valid Nano address?"
  - Expected: `util.validate` {"address": "nano_1invalid"}

- [ ] **Step 14**: "How much is 1.5 XNO in raw?"
  - Expected: `util.convert` {"amount": "1.5", "from": "xno", "to": "raw"}

- [ ] **Step 15**: "Convert 1000000000000000000000000000 raw to mnano."
  - Expected: `util.convert` {"amount": "1000000000000000000000000000", "from": "raw", "to": "mnano"}

- [ ] **Step 16**: "Make me a QR code for <address>."
  - Expected: `util.qr` {"address": "<address>"}

### Phase 4: Operations

- [ ] **Step 17**: "There should be pending funds for wallet <wallet> — receive them."
  - Expected: `wallet.receive` {"wallet": "<wallet>", "count": 10}
  - Note: May return no pending blocks if nothing is waiting. That's a clean response, not a failure.

- [ ] **Step 18**: "Send 0.01 XNO from wallet <wallet> to <address>."
  - Expected: `wallet.send` {"wallet": "<wallet>", "destination": "<address>", "amountXno": "0.01"}
  - Note: Self-send is valid. Fails only if balance is insufficient.

- [ ] **Step 19**: "Change the representative on wallet <wallet> to nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4."
  - Expected: `wallet.change_rep` {"wallet": "<wallet>", "representative": "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4"}

### Phase 5: Expert / Block Building (unsigned, no funds moved)

- [ ] **Step 20**: "Build me an unsigned send block from <address> to <address> for 0.01 XNO. I want the hex."
  - Expected: `block.send` {"account": "<address>", "to": "<address>", "amountXno": "0.01"}
  - Capture: `blockHex` → `<hex>`
  - Note: Fails if account has 0 balance (can't build send block with no funds). That's expected behavior, not a test failure.

- [ ] **Step 21**: "Build an unsigned receive block hex for <address>."
  - Expected: `block.receive` {"account": "<address>"}
  - Note: Fails if no pending blocks. That's expected behavior, not a test failure.

- [ ] **Step 22**: "Build an unsigned change representative block for <address> to nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4."
  - Expected: `block.change` {"account": "<address>", "representative": "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4"}

- [ ] **Step 23**: "Sign and submit this block hex <hex> using wallet <wallet>."
  - Expected: `wallet.submit_block` {"wallet": "<wallet>", "txHex": "<hex>", "subtype": "send"}
  - Note: Only runnable if Step 20 succeeded and produced a hex.

### Phase 6: Payment Requests (local tracking, no on-chain funds)

- [ ] **Step 24**: "Create an invoice for 0.1 XNO for consulting work. Use wallet <wallet>."
  - Expected: `payment.create` {"walletName": "<wallet>", "amountXno": "0.1", "reason": "consulting work"}
  - Capture: `id` → `<payment-id>`

- [ ] **Step 25**: "Show me all my payment requests."
  - Expected: `payment.list` {}

- [ ] **Step 26**: "What's the status of that invoice I just created?"
  - Expected: `payment.status` {"id": "<payment-id>"}

- [ ] **Step 27**: "The client says they paid the invoice. Receive the funds."
  - Expected: `payment.receive` {"id": "<payment-id>"}
  - Note: Fails if no pending blocks match. That's expected if nobody actually sent funds.

- [ ] **Step 28**: "The client wants a refund for that invoice."
  - Expected: `payment.refund` {"id": "<payment-id>", "execute": false} (dry run)
  - Then confirm: `payment.refund` {"id": "<payment-id>", "execute": true, "confirmAddress": "<address>"}
  - Note: Fails if balance insufficient or payment request was never funded. That's expected behavior.

## Pass / Fail Criteria

| Step | Prompt | Expected Tool | Actual Tool | Args Match? | Clean Response? | Notes |
|------|--------|---------------|-------------|-------------|-----------------|-------|
| 0 | What versions are running? | system.info | | | | |
| 1 | What wallets do I have? | wallet.list | | | | |
| 2 | What's the Nano address for my wallet <wallet>? | wallet.address | | | | |
| 3 | Is the wallet signing daemon working? | wallet.ows_health | | | | |
| 4 | What's the current server configuration? | config.get | | | | |
| 5 | I want to raise my spending limit to 5 XNO. | config.set | | | | |
| 6 | Check the balance on wallet <wallet>... | wallet.balance | | | | |
| 7 | Give me everything about wallet <wallet>... | wallet.info | | | | |
| 8 | Show me the last 20 transactions... | wallet.history | | | | |
| 9 | How much XNO does <address> have? | rpc.account_balance | | | | |
| 10 | Get the full account info for that address. | rpc.account_info | | | | |
| 11 | Are there any pending blocks for <address>? | rpc.receivable | | | | |
| 12 | Does the node support remote PoW? | rpc.probe | | | | |
| 13 | Is nano_1invalid a valid address? | util.validate | | | | |
| 14 | How much is 1.5 XNO in raw? | util.convert | | | | |
| 15 | Convert 10^27 raw to mnano. | util.convert | | | | |
| 16 | Make me a QR code for <address>. | util.qr | | | | |
| 17 | Receive pending funds for <wallet>. | wallet.receive | | | | |
| 18 | Send 0.01 XNO from <wallet> to <address>. | wallet.send | | | | |
| 19 | Change the representative on <wallet>... | wallet.change_rep | | | | |
| 20 | Build an unsigned send block... | block.send | | | | |
| 21 | Build an unsigned receive block... | block.receive | | | | |
| 22 | Build an unsigned change block... | block.change | | | | |
| 23 | Sign and submit this block hex... | wallet.submit_block | | | | |
| 24 | Create an invoice for 0.1 XNO... | payment.create | | | | |
| 25 | Show me all my payment requests. | payment.list | | | | |
| 26 | What's the status of that invoice? | payment.status | | | | |
| 27 | The client paid. Receive the funds. | payment.receive | | | | |
| 28 | The client wants a refund. | payment.refund | | | | |

## Scoring

- **Tool routing**: 28/28 correct tool selection with correct arguments = ✅
- **Execution**: Steps may return empty/no-op responses (no pending blocks, insufficient balance, etc.) — these are **not failures** as long as the tool call itself was valid and the error message is informative.
- **Real failure**: Wrong tool selected, wrong arguments, skill not activated, or cryptic error.

## Failure Analysis

If any step fails, inspect in this order:
1. **Skill activation** — did the prompt contain a trigger keyword (nano, xno, wallet, balance, send, etc.)?
2. **Tool routing** — is the tool description clear enough for the model to map the intent?
3. **Parameter inference** — does the model know which params are required vs optional? Are param descriptions specific?
4. **Annotations** — is the model overly cautious about calling write tools? (annotations should signal safety)
5. **Dynamic variables** — did the orchestrator correctly substitute `<wallet>` and `<address>` from earlier steps?

## Known Behaviors (Not Failures)

- **Step 17** (wallet.receive): Returns empty if no pending blocks exist. Clean.
- **Step 18** (wallet.send): Fails with "insufficient balance" if wallet has < 0.01 XNO. Expected.
- **Step 20** (block.send): Fails with "insufficient balance" or "Account not opened" if account has no funds. Expected.
- **Step 21** (block.receive): Fails with "No receivable blocks found" if nothing pending. Expected.
- **Step 27** (payment.receive): Fails with no pending blocks if invoice was never funded. Expected.
- **Step 28** (payment.refund): Fails with "insufficient balance" if payment request was never funded. Expected.
