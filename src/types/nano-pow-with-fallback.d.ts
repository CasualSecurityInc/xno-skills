declare module 'nano-pow-with-fallback' {
  export const THRESHOLD__OPEN_RECEIVE: string;
  export const THRESHOLD__SEND_CHANGE: string;
  
  export interface ProofOfWorkOptions {
    hash: string;
    threshold: string;
    workers?: number;
  }
  
  export function getProofOfWork(options: ProofOfWorkOptions): Promise<string>;
  
  export enum PowBackendName {
    WEBGPU = 'webgpu',
    WEBGL = 'webgl',
    WASM = 'wasm'
  }
  
  export interface PowServiceOptions {
    disabledBackends?: PowBackendName[];
  }
  
  export class PowService {
    constructor(options?: PowServiceOptions);
    readonly ready: Promise<void>;
    readonly backend: PowBackendName;
    getProofOfWork(options: ProofOfWorkOptions): Promise<{ backend: PowBackendName; proofOfWork: string }>;
    cancel(): void;
  }
}