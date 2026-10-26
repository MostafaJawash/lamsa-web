import { t } from "@/i18n";
import type { User } from "@/lib/auth/user";

import { LogoutButtons } from "./logout-buttons";

/** First letter for the avatar (prototype `norm(u.name)[0]`). */
function initial(name: string): string {
  return Array.from(name.trim())[0] ?? "?";
}

/**
 * Prototype `.profile`: avatar initial, name, phone or email, "دخلت عن طريق …", and
 * the logout buttons (one session, or every device).
 */
export function ProfileCard({ user }: { user: User }) {
  const contact = user.phone ?? user.email ?? "";
  return (
    <div className="lm-profile">
      <span className="lm-avatar" aria-hidden="true">
        {initial(user.name)}
      </span>
      <div className="who">
        <h2>{user.name}</h2>
        {contact ? (
          <div className="meta lm-num" dir="ltr" style={{ textAlign: "end" }}>
            {contact}
          </div>
        ) : null}
        <div className="meta">
          {t("auth.account.via", {
            via:
              user.auth_provider === "google"
                ? t("auth.account.viaGoogle")
                : t("auth.account.viaPhone"),
          })}
        </div>
      </div>
      <LogoutButtons />
    </div>
  );
}

/** Same box while the session streams in. */
export function ProfileCardSkeleton() {
  return (
    <div
      className="lm-profile"
      aria-busy="true"
      aria-label={t("common.loading")}
    >
      <span className="lm-avatar" />
      <div className="who">
        <span className="lm-skel block" style={{ width: "40%", height: 24 }} />
        <span
          className="lm-skel mt-1 block"
          style={{ width: "55%", height: 18 }}
        />
        <span
          className="lm-skel mt-1 block"
          style={{ width: "45%", height: 18 }}
        />
      </div>
    </div>
  );
}
