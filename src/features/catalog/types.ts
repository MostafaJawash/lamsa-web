/**
 * catalog: types.
 * Categories, brands, product lists, facets, product detail, related products and search.
 *
 * Belongs here: aliases of the generated backend schemas (src/lib/api/schema.d.ts) and
 * UI-only types of this feature. Never hand-write a type the backend already describes.
 */
import type { Schema } from "@/lib/api/types";

export type CategoryNode = Schema<"CategoryNode">;
export type CategoryDetail = Schema<"CategoryDetailOut">;
export type Brand = Schema<"BrandOut">;
export type ProductCard = Schema<"ProductCardOut">;
export type ProductCardPage = Schema<"Page_ProductCardOut_">;
export type ProductDetail = Schema<"ProductDetailOut">;
export type Facets = Schema<"FacetsOut">;
export type ImageUrls = Schema<"ImageUrls">;
export type Variant = Schema<"VariantOut">;
export type VariantOption = Schema<"VariantOptionOut">;
export type ProductImage = Schema<"ProductImageOut">;
export type AttributeValue = Schema<"AttributeValueOut">;
export type AttributeDefinition = Schema<"AttributeDefinitionOut">;
export type BundleItem = Schema<"BundleItemOut">;
export type AttributeFacet = Schema<"AttributeFacet">;
export type OptionFacet = Schema<"OptionFacet">;
export type StockStatus = Schema<"StockStatus">;
