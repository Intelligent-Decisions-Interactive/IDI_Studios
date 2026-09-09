import { env } from "cloudflare:workers";
import type { AutoBattleIdentity } from "./autobattle-auth";

type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
};

type ProfileRow = {
  user_id: string;
  email: string;
  player_name: string | null;
  access_status: string;
  created_at: string;
  updated_at: string;
};

export type AutoBattleAdminAccount = {
  userId: string;
  email: string;
  playerName: string;
  accessStatus: "pending" | "beta" | "active" | "suspended";
  createdAt: string;
  updatedAt: string;
};

type BalanceRow = {
  purchased_balance: number | string;
  bonus_balance: number | string;
  promotional_balance: number | string;
  updated_at: string;
};

type DiscountRow = {
  id: string;
  percent_off: number;
  remaining_uses: number;
  unlimited: boolean;
  status: string;
  created_at: string;
};

type LedgerRow = {
  id: string;
  entry_type: string;
  status: string;
  purchased_delta: number | string;
  bonus_delta: number | string;
  promotional_delta: number | string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type DeviceRow = {
  id: string;
  device_name: string;
  expires_at: string;
  last_seen_at: string;
  created_at: string;
};

type BetaRequestRow = {
  name: string;
  status: string;
  testing_focus: string;
};

type DeviceSessionRow = DeviceRow & { user_id: string };

type ProfileIdRow = { user_id: string };

export type AutoBattleAccount = {
  email: string;
  playerName: string;
  accessStatus: string;
  balances: {
    purchased: number;
    bonus: number;
    promotional: number;
    total: number;
  };
  discount: null | {
    id: string;
    percentOff: number;
    remainingUses: number;
    unlimited: boolean;
  };
  devices: Array<{
    id: string;
    name: string;
    expiresAt: string;
    lastSeenAt: string;
    createdAt: string;
  }>;
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

export type ManualAutoBattlePurchase = {
  alreadyFulfilled: boolean;
  orderId: string;
  sku: string;
  paidTokens: number;
  bonusTokens: number;
  subtotalCents: number;
  discountCents: number;
  discountPercent?: number;
  discountUnlimited: boolean;
  totalCents: number;
  currency: string;
  purchasedBalance: number;
  bonusBalance: number;
  promotionalBalance: number;
};

export type AutoBattleCheckoutQuote = {
  sku: string;
  paidTokens: number;
  bonusTokens: number;
  subtotalCents: number;
  discountCents: number;
  discountPercent: number;
  discountEntitlementId: string | null;
  totalCents: number;
  currency: string;
};

export class AutoBattleDatabaseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function configuration() {
  const runtime = env as unknown as RuntimeEnv;
  const url = runtime.SUPABASE_URL?.trim().replace(/\/+$/, "") || "";
  const secret = runtime.SUPABASE_SECRET_KEY?.trim() || "";
  if (!url || !secret) throw new Error("AutoBattle account storage is not configured.");
  return { url, secret };
}

function serviceHeaders(secret: string, prefer?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: secret,
  };
  if (!secret.startsWith("sb_")) headers.Authorization = `Bearer ${secret}`;
  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function serviceRequest<T>(
  path: string,
  options: RequestInit = {},
  prefer?: string,
) {
  const { url, secret } = configuration();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...serviceHeaders(secret, prefer),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text.slice(0, 500) || "Account storage request failed.";
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // Preserve the bounded response text.
    }
    throw new AutoBattleDatabaseError(message, response.status);
  }
  return (text ? JSON.parse(text) : null) as T;
}

