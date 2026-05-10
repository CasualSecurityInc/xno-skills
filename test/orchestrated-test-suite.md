# Nano MCP v3 Orchestrated Test Suite

## Goal
Exercise all 27 renamed MCP tools through the `casualsecurityinc/nano` skill to verify the agent correctly routes from natural language prompts to dot-notation tool calls without human hints.

## Environment

- MCP server: `xno-mcp` (v3.0.0, local stdio)
- Skill: `casualsecurityinc/nano` (v3.0.0)
- **Mock mode** (default for tests): Set `XNO_MCP_MOCK_OWS=true` env var. Creates a single mock wallet named `A`.
- **Real mode**: Uses actual OWS wallets. Wallet names vary. Query `wallet.list` first to discover names.

## Instructions for the Orchestrator

1. **Choose mode** before starting:
   - **Mock mode**: `export XNO_MCP_MOCK_OWS=true` before launching the MCP server. Wallet `A` exists.
   - **Real mode**: No env var needed. Run Step 1 first to discover wallet names, then substitute the real wallet name for `A` in all subsequent steps.
2. **Reset state** before each run: `rm -rf ~/.xno-mcp/requests.json ~/.xno-mcp/transactions.json`
3. **Process sequentially** — some steps depend on state from earlier steps (e.g., payment request IDs)
4. **For each step**, delegate to a subagent with this exact prompt:
   > The user said: "[USER_PROMPT]"
   > Use the nano skill. Call the appropriate xno-mcp tool. Return the tool name, arguments, and raw response.
5. **Capture results** in the pass/fail table below
6. **Stop on first failure** and report: what the agent tried, what tool it called (if any), and the error

## Test Steps

### Phase 1: Setup / Discovery
- [ ] **Step 1**: "What wallets do I have?"
  - Expected: `wallet.list` {}
- [ ] **Step 2**: "What's the Nano address for my wallet A?"
  - Expected: `wallet.address` {"wallet": "A"}
- [ ] **Step 3**: "Is the wallet signing daemon working?"
  - Expected: `wallet.ows_health` {}
- [ ] **Step 4**: "What's the current server configuration?"
  - Expected: `config.get` {}
- [ ] **Step 5**: "I want to raise my spending limit to 5 XNO."
  - Expected: `config.set` {"maxSendXno": "5.0"}

### Phase 2: Reading State
- [ ] **Step 6**: "Check the balance on wallet A. Tell me if there's anything pending too."
  - Expected: `wallet.balance` {"wallet": "A", "count": 10}
- [ ] **Step 7**: "Give me everything about wallet A — frontier, representative, balance, the works."
  - Expected: `wallet.info` {"wallet": "A"}
- [ ] **Step 8**: "Show me the last 20 transactions for wallet A."
  - Expected: `wallet.history` {"wallet": "A", "limit": 20}
- [ ] **Step 9**: "How much XNO does nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7 have?"
  - Expected: `rpc.account_balance` {"address": "nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7"}
- [ ] **Step 10**: "Get the full account info for that same address."
  - Expected: `rpc.account_info` {"address": "nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7"}
- [ ] **Step 11**: "Are there any pending receivable blocks for wallet A?"
  - Expected: `rpc.receivable` {"address": "nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7", "count": 10}
- [ ] **Step 12**: "Does the node I'm connected to support remote proof of work?"
  - Expected: `rpc.probe` {}

### Phase 3: Utilities
- [ ] **Step 13**: "Is nano_1invalid a valid Nano address?"
  - Expected: `util.validate` {"address": "nano_1invalid"}
- [ ] **Step 14**: "How much is 1.5 XNO in raw?"
  - Expected: `util.convert` {"amount": "1.5", "from": "xno", "to": "raw"}
- [ ] **Step 15**: "Convert 1000000000000000000000000000 raw to mnano."
  - Expected: `util.convert` {"amount": "1000000000000000000000000000", "from": "raw", "to": "mnano"}
- [ ] **Step 16**: "Make me a QR code for wallet A's address."
  - Expected: `util.qr` {"address": "nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7"}

### Phase 4: Operations
- [ ] **Step 17**: "There should be pending funds for wallet A — receive them."
  - Expected: `wallet.receive` {"wallet": "A", "count": 10}
- [ ] **Step 18**: "Send 0.01 XNO from wallet A to nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7."
  - Expected: `wallet.send` {"wallet": "A", "destination": "nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7", "amountXno": "0.01"}
- [ ] **Step 19**: "Change the representative on wallet A to nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4."
  - Expected: `wallet.change_rep` {"wallet": "A", "representative": "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4"}

### Phase 5: Expert / Block Building
- [ ] **Step 20**: "Build me an unsigned send block from wallet A's address to nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7 for 0.01 XNO. I want the hex."
  - Expected: `block.send` {"account": "nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7", "to": "nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7", "amountXno": "0.01"}
- [ ] **Step 21**: "Build an unsigned receive block hex for wallet A."
  - Expected: `block.receive` {"account": "nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7"}
