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
  grid_position: GridPositionSchema.optional(),
});

const StoreConfigSchema = z
  .object({
    store_id: z.string().min(1, 'store_id must not be empty'),
    grid: GridSchema.optional(),
    cameras: z.array(CameraSchema).min(1, 'At least one camera is required'),
  })
  .check(ctx => {
    const { grid, cameras } = ctx.value;
    if (!grid) return;

    const seen = new Set<string>();
    for (const cam of cameras) {
      if (!cam.grid_position) {
        ctx.issues.push({
          message: `Camera "${cam.id}" missing grid_position when grid is defined`,
          path: ['cameras'],
        });
        continue;
      }
      const { row, col } = cam.grid_position;
      if (row >= grid.rows || col >= grid.cols) {
        ctx.issues.push({
          message: `Camera "${cam.id}" grid_position (${row},${col}) out of bounds for ${grid.rows}x${grid.cols} grid`,
          path: ['cameras'],
        });
      }
      const key = `${row},${col}`;
      if (seen.has(key)) {
        ctx.issues.push({
          message: `Duplicate grid_position (${row},${col}) for camera "${cam.id}"`,
          path: ['cameras'],
        });
      }
      seen.add(key);
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
