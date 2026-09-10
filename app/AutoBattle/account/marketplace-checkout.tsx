"use client";

import {
  AddressElement,
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatUsd } from "../../autobattle-products";
import styles from "./account.module.css";

export type MarketplacePack = {
  sku: string;
  paidTokens: number;
  bonusTokens: number;
  priceCents: number;
};

type PreparedPayment = {
  clientSecret: string;
  confirmationTokenId: string;
  quote: {
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    currency: string;
  };
};

async function responseJson<T>(response: Response) {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "The payment could not be prepared.");
  return body;
}

function MarketplacePaymentForm({
  accountEmail,
  pack,
  onClose,
  onPaymentSubmitted,
}: {
  accountEmail: string;
  pack: MarketplacePack;
  onClose: () => void;
  onPaymentSubmitted: (status: "succeeded" | "processing") => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const attemptKey = useRef("");
  const [confirmationTokenId, setConfirmationTokenId] = useState("");
  const [prepared, setPrepared] = useState<PreparedPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reviewPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError("");
    try {
      const submit = await elements.submit();
      if (submit.error) throw new Error(submit.error.message);

      let tokenId = confirmationTokenId;
      if (!tokenId) {
        const tokenResult = await stripe.createConfirmationToken({
          elements,
          params: {
            payment_method_data: { billing_details: { email: accountEmail } },
          },
        });
        if (tokenResult.error) throw new Error(tokenResult.error.message);
        tokenId = tokenResult.confirmationToken.id;
        setConfirmationTokenId(tokenId);
      }
      if (!attemptKey.current) attemptKey.current = crypto.randomUUID();

      const result = await responseJson<{
        clientSecret: string;
        quote: PreparedPayment["quote"];
      }>(await fetch("/api/autobattle/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: pack.sku,
          idempotencyKey: attemptKey.current,
          confirmationTokenId: tokenId,
        }),
      }));
      setPrepared({
        clientSecret: result.clientSecret,
        confirmationTokenId: tokenId,
        quote: result.quote,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The payment could not be reviewed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment() {
    if (!stripe || !prepared || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await stripe.confirmPayment({
        clientSecret: prepared.clientSecret,
        confirmParams: {
          confirmation_token: prepared.confirmationTokenId,
          return_url: `${window.location.origin}/AutoBattle/account?payment=return`,
        },
        redirect: "if_required",
      });
      if (result.error) throw new Error(result.error.message);
      if (result.paymentIntent?.status === "succeeded") {
        onPaymentSubmitted("succeeded");
      } else if (result.paymentIntent?.status === "processing") {
        onPaymentSubmitted("processing");
      } else {
        throw new Error("The payment was not completed. Review the payment method and try again.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The payment could not be completed.");
      setBusy(false);
    }
  }

  function changeDetails() {
    setPrepared(null);
    setConfirmationTokenId("");
    attemptKey.current = "";
    setError("");
  }

  if (prepared) {
    return (
      <div className={styles.checkoutReview}>
        <div className={styles.checkoutReviewHeading}>
          <p>Review total</p>
          <strong>{pack.paidTokens} AutoBattle tokens</strong>
          {pack.bonusTokens ? <span>Includes {pack.bonusTokens} bonus tokens</span> : null}
        </div>
        <dl className={styles.checkoutTotals}>
          <div><dt>Pack price</dt><dd>{formatUsd(prepared.quote.subtotalCents)}</dd></div>
          <div><dt>Included tax</dt><dd>{formatUsd(prepared.quote.taxCents)}</dd></div>
          <div><dt>Total</dt><dd>{formatUsd(prepared.quote.totalCents)}</dd></div>
        </dl>
        {error ? <p className={styles.checkoutError} role="alert">{error}</p> : null}
        <div className={styles.checkoutActions}>
          <button type="button" className={styles.checkoutSecondary} onClick={changeDetails} disabled={busy}>
            Change details
          </button>
          <button type="button" onClick={confirmPayment} disabled={busy}>
            {busy ? "Processing…" : `Pay ${formatUsd(prepared.quote.totalCents)}`}
          </button>
        </div>
        <small className={styles.checkoutLegal}>Tokens are granted only after Stripe confirms payment to our signed webhook.</small>
      </div>
    );
  }

  return (
    <form className={styles.checkoutForm} onSubmit={reviewPayment}>
      <div className={styles.checkoutElementGroup}>
        <span>Billing address</span>
        <AddressElement options={{ mode: "billing" }} />
      </div>
      <div className={styles.checkoutElementGroup}>
        <span>Payment method</span>
        <PaymentElement
          options={{
            layout: "tabs",
            defaultValues: { billingDetails: { email: accountEmail } },
            fields: { billingDetails: { address: "never" } },
          }}
        />
      </div>
      {error ? <p className={styles.checkoutError} role="alert">{error}</p> : null}
      <div className={styles.checkoutActions}>
        <button type="button" className={styles.checkoutSecondary} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="submit" disabled={!stripe || !elements || busy}>
          {busy ? "Calculating…" : "Review total"}
        </button>
      </div>
    </form>
  );
}

export function MarketplaceCheckout({
  accountEmail,
  pack,
  publishableKey,
  onClose,
  onPaymentSubmitted,
}: {
  accountEmail: string;
  pack: MarketplacePack;
  publishableKey: string;
  onClose: () => void;
  onPaymentSubmitted: (status: "succeeded" | "processing") => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const stripe = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  const options = useMemo(() => ({
    mode: "payment" as const,
    amount: pack.priceCents,
    currency: "usd",
    appearance: {
      theme: "night" as const,
      variables: {
        colorPrimary: "#f0c765",
        colorBackground: "#080c0f",
        colorText: "#e6e0d3",
        colorDanger: "#ff8b91",
        borderRadius: "2px",
        fontFamily: "Arial, sans-serif",
      },
    },
  }), [pack.priceCents]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className={styles.checkoutBackdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={styles.checkoutDialog} role="dialog" aria-modal="true" aria-labelledby="marketplace-checkout-title">
        <header className={styles.checkoutHeading}>
          <div>
            <p className={styles.eyebrow}>AutoBattle marketplace</p>
            <h2 id="marketplace-checkout-title">Complete your purchase.</h2>
            <span>{pack.paidTokens} tokens{pack.bonusTokens ? ` + ${pack.bonusTokens} bonus` : ""}</span>
          </div>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Close marketplace checkout">×</button>
        </header>
        <Elements stripe={stripe} options={options}>
          <MarketplacePaymentForm
            accountEmail={accountEmail}
            pack={pack}
            onClose={onClose}
            onPaymentSubmitted={onPaymentSubmitted}
          />
        </Elements>
      </section>
    </div>
  );
}
