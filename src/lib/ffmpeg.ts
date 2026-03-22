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

export interface ExtractFramesOptions {
  videoPath: string;
  outputDir: string;
  fps: number;
  timeoutMs: number;
}

export interface ExtractFramesResult {
  framePaths: string[];
  durationMs: number;
}

/**
 * Extract frames from a local video file using a single ffmpeg invocation.
 * Much faster than per-frame grabs — processes the entire video at once.
 */
export function extractFramesFromVideo(
  opts: ExtractFramesOptions
): Promise<ExtractFramesResult> {
  const { videoPath, outputDir, fps, timeoutMs } = opts;

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const outputPattern = `${outputDir}/frame_%06d.jpg`;
    const args = [
      '-i',
      videoPath,
      '-vf',
      `fps=${fps}`,
      '-q:v',
      '2',
      '-y',
      outputPattern,
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

    let settled = false;
    proc.on('close', async code => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      const durationMs = Date.now() - start;

      if (code === 0) {
        try {
          const { readdir } = await import('node:fs/promises');
          const files = await readdir(outputDir);
          const framePaths = files
            .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'))
            .sort()
            .map(f => `${outputDir}/${f}`);
          resolve({ framePaths, durationMs });
        } catch (err) {
          reject(new Error(`Failed to read output directory: ${err}`));
        }
      } else {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8');
        const lastLines = stderr.trim().split('\n').slice(-3).join('\n');
        reject(new Error(`ffmpeg exited with code ${code}\n${lastLines}`));
      }
    });
  });
}
