import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const TEST_SPOOL = path.join(
  import.meta.dirname,
  '..',
  '__fixtures__',
  'composite-cmd-spool'
);
const STORE_ID = 'cmd_test_store';
const BUCKET = 1700000001;

// Mock loadStoreConfig to return a config with grid
vi.mock('../../src/lib/config', () => ({
  loadStoreConfig: vi.fn(),
}));

const { loadStoreConfig: mockLoadConfig } = await import(
  '../../src/lib/config'
);
const mockLoad = mockLoadConfig as unknown as ReturnType<typeof vi.fn>;

// Mock process.exit to not actually exit
vi.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as never);

beforeAll(async () => {
  const camDir = path.join(TEST_SPOOL, STORE_ID, 'cam_01');
  mkdirSync(camDir, { recursive: true });

  const frame = await sharp({
    create: {
      width: 320,
      height: 240,
      channels: 3,
      background: { r: 100, g: 200, b: 50 },
    },
  })
    .jpeg()
    .toBuffer();
  writeFileSync(path.join(camDir, `${BUCKET}_low.jpg`), frame);
});

afterAll(() => {
  rmSync(TEST_SPOOL, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('compositeAction', () => {
  it('creates composite from spooled frames via standalone command', async () => {
    mockLoad.mockResolvedValue({
      store_id: STORE_ID,
      grid: { rows: 1, cols: 2 },
      cameras: [
        {
          id: 'cam_01',
          rtsp: 'rtsp://fake/1',
          grid_position: { row: 0, col: 0 },
        },
        {
          id: 'cam_02',
          rtsp: 'rtsp://fake/2',
          grid_position: { row: 0, col: 1 },
        },
      ],
    });

    const { compositeAction } = await import('../../src/commands/composite');

    await compositeAction({
      config: 'test.yaml',
      spool: TEST_SPOOL,
      bucket: String(BUCKET),
      tileWidth: '160',
      tileHeight: '120',
    });

    const compositePath = path.join(
      TEST_SPOOL,
      STORE_ID,
      'composites',
      `${BUCKET}.jpg`
    );
    const tileMapPath = path.join(
      TEST_SPOOL,
      STORE_ID,
      'composites',
      `${BUCKET}.tile_map.json`
    );
    expect(existsSync(compositePath)).toBe(true);
    expect(existsSync(tileMapPath)).toBe(true);
  });

  it('rejects invalid bucket value', async () => {
    const { compositeAction } = await import('../../src/commands/composite');

    await expect(
      compositeAction({
        config: 'test.yaml',
        spool: TEST_SPOOL,
        bucket: 'not-a-number',
        tileWidth: '320',
        tileHeight: '240',
      })
    ).rejects.toThrow('process.exit called');
  });

  it('rejects config without grid', async () => {
    mockLoad.mockResolvedValue({
      store_id: STORE_ID,
      cameras: [{ id: 'cam_01', rtsp: 'rtsp://fake/1' }],
    });

    const { compositeAction } = await import('../../src/commands/composite');

    await expect(
      compositeAction({
        config: 'test.yaml',
        spool: TEST_SPOOL,
        bucket: String(BUCKET),
        tileWidth: '320',
        tileHeight: '240',
      })
    ).rejects.toThrow('process.exit called');
  });
});
