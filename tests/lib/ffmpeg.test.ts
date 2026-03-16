import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';
import { grabFrame } from '../../src/lib/ffmpeg';

// Mock child_process.spawn before importing grabFrame
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;

function createMockProc(): ChildProcess {
  const proc = new EventEmitter() as ChildProcess;
  proc.stderr = new Readable({ read() {} });
  proc.kill = vi.fn();
  return proc;
}

describe('grabFrame', () => {
  it('resolves on ffmpeg exit code 0', async () => {
    const proc = createMockProc();
    mockSpawn.mockReturnValue(proc);

    const promise = grabFrame({
      rtspUrl: 'rtsp://localhost:8554/test',
      outPath: 'out.jpg',
      timeoutMs: 10_000,
    });

    // Verify spawn was called with correct args (no shell)
    expect(mockSpawn).toHaveBeenCalledWith(
      'ffmpeg',
      [
        '-hwaccel',
        'auto',
        '-rtsp_transport',
        'tcp',
        '-i',
        'rtsp://localhost:8554/test',
        '-frames:v',
        '1',
        '-y',
        'out.jpg',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );

    proc.emit('close', 0);
    const result = await promise;
    expect(result.outPath).toBe('out.jpg');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects with stderr tail on nonzero exit', async () => {
    const proc = createMockProc();
    mockSpawn.mockReturnValue(proc);

    const promise = grabFrame({
      rtspUrl: 'rtsp://bad',
      outPath: 'out.jpg',
      timeoutMs: 10_000,
    });

    // Allow the 'data' listener to be attached first
    await new Promise(r => setTimeout(r, 0));
    proc.stderr!.emit('data', Buffer.from('line1\nline2\nline3\nline4\n'));
    proc.emit('close', 1);

    await expect(promise).rejects.toThrow('ffmpeg exited with code 1');
    await expect(promise).rejects.toThrow('line2\nline3\nline4');
  });

  it('rejects with timeout and kills process', async () => {
    vi.useFakeTimers();
    const proc = createMockProc();
    mockSpawn.mockReturnValue(proc);

    const promise = grabFrame({
      rtspUrl: 'rtsp://slow',
      outPath: 'out.jpg',
      timeoutMs: 5_000,
    });

    vi.advanceTimersByTime(5_000);

    await expect(promise).rejects.toThrow('Timed out after 5000ms');
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');

    vi.useRealTimers();
  });

  it('rejects with friendly message when ffmpeg not found (ENOENT)', async () => {
    const proc = createMockProc();
    mockSpawn.mockReturnValue(proc);

    const promise = grabFrame({
      rtspUrl: 'rtsp://test',
      outPath: 'out.jpg',
      timeoutMs: 10_000,
    });

    const err = new Error('spawn ffmpeg ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    proc.emit('error', err);

    await expect(promise).rejects.toThrow('ffmpeg not found');
  });

  it('rejects with generic spawn error', async () => {
    const proc = createMockProc();
    mockSpawn.mockReturnValue(proc);

    const promise = grabFrame({
      rtspUrl: 'rtsp://test',
      outPath: 'out.jpg',
      timeoutMs: 10_000,
    });

    proc.emit('error', new Error('EPERM'));

    await expect(promise).rejects.toThrow('Failed to spawn ffmpeg: EPERM');
  });
});

// Integration test — only runs when RTSP_URL env var is set
describe.skipIf(!process.env.RTSP_URL)('grabFrame integration', () => {
  it('grabs a real frame from RTSP stream', async () => {
    const { existsSync, unlinkSync } = await import('node:fs');
    const outPath = `/tmp/cctv-test-${Date.now()}.jpg`;

    try {
      // Use real spawn for integration test
      vi.restoreAllMocks();
      const { grabFrame: realGrab } = await import('../../src/lib/ffmpeg');

      const result = await realGrab({
        rtspUrl: process.env.RTSP_URL!,
        outPath,
        timeoutMs: 15_000,
      });

      expect(result.outPath).toBe(outPath);
      expect(existsSync(outPath)).toBe(true);
    } finally {
      try {
        unlinkSync(outPath);
      } catch {
        /* noop */
      }
    }
  });
});
