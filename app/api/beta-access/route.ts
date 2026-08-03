import { eq } from "drizzle-orm";
import {
  getBetaEmailConfig,
  sendApplicantConfirmation,
  sendStudioNotification,
} from "../../beta-email";
import { logBetaEvent } from "../../beta-admin";
import { getDb } from "../../../db";
import { betaAccessRequests } from "../../../db/schema";

type BetaAccessPayload = {
  name?: unknown;
  email?: unknown;
  androidDevice?: unknown;
  testingFocus?: unknown;
  website?: unknown;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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
          status: "pending",
          emailStatus: "pending",
          resendEmailId: null,
          adminEmailStatus: "pending",
          adminResendId: null,
          inviteEmailStatus: "not_sent",
          inviteResendId: null,
          invitedAt: null,
          reviewedAt: null,
          reviewedBy: null,
          lastEmailError: null,
          updatedAt: now,
        },
      })
      .returning();

    await logBetaEvent({
      requestId: submission.id,
      eventType: "request_submitted",
      actorEmail: email,
      newStatus: "pending",
      details: { androidDevice },
    });

    const config = getBetaEmailConfig();
    if (!config.apiKey) {
      return Response.json({ ok: true, emailSent: false }, { status: 201 });
    }

    const idempotencyBase = `beta-${submission.id}-${now.getTime()}`;
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

    await db
      .update(betaAccessRequests)
      .set({
        adminEmailStatus,
        adminResendId,
        emailStatus: applicantEmailStatus,
        resendEmailId: applicantResendId,
        lastEmailError: emailErrors.join(" | ") || null,
        updatedAt: new Date(),
      })
      .where(eq(betaAccessRequests.id, submission.id));

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
      { error: "We could not save your request. Please try again." },
      { status: 500 },
    );
  }
}
