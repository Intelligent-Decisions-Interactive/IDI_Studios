"use client";

import { FormEvent, useState } from "react";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function BetaAccessForm() {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

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
          ? "Your request is in. Check your inbox for confirmation."
          : "Your request is in. We will be in touch when a testing wave fits.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <form className="beta-form" onSubmit={handleSubmit}>
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
  );
}
