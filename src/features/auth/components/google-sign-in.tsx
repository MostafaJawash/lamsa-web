"use client";

import Script from "next/script";
import { useEffect, useRef, useState, useTransition } from "react";

import { GoogleIcon } from "@/components/shared/icons";
import { t } from "@/i18n";

import { devGoogleSignIn, googleSignIn } from "../actions";
import type { AuthResult, FormError } from "../errors";
import type { GoogleMode } from "../google";

import { FormErrorView } from "./form-error";
import { currentNext } from "./use-auth-submit";

/** Minimal typing of Google Identity Services (accounts.google.com/gsi/client). */
type GsiCredentialResponse = { credential?: string };
type Gsi = {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: GsiCredentialResponse) => void;
        ux_mode?: "popup" | "redirect";
        context?: "signin" | "signup" | "use";
        itp_support?: boolean;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type?: "standard" | "icon";
          theme?: "outline" | "filled_blue" | "filled_black";
          size?: "large" | "medium" | "small";
          text?: "signin_with" | "signup_with" | "continue_with" | "signin";
          shape?: "rectangular" | "pill" | "circle" | "square";
          logo_alignment?: "left" | "center";
          width?: number;
          locale?: string;
        },
      ): void;
    };
  };
};

declare global {
  interface Window {
    google?: Gsi;
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";
/** GIS accepts 200–400 px; the .auth block is at most 380. */
const MAX_WIDTH = 380;

function useGoogleResult() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<FormError | null>(null);
  const run = (call: () => Promise<AuthResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await call();
      if (result && !result.ok) setError(result.formError);
    });
  };
  return { pending, error, run };
}

/** The official Google button (Google's own styling: outline, "continue with", Arabic). */
function GisButton({ clientId }: { clientId: string }) {
  const container = useRef<HTMLDivElement>(null);
  const { error, run } = useGoogleResult();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = container.current;
    const gsi = window.google;
    if (!ready || !element || !gsi) return;
    gsi.accounts.id.initialize({
      client_id: clientId,
      ux_mode: "popup",
      itp_support: true,
      callback: (response) => {
        const credential = response.credential;
        if (credential) run(() => googleSignIn(credential, currentNext()));
      },
    });
    gsi.accounts.id.renderButton(element, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "center",
      width: Math.max(200, Math.min(MAX_WIDTH, element.offsetWidth)),
      locale: "ar",
    });
    // `run` is stable enough: it only starts a transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, clientId]);

  return (
    <>
      <Script
        src={GSI_SRC}
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={container} className="lm-gis" />
      <FormErrorView error={error} secondsLeft={0} />
    </>
  );
}

/** Development only (no client id): the prototype `.btn.google` with a fake token. */
function DevGoogleButton() {
  const { pending, error, run } = useGoogleResult();
  return (
    <>
      <button
        type="button"
        className="lm-btn google block"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={() => run(() => devGoogleSignIn(currentNext()))}
      >
        <GoogleIcon />
        {pending ? t("auth.pending") : t("auth.google.dev")}
      </button>
      <FormErrorView error={error} secondsLeft={0} />
    </>
  );
}

/** The `.or` divider and the Google button; nothing in production without a client id. */
export function GoogleSignIn({ mode }: { mode: GoogleMode }) {
  if (mode.kind === "none") return null;
  return (
    <>
      <div className="lm-or">{t("auth.or")}</div>
      {mode.kind === "gis" ? (
        <GisButton clientId={mode.clientId} />
      ) : (
        <DevGoogleButton />
      )}
    </>
  );
}
