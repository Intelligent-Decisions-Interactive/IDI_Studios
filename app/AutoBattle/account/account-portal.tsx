"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AUTOBATTLE_PRODUCTS, formatUsd } from "../../autobattle-products";
import styles from "./account.module.css";
import { MarketplaceCheckout, type MarketplacePack } from "./marketplace-checkout";

type Account = {
  email: string;
  playerName: string;
  accessStatus: string;
  balances: { purchased: number; bonus: number; promotional: number; total: number };
  discount: null | { id: string; percentOff: number; remainingUses: number; unlimited: boolean };
  devices: Array<{ id: string; name: string; expiresAt: string; lastSeenAt: string; createdAt: string }>;
  activity: Array<{
    id: string;
    type: string;
    status: string;
    purchasedDelta: number;
    bonusDelta: number;
    promotionalDelta: number;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
};

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_KEY = "0x4AAAAAAEFhAAW5N5kUh-aO";

function turnstileApi() {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}

async function responseJson<T>(response: Response) {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "The request could not be completed.");
  return body;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function activityAmount(entry: Account["activity"][number]) {
  return entry.purchasedDelta + entry.bonusDelta + entry.promotionalDelta;
}

function activityLabel(type: string) {
  return ({
    admin_grant: "Token grant",
    clan_grant: "Founding clan offer",
    purchase: "Token purchase",
    cycle: "Automation cycle",
    refund: "Token refund",
    adjustment: "Account adjustment",
  } as Record<string, string>)[type] || "Account activity";
}

export function AutoBattleAccountPortal() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [checkoutSku, setCheckoutSku] = useState("");
  const [marketplace, setMarketplace] = useState<null | {
    pack: MarketplacePack;
    publishableKey: string;
  }>(null);
  const [linkCode, setLinkCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const turnstileNode = useRef<HTMLDivElement>(null);
  const turnstileId = useRef("");
  const turnstileToken = useRef("");

  async function loadAccount() {
    const first = await fetch("/api/autobattle/account", { cache: "no-store" });
    if (first.ok) {
      const data = await responseJson<{ account: Account }>(first);
      setAccount(data.account);
      return;
    }
    if (first.status !== 401) throw new Error("Your account could not be loaded.");
    const refreshed = await fetch("/api/autobattle/auth/refresh", { method: "POST" });
    if (!refreshed.ok) {
      setAccount(null);
      return;
    }
    const data = await responseJson<{ account: Account }>(refreshed);
    setAccount(data.account);
  }

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const paymentReturn = search.get("payment") === "return";
    const paymentStatus = search.get("redirect_status");
    // Session discovery is the effect's external synchronization target.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAccount().catch((reason) => setError(reason instanceof Error ? reason.message : "Your account could not be loaded."))
      .finally(() => {
        setLoading(false);
        if (paymentReturn) {
          setMessage(paymentStatus === "succeeded"
            ? "Payment approved. Tokens appear after Stripe's signed payment confirmation; refresh shortly if they are still processing."
            : "Payment returned to AutoBattle. Check your token activity for the final status.");
        }
        if (paymentReturn) window.history.replaceState({}, "", "/AutoBattle/account");
      });
  }, []);

  useEffect(() => {
    if (loading || account || codeSent || !turnstileNode.current) return;
    let cancelled = false;

    function render() {
      const api = turnstileApi();
      if (!api || !turnstileNode.current || cancelled || turnstileId.current) return;
      turnstileId.current = api.render(turnstileNode.current, {
        sitekey: TURNSTILE_KEY,
        action: "autobattle_account",
        theme: "dark",
        size: "flexible",
        callback: (token: string) => {
          turnstileToken.current = token;
          setError("");
        },
        "expired-callback": () => { turnstileToken.current = ""; },
        "error-callback": () => {
          turnstileToken.current = "";
          setError("The security check could not be completed.");
          return true;
        },
      });
    }

    if (turnstileApi()) render();
    else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = TURNSTILE_SCRIPT;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render, { once: true });
    }
    return () => {
      cancelled = true;
      if (turnstileId.current) turnstileApi()?.remove(turnstileId.current);
      turnstileId.current = "";
      turnstileToken.current = "";
    };
  }, [account, codeSent, loading]);

  function resetMessages() {
    setMessage("");
    setError("");
  }

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    if (!turnstileToken.current) {
      setError("Complete the security check first.");
      return;
    }
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await responseJson(await fetch("/api/autobattle/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          website: form.get("website"),
          turnstileToken: turnstileToken.current,
        }),
      }));
      setCodeSent(true);
      setMessage("A six-digit sign-in code is on its way.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "A code could not be sent.");
      turnstileToken.current = "";
      turnstileApi()?.reset(turnstileId.current);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const data = await responseJson<{ account: Account }>(await fetch("/api/autobattle/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: form.get("code") }),
      }));
      setAccount(data.account);
      setCodeSent(false);
      setMessage("You are signed in.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That code could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  async function savePlayerName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setBusy(true);
    const playerName = new FormData(event.currentTarget).get("playerName");
    try {
      const data = await responseJson<{ account: Account }>(await fetch("/api/autobattle/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName }),
      }));
      setAccount(data.account);
      setMessage("Player name saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your player name could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function redeemInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setBusy(true);
    const form = event.currentTarget;
    try {
      const data = await responseJson<{ account: Account }>(await fetch("/api/autobattle/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: new FormData(form).get("inviteCode") }),
      }));
      setAccount(data.account);
      form.reset();
      setMessage("Clan offer redeemed. Your 30 starting tokens and permanent clan price are ready.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That invite could not be redeemed.");
    } finally {
      setBusy(false);
    }
  }

  async function generateLinkCode() {
    resetMessages();
    setBusy(true);
    try {
      const data = await responseJson<{ code: string; expiresAt: string }>(await fetch(
        "/api/autobattle/devices/link-code",
        { method: "POST" },
      ));
      setLinkCode(data);
      setMessage("Enter this code in AutoBattle on the device you want to link.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "A link code could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeDevice(id: string) {
    resetMessages();
    setBusy(true);
    try {
      const data = await responseJson<{ account: Account }>(await fetch(`/api/autobattle/devices/${id}`, {
        method: "DELETE",
      }));
      setAccount(data.account);
      setMessage("Device access revoked.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That device could not be revoked.");
    } finally {
      setBusy(false);
    }
  }

  async function beginMarketplace(pack: MarketplacePack) {
    resetMessages();
    setBusy(true);
    setCheckoutSku(pack.sku);
    try {
      const data = await responseJson<{ publishableKey: string }>(await fetch(
        "/api/autobattle/payment-intent",
        { cache: "no-store" },
      ));
      setMarketplace({ pack, publishableKey: data.publishableKey });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The marketplace could not be opened.");
    } finally {
      setBusy(false);
      setCheckoutSku("");
    }
  }

  function paymentSubmitted(status: "succeeded" | "processing") {
    setMarketplace(null);
    setMessage(status === "succeeded"
      ? "Payment approved. Tokens will appear after Stripe's signed confirmation reaches AutoBattle."
      : "Payment is processing. Tokens will appear after Stripe confirms it.");
    window.setTimeout(() => {
      loadAccount().catch((reason) => setError(
        reason instanceof Error ? reason.message : "Your token balance could not be refreshed.",
      ));
    }, 1500);
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/autobattle/auth/logout", { method: "POST" });
    } finally {
      setAccount(null);
      setLinkCode(null);
      setMarketplace(null);
      setMessage("");
      setError("");
      setBusy(false);
    }
  }

  if (loading) {
    return <section className={styles.loading}><span /> Loading your AutoBattle account…</section>;
  }

  if (!account) {
    return (
      <section className={styles.authShell}>
        <div className={styles.authIntro}>
          <p className={styles.eyebrow}>AutoBattle account / Secure access</p>
          <h1>Your cycles.<br /><span>Your devices.</span></h1>
          <p>
            Sign in with a one-time email code. No password to store, reuse, or forget.
            Use the email connected to your beta or clan request.
          </p>
          <ul>
            <li>Purchased, bonus, and promotional tokens stay separate.</li>
            <li>Linked Android devices can be revoked at any time.</li>
            <li>One completed automation cycle uses one token.</li>
          </ul>
        </div>
        <div className={styles.authCard}>
          <p>{codeSent ? "Enter your code" : "Sign in or create account"}</p>
          {codeSent ? (
            <form onSubmit={verifyCode}>
              <label>Email<input value={email} readOnly /></label>
              <label>Six-digit code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus /></label>
              <button disabled={busy}>{busy ? "Verifying…" : "Open my account"}<span>↗</span></button>
              <button type="button" className={styles.textButton} onClick={() => { setCodeSent(false); resetMessages(); }} disabled={busy}>Use a different email</button>
            </form>
          ) : (
            <form onSubmit={requestCode}>
              <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required /></label>
              <label className={styles.trap} aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
              <div className={styles.turnstile} ref={turnstileNode} />
              <button disabled={busy}>{busy ? "Sending…" : "Email me a code"}<span>↗</span></button>
            </form>
          )}
          {(message || error) && <p className={error ? styles.error : styles.message} role="status">{error || message}</p>}
        </div>
      </section>
    );
  }

  const accessLabel = ({ pending: "Awaiting access", beta: "Beta access", active: "Active", suspended: "Suspended" } as Record<string, string>)[account.accessStatus] || account.accessStatus;

  return (
    <section className={styles.dashboard}>
      <div className={styles.accountHeading}>
        <div>
          <p className={styles.eyebrow}>AutoBattle account</p>
          <h1>{account.playerName || "Set your"}<br /><span>{account.playerName ? "command center." : "player name."}</span></h1>
          <p>{account.email}</p>
        </div>
        <div className={styles.accountActions}>
          <span className={`${styles.status} ${styles[`status_${account.accessStatus}`] || ""}`}>{accessLabel}</span>
          <button type="button" onClick={signOut} disabled={busy}>Sign out</button>
        </div>
      </div>

      {(message || error) && <p className={error ? styles.errorBanner : styles.messageBanner} role="status">{error || message}</p>}

      {!account.playerName && (
        <form className={styles.setupCard} onSubmit={savePlayerName}>
          <div><strong>Choose your player name</strong><span>Use the name players see in game.</span></div>
          <input name="playerName" autoComplete="nickname" maxLength={80} required />
          <button disabled={busy}>Save player name</button>
        </form>
      )}

      <div className={styles.balanceHeader}>
        <div><p className={styles.eyebrow}>Token balance</p><h2>{account.balances.total}<span> cycles ready</span></h2></div>
        <a href="/AutoBattle#tokens">View token packs ↗</a>
      </div>
      <div className={styles.balanceGrid}>
        <article><span>Purchased</span><strong>{account.balances.purchased}</strong><small>Tokens you bought</small></article>
        <article><span>Bonus</span><strong>{account.balances.bonus}</strong><small>Pack bonus tokens</small></article>
        <article><span>Promotional</span><strong>{account.balances.promotional}</strong><small>Launch and offer tokens</small></article>
        <article className={styles.totalBalance}><span>Total</span><strong>{account.balances.total}</strong><small>One token per completed cycle</small></article>
      </div>

      <div className={styles.storeHeader} id="token-packs">
        <div>
          <p className={styles.eyebrow}>Token packs</p>
          <h2>Choose your next cycles.</h2>
        </div>
        <p>
          {account.discount?.unlimited && account.discount.percentOff === 50
            ? "Your permanent founding-clan price is applied below. Every pack keeps its normal bonus."
            : "Pay without leaving AutoBattle. Your billing address and included tax are reviewed before you confirm."}
        </p>
      </div>
      <div className={styles.storeGrid}>
        {AUTOBATTLE_PRODUCTS.map((pack) => {
          const clanPrice = account.discount?.unlimited && account.discount.percentOff === 50
            ? Math.ceil(pack.priceCents / 2)
            : pack.priceCents;
          return (
            <article className={pack.featured ? `${styles.storePack} ${styles.storePackFeatured}` : styles.storePack} key={pack.sku}>
              {pack.featured && <span className={styles.storeFlag}>Best value</span>}
              <div><strong>{pack.paidTokens}</strong><span>Purchased tokens</span></div>
              <p>{pack.bonusTokens ? `+ ${pack.bonusTokens} bonus tokens` : "Starter pack"}</p>
              <div className={styles.storePrice}>
                {clanPrice < pack.priceCents && <del>{formatUsd(pack.priceCents)}</del>}
                <strong>{formatUsd(clanPrice)}</strong>
                <small>{clanPrice < pack.priceCents ? "Founding clan · 50% off" : "Tax calculated and included"}</small>
              </div>
              <button
                type="button"
                onClick={() => beginMarketplace({
                  sku: pack.sku,
                  paidTokens: pack.paidTokens,
                  bonusTokens: pack.bonusTokens,
                  priceCents: clanPrice,
                })}
                disabled={busy || account.accessStatus === "suspended"}
              >
                {checkoutSku === pack.sku ? "Preparing…" : "Buy tokens"}<span aria-hidden="true">→</span>
              </button>
            </article>
          );
        })}
      </div>
      <p className={styles.storeNote}>
        Tokens are credited only from a verified Stripe webhook. If automatic fulfillment is delayed, support can safely record the same purchase through the existing manual fallback without duplicating tokens.
      </p>

      {marketplace ? (
        <MarketplaceCheckout
          accountEmail={account.email}
          pack={marketplace.pack}
          publishableKey={marketplace.publishableKey}
          onClose={() => setMarketplace(null)}
          onPaymentSubmitted={paymentSubmitted}
        />
      ) : null}

      <div className={styles.dashboardGrid}>
        <article className={styles.panel}>
          <p className={styles.panelLabel}>Clan offer</p>
          <h2>{account.discount ? `Permanent ${account.discount.percentOff}% clan discount` : "Redeem your invite"}</h2>
          {account.discount ? (
            <p>Your clan price applies to every token pack. Each pack keeps its normal bonus tokens.</p>
          ) : (
            <form onSubmit={redeemInvite}>
              <label>Invite code<input name="inviteCode" autoComplete="off" placeholder="XXXX-XXXX-XXXX-XXXX" maxLength={24} required /></label>
              <button disabled={busy || !account.playerName}>Redeem offer</button>
            </form>
          )}
        </article>

        <article className={styles.panel}>
          <p className={styles.panelLabel}>Android access</p>
          <h2>Link AutoBattle</h2>
          <p>Generate a one-time code, then enter it in AutoBattle under Settings → Account. It expires after 10 minutes.</p>
          {linkCode ? (
            <div className={styles.linkCode}><strong>{linkCode.code}</strong><span>Expires {formatDate(linkCode.expiresAt)}</span></div>
          ) : (
            <button onClick={generateLinkCode} disabled={busy || !account.playerName || !["beta", "active"].includes(account.accessStatus)}>Generate device code</button>
          )}
        </article>
      </div>

      <div className={styles.detailGrid}>
        <article className={styles.detailPanel}>
          <div className={styles.detailHeading}><h2>Linked devices</h2><span>{account.devices.length} / 5</span></div>
          {account.devices.length ? account.devices.map((device) => (
            <div className={styles.deviceRow} key={device.id}>
              <div><strong>{device.name}</strong><span>Last seen {formatDate(device.lastSeenAt)}</span></div>
              <button onClick={() => revokeDevice(device.id)} disabled={busy}>Revoke</button>
            </div>
          )) : <p className={styles.empty}>No Android devices are linked yet.</p>}
        </article>

        <article className={styles.detailPanel}>
          <div className={styles.detailHeading}><h2>Token activity</h2><span>Latest 30</span></div>
          {account.activity.length ? account.activity.map((entry) => {
            const amount = activityAmount(entry);
            return (
              <div className={styles.activityRow} key={entry.id}>
                <div><strong>{activityLabel(entry.type)}</strong><span>{formatDate(entry.createdAt)} · {entry.status}</span></div>
                <b className={amount >= 0 ? styles.positive : styles.negative}>{amount >= 0 ? "+" : ""}{amount}</b>
              </div>
            );
          }) : <p className={styles.empty}>Your token activity will appear here.</p>}
        </article>
      </div>
    </section>
  );
}
