import "server-only";

import { z } from "zod";

import { formatEnvError, publicEnv, type PublicEnv } from "./env.public";

/**
 * Server environment, validated once when the module is first imported (fail fast).
 * Server-only: client components must use `@/lib/env.public` instead.
 */
const serverSchema = z.object({
  API_BASE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type ServerEnv = z.infer<typeof serverSchema> & PublicEnv;

function parseServerEnv(): ServerEnv {
  const result = serverSchema.safeParse({
    API_BASE_URL: process.env.API_BASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
  if (!result.success) throw new Error(formatEnvError(result.error, "server"));
  return { ...result.data, ...publicEnv };
}

export const env: ServerEnv = parseServerEnv();

export const isProduction = env.NODE_ENV === "production";
