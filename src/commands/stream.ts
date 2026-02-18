import fs from 'node:fs';
import process from 'node:process';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { startMediaCapture } from '../utils/media';
import { createWebSocketClient } from '../utils/ws-client';

interface StreamOptions {
  input?: string;
  url: string;
}

function determineSourceType(inputPath: string): 'video_file' | 'camera' {
  const isExistingFile =
    fs.existsSync(inputPath) && fs.statSync(inputPath).isFile();
  return isExistingFile ? 'video_file' : 'camera';
}

async function selectCameraDevice(): Promise<string> {
  if (process.platform !== 'darwin') return '/dev/video0';

  return select({
    message: 'Select camera (AVFoundation index):',
    choices: [
      { name: '0 — Default camera', value: '0' },
      { name: '1 — Secondary camera', value: '1' },
    ],
  });
}

async function selectVideoFilePath(): Promise<string> {
  const { input } = await import('@inquirer/prompts');
  return input({ message: 'Enter video file path:' });
}

async function promptForInputSource(): Promise<string> {
  const selectedSourceType = await select({
    message: 'Select input source type:',
    choices: [
      { name: 'Camera device', value: 'camera' },
      { name: 'Video file', value: 'file' },
    ],
  });

  if (selectedSourceType === 'camera') return selectCameraDevice();
  return selectVideoFilePath();
}

function displayAnalysisMessage(rawMessage: string): void {
  const parsed = JSON.parse(rawMessage);

  if (parsed.type === 'analysis') {
    console.log(chalk.green('Analysis:'), parsed.text);
    return;
  }

  if (parsed.type === 'error') {
    console.error(chalk.red('Error:'), parsed.message);
    return;
  }

  console.log(chalk.dim('Server:'), rawMessage);
}

export async function streamCommand(options: StreamOptions): Promise<void> {
  const inputSource = options.input ?? (await promptForInputSource());

  if (!inputSource) {
    console.error(chalk.red('No input source specified.'));
    process.exit(1);
  }

  const sourceType = determineSourceType(inputSource);
  console.log(
    chalk.blue(`\nSource: ${chalk.bold(inputSource)} (${sourceType})`)
  );
  console.log(chalk.blue(`Server: ${chalk.bold(options.url)}\n`));

  const websocketClient = createWebSocketClient(
    options.url,
    sourceType,
    inputSource
  );

  websocketClient.onOpen(() => {
    console.log(chalk.green('Connected to ingest service.'));
    console.log(chalk.dim('Starting media capture...\n'));

    const mediaProcess = startMediaCapture(
      inputSource,
      sourceType,
      (type, data) => {
        websocketClient.send(JSON.stringify({ type, data }));
      }
    );

    websocketClient.onClose(() => {
      console.log(chalk.yellow('\nConnection closed.'));
      mediaProcess.kill();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nStopping...'));
      mediaProcess.kill();
      websocketClient.close();
      process.exit(0);
    });
  });

  websocketClient.onMessage(rawMessage => {
    try {
      displayAnalysisMessage(rawMessage);
    } catch {
      console.log(chalk.dim('Server:'), rawMessage);
    }
  });
}
