import { loadConfig, type XnoConfig } from './state-store.js';

const DEFAULT_RPC_URLS = [
  'https://rainstorm.city/api',
  'https://nanoslo.0x.no/proxy',
];

/**
 * Resolve the effective remote PoW work URL from highest to lowest priority:
 * 1. NANO_WORK_URL env var
 * 2. saved config workUrl
 * 3. NANO_RPC_URL env var
 * 4. saved config rpcUrl
 * 5. DEFAULT_RPC_URLS[0]
 */
export function resolveEffectiveWorkUrl(config: XnoConfig): string {
  return process.env.NANO_WORK_URL
    || config.workUrl
    || process.env.NANO_RPC_URL
    || config.rpcUrl
    || DEFAULT_RPC_URLS[0];
}

/**
 * Resolve effective RPC URL list from highest to lowest priority:
 * 1. explicit URL(s) passed as argument
 * 2. saved config rpcUrl
 * 3. NANO_RPC_URL env var
 * 4. DEFAULT_RPC_URLS
 */
export function resolveEffectiveRpcUrls(explicitRpc?: string, config?: XnoConfig): string[] {
  if (explicitRpc) return explicitRpc.split(',').filter(Boolean);
  const fromConfig = config?.rpcUrl || process.env.NANO_RPC_URL;
  if (fromConfig) return fromConfig.split(',').filter(Boolean);
  return DEFAULT_RPC_URLS;
}

export { DEFAULT_RPC_URLS };
