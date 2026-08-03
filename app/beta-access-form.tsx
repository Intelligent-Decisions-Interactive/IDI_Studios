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

const OPEN_BETA_EVENT = "idi:open-beta-access";

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
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

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

  function closeModal() {
    setIsOpen(false);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
    window.setTimeout(() => {
      formRef.current?.reset();
      setState("idle");
      setMessage("");
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
    setState("submitting");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

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
            <h2 id="beta-access-title" tabIndex={-1} ref={successHeadingRef}>You&apos;re on<br /><em>the list.</em></h2>
            <p>Your Conquest: Ascension beta request has been submitted. {message}</p>
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
              <div className="beta-form-footer">
                <p>One request per player. Testing access is limited and not guaranteed.</p>
                <button type="submit" disabled={state === "submitting"}>
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
