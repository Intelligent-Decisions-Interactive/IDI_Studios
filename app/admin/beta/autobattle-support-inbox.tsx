"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

export type AutoBattleSupportStatus =
  | "open"
  | "in_progress"
  | "waiting_on_user"
  | "resolved"
  | "closed";

export type AutoBattleSupportTicket = {
  id: string;
  userId: string;
  contactEmail: string;
  playerName: string;
  category: string;
  subject: string;
  initialMessage: string;
  status: AutoBattleSupportStatus;
  releaseChannel: "production" | "internal";
  applicationId: string;
  appVersionName: string;
  appVersionCode: number;
  deviceManufacturer: string;
  deviceModel: string;
  androidVersion: string;
  diagnosticsIncluded: boolean;
  diagnosticsExcerpt: string | null;
  createdAt: string;
  updatedAt: string;
  lastUserMessageAt: string;
  lastAdminMessageAt: string | null;
  messages: Array<{
    id: string;
    authorType: "user" | "admin";
    authorEmail: string;
    body: string;
    createdAt: string;
  }>;
};

const STATUS_OPTIONS: Array<{ value: AutoBattleSupportStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_user", label: "Waiting on User" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function updateTicketRequest(
  ticket: AutoBattleSupportTicket,
  status: AutoBattleSupportStatus,
  reply: string,
) {
  const response = await fetch(`/beta/admin/api/autobattle/support/${ticket.id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reply }),
  });
  const result = await response.json().catch(() => ({})) as {
    success?: boolean;
    message?: string;
    ticket?: AutoBattleSupportTicket;
  };
  if (!response.ok || result.success === false || !result.ticket) {
    throw new Error(result.message || "The support report could not be updated.");
  }
  return result.ticket;
}

export function AutoBattleSupportInbox({
  tickets,
  loading,
  onTicketUpdated,
}: {
  tickets: AutoBattleSupportTicket[];
  loading: boolean;
  onTicketUpdated: (ticket: AutoBattleSupportTicket) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<AutoBattleSupportStatus>("open");
  const [reply, setReply] = useState("");
  const [action, setAction] = useState(false);
  const [message, setMessage] = useState("");
  const [messageState, setMessageState] = useState<"" | "success" | "error">("");
  const selected = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) || null,
    [selectedId, tickets],
  );

  useEffect(() => {
    if (!tickets.length) {
      setSelectedId("");
      return;
    }
    if (!tickets.some((ticket) => ticket.id === selectedId)) {
      setSelectedId(tickets[0].id);
    }
  }, [selectedId, tickets]);

  useEffect(() => {
    if (selected) setStatus(selected.status);
    setReply("");
    setMessage("");
    setMessageState("");
  }, [selected?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || action) return;
    const body = reply.trim();
    if (!body && status === selected.status) {
      setMessage("Add a reply or change the ticket status.");
      setMessageState("error");
      return;
    }
    setAction(true);
    setMessage(body ? "Sending reply…" : "Updating status…");
    setMessageState("");
    try {
      const updated = await updateTicketRequest(selected, status, body);
      onTicketUpdated(updated);
      setReply("");
      setMessage(body ? "Reply sent." : "Status updated.");
      setMessageState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The support report could not be updated.");
      setMessageState("error");
    } finally {
      setAction(false);
    }
  }

  const activeCount = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;

  return (
    <section className="admin-autobattle admin-support" aria-labelledby="autobattle-support-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">AutoBattle / Player Support</p>
          <h2 id="autobattle-support-title">Support Inbox.</h2>
          <p>Review in-app reports, inspect user-approved diagnostics, and reply directly to the player.</p>
        </div>
        <span>{activeCount} active · {tickets.length} recent</span>
      </div>
      <div className="admin-support-workspace">
        <aside className="admin-support-list" aria-label="Support reports">
          {loading ? (
            <p className="admin-list-state">Loading support reports…</p>
          ) : tickets.length ? tickets.map((ticket) => (
            <button
              type="button"
              key={ticket.id}
              aria-current={ticket.id === selectedId}
              onClick={() => setSelectedId(ticket.id)}
            >
              <span className="admin-support-list-heading">
                <strong>{ticket.subject}</strong>
                <span className="admin-status-pill" data-status={ticket.status}>{titleCase(ticket.status)}</span>
              </span>
              <span>{ticket.playerName || ticket.contactEmail}</span>
              <small>{titleCase(ticket.category)} · {formatDate(ticket.updatedAt)}</small>
            </button>
          )) : (
            <p className="admin-list-state">No support reports have been submitted.</p>
          )}
        </aside>

        <div className="admin-support-detail" aria-live="polite">
          {!selected ? (
            <div className="admin-support-empty">
              <h3>Select a Support Report</h3>
              <p>The report, conversation, build details, and optional diagnostics will appear here.</p>
            </div>
          ) : (
            <>
              <header className="admin-support-detail-heading">
                <div>
                  <p className="admin-eyebrow">{titleCase(selected.category)} · {selected.releaseChannel}</p>
                  <h3>{selected.subject}</h3>
                  <a href={`mailto:${selected.contactEmail}`}>{selected.playerName || "Player"} · {selected.contactEmail}</a>
                </div>
                <span className="admin-status-pill" data-status={selected.status}>{titleCase(selected.status)}</span>
              </header>

              <dl className="admin-support-environment">
                <div><dt>App</dt><dd>{selected.appVersionName} · Build {selected.appVersionCode}</dd></div>
                <div><dt>Device</dt><dd>{[selected.deviceManufacturer, selected.deviceModel].filter(Boolean).join(" ") || "Not reported"}</dd></div>
                <div><dt>Android</dt><dd>{selected.androidVersion || "Not reported"}</dd></div>
                <div><dt>Submitted</dt><dd>{formatDate(selected.createdAt)}</dd></div>
              </dl>

              <div className="admin-support-thread">
                <article data-author="user">
                  <header><strong>{selected.playerName || "Player"}</strong><time>{formatDate(selected.createdAt)}</time></header>
                  <p>{selected.initialMessage}</p>
                </article>
                {selected.messages.map((entry) => (
                  <article data-author={entry.authorType} key={entry.id}>
                    <header>
                      <strong>{entry.authorType === "admin" ? "IDI Studios Support" : selected.playerName || "Player"}</strong>
                      <time>{formatDate(entry.createdAt)}</time>
                    </header>
                    <p>{entry.body}</p>
                  </article>
                ))}
              </div>

              {selected.diagnosticsIncluded ? (
                <details className="admin-support-diagnostics">
                  <summary>View User-Approved Diagnostics</summary>
                  <p>AutoBattle-owned events only. No screenshots, game data, account credentials, or device token.</p>
                  <pre>{selected.diagnosticsExcerpt || "Diagnostics were attached but are unavailable."}</pre>
                </details>
              ) : (
                <p className="admin-support-no-diagnostics">No diagnostics were attached.</p>
              )}

              <form className="admin-support-reply" onSubmit={submit}>
                <label>
                  <span>Reply to Player</span>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    maxLength={5000}
                    placeholder="Ask a follow-up question or explain the resolution…"
                  />
                </label>
                <div>
                  <label>
                    <span>Status</span>
                    <select value={status} onChange={(event) => setStatus(event.target.value as AutoBattleSupportStatus)}>
                      {STATUS_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <button className="admin-primary-button" type="submit" disabled={action}>
                    {action ? "Saving…" : reply.trim() ? "Send Reply" : "Update Status"}
                  </button>
                </div>
                <p className="admin-inline-message" data-state={messageState} role="status">{message}</p>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
