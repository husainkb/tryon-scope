import sharp from 'sharp';

interface Point {
  x: number;
  y: number;
}

interface EllipseSpec {
  center: Point;
  radiusX: number;
  radiusY: number;
}

const FRAME_RGB: [number, number, number] = [30, 30, 30]; // whiteness ~225, clearly foreground
const LENS_RGB: [number, number, number] = [223, 223, 223]; // whiteness ~32, "enclosed light area"
const RIM_THICKNESS = 20;

function blankCanvas(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }
  return data;
}

function setPixel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  rgb: [number, number, number]
) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const i = (y * width + x) * 4;
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
  data[i + 3] = 255;
}

function drawLensRing(data: Uint8ClampedArray, width: number, height: number, spec: EllipseSpec) {
  const { center, radiusX, radiusY } = spec;
  const innerRx = radiusX - RIM_THICKNESS;
  const innerRy = radiusY - RIM_THICKNESS;
  for (let dy = -radiusY; dy <= radiusY; dy++) {
    for (let dx = -radiusX; dx <= radiusX; dx++) {
      const outer = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
      if (outer > 1) continue;
      const inner = (dx * dx) / (innerRx * innerRx) + (dy * dy) / (innerRy * innerRy);
      const rgb = inner > 1 ? FRAME_RGB : LENS_RGB;
      setPixel(data, width, height, center.x + dx, center.y + dy, rgb);
    }
  }
}

function drawBridge(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  x1: number,
  y: number,
  bridgeHeight: number
) {
  for (let yy = Math.round(y - bridgeHeight / 2); yy <= Math.round(y + bridgeHeight / 2); yy++) {
    for (let xx = Math.round(x0); xx <= Math.round(x1); xx++) {
      setPixel(data, width, height, xx, yy, FRAME_RGB);
    }
  }
}

export interface SyntheticFrame {
  png: Buffer;
  width: number;
  height: number;
  left: EllipseSpec;
  right: EllipseSpec;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

async function toPng(data: Uint8ClampedArray, width: number, height: number): Promise<Buffer> {
  return sharp(Buffer.from(data.buffer, data.byteOffset, data.length), {
    raw: { width, height, channels: 4 }
  })
    .png()
    .toBuffer();
}

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 400;

export async function buildFrontFrame(): Promise<SyntheticFrame> {
  const data = blankCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const left: EllipseSpec = { center: { x: 360, y: 200 }, radiusX: 140, radiusY: 110 };
  const right: EllipseSpec = { center: { x: 920, y: 200 }, radiusX: 140, radiusY: 110 };

  drawLensRing(data, CANVAS_WIDTH, CANVAS_HEIGHT, left);
  drawLensRing(data, CANVAS_WIDTH, CANVAS_HEIGHT, right);
  drawBridge(
    data,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    left.center.x + left.radiusX - RIM_THICKNESS,
    right.center.x - right.radiusX + RIM_THICKNESS,
    200,
    30
  );

  const bbox = {
    minX: left.center.x - left.radiusX,
    maxX: right.center.x + right.radiusX,
    minY: Math.min(left.center.y - left.radiusY, right.center.y - right.radiusY),
    maxY: Math.max(left.center.y + left.radiusY, right.center.y + right.radiusY)
  };

  return {
    png: await toPng(data, CANVAS_WIDTH, CANVAS_HEIGHT),
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    left,
    right,
    bbox
  };
}

export async function buildAngledFrame(): Promise<SyntheticFrame> {
  const data = blankCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const left: EllipseSpec = { center: { x: 360, y: 200 }, radiusX: 140, radiusY: 110 };
  // Right lens shrunk and shifted, as if the frame were turned/angled away from camera.
  const right: EllipseSpec = { center: { x: 900, y: 230 }, radiusX: 95, radiusY: 70 };

  drawLensRing(data, CANVAS_WIDTH, CANVAS_HEIGHT, left);
  drawLensRing(data, CANVAS_WIDTH, CANVAS_HEIGHT, right);
  drawBridge(
    data,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    left.center.x + left.radiusX - RIM_THICKNESS,
    right.center.x - right.radiusX + RIM_THICKNESS,
    210,
    30
  );

  const bbox = {
    minX: left.center.x - left.radiusX,
    maxX: right.center.x + right.radiusX,
    minY: Math.min(left.center.y - left.radiusY, right.center.y - right.radiusY),
    maxY: Math.max(left.center.y + left.radiusY, right.center.y + right.radiusY)
  };

  return {
    png: await toPng(data, CANVAS_WIDTH, CANVAS_HEIGHT),
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    left,
    right,
    bbox
  };
}
