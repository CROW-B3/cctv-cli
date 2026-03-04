import type { Quality } from './types';

import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export interface SpoolConfig {
  spoolDir: string;
  storeId: string;
  cameraId: string;
}

const SAFE_ID = /^[\w.:-]+$/;

function validateId(name: string, value: string): void {
  if (!SAFE_ID.test(value)) {
    throw new Error(
      `Invalid ${name}: "${value}" — must match ${SAFE_ID} (no slashes, no ..)`
    );
  }
}

/** Build the deterministic spool file path for a frame. */
export function spoolPath(
  config: SpoolConfig,
  bucketSec: number,
  quality: Quality
): string {
  validateId('storeId', config.storeId);
  validateId('cameraId', config.cameraId);
  return path.join(
    config.spoolDir,
    config.storeId,
    config.cameraId,
    `${bucketSec}_${quality}.jpg`
  );
}

/** Ensure the spool directory tree exists (called once at startup). */
export async function ensureSpoolDir(config: SpoolConfig): Promise<void> {
  validateId('storeId', config.storeId);
  validateId('cameraId', config.cameraId);
  const dir = path.join(config.spoolDir, config.storeId, config.cameraId);
  await mkdir(dir, { recursive: true });
}
