import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { computeFit, computeHeadTurnRatio, DEFAULT_BRIDGE_MM, DEFAULT_LENS_WIDTH_MM } from '../lib/fit.js';
import { detectFace } from '../lib/faceLandmarker.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Detects a face in `photo` and composites `variant`'s overlay image onto it,
 * scaled/rotated/positioned from the detected pupils. Exposes `toDataURL()`
 * via ref for "save photo".
 */
export const TryOnCanvas = forwardRef(function TryOnCanvas(
  { photo, variant, lensWidthMm, bridgeMm, scale, heightOffsetMm, strings },
  ref,
) {
  const canvasRef = useRef(null);
  const [overlayImg, setOverlayImg] = useState(null);
  const [overlayError, setOverlayError] = useState(false);
  const [faceResult, setFaceResult] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);

  useImperativeHandle(ref, () => ({
    toDataURL: (type, quality) => canvasRef.current?.toDataURL(type, quality),
  }));

  useEffect(() => {
    if (!photo) {
      setFaceResult(null);
      return;
    }
    let cancelled = false;
    setIsDetecting(true);
    detectFace(photo, photo.naturalWidth, photo.naturalHeight)
      .then((result) => {
        if (!cancelled) setFaceResult(result);
      })
      .finally(() => {
        if (!cancelled) setIsDetecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [photo]);

  useEffect(() => {
    setOverlayError(false);
    if (!variant?.overlayUrl) {
      setOverlayImg(null);
      return;
    }
    let cancelled = false;
    loadImage(variant.overlayUrl)
      .then((img) => {
        if (!cancelled) setOverlayImg(img);
      })
      .catch(() => {
        if (!cancelled) {
          setOverlayImg(null);
          setOverlayError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [variant?.overlayUrl]);

  const face = faceResult?.status === 'ok' ? faceResult.geometry : null;
  const headTurnRatio = face ? computeHeadTurnRatio(face) : null;

  const fit =
    face && variant && overlayImg
      ? computeFit({
          face,
          lensWidthMm: lensWidthMm ?? DEFAULT_LENS_WIDTH_MM,
          bridgeMm: bridgeMm ?? DEFAULT_BRIDGE_MM,
          lensCenters: variant.lensCenters,
          overlayWidthPx: variant.width ?? overlayImg.naturalWidth,
          overlayHeightPx: variant.height ?? overlayImg.naturalHeight,
          userScale: scale,
          heightOffsetMm,
        })
      : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = photo.naturalWidth;
    canvas.height = photo.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);

    if (fit && overlayImg && variant) {
      ctx.save();
      ctx.translate(fit.center.x, fit.center.y);
      ctx.rotate(fit.angleRad);
      // No drop shadow here: canvas shadows are driven by the source image's
      // alpha channel, and the overlay's near-transparent lens interior
      // (alpha ~14/255, intentionally faint "glass") still casts a blurred
      // shadow — bleeding a dark wash across the whole lens area instead of
      // the thin rim-only shadow this was meant to add.
      ctx.drawImage(
        overlayImg,
        -variant.anchorX * fit.drawWidthPx,
        -variant.anchorY * fit.drawHeightPx,
        fit.drawWidthPx,
        fit.drawHeightPx,
      );
      ctx.restore();
    }
  }, [photo, fit, overlayImg, variant]);

  return (
    <div className="tryon-canvas-wrap">
      <canvas ref={canvasRef} className="tryon-canvas" />
      {photo && isDetecting && <div className="tryon-banner">{strings.loading}</div>}
      {photo && faceResult?.status === 'no-face' && (
        <div className="tryon-banner tryon-banner--warn">{strings.noFace}</div>
      )}
      {photo && overlayError && (
        <div className="tryon-banner tryon-banner--warn">{strings.overlayError}</div>
      )}
      {photo && headTurnRatio !== null && headTurnRatio > 1.5 && (
        <div className="tryon-banner tryon-banner--warn">{strings.cameraInstruction}</div>
      )}
    </div>
  );
});