async function rpc<T>(name: string, body: Record<string, unknown>) {
  return serviceRequest<T>(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeCode(value: unknown) {
  return typeof value === "string"
    ? value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 64)
    : "";
}

async function matchingBetaRequest(email: string) {
  const rows = await serviceRequest<BetaRequestRow[]>(
    `beta_access_requests?email=eq.${encodeURIComponent(email)}&select=name,status,testing_focus&limit=1`,
  );
  const row = rows?.[0];
  return row?.testing_focus?.startsWith("[AutoBattle") ? row : null;
}

export async function ensureAutoBattleAccount(identity: AutoBattleIdentity) {
  const beta = await matchingBetaRequest(identity.email);
  const accessStatus = beta && ["approved", "invited", "active"].includes(beta.status)
    ? "beta"
    : "pending";
  await rpc("autobattle_ensure_account", {
    p_user_id: identity.id,
    p_email: identity.email,
    p_player_name: beta?.name || null,
    p_access_status: accessStatus,
  });
}

function integer(value: number | string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export async function getAutoBattleAccount(userId: string): Promise<AutoBattleAccount | null> {
  await rpc<number>("autobattle_release_stale_cycles", { p_user_id: userId });
  const [profiles, balances, discounts, devices, activity] = await Promise.all([
    serviceRequest<ProfileRow[]>(
      `autobattle_profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email,player_name,access_status,created_at,updated_at&limit=1`,
    ),
    serviceRequest<BalanceRow[]>(
      `autobattle_token_accounts?user_id=eq.${encodeURIComponent(userId)}&select=purchased_balance,bonus_balance,promotional_balance,updated_at&limit=1`,
    ),
    serviceRequest<DiscountRow[]>(
      `autobattle_discount_entitlements?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&or=(unlimited.eq.true,remaining_uses.gt.0)&select=id,percent_off,remaining_uses,unlimited,status,created_at&order=unlimited.desc,percent_off.desc,created_at.asc&limit=1`,
    ),
    serviceRequest<DeviceRow[]>(
      `autobattle_device_sessions?user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,device_name,expires_at,last_seen_at,created_at&order=created_at.desc&limit=20`,
    ),
    serviceRequest<LedgerRow[]>(
      `autobattle_token_ledger?user_id=eq.${encodeURIComponent(userId)}&select=id,entry_type,status,purchased_delta,bonus_delta,promotional_delta,metadata,created_at&order=created_at.desc&limit=30`,
    ),
  ]);

  const profile = profiles?.[0];
  const balance = balances?.[0];
  if (!profile || !balance) return null;
  const purchased = integer(balance.purchased_balance);
  const bonus = integer(balance.bonus_balance);
  const promotional = integer(balance.promotional_balance);
  const discount = discounts?.[0];
  return {
    email: profile.email,
    playerName: profile.player_name || "",
    accessStatus: profile.access_status,
    balances: { purchased, bonus, promotional, total: purchased + bonus + promotional },
    discount: discount ? {
      id: discount.id,
      percentOff: integer(discount.percent_off),
      remainingUses: integer(discount.remaining_uses),
      unlimited: Boolean(discount.unlimited),
    } : null,
    devices: (devices || []).map((device) => ({
      id: device.id,
      name: device.device_name,
      expiresAt: device.expires_at,
      lastSeenAt: device.last_seen_at,
      createdAt: device.created_at,
    })),
    activity: (activity || []).map((entry) => ({
      id: entry.id,
      type: entry.entry_type,
      status: entry.status,
      purchasedDelta: integer(entry.purchased_delta),
      bonusDelta: integer(entry.bonus_delta),
      promotionalDelta: integer(entry.promotional_delta),
      metadata: entry.metadata || {},
      createdAt: entry.created_at,
    })),
  };
}

export async function fulfillManualAutoBattlePurchase(input: {
  email: string;
  sku: string;
  paymentReference: string;
  createdBy: string;
  applyDiscount: boolean;
}): Promise<ManualAutoBattlePurchase> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const profiles = await serviceRequest<ProfileIdRow[]>(
    `autobattle_profiles?email=eq.${encodeURIComponent(normalizedEmail)}&select=user_id&limit=1`,
  );
  const profile = profiles?.[0];
  if (!profile) {
    throw new AutoBattleDatabaseError(
      "The player must sign in to AutoBattle once before a purchase can be credited.",
      404,
    );
  }

  return rpc<ManualAutoBattlePurchase>("autobattle_fulfill_manual_purchase", {
    p_user_id: profile.user_id,
    p_sku: input.sku,
    p_payment_reference: input.paymentReference,
    p_created_by: input.createdBy,
    p_apply_discount: input.applyDiscount,
  });
}

export async function getAutoBattleCheckoutQuote(userId: string, sku: string) {
  return rpc<AutoBattleCheckoutQuote>("autobattle_checkout_quote", {
    p_user_id: userId,
    p_sku: sku,
  });
}

export async function fulfillAutoBattleStripeCheckout(input: {
  eventId: string;
  eventType: string;
  checkoutId: string;
  paymentIntentId: string;
  userId: string;
  sku: string;
  currency: string;
  amountSubtotal: number;
  amountTax: number;
  amountTotal: number;
  discountPercent: number;
  discountEntitlementId: string | null;
  liveMode: boolean;
}) {
  return rpc<Record<string, unknown>>("autobattle_fulfill_stripe_checkout", {
    p_event_id: input.eventId,
    p_event_type: input.eventType,
    p_checkout_id: input.checkoutId,
    p_payment_intent_id: input.paymentIntentId || null,
    p_user_id: input.userId,
    p_sku: input.sku,
    p_currency: input.currency,
    p_amount_subtotal: input.amountSubtotal,
    p_amount_tax: input.amountTax,
    p_amount_total: input.amountTotal,
    p_discount_percent: input.discountPercent,
    p_discount_entitlement_id: input.discountEntitlementId,
    p_livemode: input.liveMode,
  });
}

export async function recordAutoBattleStripeEvent(input: {
  eventId: string;
  eventType: string;
  objectId: string;
  liveMode: boolean;
  status: "failed" | "ignored" | "needs_review";
  details: Record<string, unknown>;
}) {
  return rpc<Record<string, unknown>>("autobattle_record_stripe_event", {
    p_event_id: input.eventId,
    p_event_type: input.eventType,
    p_object_id: input.objectId || null,
    p_livemode: input.liveMode,
    p_status: input.status,
    p_details: input.details,
  });
}

export async function updateAutoBattlePlayerName(userId: string, playerName: string) {
  const rows = await serviceRequest<ProfileRow[]>(
    `autobattle_profiles?user_id=eq.${encodeURIComponent(userId)}`,
    { method: "PATCH", body: JSON.stringify({ player_name: playerName, updated_at: new Date().toISOString() }) },
    "return=representation",
  );
  if (!rows?.[0]) throw new Error("AutoBattle account was not found.");
}

function mapAutoBattleAdminAccount(row: ProfileRow): AutoBattleAdminAccount {
  return {
    userId: row.user_id,
    email: row.email,
    playerName: row.player_name || "",
    accessStatus: row.access_status as AutoBattleAdminAccount["accessStatus"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAutoBattleAdminAccounts() {
  const rows = await serviceRequest<ProfileRow[]>(
    "autobattle_profiles?select=user_id,email,player_name,access_status,created_at,updated_at&order=created_at.desc&limit=250",
  );
  return (rows || []).map(mapAutoBattleAdminAccount);
}

export async function getAutoBattleAdminAccount(userId: string) {
  const rows = await serviceRequest<ProfileRow[]>(
    `autobattle_profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email,player_name,access_status,created_at,updated_at&limit=1`,
  );
  return rows?.[0] ? mapAutoBattleAdminAccount(rows[0]) : null;
}

export async function hasAutoBattleCampaignRedemption(
  userId: string,
  campaignKey: string,
) {
  const rows = await serviceRequest<Array<{ id: string }>>(
    `autobattle_code_redemptions?user_id=eq.${encodeURIComponent(userId)}&campaign_key=eq.${encodeURIComponent(campaignKey)}&select=id&limit=1`,
  );
  return Boolean(rows?.[0]);
}

export async function deactivateAssignedAutoBattleInviteCodes(
  userId: string,
  campaignKey: string,
) {
  await serviceRequest(
    `autobattle_invite_codes?assigned_user_id=eq.${encodeURIComponent(userId)}&campaign_key=eq.${encodeURIComponent(campaignKey)}&active=eq.true&redemption_count=eq.0`,
    { method: "PATCH", body: JSON.stringify({ active: false }) },
  );
}

export async function deactivateAutoBattleInviteCode(id: string) {
  await serviceRequest(
    `autobattle_invite_codes?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify({ active: false }) },
  );
}

export async function updateAutoBattleAccessStatus(
  userId: string,
  accessStatus: AutoBattleAdminAccount["accessStatus"],
) {
  const rows = await serviceRequest<ProfileRow[]>(
    `autobattle_profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email,player_name,access_status,created_at,updated_at`,
    {
      method: "PATCH",
      body: JSON.stringify({
        access_status: accessStatus,
        updated_at: new Date().toISOString(),
      }),
    },
    "return=representation",
  );
  if (!rows?.[0]) throw new Error("AutoBattle account was not found.");
  return mapAutoBattleAdminAccount(rows[0]);
}

export async function redeemAutoBattleInvite(userId: string, normalizedCode: string) {
  return rpc<Record<string, unknown>>("autobattle_redeem_invite_code", {
    p_user_id: userId,
    p_code_hash: await sha256Hex(normalizedCode),
  });
}

export async function createDeviceLinkCode(userId: string, codeHash: string, expiresAt: string) {
  await serviceRequest(
    "autobattle_device_link_codes",
    { method: "POST", body: JSON.stringify({ user_id: userId, code_hash: codeHash, expires_at: expiresAt }) },
  );
}

export async function exchangeDeviceLinkCode(codeHash: string, tokenHash: string, deviceName: string) {
  return rpc<{ sessionId: string; userId: string; deviceName: string; expiresAt: string }>(
    "autobattle_link_device",
    { p_code_hash: codeHash, p_session_token_hash: tokenHash, p_device_name: deviceName },
  );
}

export async function authenticateDeviceToken(rawToken: string) {
  const tokenHash = await sha256Hex(rawToken);
  const rows = await serviceRequest<DeviceSessionRow[]>(
    `autobattle_device_sessions?token_hash=eq.${tokenHash}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,user_id,device_name,expires_at,last_seen_at,created_at&limit=1`,
  );
  const session = rows?.[0];
  if (!session) return null;
  await serviceRequest(
    `autobattle_device_sessions?id=eq.${encodeURIComponent(session.id)}`,
    { method: "PATCH", body: JSON.stringify({ last_seen_at: new Date().toISOString() }) },
  );
  return session;
}

export async function revokeDeviceSession(userId: string, sessionId: string) {
  await serviceRequest(
    `autobattle_device_sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "PATCH", body: JSON.stringify({ revoked_at: new Date().toISOString() }) },
  );
}

export async function reserveAutoBattleCycle(userId: string, idempotencyKey: string, workflowName: string) {
  return rpc<{ reservationId: string; status: string }>("autobattle_reserve_cycle", {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_workflow_name: workflowName,
  });
}

export async function commitAutoBattleCycle(userId: string, reservationId: string) {
  return rpc<{ reservationId: string; status: string }>("autobattle_commit_cycle", {
    p_user_id: userId,
    p_reservation_id: reservationId,
  });
}

export async function releaseAutoBattleCycle(userId: string, reservationId: string) {
  return rpc<{ reservationId: string; status: string }>("autobattle_release_cycle", {
    p_user_id: userId,
    p_reservation_id: reservationId,
  });
}

export async function insertClanInviteCodes(rows: Array<Record<string, unknown>>) {
  return serviceRequest<Array<{
    id: string;
    campaign_key: string;
    label: string;
    max_redemptions: number;
    created_at: string;
  }>>(
    "autobattle_invite_codes?select=id,campaign_key,label,max_redemptions,created_at",
    { method: "POST", body: JSON.stringify(rows) },
    "return=representation",
  );
}
