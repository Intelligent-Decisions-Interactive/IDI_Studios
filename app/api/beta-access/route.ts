import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { betaAccessRequests } from "../../../db/schema";

type BetaAccessPayload = {
  name?: unknown;
  email?: unknown;
  androidDevice?: unknown;
  testingFocus?: unknown;
  website?: unknown;
};

type ResendResult = {
  id?: string;
  message?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

async function sendResendEmail(
  apiKey: string,
  idempotencyKey: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as ResendResult;
  if (!response.ok) {
    throw new Error(result.message || `Resend returned ${response.status}`);
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as BetaAccessPayload;
    const website = clean(payload.website, 120);

    // A filled honeypot indicates an automated submission. Return a neutral
    // response so the endpoint does not teach bots how it filters requests.
    if (website) {
      return Response.json({ ok: true, emailSent: false }, { status: 202 });
    }

    const name = clean(payload.name, 80);
    const email = clean(payload.email, 160).toLowerCase();
    const androidDevice = clean(payload.androidDevice, 120);
    const testingFocus = clean(payload.testingFocus, 1200);

    if (!name || !EMAIL_PATTERN.test(email) || !androidDevice || !testingFocus) {
      return Response.json(
        { error: "Complete every field with a valid email address." },
        { status: 400 },
      );
    }

    const db = getDb();
    const now = new Date();
    const [submission] = await db
      .insert(betaAccessRequests)
      .values({ name, email, androidDevice, testingFocus, updatedAt: now })
      .onConflictDoUpdate({
        target: betaAccessRequests.email,
        set: {
          name,
          androidDevice,
          testingFocus,
          status: "requested",
          emailStatus: "pending",
          resendEmailId: null,
          updatedAt: now,
        },
      })
      .returning();

    const runtimeEnv = env as unknown as {
      RESEND_API_KEY?: string;
      BETA_FROM_EMAIL?: string;
      BETA_NOTIFICATION_EMAIL?: string;
    };
    const apiKey = runtimeEnv.RESEND_API_KEY;

    if (!apiKey) {
      return Response.json({ ok: true, emailSent: false }, { status: 201 });
    }

    const from = runtimeEnv.BETA_FROM_EMAIL || "IDI Studios <beta@idistudios.io>";
    const notify = runtimeEnv.BETA_NOTIFICATION_EMAIL || "development@idistudios.io";
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeDevice = escapeHtml(androidDevice);
    const safeFocus = escapeHtml(testingFocus).replace(/\n/g, "<br />");
    const idempotencyBase = `beta-${submission.id}-${now.getTime()}`;

    try {
      const notification = await sendResendEmail(apiKey, `${idempotencyBase}-studio`, {
        from,
        to: [notify],
        reply_to: email,
        subject: `Beta request: ${name}`,
        html: `<h1>New Conquest: Ascension beta request</h1><p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Android device:</strong> ${safeDevice}</p><p><strong>Testing focus:</strong><br />${safeFocus}</p>`,
        text: `New Conquest: Ascension beta request\n\nName: ${name}\nEmail: ${email}\nAndroid device: ${androidDevice}\nTesting focus: ${testingFocus}`,
        tags: [{ name: "request_type", value: "beta_access" }],
      });

      await sendResendEmail(apiKey, `${idempotencyBase}-applicant`, {
        from,
        to: [email],
        reply_to: notify,
        subject: "We received your Conquest: Ascension beta request",
        html: `<h1>Your request is in.</h1><p>Hi ${safeName},</p><p>Thanks for volunteering to test <strong>Conquest: Ascension</strong>. We are inviting players in limited Android waves and will contact you if your device fits an upcoming build.</p><p>— IDI Studios</p>`,
        text: `Hi ${name},\n\nThanks for volunteering to test Conquest: Ascension. We are inviting players in limited Android waves and will contact you if your device fits an upcoming build.\n\n— IDI Studios`,
        tags: [{ name: "request_type", value: "beta_confirmation" }],
      });

      await db
        .update(betaAccessRequests)
        .set({
          emailStatus: "sent",
          resendEmailId: notification.id || null,
          updatedAt: new Date(),
        })
        .where(eq(betaAccessRequests.id, submission.id));

      return Response.json({ ok: true, emailSent: true }, { status: 201 });
    } catch (emailError) {
      console.error("Beta request email failed", emailError);
      await db
        .update(betaAccessRequests)
        .set({ emailStatus: "failed", updatedAt: new Date() })
        .where(eq(betaAccessRequests.id, submission.id));
      return Response.json({ ok: true, emailSent: false }, { status: 201 });
    }
  } catch (error) {
    console.error("Beta access request failed", error);
    return Response.json(
      { error: "We could not save your request. Please try again." },
      { status: 500 },
    );
  }
}
