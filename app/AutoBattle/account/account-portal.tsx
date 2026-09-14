"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AUTOBATTLE_PRODUCTS, formatUsd } from "../../autobattle-products";
import styles from "./account.module.css";
import { MarketplaceCheckout, type MarketplacePack } from "./marketplace-checkout";

type Account = {
  email: string;
  playerName: string;
  accessStatus: string;
  signupAffiliation: "not_provided" | "clan" | "individual";
  balances: { purchased: number; bonus: number; promotional: number; total: number };
  discount: null | { id: string; percentOff: number; remainingUses: number; unlimited: boolean };
  referral: {
    code: string;
    referredCount: number;
    cycleRewardCount: number;
    purchaseRewardCount: number;
    earnedCredits: number;
  };
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

type ReleaseArtifact = {
  versionName: string;
  apkBytes: number | null;
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

function formatReleaseSize(bytes: number | null) {
  return bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : "size shown at download";
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
    referral: "Referral credit",
  } as Record<string, string>)[type] || "Account activity";
}

function displayedPackPrice(pack: MarketplacePack, discount: Account["discount"]) {
  if (discount?.percentOff !== 50) return pack.priceCents;
  if (!discount.unlimited) return Math.ceil(pack.priceCents / 2);
  if (pack.sku === "tokens_5") return pack.priceCents;
  return Math.floor(pack.priceCents / 2);
}

function scrollViewportToTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  });
}

