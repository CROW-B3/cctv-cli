import type { FrameMeta } from './types';

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const UPLOAD_TIMEOUT_MS = 10_000;

export interface UploadResult {
  ok: boolean;
}

/**
 * Upload a frame to the ingest service.
 * Reads the file from the spool path, builds multipart FormData, and POSTs.
 * Auth token read from CCTV_AUTH_TOKEN env var (falls back to "devtoken" in dev).
 */
export async function uploadFrame(
  ingestUrl: string,
  meta: FrameMeta,
  filePath: string
): Promise<UploadResult> {
  const authToken = process.env.CCTV_AUTH_TOKEN ?? 'devtoken';
  const fileBytes = await readFile(filePath);

  const formData = new FormData();
  formData.append(
    'meta',
    new Blob([JSON.stringify(meta)], { type: 'application/json' })
  );
  formData.append(
    'file',
    new File([fileBytes], 'frame.jpg', { type: 'image/jpeg' })
  );

  const res = await fetch(`${ingestUrl}/frame`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: formData,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = (body as Record<string, unknown>).error ?? res.statusText;
    throw new Error(`Upload failed (${res.status}): ${error}`);
  }

  return { ok: true };
}
