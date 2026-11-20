import type { WalletInfo, SignResult } from '@open-wallet-standard/core';

async function loadOws() {
  try {
    return await import('@open-wallet-standard/core');
  } catch (cause) {
    throw new Error('OWS could not load. Reinstall xno-skills with optional dependencies on a supported platform.', {
      cause,
    });
  }
}

const useMockOws = process.env.XNO_MCP_MOCK_OWS === 'true';

type WalletLike =
  | WalletInfo
  | {
      id?: string;
      name: string;
      createdAt: string;
      accounts: Array<{ address: string; chainId: string; derivationPath: string }>;
    };

const mockWallet: WalletLike = {
  id: 'mock-wallet-a',
  name: 'A',
  createdAt: new Date().toISOString(),
  accounts: [
    {
      address: 'nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7',
      chainId: 'nano',
      derivationPath: "m/44'/165'/0'/0/0",
    },
  ],
};

export const listWalletsProxy = useMockOws
  ? async (): Promise<WalletLike[]> => [mockWallet, ...mockCreatedWallets.values()]
  : async () => (await loadOws()).listWallets();

export const getWalletProxy = useMockOws
  ? async (name: string): Promise<WalletLike | null> =>
      name === 'A' ? mockWallet : (mockCreatedWallets.get(name) ?? null)
  : async (name: string) => (await loadOws()).getWallet(name);

export const signTransactionProxy = useMockOws
  ? async (
      _wallet: string,
      _chain: string,
      _tx: string,
      _passphrase?: string,
      _index?: number,
    ): Promise<SignResult> => ({ signature: '0'.repeat(128) })
  : async (wallet: string, chain: string, tx: string, passphrase?: string, index?: number) =>
      (await loadOws()).signTransaction(wallet, chain, tx, passphrase, index);

export const signMessageProxy = useMockOws
  ? async (
      _wallet: string,
      _chain: string,
      _msg: string,
      _passphrase?: string,
      _encoding?: string,
      _index?: number,
    ): Promise<SignResult> => ({ signature: '0'.repeat(128) })
  : async (wallet: string, chain: string, msg: string, passphrase?: string, encoding?: string, index?: number) =>
      (await loadOws()).signMessage(wallet, chain, msg, passphrase, encoding, index);

const mockCreatedWallets = new Map<string, WalletLike>();

export async function createWalletProxy(name: string): Promise<WalletLike> {
  if (!useMockOws) return (await loadOws()).createWallet(name);

  if (await getWalletProxy(name)) throw new Error(`Wallet already exists: ${name}`);
  const wallet = { ...mockWallet, id: `mock-${name}`, name };
  mockCreatedWallets.set(name, wallet);
  return wallet;
}
