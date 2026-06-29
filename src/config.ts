import { loadConfig, type XnoConfig } from './state-store.js';

const DEFAULT_RPC_URLS = [
  'https://rainstorm.city/api',
  'https://nanoslo.0x.no/proxy',
  'https://rpc.nano.to',
];

/**
 * Resolve the effective remote PoW work URL list from highest to lowest priority:
 * 1. NANO_WORK_URL env var (split by comma)
 * 2. saved config workUrl (split by comma)
 * 3. NANO_RPC_URL env var (split by comma)
 * 4. saved config rpcUrl (split by comma)
 * 5. DEFAULT_RPC_URLS
 */
export function resolveEffectiveWorkUrls(config: XnoConfig): string[] {
  const workUrl = process.env.NANO_WORK_URL || config.workUrl;
  if (workUrl) return workUrl.split(',').filter(Boolean);
  const rpcUrl = process.env.NANO_RPC_URL || config.rpcUrl;
  if (rpcUrl) return rpcUrl.split(',').filter(Boolean);
  return DEFAULT_RPC_URLS;
}

/**
 * Resolve effective RPC URL list from highest to lowest priority:
 * 1. explicit URL(s) passed as argument
 * 2. NANO_RPC_URL env var (split by comma)
 * 3. saved config rpcUrl (split by comma)
 * 4. DEFAULT_RPC_URLS
 */
export function resolveEffectiveRpcUrls(explicitRpc?: string, config?: XnoConfig): string[] {
  if (explicitRpc) return explicitRpc.split(',').filter(Boolean);
  const fromConfig = process.env.NANO_RPC_URL || config?.rpcUrl;
  if (fromConfig) return fromConfig.split(',').filter(Boolean);
  return DEFAULT_RPC_URLS;
}

export { DEFAULT_RPC_URLS };
