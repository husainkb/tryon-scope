import { describe, expect, it } from 'vitest';
import { renderFrame, scoreCandidate } from '../app/lib/frameProcessing/process.js';
import { buildAngledFrame, buildFrontFrame } from './fixtures/makeFrame.js';

describe('frame processing', () => {
  it('scores a symmetric front-view frame higher than an asymmetric angled one', async () => {
    const front = await buildFrontFrame();
    const angled = await buildAngledFrame();

    const frontScore = await scoreCandidate(front.png);
    const angledScore = await scoreCandidate(angled.png);

    expect(frontScore).toBeGreaterThan(angledScore);
  });

  it('finds lens centers within 2px of the known synthetic centers', async () => {
    const front = await buildFrontFrame();
    const rendered = await renderFrame(front.png, true);

    expect(rendered).not.toBeNull();
    expect(rendered!.lensCenters).not.toBeNull();

    const expectedLeft = {
      x: front.left.center.x - front.bbox.minX,
      y: front.left.center.y - front.bbox.minY
    };
    const expectedRight = {
      x: front.right.center.x - front.bbox.minX,
      y: front.right.center.y - front.bbox.minY
    };

    const { lx, ly, rx, ry } = rendered!.lensCenters!;
    expect(Math.abs(lx - expectedLeft.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(ly - expectedLeft.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(rx - expectedRight.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(ry - expectedRight.y)).toBeLessThanOrEqual(2);
  });

  it('makes eyeglass lenses see-through (alpha 14) when lens centers are found', async () => {
    const front = await buildFrontFrame();
    const rendered = await renderFrame(front.png, true);
    expect(rendered).not.toBeNull();

    const { data, info } = await (await import('sharp'))
      .default(rendered!.png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { lensCenters } = rendered!;
    const x = Math.round(lensCenters!.lx);
    const y = Math.round(lensCenters!.ly);
    const idx = (y * info.width + x) * 4;
    expect(data[idx + 3]).toBe(14);
  });
});
