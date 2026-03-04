#!/usr/bin/env bun
import { program } from 'commander';
import { grabAction } from './commands/grab';
import { sampleAction } from './commands/sample';

program
  .name('cctv')
  .description('CROW CCTV Edge Ingest Gateway CLI')
  .version('0.1.0');

program
  .command('grab')
  .description('Grab a single RTSP frame via ffmpeg')
  .requiredOption('--rtsp <url>', 'RTSP stream URL')
  .option('--out <path>', 'Output file path', 'out.jpg')
  .option('--timeout <ms>', 'Timeout in milliseconds', '10000')
  .action(grabAction);

program
  .command('sample')
  .description('Continuously sample RTSP frames to a local spool')
  .requiredOption('--store <id>', 'Store identifier')
  .requiredOption('--camera <id>', 'Camera identifier')
  .requiredOption('--rtsp <url>', 'RTSP stream URL')
  .option('--spool <path>', 'Spool directory root', './spool')
  .option('--fps <n>', 'Frames per second (0 < fps ≤ 30)', '1')
  .option('--timeout <ms>', 'Per-grab timeout in milliseconds', '10000')
  .option('--ingest <url>', 'Ingest service URL (e.g. http://localhost:3000)')
  .action(sampleAction);

program.parse();
