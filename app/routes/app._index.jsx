import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

export default function Index() {
  return (
    <s-page heading="Eyewear Try-On">
      <s-section heading="Let shoppers try on your frames">
        <s-paragraph>
          This app adds a &quot;Try it on&quot; button to your product pages.
          Shoppers upload a photo or take a selfie, and see your actual
          product images fitted to their own face — for every variant.
        </s-paragraph>
        <s-paragraph>
          Start on the{" "}
          <s-link href="/app/products">Try-On Products</s-link> page: enable
          try-on for a product to process its variant images, then add the
          &quot;Try On Button&quot; block to your Product template from the
          theme editor.
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="How it works">
        <s-unordered-list>
          <s-list-item>
            Enable try-on for a product in the admin
          </s-list-item>
          <s-list-item>
            Variant images are background-removed and lens-aligned
            automatically
          </s-list-item>
          <s-list-item>
            Shoppers upload a photo or take a selfie on the storefront
          </s-list-item>
          <s-list-item>
            The product overlays onto their photo, switchable per variant
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
