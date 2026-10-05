const ASSUMED_PD_MM = 63;
const IRIS_DIAMETER_MM = 11.7;
const PD_PLAUSIBLE_MIN = 52;
const PD_PLAUSIBLE_MAX = 74;
const USER_PD_MIN = 45;
const USER_PD_MAX = 80;

function eyeDistancePx(face) {
  const dx = face.rightPupil.x - face.leftPupil.x;
  const dy = face.rightPupil.y - face.leftPupil.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function computePxPerMm(face, userPdMm) {
  const eyeDist = eyeDistancePx(face);

  if (userPdMm !== undefined && userPdMm !== null && userPdMm >= USER_PD_MIN && userPdMm <= USER_PD_MAX) {
    return eyeDist / userPdMm;
  }

  const meanIrisPx = (face.leftIrisDiameterPx + face.rightIrisDiameterPx) / 2;
  const irisPxPerMm = meanIrisPx / IRIS_DIAMETER_MM;
  const impliedPdMm = eyeDist / irisPxPerMm;

  if (impliedPdMm < PD_PLAUSIBLE_MIN || impliedPdMm > PD_PLAUSIBLE_MAX) {
    return eyeDist / ASSUMED_PD_MM;
  }
  return irisPxPerMm;
}

/**
 * @param {object} inputs
 * @param {object} inputs.face - FaceGeometry from detectFace
 * @param {number} inputs.lensWidthMm
 * @param {number} inputs.bridgeMm
 * @param {{lx:number,ly:number,rx:number,ry:number}|null} inputs.lensCenters
 * @param {number} inputs.overlayWidthPx
 * @param {number} inputs.overlayHeightPx
 * @param {number} inputs.userScale
 * @param {number} inputs.heightOffsetMm
 * @param {number|null} [inputs.userPdMm]
 */
export function computeFit(inputs) {
  const { face } = inputs;
  const dx = face.rightPupil.x - face.leftPupil.x;
  const dy = face.rightPupil.y - face.leftPupil.y;
  const angleRad = Math.atan2(dy, dx);

  const pxPerMm = computePxPerMm(face, inputs.userPdMm);
  const pdMm = eyeDistancePx(face) / pxPerMm;

  const center = {
    x: (face.leftPupil.x + face.rightPupil.x) / 2,
    y: (face.leftPupil.y + face.rightPupil.y) / 2 + inputs.heightOffsetMm * pxPerMm,
  };

  const lensCenterDistancePx = inputs.lensCenters
    ? Math.hypot(inputs.lensCenters.rx - inputs.lensCenters.lx, inputs.lensCenters.ry - inputs.lensCenters.ly)
    : null;

  const mmPerOverlayPx = lensCenterDistancePx
    ? (inputs.lensWidthMm + inputs.bridgeMm) / lensCenterDistancePx
    : (2 * inputs.lensWidthMm + inputs.bridgeMm + 10) / inputs.overlayWidthPx;

  const scalePxPerOverlayPx = mmPerOverlayPx * pxPerMm * inputs.userScale;

  return {
    pxPerMm,
    pdMm,
    angleRad,
    tiltDeg: (angleRad * 180) / Math.PI,
    center,
    mmPerOverlayPx,
    drawWidthPx: inputs.overlayWidthPx * scalePxPerOverlayPx,
    drawHeightPx: inputs.overlayHeightPx * scalePxPerOverlayPx,
  };
}

/** Nose-to-cheek distance ratio; used to warn when the head is turned too far for a reliable fit. */
export function computeHeadTurnRatio(face) {
  const leftDist = Math.hypot(face.nose.x - face.leftCheek.x, face.nose.y - face.leftCheek.y);
  const rightDist = Math.hypot(face.nose.x - face.rightCheek.x, face.nose.y - face.rightCheek.y);
  const [smaller, larger] = leftDist < rightDist ? [leftDist, rightDist] : [rightDist, leftDist];
  return smaller === 0 ? Infinity : larger / smaller;
}

export const DEFAULT_LENS_WIDTH_MM = 52;
export const DEFAULT_BRIDGE_MM = 18;
