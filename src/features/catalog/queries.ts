/**
 * catalog: server-side reads.
 * Backend: GET /categories, /categories/{slug}, /brands, /brands/{slug}, /products, /products/facets, /products/{slug}, /products/{slug}/related
 *
 * Belongs here: async functions that read through `publicApi` (anonymous, cacheable
 * with "use cache") or `getApi()` (sends the visitor's token; render inside <Suspense>)
 * from "@/lib/api/client", unwrap the result and return the types from ./types.
 * Server-only: never import this file from a client component.
 */
import "server-only";

export {};
