import { brandColor, monogram } from "@/features/catalog/brand-mark";
import type { ImageUrls } from "@/features/catalog/types";
import { cn } from "@/lib/utils";

import { SafeImage } from "./safe-image";

type BrandLogoProps = {
  id: number;
  name: string;
  logo: ImageUrls | null;
  large?: boolean;
};

/**
 * Prototype `.logo-m`: the brand logo inside the round mark, or the monogram on a
 * deterministic brand color when there is no logo (or it fails to load).
 */
export function BrandLogo({ id, name, logo, large = false }: BrandLogoProps) {
  const letter = <span aria-hidden="true">{monogram(name)}</span>;
  return (
    <span
      className={cn("lm-logo-m", large && "lg")}
      style={{ "--b": brandColor(id) } as React.CSSProperties}
    >
      {logo ? (
        <SafeImage
          src={logo.medium}
          alt=""
          sizes={large ? "76px" : "58px"}
          fallback={letter}
        />
      ) : (
        letter
      )}
    </span>
  );
}
