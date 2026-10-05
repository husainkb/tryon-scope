import { authenticate } from "../shopify.server";
import { TryonProduct } from "../models/tryonProduct.server";
import { enableTryon } from "../lib/tryon.server";

// Storefront calls `/apps/tryon/product/:productId` (App Proxy), which Shopify
// forwards here as `/apps/proxy/product/:productId`. No merchant auth required —
// `authenticate.public.appProxy` only verifies the proxy request signature.
export const loader = async ({ request, params }) => {
  const { session, admin } = await authenticate.public.appProxy(request);
  if (!session) {
    return Response.json({ status: "disabled" });
  }

  const productGid = decodeURIComponent(params.productId);
  let doc = await TryonProduct.findOne({
    shop: session.shop,
    productId: productGid,
  }).lean();

  if (!doc) {
    // First time this product's been viewed — process it on the fly instead
    // of requiring a merchant to click "Enable Try-On" in admin first. This
    // returns status "pending"; the widget already polls until it's ready.
    try {
      const created = await enableTryon(session.shop, admin, productGid);
      doc = created.toObject();
    } catch (error) {
      console.error("[tryon] auto-enable failed", error);
      return Response.json({ status: "disabled" });
    }
  }

  // `overlayPath` is a path on this app's own server (e.g. `/tryon/<id>/<file>.png`).
  // The storefront page is on the shop's domain, so a relative path would
  // resolve against the wrong origin — make it absolute against this request.
  const appOrigin = new URL(request.url).origin;

  return Response.json({
    status: doc.status,
    lensWidthMm: doc.lensWidthMm,
    bridgeMm: doc.bridgeMm,
    variants: doc.variants.map((variant) => ({
      variantId: variant.variantId,
      title: variant.title,
      status: variant.status,
      overlayUrl: variant.overlayPath ? `${appOrigin}${variant.overlayPath}` : null,
      width: variant.width,
      height: variant.height,
      anchorX: variant.anchorX,
      anchorY: variant.anchorY,
      lensCenters: variant.lensCenters,
      symmetry: variant.symmetry,
    })),
  });
};
