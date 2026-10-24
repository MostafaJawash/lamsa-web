import type { NextConfig } from "next";

const mediaBaseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
const mediaUrl = mediaBaseUrl ? new URL(mediaBaseUrl) : null;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // TODO: add a Content-Security-Policy (nonce-based, see the Next.js CSP guide)
  // once the Google sign-in and analytics origins are known.
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  typedRoutes: true,
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    // The backend already serves WebP in thumb / medium / large; never re-optimize here.
    loader: "custom",
    loaderFile: "./src/lib/images.ts",
    // Ignored by Next.js while `loader: "custom"` is set (only the default loader uses it).
    // Kept so the media host is documented and ready if the default loader is ever used.
    remotePatterns: mediaUrl
      ? [
          {
            protocol: mediaUrl.protocol === "https:" ? "https" : "http",
            hostname: mediaUrl.hostname,
            port: mediaUrl.port,
            pathname: `${mediaUrl.pathname.replace(/\/$/, "")}/**`,
          },
        ]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
