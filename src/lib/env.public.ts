/**
 * Public environment variables (inlined into the browser bundle at build time).
 * Safe to import from client components. Each variable must be read with a literal
 * `process.env.NEXT_PUBLIC_...` expression, otherwise Next.js cannot inline it.
 *
 * Validated without zod on purpose: this module ships to the browser (image loader,
 * navigation), and zod would add ~60 KB there. The server env (`./env`) uses zod.
 */
export type PublicEnv = {
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_MEDIA_BASE_URL: string;
  /** Google Identity Services web client id; empty: no Google button (dev button in development). */
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: string;
  /** Store phone for "forgot password" (international format, e.g. +49 30 1234567); optional. */
  NEXT_PUBLIC_SUPPORT_PHONE: string;
  /** WhatsApp number, digits with country code (e.g. 4915112345678); optional. */
  NEXT_PUBLIC_SUPPORT_WHATSAPP: string;
};

export type EnvIssue = { name: string; message: string };

export function formatEnvError(
  issues: readonly EnvIssue[],
  scope: string,
): string {
  const lines = issues.map((issue) => `  - ${issue.name}: ${issue.message}`);
  return `Invalid ${scope} environment variables:\n${lines.join("\n")}\nCopy .env.example to .env.local and fill in the values.`;
}

/** An absolute http(s) URL without trailing slashes, or an issue. */
export function parseHttpUrl(
  name: string,
  value: string | undefined,
): string | EnvIssue {
  if (!value)
    return { name, message: "missing (expected an http or https URL)" };
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { name, message: `expected an http or https URL, got "${value}"` };
    }
  } catch {
    return { name, message: `invalid URL "${value}"` };
  }
  return value.replace(/\/+$/, "");
}

function parsePublicEnv(): PublicEnv {
  const site = parseHttpUrl(
    "NEXT_PUBLIC_SITE_URL",
    process.env.NEXT_PUBLIC_SITE_URL,
  );
  const media = parseHttpUrl(
    "NEXT_PUBLIC_MEDIA_BASE_URL",
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
  );
  const issues = [site, media].filter(
    (value): value is EnvIssue => typeof value !== "string",
  );
  if (typeof site !== "string" || typeof media !== "string") {
    throw new Error(formatEnvError(issues, "public"));
  }
  return {
    NEXT_PUBLIC_SITE_URL: site,
    NEXT_PUBLIC_MEDIA_BASE_URL: media,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: (
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""
    ).trim(),
    NEXT_PUBLIC_SUPPORT_PHONE: (
      process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? ""
    ).trim(),
    NEXT_PUBLIC_SUPPORT_WHATSAPP: (
      process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? ""
    ).replace(/\D/g, ""),
  };
}

export const publicEnv: PublicEnv = parsePublicEnv();
