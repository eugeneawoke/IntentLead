export interface WorkerSignedRequest {
  method: string;
  path: string;
  body: string | Buffer;
  timestamp: string;
  nonce: string;
}

export type ConsumeWorkerNonce = (nonce: string, timestamp: number) => Promise<boolean>;
