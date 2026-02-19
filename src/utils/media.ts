import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import process from 'node:process';

type MediaFrameCallback = (type: 'video' | 'audio', base64Data: string) => void;

const JPEG_START_MARKER = Buffer.from([0xff, 0xd8]);
const JPEG_END_MARKER = Buffer.from([0xff, 0xd9]);
const AUDIO_CHUNK_BYTES = 16000 * 2;

function buildVideoInputArgs(
  inputSource: string,
  sourceType: string
): string[] {
  if (sourceType === 'video_file') return ['-re', '-i', inputSource];
  if (process.platform === 'darwin')
    return [
      '-f',
      'avfoundation',
      '-framerate',
      '2',
      '-i',
      `${inputSource}:none`,
    ];
  return ['-f', 'v4l2', '-framerate', '2', '-i', inputSource];
}

function buildAudioInputArgs(
  inputSource: string,
  sourceType: string
): string[] {
  if (sourceType === 'video_file') return ['-re', '-i', inputSource];
  if (process.platform === 'darwin') return ['-f', 'avfoundation', '-i', ':0'];
  return ['-f', 'alsa', '-i', 'default'];
}

function extractJpegFrames(
  buffer: Buffer,
  onFrame: (frame: Buffer) => void
): Buffer {
  let searchOffset = 0;

  while (true) {
    const frameStart = buffer.indexOf(JPEG_START_MARKER, searchOffset);
    if (frameStart === -1) break;

    const frameEnd = buffer.indexOf(JPEG_END_MARKER, frameStart + 2);
    if (frameEnd === -1) break;

    onFrame(buffer.subarray(frameStart, frameEnd + 2));
    searchOffset = frameEnd + 2;
  }

  return searchOffset > 0 ? buffer.subarray(searchOffset) : buffer;
}

function extractAudioChunks(
  buffer: Buffer,
  onChunk: (chunk: Buffer) => void
): Buffer {
  while (buffer.length >= AUDIO_CHUNK_BYTES) {
    onChunk(buffer.subarray(0, AUDIO_CHUNK_BYTES));
    buffer = buffer.subarray(AUDIO_CHUNK_BYTES);
  }
  return buffer;
}

function spawnVideoCapture(
  inputSource: string,
  sourceType: string,
  onFrame: MediaFrameCallback
): ChildProcess {
  const inputArgs = buildVideoInputArgs(inputSource, sourceType);
  const videoProcess = spawn(
    'ffmpeg',
    [
      ...inputArgs,
      '-vf',
      'fps=1,scale=640:-1',
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      '-q:v',
      '5',
      'pipe:1',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );

  let frameBuffer: Buffer = Buffer.alloc(0);

  videoProcess.stdout.on('data', (chunk: Buffer) => {
    frameBuffer = Buffer.concat([frameBuffer, chunk]);
    frameBuffer = extractJpegFrames(frameBuffer, frame => {
      onFrame('video', frame.toString('base64'));
    });
  });

  return videoProcess;
}

function spawnAudioCapture(
  inputSource: string,
  sourceType: string,
  onChunk: MediaFrameCallback
): ChildProcess {
  const inputArgs = buildAudioInputArgs(inputSource, sourceType);
  const audioProcess = spawn(
    'ffmpeg',
    [
      ...inputArgs,
      '-vn',
      '-acodec',
      'pcm_s16le',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-f',
      's16le',
      'pipe:1',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );

  let audioBuffer: Buffer = Buffer.alloc(0);

  audioProcess.stdout.on('data', (chunk: Buffer) => {
    audioBuffer = Buffer.concat([audioBuffer, chunk]);
    audioBuffer = extractAudioChunks(audioBuffer, audioChunk => {
      onChunk('audio', audioChunk.toString('base64'));
    });
  });

  return audioProcess;
}

export function startMediaCapture(
  inputSource: string,
  sourceType: string,
  onMediaData: MediaFrameCallback
): ChildProcess {
  const videoProcess = spawnVideoCapture(inputSource, sourceType, onMediaData);
  const audioProcess = spawnAudioCapture(inputSource, sourceType, onMediaData);

  const originalKill = videoProcess.kill.bind(videoProcess);
  videoProcess.kill = (signal?: NodeJS.Signals | number) => {
    audioProcess.kill(signal as NodeJS.Signals);
    return originalKill(signal as NodeJS.Signals);
  };

  return videoProcess;
}
