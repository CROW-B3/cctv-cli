import process from 'node:process';

import chalk from 'chalk';

import { startSampler } from '../lib/sampler';

interface SampleOptions {
  store: string;
  camera: string;
  rtsp: string;
  spool: string;
  fps: string;
  timeout: string;
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

  const handle = startSampler({
    spoolDir: opts.spool,
    storeId: opts.store,
    cameraId: opts.camera,
    rtspUrl: opts.rtsp,
    fps,
    timeoutMs,
  });

  const shutdown = () => {
    console.log(chalk.yellow('\nStopping sampler…'));
    handle.stop();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(
    chalk.blue(
      `Sampling ${opts.rtsp} at ${fps} FPS → ${opts.spool}/${opts.store}/${opts.camera}/`
    )
  );

  const stats = await handle.done;

  console.log(
    chalk.green(
      `Done — grabbed: ${stats.grabbed}, errors: ${stats.errors}, ` +
        `duration: ${((Date.now() - stats.startedAt) / 1000).toFixed(1)}s`
    )
  );
}
