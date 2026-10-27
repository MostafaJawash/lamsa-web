import { HeartFilledIcon, HeartIcon } from "@/components/shared/icons";
import { t } from "@/i18n";

import { toggleFavoriteForm } from "../actions";

/**
 * A favorites heart (prototype `.fav`): a real form, so it works without JavaScript
 * (the action toggles and redirects back to `next`). With JavaScript, the one client
 * controller (CommerceController) takes over the submit, flips `aria-pressed` on every
 * heart of the product at once and calls the same action. Both icons are always
 * rendered; CSS shows the filled one when pressed, so nothing moves.
 *
 * No "use client": the card stays a server component; the product page's client
 * component renders the same markup.
 */
export function HeartForm({
  productId,
  slug,
  next,
  pressed = false,
  className = "lm-fav",
}: {
  productId: number;
  slug: string;
  /** Where to come back without JavaScript (the current page). */
  next: string;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <form
      action={toggleFavoriteForm}
      className="lm-fav-form"
      data-lm-form="fav"
    >
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        className={className}
        aria-pressed={pressed}
        aria-label={t("card.addFavorite")}
        data-product-id={productId}
      >
        <HeartIcon className="off" />
        <HeartFilledIcon className="on" />
      </button>
    </form>
  );
}
