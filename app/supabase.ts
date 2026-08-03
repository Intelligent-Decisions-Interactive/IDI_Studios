import { env } from "cloudflare:workers";

type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
};

type BetaRequestRow = {
  id: number;
  name: string;
  email: string;
  android_device: string;
  testing_focus: string;
  status: string;
  email_status: string;
  resend_email_id: string | null;
  admin_email_status: string;
  admin_resend_id: string | null;
  invite_email_status: string;
  invite_resend_id: string | null;
  last_email_error: string | null;
  admin_notes: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  invited_at: string | null;
  created_at: string;
  updated_at: string;
};

type BetaEventRow = {
  id: number;
  request_id: number;
  event_type: string;
  actor_email: string;
  previous_status: string | null;
  new_status: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type BetaRequest = {
  id: number;
  name: string;
  email: string;
  androidDevice: string;
  testingFocus: string;
  status: string;
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

export type BetaEvent = {
  id: number;
  requestId: number;
  eventType: string;
  actorEmail: string;
  previousStatus: string | null;
  newStatus: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type BetaRequestChanges = Partial<{
  status: string;
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
}>;

const REQUEST_COLUMNS = [
  "id",
  "name",
  "email",
  "android_device",
  "testing_focus",
  "status",
  "email_status",
  "resend_email_id",
  "admin_email_status",
  "admin_resend_id",
  "invite_email_status",
  "invite_resend_id",
  "last_email_error",
  "admin_notes",
  "reviewed_at",
  "reviewed_by",
  "invited_at",
  "created_at",
  "updated_at",
].join(",");

function configuration() {
  const runtime = env as unknown as RuntimeEnv;
  const url = runtime.SUPABASE_URL?.trim().replace(/\/+$/, "") || "";
  const secret = runtime.SUPABASE_SECRET_KEY?.trim() || "";
  if (!url || !secret) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY must be configured in Cloudflare.",
    );
  }
  return { url, secret };
}

function requestHeaders(secret: string, prefer?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: secret,
  };

  // Legacy service-role JWTs require Authorization. Supabase's newer
  // sb_secret_* keys are sent through the apikey header only.
  if (!secret.startsWith("sb_")) {
    headers.Authorization = `Bearer ${secret}`;
  }
  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function supabaseRequest<T>(
  path: string,
  options: RequestInit,
  timeoutMs = 10_000,
) {
  const { url, secret } = configuration();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      headers: {
        ...requestHeaders(secret),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    const text = await response.text();
    const body = text ? (JSON.parse(text) as T) : (null as T);

    if (!response.ok) {
      throw new Error(
        `Supabase request failed (${response.status}): ${text.slice(0, 500)}`,
      );
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function mapRequest(row: BetaRequestRow): BetaRequest {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    androidDevice: row.android_device,
    testingFocus: row.testing_focus,
    status: row.status,
    emailStatus: row.email_status,
    resendEmailId: row.resend_email_id,
    adminEmailStatus: row.admin_email_status,
    adminResendId: row.admin_resend_id,
    inviteEmailStatus: row.invite_email_status,
    inviteResendId: row.invite_resend_id,
    lastEmailError: row.last_email_error,
    adminNotes: row.admin_notes || "",
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    invitedAt: row.invited_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: BetaEventRow): BetaEvent {
  return {
    id: Number(row.id),
    requestId: Number(row.request_id),
    eventType: row.event_type,
    actorEmail: row.actor_email,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    details: row.details,
    createdAt: row.created_at,
  };
}

function changeRow(changes: BetaRequestChanges) {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields: Array<[keyof BetaRequestChanges, string]> = [
    ["status", "status"],
    ["emailStatus", "email_status"],
    ["resendEmailId", "resend_email_id"],
    ["adminEmailStatus", "admin_email_status"],
    ["adminResendId", "admin_resend_id"],
    ["inviteEmailStatus", "invite_email_status"],
    ["inviteResendId", "invite_resend_id"],
    ["lastEmailError", "last_email_error"],
    ["adminNotes", "admin_notes"],
    ["reviewedAt", "reviewed_at"],
    ["reviewedBy", "reviewed_by"],
    ["invitedAt", "invited_at"],
  ];
  for (const [source, target] of fields) {
    if (Object.prototype.hasOwnProperty.call(changes, source)) {
      row[target] = changes[source];
    }
  }
  return row;
}

export async function upsertBetaRequest(input: {
  name: string;
  email: string;
  androidDevice: string;
  testingFocus: string;
}) {
  const now = new Date().toISOString();
  const rows = await supabaseRequest<BetaRequestRow[]>(
    `beta_access_requests?on_conflict=email&select=${encodeURIComponent(REQUEST_COLUMNS)}`,
    {
      method: "POST",
      headers: requestHeaders(
        configuration().secret,
        "resolution=merge-duplicates,return=representation",
      ),
      body: JSON.stringify([
        {
          name: input.name,
          email: input.email,
          android_device: input.androidDevice,
          testing_focus: input.testingFocus,
          status: "pending",
          email_status: "pending",
          resend_email_id: null,
          admin_email_status: "pending",
          admin_resend_id: null,
          invite_email_status: "not_sent",
          invite_resend_id: null,
          last_email_error: null,
          reviewed_at: null,
          reviewed_by: null,
          invited_at: null,
          updated_at: now,
        },
      ]),
    },
  );
  if (!rows?.[0]) throw new Error("Supabase did not return the beta request.");
  return mapRequest(rows[0]);
}

export async function listBetaRequests() {
  const rows = await supabaseRequest<BetaRequestRow[]>(
    `beta_access_requests?select=${encodeURIComponent(REQUEST_COLUMNS)}&order=created_at.desc&limit=250`,
    { method: "GET" },
  );
  return (rows || []).map(mapRequest);
}

export async function getBetaRequest(id: number) {
  const rows = await supabaseRequest<BetaRequestRow[]>(
    `beta_access_requests?id=eq.${encodeURIComponent(String(id))}&select=${encodeURIComponent(REQUEST_COLUMNS)}&limit=1`,
    { method: "GET" },
  );
  return rows?.[0] ? mapRequest(rows[0]) : null;
}

export async function updateBetaRequest(
  id: number,
  changes: BetaRequestChanges,
) {
  const rows = await supabaseRequest<BetaRequestRow[]>(
    `beta_access_requests?id=eq.${encodeURIComponent(String(id))}&select=${encodeURIComponent(REQUEST_COLUMNS)}`,
    {
      method: "PATCH",
      headers: requestHeaders(configuration().secret, "return=representation"),
      body: JSON.stringify(changeRow(changes)),
    },
  );
  if (!rows?.[0]) throw new Error("Supabase did not return the updated request.");
  return mapRequest(rows[0]);
}

export async function getBetaRequestEvents(id: number) {
  const rows = await supabaseRequest<BetaEventRow[]>(
    `beta_access_request_events?request_id=eq.${encodeURIComponent(String(id))}&select=id,request_id,event_type,actor_email,previous_status,new_status,details,created_at&order=created_at.desc&limit=100`,
    { method: "GET" },
  );
  return (rows || []).map(mapEvent);
}

export async function insertBetaEvent(input: {
  requestId: number;
  eventType: string;
  actorEmail: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  details?: Record<string, unknown>;
}) {
  await supabaseRequest<null>("beta_access_request_events", {
    method: "POST",
    headers: requestHeaders(configuration().secret, "return=minimal"),
    body: JSON.stringify([
      {
        request_id: input.requestId,
        event_type: input.eventType,
        actor_email: input.actorEmail,
        previous_status: input.previousStatus || null,
        new_status: input.newStatus || null,
        details: input.details || {},
      },
    ]),
  });
}
