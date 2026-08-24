# Block-Lattice Protocol Reference

On-demand protocol reference for the Nano skill. Load this when you need block anatomy, PoW thresholds, key derivations, or consensus details — not during routine wallet operations.

## Block-Lattice Mental Model

**The ledger is a block lattice** — a set of completely independent account-chains.

- Every account maintains its own linear chain of state blocks.
- Only the account owner (private-key holder) can append to their chain.
- No global mempool, no miners, no gas fees, no block producers.
- Each block records the **full current state** of its account (balance, representative, previous hash).
- Total supply is fixed at genesis.

### Universal State Blocks

**All blocks today are Universal State Blocks** (`type: "state"`):

```json
{
  "type": "state",
  "account": "nano_...",
  "previous": "64-hex...",       // frontier hash, or "0" for open block
  "representative": "nano_...",
  "balance": "decimal-string",   // new balance in raw (1 XNO = 10^30 raw)
  "link": "...",                 // send: destination address; receive: send block hash; change: "0"
  "signature": "128-hex...",
  "work": "16-hex..."
}
```

### The Account-Chain Dance

**Alice sends to Bob**:
1. Alice builds a Send block: `previous` = her frontier, `balance` = old − amount, `link` = Bob's address.
2. Alice signs + PoW + broadcasts. Funds are **irrevocably deducted** from Alice and become **pending** on Bob's chain.

**Bob must claim**:
1. Bob builds a Receive block: `previous` = his frontier (zeros for open), `balance` = old + amount, `link` = Alice's send block hash.
2. Bob signs + PoW + broadcasts. Only then are funds spendable.

**Critical**: The send is final for Alice. Funds are not spendable by Bob until his receive block is confirmed. There is no automatic receive. Pending funds sit forever until claimed.

### PoW Thresholds (Epoch v2, 2026)

- Send / Change: `fffffff800000000`
- Receive / Open / Epoch: `fffffe0000000000`

Epoch blocks use the receive/open threshold above. The historical epoch-1
threshold `ffffffc000000000` is legacy-only and must not be selected for
current mainnet blocks.

PoW input:
- Open block (height 1): `blake2b(nonce || public_key)`
- All other blocks: `blake2b(nonce || previous_frontier_hash)`

### Representatives & ORV

- Voting weight = balance delegated to a representative.
- Quorum = >67% of online weight → confirmed → cemented (deterministic finality, typically <1s).
- Choose representatives with high uptime, low voting weight concentration, and trustworthy operators.
- Lists: [blocklattice.io/representatives](https://blocklattice.io/representatives), [nanoticker.org](https://nanoticker.org/representatives)

### Data Representations

- **Seed**: 32 bytes (64 hex, uppercase)
- **Private key**: `blake2b(32, seed || index)`, index as 4-byte big-endian uint
- **Address**: `nano_` + 52-base32(public key) + 8-base32(Blake2b-40 checksum). Total 65 chars.
- **Block hash / frontier**: 32 bytes (64 hex)
- **Signature**: 64 bytes (128 hex), Ed25519 + Blake2b
- **Work**: 8 bytes (16 hex)
- **Balance**: always raw units as decimal string in JSON. Never floating-point.
