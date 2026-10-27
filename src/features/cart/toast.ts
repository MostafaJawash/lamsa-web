import type { Route } from "next";

import type { FlashToast } from "./flash";

/**
 * The prototype `.toast`: one at a time (a new one replaces the current), about 2.6 s,
 * with an optional action button ("عرض السلة", "المفضلة"). sonner is loaded on first use
 * (the Toaster itself is deferred too).
 */
export function showToast(
  view: FlashToast,
  navigate?: (href: Route) => void,
): void {
  void import("sonner").then(({ toast }) => {
    const action = view.action;
    toast(view.text, {
      id: "lm-toast",
      duration: 2600,
      description: view.sub,
      action:
        action && navigate
          ? { label: action.label, onClick: () => navigate(action.href) }
          : undefined,
    });
  });
}
