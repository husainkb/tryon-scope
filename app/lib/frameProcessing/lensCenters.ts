import type { BBox, LensCenters } from './types.js';

export function computeBBox(isBg: Uint8Array, width: number, height: number): BBox | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isBg[y * width + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Fraction down the bbox of its widest row. Used as the anchorY fallback when no lens
 * centres are found: a frame's lens area is normally its widest part, wider than any
 * thinner reflection of it that might be attached below, so the *first* (topmost) widest
 * row reliably lands on the real lens line even when a reflection is present.
 */
export function widestRowFraction(isBg: Uint8Array, width: number, bbox: BBox): number {
  let bestY = bbox.minY;
  let bestCount = -1;
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    let count = 0;
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      if (!isBg[y * width + x]) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestY = y;
    }
  }
  const bboxH = bbox.maxY - bbox.minY + 1;
  return (bestY - bbox.minY) / bboxH;
}

export interface LensPixelResult {
  centers: LensCenters | null;
  mask: Uint8Array;
}

/**
 * Enclosed lens openings, split into left/right halves of the bbox and
 * centroided. An opening is either a hole already known to be transparent in
 * the source (`isHole`, e.g. a pre-cut-out catalog photo) or, for an opaque
 * product photo, a non-background pixel bright enough to be an enclosed light
 * area (lens interior / reflection against a white backdrop). Only the latter
 * need `mask` to force them see-through later — a source-transparent hole is
 * already alpha 0. Valid only if both halves have enough mass and roughly
 * line up.
 */
export function findLensPixelsAndCenters(
  isBg: Uint8Array,
  whitenessArr: Uint8ClampedArray,
  isHole: Uint8Array,
  width: number,
  height: number,
  bbox: BBox,
  lensThreshold = 36
): LensPixelResult {
  const mask = new Uint8Array(width * height);
  const bboxW = bbox.maxX - bbox.minX + 1;
  const bboxH = bbox.maxY - bbox.minY + 1;
  const midX = bbox.minX + bboxW / 2;

  let leftCount = 0;
  let leftSumX = 0;
  let leftSumY = 0;
  let rightCount = 0;
  let rightSumX = 0;
  let rightSumY = 0;

  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      const i = y * width + x;
      const hole = isHole[i] === 1;
      const brightInterior = !isBg[i] && whitenessArr[i] <= lensThreshold;
      if (!hole && !brightInterior) continue;
      if (brightInterior) mask[i] = 1;
      if (x < midX) {
        leftCount++;
        leftSumX += x;
        leftSumY += y;
      } else {
        rightCount++;
        rightSumX += x;
        rightSumY += y;
      }
    }
  }

  const halfArea = (bboxW / 2) * bboxH;
  const minCount = halfArea * 0.04;

  if (leftCount > minCount && rightCount > minCount) {
    const lx = leftSumX / leftCount;
    const ly = leftSumY / leftCount;
    const rx = rightSumX / rightCount;
    const ry = rightSumY / rightCount;
    const avgYFraction = ((ly + ry) / 2 - bbox.minY) / bboxH;
    // Real lens reflections sit in the upper-middle of a front/back glasses photo (observed
    // ~0.5-0.6). A bright spot down near the bottom of the bbox (folded temple tips, a
    // reflection/shadow below the product, a table-surface glint) is not a lens.
    if (Math.abs(ly - ry) < bboxH * 0.12 && avgYFraction >= 0.2 && avgYFraction <= 0.7) {
      return { centers: { lx, ly, rx, ry }, mask };
    }
  }

  return { centers: null, mask };
}
