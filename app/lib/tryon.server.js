import fs from "node:fs/promises";
import path from "node:path";
import { renderFrame } from "./frameProcessing/process";
import { TryonProduct } from "../models/tryonProduct.server";

// Not under public/ — these are served via the tryon-assets route so we can
// set an Access-Control-Allow-Origin header (needed since the storefront
// loads them cross-origin onto a <canvas> with crossOrigin="anonymous").
const STORAGE_DIR = path.join(process.cwd(), "storage", "tryon");

const PRODUCT_QUERY = `#graphql
  query TryonProduct($id: ID!) {
    product(id: $id) {
      id
      handle
      title
      featuredImage { url }
      metafieldLensWidth: metafield(namespace: "tryon", key: "lens_width_mm") {
        value
      }
      metafieldBridge: metafield(namespace: "tryon", key: "bridge_mm") {
        value
      }
      variants(first: 100) {
        nodes {
          id
          title
          image { url }
        }
      }
    }
  }
`;

async function fetchProduct(admin, productGid) {
  const response = await admin.graphql(PRODUCT_QUERY, {
    variables: { id: productGid },
  });
  const json = await response.json();
  return json.data?.product ?? null;
}

/**
 * Fetches a product's variant images via the Admin API and kicks off
 * background-removal/lens-detection processing for each one. Returns
 * immediately once the pending TryonProduct record exists; processing
 * continues asynchronously and updates each variant's status in place.
 */
export async function enableTryon(shop, admin, productGid) {
  const product = await fetchProduct(admin, productGid);
  if (!product) throw new Error("Product not found");

  const variants = product.variants.nodes
    .map((variant) => ({
      variantId: variant.id,
      title: variant.title,
      sourceImageUrl: variant.image?.url || product.featuredImage?.url || null,
      status: "pending",
    }))
    .filter((variant) => variant.sourceImageUrl);

  if (variants.length === 0) {
    throw new Error("This product has no images to process");
  }

  const doc = await TryonProduct.findOneAndUpdate(
    { shop, productId: product.id },
    {
      shop,
      productId: product.id,
      handle: product.handle,
      title: product.title,
      lensWidthMm: product.metafieldLensWidth?.value
        ? Number(product.metafieldLensWidth.value)
        : null,
      bridgeMm: product.metafieldBridge?.value
        ? Number(product.metafieldBridge.value)
        : null,
      status: "pending",
      variants,
    },
    { upsert: true, new: true },
  );

  processVariantsInBackground(doc.id, variants).catch((error) => {
    console.error("[tryon] background processing failed", error);
  });

  return doc;
}

async function processVariantsInBackground(tryonProductId, variants) {
  const dir = path.join(STORAGE_DIR, String(tryonProductId));
  await fs.mkdir(dir, { recursive: true });

  for (const variant of variants) {
    try {
      const imageResponse = await fetch(variant.sourceImageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image (${imageResponse.status})`);
      }
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      const processed = await renderFrame(buffer, true);
      if (!processed) {
        throw new Error("Could not find a frame silhouette in this image");
      }

      // Just the numeric id: the full GID contains slashes, and the
      // tryon-assets route's `$file` param gets URL-decoded by the router
      // before we see it, so an encoded GID there would be re-split into
      // extra path segments instead of staying one filename.
      const variantNumericId = variant.variantId.split("/").pop();
      const fileName = `${variantNumericId}.png`;
      await fs.writeFile(path.join(dir, fileName), processed.png);

      await TryonProduct.updateOne(
        { _id: tryonProductId, "variants.variantId": variant.variantId },
        {
          $set: {
            "variants.$.status": "ready",
            "variants.$.overlayPath": `/tryon-assets/${tryonProductId}/${fileName}`,
            "variants.$.width": processed.width,
            "variants.$.height": processed.height,
            "variants.$.anchorX": processed.anchorX,
            "variants.$.anchorY": processed.anchorY,
            "variants.$.lensCenters": processed.lensCenters,
            "variants.$.symmetry": processed.symmetry,
            "variants.$.error": null,
          },
        },
      );
    } catch (error) {
      await TryonProduct.updateOne(
        { _id: tryonProductId, "variants.variantId": variant.variantId },
        {
          $set: {
            "variants.$.status": "failed",
            "variants.$.error":
              error instanceof Error ? error.message : "Processing failed",
          },
        },
      );
    }
  }

  const doc = await TryonProduct.findById(tryonProductId);
  if (!doc) return;
  const stillPending = doc.variants.some((v) => v.status === "pending");
  if (!stillPending) {
    doc.status = doc.variants.some((v) => v.status === "ready")
      ? "ready"
      : "failed";
    await doc.save();
  }
}
