import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  betaAccessRequestEvents,
  betaAccessRequests,
} from "../db/schema";

type RuntimeEnv = {
  BETA_ADMIN_EMAILS?: string;
  BETA_NOTIFICATION_EMAIL?: string;
  BETA_INVITE_URL?: string;
};

export const BETA_STATUSES = [
  "pending",
  "approved",
  "invited",
  "active",
  "declined",
] as const;

export type BetaStatus = (typeof BETA_STATUSES)[number];

function normalizeEmail(value: string | null) {
  return value?.trim().toLowerCase() || "";
}

export function getAdminActorFromHeaders(requestHeaders: Headers) {
  const accessEmail = normalizeEmail(
    requestHeaders.get("cf-access-authenticated-user-email"),
  );
  const accessAssertion = requestHeaders.get("cf-access-jwt-assertion")?.trim();

  if (accessEmail && accessAssertion) {
    return { email: accessEmail, provider: "Cloudflare Zero Trust" };
  }

  const runtime = env as unknown as RuntimeEnv;
  const allowed = new Set(
    [runtime.BETA_ADMIN_EMAILS, runtime.BETA_NOTIFICATION_EMAIL]
      .filter(Boolean)
      .flatMap((value) => value!.split(","))
      .map((value) => normalizeEmail(value))
      .filter(Boolean),
  );
  const sitesEmail = normalizeEmail(
    requestHeaders.get("oai-authenticated-user-email"),
  );

  if (sitesEmail && allowed.has(sitesEmail)) {
    return { email: sitesEmail, provider: "Sites secure preview" };
  }

  return null;
}

export function isBetaStatus(value: unknown): value is BetaStatus {
  return (
    typeof value === "string" &&
    (BETA_STATUSES as readonly string[]).includes(value)
  );
}

export async function getBetaRequest(id: number) {
  const db = getDb();
  const [application] = await db
    .select()
    .from(betaAccessRequests)
    .where(eq(betaAccessRequests.id, id))
    .limit(1);
  return application || null;
}

export async function getBetaRequestEvents(id: number) {
  return getDb()
    .select()
    .from(betaAccessRequestEvents)
    .where(eq(betaAccessRequestEvents.requestId, id))
    .orderBy(desc(betaAccessRequestEvents.createdAt));
}

export async function logBetaEvent(input: {
  requestId: number;
  eventType: string;
  actorEmail: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  details?: Record<string, unknown>;
}) {
  await getDb().insert(betaAccessRequestEvents).values({
    requestId: input.requestId,
    eventType: input.eventType,
    actorEmail: input.actorEmail,
    previousStatus: input.previousStatus || null,
    newStatus: input.newStatus || null,
    details: input.details ? JSON.stringify(input.details) : null,
  });
}

export function adminConfiguration() {
  const runtime = env as unknown as RuntimeEnv;
  return { inviteEnabled: Boolean(runtime.BETA_INVITE_URL?.trim()) };
}
