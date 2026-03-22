import { stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import chalk from 'chalk';

import { extractFramesFromVideo } from '../lib/ffmpeg';
import { ensureSpoolDir } from '../lib/spool';
import { bucketSec } from '../lib/types';
import { uploadFrame } from '../lib/uploader';

interface ProcessOptions {
  file: string;
  store: string;
  camera: string;
  spool: string;
  fps: string;
  timeout: string;
  ingest?: string;
}

const SUPPORTED_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.mov', '.webm', '.m4v'];

export async function processAction(opts: ProcessOptions): Promise<void> {
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

  // Validate video file exists
  const videoPath = path.resolve(opts.file);
  try {
    const fileStat = await stat(videoPath);
    if (!fileStat.isFile()) {
      console.error(chalk.red(`Error: "${videoPath}" is not a file`));
      process.exit(1);
    }
  } catch {
    console.error(chalk.red(`Error: File not found: "${videoPath}"`));
    process.exit(1);
  }

  // Validate extension
  const ext = path.extname(videoPath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    console.error(
      chalk.red(
        `Error: Unsupported format "${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`
      )
    );
    process.exit(1);
  }

  // Ensure spool directory
  const spoolConfig = {
    spoolDir: opts.spool,
    storeId: opts.store,
    cameraId: opts.camera,
  };
  await ensureSpoolDir(spoolConfig);
  const outputDir = path.join(opts.spool, opts.store, opts.camera);

  console.log(chalk.blue(`Processing video: ${videoPath}`));
  console.log(
    chalk.blue(`  Store: ${opts.store}, Camera: ${opts.camera}, FPS: ${fps}`)
  );
  console.log(chalk.blue(`  Output: ${outputDir}/`));
  if (opts.ingest) {
    console.log(chalk.blue(`  Ingest: ${opts.ingest}`));
  }

  // Extract frames
  console.log(chalk.yellow('Extracting frames...'));
  const { framePaths, durationMs: extractionMs } = await extractFramesFromVideo(
    {
      videoPath,
      outputDir,
      fps,
      timeoutMs: Math.max(timeoutMs, 600_000), // At least 10 minutes for full video extraction
    }
  );

  console.log(
    chalk.green(
      `Extracted ${framePaths.length} frames in ${(extractionMs / 1000).toFixed(1)}s`
    )
  );

  if (framePaths.length === 0) {
    console.error(chalk.red('No frames extracted. Check the video file.'));
    process.exit(1);
  }

  // Upload frames if ingest URL provided
  if (opts.ingest) {
    console.log(
      chalk.yellow(`Uploading ${framePaths.length} frames to ${opts.ingest}...`)
    );

    const baseTimestamp = bucketSec();
    let uploaded = 0;
    let errors = 0;

    for (let i = 0; i < framePaths.length; i++) {
      const frameTimestamp = baseTimestamp + i;

      try {
        await uploadFrame(
          opts.ingest,
          {
            store_id: opts.store,
            camera_id: opts.camera,
            bucket_sec: frameTimestamp,
            quality: 'low',
            content_type: 'image/jpeg',
          },
          framePaths[i]
        );
        uploaded++;

        // Progress indicator every 10 frames
        if ((i + 1) % 10 === 0 || i === framePaths.length - 1) {
          console.log(chalk.gray(`  [${i + 1}/${framePaths.length}] uploaded`));
        }
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          chalk.yellow(
            `  [${i + 1}/${framePaths.length}] upload failed: ${msg}`
          )
        );
      }
    }

    console.log(
      chalk.green(
        `Done — extracted: ${framePaths.length}, uploaded: ${uploaded}, errors: ${errors}`
      )
    );
  } else {
    console.log(
      chalk.green(
        `Done — extracted: ${framePaths.length} frames to ${outputDir}/`
      )
    );
    console.log(
      chalk.gray(
        'Tip: Use --ingest <url> to upload frames to the CCTV ingest service'
      )
    );
  }
}
