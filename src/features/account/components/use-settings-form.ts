"use client";

import {
  useActionState,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  hasErrors,
  type SettingsErrors,
  type SettingsField,
  type SettingsFormState,
} from "../settings-validation";

type Action = (
  previous: SettingsFormState,
  form: FormData,
) => Promise<SettingsFormState>;

const subscribeNever = () => () => {};

/** False on the server and before hydration, true once JavaScript runs. */
export function useScripted(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

/**
 * The shared behavior of the settings forms (profile, phone, password): a `<form action>`
 * that posts with or without JavaScript, controlled values, the live rules once a field
 * is touched or the form was submitted, server errors that stay until that field is
 * edited, and one submit at a time (`pending`). A submit the rules reject never leaves
 * the browser; the first invalid field gets the focus. The server action checks the same
 * rules again.
 */
export function useSettingsForm<V extends Record<string, string>>({
  action,
  initialState,
  initial,
  validate,
}: {
  action: Action;
  /** The failure of a plain form post, handed back by the server (no JavaScript). */
  initialState: SettingsFormState;
  initial: V;
  validate: (values: V) => SettingsErrors;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const scripted = useScripted();
  const [values, setValues] = useState<V>(() => ({
    ...initial,
    ...(state?.values as Partial<V> | undefined),
  }));
  const [seen, setSeen] = useState(state);
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set());
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  if (state !== seen) {
    setSeen(state);
    setEdited(new Set());
  }

  const live = validate(values);
  const errorOf = (field: SettingsField): string | undefined => {
    const fromServer =
      state && !edited.has(field) ? state.errors[field] : undefined;
    const fromRules =
      field !== "form" && (submitted || touched.has(field))
        ? live[field]
        : undefined;
    return fromServer ?? fromRules;
  };

  const bind = (field: keyof V & string) => ({
    name: field,
    value: values[field],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
      setEdited((current) => new Set(current).add(field));
    },
    onBlur: () => {
      setTouched((current) => new Set(current).add(field));
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    setSubmitted(true);
    const found = validate(values);
    if (!hasErrors(found)) return;
    event.preventDefault();
    const first = (Object.keys(found) as SettingsField[])[0];
    event.currentTarget
      .querySelector<HTMLElement>(`[data-field="${first}"]`)
      ?.focus();
  };

  return { formAction, pending, scripted, errorOf, bind, onSubmit };
}
