import { z } from "zod";

/**
 * Public environment variables (inlined into the browser bundle at build time).
 * Safe to import from client components. Each variable must be read with a literal
 * `process.env.NEXT_PUBLIC_...` expression, otherwise Next.js cannot inline it.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  NEXT_PUBLIC_MEDIA_BASE_URL: z
    .url()
    .transform((url) => url.replace(/\/+$/, "")),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function formatEnvError(error: z.ZodError, scope: string): string {
  const lines = error.issues.map(
    (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
  );
  return `Invalid ${scope} environment variables:\n${lines.join("\n")}\nCopy .env.example to .env.local and fill in the values.`;
}

function parsePublicEnv(): PublicEnv {
  const result = publicSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_MEDIA_BASE_URL: process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
  });
  if (!result.success) throw new Error(formatEnvError(result.error, "public"));
  return result.data;
}

export const publicEnv: PublicEnv = parsePublicEnv();
