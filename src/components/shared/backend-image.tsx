import { preload } from "react-dom";

import { srcSetFor, type ImageUrls } from "@/lib/image-urls";

type BackendImageProps = {
  urls: ImageUrls;
  alt: string;
  /** Rendered width, as for `<img sizes>`; the browser picks thumb / medium / large. */
  sizes: string;
  /** Above-the-fold image (e.g. the mobile LCP): preloaded with high priority. */
  priority?: boolean;
};

/**
 * A backend image as a plain server-rendered `<img>` filling its tile: no client
 * component per image. The backend already serves the final WebP sizes, so the srcset
 * lists them directly.
 *
 * Fallback without client code: render the fallback (silhouette, monogram) in the tile
 * *before* this image. The image covers it (`background: inherit`); if it fails to load,
 * the global listener in `IMAGE_FALLBACK_SCRIPT` hides it and the fallback shows.
 */
export function BackendImage({
  urls,
  alt,
  sizes,
  priority = false,
}: BackendImageProps) {
  const srcSet = srcSetFor(urls);
  if (priority) {
    preload(urls.medium, {
      as: "image",
      imageSrcSet: srcSet,
      imageSizes: sizes,
      fetchPriority: "high",
    });
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- final sizes come from the backend; next/image would add a client component per image
    <img
      className="lm-fill"
      src={urls.medium}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      data-fallback=""
    />
  );
}

/**
 * Marks failed backend images with `data-failed`, which CSS hides so the fallback drawn
 * behind them shows.
 *
 * Runs as an inline `type="module"` script: modules never block the parser, while a
 * classic script after the stylesheet would hold the first paint until the CSS arrives.
 * Because it runs after parsing, it first marks images that already failed (complete,
 * no pixels, and a request was made; lazy images not requested yet have no currentSrc),
 * then listens in the capture phase (image `error` events don't bubble), which also
 * covers images added by client navigations.
 * TODO(csp): give this script the CSP nonce once the Content-Security-Policy exists.
 */
export const IMAGE_FALLBACK_SCRIPT =
  'const m=(t)=>{if(t&&t.tagName==="IMG"&&t.hasAttribute("data-fallback"))t.setAttribute("data-failed","")};' +
  'for(const t of document.querySelectorAll("img[data-fallback]"))if(t.complete&&t.naturalWidth===0&&t.currentSrc)m(t);' +
  'document.addEventListener("error",(e)=>m(e.target),true);';
