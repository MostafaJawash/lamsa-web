import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/** Placeholder web app manifest. TODO: real app icons (192 / 512 px, maskable). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    lang: siteConfig.locale,
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: siteConfig.themeColor.light,
    theme_color: siteConfig.brandColor,
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
