"use client";

import {
  useActionState,
  useId,
  useOptimistic,
  useState,
  useTransition,
} from "react";

import { useScripted } from "@/features/account/components/use-settings-form";
import { showToast } from "@/features/cart/toast";
import { t } from "@/i18n";

import { setPreference, type PreferenceState } from "../actions";
import type { PreferenceKey } from "../preferences";

/**
 * One notification preference (the `.lm-toggle` switch of the filters). Saves the moment
 * it is flipped: the switch moves at once, the server action runs, and on failure (the
 * backend's refusal or a lost connection) it moves back and says why. Without JavaScript
 * the same form posts with its own small "حفظ" button, and the checkbox's CSS state still
 * works.
 */
export function PreferenceSwitch({
  prefKey,
  enabled,
  label,
  hint,
}: {
  prefKey: PreferenceKey;
  enabled: boolean;
  label: string;
  hint: string;
}) {
  // The plain form post (no JavaScript) goes through this action state.
  const [, formAction] = useActionState<PreferenceState | null, FormData>(
    setPreference,
    null,
  );
  const [saved, setSaved] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useOptimistic(
    saved,
    (_current, next: boolean) => next,
  );
  const [, startTransition] = useTransition();
  const scripted = useScripted();
  const hintId = useId();

  const flip = (next: boolean) => {
    const data = new FormData();
    data.set("key", prefKey);
    if (next) data.set("enabled", "on");
    data.set("js", "1");
    startTransition(async () => {
      setShown(next);
      let result: PreferenceState;
      try {
        result = await setPreference(null, data);
      } catch {
        result = { key: prefKey, enabled: !next, error: t("errors.network") };
      }
      setSaved(result.enabled);
      setError(result.error);
      showToast({ text: result.error ?? t("toast.preferenceSaved") });
    });
  };

  return (
    <form action={formAction} className="lm-pref" data-pref={prefKey}>
      <input type="hidden" name="key" value={prefKey} />
      {scripted ? <input type="hidden" name="js" value="1" /> : null}
      <label className="lm-toggle">
        <span>
          <b>{label}</b>
          <small className="lm-hint" id={hintId}>
            {hint}
          </small>
        </span>
        <input
          type="checkbox"
          name="enabled"
          checked={shown}
          aria-describedby={hintId}
          onChange={(event) => flip(event.currentTarget.checked)}
        />
        <span className="track" aria-hidden="true" />
      </label>
      {error ? (
        <p className="lm-err" role="alert" data-field-error={prefKey}>
          {error}
        </p>
      ) : null}
      <noscript>
        <button type="submit" className="lm-btn ghost sm">
          {t("notifications.preferences.save")}
        </button>
      </noscript>
    </form>
  );
}
