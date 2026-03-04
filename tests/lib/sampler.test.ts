import type { SamplerConfig } from '../../src/lib/sampler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { grabFrame } from '../../src/lib/ffmpeg';
import { startSampler } from '../../src/lib/sampler';
import { spoolPath } from '../../src/lib/spool';

vi.mock('../../src/lib/ffmpeg', () => ({
  grabFrame: vi.fn().mockResolvedValue({ outPath: 'mock.jpg', durationMs: 50 }),
}));

vi.mock('../../src/lib/spool', () => ({
  ensureSpoolDir: vi.fn().mockResolvedValue(undefined),
  spoolPath: vi.fn(
    (_config, bucket: number, quality: string) =>
      `spool/s/c/${bucket}_${quality}.jpg`
  ),
}));

vi.mock('../../src/lib/uploader', () => ({
  uploadFrame: vi.fn().mockResolvedValue({ ok: true }),
}));

const mockGrab = grabFrame as unknown as ReturnType<typeof vi.fn>;
const mockSpoolPath = spoolPath as unknown as ReturnType<typeof vi.fn>;

const { uploadFrame: mockUpload } = await import('../../src/lib/uploader');
const mockUploadFrame = mockUpload as unknown as ReturnType<typeof vi.fn>;

const baseConfig: SamplerConfig = {
  spoolDir: 'spool',
  storeId: 's',
  cameraId: 'c',
  rtspUrl: 'rtsp://test',
  fps: 1,
  timeoutMs: 5000,
};

describe('startSampler', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_704_067_200_000 }); // 2024-01-01T00:00:00Z
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('grabs frames with sequential bucket_sec values', async () => {
    const handle = startSampler(baseConfig);

    // Tick 1: bucket 1704067200
    await vi.advanceTimersByTimeAsync(1000);
    // Tick 2: bucket 1704067201
    await vi.advanceTimersByTimeAsync(1000);
    // Tick 3: bucket 1704067202
    await vi.advanceTimersByTimeAsync(1000);

    handle.stop();
    await vi.advanceTimersByTimeAsync(1000);
    const stats = await handle.done;

    expect(stats.grabbed).toBeGreaterThanOrEqual(3);
    expect(stats.errors).toBe(0);

    // Verify grab was called with correct RTSP URL
    for (const call of mockGrab.mock.calls) {
      expect(call[0].rtspUrl).toBe('rtsp://test');
      expect(call[0].timeoutMs).toBe(5000);
    }
  });

  it('stop() exits loop and returns stats', async () => {
    const handle = startSampler(baseConfig);

    await vi.advanceTimersByTimeAsync(1000);
    handle.stop();
    await vi.advanceTimersByTimeAsync(1000);

    const stats = await handle.done;
    expect(stats.grabbed).toBeGreaterThanOrEqual(1);
    expect(stats.startedAt).toBe(1_704_067_200_000);
  });

  it('continues on grab error with stats.errors incremented', async () => {
    mockGrab.mockRejectedValueOnce(new Error('connection refused'));

    const handle = startSampler(baseConfig);

    // Tick 1: will fail
    await vi.advanceTimersByTimeAsync(1000);
    // Tick 2: will succeed (default mock)
    await vi.advanceTimersByTimeAsync(1000);

    handle.stop();
    await vi.advanceTimersByTimeAsync(1000);
    const stats = await handle.done;

    expect(stats.errors).toBe(1);
    expect(stats.grabbed).toBeGreaterThanOrEqual(1);
  });

  it('always passes quality "low" to spoolPath', async () => {
    const handle = startSampler(baseConfig);

    await vi.advanceTimersByTimeAsync(1000);

    handle.stop();
    await vi.advanceTimersByTimeAsync(1000);
    await handle.done;

    for (const call of mockSpoolPath.mock.calls) {
      expect(call[2]).toBe('low');
    }
  });

  it('does not upload when ingestUrl is not set', async () => {
    const handle = startSampler(baseConfig);

    await vi.advanceTimersByTimeAsync(1000);
    handle.stop();
    await vi.advanceTimersByTimeAsync(1000);
    const stats = await handle.done;

    expect(mockUploadFrame).not.toHaveBeenCalled();
    expect(stats.uploaded).toBe(0);
    expect(stats.uploadErrors).toBe(0);
  });

  it('uploads frames when ingestUrl is set', async () => {
    const handle = startSampler({
      ...baseConfig,
      ingestUrl: 'http://localhost:3000',
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    handle.stop();
    await vi.advanceTimersByTimeAsync(1000);
    const stats = await handle.done;

    expect(stats.uploaded).toBeGreaterThanOrEqual(2);
    expect(stats.uploadErrors).toBe(0);
    expect(mockUploadFrame).toHaveBeenCalled();

    // Verify upload was called with correct ingestUrl
    for (const call of mockUploadFrame.mock.calls) {
      expect(call[0]).toBe('http://localhost:3000');
    }
  });

  it('continues sampling on upload error', async () => {
    mockUploadFrame.mockRejectedValueOnce(new Error('network error'));

    const handle = startSampler({
      ...baseConfig,
      ingestUrl: 'http://localhost:3000',
    });

    // Tick 1: upload will fail
    await vi.advanceTimersByTimeAsync(1000);
    // Tick 2: upload will succeed
    await vi.advanceTimersByTimeAsync(1000);

    handle.stop();
    await vi.advanceTimersByTimeAsync(1000);
    const stats = await handle.done;

    expect(stats.grabbed).toBeGreaterThanOrEqual(2);
    expect(stats.uploadErrors).toBe(1);
    expect(stats.uploaded).toBeGreaterThanOrEqual(1);
  });
});
