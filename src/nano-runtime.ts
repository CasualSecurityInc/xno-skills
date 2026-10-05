import { createNodePowEngine, NanoClient, WorkProvider, recommendLocalPow } from '@openrai/nano-core/node';
import type { NanoClient as CoreNanoClient } from '@openrai/nano-core';
import { getEffectiveLocalPowRecommended } from './meta.js';
import { DEFAULT_RPC_URLS, redactUrlForLog, resolveEffectiveRpcUrls, resolveEffectiveWorkUrls } from './config.js';
import { DEFAULT_TIMEOUT_MS, type NanoReaders } from './nano-actions.js';
import { nanoRpcCall, rpcAccountBalance, rpcAccountHistory, rpcAccountInfo, rpcProcess, rpcReceivable } from './rpc.js';
import { normalizeRemoteWorkDifficulty } from './work-threshold.js';
import type { XnoConfig } from './state-store.js';

export type NanoRuntimeOptions = {
  getConfig: () => XnoConfig;
  logScope: string;
  cacheDefaultClient?: boolean;
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function effectivePowTimeoutMs(config: XnoConfig): number {
  return config.powTimeoutMs ?? (config.timeoutMs ? config.timeoutMs * 4 : 60_000);
}

/** Shared RPC readers and PoW policy for the short-lived CLI and long-lived MCP server. */
export function createNanoRuntime(options: NanoRuntimeOptions): {
  getNanoClient: (explicitRpc?: string) => CoreNanoClient;
  readersFor: (explicitRpc?: string) => NanoReaders;
} {
  let cachedClient: CoreNanoClient | undefined;
  let cachedConfigKey: string | undefined;
  let localPowRecommendationLogged = false;

  function log(message: string): void {
    process.stderr.write(`[${options.logScope}] ${message}\n`);
  }

  function getNanoClient(explicitRpc?: string): CoreNanoClient {
    const config = options.getConfig();
    const configKey = JSON.stringify([config.rpcUrl, config.workUrl, config.timeoutMs, config.powTimeoutMs]);
    if (!explicitRpc && options.cacheDefaultClient && cachedClient && cachedConfigKey === configKey)
      return cachedClient;

    const rpcUrls = explicitRpc ? explicitRpc.split(',').filter(Boolean) : resolveEffectiveRpcUrls(undefined, config);
    const rpcTimeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
    const powTimeoutMs = effectivePowTimeoutMs(config);
    log(
      `NanoClient init rpc=[${rpcUrls.map(redactUrlForLog).join(',') || '(defaults)'}] rpcTimeoutMs=${rpcTimeoutMs} powTimeoutMs=${powTimeoutMs}`,
    );
    const client = NanoClient.initialize({
      rpc: rpcUrls.length > 0 ? rpcUrls : DEFAULT_RPC_URLS,
      workProvider: WorkProvider.local({ localEngine: createNodePowEngine(), localTimeoutMs: powTimeoutMs }),
    });
    if (!explicitRpc && options.cacheDefaultClient) {
      cachedClient = client;
      cachedConfigKey = configKey;
    }
    return client;
  }

  function readersFor(explicitRpc?: string): NanoReaders {
    const config = options.getConfig();
    const client = getNanoClient(explicitRpc);
    const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
    return {
      accountInfo: (address) => rpcAccountInfo(client, address, { timeoutMs }),
      accountBalance: (address) => rpcAccountBalance(client, address, { timeoutMs }),
      receivable: (address, count) => rpcReceivable(client, address, count, { timeoutMs }),
      accountHistory: (address, count) => rpcAccountHistory(client, address, count, { timeoutMs }),
      workGenerate: async (hash, difficulty) => {
        // Boundary normalization only, on the symmetry you allowed: the remote branch
        // needs canonical hex, and the local route reaches the engine through
        // WorkProvider, which converts symbolic values itself (workDifficultyToThreshold).
        // Keeping one spelling here means the log line and the call we pass on agree.
        const threshold = normalizeRemoteWorkDifficulty(difficulty);
        let preferLocal = true;
        try {
          preferLocal = getEffectiveLocalPowRecommended(recommendLocalPow);
        } catch {
          /* advisory only */
        }
        const workUrls = !preferLocal ? resolveEffectiveWorkUrls(config) : [];
        if (!localPowRecommendationLogged && preferLocal) {
          localPowRecommendationLogged = true;
          log('(cached) Local PoW recommended');
        }
        const startedAt = Date.now();
        if (workUrls.length > 0) {
          log(
            `pow.generate start hash=${hash.slice(0, 12)} difficulty=${threshold} remote=${workUrls.map(redactUrlForLog).join(',')}`,
          );
          try {
            const res = await nanoRpcCall<{ work: string }>(
              getNanoClient(workUrls.join(',')),
              { action: 'work_generate', hash, difficulty: threshold },
              { timeoutMs: effectivePowTimeoutMs(config) },
            );
            log(`pow.generate ok remote elapsedMs=${Date.now() - startedAt}`);
            return res.work;
          } catch (error) {
            log(
              `pow.generate remote fail elapsedMs=${Date.now() - startedAt} error=${describeError(error)}, falling back to local`,
            );
          }
        }
        log(`pow.generate start hash=${hash.slice(0, 12)} difficulty=${threshold} local=true`);
        try {
          const work = await client.workProvider.generate(hash, threshold);
          log(`pow.generate ok elapsedMs=${Date.now() - startedAt}`);
          return work;
        } catch (error) {
          log(`pow.generate fail elapsedMs=${Date.now() - startedAt} error=${describeError(error)}`);
          throw error;
        }
      },
      process: async (block, subtype) => {
        const startedAt = Date.now();
        log(`rpc.process start subtype=${subtype}`);
        try {
          const result = await rpcProcess(client, block, subtype, { timeoutMs });
          log(`rpc.process ok subtype=${subtype} elapsedMs=${Date.now() - startedAt} hash=${result.hash}`);
          return result;
        } catch (error) {
          log(`rpc.process fail subtype=${subtype} elapsedMs=${Date.now() - startedAt} error=${describeError(error)}`);
          throw error;
        }
      },
    };
  }

  return { getNanoClient, readersFor };
}
