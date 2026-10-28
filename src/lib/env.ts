import "server-only";

import { z } from "zod";

import { formatEnvError, publicEnv, type PublicEnv } from "./env.public";

/**
 * Server environment, validated once when the module is first imported (fail fast).
 * Server-only: client components must use `@/lib/env.public` instead.
 */
const serverSchema = z.object({
  API_BASE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  CHECKOUT_SIGNING_SECRET: z
    .string()
    .refine(
      (value) => new TextEncoder().encode(value).length >= 32,
      "must be at least 32 bytes",
    ),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  /**
   * true only behind our own Nginx, which sets X-Real-IP / X-Forwarded-For: then the
   * visitor IP comes from those headers. false (development): always 127.0.0.1, and
   * whatever the browser sends is ignored.
   */
  WEB_TRUST_PROXY_HEADERS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type ServerEnv = z.infer<typeof serverSchema> & PublicEnv;

function parseServerEnv(): ServerEnv {
  const result = serverSchema.safeParse({
    API_BASE_URL: process.env.API_BASE_URL,
    CHECKOUT_SIGNING_SECRET: process.env.CHECKOUT_SIGNING_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    WEB_TRUST_PROXY_HEADERS: process.env.WEB_TRUST_PROXY_HEADERS || undefined,
  });
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      name: issue.path.join("."),
      message: issue.message,
    }));
    throw new Error(formatEnvError(issues, "server"));
  }
  return { ...result.data, ...publicEnv };
}

export const env: ServerEnv = parseServerEnv();

export const isProduction = env.NODE_ENV === "production";
