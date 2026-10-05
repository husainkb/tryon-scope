import type { BBox } from './types.js';

/**
 * Mirror symmetry score: samples the non-background silhouette inside bbox
 * onto a ~gridWidth-wide grid, then computes the IoU between that grid and
 * its horizontal mirror. A perfectly front-on frame scores close to 1.
 */
export function mirrorSymmetryScore(
  isBg: Uint8Array,
  width: number,
  bbox: BBox,
  gridWidth = 160
): number {
  const bboxW = bbox.maxX - bbox.minX + 1;
  const bboxH = bbox.maxY - bbox.minY + 1;
  const gw = Math.max(1, Math.min(gridWidth, bboxW));
  const gh = Math.max(1, Math.round((gw * bboxH) / bboxW));

  const grid = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const srcY = bbox.minY + Math.min(bboxH - 1, Math.floor(((gy + 0.5) / gh) * bboxH));
    for (let gx = 0; gx < gw; gx++) {
      const srcX = bbox.minX + Math.min(bboxW - 1, Math.floor(((gx + 0.5) / gw) * bboxW));
      grid[gy * gw + gx] = isBg[srcY * width + srcX] ? 0 : 1;
    }
  }

  let intersection = 0;
  let union = 0;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const a = grid[gy * gw + gx];
      const b = grid[gy * gw + (gw - 1 - gx)];
      if (a || b) union++;
      if (a && b) intersection++;
    }
  }

  return union === 0 ? 0 : intersection / union;
}
