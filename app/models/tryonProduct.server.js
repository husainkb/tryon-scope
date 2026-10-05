import mongoose from "mongoose";

const { Schema } = mongoose;

const LensCentersSchema = new Schema(
  {
    lx: { type: Number, required: true },
    ly: { type: Number, required: true },
    rx: { type: Number, required: true },
    ry: { type: Number, required: true },
  },
  { _id: false },
);

const TryonVariantSchema = new Schema(
  {
    variantId: { type: String, required: true }, // Shopify GID
    title: { type: String, required: true },
    sourceImageUrl: { type: String, required: true },
    overlayPath: { type: String, default: null }, // served from /public
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    anchorX: { type: Number, default: 0.5 },
    anchorY: { type: Number, default: 0.46 },
    lensCenters: { type: LensCentersSchema, default: null },
    symmetry: { type: Number, default: null },
    status: {
      type: String,
      enum: ["pending", "ready", "failed"],
      default: "pending",
    },
    error: { type: String, default: null },
  },
  { _id: false },
);

const TryonProductSchema = new Schema(
  {
    shop: { type: String, required: true },
    productId: { type: String, required: true }, // Shopify GID
    handle: { type: String, required: true },
    title: { type: String, required: true },
    lensWidthMm: { type: Number, default: null },
    bridgeMm: { type: Number, default: null },
    status: {
      type: String,
      enum: ["pending", "ready", "failed"],
      default: "pending",
    },
    variants: { type: [TryonVariantSchema], default: [] },
  },
  { timestamps: true },
);

TryonProductSchema.index({ shop: 1, productId: 1 }, { unique: true });

export const TryonProduct =
  mongoose.models.TryonProduct ||
  mongoose.model("TryonProduct", TryonProductSchema);
