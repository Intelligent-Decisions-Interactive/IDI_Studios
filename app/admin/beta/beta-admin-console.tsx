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
}: {
  actorEmail: string;
  actorProvider: string;
}) {
  const [applications, setApplications] = useState<BetaApplication[]>([]);
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
      setMessage("");
      setMessageState("");
      try {
        const result = await apiRequest<DetailResponse>(`/admin/api/requests/${id}`);
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
    try {
      const result = await apiRequest<ListResponse>("/admin/api/requests");
      setApplications(result.applications || []);
      setActorEmail(result.actorEmail || initialActorEmail);
      setActorProvider(result.actorProvider || initialActorProvider);
      setInviteEnabled(result.inviteEnabled);
      setMessage("");
      setMessageState("");
      if (selectedId && result.applications.some((item) => item.id === selectedId)) {
        await selectApplication(selectedId);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load requests.");
      setMessageState("error");
    } finally {
      setLoading(false);
    }
  }, [initialActorEmail, initialActorProvider, selectApplication, selectedId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadApplications(), 0);
    // Initial load is intentionally isolated from selection changes.
    return () => window.clearTimeout(initialLoad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(
    () =>
      applications.reduce(
        (result, application) => {
          result.total += 1;
          if (application.status === "pending") result.pending += 1;
          if (["approved", "invited", "active"].includes(application.status)) {
            result.accepted += 1;
          }
          return result;
        },
        { total: 0, pending: 0, accepted: 0 },
      ),
    [applications],
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
        `/admin/api/requests/${selected.id}`,
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
        `/admin/api/requests/${selected.id}/retry-email`,
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
        `/admin/api/requests/${selected.id}/invite`,
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

  return (
    <div className="beta-admin-root">
      <header className="beta-admin-header">
        <Link className="admin-brand" href="/" aria-label="Return to IDI Studios">
          <span>IDI</span>
          <strong>Studios / Beta Operations</strong>
        </Link>
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
            <p className="admin-eyebrow">Private beta operations</p>
            <h1>Applicant management.</h1>
            <p>
              Review requests, record decisions, track delivery health, and move
              approved Android testers into a build wave.
            </p>
          </div>
          <div className="admin-stats" aria-label="Application summary">
            <article><strong>{counts.total}</strong><span>Total requests</span></article>
            <article><strong>{counts.pending}</strong><span>Awaiting review</span></article>
            <article><strong>{counts.accepted}</strong><span>Approved forward</span></article>
          </div>
        </section>

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
                      <span>{application.androidDevice}</span>
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
                  </div>

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
      </main>
    </div>
  );
}
