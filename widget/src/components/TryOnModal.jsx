import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UploadPanel } from './UploadPanel.jsx';
import { CameraPanel } from './CameraPanel.jsx';
import { TryOnCanvas } from './TryOnCanvas.jsx';
import { cameraAvailable } from '../lib/device.js';

export function TryOnModal({ product, strings, onClose }) {
  const readyVariants = useMemo(
    () => product.variants.filter((v) => v.status === 'ready'),
    [product.variants],
  );
  const [selectedVariantId, setSelectedVariantId] = useState(readyVariants[0]?.variantId ?? null);
  const [mode, setMode] = useState('upload');
  const [photo, setPhoto] = useState(null);
  const [scale, setScale] = useState(1);
  const [heightOffsetMm, setHeightOffsetMm] = useState(0);
  const canvasRef = useRef(null);
  const showCamera = useMemo(() => cameraAvailable(), []);

  const selectedVariant = readyVariants.find((v) => v.variantId === selectedVariantId) ?? null;

  const save = () => {
    const dataUrl = canvasRef.current?.toDataURL('image/jpeg', 0.92);
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = 'try-on.jpg';
    link.href = dataUrl;
    link.click();
  };

  const modal = (
    <div className="tryon-overlay" onClick={onClose}>
      <div className="tryon-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tryon-modal__header">
          <h2>{strings.title}</h2>
          <button type="button" className="tryon-icon-button" onClick={onClose} aria-label={strings.close}>
            ×
          </button>
        </div>

        <div className="tryon-modal__body">
          {product.status === 'pending' && <p className="tryon-muted">{strings.loading}</p>}
          {product.status === 'failed' && readyVariants.length === 0 && (
            <p className="tryon-muted">{strings.disabled}</p>
          )}

          {readyVariants.length > 0 && (
            <>
              {!photo && (
                <>
                  <div className="tryon-tabs">
                    <button
                      type="button"
                      className={`tryon-tab${mode === 'upload' ? ' tryon-tab--active' : ''}`}
                      onClick={() => setMode('upload')}
                    >
                      {strings.uploadTab}
                    </button>
                    {showCamera && (
                      <button
                        type="button"
                        className={`tryon-tab${mode === 'camera' ? ' tryon-tab--active' : ''}`}
                        onClick={() => setMode('camera')}
                      >
                        {strings.cameraTab}
                      </button>
                    )}
                  </div>
                  {mode === 'upload' || !showCamera ? (
                    <UploadPanel strings={strings} onPhoto={setPhoto} />
                  ) : (
                    <CameraPanel strings={strings} onPhoto={setPhoto} />
                  )}
                </>
              )}

              {photo && (
                <>
                  <TryOnCanvas
                    ref={canvasRef}
                    photo={photo}
                    variant={selectedVariant}
                    lensWidthMm={product.lensWidthMm}
                    bridgeMm={product.bridgeMm}
                    scale={scale}
                    heightOffsetMm={heightOffsetMm}
                    strings={strings}
                  />

                  <div className="tryon-controls">
                    <label>
                      Scale
                      <input
                        type="range"
                        min="0.8"
                        max="1.2"
                        step="0.01"
                        value={scale}
                        onChange={(e) => setScale(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      Height
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.5"
                        value={heightOffsetMm}
                        onChange={(e) => setHeightOffsetMm(Number(e.target.value))}
                      />
                    </label>
                  </div>

                  <div className="tryon-actions">
                    <button type="button" className="tryon-button" onClick={() => setPhoto(null)}>
                      {strings.retakeCta}
                    </button>
                    <button type="button" className="tryon-button tryon-button--primary" onClick={save}>
                      {strings.saveCta}
                    </button>
                  </div>
                </>
              )}

              <div className="tryon-swatches">
                {readyVariants.map((variant) => (
                  <button
                    key={variant.variantId}
                    type="button"
                    className={`tryon-swatch${variant.variantId === selectedVariantId ? ' tryon-swatch--selected' : ''}`}
                    onClick={() => setSelectedVariantId(variant.variantId)}
                    title={variant.title}
                  >
                    <img src={variant.overlayUrl} alt={variant.title} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
