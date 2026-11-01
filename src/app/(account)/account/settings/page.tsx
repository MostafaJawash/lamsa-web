import type { Metadata } from "next";

import { AccountShell } from "@/components/layout/account-shell";
import { PageChrome } from "@/components/layout/page-chrome";
import { EmptyState } from "@/components/shared/empty-state";
import { UserIcon } from "@/components/shared/icons";
import { PasswordForm } from "@/features/account/components/password-form";
import { PhoneForm } from "@/features/account/components/phone-form";
import { ProfileForm } from "@/features/account/components/profile-form";
import type {
  SettingsFormState,
  SettingsSection,
} from "@/features/account/settings-validation";
import { PageFlash } from "@/features/cart/components/page-flash";
import { PreferenceSwitch } from "@/features/notifications/components/preference-switch";
import { preferenceRows } from "@/features/notifications/preferences";
import { getPreferences } from "@/features/notifications/queries";
import { t } from "@/i18n";
import { requireUser } from "@/lib/auth/user";
import { readFailure } from "@/lib/form-failure";

const PATH = "/account/settings";

/** Personal, always fresh: rendered in full per request, like /cart (works without JavaScript). */
export const instant = false;

export const metadata: Metadata = {
  title: t("pages.settings"),
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The failure of a plain form post, for the form it belongs to only. */
function failureFor(
  failure: SettingsFormState,
  section: SettingsSection,
): SettingsFormState {
  return failure?.section === section ? failure : null;
}

/**
 * Settings: name and email, the login phone, the password (phone accounts), and the
 * notification preferences. Each form posts to its own server action, with or without
 * JavaScript. Which parts apply depends on the account: a Google account has no password
 * and changes its phone without one.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser(PATH);
  const params = await searchParams;
  const head = (
    <div className="lm-list-head">
      <h1>{t("pages.settings")}</h1>
    </div>
  );
  if (!user)
    return (
      <PageChrome path={PATH}>
        <AccountShell>
          {head}
          <EmptyState icon={<UserIcon />} title={t("settings.unavailable")} />
        </AccountShell>
      </PageChrome>
    );

  const failure = readFailure<NonNullable<SettingsFormState>>(params.fs);
  const phoneAccount = user.auth_provider === "phone";
  const preferences = await getPreferences();

  return (
    <PageChrome path={PATH}>
      <AccountShell>
        {head}
        <p className="lm-muted">{t("settings.sub")}</p>

        <section
          id="profile"
          className="lm-box"
          aria-labelledby="settings-profile"
        >
          <h2 className="lm-box-title" id="settings-profile">
            {t("settings.profile.title")}
          </h2>
          <ProfileForm
            key={`${user.name}|${user.email ?? ""}`}
            initial={{ name: user.name, email: user.email ?? "" }}
            initialState={failureFor(failure, "profile")}
          />
        </section>

        <section id="phone" className="lm-box" aria-labelledby="settings-phone">
          <h2 className="lm-box-title" id="settings-phone">
            {t("settings.phone.title")}
          </h2>
          <p className="lm-muted">
            {t("settings.phone.current")}{" "}
            <span className="lm-num" dir="ltr" data-testid="current-phone">
              {user.phone}
            </span>
          </p>
          <p className="lm-hint">
            {t(
              phoneAccount
                ? "settings.phone.hintPhone"
                : "settings.phone.hintGoogle",
            )}
          </p>
          <PhoneForm
            key={user.phone}
            needsPassword={phoneAccount}
            initialState={failureFor(failure, "phone")}
          />
        </section>

        <section
          id="password"
          className="lm-box"
          aria-labelledby="settings-password"
        >
          <h2 className="lm-box-title" id="settings-password">
            {t("settings.password.title")}
          </h2>
          {phoneAccount ? (
            <>
              <p className="lm-hint">{t("settings.password.hint")}</p>
              <PasswordForm
                phone={user.phone}
                initialState={failureFor(failure, "password")}
              />
            </>
          ) : (
            <p className="lm-note" data-testid="google-password-note">
              {t("auth.change.googleAccount")}
            </p>
          )}
        </section>

        <section
          id="notifications"
          className="lm-box"
          aria-labelledby="settings-notifications"
        >
          <h2 className="lm-box-title" id="settings-notifications">
            {t("notifications.preferences.title")}
          </h2>
          {preferences.status === "ok" ? (
            <>
              <p className="lm-hint">{t("notifications.preferences.sub")}</p>
              {preferenceRows(preferences.preferences).map((row) => (
                <PreferenceSwitch
                  key={`${row.key}:${row.enabled}`}
                  prefKey={row.key}
                  enabled={row.enabled}
                  label={t(row.label)}
                  hint={t(row.hint)}
                />
              ))}
              <p className="lm-note" data-testid="order-updates-note">
                {t("notifications.preferences.alwaysOn")}
              </p>
            </>
          ) : (
            <p className="lm-err">
              {t("notifications.preferences.unavailable")}
            </p>
          )}
        </section>
        <PageFlash />
      </AccountShell>
    </PageChrome>
  );
}
