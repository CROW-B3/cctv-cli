#!/usr/bin/env bun
import { program } from 'commander';
import { listCommand } from './commands/list';
import { streamCommand } from './commands/stream';

program
  .name('cctv')
  .description('CROW CCTV CLI — capture and stream video+audio for analysis')
  .version('0.0.1');

program
  .command('list')
  .description('List available camera devices')
  .action(listCommand);

program
  .command('stream')
  .description('Stream video+audio to the ingest service')
  .option(
    '-i, --input <source>',
    'Input source (camera device or video file path)'
  )
  .option(
    '-u, --url <url>',
    'WebSocket URL of the ingest service',
    'ws://localhost:8015/ws'
  )
  .action(streamCommand);

program.parse();
