/** Quality tier for sampled frames */
export type Quality = 'low' | 'high';

/** Core data contract — every upload carries this metadata */
export interface FrameMeta {
  store_id: string;
  camera_id: string;
  bucket_sec: number;
  quality: Quality;
  content_type: string;
}

/** Canonical bucket timestamp: floor(nowMs / 1000) */
export function bucketSec(nowMs?: number): number {
  return Math.floor((nowMs ?? Date.now()) / 1000);
}
