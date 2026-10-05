import type { RawImage } from './types.js';

export function whiteness(r: number, g: number, b: number): number {
  return 255 - Math.min(r, g, b);
}

export interface BackgroundResult {
  isBg: Uint8Array;
  /**
   * Background pixels enclosed by the frame (e.g. the lens opening of a photo that
   * was already cut out to transparency) rather than reached from the image border.
   * A subset of `isBg`, surfaced separately so lens-centre detection can still find
   * these holes even though they're already background.
   */
  isHole: Uint8Array;
  alpha: Uint8ClampedArray;
  whiteness: Uint8ClampedArray;
}

/**
 * Flood-fills from every border pixel through pixels that are already background:
 * either whiteness at or below `bgThreshold` (a plain white product-photo backdrop),
 * or source alpha at or below `holeAlphaThreshold` (a photo that was already cut out
 * to transparency, e.g. a "remove background" catalog export). Non-background pixels
 * that touch the background get a feathered alpha over `featherRange` of whiteness so
 * the cut-out edge isn't a hard line; that alpha is then capped by the source alpha so
 * pre-existing transparency is never widened back out to opaque.
 *
 * Source-transparent pixels that the border flood fill can't reach (enclosed by an
 * opaque frame rim, e.g. a lens opening) are marked background in a second pass and
 * reported via `isHole`, since they're invisible from the border but are still
 * definitely not part of the frame.
 */
export function removeBackground(
  img: RawImage,
  bgThreshold = 28,
  featherRange = 42,
  holeAlphaThreshold = 16
): BackgroundResult {
  const { width, height, data } = img;
  const n = width * height;

  const whitenessArr = new Uint8ClampedArray(n);
  const sourceAlpha = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    whitenessArr[i] = whiteness(data[o], data[o + 1], data[o + 2]);
    sourceAlpha[i] = data[o + 3];
  }

  const isBg = new Uint8Array(n);
  const visited = new Uint8Array(n);
  const queue: number[] = [];
  for (let x = 0; x < width; x++) {
    queue.push(x);
    queue.push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    queue.push(y * width);
    queue.push(y * width + width - 1);
  }

  let qi = 0;
  while (qi < queue.length) {
    const idx = queue[qi++];
    if (visited[idx]) continue;
    visited[idx] = 1;
    if (whitenessArr[idx] > bgThreshold && sourceAlpha[idx] > holeAlphaThreshold) continue;
    isBg[idx] = 1;

    const x = idx % width;
    const y = (idx / width) | 0;
    if (x > 0) queue.push(idx - 1);
    if (x < width - 1) queue.push(idx + 1);
    if (y > 0) queue.push(idx - width);
    if (y < height - 1) queue.push(idx + width);
  }

  const isHole = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!isBg[i] && sourceAlpha[i] <= holeAlphaThreshold) {
      isBg[i] = 1;
      isHole[i] = 1;
    }
  }

  const alpha = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    if (isBg[i]) {
      alpha[i] = 0;
      continue;
    }
    const x = i % width;
    const y = (i / width) | 0;
    const touchesBg =
      (x > 0 && isBg[i - 1] === 1) ||
      (x < width - 1 && isBg[i + 1] === 1) ||
      (y > 0 && isBg[i - width] === 1) ||
      (y < height - 1 && isBg[i + width] === 1);

    let a: number;
    if (touchesBg) {
      a = ((whitenessArr[i] - bgThreshold) * 255) / featherRange;
      a = Math.max(0, Math.min(255, a));
    } else {
      a = 255;
    }
    alpha[i] = Math.min(a, sourceAlpha[i]);
  }

  return { isBg, isHole, alpha, whiteness: whitenessArr };
}
