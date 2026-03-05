import type { FrameMeta } from '../../src/lib/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadFrame } from '../../src/lib/uploader';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
}));

const meta: FrameMeta = {
  store_id: 'store1',
  camera_id: 'cam1',
  bucket_sec: 1704067200,
  quality: 'low',
  content_type: 'image/jpeg',
};

describe('uploadFrame', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST with correct URL, auth header, and FormData', async () => {
    const result = await uploadFrame(
      'http://localhost:3000',
      meta,
      '/tmp/frame.jpg'
    );
    expect(result).toEqual({ ok: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://localhost:3000/frame');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toEqual({
      Authorization: 'Bearer devtoken',
    });

    const body = (init as RequestInit).body as FormData;
    expect(body.get('meta')).toBeTruthy();
    expect(body.get('file')).toBeTruthy();
  });

  it('includes correct meta JSON in FormData', async () => {
    await uploadFrame('http://localhost:3000', meta, '/tmp/frame.jpg');

    const body = fetchSpy.mock.calls[0][1]!.body as FormData;
    const metaBlob = body.get('meta') as Blob;
    const metaText = await metaBlob.text();
    const parsed = JSON.parse(metaText);

    expect(parsed.store_id).toBe('store1');
    expect(parsed.camera_id).toBe('cam1');
    expect(parsed.bucket_sec).toBe(1704067200);
    expect(parsed.quality).toBe('low');
  });

  it('throws on non-ok response', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
      })
    );

    await expect(
      uploadFrame('http://localhost:3000', meta, '/tmp/frame.jpg')
    ).rejects.toThrow('Upload failed (401): Unauthorized');
  });

  it('throws on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(
      uploadFrame('http://localhost:3000', meta, '/tmp/frame.jpg')
    ).rejects.toThrow('fetch failed');
  });
});