- [ ] **Step 22**: "Build an unsigned change representative block for wallet A to nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4."
  - Expected: `block.change` {"account": "nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7", "representative": "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4"}
- [ ] **Step 23**: "Sign and submit this block hex I have using wallet A."
  - Expected: `wallet.submit_block` {"wallet": "A", "txHex": "<hex-from-step-20>", "subtype": "send"}

### Phase 6: Payment Requests
- [ ] **Step 24**: "Create an invoice for 0.1 XNO for consulting work. Use wallet A."
  - Expected: `payment.create` {"walletName": "A", "amountXno": "0.1", "reason": "consulting work"}
- [ ] **Step 25**: "Show me all my payment requests."
  - Expected: `payment.list` {}
- [ ] **Step 26**: "What's the status of that invoice I just created?"
  - Expected: `payment.status` {"id": "<id-from-step-24>"}
- [ ] **Step 27**: "The client says they paid the invoice. Receive the funds."
  - Expected: `payment.receive` {"id": "<id-from-step-24>"}
- [ ] **Step 28**: "The client wants a refund for that invoice."
  - Expected: `payment.refund` {"id": "<id-from-step-24>", "execute": false} (dry run)
  - Then confirm: `payment.refund` {"id": "<id-from-step-24>", "execute": true, "confirmAddress": "<original-sender>"}

## Pass / Fail Criteria

| Step | Prompt | Expected Tool | Actual Tool | Args Match? | Clean Response? | Notes |
|------|--------|---------------|-------------|-------------|-----------------|-------|
| 1 | What wallets do I have? | wallet.list | | | | |
| 2 | What's the Nano address for my wallet A? | wallet.address | | | | |
| 3 | Is the wallet signing daemon working? | wallet.ows_health | | | | |
| 4 | What's the current server configuration? | config.get | | | | |
| 5 | I want to raise my spending limit to 5 XNO. | config.set | | | | |
| 6 | Check the balance on wallet A... | wallet.balance | | | | |
| 7 | Give me everything about wallet A... | wallet.info | | | | |
| 8 | Show me the last 20 transactions... | wallet.history | | | | |
| 9 | How much XNO does nano_3i1aq... have? | rpc.account_balance | | | | |
| 10 | Get the full account info for that same address. | rpc.account_info | | | | |
| 11 | Are there any pending receivable blocks for wallet A? | rpc.receivable | | | | |
| 12 | Does the node support remote PoW? | rpc.probe | | | | |
| 13 | Is nano_1invalid a valid address? | util.validate | | | | |
| 14 | How much is 1.5 XNO in raw? | util.convert | | | | |
| 15 | Convert 1000... raw to mnano. | util.convert | | | | |
| 16 | Make me a QR code for wallet A. | util.qr | | | | |
| 17 | Receive pending funds for wallet A. | wallet.receive | | | | |
| 18 | Send 0.01 XNO from wallet A... | wallet.send | | | | |
| 19 | Change the representative on wallet A... | wallet.change_rep | | | | |
| 20 | Build an unsigned send block... | block.send | | | | |
| 21 | Build an unsigned receive block... | block.receive | | | | |
| 22 | Build an unsigned change block... | block.change | | | | |
| 23 | Sign and submit this block hex... | wallet.submit_block | | | | |
| 24 | Create an invoice for 0.1 XNO... | payment.create | | | | |
| 25 | Show me all my payment requests. | payment.list | | | | |
| 26 | What's the status of that invoice? | payment.status | | | | |
| 27 | The client paid. Receive the funds. | payment.receive | | | | |
| 28 | The client wants a refund. | payment.refund | | | | |

## Failure Analysis

If any step fails, inspect in this order:
1. **Skill activation** — did the prompt contain a trigger keyword (nano, xno, wallet, balance, send, etc.)?
2. **Tool routing** — is the tool description clear enough for the model to map the intent?
3. **Parameter inference** — does the model know which params are required vs optional? Are param descriptions specific?
4. **Annotations** — is the model overly cautious about calling write tools? (annotations should signal safety)
5. **Output schema** — did the tool return data the model expected? (structured vs plain text)

## Known Limitations

- **Mock mode required**: Steps 2, 6–8, 17–19, 23–24, 27–28 assume wallet `A` exists. In real mode, substitute the actual wallet name discovered in Step 1.
- Step 9 uses the wallet's own address for external balance query (self-query is valid)
- Step 18 sends to the wallet's own address (self-send is valid)
- Step 23 requires a hex from step 20 — the orchestrator must capture and forward it
- Step 26–28 require a payment request ID from step 24 — the orchestrator must capture and forward it
- Step 28 has two tool calls (dry run + execute) — both must succeed
- Step 15 (`util.convert` raw → mnano): Fixed in v3.0.1 — was returning input unchanged due to incorrect knano/mnano scaling (10^33/10^36 instead of 10^27/10^24)
