import {
  createWallet,
  deleteWallet,
  getWallet,
  importWalletMnemonic,
  importWalletPrivateKey,
  listWallets,
  renameWallet,
  signAndSend,
  signMessage,
  signTransaction,
  type WalletInfo,
  type SignResult,
  type SendResult,
} from '@open-wallet-standard/core';

const useMockOws = process.env.XNO_MCP_MOCK_OWS === 'true';

type WalletLike = WalletInfo | {
  id?: string;
  name: string;
  createdAt: string;
  accounts: Array<{ address: string; chainId: string; derivationPath: string }>;
};

const mockWallet: WalletLike = {
  id: 'mock-wallet-a',
  name: 'A',
  createdAt: new Date().toISOString(),
  accounts: [{
    address: 'nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7',
    chainId: 'nano',
    derivationPath: "m/44'/165'/0'/0/0",
  }],
};

export const listWalletsProxy = useMockOws
  ? async (): Promise<WalletLike[]> => [mockWallet]
  : async () => listWallets();

export const getWalletProxy = useMockOws
  ? async (name: string): Promise<WalletLike | null> => (name === 'A' ? mockWallet : null)
  : async (name: string) => getWallet(name);

export const signTransactionProxy = useMockOws
  ? async (_wallet: string, _chain: string, _tx: string, _passphrase?: string, _index?: number): Promise<SignResult> => ({ signature: '0'.repeat(128) })
  : async (wallet: string, chain: string, tx: string, passphrase?: string, index?: number) => signTransaction(wallet, chain, tx, passphrase, index);

export const signMessageProxy = useMockOws
  ? async (_wallet: string, _chain: string, _msg: string, _passphrase?: string, _encoding?: string, _index?: number): Promise<SignResult> => ({ signature: '0'.repeat(128) })
  : async (wallet: string, chain: string, msg: string, passphrase?: string, encoding?: string, index?: number) => signMessage(wallet, chain, msg, passphrase, encoding, index);

export const signAndSendProxy = useMockOws
  ? async (_wallet: string, _chain: string, _tx: string, _passphrase?: string, _index?: number, _rpcUrl?: string): Promise<SendResult> => ({ txHash: '0'.repeat(64) })
  : async (wallet: string, chain: string, tx: string, passphrase?: string, index?: number, rpcUrl?: string) => signAndSend(wallet, chain, tx, passphrase, index, rpcUrl);

export const createWalletProxy = async (name: string) => createWallet(name);
export const importWalletMnemonicProxy = async (name: string, mnemonic: string) => importWalletMnemonic(name, mnemonic);
export const importWalletPrivateKeyProxy = async (name: string, privateKeyHex: string) => importWalletPrivateKey(name, privateKeyHex);
export const renameWalletProxy = async (name: string, newName: string) => renameWallet(name, newName);
export const deleteWalletProxy = async (name: string) => deleteWallet(name);

export type OwsWalletLike = WalletLike;
