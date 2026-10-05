import { useEffect, useRef, useState } from 'react';
import { TryOnModal } from './TryOnModal.jsx';

export function TryOnLauncher({ productId, proxyBase, label, strings }) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState(null);
  const pollRef = useRef(null);

  const fetchProduct = async () => {
    try {
      const res = await fetch(`${proxyBase}/product/${encodeURIComponent(productId)}`);
      const data = await res.json();
      setProduct(data);
    } catch {
      // transient — a later poll (while the modal is open) will retry
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open || product?.status !== 'pending') return;
    pollRef.current = setInterval(fetchProduct, 3000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.status]);

  if (product?.status === 'disabled') return null;

  return (
    <>
      <button
        type="button"
        className="tryon-button tryon-button--primary tryon-launcher__button"
        onClick={() => setOpen(true)}
        disabled={!product}
      >
        {label}
      </button>
      {open && product && (
        <TryOnModal product={product} strings={strings} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
