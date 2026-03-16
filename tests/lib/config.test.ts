import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadStoreConfig } from '../../src/lib/config';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

const { readFile: mockReadFile } = await import('node:fs/promises');
const mockRead = mockReadFile as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.clearAllMocks();
});

describe('loadStoreConfig', () => {
  it('parses valid YAML into StoreConfig', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
cameras:
  - id: cam_a
    rtsp: rtsp://10.0.0.1/stream
  - id: cam_b
    rtsp: rtsp://10.0.0.2/stream
`);

    const config = await loadStoreConfig('store.yaml');
    expect(config.store_id).toBe('shop_01');
    expect(config.cameras).toHaveLength(2);
    expect(config.cameras[0]).toEqual({
      id: 'cam_a',
      rtsp: 'rtsp://10.0.0.1/stream',
    });
    expect(config.cameras[1]).toEqual({
      id: 'cam_b',
      rtsp: 'rtsp://10.0.0.2/stream',
    });
  });

  it('throws on missing cameras field', async () => {
    mockRead.mockResolvedValue(`store_id: shop_01\n`);
    await expect(loadStoreConfig('bad.yaml')).rejects.toThrow();
  });

  it('throws on empty camera list', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
cameras: []
`);
    await expect(loadStoreConfig('empty.yaml')).rejects.toThrow();
  });

  it('throws on missing store_id', async () => {
    mockRead.mockResolvedValue(`
cameras:
  - id: cam_a
    rtsp: rtsp://10.0.0.1/stream
`);
    await expect(loadStoreConfig('no-store.yaml')).rejects.toThrow();
  });

  it('throws on camera missing rtsp', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
cameras:
  - id: cam_a
`);
    await expect(loadStoreConfig('no-rtsp.yaml')).rejects.toThrow();
  });

  it('throws on camera with empty id', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
cameras:
  - id: ""
    rtsp: rtsp://10.0.0.1/stream
`);
    await expect(loadStoreConfig('empty-id.yaml')).rejects.toThrow();
  });

  it('parses config with grid + grid_position', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
grid:
  rows: 2
  cols: 2
cameras:
  - id: cam_a
    rtsp: rtsp://10.0.0.1/stream
    grid_position: { row: 0, col: 0 }
  - id: cam_b
    rtsp: rtsp://10.0.0.2/stream
    grid_position: { row: 0, col: 1 }
`);
    const config = await loadStoreConfig('grid.yaml');
    expect(config.grid).toEqual({ rows: 2, cols: 2 });
    expect(config.cameras[0].grid_position).toEqual({ row: 0, col: 0 });
    expect(config.cameras[1].grid_position).toEqual({ row: 0, col: 1 });
  });

  it('parses config without grid (backwards compat)', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
cameras:
  - id: cam_a
    rtsp: rtsp://10.0.0.1/stream
`);
    const config = await loadStoreConfig('no-grid.yaml');
    expect(config.grid).toBeUndefined();
    expect(config.cameras[0].grid_position).toBeUndefined();
  });

  it('throws on duplicate grid_position', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
grid:
  rows: 2
  cols: 2
cameras:
  - id: cam_a
    rtsp: rtsp://10.0.0.1/stream
    grid_position: { row: 0, col: 0 }
  - id: cam_b
    rtsp: rtsp://10.0.0.2/stream
    grid_position: { row: 0, col: 0 }
`);
    await expect(loadStoreConfig('dup-pos.yaml')).rejects.toThrow(
      /Duplicate grid_position/
    );
  });

  it('throws on grid_position out of bounds', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
grid:
  rows: 1
  cols: 1
cameras:
  - id: cam_a
    rtsp: rtsp://10.0.0.1/stream
    grid_position: { row: 1, col: 0 }
`);
    await expect(loadStoreConfig('oob-pos.yaml')).rejects.toThrow(
      /out of bounds/
    );
  });

  it('throws when grid defined but camera missing grid_position', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
grid:
  rows: 2
  cols: 2
cameras:
  - id: cam_a
    rtsp: rtsp://10.0.0.1/stream
`);
    await expect(loadStoreConfig('missing-pos.yaml')).rejects.toThrow(
      /missing grid_position/
    );
  });

  it('parses motion config', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
motion:
  enabled: true
  ttl_seconds: 5
cameras:
  - id: cam_a
    rtsp: rtsp://10.0.0.1/stream
`);
    const config = await loadStoreConfig('motion.yaml');
    expect(config.motion).toEqual({ enabled: true, ttl_seconds: 5 });
  });

  it('motion config is optional (backwards compat)', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
cameras:
  - id: cam_a
    rtsp: rtsp://10.0.0.1/stream
`);
    const config = await loadStoreConfig('no-motion.yaml');
    expect(config.motion).toBeUndefined();
  });

  it('rejects invalid ttl_seconds (out of range)', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
motion:
  enabled: true
  ttl_seconds: 100
cameras:
  - id: cam_a
    rtsp: rtsp://10.0.0.1/stream
`);
    await expect(loadStoreConfig('bad-ttl.yaml')).rejects.toThrow();
  });

  it('parses onvif_url on camera', async () => {
    mockRead.mockResolvedValue(`
store_id: shop_01
cameras:
  - id: cam_a
    rtsp: rtsp://10.0.0.1/stream
    onvif_url: http://10.0.0.1:80
`);
    const config = await loadStoreConfig('onvif.yaml');
    expect(config.cameras[0].onvif_url).toBe('http://10.0.0.1:80');
  });
});
