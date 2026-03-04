import type { SpoolConfig } from './spool';

import { grabFrame } from './ffmpeg';
import { ensureSpoolDir, spoolPath } from './spool';
import { bucketSec } from './types';
import { uploadFrame } from './uploader';

export interface SamplerConfig extends SpoolConfig {
  rtspUrl: string;
  fps: number;
  timeoutMs: number;
  ingestUrl?: string;
}

export interface SamplerStats {
  grabbed: number;
  errors: number;
  uploaded: number;
  uploadErrors: number;
  startedAt: number;
}

export interface SamplerHandle {
  done: Promise<SamplerStats>;
  stop: () => void;
}

/**
 * Start a drift-free sampling loop that grabs RTSP frames at the configured FPS.
 * Frames are written to the local spool with deterministic bucket_sec filenames.
 */
export function startSampler(config: SamplerConfig): SamplerHandle {
  let running = true;
  const stop = () => {
    running = false;
  };

  const done = runLoop(config, () => running);
  return { done, stop };
}

async function runLoop(
  config: SamplerConfig,
  isRunning: () => boolean
): Promise<SamplerStats> {
  await ensureSpoolDir(config);

  const intervalMs = 1000 / config.fps;
  const anchor = Date.now();
  let tickIndex = 0;
  const stats: SamplerStats = {
    grabbed: 0,
    errors: 0,
    uploaded: 0,
    uploadErrors: 0,
    startedAt: anchor,
  };

  while (isRunning()) {
    tickIndex++;
    const nextTickMs = anchor + tickIndex * intervalMs;
    const bucket = bucketSec();
    const outPath = spoolPath(config, bucket, 'low');

    try {
      await grabFrame({
        rtspUrl: config.rtspUrl,
        outPath,
        timeoutMs: config.timeoutMs,
      });
      stats.grabbed++;

      if (config.ingestUrl) {
        try {
          await uploadFrame(
            config.ingestUrl,
            {
              store_id: config.storeId,
              camera_id: config.cameraId,
              bucket_sec: bucket,
              quality: 'low',
              content_type: 'image/jpeg',
            },
            outPath
          );
          stats.uploaded++;
        } catch (uploadErr) {
          stats.uploadErrors++;
          const msg =
            uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          console.warn(`[sampler] upload failed (bucket=${bucket}): ${msg}`);
        }
      }
    } catch (err) {
      stats.errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[sampler] grab failed (bucket=${bucket}): ${msg}`);
    }

    if (!isRunning()) break;

    const delayMs = nextTickMs - Date.now();
    if (delayMs > 0) {
      await sleep(delayMs);
    } else {
      // Overrun — skip forward to next aligned tick
      tickIndex = Math.ceil((Date.now() - anchor) / intervalMs);
    }
  }

  return stats;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
