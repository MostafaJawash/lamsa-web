import { t } from "@/i18n";
import { formatDate } from "@/lib/format";

import type { TimelineStep } from "../types";

/**
 * The order's progress (prototype `.timeline`), built from the backend's own `timeline`:
 * every step of the workflow in order with its label and the time it was reached, the
 * current step highlighted, and for a cancelled order the steps it reached followed by the
 * "cancelled" step with its reason.
 */
export function OrderTimeline({ steps }: { steps: readonly TimelineStep[] }) {
  return (
    <ol className="lm-timeline" aria-label={t("orderDetail.timeline")}>
      {steps.map((step) => {
        const done = step.reached_at !== null;
        const cancelled = step.status === "cancelled";
        const className = [
          done || step.is_current ? "done" : "",
          step.is_current ? "now" : "",
          cancelled ? "cancelled" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <li
            key={step.status}
            className={className}
            aria-current={step.is_current ? "step" : undefined}
            data-step={step.status}
          >
            <i />
            <span>
              {step.label}
              {step.reached_at ? (
                <small className="lm-muted">
                  {formatDate(step.reached_at, "dateTime")}
                </small>
              ) : null}
              {cancelled && step.cancel_reason ? (
                <small className="lm-muted">
                  {t("orderDetail.cancelReasonShown", {
                    reason: step.cancel_reason,
                  })}
                </small>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
