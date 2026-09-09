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
  AUTOBATTLE_BETA_INVITE_URL?: string;
};

type RequestProduct = "conquest" | "autobattle" | "autobattle-clan";

const AUTOBATTLE_PUBLIC_PREFIX = "[AutoBattle public beta]";
const AUTOBATTLE_CLAN_PREFIX = "[AutoBattle clan access]";

function requestProduct(applicant: BetaApplicant): RequestProduct {
  if (applicant.testingFocus.startsWith(AUTOBATTLE_CLAN_PREFIX)) {
    return "autobattle-clan";
  }
  if (applicant.testingFocus.startsWith(AUTOBATTLE_PUBLIC_PREFIX)) {
    return "autobattle";
  }
  return "conquest";
}

function visibleTestingFocus(applicant: BetaApplicant) {
  const product = requestProduct(applicant);
  if (product === "conquest") return applicant.testingFocus;

  const prefix =
    product === "autobattle-clan"
      ? AUTOBATTLE_CLAN_PREFIX
      : AUTOBATTLE_PUBLIC_PREFIX;
  const remainder = applicant.testingFocus.slice(prefix.length).trim();
  if (
    product === "autobattle-clan" &&
    remainder.startsWith("Clan leader answer:")
  ) {
    return remainder.split("\n").slice(1).join("\n").trim();
  }
  return remainder;
}

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
    autobattleInviteUrl:
      runtime.AUTOBATTLE_BETA_INVITE_URL?.trim() ||
      "https://idistudios.io/AutoBattle/account",
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
  const product = requestProduct(applicant);
  const safeFocus = escapeHtml(visibleTestingFocus(applicant)).replace(/\n/g, "<br />");
  const subject = product === "autobattle-clan"
    ? `AutoBattle clan request: ${applicant.name}`
    : product === "autobattle"
      ? `AutoBattle public beta request: ${applicant.name}`
      : `Beta request: ${applicant.name}`;
  const heading = product === "autobattle-clan"
    ? "New AutoBattle clan access request"
    : product === "autobattle"
      ? "New AutoBattle public beta request"
      : "New Conquest: Ascension beta request";
  const focusLabel = product === "conquest" ? "Testing focus" : "First workflow";
  const clanVerificationHtml = product === "autobattle-clan"
    ? "<p><strong>Clan security answer:</strong> Verified</p>"
    : "";
  const clanVerificationText = product === "autobattle-clan"
    ? "\nClan security answer: Verified"
    : "";

  return sendResendEmail(config.apiKey, idempotencyKey, {
    from: config.from,
    to: [config.notify],
    reply_to: applicant.email,
    subject,
    html: `<h1>${heading}</h1><p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Android device:</strong> ${safeDevice}</p>${clanVerificationHtml}<p><strong>${focusLabel}:</strong><br />${safeFocus}</p>`,
    text: `${heading}\n\nName: ${applicant.name}\nEmail: ${applicant.email}\nAndroid device: ${applicant.androidDevice}${clanVerificationText}\n${focusLabel}: ${visibleTestingFocus(applicant)}`,
    tags: [
      {
        name: "request_type",
        value:
          product === "autobattle-clan"
            ? "autobattle_clan"
            : product === "autobattle"
              ? "autobattle_beta"
              : "beta_access",
      },
    ],
  });
}

