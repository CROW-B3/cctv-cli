import type { Quality } from './types';

import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export interface SpoolConfig {
  spoolDir: string;
  storeId: string;
  cameraId: string;
}

/** Build the deterministic spool file path for a frame. */
export function spoolPath(
  config: SpoolConfig,
  bucketSec: number,
  quality: Quality
): string {
  return path.join(
    config.spoolDir,
    config.storeId,
    config.cameraId,
    `${bucketSec}_${quality}.jpg`
  );
}

/** Ensure the spool directory tree exists (called once at startup). */
export async function ensureSpoolDir(config: SpoolConfig): Promise<void> {
  const dir = path.join(config.spoolDir, config.storeId, config.cameraId);
  await mkdir(dir, { recursive: true });
}
