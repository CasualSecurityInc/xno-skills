import { describe, expect, it } from 'vitest';
import { formatSystemInfo, type SystemInfo } from '../src/meta.js';

function baseInfo(overrides: Partial<SystemInfo> = {}): SystemInfo {
  return {
    xnoSkills: { version: '0.0.0-test', path: '/tmp/xno-skills', invocation: 'source' },
    ows: null,
    environment: {
      mockOws: true,
      nanoRpcUrl: undefined,
      nanoWorkUrl: undefined,
      xnoMcpHome: undefined,
      xnoLocalPowRecommended: undefined,
    },
    envVars: [],
    localPowRecommended: true,
    effectiveRpcUrls: ['https://rpc.example/api'],
    effectiveWorkUrls: ['https://work.example/api'],
    ...overrides,
  };
}

describe('formatSystemInfo diagnostics output', () => {
  it('does not include remote probe output', () => {
    const output = formatSystemInfo(baseInfo());

    expect(output).not.toContain('remote work probe:');
    expect(output).not.toContain('work_generate:');
  });

  it('prints no advisory when local PoW is recommended', () => {
    const output = formatSystemInfo(baseInfo({
      localPowRecommended: true,
    }));

    expect(output).not.toContain('Advisory:');
  });

  it('prints a probe-caps advisory when remote PoW should be verified', () => {
    const output = formatSystemInfo(baseInfo({
      localPowRecommended: false,
      advisory: 'Run `xno-skills rpc probe-caps https://work.example/api` to verify remote PoW support.',
    }));

    expect(output).toContain('Advisory: Run `xno-skills rpc probe-caps https://work.example/api` to verify remote PoW support.');
  });
});