export async function sendApplicantConfirmation(
  applicant: BetaApplicant,
  idempotencyKey: string,
) {
  const config = getBetaEmailConfig();
  if (!config.apiKey) throw new Error("RESEND_API_KEY is not configured.");
  const safeName = escapeHtml(applicant.name);
  const product = requestProduct(applicant);

  if (product === "autobattle-clan") {
    return sendResendEmail(config.apiKey, idempotencyKey, {
      from: config.from,
      to: [applicant.email],
      reply_to: config.notify,
      subject: "We received your AutoBattle clan access request",
      html: `<h1>Your request is in.</h1><p>Hi ${safeName},</p><p>Your <strong>AutoBattle</strong> clan access request has been received. Founding players are being invited in controlled Android waves, and we will contact you when your wave is ready.</p><p>— IDI Studios</p>`,
      text: `Hi ${applicant.name},\n\nYour AutoBattle clan access request has been received. Founding players are being invited in controlled Android waves, and we will contact you when your wave is ready.\n\n— IDI Studios`,
      tags: [{ name: "request_type", value: "autobattle_confirmation" }],
    });
  }

  if (product === "autobattle") {
    return sendResendEmail(config.apiKey, idempotencyKey, {
      from: config.from,
      to: [applicant.email],
      reply_to: config.notify,
      subject: "We received your AutoBattle public beta request",
      html: `<h1>Your request is in.</h1><p>Hi ${safeName},</p><p>Your <strong>AutoBattle</strong> public beta request has been received. Android access is opening in controlled waves, and we will contact you when your wave is ready.</p><p>— IDI Studios</p>`,
      text: `Hi ${applicant.name},\n\nYour AutoBattle public beta request has been received. Android access is opening in controlled waves, and we will contact you when your wave is ready.\n\n— IDI Studios`,
      tags: [{ name: "request_type", value: "autobattle_public_beta" }],
    });
  }

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
  const product = requestProduct(applicant);
  const inviteUrl = product === "conquest"
    ? config.inviteUrl
    : config.autobattleInviteUrl;
  if (!inviteUrl) throw new Error("The beta invitation URL is not configured.");
  const safeName = escapeHtml(applicant.name);
  const safeUrl = escapeHtml(inviteUrl);

  if (product !== "conquest") {
    const clan = product === "autobattle-clan";
    return sendResendEmail(config.apiKey, idempotencyKey, {
      from: config.from,
      to: [applicant.email],
      reply_to: config.notify,
      subject: clan
        ? "Your AutoBattle founding clan access is ready"
        : "Your AutoBattle public beta access is ready",
      html: `<h1>Your AutoBattle access is ready.</h1><p>Hi ${safeName},</p><p>Your Android beta request has been approved.</p><p><a href="${safeUrl}">Open your AutoBattle account</a></p><p>Sign in with this email address, save your player name, and follow the account instructions to link your Android device.${clan ? " Your single-use clan code will add 30 starting tokens and unlock a permanent 50% discount on every token pack." : ""}</p><p>— IDI Studios</p>`,
      text: `Hi ${applicant.name},\n\nYour AutoBattle Android beta request has been approved.\n\nOpen your AutoBattle account: ${inviteUrl}\n\nSign in with this email address, save your player name, and follow the account instructions to link your Android device.${clan ? " Your single-use clan code will add 30 starting tokens and unlock a permanent 50% discount on every token pack." : ""}\n\n— IDI Studios`,
      tags: [{
        name: "request_type",
        value: clan ? "autobattle_clan_invitation" : "autobattle_beta_invitation",
      }],
    });
  }

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

export async function sendAutoBattleRedemptionCodeEmail(
  recipient: { email: string; playerName: string; code: string },
  idempotencyKey: string,
) {
  const config = getBetaEmailConfig();
  if (!config.apiKey) throw new Error("RESEND_API_KEY is not configured.");

  const accountUrl = config.autobattleInviteUrl;
  const safeName = escapeHtml(recipient.playerName || "AutoBattle player");
  const safeCode = escapeHtml(recipient.code);
  const safeUrl = escapeHtml(accountUrl);

  return sendResendEmail(config.apiKey, idempotencyKey, {
    from: config.from,
    to: [recipient.email],
    reply_to: config.notify,
    subject: "Your AutoBattle founding code",
    html: `<h1>Your AutoBattle founding code is ready.</h1><p>Hi ${safeName},</p><p>Enter this single-use code in your AutoBattle account:</p><p style="font-size:24px;font-weight:700;letter-spacing:0.08em"><code>${safeCode}</code></p><p><a href="${safeUrl}">Open your AutoBattle account</a></p><p>Redeeming it adds 30 starting tokens and unlocks the permanent 50% founding-clan price on every token pack.</p><p>If you did not expect this email, you can ignore it.</p><p>— IDI Studios</p>`,
    text: `Hi ${recipient.playerName || "AutoBattle player"},\n\nEnter this single-use code in your AutoBattle account:\n\n${recipient.code}\n\nOpen your account: ${accountUrl}\n\nRedeeming it adds 30 starting tokens and unlocks the permanent 50% founding-clan price on every token pack.\n\nIf you did not expect this email, you can ignore it.\n\n— IDI Studios`,
    tags: [{ name: "request_type", value: "autobattle_redemption_code" }],
  });
}
