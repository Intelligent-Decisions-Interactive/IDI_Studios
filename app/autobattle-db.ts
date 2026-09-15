import { env } from "cloudflare:workers";
import type { AutoBattleIdentity } from "./autobattle-auth";

type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  AUTOBATTLE_DB_CAPABILITY?: string;
};

type ProfileRow = {
  user_id: string;
  email: string;
  player_name: string | null;
  access_status: string;
  clan_member: boolean;
  signup_affiliation: AutoBattleSignupAffiliation;
  created_at: string;
  updated_at: string;
};

export type AutoBattleSignupAffiliation = "not_provided" | "clan" | "individual";

export type AutoBattleAdminAccount = {
  userId: string;
  email: string;
  playerName: string;
  accessStatus: "pending" | "beta" | "active" | "suspended";
  clanMember: boolean;
  signupAffiliation: AutoBattleSignupAffiliation;
  purchasedTokens: number;
  bonusTokens: number;
  promotionalTokens: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
};

export type AutoBattlePaymentReview = {
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
  accessStatus: AutoBattleAdminAccount["accessStatus"];
};

export type AutoBattleSupportStatus =
  | "open"
  | "in_progress"
  | "waiting_on_user"
  | "resolved"
  | "closed";

type AutoBattleSupportTicketRow = {
  id: string;
  user_id: string;
  contact_email: string;
  player_name: string;
  category: string;
  subject: string;
  initial_message: string;
  status: AutoBattleSupportStatus;
  release_channel: "production" | "internal";
  application_id: string;
  app_version_name: string;
  app_version_code: number | string;
  device_manufacturer: string;
  device_model: string;
  android_version: string;
  diagnostics_excerpt: string | null;
  created_at: string;
  updated_at: string;
  last_user_message_at: string;
  last_admin_message_at: string | null;
};

type AutoBattleSupportMessageRow = {
  id: string;
  ticket_id: string;
  author_type: "user" | "admin";
  author_email: string;
  body: string;
  created_at: string;
};

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

type BalanceRow = {
  purchased_balance: number | string;
  bonus_balance: number | string;
  promotional_balance: number | string;
  updated_at: string;
};

