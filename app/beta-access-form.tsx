"use client";

import {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

type SubmitState = "idle" | "submitting" | "success" | "error";

type BetaAccessTriggerProps = {
  children: ReactNode;
  className?: string;
};

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

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const OPEN_BETA_EVENT = "idi:open-beta-access";
const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SITE_KEY = "0x4AAAAAAEFhAAW5N5kUh-aO";
let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as
      | HTMLScriptElement
      | null;
    const script = existing || document.createElement("script");

    function handleLoad() {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Security verification did not initialize."));
    }

    function handleError() {
      turnstileScriptPromise = null;
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

  return turnstileScriptPromise;
}

export function BetaAccessTrigger({ children, className }: BetaAccessTriggerProps) {
  return (
    <button
      type="button"
      className={`beta-access-trigger${className ? ` ${className}` : ""}`}
      aria-haspopup="dialog"
      aria-controls="beta-access-modal"
      onClick={() => window.dispatchEvent(new Event(OPEN_BETA_EVENT))}
    >
      {children}
    </button>
  );
}

export function BetaAccessModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationReady, setVerificationReady] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const turnstileTokenRef = useRef("");

  function removeTurnstile() {
    if (turnstileWidgetRef.current && window.turnstile) {
      window.turnstile.remove(turnstileWidgetRef.current);
    }
    turnstileWidgetRef.current = null;
    turnstileTokenRef.current = "";
  }

  useEffect(() => {
    function openModal() {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setIsOpen(true);
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    }

    window.addEventListener(OPEN_BETA_EVENT, openModal);
    return () => window.removeEventListener(OPEN_BETA_EVENT, openModal);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("beta-modal-open", isOpen);
    return () => document.body.classList.remove("beta-modal-open");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function prepareVerification() {
      setVerificationLoading(true);
      setVerificationReady(false);
      setMessage("");

      try {
        const turnstile = await loadTurnstile();
        if (cancelled || !turnstileContainerRef.current) return;
        removeTurnstile();
        turnstileWidgetRef.current = turnstile.render(
          turnstileContainerRef.current,
          {
            sitekey: TURNSTILE_SITE_KEY,
            action: "beta_access",
            theme: "dark",
            size: "flexible",
            callback: (token) => {
              turnstileTokenRef.current = token;
              setVerificationReady(true);
              setMessage("");
            },
            "expired-callback": () => {
              turnstileTokenRef.current = "";
              setVerificationReady(false);
              setMessage("The security check expired. Complete it again.");
            },
            "error-callback": (errorCode) => {
              turnstileTokenRef.current = "";
              setVerificationReady(false);
              console.warn("Cloudflare Turnstile could not initialize", errorCode);
              setMessage(
                errorCode?.startsWith("110200")
                  ? "Beta requests are not authorized on this hostname yet."
                  : "The security check could not be completed.",
              );
              return true;
            },
          },
        );
      } catch (error) {
        if (!cancelled) {
          setVerificationReady(false);
          setState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Security verification could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setVerificationLoading(false);
      }
    }

    void prepareVerification();
    return () => {
      cancelled = true;
      removeTurnstile();
    };
  }, [isOpen]);

  function closeModal() {
    removeTurnstile();
    setIsOpen(false);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
    window.setTimeout(() => {
      formRef.current?.reset();
      setState("idle");
      setMessage("");
      setVerificationLoading(false);
      setVerificationReady(false);
    }, 180);
  }

  function handleModalKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key !== "Tab" || !panelRef.current) return;

    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hidden && element.offsetParent !== null);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!turnstileTokenRef.current) {
      setState("error");
      setMessage("Complete the security check before submitting.");
      return;
    }

    setState("submitting");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      ...Object.fromEntries(formData.entries()),
      turnstileToken: turnstileTokenRef.current,
    };

    try {
      const response = await fetch("/api/beta-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        emailSent?: boolean;
      };

      if (!response.ok) {
        throw new Error(result.error || "We could not save your request.");
      }

      form.reset();
      removeTurnstile();
      setState("success");
      setMessage(
        result.emailSent
          ? "Check your inbox for confirmation."
          : "We will be in touch when a testing wave fits.",
      );
      window.requestAnimationFrame(() => successHeadingRef.current?.focus());
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Please try again.");
      turnstileTokenRef.current = "";
      setVerificationReady(false);
      if (turnstileWidgetRef.current) {
        window.turnstile?.reset(turnstileWidgetRef.current);
      }
    }
  }

  return (
    <div
      id="beta-access-modal"
      className="beta-modal"
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
      aria-labelledby="beta-access-title"
      hidden={!isOpen}
      onKeyDown={handleModalKeyDown}
    >
      <button
        type="button"
        className="beta-modal-backdrop"
        aria-label="Close beta access form"
        onClick={closeModal}
        tabIndex={-1}
      />

      <div className="beta-modal-panel" role="document" ref={panelRef}>
        <button
          type="button"
          className="beta-modal-close"
          aria-label="Close beta access form"
          onClick={closeModal}
          ref={closeButtonRef}
        >
          <span aria-hidden="true">×</span>
        </button>

        {state === "success" ? (
          <div className="beta-success">
            <p className="scribble">Request received</p>
            <h2 id="beta-access-title" tabIndex={-1} ref={successHeadingRef}>
              You&apos;re on<br /><em>the list.</em>
            </h2>
            <p>
              Your Conquest: Ascension beta request has been submitted. {message}
            </p>
            <button type="button" className="beta-modal-action" onClick={closeModal}>
              Close <span aria-hidden="true">×</span>
            </button>
          </div>
        ) : (
          <div className="beta-form-view">
            <p className="scribble">Limited Android testing waves</p>
            <h2 id="beta-access-title">Request beta<br /><em>access.</em></h2>
            <p className="beta-modal-intro">
              Tell us what Android device you use and what you most want to test in Conquest: Ascension.
            </p>

            <form className="beta-form" onSubmit={handleSubmit} ref={formRef}>
              <div className="beta-form-grid">
                <label>
                  <span>Name</span>
                  <input name="name" type="text" autoComplete="name" maxLength={80} required />
                </label>
                <label>
                  <span>Email</span>
                  <input name="email" type="email" autoComplete="email" maxLength={160} required />
                </label>
                <label className="beta-form-wide">
                  <span>Android device</span>
                  <input
                    name="androidDevice"
                    type="text"
                    placeholder="Example: Pixel 9 Pro"
                    maxLength={120}
                    required
                  />
                </label>
                <label className="beta-form-wide">
                  <span>What do you most want to test?</span>
                  <textarea name="testingFocus" rows={4} maxLength={1200} required />
                </label>
                <label className="beta-form-trap" aria-hidden="true">
                  <span>Website</span>
                  <input name="website" type="text" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <div
                className="beta-form-verification"
                aria-busy={verificationLoading}
              >
                <div ref={turnstileContainerRef} />
                {verificationLoading ? <span>Loading security check…</span> : null}
              </div>

              <div className="beta-form-footer">
                <p>One request per player. Testing access is limited and not guaranteed.</p>
                <button
                  type="submit"
                  disabled={
                    state === "submitting" ||
                    verificationLoading ||
                    !verificationReady
                  }
                >
                  {state === "submitting" ? "Sending request…" : "Request beta access"}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
              <p
                className={`beta-form-status${state === "error" ? " is-error" : ""}`}
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
