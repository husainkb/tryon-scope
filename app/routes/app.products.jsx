/* eslint-disable react/prop-types -- internal admin components, not a published library */
import { useEffect, useState } from "react";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { TryonProduct } from "../models/tryonProduct.server";
import { enableTryon } from "../lib/tryon.server";

const PRODUCTS_QUERY = `#graphql
  query TryonProductsList {
    products(first: 50, sortKey: TITLE) {
      nodes {
        id
        title
        handle
        featuredImage { url }
        lensWidth: metafield(namespace: "tryon", key: "lens_width_mm") { value }
        bridge: metafield(namespace: "tryon", key: "bridge_mm") { value }
      }
    }
  }
`;

const SET_METAFIELDS_MUTATION = `#graphql
  mutation SetTryonMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message }
    }
  }
`;

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  const response = await admin.graphql(PRODUCTS_QUERY);
  const json = await response.json();
  const products = json.data.products.nodes;

  const tryonDocs = await TryonProduct.find({ shop: session.shop }).lean();
  const byProductId = new Map(tryonDocs.map((doc) => [doc.productId, doc]));

  return {
    products: products.map((product) => {
      const doc = byProductId.get(product.id);
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        imageUrl: product.featuredImage?.url ?? null,
        lensWidthMm: product.lensWidth?.value
          ? Number(product.lensWidth.value)
          : null,
        bridgeMm: product.bridge?.value ? Number(product.bridge.value) : null,
        tryon: doc
          ? {
              status: doc.status,
              variants: doc.variants.map((v) => ({
                title: v.title,
                status: v.status,
                error: v.error,
              })),
            }
          : null,
      };
    }),
  };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const productId = formData.get("productId");

  if (intent === "enable" || intent === "reprocess") {
    try {
      await enableTryon(session.shop, admin, productId);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to enable try-on",
      };
    }
  }

  if (intent === "save-size") {
    const lensWidthMm = formData.get("lensWidthMm");
    const bridgeMm = formData.get("bridgeMm");

    const metafields = [];
    if (lensWidthMm) {
      metafields.push({
        ownerId: productId,
        namespace: "tryon",
        key: "lens_width_mm",
        type: "number_decimal",
        value: String(Number(lensWidthMm)),
      });
    }
    if (bridgeMm) {
      metafields.push({
        ownerId: productId,
        namespace: "tryon",
        key: "bridge_mm",
        type: "number_decimal",
        value: String(Number(bridgeMm)),
      });
    }

    if (metafields.length > 0) {
      await admin.graphql(SET_METAFIELDS_MUTATION, { variables: { metafields } });
      await TryonProduct.updateOne(
        { shop: session.shop, productId },
        {
          $set: {
            ...(lensWidthMm ? { lensWidthMm: Number(lensWidthMm) } : {}),
            ...(bridgeMm ? { bridgeMm: Number(bridgeMm) } : {}),
          },
        },
      );
    }
    return { ok: true };
  }

  return { ok: false, error: "Unknown action" };
};

function StatusBadge({ tryon }) {
  if (!tryon) return <s-badge tone="neutral">Not enabled</s-badge>;
  if (tryon.status === "pending") return <s-badge tone="info">Processing…</s-badge>;
  if (tryon.status === "ready") return <s-badge tone="success">Ready</s-badge>;
  return <s-badge tone="critical">Failed</s-badge>;
}

function ProductRow({ product }) {
  const enableFetcher = useFetcher();
  const sizeFetcher = useFetcher();
  const [lensWidthMm, setLensWidthMm] = useState(product.lensWidthMm ?? "");
  const [bridgeMm, setBridgeMm] = useState(product.bridgeMm ?? "");

  const isProcessing =
    enableFetcher.state !== "idle" || product.tryon?.status === "pending";

  return (
    <s-section heading={product.title}>
      <s-stack direction="inline" gap="base" alignItems="center">
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.title}
            width="48"
            height="48"
            style={{ objectFit: "cover", borderRadius: 8 }}
          />
        )}
        <StatusBadge tryon={product.tryon} />
        <enableFetcher.Form method="post">
          <input type="hidden" name="productId" value={product.id} />
          <input
            type="hidden"
            name="intent"
            value={product.tryon ? "reprocess" : "enable"}
          />
          <s-button type="submit" {...(isProcessing ? { loading: true } : {})}>
            {product.tryon ? "Reprocess" : "Enable Try-On"}
          </s-button>
        </enableFetcher.Form>
      </s-stack>

      {product.tryon?.variants?.some((v) => v.status === "failed") && (
        <s-paragraph tone="critical">
          {product.tryon.variants
            .filter((v) => v.status === "failed")
            .map((v) => `${v.title}: ${v.error}`)
            .join("; ")}
        </s-paragraph>
      )}

      <sizeFetcher.Form method="post">
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="intent" value="save-size" />
        <s-stack direction="inline" gap="base" alignItems="end">
          <label>
            Lens width (mm)
            <input
              type="number"
              step="0.1"
              name="lensWidthMm"
              value={lensWidthMm}
              onChange={(e) => setLensWidthMm(e.target.value)}
            />
          </label>
          <label>
            Bridge width (mm)
            <input
              type="number"
              step="0.1"
              name="bridgeMm"
              value={bridgeMm}
              onChange={(e) => setBridgeMm(e.target.value)}
            />
          </label>
          <s-button
            type="submit"
            variant="tertiary"
            {...(sizeFetcher.state !== "idle" ? { loading: true } : {})}
          >
            Save size
          </s-button>
        </s-stack>
      </sizeFetcher.Form>
    </s-section>
  );
}

export default function TryonProducts() {
  const { products } = useLoaderData();
  const revalidator = useRevalidator();
  const anyPending = products.some((p) => p.tryon?.status === "pending");

  useEffect(() => {
    if (!anyPending) return;
    const timer = setInterval(() => revalidator.revalidate(), 3000);
    return () => clearInterval(timer);
  }, [anyPending, revalidator]);

  return (
    <s-page heading="Try-On Products">
      <s-section>
        <s-paragraph>
          Enable virtual try-on for a product to process its variant images
          (background removal + lens detection) so shoppers can see it on
          their own photo on the product page.
        </s-paragraph>
      </s-section>
      {products.map((product) => (
        <ProductRow key={product.id} product={product} />
      ))}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
