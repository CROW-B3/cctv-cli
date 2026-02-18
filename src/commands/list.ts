import { spawn } from 'node:child_process';
import process from 'node:process';
import chalk from 'chalk';

function collectStderr(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderrOutput = '';
    ffmpegProcess.stderr.on('data', (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    ffmpegProcess.on('close', () => resolve(stderrOutput));
    ffmpegProcess.on('error', reject);
  });
}

function parseAndDisplayMacDevices(rawOutput: string): void {
  const lines = rawOutput.split('\n');
  let currentSection = '';

  for (const line of lines) {
    if (line.includes('AVFoundation video devices')) {
      currentSection = 'video';
      console.log(chalk.green('Video devices:'));
      continue;
    }

    if (line.includes('AVFoundation audio devices')) {
      currentSection = 'audio';
      console.log(chalk.green('\nAudio devices:'));
      continue;
    }

    if (!currentSection || !line.includes(']')) continue;

    const deviceMatch = line.match(/\[(\d+)\]\s+(.*)/);
    if (!deviceMatch) continue;

    console.log(`  ${chalk.cyan(deviceMatch[1])} — ${deviceMatch[2]}`);
  }
}

async function fetchMacDevices(): Promise<void> {
  const rawOutput = await collectStderr([
    '-f',
    'avfoundation',
    '-list_devices',
    'true',
    '-i',
    '',
  ]);
  parseAndDisplayMacDevices(rawOutput);
}

async function fetchLinuxDevices(): Promise<void> {
  const rawOutput = await collectStderr([
    '-f',
    'v4l2',
    '-list_devices',
    'true',
    '-i',
    '',
  ]);
  console.log(rawOutput);
}

async function fetchGenericDevices(): Promise<void> {
  const rawOutput = await collectStderr(['-devices']);
  console.log(rawOutput);
}

const platformDeviceFetchers: Record<string, () => Promise<void>> = {
  darwin: fetchMacDevices,
  linux: fetchLinuxDevices,
};

export async function listCommand(): Promise<void> {
  console.log(chalk.blue('Scanning for available camera devices...\n'));

  const fetchDevices =
    platformDeviceFetchers[process.platform] ?? fetchGenericDevices;

  try {
    await fetchDevices();
  } catch {
    console.error(
      chalk.red('Failed to list devices. Make sure ffmpeg is installed.')
    );
    process.exit(1);
  }
}
