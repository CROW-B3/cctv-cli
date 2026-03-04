// ffmpeg subprocess utility — implemented in commit 3
export interface GrabFrameOptions {
  rtspUrl: string;
  outPath: string;
  timeoutMs: number;
}

export async function grabFrame(_opts: GrabFrameOptions): Promise<void> {
  throw new Error('Not implemented yet');
}
