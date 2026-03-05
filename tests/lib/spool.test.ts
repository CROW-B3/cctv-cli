import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { ensureSpoolDir, spoolPath } from '../../src/lib/spool';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

const mockMkdir = mkdir as unknown as ReturnType<typeof vi.fn>;

describe('spoolPath', () => {
  const config = { spoolDir: 'spool', storeId: 'store1', cameraId: 'cam1' };

  it('returns correct path format', () => {
    const result = spoolPath(config, 1704067200, 'low');
    expect(result).toBe(
      path.join('spool', 'store1', 'cam1', '1704067200_low.jpg')
    );
  });

  it('uses quality in filename', () => {
    const result = spoolPath(config, 1704067200, 'high');
    expect(result).toBe(
      path.join('spool', 'store1', 'cam1', '1704067200_high.jpg')
    );
  });

  it('handles different store and camera ids', () => {
    const result = spoolPath(
      { spoolDir: '/tmp/spool', storeId: 'abc', cameraId: 'front' },
      999,
      'low'
    );
    expect(result).toBe(path.join('/tmp/spool', 'abc', 'front', '999_low.jpg'));
  });
});

describe('ensureSpoolDir', () => {
  it('creates directory with recursive option', async () => {
    const config = { spoolDir: 'spool', storeId: 'store1', cameraId: 'cam1' };
    await ensureSpoolDir(config);

    expect(mockMkdir).toHaveBeenCalledWith(
      path.join('spool', 'store1', 'cam1'),
      { recursive: true }
    );
  });
});
