import { describe, expect, it, vi } from 'vitest';

import { grabAction } from '../src/commands/grab';
import { grabFrame } from '../src/lib/ffmpeg';

// Mock the ffmpeg module before importing grab
vi.mock('../src/lib/ffmpeg', () => ({
  grabFrame: vi.fn(),
}));

const mockGrabFrame = vi.mocked(grabFrame);

describe('grabAction', () => {
  it('calls grabFrame with parsed options', async () => {
    mockGrabFrame.mockResolvedValue({ outPath: 'out.jpg', durationMs: 42 });

    // Spy on console.log to verify output
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await grabAction({
      rtsp: 'rtsp://localhost/test',
      out: 'out.jpg',
      timeout: '10000',
    });

    expect(mockGrabFrame).toHaveBeenCalledWith({
      rtspUrl: 'rtsp://localhost/test',
      outPath: 'out.jpg',
      timeoutMs: 10_000,
    });
    expect(logSpy).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('exits with code 1 on invalid timeout', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await grabAction({ rtsp: 'rtsp://test', out: 'out.jpg', timeout: 'abc' });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('exits with code 1 when grabFrame rejects', async () => {
    mockGrabFrame.mockRejectedValue(new Error('Timed out after 5000ms'));
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await grabAction({ rtsp: 'rtsp://slow', out: 'out.jpg', timeout: '5000' });

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errSpy.mockRestore();
  });
});
