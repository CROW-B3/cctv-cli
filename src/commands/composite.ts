import process from 'node:process';

import chalk from 'chalk';

import { compositeFrames } from '../lib/compositor';
import { loadStoreConfig } from '../lib/config';

interface CompositeOptions {
  config: string;
  spool: string;
  bucket: string;
  tileWidth: string;
  tileHeight: string;
}

export async function compositeAction(opts: CompositeOptions): Promise<void> {
  const bucketSec = Number.parseInt(opts.bucket, 10);
  if (Number.isNaN(bucketSec) || bucketSec <= 0) {
    console.error(
      chalk.red('Error: --bucket must be a positive integer (epoch seconds)')
    );
    process.exit(1);
  }

  const tileWidth = Number.parseInt(opts.tileWidth, 10);
  const tileHeight = Number.parseInt(opts.tileHeight, 10);

  const config = await loadStoreConfig(opts.config);

  if (!config.grid) {
    console.error(
      chalk.red('Error: config must include a grid definition for compositing')
    );
    process.exit(1);
  }

  console.log(
    chalk.blue(
      `Compositing ${config.cameras.length} camera(s) for store ${config.store_id}, bucket ${bucketSec}`
    )
  );

  const result = await compositeFrames({
    storeId: config.store_id,
    bucketSec,
    cameras: config.cameras,
    grid: config.grid,
    spoolDir: opts.spool,
    tileWidth,
    tileHeight,
  });

  console.log(chalk.green(`Composite written: ${result.jpegPath}`));
  console.log(chalk.green(`Tile map written:  ${result.tileMapPath}`));

  const present = result.tileMap.tiles.filter(t => t.present).length;
  const total = result.tileMap.tiles.length;
  console.log(chalk.green(`Tiles: ${present}/${total} present`));
}
