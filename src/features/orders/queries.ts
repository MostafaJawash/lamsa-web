/**
 * orders: server-side reads.
 * Backend: POST /orders, GET /orders, GET /orders/{id}, POST /orders/{id}/cancel, POST /orders/{id}/reorder
 *
 * Belongs here: async functions that read through `publicApi` (anonymous, cacheable
 * with "use cache") or `getApi()` (sends the visitor's token; render inside <Suspense>)
 * from "@/lib/api/client", unwrap the result and return the types from ./types.
 * Server-only: never import this file from a client component.
 */
import "server-only";

export {};
