/**
 * Type-only helpers over the generated OpenAPI schema. Safe to import anywhere
 * (no runtime code), e.g. `type Product = Schema<"ProductDetailOut">`.
 */
import type { components } from "./schema";

export type Schemas = components["schemas"];
export type Schema<Name extends keyof Schemas> = Schemas[Name];