type AdminBalanceRow = BalanceRow & {
  user_id: string;
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

type AccountDeletionBetaRequestRow = {
  id: number;
  testing_focus: string;
};

export type AutoBattleDeviceSession = DeviceRow & {
  user_id: string;
  release_channel: "production" | "internal";
};

type ReleaseChannelRow = {
  channel: string;
  required_version_code: number | string;
  version_name: string;
  bucket_id: string | null;
  object_path: string | null;
  filename: string | null;
  apk_bytes: number | string | null;
  apk_sha256: string | null;
  release_notes: string;
  enforcement_enabled: boolean;
  published_at: string | null;
  updated_at: string;
};

type CloudBackupRow = {
  id: string;
  object_path: string;
  source_release_channel: string;
  source_version_name: string;
  schema_version: number | string;
  file_bytes: number | string;
  sha256: string;
  profile_count: number | string;
  image_count: number | string;
  created_at: string;
  completed_at: string;
};

type CloudUploadRow = {
  id: string;
  object_path: string;
  file_bytes: number | string;
};

const CLOUD_BACKUP_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AutoBattleCloudBackup = {
  id: string;
  sourceReleaseChannel: "production" | "internal";
  sourceVersionName: string;
  schemaVersion: number;
  fileBytes: number;
  sha256: string;
  profileCount: number;
  imageCount: number;
  createdAt: string;
  completedAt: string;
};

export type AutoBattleReleasePolicy = {
  channel: "production" | "internal";
  requiredVersionCode: number;
  versionName: string;
  bucketId: string | null;
  objectPath: string | null;
  filename: string | null;
  apkBytes: number | null;
  apkSha256: string | null;
  releaseNotes: string;
  enforcementEnabled: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

export type AutoBattleAccount = {
  email: string;
  playerName: string;
  accessStatus: string;
  signupAffiliation: AutoBattleSignupAffiliation;
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
  referral: {
    code: string;
    referredCount: number;
    cycleRewardCount: number;
    purchaseRewardCount: number;
    earnedCredits: number;
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
  const capability = runtime.AUTOBATTLE_DB_CAPABILITY?.trim() || "";
  if (!url || !secret) throw new Error("AutoBattle account storage is not configured.");
  return { url, secret, capability };
}

function creditMintCapability() {
  const capability = configuration().capability;
  if (capability.length < 32) {
    throw new Error("AutoBattle credit authorization is not configured.");
  }
  return capability;
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
    signal: options.signal || AbortSignal.timeout(15_000),
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
  if (!Number.isSafeInteger(parsed)) throw new Error("invalid_autobattle_integer");
  return parsed;
}

export async function getAutoBattleAccount(userId: string): Promise<AutoBattleAccount | null> {
  await rpc<void>("autobattle_assert_token_integrity", { p_user_id: userId });
  await rpc<number>("autobattle_release_stale_cycles", { p_user_id: userId });
  const [profiles, balances, discounts, devices, activity, referral] = await Promise.all([
    serviceRequest<ProfileRow[]>(
      `autobattle_profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email,player_name,access_status,clan_member,signup_affiliation,created_at,updated_at&limit=1`,
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
    rpc<{
      code: string;
      referredCount: number | string;
      cycleRewardCount: number | string;
      purchaseRewardCount: number | string;
      earnedCredits: number | string;
    }>("autobattle_get_referral_summary", { p_user_id: userId }),
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
    signupAffiliation: profile.signup_affiliation,
    balances: { purchased, bonus, promotional, total: purchased + bonus + promotional },
    discount: discount ? {
      id: discount.id,
      percentOff: integer(discount.percent_off),
      remainingUses: integer(discount.remaining_uses),
      unlimited: Boolean(discount.unlimited),
    } : null,
    referral: {
      code: referral.code,
      referredCount: integer(referral.referredCount),
      cycleRewardCount: integer(referral.cycleRewardCount),
      purchaseRewardCount: integer(referral.purchaseRewardCount),
      earnedCredits: integer(referral.earnedCredits),
    },
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

export async function getAutoBattleReleaseAccessStatus(userId: string) {
  const rows = await serviceRequest<Array<{ access_status: string }>>(
    `autobattle_profiles?user_id=eq.${encodeURIComponent(userId)}&select=access_status&limit=1`,
  );
  const status = rows?.[0]?.access_status || "";
  return status === "beta" || status === "active" ? status : null;
}

export async function getAutoBattleReleasePolicy(
  channel: "production" | "internal" = "production",
): Promise<AutoBattleReleasePolicy> {
  const rows = await serviceRequest<ReleaseChannelRow[]>(
    `autobattle_release_channels?channel=eq.${encodeURIComponent(channel)}&select=channel,required_version_code,version_name,bucket_id,object_path,filename,apk_bytes,apk_sha256,release_notes,enforcement_enabled,published_at,updated_at&limit=1`,
  );
  const row = rows?.[0];
  if (!row || (row.channel !== "production" && row.channel !== "internal")) {
    throw new Error("AutoBattle release policy is unavailable.");
  }
  const requiredVersionCode = integer(row.required_version_code);
  const apkBytes = row.apk_bytes == null ? null : integer(row.apk_bytes);
  const apkSha256 = row.apk_sha256?.toLowerCase() || null;
  const safeBucket = row.bucket_id == null || /^[a-z0-9][a-z0-9._-]{2,99}$/.test(row.bucket_id);
  const safeObjectPath = row.object_path == null || (
    row.object_path.length >= 3 &&
    row.object_path.length <= 500 &&
    !/[\r\n\\]/.test(row.object_path) &&
    !/(^|\/)\.\.?($|\/)/.test(row.object_path)
  );
  const safeFilename = row.filename == null || /^[A-Za-z0-9][A-Za-z0-9._-]{1,175}\.apk$/.test(row.filename);
  if (
    requiredVersionCode < 1 ||
    requiredVersionCode > 2_100_000_000 ||
    !row.version_name ||
    row.version_name.length > 40 ||
    !safeBucket ||
    !safeObjectPath ||
    !safeFilename ||
    (apkSha256 != null && !/^[0-9a-f]{64}$/.test(apkSha256)) ||
    (row.enforcement_enabled && (!row.bucket_id || !row.object_path || !row.filename || !apkBytes || !apkSha256 || !row.published_at))
  ) {
    throw new Error("AutoBattle release policy is invalid.");
  }
  return {
    channel: row.channel,
    requiredVersionCode,
    versionName: row.version_name,
    bucketId: row.bucket_id,
    objectPath: row.object_path,
    filename: row.filename,
    apkBytes,
    apkSha256,
    releaseNotes: row.release_notes || "",
    enforcementEnabled: Boolean(row.enforcement_enabled),
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

function mapCloudBackup(row: CloudBackupRow): AutoBattleCloudBackup {
  if (
    !/^[0-9a-f-]{36}$/i.test(row.id) ||
    (row.source_release_channel !== "production" && row.source_release_channel !== "internal") ||
    !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(row.source_version_name) ||
    !/^[0-9a-f]{64}$/.test(row.sha256)
  ) {
    throw new Error("AutoBattle cloud backup metadata is invalid.");
  }
  return {
    id: row.id,
    sourceReleaseChannel: row.source_release_channel,
    sourceVersionName: row.source_version_name,
    schemaVersion: integer(row.schema_version),
    fileBytes: integer(row.file_bytes),
    sha256: row.sha256,
    profileCount: integer(row.profile_count),
    imageCount: integer(row.image_count),
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function listAutoBattleCloudBackups(
  userId: string,
): Promise<AutoBattleCloudBackup[]> {
  const rows = await serviceRequest<CloudBackupRow[]>(
    `autobattle_cloud_backups?user_id=eq.${encodeURIComponent(userId)}&status=eq.ready&select=id,object_path,source_release_channel,source_version_name,schema_version,file_bytes,sha256,profile_count,image_count,created_at,completed_at&order=created_at.desc,id.desc&limit=5`,
  );
  return (rows || []).map(mapCloudBackup);
}

export async function getAutoBattleCloudBackup(
  userId: string,
  backupId: string,
): Promise<(AutoBattleCloudBackup & { objectPath: string }) | null> {
  const rows = await serviceRequest<CloudBackupRow[]>(
    `autobattle_cloud_backups?id=eq.${encodeURIComponent(backupId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.ready&select=id,object_path,source_release_channel,source_version_name,schema_version,file_bytes,sha256,profile_count,image_count,created_at,completed_at&limit=1`,
  );
  const row = rows?.[0];
  return row ? { ...mapCloudBackup(row), objectPath: row.object_path } : null;
}

export async function getAutoBattleCloudUpload(
  userId: string,
  backupId: string,
): Promise<{ id: string; objectPath: string; fileBytes: number } | null> {
  const rows = await serviceRequest<CloudUploadRow[]>(
    `autobattle_cloud_backups?id=eq.${encodeURIComponent(backupId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.uploading&select=id,object_path,file_bytes&limit=1`,
  );
  const row = rows?.[0];
  const fileBytes = row ? integer(row.file_bytes) : 0;
  if (!row) return null;
  if (!CLOUD_BACKUP_UUID_PATTERN.test(row.id) || !row.object_path || fileBytes < 1 || fileBytes > 100 * 1024 * 1024) {
    throw new Error("AutoBattle cloud upload metadata is invalid.");
  }
  return { id: row.id, objectPath: row.object_path, fileBytes };
}

export async function beginAutoBattleCloudBackup(input: {
  userId: string;
  expectedBackupId: string | null;
  force: boolean;
  sourceReleaseChannel: "production" | "internal";
  sourceVersionName: string;
  schemaVersion: number;
  fileBytes: number;
  sha256: string;
  profileCount: number;
  imageCount: number;
}) {
  return rpc<{
    accepted: boolean;
    backupId?: string;
    objectPath?: string;
    latestBackupId?: string;
    latestStatus?: string;
    latestCreatedAt?: string;
  }>("autobattle_begin_cloud_backup", {
    p_user_id: input.userId,
    p_expected_backup_id: input.expectedBackupId,
    p_force: input.force,
    p_source_release_channel: input.sourceReleaseChannel,
    p_source_version_name: input.sourceVersionName,
    p_schema_version: input.schemaVersion,
    p_file_bytes: input.fileBytes,
    p_sha256: input.sha256,
    p_profile_count: input.profileCount,
    p_image_count: input.imageCount,
  });
}

export async function finalizeAutoBattleCloudBackup(userId: string, backupId: string) {
  return rpc<AutoBattleCloudBackup & { prunedObjectPaths: string[] }>(
    "autobattle_finalize_cloud_backup",
    { p_user_id: userId, p_backup_id: backupId },
  );
}

export async function failAutoBattleCloudBackup(userId: string, backupId: string, reason: string) {
  return rpc<void>("autobattle_fail_cloud_backup", {
    p_user_id: userId,
    p_backup_id: backupId,
    p_reason: reason,
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
    p_capability: creditMintCapability(),
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

export async function recordAutoBattleStripeReviewEvent(input: {
  eventId: string;
  eventType: string;
  objectId: string;
  paymentIntentId: string;
  liveMode: boolean;
  amount: number;
  suspendAccount: boolean;
  details: Record<string, unknown>;
}) {
  return rpc<{ matched: boolean; eventId?: string; userId?: string; alreadyRecorded: boolean }>(
    "autobattle_record_stripe_review_event",
    {
      p_event_id: input.eventId,
      p_event_type: input.eventType,
      p_object_id: input.objectId,
      p_payment_intent_id: input.paymentIntentId,
      p_livemode: input.liveMode,
      p_amount: input.amount,
      p_suspend_account: input.suspendAccount,
      p_details: input.details,
    },
  );
}

export async function listAutoBattlePaymentReviews() {
  return rpc<AutoBattlePaymentReview[]>("autobattle_list_payment_reviews", {});
}

export async function resolveAutoBattlePaymentReview(eventId: string, resolution: string, actor: string) {
  return rpc<{ id: string; status: string }>("autobattle_resolve_payment_review", {
    p_event_id: eventId,
    p_resolution: resolution,
    p_actor: actor,
  });
}

function mapAutoBattleSupportTicket(
  row: AutoBattleSupportTicketRow,
  messages: AutoBattleSupportMessageRow[],
  exposeDiagnostics: boolean,
): AutoBattleSupportTicket {
  return {
    id: row.id,
    userId: row.user_id,
    contactEmail: row.contact_email,
    playerName: row.player_name,
    category: row.category,
    subject: row.subject,
    initialMessage: row.initial_message,
    status: row.status,
    releaseChannel: row.release_channel,
    applicationId: row.application_id,
    appVersionName: row.app_version_name,
    appVersionCode: integer(row.app_version_code),
    deviceManufacturer: row.device_manufacturer,
    deviceModel: row.device_model,
    androidVersion: row.android_version,
    diagnosticsIncluded: Boolean(row.diagnostics_excerpt),
    diagnosticsExcerpt: exposeDiagnostics ? row.diagnostics_excerpt : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUserMessageAt: row.last_user_message_at,
    lastAdminMessageAt: row.last_admin_message_at,
    messages: messages.map((message) => ({
      id: message.id,
      authorType: message.author_type,
      authorEmail: message.author_email,
      body: message.body,
      createdAt: message.created_at,
    })),
  };
}

async function hydrateAutoBattleSupportTickets(
  rows: AutoBattleSupportTicketRow[],
  exposeDiagnostics: boolean,
) {
  if (!rows.length) return [];
  const ticketIds = rows.map((row) => row.id);
  const messages = await serviceRequest<AutoBattleSupportMessageRow[]>(
    `autobattle_support_messages?ticket_id=in.(${ticketIds.join(",")})&select=id,ticket_id,author_type,author_email,body,created_at&order=created_at.asc&limit=2000`,
  );
  const messagesByTicket = new Map<string, AutoBattleSupportMessageRow[]>();
  for (const message of messages || []) {
    const current = messagesByTicket.get(message.ticket_id) || [];
    current.push(message);
    messagesByTicket.set(message.ticket_id, current);
  }
  return rows.map((row) => mapAutoBattleSupportTicket(
    row,
    messagesByTicket.get(row.id) || [],
    exposeDiagnostics,
  ));
}

const AUTOBATTLE_SUPPORT_TICKET_SELECT = [
  "id",
  "user_id",
  "contact_email",
  "player_name",
  "category",
  "subject",
  "initial_message",
  "status",
  "release_channel",
  "application_id",
  "app_version_name",
  "app_version_code",
  "device_manufacturer",
  "device_model",
  "android_version",
  "diagnostics_excerpt",
  "created_at",
  "updated_at",
  "last_user_message_at",
  "last_admin_message_at",
].join(",");

export async function listAutoBattleSupportTicketsForUser(userId: string) {
  const rows = await serviceRequest<AutoBattleSupportTicketRow[]>(
    `autobattle_support_tickets?user_id=eq.${encodeURIComponent(userId)}&select=${AUTOBATTLE_SUPPORT_TICKET_SELECT}&order=updated_at.desc&limit=25`,
  );
  return hydrateAutoBattleSupportTickets(rows || [], false);
}

export async function createAutoBattleSupportTicket(input: {
  userId: string;
  category: string;
  subject: string;
  message: string;
  releaseChannel: "production" | "internal";
  applicationId: string;
  appVersionName: string;
  appVersionCode: number;
  deviceManufacturer: string;
  deviceModel: string;
  androidVersion: string;
  diagnosticsExcerpt: string | null;
}) {
  const profiles = await serviceRequest<Pick<ProfileRow, "email" | "player_name">[]>(
    `autobattle_profiles?user_id=eq.${encodeURIComponent(input.userId)}&select=email,player_name&limit=1`,
  );
  const profile = profiles?.[0];
  if (!profile) throw new Error("AutoBattle account was not found.");
  const now = new Date().toISOString();
  const rows = await serviceRequest<AutoBattleSupportTicketRow[]>(
    "autobattle_support_tickets",
    {
      method: "POST",
      body: JSON.stringify({
        user_id: input.userId,
        contact_email: profile.email,
        player_name: profile.player_name || "",
        category: input.category,
        subject: input.subject,
        initial_message: input.message,
        status: "open",
        release_channel: input.releaseChannel,
        application_id: input.applicationId,
        app_version_name: input.appVersionName,
        app_version_code: input.appVersionCode,
        device_manufacturer: input.deviceManufacturer,
        device_model: input.deviceModel,
        android_version: input.androidVersion,
        diagnostics_excerpt: input.diagnosticsExcerpt,
        created_at: now,
        updated_at: now,
        last_user_message_at: now,
      }),
    },
    "return=representation",
  );
  if (!rows?.[0]) throw new Error("The support report was not created.");
  return mapAutoBattleSupportTicket(rows[0], [], false);
}

export async function addAutoBattleSupportUserReply(
  userId: string,
  ticketId: string,
  body: string,
) {
  const rows = await serviceRequest<AutoBattleSupportTicketRow[]>(
    `autobattle_support_tickets?id=eq.${encodeURIComponent(ticketId)}&user_id=eq.${encodeURIComponent(userId)}&select=${AUTOBATTLE_SUPPORT_TICKET_SELECT}&limit=1`,
  );
  const ticket = rows?.[0];
  if (!ticket || ticket.status === "closed") return null;
  const now = new Date().toISOString();
  await serviceRequest(
    "autobattle_support_messages",
    {
      method: "POST",
      body: JSON.stringify({
        ticket_id: ticket.id,
        author_type: "user",
        author_email: ticket.contact_email,
        body,
        created_at: now,
      }),
    },
  );
  await serviceRequest(
    `autobattle_support_tickets?id=eq.${encodeURIComponent(ticket.id)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "open", updated_at: now, last_user_message_at: now }),
    },
  );
  return (await listAutoBattleSupportTicketsForUser(userId)).find((item) => item.id === ticket.id) || null;
}

export async function listAutoBattleAdminSupportTickets() {
  const rows = await serviceRequest<AutoBattleSupportTicketRow[]>(
    `autobattle_support_tickets?select=${AUTOBATTLE_SUPPORT_TICKET_SELECT}&order=updated_at.desc&limit=100`,
  );
  return hydrateAutoBattleSupportTickets(rows || [], true);
}

export async function updateAutoBattleAdminSupportTicket(input: {
  ticketId: string;
  status: AutoBattleSupportStatus;
  reply: string;
  actorEmail: string;
}) {
  const rows = await serviceRequest<AutoBattleSupportTicketRow[]>(
    `autobattle_support_tickets?id=eq.${encodeURIComponent(input.ticketId)}&select=${AUTOBATTLE_SUPPORT_TICKET_SELECT}&limit=1`,
  );
  const ticket = rows?.[0];
  if (!ticket) return null;
  const now = new Date().toISOString();
  if (input.reply) {
    await serviceRequest(
      "autobattle_support_messages",
      {
        method: "POST",
        body: JSON.stringify({
          ticket_id: ticket.id,
          author_type: "admin",
          author_email: input.actorEmail,
          body: input.reply,
          created_at: now,
        }),
      },
    );
  }
  await serviceRequest(
    `autobattle_support_tickets?id=eq.${encodeURIComponent(ticket.id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: input.status,
        updated_at: now,
        ...(input.reply ? { last_admin_message_at: now } : {}),
      }),
    },
  );
  return (await listAutoBattleAdminSupportTickets()).find((item) => item.id === ticket.id) || null;
}

export async function updateAutoBattlePlayerName(userId: string, playerName: string) {
  const rows = await serviceRequest<ProfileRow[]>(
    `autobattle_profiles?user_id=eq.${encodeURIComponent(userId)}`,
    { method: "PATCH", body: JSON.stringify({ player_name: playerName, updated_at: new Date().toISOString() }) },
    "return=representation",
  );
  if (!rows?.[0]) throw new Error("AutoBattle account was not found.");
}

export async function recordAutoBattleSignupAffiliation(
  userId: string,
  signupAffiliation: Exclude<AutoBattleSignupAffiliation, "not_provided">,
) {
  await serviceRequest<ProfileRow[]>(
    `autobattle_profiles?user_id=eq.${encodeURIComponent(userId)}&signup_affiliation=eq.not_provided`,
    {
      method: "PATCH",
      body: JSON.stringify({
        signup_affiliation: signupAffiliation,
        updated_at: new Date().toISOString(),
      }),
    },
    "return=representation",
  );
}

function mapAutoBattleAdminAccount(
  row: ProfileRow,
  balance?: AdminBalanceRow,
): AutoBattleAdminAccount {
  const purchasedTokens = balance ? integer(balance.purchased_balance) : 0;
  const bonusTokens = balance ? integer(balance.bonus_balance) : 0;
  const promotionalTokens = balance ? integer(balance.promotional_balance) : 0;
  return {
    userId: row.user_id,
    email: row.email,
    playerName: row.player_name || "",
    accessStatus: row.access_status as AutoBattleAdminAccount["accessStatus"],
    clanMember: Boolean(row.clan_member),
    signupAffiliation: row.signup_affiliation,
    purchasedTokens,
    bonusTokens,
    promotionalTokens,
    totalTokens: purchasedTokens + bonusTokens + promotionalTokens,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAutoBattleAdminAccounts() {
  const [rows, balances] = await Promise.all([
    serviceRequest<ProfileRow[]>(
      "autobattle_profiles?select=user_id,email,player_name,access_status,clan_member,signup_affiliation,created_at,updated_at&order=created_at.desc&limit=250",
    ),
    serviceRequest<AdminBalanceRow[]>(
      "autobattle_token_accounts?select=user_id,purchased_balance,bonus_balance,promotional_balance,updated_at&limit=250",
    ),
  ]);
  const balancesByUser = new Map((balances || []).map((balance) => [balance.user_id, balance]));
  return (rows || []).map((row) => mapAutoBattleAdminAccount(row, balancesByUser.get(row.user_id)));
}

export async function getAutoBattleAdminAccount(userId: string) {
  const [rows, balances] = await Promise.all([
    serviceRequest<ProfileRow[]>(
      `autobattle_profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email,player_name,access_status,clan_member,signup_affiliation,created_at,updated_at&limit=1`,
    ),
    serviceRequest<AdminBalanceRow[]>(
      `autobattle_token_accounts?user_id=eq.${encodeURIComponent(userId)}&select=user_id,purchased_balance,bonus_balance,promotional_balance,updated_at&limit=1`,
    ),
  ]);
  return rows?.[0] ? mapAutoBattleAdminAccount(rows[0], balances?.[0]) : null;
}

export async function listAutoBattleCloudBackupObjectPaths(userId: string) {
  const rows = await serviceRequest<Array<{ object_path: string }>>(
    `autobattle_cloud_backups?user_id=eq.${encodeURIComponent(userId)}&select=object_path&limit=1000`,
  );
  const expectedPrefix = `${userId}/`;
  return (rows || []).map((row) => {
    const objectPath = typeof row.object_path === "string" ? row.object_path.trim() : "";
    if (
      !objectPath.startsWith(expectedPrefix) ||
      !/^([0-9a-f-]{36})\/([0-9a-f-]{36})\.abprofile$/i.test(objectPath)
    ) {
      throw new Error("AutoBattle cloud backup path is invalid.");
    }
    return objectPath;
  });
}

export async function removeAutoBattleAccountDependencies(userId: string, email: string) {
  const betaRequests = await serviceRequest<AccountDeletionBetaRequestRow[]>(
    `beta_access_requests?email=eq.${encodeURIComponent(email)}&select=id,testing_focus&limit=10`,
  );
  const autoBattleRequestIds = (betaRequests || [])
    .filter((row) => row.testing_focus?.startsWith("[AutoBattle"))
    .map((row) => row.id)
    .filter((id) => Number.isSafeInteger(id) && id > 0);

  await rpc<number>("autobattle_delete_account_orders", {
    p_user_id: userId,
  });
  for (const requestId of autoBattleRequestIds) {
    await serviceRequest(`beta_access_requests?id=eq.${requestId}`, { method: "DELETE" });
  }
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
    `autobattle_profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email,player_name,access_status,clan_member,signup_affiliation,created_at,updated_at`,
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
  const account = await getAutoBattleAdminAccount(userId);
  if (!account) throw new Error("AutoBattle account was not found.");
  return account;
}

export async function grantAutoBattleAdminTestCredits(input: {
  userId: string;
  amount: number;
  requestId: string;
  actorEmail: string;
}) {
  const grant = await rpc<{
    ledgerId: string;
    status: string;
    purchased: number | string;
    bonus: number | string;
    promotional: number | string;
  }>("autobattle_admin_grant_test_tokens", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_request_id: input.requestId,
    p_actor_email: input.actorEmail,
    p_reason: "Manual token-flow testing",
    p_capability: creditMintCapability(),
  });
  const account = await getAutoBattleAdminAccount(input.userId);
  if (!account) throw new Error("AutoBattle account was not found after the credit grant.");
  return { grant, account };
}

export async function redeemAutoBattleInvite(userId: string, normalizedCode: string) {
  return rpc<Record<string, unknown>>("autobattle_redeem_invite_code", {
    p_user_id: userId,
    p_code_hash: await sha256Hex(normalizedCode),
    p_capability: creditMintCapability(),
  });
}

export async function updateAutoBattleClanMembership(userId: string, clanMember: boolean) {
  const rows = await serviceRequest<ProfileRow[]>(
    `autobattle_profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,email,player_name,access_status,clan_member,signup_affiliation,created_at,updated_at`,
    {
      method: "PATCH",
      body: JSON.stringify({
        clan_member: clanMember,
        updated_at: new Date().toISOString(),
      }),
    },
    "return=representation",
  );
  if (!rows?.[0]) throw new Error("AutoBattle account was not found.");
  const account = await getAutoBattleAdminAccount(userId);
  if (!account) throw new Error("AutoBattle account was not found.");
  return account;
}

export async function claimAutoBattleReferral(userId: string, normalizedCode: string) {
  return rpc<{
    claimed: boolean;
    alreadyClaimed: boolean;
    referralId: string;
    promotionalCredits?: number;
    discountPercent?: number;
    discountUses?: number;
  }>("autobattle_claim_referral", {
    p_user_id: userId,
    p_code: normalizedCode,
    p_capability: creditMintCapability(),
  });
}

export async function createDeviceLinkCode(userId: string, codeHash: string, expiresAt: string) {
  await rpc("autobattle_replace_device_link_code", {
    p_user_id: userId,
    p_code_hash: codeHash,
    p_expires_at: expiresAt,
  });
}

export async function exchangeDeviceLinkCode(
  codeHash: string,
  tokenHash: string,
  deviceName: string,
  releaseChannel: "production" | "internal",
) {
  return rpc<{ sessionId: string; userId: string; deviceName: string; expiresAt: string }>(
    "autobattle_link_device_for_channel",
    {
      p_code_hash: codeHash,
      p_session_token_hash: tokenHash,
      p_device_name: deviceName,
      p_release_channel: releaseChannel,
    },
  );
}

export async function authenticateDeviceToken(rawToken: string) {
  const tokenHash = await sha256Hex(rawToken);
  const rows = await serviceRequest<AutoBattleDeviceSession[]>(
    `autobattle_device_sessions?token_hash=eq.${tokenHash}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,user_id,device_name,expires_at,last_seen_at,created_at,release_channel&limit=1`,
  );
  const session = rows?.[0];
  if (!session) return null;
  const now = Date.now();
  const lastSeenAt = Date.parse(session.last_seen_at);
  if (!Number.isFinite(lastSeenAt) || now - lastSeenAt >= 5 * 60 * 1000) {
    await serviceRequest(
      `autobattle_device_sessions?id=eq.${encodeURIComponent(session.id)}`,
      { method: "PATCH", body: JSON.stringify({ last_seen_at: new Date(now).toISOString() }) },
    );
  }
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
