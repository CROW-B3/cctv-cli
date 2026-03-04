import type { FrameMeta } from './types';

import { readFile } from 'node:fs/promises';

const AUTH_TOKEN = 'devtoken';

export interface UploadResult {
  ok: boolean;
}

/**
 * Upload a frame to the ingest service.
 * Reads the file from the spool path, builds multipart FormData, and POSTs.
 */
export async function uploadFrame(
  ingestUrl: string,
  meta: FrameMeta,
  filePath: string
): Promise<UploadResult> {
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
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = (body as Record<string, unknown>).error ?? res.statusText;
    throw new Error(`Upload failed (${res.status}): ${error}`);
  }

  return { ok: true };
}
