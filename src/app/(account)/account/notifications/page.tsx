import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountShell } from "@/components/layout/account-shell";
import { PageChrome } from "@/components/layout/page-chrome";
import { EmptyState } from "@/components/shared/empty-state";
import { BellIcon } from "@/components/shared/icons";
import { PageFlash } from "@/features/cart/components/page-flash";
import { PagerLinks } from "@/features/catalog/components/list-results";
import { parsePage } from "@/features/orders/status";
import { markAllNotificationsRead } from "@/features/notifications/actions";
import { NotificationRow } from "@/features/notifications/components/notification-row";
import { UnreadSync } from "@/features/notifications/components/unread-sync";
import {
  getInbox,
  NOTIFICATIONS_PAGE_SIZE,
} from "@/features/notifications/queries";
import { t } from "@/i18n";
import { requireUser } from "@/lib/auth/user";
import { pluralize } from "@/lib/format";

const PATH = "/account/notifications";

/** Personal, always fresh: rendered in full per request, like /cart (works without JavaScript). */
export const instant = false;

export const metadata: Metadata = {
  title: t("pages.notifications"),
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function href(page = 1): Route {
  return (page > 1 ? `${PATH}?page=${page}` : PATH) as Route;
}

/**
 * The notifications inbox: the customer's own notifications and the store's broadcasts,
 * newest first as the backend returns them, 10 per page, with the unread count, "mark
 * all as read" and one row per notification (see NotificationRow).
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser(PATH);
  const requested = parsePage((await searchParams).page);

  const head = (
    <div className="lm-list-head">
      <h1>{t("pages.notifications")}</h1>
      <Link
        href={"/account/settings#notifications" as Route}
        className="lm-more lm-link"
      >
        {t("notifications.settingsLink")}
      </Link>
    </div>
  );
  const unavailable = (
    <PageChrome path={PATH}>
      <AccountShell>
        {head}
        <EmptyState
          icon={<BellIcon />}
          title={t("notifications.unavailable")}
        />
      </AccountShell>
    </PageChrome>
  );
  if (!user) return unavailable;
  const result = await getInbox(requested);
  if (result.status === "unavailable") return unavailable;
  const { items, total, unread_count: unread } = result.page;
  const pages = Math.max(1, Math.ceil(total / NOTIFICATIONS_PAGE_SIZE));
  // A page past the end (an old link): go to the last one.
  if (items.length === 0 && total > 0 && requested > pages)
    redirect(href(pages));

  return (
    <PageChrome path={PATH}>
      <AccountShell>
        {head}
        <p className="lm-muted">{t("notifications.sub")}</p>
        {total > 0 ? (
          <div className="lm-notif-bar">
            <span data-testid="unread-summary">
              {pluralize(unread, "unreadNotifications")}
            </span>
            {unread > 0 ? (
              <form action={markAllNotificationsRead}>
                <input
                  type="hidden"
                  name="page"
                  value={Math.min(requested, pages)}
                />
                <button type="submit" className="lm-btn ghost sm">
                  {t("notifications.markAll")}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
        {items.length === 0 ? (
          <EmptyState
            icon={<BellIcon />}
            title={t("notifications.emptyTitle")}
            text={t("notifications.emptyText")}
          />
        ) : (
          <div role="list" aria-label={t("notifications.list")}>
            {items.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                page={Math.min(requested, pages)}
              />
            ))}
          </div>
        )}
        <PagerLinks page={requested} pages={pages} href={href} />
        <UnreadSync unread={unread} />
        <PageFlash />
      </AccountShell>
    </PageChrome>
  );
}