function normalizeReferralCode(value: string | null) {
  return (value || "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function AutoBattleAccountPortal({ release }: { release: ReleaseArtifact }) {
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
  const [referralCode, setReferralCode] = useState("");
  const turnstileNode = useRef<HTMLDivElement>(null);
  const turnstileId = useRef("");
  const turnstileToken = useRef("");
  const linkCodeNode = useRef<HTMLDivElement>(null);

  async function loadAccount() {
    const first = await fetch("/api/autobattle/account", { cache: "no-store" });
    if (first.ok) {
      const data = await responseJson<{ account: Account }>(first);
      setAccount(data.account);
      return data.account;
    }
    if (first.status !== 401) throw new Error("Your account could not be loaded.");
    const refreshed = await fetch("/api/autobattle/auth/refresh", { method: "POST" });
    if (!refreshed.ok) {
      setAccount(null);
      return null;
    }
    const data = await responseJson<{ account: Account }>(refreshed);
    setAccount(data.account);
    return data.account;
  }

  async function claimReferralCode(code: string) {
    const response = await fetch("/api/autobattle/referral/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    try {
      const data = await responseJson<{
        account: Account;
        claim: { claimed: boolean; alreadyClaimed: boolean };
      }>(response);
      setAccount(data.account);
      setReferralCode("");
      window.history.replaceState({}, "", "/AutoBattle/account");
      setMessage(data.claim.alreadyClaimed
        ? "This referral offer was already applied to your account."
        : "Referral applied: 30 free credits and 50% off your next purchase are ready.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That referral could not be applied.");
    }
  }

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const paymentReturn = search.get("payment") === "return";
    const paymentStatus = search.get("redirect_status");
    const requestedReferralCode = normalizeReferralCode(search.get("ref"));
    // Session discovery is the effect's external synchronization target.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAccount().then(async (loadedAccount) => {
      if (loadedAccount && requestedReferralCode.length === 12) {
        await claimReferralCode(requestedReferralCode);
      } else if (!loadedAccount && requestedReferralCode.length === 12) {
        setReferralCode(requestedReferralCode);
      }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Your account could not be loaded."))
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
      if (referralCode.length === 12) {
        await claimReferralCode(referralCode);
      } else {
        setMessage("You are signed in.");
      }
      scrollViewportToTop();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That code could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  async function copyReferralLink() {
    resetMessages();
    if (!account) return;
    const link = `${window.location.origin}/AutoBattle/account?ref=${account.referral.code}`;
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Invite link copied.");
    } catch {
      setError("Your browser could not copy the referral link. Open this page in a secure browser and try again.");
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

  async function saveSignupAffiliation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setBusy(true);
    const signupAffiliation = new FormData(event.currentTarget).get("signupAffiliation");
    try {
      const data = await responseJson<{ account: Account }>(await fetch("/api/autobattle/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupAffiliation }),
      }));
      setAccount(data.account);
      setMessage("Account type saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your account type could not be saved.");
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
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => linkCodeNode.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
      });
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
            Enter your email to create an account and request access, or to sign back in.
            No password to store, reuse, or forget.
          </p>
          <ul>
            <li>Purchased, bonus, and promotional tokens stay separate.</li>
            <li>Linked Android devices can be revoked at any time.</li>
            <li>One completed automation cycle uses one token.</li>
          </ul>
        </div>
        <div className={styles.authCard}>
          <p>{codeSent ? "Enter your code" : "Create or sign in"}</p>
          {referralCode && (
            <div className={styles.referralNotice}>
              <strong>Referral offer attached</strong>
              <span>30 free credits and 50% off one purchase will apply after sign-in.</span>
            </div>
          )}
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

  if (account.signupAffiliation === "not_provided") {
    return (
      <section className={styles.authShell}>
        <div className={styles.authIntro}>
          <p className={styles.eyebrow}>AutoBattle account / One-time setup</p>
          <h1>Tell us<br /><span>who you are.</span></h1>
          <p>
            Choose the account type that applies to you. A clan selection lets the
            AutoBattle team identify your account for review; it does not grant clan
            pricing until membership is verified.
          </p>
        </div>
        <div className={styles.authCard}>
          <p>Choose your account type</p>
          <form onSubmit={saveSignupAffiliation}>
            <fieldset className={styles.affiliationChoices}>
              <legend>Are you a clan member?</legend>
              <label className={styles.affiliationChoice}>
                <input type="radio" name="signupAffiliation" value="clan" required />
                <span><strong>Clan member</strong><small>I am joining through the clan.</small></span>
              </label>
              <label className={styles.affiliationChoice}>
                <input type="radio" name="signupAffiliation" value="individual" required />
                <span><strong>Individual</strong><small>I am not joining as a clan member.</small></span>
              </label>
            </fieldset>
            <button disabled={busy}>{busy ? "Saving…" : "Continue to my account"}<span>↗</span></button>
            <button type="button" className={styles.textButton} onClick={signOut} disabled={busy}>Sign out</button>
          </form>
          {(message || error) && <p className={error ? styles.error : styles.message} role="status">{error || message}</p>}
        </div>
      </section>
    );
  }

  const accessLabel = ({ pending: "Awaiting access", beta: "Beta access", active: "Active", suspended: "Suspended" } as Record<string, string>)[account.accessStatus] || account.accessStatus;
  const releaseAccess = ["beta", "active"].includes(account.accessStatus);

  return (
    <section className={styles.dashboard}>
      <div className={styles.accountHeading}>
        <div>
          <p className={styles.eyebrow}>AutoBattle account</p>
          <div className={styles.playerHeadingLine}>
            <h1>{account.playerName || "Set your"}<br /><span>{account.playerName ? "command center." : "player name."}</span></h1>
            {account.discount?.unlimited ? (
              <span
                className={`${styles.clanTag} ${styles.clanTagVerified}`}
                title={`Permanent ${account.discount.percentOff}% clan discount`}
              >
                Clan verified
              </span>
            ) : (
              <details className={styles.clanOfferTag}>
                <summary className={styles.clanTag}>Clan offer</summary>
                <div className={styles.clanOfferPopover}>
                  <strong>Unlock your permanent clan price</strong>
                  {account.discount && <p>Your one-time referral discount is active. A clan invite makes the discount permanent.</p>}
                  <form onSubmit={redeemInvite}>
                    <input
                      aria-label="Clan invite code"
                      name="inviteCode"
                      autoComplete="off"
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      maxLength={24}
                      required
                    />
                    <button disabled={busy || !account.playerName}>Redeem</button>
                  </form>
                </div>
              </details>
            )}
          </div>
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
            ? "Your permanent founding-clan price is applied to every pack above the $0.99 starter pack. Every pack keeps its normal bonus."
            : account.discount?.percentOff === 50
              ? "Your one-time referral price is applied below. Every pack keeps its normal bonus."
              : "Pay without leaving AutoBattle. Your billing address and included tax are reviewed before you confirm."}
        </p>
      </div>
      <div className={styles.storeGrid}>
        {AUTOBATTLE_PRODUCTS.map((pack) => {
          const discountedPrice = displayedPackPrice(pack, account.discount);
          return (
            <article className={pack.featured ? `${styles.storePack} ${styles.storePackFeatured}` : styles.storePack} key={pack.sku}>
              {pack.featured && <span className={styles.storeFlag}>Best value</span>}
              <div><strong>{pack.paidTokens}</strong><span>Purchased tokens</span></div>
              <p>{pack.bonusTokens ? `+ ${pack.bonusTokens} bonus tokens` : "Starter pack"}</p>
              <div className={styles.storePrice}>
                {discountedPrice < pack.priceCents && <del>{formatUsd(pack.priceCents)}</del>}
                <strong>{formatUsd(discountedPrice)}</strong>
                <small>{discountedPrice < pack.priceCents
                  ? account.discount?.unlimited ? "Founding clan · 50% off" : "Referral offer · 50% off once"
                  : "Tax calculated and included"}</small>
              </div>
              <button
                type="button"
                onClick={() => beginMarketplace({
                  sku: pack.sku,
                  paidTokens: pack.paidTokens,
                  bonusTokens: pack.bonusTokens,
                  priceCents: discountedPrice,
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
          <p className={styles.panelLabel}>Refer a friend</p>
          <h2>Give 30. Earn up to 60.</h2>
          <p>
            Your friend receives 30 free credits and 50% off one purchase. You receive 30 credits
            after their first completed cycle, plus 30 more after their first verified purchase.
            Refer as many different people as you like; each verified email can claim the signup offer once.
          </p>
          <div className={styles.referralStats}>
            <span>{account.referral.referredCount} referred · {account.referral.earnedCredits} credits earned</span>
            <small>Your unique referral offer is included automatically in the invite link.</small>
          </div>
          <button type="button" onClick={copyReferralLink} disabled={busy}>Copy invite link</button>
        </article>

        <article className={styles.panel}>
          <p className={styles.panelLabel}>Android access</p>
          <h2 id="download">Download and link AutoBattle</h2>
          {releaseAccess ? (
            <div className={styles.releaseDownload}>
              <a href="/api/autobattle/download">Download AutoBattle <span aria-hidden="true">↓</span></a>
              <small>Version {release.versionName} · Android 8 or newer · {formatReleaseSize(release.apkBytes)}</small>
            </div>
          ) : (
            <p className={styles.releaseLocked}>The Android download unlocks when your account is approved.</p>
          )}
          <p>Generate a one-time code, then enter it in AutoBattle under Settings → Account. It expires after 10 minutes.</p>
          {linkCode ? (
            <div className={styles.linkCode} ref={linkCodeNode} aria-live="polite">
              <strong>{linkCode.code}</strong>
              <span>Expires {formatDate(linkCode.expiresAt)}</span>
              <button type="button" onClick={generateLinkCode} disabled={busy}>
                {busy ? "Refreshing…" : "Refresh code"}
              </button>
            </div>
          ) : (
            <button type="button" onClick={generateLinkCode} disabled={busy || !account.playerName || !releaseAccess}>Generate device code</button>
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
