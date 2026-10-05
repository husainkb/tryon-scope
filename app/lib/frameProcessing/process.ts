import sharp from 'sharp';
import { removeBackground } from './floodFill.js';
import { computeBBox, findLensPixelsAndCenters, widestRowFraction } from './lensCenters.js';
import { keepLargestComponent } from './mainComponent.js';
import { mirrorSymmetryScore } from './symmetry.js';
import type { BBox, LensCenters, ProcessedFrame, RawImage } from './types.js';

async function toRaw(buffer: Buffer, targetWidth: number): Promise<RawImage> {
  const { data, info } = await sharp(buffer)
    .resize({ width: targetWidth })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
    width: info.width,
    height: info.height
  };
}

interface Analysis {
  bbox: BBox;
  centers: LensCenters | null;
  mask: Uint8Array;
  alpha: Uint8ClampedArray;
  isBg: Uint8Array;
  symmetry: number;
  score: number;
  fallbackAnchorY: number;
}

function analyze(raw: RawImage): Analysis | null {
  const bg = removeBackground(raw);
  // Restrict to the frame's own silhouette, discarding any disconnected blob (most commonly
  // a faded reflection below the product) that survived background removal.
  const isBg = keepLargestComponent(bg.isBg, raw.width, raw.height);
  const bbox = computeBBox(isBg, raw.width, raw.height);
  if (!bbox) return null;

  const { centers, mask } = findLensPixelsAndCenters(
    isBg,
    bg.whiteness,
    bg.isHole,
    raw.width,
    raw.height,
    bbox
  );
  const symmetry = mirrorSymmetryScore(isBg, raw.width, bbox);

  const bboxW = bbox.maxX - bbox.minX + 1;
  const bboxH = bbox.maxY - bbox.minY + 1;
  const aspect = bboxW / bboxH;
  const aspectFactor = aspect >= 1.8 && aspect <= 4.2 ? 1 : 0.3;
  const lensFactor = centers ? 1.08 : 1;
  const score = symmetry * aspectFactor * lensFactor;

  return {
    bbox,
    centers,
    mask,
    alpha: bg.alpha,
    isBg,
    symmetry,
    score,
    fallbackAnchorY: widestRowFraction(isBg, raw.width, bbox)
  };
}

export async function scoreCandidate(buffer: Buffer): Promise<number> {
  const raw = await toRaw(buffer, 400);
  return analyze(raw)?.score ?? -1;
}

export async function pickBestFrontView(buffers: Buffer[]): Promise<number> {
  const scores = await Promise.all(buffers.map((b) => scoreCandidate(b).catch(() => -1)));
  let bestIndex = 0;
  let bestScore = -Infinity;
  scores.forEach((s, i) => {
    if (s > bestScore) {
      bestScore = s;
      bestIndex = i;
    }
  });
  return bestIndex;
}

export async function renderFrame(
  buffer: Buffer,
  isEyeglasses: boolean
): Promise<ProcessedFrame | null> {
  const raw = await toRaw(buffer, 1280);
  const result = analyze(raw);
  if (!result) return null;

  const { bbox, centers, mask, alpha, isBg, symmetry, fallbackAnchorY } = result;
  const { width, data } = raw;

  for (let i = 0; i < alpha.length; i++) {
    data[i * 4 + 3] = isBg[i] ? 0 : alpha[i];
  }
  if (isEyeglasses && centers) {
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) data[i * 4 + 3] = 14;
    }
  }

  const cropW = bbox.maxX - bbox.minX + 1;
  const cropH = bbox.maxY - bbox.minY + 1;
  const source = Buffer.from(data.buffer, data.byteOffset, data.length);
  const cropped = Buffer.alloc(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    const srcStart = ((bbox.minY + y) * width + bbox.minX) * 4;
    source.copy(cropped, y * cropW * 4, srcStart, srcStart + cropW * 4);
  }

  const relCenters: LensCenters | null = centers
    ? {
        lx: centers.lx - bbox.minX,
        ly: centers.ly - bbox.minY,
        rx: centers.rx - bbox.minX,
        ry: centers.ry - bbox.minY
      }
    : null;

  const anchorX = relCenters ? (relCenters.lx + relCenters.rx) / 2 / cropW : 0.5;
  const anchorY = relCenters ? (relCenters.ly + relCenters.ry) / 2 / cropH - 0.04 : fallbackAnchorY;

  const png = await sharp(cropped, { raw: { width: cropW, height: cropH, channels: 4 } })
    .png()
    .toBuffer();

  return { png, width: cropW, height: cropH, anchorX, anchorY, lensCenters: relCenters, symmetry };
}
