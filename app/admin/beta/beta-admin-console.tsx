"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type BetaStatus = "pending" | "approved" | "invited" | "active" | "declined";

type BetaApplication = {
  id: number;
  name: string;
  email: string;
  androidDevice: string;
  testingFocus: string;
  status: BetaStatus;
  emailStatus: string;
  resendEmailId: string | null;
  adminEmailStatus: string;
  adminResendId: string | null;
  inviteEmailStatus: string;
  inviteResendId: string | null;
  lastEmailError: string | null;
  adminNotes: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  invitedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AutoBattleAccessStatus = "pending" | "beta" | "active" | "suspended";

export type BetaAdminProduct = "conquest" | "autobattle";

type AutoBattleAdminAccount = {
  userId: string;
  email: string;
  playerName: string;
  accessStatus: AutoBattleAccessStatus;
  clanMember: boolean;
  signupAffiliation: "not_provided" | "clan" | "individual";
  purchasedTokens: number;
  bonusTokens: number;
  promotionalTokens: number;
  totalTokens: number;
  canGrantTestCredits: boolean;
  createdAt: string;
  updatedAt: string;
};

type AutoBattlePaymentReview = {
  id: string;
  eventId: string;
  eventType: string;
  objectId: string;
  receivedAt: string;
  details: Record<string, unknown>;
  orderId: string;
  paymentIntentId: string;
  orderStatus: string;
  userId: string;
  email: string;
  playerName: string;
  accessStatus: AutoBattleAccessStatus;
};

type BetaEvent = {
  id: number;
  eventType: string;
  actorEmail: string;
  previousStatus: string | null;
  newStatus: string | null;
  details: string | null;
  createdAt: string;
};

type ListResponse = {
  applications: BetaApplication[];
  actorEmail: string;
  actorProvider: string;
  inviteEnabled: boolean;
};

type AutoBattleListResponse = {
  accounts: AutoBattleAdminAccount[];
  paymentReviews: AutoBattlePaymentReview[];
  actorEmail: string;
  actorProvider: string;
};

type DetailResponse = {
  application: BetaApplication;
  events: BetaEvent[];
  inviteEnabled: boolean;
};

const STATUS_OPTIONS: BetaStatus[] = [
  "pending",
  "approved",
  "invited",
  "active",
  "declined",
];

function formatDate(value: string | null, includeTime = true) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = (await response.json().catch(() => ({}))) as T & {
    success?: boolean;
    message?: string;
  };
  if (!response.ok || result.success === false) {
    throw new Error(result.message || `Request failed (${response.status}).`);
  }
  return result;
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="admin-status-pill" data-status={status}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function applicationProduct(application: BetaApplication) {
  if (application.testingFocus.startsWith("[AutoBattle clan access]")) {
    return "AutoBattle founding access";
  }
  if (application.testingFocus.startsWith("[AutoBattle public beta]")) {
    return "AutoBattle public beta";
  }
  return "Conquest: Ascension";
}

function applicationProductKey(application: BetaApplication): BetaAdminProduct {
  return application.testingFocus.startsWith("[AutoBattle")
    ? "autobattle"
    : "conquest";
}

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function BetaAdminConsole({
  actorEmail: initialActorEmail,
  actorProvider: initialActorProvider,
  product,
}: {
  actorEmail: string;
  actorProvider: string;
  product: BetaAdminProduct;
}) {
  const [applications, setApplications] = useState<BetaApplication[]>([]);
  const [autoBattleAccounts, setAutoBattleAccounts] = useState<AutoBattleAdminAccount[]>([]);
  const [paymentReviews, setPaymentReviews] = useState<AutoBattlePaymentReview[]>([]);
  const [paymentReviewAction, setPaymentReviewAction] = useState("");
  const [paymentReviewResolutions, setPaymentReviewResolutions] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<BetaApplication | null>(null);
  const [events, setEvents] = useState<BetaEvent[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actorEmail, setActorEmail] = useState(initialActorEmail);
  const [actorProvider, setActorProvider] = useState(initialActorProvider);
  const [inviteEnabled, setInviteEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");
  const [messageState, setMessageState] = useState<"" | "error" | "success">("");
  const [reviewStatus, setReviewStatus] = useState<BetaStatus>("pending");
  const [adminNotes, setAdminNotes] = useState("");
  const [clanCode, setClanCode] = useState("");
  const [autoBattleAction, setAutoBattleAction] = useState("");
  const [clanMembershipAction, setClanMembershipAction] = useState("");
  const [redemptionCodeAction, setRedemptionCodeAction] = useState("");
  const [testCreditAction, setTestCreditAction] = useState("");
  const [testCreditAmount, setTestCreditAmount] = useState("100");
  const [deleteAccountId, setDeleteAccountId] = useState("");
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState("");
  const [deleteAccountAction, setDeleteAccountAction] = useState("");
  const [autoBattleMessage, setAutoBattleMessage] = useState("");
  const [autoBattleMessageState, setAutoBattleMessageState] = useState<"" | "error" | "success">("");

  const mergeApplication = useCallback((application: BetaApplication) => {
    setApplications((current) =>
      current.map((item) => (item.id === application.id ? application : item)),
    );
    setSelected(application);
    setSelectedId(application.id);
    setReviewStatus(application.status);
    setAdminNotes(application.adminNotes || "");
  }, []);

  const selectApplication = useCallback(
    async (id: number) => {
      setSelectedId(id);
      setDetailLoading(true);
      setClanCode("");
      setMessage("");
      setMessageState("");
      try {
        const result = await apiRequest<DetailResponse>(`/beta/admin/api/requests/${id}`);
        mergeApplication(result.application);
        setEvents(result.events || []);
        setInviteEnabled(result.inviteEnabled);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load request.");
        setMessageState("error");
      } finally {
        setDetailLoading(false);
      }
    },
    [mergeApplication],
  );

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setMessageState("");
    setAutoBattleMessage("");
    setAutoBattleMessageState("");

    const formsRequest =
      product === "conquest"
        ? apiRequest<ListResponse>("/beta/admin/api/requests")
        : Promise.resolve<ListResponse | null>(null);
    const accountsRequest =
      product === "autobattle"
        ? apiRequest<AutoBattleListResponse>("/beta/admin/api/autobattle/accounts")
        : Promise.resolve<AutoBattleListResponse | null>(null);
    const [formsResult, accountsResult] = await Promise.allSettled([
      formsRequest,
      accountsRequest,
    ] as const);

    if (product === "conquest" && formsResult.status === "fulfilled" && formsResult.value) {
      const scopedApplications = (formsResult.value.applications || []).filter(
        (application) => applicationProductKey(application) === "conquest",
      );
      setApplications(scopedApplications);
      setActorEmail(formsResult.value.actorEmail || initialActorEmail);
      setActorProvider(formsResult.value.actorProvider || initialActorProvider);
      setInviteEnabled(formsResult.value.inviteEnabled);
      if (selectedId && scopedApplications.some((item) => item.id === selectedId)) {
        await selectApplication(selectedId);
      } else if (selectedId) {
        setSelectedId(null);
        setSelected(null);
        setEvents([]);
      }
    } else if (product === "conquest" && formsResult.status === "rejected") {
      setApplications([]);
      setSelectedId(null);
      setSelected(null);
      setEvents([]);
      setMessage(
        formsResult.reason instanceof Error
          ? formsResult.reason.message
          : "Unable to load requests.",
      );
      setMessageState("error");
    } else {
      setApplications([]);
      setSelectedId(null);
      setSelected(null);
      setEvents([]);
    }

    if (product === "autobattle") {
      if (accountsResult.status === "fulfilled" && accountsResult.value) {
        setAutoBattleAccounts(accountsResult.value.accounts || []);
        setPaymentReviews(accountsResult.value.paymentReviews || []);
        setActorEmail(accountsResult.value.actorEmail || initialActorEmail);
        setActorProvider(accountsResult.value.actorProvider || initialActorProvider);
      } else if (accountsResult.status === "rejected") {
        setAutoBattleAccounts([]);
        setPaymentReviews([]);
        setAutoBattleMessage(
          accountsResult.reason instanceof Error
            ? accountsResult.reason.message
            : "Unable to load AutoBattle accounts.",
        );
        setAutoBattleMessageState("error");
      }
    } else {
      setAutoBattleAccounts([]);
      setPaymentReviews([]);
    }

    setLoading(false);
  }, [initialActorEmail, initialActorProvider, product, selectApplication, selectedId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadApplications(), 0);
    // Product navigation reloads its own records; selection changes stay local.
    return () => window.clearTimeout(initialLoad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const counts = useMemo(() => {
    const result = applications.reduce(
      (result, application) => {
        result.total += 1;
        if (application.status === "pending") result.pending += 1;
        if (["approved", "invited", "active"].includes(application.status)) {
          result.accepted += 1;
        }
        return result;
      },
      { total: 0, pending: 0, accepted: 0 },
    );
    if (product === "autobattle") {
      for (const account of autoBattleAccounts) {
        result.total += 1;
        if (account.accessStatus === "pending") result.pending += 1;
        if (["beta", "active"].includes(account.accessStatus)) result.accepted += 1;
      }
      result.total += paymentReviews.length;
      result.pending += paymentReviews.length;
    }
    return result;
  }, [applications, autoBattleAccounts, paymentReviews, product]);

  const sortedAutoBattleAccounts = useMemo(
    () => [...autoBattleAccounts].sort((left, right) => {
      const leftPending = left.accessStatus === "pending" ? 0 : 1;
      const rightPending = right.accessStatus === "pending" ? 0 : 1;
      return leftPending - rightPending || right.createdAt.localeCompare(left.createdAt);
    }),
    [autoBattleAccounts],
  );

  const filteredApplications = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return applications.filter((application) => {
      const matchesStatus =
        statusFilter === "all" || application.status === statusFilter;
      const haystack = [
        application.name,
        application.email,
        application.androidDevice,
        application.testingFocus,
      ]
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [applications, query, statusFilter]);

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setAction("review");
    setMessage("Saving review…");
    setMessageState("");
    try {
      const result = await apiRequest<DetailResponse>(
        `/beta/admin/api/requests/${selected.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: reviewStatus, adminNotes }),
        },
      );
      mergeApplication(result.application);
      setEvents(result.events || []);
      setMessage("Review saved.");
      setMessageState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save review.");
      setMessageState("error");
    } finally {
      setAction("");
    }
  }

  async function retryEmail(type: "admin" | "applicant") {
    if (!selected) return;
    setAction(`retry-${type}`);
    setMessage("Sending email…");
    setMessageState("");
    try {
      const result = await apiRequest<DetailResponse>(
        `/beta/admin/api/requests/${selected.id}/retry-email`,
        { method: "POST", body: JSON.stringify({ type }) },
      );
      mergeApplication(result.application);
      setEvents(result.events || []);
      setMessage("Email sent.");
      setMessageState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Email delivery failed.");
      setMessageState("error");
      await selectApplication(selected.id);
    } finally {
      setAction("");
    }
  }

  async function sendInvitation() {
    if (!selected) return;
    setAction("invite");
    setMessage("Sending beta invitation…");
    setMessageState("");
    try {
      const result = await apiRequest<DetailResponse>(
        `/beta/admin/api/requests/${selected.id}/invite`,
        { method: "POST", body: JSON.stringify({}) },
      );
      mergeApplication(result.application);
      setEvents(result.events || []);
      setMessage("Invitation sent.");
      setMessageState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invitation failed.");
      setMessageState("error");
      await selectApplication(selected.id);
    } finally {
      setAction("");
    }
  }

  async function copyEmail() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.email);
      setMessage("Applicant email copied.");
      setMessageState("success");
    } catch {
      setMessage("The email address could not be copied.");
      setMessageState("error");
    }
  }

  async function issueClanCode() {
    if (!selected) return;
    setAction("clan-code");
    setMessage("Issuing single-use clan access code…");
    setMessageState("");
    try {
      const result = await apiRequest<{ code: string; events: BetaEvent[] }>(
        `/beta/admin/api/requests/${selected.id}/clan-code`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setClanCode(result.code);
      setEvents(result.events || []);
      setMessage("Clan access code issued. It is shown only in this review session.");
      setMessageState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The clan access code could not be issued.");
      setMessageState("error");
    } finally {
      setAction("");
    }
  }

  async function copyClanCode() {
    if (!clanCode) return;
    try {
      await navigator.clipboard.writeText(clanCode);
      setMessage("Clan access code copied.");
      setMessageState("success");
    } catch {
      setMessage("The clan access code could not be copied.");
      setMessageState("error");
    }
  }

  async function updateAutoBattleAccess(
    account: AutoBattleAdminAccount,
    accessStatus: AutoBattleAccessStatus,
  ) {
    setAutoBattleAction(account.userId);
    setAutoBattleMessage(
      accessStatus === "beta"
        ? "Approving AutoBattle beta access…"
        : accessStatus === "suspended"
          ? "Suspending AutoBattle access…"
          : "Updating AutoBattle access…",
    );
    setAutoBattleMessageState("");
    try {
      const result = await apiRequest<{ account: AutoBattleAdminAccount }>(
        `/beta/admin/api/autobattle/accounts/${account.userId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ accessStatus }),
        },
      );
      setAutoBattleAccounts((current) =>
        current.map((item) =>
          item.userId === result.account.userId ? result.account : item,
        ),
      );
      setAutoBattleMessage(
        accessStatus === "beta"
          ? `${result.account.email} now has AutoBattle beta access.`
          : accessStatus === "suspended"
            ? `${result.account.email} has been suspended.`
            : `${result.account.email} was updated.`,
      );
      setAutoBattleMessageState("success");
    } catch (error) {
      setAutoBattleMessage(
        error instanceof Error ? error.message : "AutoBattle access could not be updated.",
      );
      setAutoBattleMessageState("error");
    } finally {
      setAutoBattleAction("");
    }
  }

  async function sendAutoBattleRedemptionCode(account: AutoBattleAdminAccount) {
    setRedemptionCodeAction(account.userId);
    setAutoBattleMessage(`Emailing a single-use founding code to ${account.email}…`);
    setAutoBattleMessageState("");
    try {
      await apiRequest<{ email: string }>(
        `/beta/admin/api/autobattle/accounts/${account.userId}/redemption-code`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setAutoBattleMessage(
        `${account.email} was emailed a single-use founding code for 30 starting tokens and the permanent 50% clan price.`,
      );
      setAutoBattleMessageState("success");
    } catch (error) {
      setAutoBattleMessage(
        error instanceof Error ? error.message : "The redemption code could not be emailed.",
      );
      setAutoBattleMessageState("error");
    } finally {
      setRedemptionCodeAction("");
    }
  }

  async function updateAutoBattleClanMembership(account: AutoBattleAdminAccount) {
    const clanMember = !account.clanMember;
    setClanMembershipAction(account.userId);
    setAutoBattleMessage(
      clanMember
        ? `Marking ${account.email} as a clan member…`
        : `Removing ${account.email} from the clan list…`,
    );
    setAutoBattleMessageState("");
    try {
      const result = await apiRequest<{ account: AutoBattleAdminAccount }>(
        `/beta/admin/api/autobattle/accounts/${account.userId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ clanMember }),
        },
      );
      setAutoBattleAccounts((current) =>
        current.map((item) =>
          item.userId === result.account.userId ? result.account : item,
        ),
      );
      setAutoBattleMessage(
        result.account.clanMember
          ? `${result.account.email} is now marked as a clan member.`
          : `${result.account.email} is now marked as a non-clan account.`,
      );
      setAutoBattleMessageState("success");
    } catch (error) {
      setAutoBattleMessage(
        error instanceof Error ? error.message : "Clan membership could not be updated.",
      );
      setAutoBattleMessageState("error");
    } finally {
      setClanMembershipAction("");
    }
  }

  async function addAutoBattleTestCredits(account: AutoBattleAdminAccount) {
    const amount = Number(testCreditAmount);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10_000) {
      setAutoBattleMessage("Choose 1 to 10,000 test credits.");
      setAutoBattleMessageState("error");
      return;
    }
    setTestCreditAction(account.userId);
    setAutoBattleMessage(`Adding ${amount.toLocaleString()} test credits to ${account.email}…`);
    setAutoBattleMessageState("");
    try {
      const result = await apiRequest<{ account: AutoBattleAdminAccount }>(
        `/beta/admin/api/autobattle/accounts/${account.userId}/test-credits`,
        {
          method: "POST",
          body: JSON.stringify({ amount, requestId: crypto.randomUUID() }),
        },
      );
      setAutoBattleAccounts((current) =>
        current.map((item) =>
          item.userId === result.account.userId ? result.account : item,
        ),
      );
      setAutoBattleMessage(
        `${amount.toLocaleString()} test credits added. Balance: ${result.account.totalTokens.toLocaleString()} tokens.`,
      );
      setAutoBattleMessageState("success");
    } catch (error) {
      setAutoBattleMessage(
        error instanceof Error ? error.message : "The test credits could not be added.",
      );
      setAutoBattleMessageState("error");
    } finally {
      setTestCreditAction("");
    }
  }

  async function deleteAutoBattleAccount(account: AutoBattleAdminAccount) {
    if (deleteAccountConfirmation.trim().toLowerCase() !== account.email) {
      setAutoBattleMessage("Type the account email exactly to confirm deletion.");
      setAutoBattleMessageState("error");
      return;
    }
    setDeleteAccountAction(account.userId);
    setAutoBattleMessage(`Permanently deleting ${account.email}…`);
    setAutoBattleMessageState("");
    try {
      const result = await apiRequest<{
        email: string;
        deletedBackupCount: number;
      }>(`/beta/admin/api/autobattle/accounts/${account.userId}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmEmail: deleteAccountConfirmation }),
      });
      setAutoBattleAccounts((current) =>
        current.filter((item) => item.userId !== account.userId),
      );
      setDeleteAccountId("");
      setDeleteAccountConfirmation("");
      setAutoBattleMessage(
        `${result.email} was deleted permanently, including ${result.deletedBackupCount.toLocaleString()} cloud backup${result.deletedBackupCount === 1 ? "" : "s"}.`,
      );
      setAutoBattleMessageState("success");
    } catch (error) {
      setAutoBattleMessage(
        error instanceof Error ? error.message : "The account could not be deleted.",
      );
      setAutoBattleMessageState("error");
    } finally {
      setDeleteAccountAction("");
    }
  }

  async function resolvePaymentReview(review: AutoBattlePaymentReview) {
    const resolution = (paymentReviewResolutions[review.id] || "").trim();
    if (!resolution) {
      setAutoBattleMessage("Enter a resolution note before closing the payment review.");
      setAutoBattleMessageState("error");
      return;
    }
    setPaymentReviewAction(review.id);
    setAutoBattleMessage("Closing payment review…");
    setAutoBattleMessageState("");
    try {
      await apiRequest<{ success: boolean }>(
        `/beta/admin/api/autobattle/payment-reviews/${review.id}`,
        { method: "PATCH", body: JSON.stringify({ resolution }) },
      );
      setPaymentReviews((current) => current.filter((item) => item.id !== review.id));
      setPaymentReviewResolutions((current) => {
        const next = { ...current };
        delete next[review.id];
        return next;
      });
      setAutoBattleMessage("Payment review closed. Restore the account separately only when appropriate.");
      setAutoBattleMessageState("success");
    } catch (error) {
      setAutoBattleMessage(
        error instanceof Error ? error.message : "The payment review could not be closed.",
      );
      setAutoBattleMessageState("error");
    } finally {
      setPaymentReviewAction("");
    }
  }

  const autoBattleAccountBusy = Boolean(
    autoBattleAction ||
    clanMembershipAction ||
    redemptionCodeAction ||
    testCreditAction ||
    deleteAccountAction,
  );

  return (
    <div className="beta-admin-root">
      <header className="beta-admin-header">
        <Link className="admin-brand" href="/" aria-label="Return to IDI Studios">
          <span>IDI</span>
          <strong>Studios / Beta Operations</strong>
        </Link>
        <nav className="admin-product-nav" aria-label="Beta operations products">
          <Link
            href="/beta/admin/conquest"
            aria-current={product === "conquest" ? "page" : undefined}
          >
            Conquest
          </Link>
          <Link
            href="/beta/admin/autobattle"
            aria-current={product === "autobattle" ? "page" : undefined}
          >
            AutoBattle
          </Link>
        </nav>
        <div className="admin-session">
          <span>{actorEmail}</span>
          <small>{actorProvider}</small>
          <button type="button" onClick={() => void loadApplications()} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

      <main className="beta-admin-shell">
        <section className="admin-summary">
          <div>
            <p className="admin-eyebrow">
              {product === "autobattle" ? "AutoBattle operations" : "Conquest operations"}
            </p>
            <h1>{product === "autobattle" ? "AutoBattle access." : "Conquest applicants."}</h1>
            <p>
              {product === "autobattle"
                ? "Approve AutoBattle accounts, send founding codes, and manage Android access."
                : "Review Conquest: Ascension applications, record decisions, and move approved Android testers into a build wave."}
            </p>
          </div>
          <div className="admin-stats" aria-label="Application summary">
            <article><strong>{counts.total}</strong><span>Total records</span></article>
            <article><strong>{counts.pending}</strong><span>Awaiting review</span></article>
            <article><strong>{counts.accepted}</strong><span>Approved access</span></article>
          </div>
        </section>

        {product === "autobattle" ? (
          <>
          <section className="admin-autobattle" aria-labelledby="autobattle-accounts-title">
          <div className="admin-section-heading">
            <div>
              <p className="admin-eyebrow">AutoBattle / Account access</p>
              <h2 id="autobattle-accounts-title">Account approvals.</h2>
              <p>
                Review access, compare each player&apos;s declared affiliation with verified
                clan status, and manage test credits. Accounts created before the affiliation
                question show “Legacy — not asked” until the player signs in again.
              </p>
            </div>
            <div className="admin-autobattle-summary-stats" aria-label="AutoBattle account summary">
              <span><strong>{autoBattleAccounts.filter((account) => account.accessStatus === "pending").length}</strong> Pending</span>
              <span><strong>{autoBattleAccounts.filter((account) => account.signupAffiliation === "clan").length}</strong> Declared clan</span>
              <span><strong>{autoBattleAccounts.filter((account) => account.clanMember).length}</strong> Verified</span>
            </div>
          </div>
          {autoBattleMessage ? (
            <p className="admin-autobattle-message" data-state={autoBattleMessageState} role="status">
              {autoBattleMessage}
            </p>
          ) : null}
          <div className="admin-autobattle-list" role="list">
            {loading ? (
              <p className="admin-list-state">Loading AutoBattle accounts…</p>
            ) : sortedAutoBattleAccounts.length ? (
              sortedAutoBattleAccounts.map((account) => (
                <article className="admin-autobattle-account" role="listitem" key={account.userId}>
                  <div className="admin-autobattle-account-overview">
                    <div className="admin-autobattle-identity">
                      <span>Player</span>
                      <strong>{account.playerName || "Player name not set"}</strong>
                      <a href={`mailto:${account.email}`}>{account.email}</a>
                    </div>
                    <dl className="admin-autobattle-meta">
                      <div><dt>Access</dt><dd><StatusPill status={account.accessStatus} /></dd></div>
                      <div>
                        <dt>Player selected</dt>
                        <dd>
                          <span
                            className="admin-signup-affiliation"
                            data-affiliation={account.signupAffiliation}
                            title={account.signupAffiliation === "not_provided"
                              ? "This account predates the affiliation question. The player will be asked on their next sign-in."
                              : undefined}
                          >
                            {account.signupAffiliation === "clan"
                              ? "Clan member"
                              : account.signupAffiliation === "individual"
                                ? "Individual"
                                : "Legacy — not asked"}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>Clan status</dt>
                        <dd><span className="admin-clan-member-pill" data-member={account.clanMember}>
                          {account.clanMember ? "Verified" : "Not verified"}
                        </span></dd>
                      </div>
                      <div><dt>Credits</dt><dd><strong>{account.totalTokens.toLocaleString()}</strong><small>{account.promotionalTokens.toLocaleString()} promotional</small></dd></div>
                      <div><dt>Joined</dt><dd>{formatDate(account.createdAt, false)}</dd></div>
                    </dl>
                  </div>
                  <div className="admin-autobattle-actions">
                    <div className="admin-clan-membership-control">
                      <span>Clan verification</span>
                      <button
                        className={account.clanMember ? "admin-secondary-button" : "admin-primary-button"}
                        type="button"
                        disabled={autoBattleAccountBusy}
                        onClick={() => void updateAutoBattleClanMembership(account)}
                      >
                        {clanMembershipAction === account.userId
                          ? "Saving…"
                          : account.clanMember
                            ? "Mark non-clan"
                            : "Mark clan member"}
                      </button>
                    </div>
                    {account.canGrantTestCredits ? (
                      <div className="admin-test-credit-control">
                      <label htmlFor={`test-credit-${account.userId}`}>Test credits</label>
                      <input
                        id={`test-credit-${account.userId}`}
                        type="number"
                        min="1"
                        max="10000"
                        step="1"
                        inputMode="numeric"
                        value={testCreditAmount}
                        onChange={(event) => setTestCreditAmount(event.target.value)}
                      />
                      <button
                        className="admin-primary-button"
                        type="button"
                        disabled={autoBattleAccountBusy}
                        onClick={() => void addAutoBattleTestCredits(account)}
                      >
                        {testCreditAction === account.userId ? "Adding…" : "Add test credits"}
                      </button>
                      </div>
                    ) : null}
                    <div className="admin-autobattle-account-buttons">
                    {account.clanMember ? (
                      <button
                        className="admin-secondary-button"
                        type="button"
                        disabled={autoBattleAccountBusy || account.accessStatus === "suspended"}
                        onClick={() => void sendAutoBattleRedemptionCode(account)}
                        title={account.accessStatus === "suspended"
                          ? "Restore this account before sending a redemption code."
                          : "Email a single-use code for 30 tokens and the permanent 50% clan price."}
                      >
                        {redemptionCodeAction === account.userId
                          ? "Emailing code…"
                          : "Email founding code"}
                      </button>
                    ) : null}
                    {account.accessStatus === "pending" ? (
                      <button
                        className="admin-primary-button"
                        type="button"
                        disabled={autoBattleAccountBusy}
                        onClick={() => void updateAutoBattleAccess(account, "beta")}
                      >
                        {autoBattleAction === account.userId ? "Approving…" : "Approve beta access"}
                      </button>
                    ) : account.accessStatus === "suspended" ? (
                      <button
                        className="admin-secondary-button"
                        type="button"
                        disabled={autoBattleAccountBusy}
                        onClick={() => void updateAutoBattleAccess(account, "beta")}
                      >
                        {autoBattleAction === account.userId ? "Restoring…" : "Restore beta access"}
                      </button>
                    ) : (
                      <button
                        className="admin-secondary-button"
                        type="button"
                        disabled={autoBattleAccountBusy}
                        onClick={() => void updateAutoBattleAccess(account, "suspended")}
                      >
                        {autoBattleAction === account.userId ? "Suspending…" : "Suspend access"}
                      </button>
                    )}
                    <button
                      className="admin-danger-button"
                      type="button"
                      aria-expanded={deleteAccountId === account.userId}
                      aria-controls={`delete-account-${account.userId}`}
                      disabled={autoBattleAccountBusy}
                      onClick={() => {
                        setDeleteAccountId(account.userId);
                        setDeleteAccountConfirmation("");
                        setAutoBattleMessage("");
                        setAutoBattleMessageState("");
                      }}
                    >
                      Delete account
                    </button>
                    </div>
                  </div>
                  {deleteAccountId === account.userId ? (
                    <div
                      className="admin-account-delete-confirmation"
                      id={`delete-account-${account.userId}`}
                    >
                      <div>
                        <h3>Delete this account permanently?</h3>
                        <p>
                          This removes the AutoBattle login, player profile, credits and activity,
                          linked devices, saved cloud backups, and any AutoBattle access request.
                          Payment records retained for accounting or disputes are detached from the account.
                        </p>
                      </div>
                      <label htmlFor={`delete-account-email-${account.userId}`}>
                        <span>Type {account.email} to confirm</span>
                        <input
                          id={`delete-account-email-${account.userId}`}
                          type="email"
                          autoComplete="off"
                          spellCheck={false}
                          value={deleteAccountConfirmation}
                          onChange={(event) => setDeleteAccountConfirmation(event.target.value)}
                        />
                      </label>
                      <div className="admin-account-delete-buttons">
                        <button
                          className="admin-secondary-button"
                          type="button"
                          disabled={deleteAccountAction === account.userId}
                          onClick={() => {
                            setDeleteAccountId("");
                            setDeleteAccountConfirmation("");
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="admin-danger-button"
                          type="button"
                          disabled={
                            deleteAccountAction === account.userId ||
                            deleteAccountConfirmation.trim().toLowerCase() !== account.email
                          }
                          onClick={() => void deleteAutoBattleAccount(account)}
                        >
                          {deleteAccountAction === account.userId
                            ? "Deleting permanently…"
                            : "Delete permanently"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="admin-list-state">No AutoBattle accounts have been created yet.</p>
            )}
          </div>
          </section>
          <section className="admin-autobattle" aria-labelledby="autobattle-payment-reviews-title">
            <div className="admin-section-heading">
              <div>
                <p className="admin-eyebrow">AutoBattle / Payment integrity</p>
                <h2 id="autobattle-payment-reviews-title">Refund and dispute reviews.</h2>
                <p>
                  Matching accounts are suspended automatically. Verify the Stripe case, record
                  the outcome here, then restore access separately only when appropriate.
                </p>
              </div>
              <span>{paymentReviews.length} open</span>
            </div>
            <div className="admin-autobattle-list" role="list">
              {loading ? (
                <p className="admin-list-state">Loading payment reviews…</p>
              ) : paymentReviews.length ? (
                paymentReviews.map((review) => (
                  <article className="admin-autobattle-account" role="listitem" key={review.id}>
                    <div>
                      <span>{review.eventType}</span>
                      <strong>{review.playerName || "Player name not set"}</strong>
                      <a href={`mailto:${review.email}`}>{review.email}</a>
                      <small>{review.paymentIntentId}</small>
                    </div>
                    <div className="admin-autobattle-meta">
                      <StatusPill status={review.accessStatus} />
                      <small>{review.orderStatus} · {formatDate(review.receivedAt, false)}</small>
                    </div>
                    <div className="admin-payment-review-resolution">
                      <label>
                        <span>Resolution note</span>
                        <input
                          value={paymentReviewResolutions[review.id] || ""}
                          maxLength={500}
                          onChange={(event) => setPaymentReviewResolutions((current) => ({
                            ...current,
                            [review.id]: event.target.value,
                          }))}
                          placeholder="Refund confirmed, dispute won, account restored…"
                        />
                      </label>
                      <button
                        className="admin-secondary-button"
                        type="button"
                        disabled={paymentReviewAction !== ""}
                        onClick={() => void resolvePaymentReview(review)}
                      >
                        {paymentReviewAction === review.id ? "Closing…" : "Mark resolved"}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="admin-list-state">No refunds or disputes require review.</p>
              )}
            </div>
          </section>
          </>
        ) : null}

        {product === "conquest" ? (
          <>
        <div className="admin-queue-heading">
          <p className="admin-eyebrow">
            Conquest / Request forms
          </p>
          <h2>Beta applications.</h2>
          <p>Only Conquest: Ascension beta applications appear here.</p>
        </div>

        <section className="admin-workspace" aria-label="Beta applicant workspace">
          <aside className="admin-applicants">
            <div className="admin-toolbar">
              <label>
                <span className="admin-sr-only">Search applicants</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, email, or device"
                />
              </label>
              <label>
                <span className="admin-sr-only">Filter by status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option value={status} key={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-applicant-list" role="list">
              {loading ? (
                <p className="admin-list-state">Loading applicants…</p>
              ) : filteredApplications.length ? (
                filteredApplications.map((application) => (
                  <button
                    type="button"
                    role="listitem"
                    className="admin-applicant"
                    aria-current={selectedId === application.id}
                    key={application.id}
                    onClick={() => void selectApplication(application.id)}
                  >
                    <span className="admin-applicant-heading">
                      <strong>{application.name}</strong>
                      <StatusPill status={application.status} />
                    </span>
                    <span className="admin-applicant-email">{application.email}</span>
                    <span className="admin-applicant-meta">
                      <span>{applicationProduct(application)} · {application.androidDevice}</span>
                      <span>{formatDate(application.createdAt, false)}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="admin-list-state">
                  {applications.length
                    ? "No applicants match these filters."
                    : "No beta requests have been submitted yet."}
                </p>
              )}
            </div>
          </aside>

          <section className="admin-detail" aria-live="polite">
            {!selected ? (
              <div className="admin-empty-detail">
                <p className="admin-eyebrow">Applicant detail</p>
                <h2>{detailLoading ? "Loading request…" : "Select a request."}</h2>
                <p>
                  Choose an applicant to review their device, testing focus,
                  communications, private notes, and decision history.
                </p>
                {message ? <p className="admin-inline-message" data-state={messageState}>{message}</p> : null}
              </div>
            ) : (
              <div className={detailLoading ? "is-detail-loading" : ""}>
                <div className="admin-detail-heading">
                  <div>
                    <p className="admin-eyebrow">Applicant detail</p>
                    <h2>{selected.name}</h2>
                    <a href={`mailto:${selected.email}`}>{selected.email}</a>
                  </div>
                  <StatusPill status={selected.status} />
                </div>

                <p className="admin-inline-message" data-state={messageState} role="status">
                  {message}
                </p>

                <div className="admin-detail-grid">
                  <article className="admin-card">
                    <h3>Testing profile</h3>
                    <dl>
                      <DataRow label="Product">{applicationProduct(selected)}</DataRow>
                      <DataRow label="Android device">{selected.androidDevice}</DataRow>
                      <DataRow label="Submitted">{formatDate(selected.createdAt)}</DataRow>
                      <DataRow label="Last updated">{formatDate(selected.updatedAt)}</DataRow>
                      <DataRow label="Reviewed by">{selected.reviewedBy || "Not reviewed"}</DataRow>
                    </dl>
                    <button className="admin-small-button" type="button" onClick={() => void copyEmail()}>
                      Copy applicant email
                    </button>
                  </article>

                  <article className="admin-card">
                    <h3>Communication</h3>
                    <dl>
                      <DataRow label="Studio notice"><StatusPill status={selected.adminEmailStatus} /></DataRow>
                      <DataRow label="Confirmation"><StatusPill status={selected.emailStatus} /></DataRow>
                      <DataRow label="Invitation"><StatusPill status={selected.inviteEmailStatus} /></DataRow>
                      <DataRow label="Invited">{formatDate(selected.invitedAt)}</DataRow>
                      <DataRow label="Last error">{selected.lastEmailError || "None"}</DataRow>
                    </dl>
                    <div className="admin-email-actions">
                      <button
                        className="admin-small-button"
                        type="button"
                        disabled={action !== "" || selected.adminEmailStatus !== "failed"}
                        onClick={() => void retryEmail("admin")}
                      >
                        {action === "retry-admin" ? "Sending…" : "Retry studio email"}
                      </button>
                      <button
                        className="admin-small-button"
                        type="button"
                        disabled={action !== "" || selected.emailStatus !== "failed"}
                        onClick={() => void retryEmail("applicant")}
                      >
                        {action === "retry-applicant" ? "Sending…" : "Retry confirmation"}
                      </button>
                    </div>
                  </article>
                </div>

                <article className="admin-card admin-testing-focus">
                  <h3>What they want to test</h3>
                  <p>{selected.testingFocus}</p>
                </article>

                <form className="admin-review" onSubmit={saveReview}>
                  <div className="admin-review-heading">
                    <div>
                      <h3>Review decision</h3>
                      <p>Every save is added to the applicant history.</p>
                    </div>
                    <button className="admin-primary-button" type="submit" disabled={action !== ""}>
                      {action === "review" ? "Saving…" : "Save review"}
                    </button>
                  </div>

                  <div className="admin-review-grid">
                    <label>
                      <span>Status</span>
                      <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as BetaStatus)}>
                        {STATUS_OPTIONS.map((status) => (
                          <option value={status} key={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                    <div className="admin-invite-control">
                      <span>Beta invitation</span>
                      <button
                        className="admin-secondary-button"
                        type="button"
                        disabled={
                          action !== "" ||
                          !inviteEnabled ||
                          !["approved", "invited"].includes(selected.status)
                        }
                        onClick={() => void sendInvitation()}
                      >
                        {action === "invite" ? "Sending…" : "Send invitation"}
                      </button>
                      <small>
                        {!inviteEnabled
                          ? "Add BETA_INVITE_URL when Android distribution is ready."
                          : ["approved", "invited"].includes(selected.status)
                            ? "Confirm this email is on the tester list before sending."
                            : "Approve the applicant before sending an invitation."}
                      </small>
                    </div>
                    {selected.testingFocus.startsWith("[AutoBattle clan access]") ? (
                      <div className="admin-invite-control">
                        <span>Founding clan offer</span>
                        <button
                          className="admin-secondary-button"
                          type="button"
                          disabled={action !== "" || !["approved", "invited", "active"].includes(selected.status)}
                          onClick={() => void issueClanCode()}
                        >
                          {action === "clan-code" ? "Issuing…" : "Issue clan code"}
                        </button>
                        <small>Grants 30 promotional tokens and a permanent 50% clan discount.</small>
                      </div>
                    ) : null}
                  </div>

                  {clanCode ? (
                    <div className="admin-clan-code">
                      <div><span>Single-use clan access code</span><strong>{clanCode}</strong></div>
                      <button className="admin-small-button" type="button" onClick={() => void copyClanCode()}>Copy code</button>
                    </div>
                  ) : null}

                  <label className="admin-notes">
                    <span>Private admin notes</span>
                    <textarea
                      value={adminNotes}
                      onChange={(event) => setAdminNotes(event.target.value)}
                      maxLength={5000}
                      placeholder="Tester fit, decision context, follow-up, or concerns"
                    />
                    <small>{adminNotes.length}/5000</small>
                  </label>
                </form>

                <article className="admin-history">
                  <div className="admin-history-heading">
                    <h3>Activity history</h3>
                    <span>{events.length} event{events.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="admin-history-list">
                    {events.length ? (
                      events.map((entry) => (
                        <div className="admin-history-item" key={entry.id}>
                          <span aria-hidden="true" />
                          <div>
                            <strong>{entry.eventType.replaceAll("_", " ")}</strong>
                            <p>
                              {formatDate(entry.createdAt)} · {entry.actorEmail}
                              {entry.previousStatus && entry.newStatus && entry.previousStatus !== entry.newStatus
                                ? ` · ${entry.previousStatus} → ${entry.newStatus}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="admin-history-item">
                        <span aria-hidden="true" />
                        <div><strong>Request submitted</strong><p>{formatDate(selected.createdAt)}</p></div>
                      </div>
                    )}
                  </div>
                </article>
              </div>
            )}
          </section>
        </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
