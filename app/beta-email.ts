import { env } from "cloudflare:workers";

type BetaApplicant = {
  id: number;
  name: string;
  email: string;
  androidDevice: string;
  testingFocus: string;
};

type ResendResult = {
  id?: string;
  message?: string;
};

type RuntimeEnv = {
  RESEND_API_KEY?: string;
  BETA_FROM_EMAIL?: string;
  BETA_NOTIFICATION_EMAIL?: string;
  BETA_INVITE_URL?: string;
};

export function getBetaEmailConfig() {
  const runtime = env as unknown as RuntimeEnv;
  return {
    apiKey: runtime.RESEND_API_KEY?.trim() || "",
    from:
      runtime.BETA_FROM_EMAIL?.trim() ||
      "IDI Studios <beta@idistudios.io>",
    notify:
      runtime.BETA_NOTIFICATION_EMAIL?.trim() ||
      "development@idistudios.io",
    inviteUrl: runtime.BETA_INVITE_URL?.trim() || "",
  };
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

export async function sendStudioNotification(
  applicant: BetaApplicant,
  idempotencyKey: string,
) {
  const config = getBetaEmailConfig();
  if (!config.apiKey) throw new Error("RESEND_API_KEY is not configured.");

  const safeName = escapeHtml(applicant.name);
  const safeEmail = escapeHtml(applicant.email);
  const safeDevice = escapeHtml(applicant.androidDevice);
  const safeFocus = escapeHtml(applicant.testingFocus).replace(/\n/g, "<br />");

  return sendResendEmail(config.apiKey, idempotencyKey, {
    from: config.from,
    to: [config.notify],
    reply_to: applicant.email,
    subject: `Beta request: ${applicant.name}`,
    html: `<h1>New Conquest: Ascension beta request</h1><p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Android device:</strong> ${safeDevice}</p><p><strong>Testing focus:</strong><br />${safeFocus}</p>`,
    text: `New Conquest: Ascension beta request\n\nName: ${applicant.name}\nEmail: ${applicant.email}\nAndroid device: ${applicant.androidDevice}\nTesting focus: ${applicant.testingFocus}`,
    tags: [{ name: "request_type", value: "beta_access" }],
  });
}

export async function sendApplicantConfirmation(
  applicant: BetaApplicant,
  idempotencyKey: string,
) {
  const config = getBetaEmailConfig();
  if (!config.apiKey) throw new Error("RESEND_API_KEY is not configured.");
  const safeName = escapeHtml(applicant.name);

  return sendResendEmail(config.apiKey, idempotencyKey, {
    from: config.from,
    to: [applicant.email],
    reply_to: config.notify,
    subject: "We received your Conquest: Ascension beta request",
    html: `<h1>Your request is in.</h1><p>Hi ${safeName},</p><p>Thanks for volunteering to test <strong>Conquest: Ascension</strong>. We are inviting players in limited Android waves and will contact you if your device fits an upcoming build.</p><p>— IDI Studios</p>`,
    text: `Hi ${applicant.name},\n\nThanks for volunteering to test Conquest: Ascension. We are inviting players in limited Android waves and will contact you if your device fits an upcoming build.\n\n— IDI Studios`,
    tags: [{ name: "request_type", value: "beta_confirmation" }],
  });
}

export async function sendBetaInvitation(
  applicant: BetaApplicant,
  idempotencyKey: string,
) {
  const config = getBetaEmailConfig();
  if (!config.apiKey) throw new Error("RESEND_API_KEY is not configured.");
  if (!config.inviteUrl) throw new Error("BETA_INVITE_URL is not configured.");

  const safeName = escapeHtml(applicant.name);
  const safeUrl = escapeHtml(config.inviteUrl);
  return sendResendEmail(config.apiKey, idempotencyKey, {
    from: config.from,
    to: [applicant.email],
    reply_to: config.notify,
    subject: "Your Conquest: Ascension beta invitation",
    html: `<h1>Your testing wave is ready.</h1><p>Hi ${safeName},</p><p>You have been selected for a limited <strong>Conquest: Ascension</strong> Android beta wave.</p><p><a href="${safeUrl}">Open your beta invitation</a></p><p>Please use the Google account associated with this email address.</p><p>— IDI Studios</p>`,
    text: `Hi ${applicant.name},\n\nYou have been selected for a limited Conquest: Ascension Android beta wave.\n\nOpen your invitation: ${config.inviteUrl}\n\nPlease use the Google account associated with this email address.\n\n— IDI Studios`,
    tags: [{ name: "request_type", value: "beta_invitation" }],
  });
}
