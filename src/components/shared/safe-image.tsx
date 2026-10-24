"use client";

import Image from "next/image";
import { useState } from "react";

type SafeImageProps = {
  src: string;
  alt: string;
  sizes: string;
  /** Rendered instead of the image when it fails to load. */
  fallback: React.ReactNode;
  preload?: boolean;
};

/**
 * next/image filling its (position: relative) parent, through the backend size loader.
 * A broken URL switches to `fallback`, so a tile never shows a broken-image icon.
 */
export function SafeImage({
  src,
  alt,
  sizes,
  fallback,
  preload = false,
}: SafeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <>{fallback}</>;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={preload}
      fetchPriority={preload ? "high" : undefined}
      onError={() => setFailedSrc(src)}
    />
  );
}
