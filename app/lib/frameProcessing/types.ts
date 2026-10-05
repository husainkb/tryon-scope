export interface RawImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface LensCenters {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ProcessedFrame {
  png: Buffer;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  lensCenters: LensCenters | null;
  symmetry: number;
}
