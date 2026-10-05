/** Only offer the live-camera option on touch/small-viewport devices (tablet/mobile). */
export function cameraAvailable() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}
