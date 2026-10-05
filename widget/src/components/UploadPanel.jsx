import { useCallback } from 'react';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function UploadPanel({ strings, onPhoto }) {
  const onFiles = useCallback(
    async (files) => {
      const file = files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        onPhoto(img);
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
    [onPhoto],
  );

  return (
    <div
      className="tryon-dropzone"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFiles(e.dataTransfer.files);
      }}
    >
      <label className="tryon-upload-button">
        {strings.uploadCta}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onFiles(e.target.files)}
          style={{ display: 'none' }}
        />
      </label>
      <span className="tryon-muted">{strings.uploadHint}</span>
    </div>
  );
}
