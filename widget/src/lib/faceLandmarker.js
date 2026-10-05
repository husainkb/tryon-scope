import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const LM = {
  leftPupil: 468,
  leftIrisA: 469,
  leftIrisB: 471,
  rightPupil: 473,
  rightIrisA: 474,
  rightIrisB: 476,
  nose: 1,
  leftCheek: 234,
  rightCheek: 454,
};

let landmarkerPromise = null;

async function createLandmarker(delegate) {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'IMAGE',
    numFaces: 1,
  });
}

/** Lazily creates the landmarker once, preferring GPU and falling back to CPU. */
export function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker('GPU').catch(async (err) => {
      console.warn('[faceLandmarker] GPU delegate unavailable, falling back to CPU', err);
      return createLandmarker('CPU');
    });
  }
  return landmarkerPromise;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Detects a single face in a still image (an uploaded photo, or a frame
 * captured from the camera). Returns `{status:'ok', geometry}`,
 * `{status:'no-face'}`, or `{status:'error', message}`.
 */
export async function detectFace(image, width, height) {
  let landmarker;
  try {
    landmarker = await getLandmarker();
  } catch {
    return { status: 'error', message: 'The face-detection model failed to load.' };
  }

  try {
    const result = landmarker.detect(image);
    const landmarks = result.faceLandmarks?.[0];
    if (!landmarks) return { status: 'no-face' };

    const toPx = (idx) => ({ x: landmarks[idx].x * width, y: landmarks[idx].y * height });

    const geometry = {
      leftPupil: toPx(LM.leftPupil),
      rightPupil: toPx(LM.rightPupil),
      leftIrisDiameterPx: dist(toPx(LM.leftIrisA), toPx(LM.leftIrisB)),
      rightIrisDiameterPx: dist(toPx(LM.rightIrisA), toPx(LM.rightIrisB)),
      nose: toPx(LM.nose),
      leftCheek: toPx(LM.leftCheek),
      rightCheek: toPx(LM.rightCheek),
    };

    return { status: 'ok', geometry };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Face detection failed.' };
  }
}
