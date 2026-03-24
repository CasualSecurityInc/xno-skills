import { describe, it, expect } from 'vitest';
import { hashNanoStateBlockHex, buildNanoStateBlockHex, type StateBlockHashInput } from '../src/state-block';
import { decodeNanoAddress } from '../src/nano-address';
import { nanoToRaw } from '../src/convert';

// Known account from test vectors (legacy seed 0x00...00, index 0)
const ZERO_SEED_PUBKEY = '19d3d919475deed4696b5d13018151d1af88b2bd3bcff048b45031c1f36d1858';

const ZERO_HASH = '0'.repeat(64);

const DEFAULT_INPUT: StateBlockHashInput = {
  accountPublicKey: ZERO_SEED_PUBKEY,
  previous: ZERO_HASH,
  representativePublicKey: ZERO_SEED_PUBKEY,
  balanceRaw: '0',
  link: ZERO_HASH,
};

describe('hashNanoStateBlockHex', () => {
  it('returns a 64-char hex string (32-byte blake2b-256 hash)', () => {
    const hash = hashNanoStateBlockHex(DEFAULT_INPUT);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(hashNanoStateBlockHex(DEFAULT_INPUT)).toBe(hashNanoStateBlockHex(DEFAULT_INPUT));
  });

  it('changes when balance changes', () => {
    const a = hashNanoStateBlockHex(DEFAULT_INPUT);
    const b = hashNanoStateBlockHex({ ...DEFAULT_INPUT, balanceRaw: '1' });
    expect(a).not.toBe(b);
  });

  it('changes when link changes', () => {
    const a = hashNanoStateBlockHex(DEFAULT_INPUT);
    const b = hashNanoStateBlockHex({ ...DEFAULT_INPUT, link: '1'.padStart(64, '0') });
    expect(a).not.toBe(b);
  });

  it('rejects non-32-byte hex fields', () => {
    expect(() => hashNanoStateBlockHex({ ...DEFAULT_INPUT, accountPublicKey: 'abc' })).toThrow();
    expect(() => hashNanoStateBlockHex({ ...DEFAULT_INPUT, previous: 'zz'.repeat(32) })).toThrow();
  });

  it('rejects non-decimal balanceRaw', () => {
    expect(() => hashNanoStateBlockHex({ ...DEFAULT_INPUT, balanceRaw: '-1' })).toThrow();
    expect(() => hashNanoStateBlockHex({ ...DEFAULT_INPUT, balanceRaw: '0xff' })).toThrow();
  });
});

describe('buildNanoStateBlockHex', () => {
  it('returns exactly 352 hex chars (176 bytes)', () => {
    const hex = buildNanoStateBlockHex(DEFAULT_INPUT);
    expect(hex).toHaveLength(352);
    expect(hex).toMatch(/^[0-9a-f]{352}$/);
  });

  it('starts with state block preamble (31 zero bytes + 0x06)', () => {
    const hex = buildNanoStateBlockHex(DEFAULT_INPUT);
    const preamble = hex.slice(0, 64);
    expect(preamble).toBe('0'.repeat(62) + '06');
  });

  it('places account pubkey at bytes 32-63', () => {
    const hex = buildNanoStateBlockHex(DEFAULT_INPUT);
    expect(hex.slice(64, 128)).toBe(ZERO_SEED_PUBKEY);
  });

  it('places previous hash at bytes 64-95', () => {
    const prev = 'ab'.repeat(32);
    const hex = buildNanoStateBlockHex({ ...DEFAULT_INPUT, previous: prev });
    expect(hex.slice(128, 192)).toBe(prev);
  });

  it('places representative pubkey at bytes 96-127', () => {
    const hex = buildNanoStateBlockHex(DEFAULT_INPUT);
    expect(hex.slice(192, 256)).toBe(ZERO_SEED_PUBKEY);
  });

  it('encodes balance as 16-byte big-endian at bytes 128-143', () => {
    // 1 XNO = 10^30 raw, as 16-byte BE hex
    const hex = buildNanoStateBlockHex({ ...DEFAULT_INPUT, balanceRaw: nanoToRaw('1') });
    const balanceHex = hex.slice(256, 288);
    expect(balanceHex).toBe('0000000c9f2c9cd04674edea40000000');
  });

  it('encodes zero balance correctly', () => {
    const hex = buildNanoStateBlockHex({ ...DEFAULT_INPUT, balanceRaw: '0' });
    expect(hex.slice(256, 288)).toBe('0'.repeat(32));
  });

  it('places link at bytes 144-175', () => {
    const link = 'cd'.repeat(32);
    const hex = buildNanoStateBlockHex({ ...DEFAULT_INPUT, link });
    expect(hex.slice(288, 352)).toBe(link);
  });

  it('hashing the built block matches hashNanoStateBlockHex', async () => {
    const input: StateBlockHashInput = {
      accountPublicKey: ZERO_SEED_PUBKEY,
      previous: 'ab'.repeat(32),
      representativePublicKey: ZERO_SEED_PUBKEY,
      balanceRaw: nanoToRaw('1.5'),
      link: 'cd'.repeat(32),
    };
    const blockHex = buildNanoStateBlockHex(input);
    const expectedHash = hashNanoStateBlockHex(input);

    // Manually hash the built block bytes using the same blake2b
    const { blake2b } = await import('@noble/hashes/blake2b.js');
    const { hexToBytes, bytesToHex } = await import('@noble/hashes/utils.js');
    const hash = bytesToHex(blake2b(hexToBytes(blockHex), { dkLen: 32 }));
    expect(hash).toBe(expectedHash);
  });

  // Test vector from nano-node core_test/block.cpp (block_builder, state)
  it('matches known hash from Nano reference implementation', () => {
    const hash = hashNanoStateBlockHex({
      accountPublicKey: '0e8f7825fe07a6abd9f264a3e7831c117775c83aa18b601bf90df7ec851331ff',
      previous: 'fefbce274e75148ab31ff63efb3082ef1126bf72bf3fa9c76a97fd5a9f0ebec5',
      representativePublicKey: '67556d31ddfc2a440bf6147501449b4cb9572278d034ee686a6bee29851681df',
      balanceRaw: '2251569974100400000000000000000000',
      link: 'e16dd58c1efa8b521545b0a74375aa994d9fc43828a4266d75ecf57f07a7ee86',
    });
    expect(hash).toBe('2d243f8f92cdd0ad94a1d456a6b15f3be7a6fcbd98d4c5831d06d15c818cd81f');
  });

  it('constructs a valid send block from real addresses', () => {
    const sender = decodeNanoAddress('nano_1uwjfku61c7zptbikaphuisnk8ocn5rna3f1mfquz37rjadaqd1orp6t1anr');
    const recipient = decodeNanoAddress('nano_1y4wm8gy3cew19h5a97xgtzqzqixqops7yp3gtm39ktzoqp5o19tzgzhf581');
    const rep = decodeNanoAddress('nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4');

    const currentBalance = BigInt(nanoToRaw('1'));
    const sendAmount = BigInt(nanoToRaw('0.01'));
    const newBalance = currentBalance - sendAmount;

    const hex = buildNanoStateBlockHex({
      accountPublicKey: sender.publicKey,
      previous: 'ff'.repeat(32),
      representativePublicKey: rep.publicKey,
      balanceRaw: newBalance.toString(),
      link: recipient.publicKey,
    });

    expect(hex).toHaveLength(352);
    // Account field should be sender's pubkey
    expect(hex.slice(64, 128)).toBe(sender.publicKey);
    // Link field should be recipient's pubkey
    expect(hex.slice(288, 352)).toBe(recipient.publicKey);
  });
});
