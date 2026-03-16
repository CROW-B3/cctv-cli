import type { TileMap } from '../../src/lib/compositor';
import type { CameraEntry, Grid } from '../../src/lib/config';

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { compositeFrames, generatePlaceholder } from '../../src/lib/compositor';

const TEST_SPOOL = path.join(
  import.meta.dirname,
  '..',
  '__fixtures__',
  'compositor-spool'
);
const STORE_ID = 'test_store';
const BUCKET = 1700000000;

function makeTestJpeg(
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
) {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer();
}

beforeAll(async () => {
  // Create spool dirs and fake frames for cam_01 and cam_02
  const cam01Dir = path.join(TEST_SPOOL, STORE_ID, 'cam_01');
  const cam02Dir = path.join(TEST_SPOOL, STORE_ID, 'cam_02');
  mkdirSync(cam01Dir, { recursive: true });
  mkdirSync(cam02Dir, { recursive: true });

  const frame1 = await makeTestJpeg(640, 480, { r: 255, g: 0, b: 0 });
  const frame2 = await makeTestJpeg(640, 480, { r: 0, g: 0, b: 255 });
  writeFileSync(path.join(cam01Dir, `${BUCKET}_low.jpg`), frame1);
  writeFileSync(path.join(cam02Dir, `${BUCKET}_low.jpg`), frame2);
});

afterAll(() => {
  rmSync(TEST_SPOOL, { recursive: true, force: true });
});

const grid: Grid = { rows: 2, cols: 2 };
const cameras: CameraEntry[] = [
  { id: 'cam_01', rtsp: 'rtsp://fake/1', grid_position: { row: 0, col: 0 } },
  { id: 'cam_02', rtsp: 'rtsp://fake/2', grid_position: { row: 0, col: 1 } },
];

describe('generatePlaceholder', () => {
  it('returns a valid JPEG buffer', async () => {
    const buf = await generatePlaceholder(320, 240);
    expect(buf).toBeInstanceOf(Buffer);

    const meta = await sharp(buf).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(320);
    expect(meta.height).toBe(240);
  });
});

describe('compositeFrames', () => {
  it('creates composite JPEG and tile_map for all-present cameras', async () => {
    const result = await compositeFrames({
      storeId: STORE_ID,
      bucketSec: BUCKET,
      cameras,
      grid,
      spoolDir: TEST_SPOOL,
      tileWidth: 160,
      tileHeight: 120,
    });

    expect(existsSync(result.jpegPath)).toBe(true);
    expect(existsSync(result.tileMapPath)).toBe(true);

    // Verify composite dimensions
    const meta = await sharp(readFileSync(result.jpegPath)).metadata();
    expect(meta.width).toBe(320); // 2 cols * 160
    expect(meta.height).toBe(240); // 2 rows * 120

    // Verify tile map
    const tileMap: TileMap = JSON.parse(
      readFileSync(result.tileMapPath, 'utf-8')
    );
    expect(tileMap.store_id).toBe(STORE_ID);
    expect(tileMap.bucket_sec).toBe(BUCKET);
    expect(tileMap.grid).toEqual(grid);
    expect(tileMap.tiles).toHaveLength(4); // 2x2 grid

    // cam_01 and cam_02 present; other 2 cells are empty placeholders
    const cam01Tile = tileMap.tiles.find(t => t.camera_id === 'cam_01');
    const cam02Tile = tileMap.tiles.find(t => t.camera_id === 'cam_02');
    expect(cam01Tile?.present).toBe(true);
    expect(cam02Tile?.present).toBe(true);

    const emptyTiles = tileMap.tiles.filter(t => t.camera_id === '');
    expect(emptyTiles).toHaveLength(2);
    expect(emptyTiles.every(t => !t.present)).toBe(true);
  });

  it('marks missing camera frame as not present', async () => {
    const camerasWithMissing: CameraEntry[] = [
      {
        id: 'cam_01',
        rtsp: 'rtsp://fake/1',
        grid_position: { row: 0, col: 0 },
      },
      {
        id: 'cam_missing',
        rtsp: 'rtsp://fake/x',
        grid_position: { row: 0, col: 1 },
      },
    ];

    const result = await compositeFrames({
      storeId: STORE_ID,
      bucketSec: BUCKET,
      cameras: camerasWithMissing,
      grid,
      spoolDir: TEST_SPOOL,
      tileWidth: 160,
      tileHeight: 120,
    });

    const tileMap: TileMap = JSON.parse(
      readFileSync(result.tileMapPath, 'utf-8')
    );
    const missingTile = tileMap.tiles.find(t => t.camera_id === 'cam_missing');
    expect(missingTile?.present).toBe(false);
  });

  it('outputs to correct spool paths', async () => {
    const result = await compositeFrames({
      storeId: STORE_ID,
      bucketSec: BUCKET,
      cameras,
      grid,
      spoolDir: TEST_SPOOL,
      tileWidth: 160,
      tileHeight: 120,
    });

    const expectedDir = path.join(TEST_SPOOL, STORE_ID, 'composites');
    expect(result.jpegPath).toBe(path.join(expectedDir, `${BUCKET}.jpg`));
    expect(result.tileMapPath).toBe(
      path.join(expectedDir, `${BUCKET}.tile_map.json`)
    );
  });

  it('uses default tile dimensions when not specified', async () => {
    const result = await compositeFrames({
      storeId: STORE_ID,
      bucketSec: BUCKET,
      cameras,
      grid,
      spoolDir: TEST_SPOOL,
    });

    const meta = await sharp(readFileSync(result.jpegPath)).metadata();
    expect(meta.width).toBe(640); // 2 * 320
    expect(meta.height).toBe(480); // 2 * 240
  });
});
