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
});
