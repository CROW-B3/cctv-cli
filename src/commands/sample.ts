import type { SamplerHandle, SamplerStats } from '../lib/sampler';

import process from 'node:process';

import chalk from 'chalk';

import { loadStoreConfig } from '../lib/config';
import { startSampler } from '../lib/sampler';

interface SampleOptions {
  store?: string;
  camera?: string;
  rtsp?: string;
  spool: string;
  fps: string;
  timeout: string;
  ingest?: string;
  config?: string;
}

export async function sampleAction(opts: SampleOptions): Promise<void> {
  const fps = Number.parseFloat(opts.fps);
  if (Number.isNaN(fps) || fps <= 0 || fps > 30) {
    console.error(chalk.red('Error: --fps must be a number between 0 and 30'));
    process.exit(1);
  }

  const timeoutMs = Number.parseInt(opts.timeout, 10);
  if (Number.isNaN(timeoutMs) || timeoutMs <= 0) {
    console.error(
      chalk.red('Error: --timeout must be a positive integer (ms)')
    );
    process.exit(1);
  }

  if (opts.config) {
    await runMultiCamera(opts, fps, timeoutMs);
  } else {
    await runSingleCamera(opts, fps, timeoutMs);
  }
}

async function runSingleCamera(
  opts: SampleOptions,
  fps: number,
  timeoutMs: number
): Promise<void> {
  if (!opts.store || !opts.camera || !opts.rtsp) {
    console.error(
      chalk.red(
        'Error: --store, --camera, and --rtsp are required (or use --config)'
      )
    );
    process.exit(1);
  }

  const handle = startSampler({
    spoolDir: opts.spool,
    storeId: opts.store,
    cameraId: opts.camera,
    rtspUrl: opts.rtsp,
    fps,
    timeoutMs,
    ingestUrl: opts.ingest,
  });

  const shutdown = () => {
    console.log(chalk.yellow('\nStopping sampler…'));
    handle.stop();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const target = opts.ingest
    ? `${opts.spool}/…/ + ${opts.ingest}`
    : `${opts.spool}/${opts.store}/${opts.camera}/`;
  console.log(chalk.blue(`Sampling ${opts.rtsp} at ${fps} FPS → ${target}`));

  const stats = await handle.done;
  printStats(stats, opts.ingest);
}

async function runMultiCamera(
  opts: SampleOptions,
  fps: number,
  timeoutMs: number
): Promise<void> {
  const config = await loadStoreConfig(opts.config!);

  const handles: { cameraId: string; handle: SamplerHandle }[] = [];

  for (const cam of config.cameras) {
    const handle = startSampler({
      spoolDir: opts.spool,
      storeId: config.store_id,
      cameraId: cam.id,
      rtspUrl: cam.rtsp,
      fps,
      timeoutMs,
      ingestUrl: opts.ingest,
    });
    handles.push({ cameraId: cam.id, handle });
  }

  const shutdown = () => {
    console.log(chalk.yellow('\nStopping all samplers…'));
    for (const { handle } of handles) {
      handle.stop();
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(
    chalk.blue(
      `Sampling ${config.cameras.length} camera(s) for store ${config.store_id} at ${fps} FPS → ${opts.spool}/`
    )
  );
  for (const cam of config.cameras) {
    console.log(chalk.blue(`  ${cam.id}: ${cam.rtsp}`));
  }

  const allStats = await Promise.all(
    handles.map(async ({ cameraId, handle }) => {
      const stats = await handle.done;
      return { cameraId, stats };
    })
  );

  // Print per-camera stats
  for (const { cameraId, stats } of allStats) {
    const uploadInfo = opts.ingest
      ? `, uploaded: ${stats.uploaded}, uploadErrors: ${stats.uploadErrors}`
      : '';
    console.log(
      chalk.green(
        `  [${cameraId}] grabbed: ${stats.grabbed}, errors: ${stats.errors}${uploadInfo}`
      )
    );
  }

  // Aggregate
  const agg = aggregateStats(allStats.map(s => s.stats));
  printStats(agg, opts.ingest);
}

export function aggregateStats(statsList: SamplerStats[]): SamplerStats {
  return statsList.reduce(
    (acc, s) => ({
      grabbed: acc.grabbed + s.grabbed,
      errors: acc.errors + s.errors,
      uploaded: acc.uploaded + s.uploaded,
      uploadErrors: acc.uploadErrors + s.uploadErrors,
      startedAt: Math.min(acc.startedAt, s.startedAt),
    }),
    {
      grabbed: 0,
      errors: 0,
      uploaded: 0,
      uploadErrors: 0,
      startedAt: Infinity,
    }
  );
}

function printStats(stats: SamplerStats, ingestUrl?: string): void {
  const duration = ((Date.now() - stats.startedAt) / 1000).toFixed(1);
  const uploadInfo = ingestUrl
    ? `, uploaded: ${stats.uploaded}, uploadErrors: ${stats.uploadErrors}`
    : '';
  console.log(
    chalk.green(
      `Done — grabbed: ${stats.grabbed}, errors: ${stats.errors}${uploadInfo}, duration: ${duration}s`
    )
  );
}
