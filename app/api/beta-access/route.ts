import { env } from "cloudflare:workers";
import {
  getBetaEmailConfig,
  sendApplicantConfirmation,
  sendStudioNotification,
} from "../../beta-email";
import { logBetaEvent } from "../../beta-admin";
import { updateBetaRequest, upsertBetaRequest } from "../../supabase";

type BetaAccessPayload = {
  product?: unknown;
  name?: unknown;
  email?: unknown;
  androidDevice?: unknown;
  clanLeader?: unknown;
  testingFocus?: unknown;
  website?: unknown;
  turnstileToken?: unknown;
};

type RuntimeEnv = {
  TURNSTILE_SECRET_KEY?: string;
  AUTOBATTLE_CLAN_LEADER_SHA256?: string;
};
type TurnstileResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTOBATTLE_PUBLIC_PREFIX = "[AutoBattle public beta]";
const AUTOBATTLE_CLAN_PREFIX = "[AutoBattle clan access]";

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeSecurityAnswer(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyClanLeader(answer: string) {
  const expected = (
    env as unknown as RuntimeEnv
  ).AUTOBATTLE_CLAN_LEADER_SHA256?.trim().toLowerCase();
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) {
    return { configured: false, verified: false };
  }
  const supplied = await sha256Hex(normalizeSecurityAnswer(answer));
  return { configured: true, verified: constantTimeEqual(supplied, expected) };
}

function turnstileSecret() {
  return (env as unknown as RuntimeEnv).TURNSTILE_SECRET_KEY?.trim() || "";
}

function allowedTurnstileHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "idistudios.io" ||
    normalized.endsWith(".idistudios.io") ||
    normalized === "idistudios.sofakingbannon.chatgpt.site" ||
    normalized === "localhost"
  );
}

async function verifyTurnstile(token: string, remoteIp: string) {
  const secret = turnstileSecret();
  if (!secret) return { required: true, verified: false, unavailable: true };
  if (!token) return { required: true, verified: false, unavailable: false };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          response: token,
          remoteip: remoteIp || undefined,
          idempotency_key: crypto.randomUUID(),
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      return { required: true, verified: false, unavailable: true };
    }

    const result = (await response.json()) as TurnstileResult;
    return {
      required: true,
      verified: Boolean(
        result.success &&
          result.action === "beta_access" &&
          result.hostname &&
          allowedTurnstileHostname(result.hostname),
      ),
      unavailable: false,
    };
  } catch (error) {
    console.error("Turnstile verification unavailable", error);
    return { required: true, verified: false, unavailable: true };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as BetaAccessPayload;
    const website = clean(payload.website, 120);

    if (website) {
      return Response.json({ ok: true, emailSent: false }, { status: 202 });
    }

    const name = clean(payload.name, 80);
    const email = clean(payload.email, 160).toLowerCase();
    const androidDevice = clean(payload.androidDevice, 120);
    const product =
      payload.product === "autobattle-clan"
        ? "autobattle-clan"
        : payload.product === "autobattle"
          ? "autobattle"
          : "conquest";
    const clanLeader = clean(payload.clanLeader, 80);
    const submittedFocus = clean(
      payload.testingFocus,
      product === "autobattle-clan"
        ? 1000
        : product === "autobattle"
          ? 1160
          : 1200,
    );
    const testingFocus =
      product === "autobattle-clan"
        ? `${AUTOBATTLE_CLAN_PREFIX}\n${submittedFocus}`
        : product === "autobattle"
          ? `${AUTOBATTLE_PUBLIC_PREFIX}\n${submittedFocus}`
          : submittedFocus;
    const turnstileToken = clean(payload.turnstileToken, 2048);

    if (!name || !EMAIL_PATTERN.test(email) || !androidDevice || !submittedFocus) {
      return Response.json(
        { error: "Complete every field with a valid email address." },
        { status: 400 },
      );
    }
    if (product === "autobattle-clan" && !clanLeader) {
      return Response.json(
        { error: "Answer the clan security question before submitting." },
        { status: 400 },
      );
    }

    const verification = await verifyTurnstile(
      turnstileToken,
      request.headers.get("CF-Connecting-IP") || "",
    );
    if (verification.unavailable) {
      return Response.json(
        { error: "Security verification is temporarily unavailable. Please try again." },
        { status: 503 },
      );
    }
    if (!verification.verified) {
      return Response.json(
        { error: "Complete the security check and try again." },
        { status: 403 },
      );
    }

    if (product === "autobattle-clan") {
      const clanVerification = await verifyClanLeader(clanLeader);
      if (!clanVerification.configured) {
        return Response.json(
          { error: "Clan request validation is temporarily unavailable." },
          { status: 503 },
        );
      }
      if (!clanVerification.verified) {
        return Response.json(
          { error: "The clan security answer could not be verified." },
          { status: 403 },
        );
      }
    }

    let submission;
    try {
      submission = await upsertBetaRequest({
        name,
        email,
        androidDevice,
        testingFocus,
      });
      await logBetaEvent({
        requestId: submission.id,
        eventType: "request_submitted",
        actorEmail: email,
        newStatus: "pending",
        details: {
          androidDevice,
          product,
          ...(product === "autobattle-clan" ? { clanAnswerVerified: true } : {}),
        },
      });
    } catch (error) {
      console.error("Supabase beta request storage failed", error);
      return Response.json(
        { error: "Your request could not be saved. Please try again." },
        { status: 503 },
      );
    }

    const config = getBetaEmailConfig();
    if (!config.apiKey) {
      return Response.json({ ok: true, emailSent: false }, { status: 201 });
    }

    const idempotencyBase = `beta-${submission.id}-${Date.now()}`;
    let adminEmailStatus = "sent";
    let applicantEmailStatus = "sent";
    let adminResendId: string | null = null;
    let applicantResendId: string | null = null;
    const emailErrors: string[] = [];

    try {
      const result = await sendStudioNotification(
        submission,
        `${idempotencyBase}-studio`,
      );
      adminResendId = result.id || null;
    } catch (error) {
      adminEmailStatus = "failed";
      emailErrors.push(
        `Studio notification: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    try {
      const result = await sendApplicantConfirmation(
        submission,
        `${idempotencyBase}-applicant`,
      );
      applicantResendId = result.id || null;
    } catch (error) {
      applicantEmailStatus = "failed";
      emailErrors.push(
        `Applicant confirmation: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    await updateBetaRequest(submission.id, {
      adminEmailStatus,
      adminResendId,
      emailStatus: applicantEmailStatus,
      resendEmailId: applicantResendId,
      lastEmailError: emailErrors.join(" | ") || null,
    });

    return Response.json(
      {
        ok: true,
        emailSent:
          adminEmailStatus === "sent" && applicantEmailStatus === "sent",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Beta access request failed", error);
    return Response.json(
      { error: "We could not process your request. Please try again." },
      { status: 500 },
    );
  }
}
