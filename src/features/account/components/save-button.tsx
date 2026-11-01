import { t } from "@/i18n";

/** The submit button of a settings form: disabled while it saves (no double submit). */
export function SaveButton({
  pending,
  label,
  block = false,
}: {
  pending: boolean;
  label: string;
  /** Full width (the password change page). */
  block?: boolean;
}) {
  return (
    <button
      type="submit"
      className={block ? "lm-btn primary block" : "lm-btn primary sm"}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? t("settings.saving") : label}
    </button>
  );
}

/** The message under a form (a failure that belongs to no single field). */
export function FormMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="lm-err" role="alert" data-field-error="form">
      {message}
    </p>
  );
}
