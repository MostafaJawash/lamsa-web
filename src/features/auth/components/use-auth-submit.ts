"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import type { AuthResult, FormError } from "../errors";

/** The `next` parameter of the current URL (validated again by the server action). */
export function currentNext(): string | null {
  return new URLSearchParams(window.location.search).get("next");
}

/**
 * `next` for links between the auth pages, read after hydration: the pages stay fully
 * static (no searchParams), and only an href changes, so nothing moves.
 */
export function useNextParam(): string | null {
  return useSyncExternalStore(subscribeNever, currentNext, serverNext);
}

// The URL's query doesn't change while an auth page is open (each page is its own route).
const subscribeNever = () => () => {};
const serverNext = () => null;

/**
 * False until hydrated. Submit buttons stay disabled until then: a native submit
 * before hydration would send the form without the action.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

/** TOO_MANY_ATTEMPTS: seconds left until `deadline` (ms), ticking every second. */
function useLock() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const lock = (seconds: number | null) => {
    setDeadline(seconds ? Date.now() + seconds * 1000 : null);
    setSecondsLeft(seconds ?? 0);
  };
  return { secondsLeft, lock };
}

/**
 * Submits a react-hook-form form to an auth server action: one submit at a time
 * (pending), server field errors on their fields (the first one focused), the form
 * error, and the TOO_MANY_ATTEMPTS lock with its countdown. On success the action
 * redirects, so there is nothing to do here.
 */
export function useAuthSubmit<T extends FieldValues>(
  form: UseFormReturn<T>,
  action: (values: T, next: string | null) => Promise<AuthResult>,
  fieldOrder: readonly Path<T>[],
) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<FormError | null>(null);
  const { secondsLeft, lock } = useLock();
  const locked = secondsLeft > 0;

  const onSubmit = form.handleSubmit((values) => {
    if (pending || locked) return;
    setFormError(null);
    startTransition(async () => {
      const result = await action(values, currentNext());
      if (!result || result.ok) return;
      const fields = fieldOrder.filter(
        (field) => result.fieldErrors[field as keyof typeof result.fieldErrors],
      );
      for (const field of fields) {
        form.setError(field, {
          type: "server",
          message:
            result.fieldErrors[field as keyof typeof result.fieldErrors] ?? "",
        });
      }
      if (fields[0]) form.setFocus(fields[0]);
      setFormError(result.formError);
      lock(result.retryAfter);
    });
  });

  return { onSubmit, pending, formError, secondsLeft, locked };
}
