import { readFile } from 'node:fs/promises';

import { parse as parseYaml } from 'yaml';
import { z } from 'zod/v4';

const CameraSchema = z.object({
  id: z.string().min(1, 'Camera id must not be empty'),
  rtsp: z.string().min(1, 'Camera rtsp URL must not be empty'),
});

const StoreConfigSchema = z.object({
  store_id: z.string().min(1, 'store_id must not be empty'),
  cameras: z.array(CameraSchema).min(1, 'At least one camera is required'),
});

export type CameraEntry = z.infer<typeof CameraSchema>;
export type StoreConfig = z.infer<typeof StoreConfigSchema>;

export async function loadStoreConfig(path: string): Promise<StoreConfig> {
  const raw = await readFile(path, 'utf-8');
  const parsed = parseYaml(raw);
  return StoreConfigSchema.parse(parsed);
}
