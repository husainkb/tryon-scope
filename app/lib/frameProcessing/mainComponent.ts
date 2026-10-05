/**
 * A frame's own silhouette is a single connected shape (the bridge connects both lenses).
 * Product photos on this site often include a faded floor reflection below the frame,
 * separated from it by a thin background gap — that reflection survives background removal
 * as a second, smaller disconnected blob. Keeping only the largest connected foreground
 * component discards it (and any other disconnected debris) without being reflection-specific.
 */
export function keepLargestComponent(isBg: Uint8Array, width: number, height: number): Uint8Array {
  const n = width * height;
  const labels = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  let bestLabel = -1;
  let bestSize = 0;
  let nextLabel = 0;

  for (let start = 0; start < n; start++) {
    if (isBg[start] || labels[start] !== -1) continue;

    const label = nextLabel++;
    let size = 0;
    const queue = [start];
    labels[start] = label;
    let qi = 0;
    while (qi < queue.length) {
      const idx = queue[qi++];
      size++;
      const x = idx % width;
      const y = (idx / width) | 0;
      if (x > 0 && !isBg[idx - 1] && labels[idx - 1] === -1) {
        labels[idx - 1] = label;
        queue.push(idx - 1);
      }
      if (x < width - 1 && !isBg[idx + 1] && labels[idx + 1] === -1) {
        labels[idx + 1] = label;
        queue.push(idx + 1);
      }
      if (y > 0 && !isBg[idx - width] && labels[idx - width] === -1) {
        labels[idx - width] = label;
        queue.push(idx - width);
      }
      if (y < height - 1 && !isBg[idx + width] && labels[idx + width] === -1) {
        labels[idx + width] = label;
        queue.push(idx + width);
      }
    }
    sizes[label] = size;
    if (size > bestSize) {
      bestSize = size;
      bestLabel = label;
    }
  }

  if (bestLabel < 0) return isBg;

  const result = new Uint8Array(n).fill(1);
  for (let i = 0; i < n; i++) {
    if (labels[i] === bestLabel) result[i] = 0;
  }
  return result;
}
