import { spawn } from 'node:child_process';

export interface GrabFrameOptions {
  rtspUrl: string;
  outPath: string;
  timeoutMs: number;
}

export interface GrabFrameResult {
  outPath: string;
  durationMs: number;
}

/**
 * Grab a single frame from an RTSP stream using ffmpeg.
 * Uses `spawn` (no shell) to avoid injection and buffer limits.
 * Kills the process with SIGKILL on timeout.
 */
export function grabFrame(opts: GrabFrameOptions): Promise<GrabFrameResult> {
  const { rtspUrl, outPath, timeoutMs } = opts;

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const args = [
      '-rtsp_transport',
      'tcp',
      '-i',
      rtspUrl,
      '-frames:v',
      '1',
      '-y',
      outPath,
    ];

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const stderrChunks: Buffer[] = [];

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(
          new Error('ffmpeg not found — install it and ensure it is on PATH')
        );
      } else {
        reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
      }
    });

    proc.on('close', code => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;

      if (code === 0) {
        resolve({ outPath, durationMs });
      } else {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8');
        const lastLines = stderr.trim().split('\n').slice(-3).join('\n');
        reject(new Error(`ffmpeg exited with code ${code}\n${lastLines}`));
      }
    });
  });
}
