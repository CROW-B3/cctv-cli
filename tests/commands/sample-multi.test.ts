import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { aggregateStats } from '../../src/commands/sample';
import { startSampler } from '../../src/lib/sampler';

vi.mock('../../src/lib/ffmpeg', () => ({
  grabFrame: vi.fn().mockResolvedValue({ outPath: 'mock.jpg', durationMs: 50 }),
}));

vi.mock('../../src/lib/spool', () => ({
  ensureSpoolDir: vi.fn().mockResolvedValue(undefined),
  spoolPath: vi.fn(
    (_config: unknown, bucket: number, quality: string) =>
      `spool/s/c/${bucket}_${quality}.jpg`
  ),
}));

vi.mock('../../src/lib/uploader', () => ({
  uploadFrame: vi.fn().mockResolvedValue({ ok: true }),
}));

const { grabFrame: mockGrabFrame } = await import('../../src/lib/ffmpeg');
const mockGrab = mockGrabFrame as unknown as ReturnType<typeof vi.fn>;

describe('multi-camera sampling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_704_067_200_000 });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs two cameras concurrently', async () => {
    const handle1 = startSampler({
      spoolDir: 'spool',
      storeId: 'store1',
      cameraId: 'cam_01',
      rtspUrl: 'rtsp://10.0.0.1/stream',
      fps: 1,
      timeoutMs: 5000,
    });

    const handle2 = startSampler({
      spoolDir: 'spool',
      storeId: 'store1',
      cameraId: 'cam_02',
      rtspUrl: 'rtsp://10.0.0.2/stream',
      fps: 1,
      timeoutMs: 5000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    handle1.stop();
    handle2.stop();
    await vi.advanceTimersByTimeAsync(1000);

    const [stats1, stats2] = await Promise.all([handle1.done, handle2.done]);

    expect(stats1.grabbed).toBeGreaterThanOrEqual(2);
    expect(stats2.grabbed).toBeGreaterThanOrEqual(2);

    // Both RTSP URLs should have been called via grabBestFrame
    const urls = mockGrab.mock.calls.map(
      (c: [{ rtspUrl: string }]) => c[0].rtspUrl
    );
    expect(urls).toContain('rtsp://10.0.0.1/stream');
    expect(urls).toContain('rtsp://10.0.0.2/stream');
  });

  it('one camera error does not stop the other', async () => {
    // First call fails (cam1 tick 1), rest succeed
    mockGrab.mockRejectedValueOnce(new Error('cam1 connection refused'));

    const handle1 = startSampler({
      spoolDir: 'spool',
      storeId: 'store1',
      cameraId: 'cam_01',
      rtspUrl: 'rtsp://10.0.0.1/stream',
      fps: 1,
      timeoutMs: 5000,
    });

    const handle2 = startSampler({
      spoolDir: 'spool',
      storeId: 'store1',
      cameraId: 'cam_02',
      rtspUrl: 'rtsp://10.0.0.2/stream',
      fps: 1,
      timeoutMs: 5000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    handle1.stop();
    handle2.stop();
    await vi.advanceTimersByTimeAsync(1000);

    const [stats1, stats2] = await Promise.all([handle1.done, handle2.done]);

    expect(stats1.errors).toBe(1);
    expect(stats1.grabbed).toBeGreaterThanOrEqual(1);
    expect(stats2.errors).toBe(0);
    expect(stats2.grabbed).toBeGreaterThanOrEqual(2);
  });
});

describe('aggregateStats', () => {
  it('aggregates stats from multiple cameras correctly', () => {
    const agg = aggregateStats([
      {
        grabbed: 10,
        errors: 1,
        uploaded: 9,
        uploadErrors: 0,
        hqGrabbed: 0,
        motionEvents: 0,
        startedAt: 1000,
      },
      {
        grabbed: 8,
        errors: 2,
        uploaded: 7,
        uploadErrors: 1,
        hqGrabbed: 0,
        motionEvents: 0,
        startedAt: 1100,
      },
    ]);

    expect(agg.grabbed).toBe(18);
    expect(agg.errors).toBe(3);
    expect(agg.uploaded).toBe(16);
    expect(agg.uploadErrors).toBe(1);
    expect(agg.startedAt).toBe(1000); // earliest
  });

  it('handles single camera stats', () => {
    const agg = aggregateStats([
      {
        grabbed: 5,
        errors: 0,
        uploaded: 5,
        uploadErrors: 0,
        hqGrabbed: 0,
        motionEvents: 0,
        startedAt: 500,
      },
    ]);

    expect(agg.grabbed).toBe(5);
    expect(agg.startedAt).toBe(500);
  });

  it('handles empty stats list', () => {
    const agg = aggregateStats([]);
    expect(agg.grabbed).toBe(0);
    expect(agg.errors).toBe(0);
    expect(agg.hqGrabbed).toBe(0);
    expect(agg.motionEvents).toBe(0);
    expect(agg.startedAt).toBeLessThanOrEqual(Date.now());
  });

  it('aggregates hqGrabbed and motionEvents', () => {
    const agg = aggregateStats([
      {
        grabbed: 10,
        errors: 0,
        uploaded: 10,
        uploadErrors: 0,
        hqGrabbed: 5,
        motionEvents: 8,
        startedAt: 1000,
      },
      {
        grabbed: 10,
        errors: 0,
        uploaded: 10,
        uploadErrors: 0,
        hqGrabbed: 3,
        motionEvents: 4,
        startedAt: 1000,
      },
    ]);

    expect(agg.hqGrabbed).toBe(8);
    expect(agg.motionEvents).toBe(12);
  });
});
