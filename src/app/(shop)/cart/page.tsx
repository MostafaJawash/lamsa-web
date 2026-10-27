import type { Metadata } from "next";

import { PageChrome } from "@/components/layout/page-chrome";
import { EmptyState } from "@/components/shared/empty-state";
import { BagIcon } from "@/components/shared/icons";
import { CartView } from "@/features/cart/components/cart-view";
import { getCartPage } from "@/features/cart/queries";
import { t } from "@/i18n";

/**
 * A blocking route: the cart is personal (cookies) and is rendered in full before the
 * page is sent, not streamed into a Suspense hole, so the page works without
 * JavaScript (streamed holes need it to appear) and nothing is swapped in later.
 */
export const instant = false;

export const metadata: Metadata = {
  title: t("pages.cart"),
  robots: { index: false, follow: true },
};

function CartHead() {
  return (
    <div className="lm-list-head">
      <h1>{t("pages.cart")}</h1>
    </div>
  );
}

/** Personal data: read per request (cookies), never cached. */
async function CartContent() {
  const data = await getCartPage();
  if (data.status === "unavailable") {
    // Never touches the guest cookie: the cart is still there next time.
    return (
      <>
        <CartHead />
        <EmptyState icon={<BagIcon />} title={t("cart.unavailable")} />
      </>
    );
  }
  return <CartView initial={data.cart} />;
}

/** Cart (prototype `pCart()`): logged in, the stored cart; guests, the cookie's preview. */
export default function CartPage() {
  return (
    <PageChrome path="/cart">
      <CartContent />
    </PageChrome>
  );
}
