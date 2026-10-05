import { useEffect, useRef, useState } from 'react';

export function CameraPanel({ strings, onPhoto }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setReady(true);
      })
      .catch((err) => setError(err.message || 'Could not access the camera'));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    // Mirror the capture so the saved photo matches the on-screen preview.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => onPhoto(img);
    img.src = canvas.toDataURL('image/jpeg', 0.92);
  };

  return (
    <div className="tryon-camera">
      {error ? (
        <div className="tryon-banner tryon-banner--warn">{error}</div>
      ) : (
        <>
          <div className="tryon-camera__stage">
            <video ref={videoRef} className="tryon-camera__video" playsInline muted autoPlay />
            <div className="tryon-camera__guide" aria-hidden="true" />
          </div>
          <p className="tryon-muted">{strings.cameraInstruction}</p>
          <button
            type="button"
            className="tryon-button tryon-button--primary"
            onClick={capture}
            disabled={!ready}
          >
            {strings.captureCta}
          </button>
        </>
      )}
    </div>
  );
}
