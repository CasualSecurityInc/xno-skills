# Autoresearch Evaluation Guide: Nano Integration Skills

## V2 Initialization Template
**Target:** Optimize agent accuracy, tool chaining, and state management for Nano protocol lifecycle tasks.
**Scope:** Phase 0 through Phase 5 test cases, encompassing address validation, raw block building, OWS signing, and precision unit conversions.
**Context:** Must utilize `OWS` and `xno-skills` commands. Requires strict adherence to the Nano block-lattice architecture (dual-block transactions, frontiers, PoW), base32 checksum validation, and exact raw-to-XNO precision tracking. Security constraint: Never expose wallet seeds in standard output.

---

## Evaluation Criteria (Binary Yes/No)
The following criteria must be used to score the agent's output across the 6 phases. Maximum possible score is 20/20.

### Phase 0: Trigger & Disambiguation
1. Does the output accurately explain that a Nano transfer requires two distinct blocks (a Send block by the sender and a Receive block by the recipient)?
   — yes/no — llm-judge
2. Does the output identify `nano_3abc123...` as an invalid or incomplete address (e.g., flagging missing characters or invalid base32/checksum)?
   — yes/no — llm-judge

### Phase 1: Pure Lattice Wisdom
3. Does the output explicitly state that an unpocketed (pending) transaction requires the receiver to publish a Receive block to update their account chain?
   — yes/no — llm-judge
4. Is the account-chain sequence correctly described (Alice's block references her previous frontier and lowers her balance; Bob's block references his previous frontier, references Alice's hash, and raises his balance)?
   — yes/no — llm-judge
5. Does the output correctly explain that the frontier connects the block to the account's history, and PoW (or equivalent QoS/priority mechanism) provides spam resistance?
   — yes/no — llm-judge

### Phase 2: Tool Discovery & Safe Wallet Setup
6. Did the agent successfully invoke the `OWS` tool to generate a standard 24-word mnemonic?
   — yes/no — command-check (verify tool call)
7. Is the 24-word seed completely hidden/redacted from the final user-facing output?
   — yes/no — llm-judge
8. Did the agent successfully output the first derived Nano address (starting with `nano_1` or `nano_3`)?
   — yes/no — llm-judge
9. Did the agent successfully invoke a tool to check the balance and pending status of the test address?
   — yes/no — command-check

### Phase 3: Block Building & OWS Signing
10. Did the agent explicitly use the `xno-skills block` command (or exact equivalent) to construct the JSON state block?
    — yes/no — command-check
11. Is the send amount correctly formatted in raw precision (exactly `1000000000000000000000000000000` for 1 XNO)?
    — yes/no — llm-judge
12. Did the agent successfully sign the block using the `OWS` tool?
    — yes/no — command-check
13. Is the final broadcast transaction hash (64-character hex string) visible in the output?
    — yes/no — llm-judge

### Phase 4: Receive + Full Lifecycle
14. Did the agent construct and sign a receive block for exactly 2.5 XNO (`2500000000000000000000000000000` raw)?
    — yes/no — llm-judge
15. Does the final balance output show BOTH the formatted XNO decimal value and the exact `raw` integer?
    — yes/no — llm-judge
16. Did the agent generate a valid URI/QR string format containing the exact `amount=` parameter for 0.75 XNO (`amount=750000000000000000000000000000`)?
    — yes/no — llm-judge

### Phase 5: Edge Cases & Safety
17. Did the agent successfully build a Send block that routes the exact pending amount directly back to the original sender's address?
    — yes/no — llm-judge
18. Does the output correctly state that submitting a block with the wrong frontier will result in the network rejecting it (fork resolution/unconfirmed state)?
    — yes/no — llm-judge
19. Did the agent attempt to calculate or verify the base32 checksum of the provided `nano_1xyz789...` address rather than just guessing?
    — yes/no — llm-judge
20. Did the agent accurately convert `1337 raw` to `0.000000000000000000000000001337` XNO?
    — yes/no — llm-judge