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

### `sample` — Continuously sample RTSP frames to local spool

Runs a drift-free sampling loop that grabs frames at the configured FPS and writes them to a local spool directory with deterministic `bucket_sec`-based filenames. Ctrl+C for graceful shutdown with stats summary.

```bash
bun run dev -- sample --store mystore --camera cam1 --rtsp "rtsp://localhost:8554/test"
```

| Flag        | Required | Default   | Description                      |
| ----------- | -------- | --------- | -------------------------------- |
| `--store`   | yes      | —         | Store identifier                 |
| `--camera`  | yes      | —         | Camera identifier                |
| `--rtsp`    | yes      | —         | RTSP stream URL                  |
| `--spool`   | no       | `./spool` | Spool directory root             |
| `--fps`     | no       | `1`       | Frames per second (0 < fps ≤ 30) |
| `--timeout` | no       | `10000`   | Per-grab timeout in milliseconds |

Output path: `<spool>/<store>/<camera>/<bucket_sec>_low.jpg`

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

| Phase | Description                               |
| ----- | ----------------------------------------- |
| **0** | ~~Hello camera — single frame grab~~      |
| **1** | **1 FPS sampler + local spool** (current) |
| 2     | Local ingest stub                         |
| 3     | Cloudflare ingest MVP (R2+D1)             |
| 4     | Multi-camera bucketing                    |
| 5     | Composite mosaic                          |
| 6     | ONVIF motion gating                       |
| 7     | Sessionization + analysis trigger         |

## License

MIT
