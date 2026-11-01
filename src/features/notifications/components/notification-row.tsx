import { t } from "@/i18n";
import { formatDate } from "@/lib/format";

import { markNotificationRead, openNotification } from "../actions";
import { notificationTarget } from "../target";
import type { Notification } from "../types";

/**
 * One inbox item (a server component, no client code): unread ones are marked (dot and
 * a stronger title), the time is the store's local time. A notification that leads
 * somewhere is one whole button that marks it read and goes there; one that leads
 * nowhere is plain text with its own "تعليم كمقروء" while unread. Both are plain form
 * posts, so they work without JavaScript.
 */
export function NotificationRow({
  notification,
  page,
}: {
  notification: Notification;
  page: number;
}) {
  const { id, title, body, sent_at: sentAt, is_read: read } = notification;
  const leads = notificationTarget(notification).kind !== "none";
  const content = (
    <>
      <span className="lm-notif-dot" aria-hidden="true" />
      <span className="lm-notif-main">
        <b>{title}</b>
        <span>{body}</span>
        <time className="lm-muted" dateTime={sentAt}>
          {formatDate(sentAt, "dateTime")}
        </time>
      </span>
      {!read ? (
        <span className="sr-only">{t("notifications.unread")}</span>
      ) : null}
    </>
  );
  const attributes = {
    "data-notification-id": id,
    "data-read": read ? "true" : "false",
  };
  return (
    <div
      role="listitem"
      className={read ? "lm-notif" : "lm-notif unread"}
      {...attributes}
    >
      {leads ? (
        <form action={openNotification} className="lm-notif-open">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="page" value={page} />
          <button type="submit" className="lm-notif-btn">
            {content}
          </button>
        </form>
      ) : (
        <div className="lm-notif-open">
          <div className="lm-notif-btn">{content}</div>
        </div>
      )}
      {!read && !leads ? (
        <form action={markNotificationRead} className="lm-notif-read">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="page" value={page} />
          <button type="submit" className="lm-btn ghost sm">
            {t("notifications.markRead")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
