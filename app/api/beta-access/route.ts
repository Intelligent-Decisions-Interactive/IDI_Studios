import { env } from "cloudflare:workers";
import {
  getBetaEmailConfig,
  sendApplicantConfirmation,
  sendStudioNotification,
} from "../../beta-email";
import { logBetaEvent } from "../../beta-admin";
import { updateBetaRequest, upsertBetaRequest } from "../../supabase";

type BetaAccessPayload = {
  name?: unknown;
  email?: unknown;
  androidDevice?: unknown;
  testingFocus?: unknown;
  website?: unknown;
  turnstileToken?: unknown;
};

type RuntimeEnv = { TURNSTILE_SECRET_KEY?: string };
type TurnstileResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TURNSTILE_SITE_KEY = "0x4AAAAAAEFhAAW5N5kUh-aO";

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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
  if (!secret) return { required: false, verified: true, unavailable: false };
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

export async function GET() {
  const required = Boolean(turnstileSecret());
  return Response.json({
    turnstileRequired: required,
    turnstileSiteKey: required ? TURNSTILE_SITE_KEY : null,
  });
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
    const testingFocus = clean(payload.testingFocus, 1200);
    const turnstileToken = clean(payload.turnstileToken, 2048);

    if (!name || !EMAIL_PATTERN.test(email) || !androidDevice || !testingFocus) {
      return Response.json(
        { error: "Complete every field with a valid email address." },
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
        details: { androidDevice },
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
