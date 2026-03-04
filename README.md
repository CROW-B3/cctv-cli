# @b3-crow/cctv-cli

CROW CCTV Edge Ingest Gateway CLI — RTSP frame sampling, local spool, and cloud upload.

## Install

```bash
bun install
```

## Commands

### `grab` — Grab a single RTSP frame

```bash
bun run dev -- grab --rtsp "rtsp://localhost:8554/test" --out frame.jpg --timeout 10000
```

| Flag        | Required | Default   | Description             |
| ----------- | -------- | --------- | ----------------------- |
| `--rtsp`    | yes      | —         | RTSP stream URL         |
| `--out`     | no       | `out.jpg` | Output file path        |
| `--timeout` | no       | `10000`   | Timeout in milliseconds |

## Development

```bash
# Build
bun run build

# Lint
bun run lint

# Run unit tests (no ffmpeg/RTSP needed)
bun run test

# Run with integration tests (requires RTSP stream)
RTSP_URL="rtsp://localhost:8554/test" bun run test
```

See [docs/mediamtx-setup.md](docs/mediamtx-setup.md) for setting up a local RTSP test server.

## Requirements

- [Bun](https://bun.sh) (runtime)
- [ffmpeg](https://ffmpeg.org) (RTSP frame grabbing)

## Roadmap

| Phase | Description                                    |
| ----- | ---------------------------------------------- |
| **0** | **Hello camera — single frame grab** (current) |
| 1     | 1 FPS sampler + local spool                    |
| 2     | Local ingest stub                              |
| 3     | Cloudflare ingest MVP (R2+D1)                  |
| 4     | Multi-camera bucketing                         |
| 5     | Composite mosaic                               |
| 6     | ONVIF motion gating                            |
| 7     | Sessionization + analysis trigger              |

## License

MIT
