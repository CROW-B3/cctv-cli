import { describe, expect, it } from 'vitest';
import { bucketSec } from '../../src/lib/types';

describe('bucketSec', () => {
  it('floors milliseconds to whole seconds', () => {
    expect(bucketSec(1_500)).toBe(1);
    expect(bucketSec(999)).toBe(0);
    expect(bucketSec(1_000)).toBe(1);
  });

  it('handles exact second boundaries', () => {
    expect(bucketSec(60_000)).toBe(60);
    expect(bucketSec(59_999)).toBe(59);
  });

  it('handles zero', () => {
    expect(bucketSec(0)).toBe(0);
  });

  it('handles realistic epoch timestamps', () => {
    // 2024-01-01T00:00:00.500Z
    const ts = 1_704_067_200_500;
    expect(bucketSec(ts)).toBe(1_704_067_200);
  });

  it('defaults to Date.now() when no argument', () => {
    const before = Math.floor(Date.now() / 1000);
    const result = bucketSec();
    const after = Math.floor(Date.now() / 1000);
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});
