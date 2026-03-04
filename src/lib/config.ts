import { readFile } from 'node:fs/promises';

import { parse as parseYaml } from 'yaml';
import { z } from 'zod/v4';

const GridPositionSchema = z.object({
  row: z.number().int().min(0),
  col: z.number().int().min(0),
});

const GridSchema = z.object({
  rows: z.number().int().min(1),
  cols: z.number().int().min(1),
});

const CameraSchema = z.object({
  id: z.string().min(1, 'Camera id must not be empty'),
  rtsp: z.string().min(1, 'Camera rtsp URL must not be empty'),
  onvif_url: z.string().optional(),
  grid_position: GridPositionSchema.optional(),
});

const MotionConfigSchema = z.object({
  enabled: z.boolean(),
  ttl_seconds: z.number().min(0.1).max(30).default(2),
});

const BaseStoreConfigSchema = z.object({
  store_id: z.string().min(1, 'store_id must not be empty'),
  motion: MotionConfigSchema.optional(),
  grid: GridSchema.optional(),
  cameras: z.array(CameraSchema).min(1, 'At least one camera is required'),
});

function validateGrid(
  val: z.infer<typeof BaseStoreConfigSchema>
): string | null {
  const { grid, cameras } = val;
  if (!grid) return null;

  const seen = new Set<string>();
  for (const cam of cameras) {
    if (!cam.grid_position) {
      return `Camera "${cam.id}" missing grid_position when grid is defined`;
    }
    const { row, col } = cam.grid_position;
    if (row >= grid.rows || col >= grid.cols) {
      return `Camera "${cam.id}" grid_position (${row},${col}) out of bounds for ${grid.rows}x${grid.cols} grid`;
    }
    const key = `${row},${col}`;
    if (seen.has(key)) {
      return `Duplicate grid_position (${row},${col}) for camera "${cam.id}"`;
    }
    seen.add(key);
  }
  return null;
}

const StoreConfigSchema = BaseStoreConfigSchema.superRefine((val, ctx) => {
  const err = validateGrid(val);
  if (err) {
    ctx.addIssue({ code: 'custom', message: err, path: ['cameras'] });
  }
});

export type GridPosition = z.infer<typeof GridPositionSchema>;
export type Grid = z.infer<typeof GridSchema>;
export type CameraEntry = z.infer<typeof CameraSchema>;
export type StoreConfig = z.infer<typeof StoreConfigSchema>;

export async function loadStoreConfig(
  configPath: string
): Promise<StoreConfig> {
  const raw = await readFile(configPath, 'utf-8');
  const parsed = parseYaml(raw);
  return StoreConfigSchema.parse(parsed);
}
