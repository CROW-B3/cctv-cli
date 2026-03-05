import process from 'node:process';
import chalk from 'chalk';
import { grabFrame } from '../lib/ffmpeg';

interface GrabOptions {
  rtsp: string;
  out: string;
  timeout: string;
}

export async function grabAction(opts: GrabOptions): Promise<void> {
  const timeoutMs = Number.parseInt(opts.timeout, 10);
  if (Number.isNaN(timeoutMs) || timeoutMs <= 0) {
    console.error(
      chalk.red('Error: --timeout must be a positive integer (ms)')
    );
    process.exit(1);
  }

  try {
    const result = await grabFrame({
      rtspUrl: opts.rtsp,
      outPath: opts.out,
      timeoutMs,
    });
    console.log(
      chalk.green(`Frame saved to ${result.outPath} (${result.durationMs}ms)`)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${msg}`));
    process.exit(1);
  }
}
