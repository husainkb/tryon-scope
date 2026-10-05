import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { TryOnLauncher } from './components/TryOnLauncher.jsx';

// Shopify wraps `{% render %}` output inside app blocks with
// `<!-- BEGIN app snippet --> ... <!-- END app snippet -->` comments, so the
// data-island script tags can't be parsed as JSON as-is.
function parseJsonIsland(script) {
  return JSON.parse(script.textContent.replace(/<!--[\s\S]*?-->/g, ''));
}

function mount(root) {
  const productScript = root.querySelector('[data-tryon-product]');
  const stringsScript = root.querySelector('[data-tryon-strings]');
  if (!productScript) return;

  let product;
  let strings;
  try {
    product = parseJsonIsland(productScript);
    strings = stringsScript ? parseJsonIsland(stringsScript) : {};
  } catch (err) {
    console.error('[tryon] invalid data island', err);
    return;
  }

  const proxyBase = root.dataset.proxyBase || '/apps/tryon';
  const label = root.dataset.label || 'Try it on';

  createRoot(root).render(
    <StrictMode>
      <TryOnLauncher
        productId={product.productId}
        proxyBase={proxyBase}
        label={label}
        strings={strings}
      />
    </StrictMode>,
  );
}

document.querySelectorAll('[data-tryon-root]').forEach(mount);
