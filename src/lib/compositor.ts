import type { CameraEntry, Grid } from './config';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { spoolPath } from './spool';

export interface CompositeOpts {
  storeId: string;
  bucketSec: number;
  cameras: CameraEntry[];
  grid: Grid;
  spoolDir: string;
  tileWidth?: number;
  tileHeight?: number;
}

export interface TileInfo {
  row: number;
  col: number;
  camera_id: string;
  present: boolean;
}

export interface TileMap {
  store_id: string;
  bucket_sec: number;
  grid: Grid;
  tiles: TileInfo[];
}

export interface CompositeResult {
  jpegPath: string;
  tileMapPath: string;
  tileMap: TileMap;
}

/**
 * Generate a plain gray placeholder tile with the given dimensions.
 */
export async function generatePlaceholder(
  width: number,
  height: number
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 80, g: 80, b: 80 },
    },
  })
    .jpeg({ quality: 60 })
    .toBuffer();
}

/**
 * Assemble per-camera spool frames into a single composite mosaic JPEG.
 * Missing cameras get a gray placeholder tile.
 */
export async function compositeFrames(
  opts: CompositeOpts
): Promise<CompositeResult> {
  const tileW = opts.tileWidth ?? 320;
  const tileH = opts.tileHeight ?? 240;
  const canvasW = opts.grid.cols * tileW;
  const canvasH = opts.grid.rows * tileH;

  // Build camera lookup by grid position
  const posMap = new Map<string, CameraEntry>();
  for (const cam of opts.cameras) {
    if (cam.grid_position) {
      posMap.set(`${cam.grid_position.row},${cam.grid_position.col}`, cam);
    }
  }

  const tiles: TileInfo[] = [];
  const composites: sharp.OverlayOptions[] = [];
  let placeholder: Buffer | null = null;

  for (let r = 0; r < opts.grid.rows; r++) {
    for (let c = 0; c < opts.grid.cols; c++) {
      const cam = posMap.get(`${r},${c}`);
      const left = c * tileW;
      const top = r * tileH;

      if (cam) {
        const framePath = spoolPath(
          { spoolDir: opts.spoolDir, storeId: opts.storeId, cameraId: cam.id },
          opts.bucketSec,
          'low'
        );

        let tileBuffer: Buffer;
        let present = true;
        try {
          const raw = await readFile(framePath);
          tileBuffer = await sharp(raw).resize(tileW, tileH).toBuffer();
        } catch {
          present = false;
          if (!placeholder)
            placeholder = await generatePlaceholder(tileW, tileH);
          tileBuffer = placeholder;
        }

        composites.push({ input: tileBuffer, left, top });
        tiles.push({ row: r, col: c, camera_id: cam.id, present });
      } else {
        // Empty grid cell — no camera assigned
        if (!placeholder) placeholder = await generatePlaceholder(tileW, tileH);
        composites.push({ input: placeholder, left, top });
        tiles.push({ row: r, col: c, camera_id: '', present: false });
      }
    }
  }

  const jpegBuffer = await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 80 })
    .toBuffer();

  // Write outputs
  const outDir = path.join(opts.spoolDir, opts.storeId, 'composites');
  await mkdir(outDir, { recursive: true });

  const jpegPath = path.join(outDir, `${opts.bucketSec}.jpg`);
  const tileMapPath = path.join(outDir, `${opts.bucketSec}.tile_map.json`);

  const tileMap: TileMap = {
    store_id: opts.storeId,
    bucket_sec: opts.bucketSec,
    grid: opts.grid,
    tiles,
  };

  await writeFile(jpegPath, jpegBuffer);
  await writeFile(tileMapPath, JSON.stringify(tileMap, null, 2));

  return { jpegPath, tileMapPath, tileMap };
}
