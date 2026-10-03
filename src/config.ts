import { nanoToRaw } from './convert.js';
import { loadConfig, type XnoConfig } from './state-store.js';

const DEFAULT_RPC_URLS = ['https://rainstorm.city/api', 'https://nanoslo.0x.no/proxy', 'https://rpc.nano.to'];

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

export const DEFAULT_MAX_SEND_XNO = '1.0';

function maxSendRaw(value: string, source: string): bigint {
  const raw = BigInt(nanoToRaw(value));
  if (raw < 0n) throw new Error(`${source} must not be negative.`);
  return raw;
}

/**
 * Resolve the effective per-transaction send ceiling.
 *
 * XNO_MAX_SEND is an owner-controlled hard ceiling when present. Saved config
 * may tighten that ceiling, but cannot override it upward.
 */
export function resolveEffectiveMaxSendXno(config: XnoConfig): string {
  const saved = config.maxSendXno?.trim();
  const env = process.env.XNO_MAX_SEND?.trim();

  if (!saved) return env || DEFAULT_MAX_SEND_XNO;
  if (!env) return saved;

  return maxSendRaw(saved, 'maxSendXno') <= maxSendRaw(env, 'XNO_MAX_SEND') ? saved : env;
}

/**
 * MCP config_set is agent-accessible, so maxSendXno is monotonic there:
 * agents may tighten the current effective ceiling but cannot loosen it.
 * Raising the limit remains an explicit owner action via the config file/env.
 */
export function assertNonIncreasingMaxSendXnoUpdate(
  config: XnoConfig,
  requested: string | null | undefined,
): void {
  if (requested === undefined) return;

  const current = resolveEffectiveMaxSendXno(config);
  const currentRaw = maxSendRaw(current, 'current maxSendXno');

  if (requested === null || requested.trim() === '') {
    const candidate = { ...config };
    delete candidate.maxSendXno;
    const resetEffective = resolveEffectiveMaxSendXno(candidate);
    if (maxSendRaw(resetEffective, 'reset maxSendXno') > currentRaw) {
      throw new Error(
        `maxSendXno can only be tightened via config_set (current effective limit: ${current} XNO). ` +
          'Raise or reset the limit out of band in the owner-controlled config/environment.',
      );
    }
    return;
  }

  const next = requested.trim();
  if (maxSendRaw(next, 'maxSendXno') > currentRaw) {
    throw new Error(
      `maxSendXno can only be tightened via config_set (current effective limit: ${current} XNO). ` +
        'Raise the limit out of band in the owner-controlled config/environment.',
    );
  }
}

/** Format an endpoint for diagnostics without exposing credentials or query values. */
export function redactUrlForLog(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}${url.search ? '?…' : ''}`;
  } catch {
    return '(invalid URL)';
  }
}

export { DEFAULT_RPC_URLS };
