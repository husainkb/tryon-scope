import fs from "node:fs/promises";
import path from "node:path";

const STORAGE_DIR = path.join(process.cwd(), "storage", "tryon");

// Serves processed overlay PNGs with an explicit CORS header. These are
// loaded cross-origin from the storefront (shop domain) onto a <canvas> with
// crossOrigin="anonymous" so the canvas stays untainted for "Save photo" —
// static files under public/ don't get that header, so this is a real route
// instead, which behaves the same in dev and production.
export const loader = async ({ params }) => {
  const { id, file } = params;
  if (!id || !file || id.includes("..") || file.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(path.join(STORAGE_DIR, id, file));
    return new Response(data, {
      headers: {
        "Content-Type": "image/png",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};
