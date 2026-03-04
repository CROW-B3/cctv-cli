#!/usr/bin/env bun
import { program } from 'commander';
import { grabAction } from './commands/grab';

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

program.parse();
