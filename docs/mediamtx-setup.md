# Local RTSP Test Server (MediaMTX)

Use [MediaMTX](https://github.com/bluenviron/mediamtx) to run a local RTSP server for development and testing.

## Quick Start

### 1. Start MediaMTX

```bash
docker run --rm -p 8554:8554 bluenviron/mediamtx:latest
```

### 2. Push a test pattern

In a separate terminal, generate a test video stream:

```bash
ffmpeg -re -f lavfi -i testsrc=size=640x480:rate=1 -c:v libx264 -f rtsp rtsp://localhost:8554/test
```

### 3. Test the grab command

```bash
bun run dev -- grab --rtsp "rtsp://localhost:8554/test"
# → Frame saved to out.jpg (Xms)
```

### 4. Run the integration test

```bash
RTSP_URL="rtsp://localhost:8554/test" bun run test
```

## Requirements

- Docker (for MediaMTX)
- ffmpeg (for the test pattern generator and the grab command)
