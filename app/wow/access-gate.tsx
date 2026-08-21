"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StudioMark } from "../studio-mark";
import styles from "./wow.module.css";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "dark";
      size: "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": (errorCode?: string) => boolean | void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = Window & { turnstile?: TurnstileApi };
type SubmitState = "idle" | "submitting" | "error";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SITE_KEY = "0x4AAAAAAEFhAAW5N5kUh-aO";
let turnstilePromise: Promise<TurnstileApi> | null = null;

function turnstileApi() {
  return (window as TurnstileWindow).turnstile;
}

function loadTurnstile() {
  const ready = turnstileApi();
  if (ready) return Promise.resolve(ready);
  if (turnstilePromise) return turnstilePromise;

  turnstilePromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as
      | HTMLScriptElement
      | null;
    const script = existing || document.createElement("script");

    function handleLoad() {
      const api = turnstileApi();
      if (api) resolve(api);
      else reject(new Error("Security verification did not initialize."));
    }

    function handleError() {
      turnstilePromise = null;
      reject(new Error("Security verification could not be loaded."));
    }

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existing) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return turnstilePromise;
}

export function WowAccessGate() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [verificationReady, setVerificationReady] = useState(false);
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const turnstileWidget = useRef<string | null>(null);
  const turnstileToken = useRef("");

  useEffect(() => {
    let cancelled = false;

    void loadTurnstile()
      .then((api) => {
        if (cancelled || !turnstileContainer.current) return;
        turnstileWidget.current = api.render(turnstileContainer.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: "wow_access",
          theme: "dark",
          size: "flexible",
          callback: (token) => {
            turnstileToken.current = token;
            setVerificationReady(true);
            setMessage("");
          },
          "expired-callback": () => {
            turnstileToken.current = "";
            setVerificationReady(false);
            setMessage("The security check expired. Complete it again.");
          },
          "error-callback": () => {
            turnstileToken.current = "";
            setVerificationReady(false);
            setMessage("The security check could not be completed.");
            return true;
          },
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Security verification could not be loaded.",
          );
        }
      });

    return () => {
      cancelled = true;
      if (turnstileWidget.current) {
        turnstileApi()?.remove(turnstileWidget.current);
      }
      turnstileWidget.current = null;
      turnstileToken.current = "";
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setState("error");
      setMessage("Enter the six-digit code from your authenticator app.");
      return;
    }
    if (!turnstileToken.current) {
      setState("error");
      setMessage("Complete the security check first.");
      return;
    }

    setState("submitting");
    setMessage("");
    try {
      const response = await fetch("/wow/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          turnstileToken: turnstileToken.current,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Access could not be verified.");
      }
      window.location.replace("/wow");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Please try again.");
      turnstileToken.current = "";
      setVerificationReady(false);
      if (turnstileWidget.current) {
        turnstileApi()?.reset(turnstileWidget.current);
      }
    }
  }

  return (
    <main className={`${styles.page} ${styles.gatePage}`}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="IDI Studios home">
          <StudioMark />
        </Link>
        <span className={styles.accessLabel}>
          <i aria-hidden="true" /> Authenticator protected
        </span>
      </header>

      <section className={styles.gate} aria-labelledby="access-title">
        <div className={styles.ambient} aria-hidden="true">
          <span className={styles.ringOne} />
          <span className={styles.ringTwo} />
          <span className={styles.ringThree} />
        </div>

        <div className={styles.gatePanel}>
          <p className={styles.eyebrow}>IDI private realm / Secure access</p>
          <h1 id="access-title">Invitation<br /><span>required.</span></h1>
          <p className={styles.gateIntro}>
            Open Google Authenticator and enter the current six-digit code for
            Illidan&apos;s Visage.
          </p>

          <form className={styles.gateForm} onSubmit={handleSubmit}>
            <label htmlFor="wow-access-code">Authenticator code</label>
            <input
              id="wow-access-code"
              name="code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000 000"
              aria-describedby="wow-access-status"
              autoFocus
              required
            />
            <div className={styles.gateVerification} ref={turnstileContainer} />
            <button
              type="submit"
              disabled={state === "submitting" || !verificationReady || code.length !== 6}
            >
              {state === "submitting" ? "Verifying…" : "Unlock downloads"}
              <span aria-hidden="true">→</span>
            </button>
            <p
              id="wow-access-status"
              className={state === "error" ? styles.gateError : styles.gateStatus}
              role="status"
              aria-live="polite"
            >
              {message || "Codes refresh every 30 seconds."}
            </p>
          </form>
        </div>

        <p className={styles.coordinate}>IDI / AUTHENTICATOR GATE / 001</p>
      </section>
    </main>
  );
}
