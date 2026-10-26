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
  // A second dev server (the e2e "backend-down" project) needs its own build directory;
  // builds and npm start always use the default .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
    // Exactly the backend sizes (thumb / medium / large), so every srcset lists three real
    // files instead of ~16 widths that map to the same three URLs (smaller HTML, too).
    deviceSizes: [300, 800, 1600],
    imageSizes: [],
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
