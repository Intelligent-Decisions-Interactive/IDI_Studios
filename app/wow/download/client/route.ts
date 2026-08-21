import {
  readCookie,
  verifyWowSession,
  WOW_SESSION_COOKIE,
} from "../../../wow-auth";
import { createClientDownloadUrl } from "../../../wow-storage";

export async function GET(request: Request) {
  const session = readCookie(
    request.headers.get("Cookie") || "",
    WOW_SESSION_COOKIE,
  );
  if (!(await verifyWowSession(session))) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/wow",
        "Cache-Control": "no-store, private",
        "Referrer-Policy": "no-referrer",
      },
    });
  }

  try {
    const location = await createClientDownloadUrl();
    return new Response(null, {
      status: 302,
      headers: {
        Location: location,
        "Cache-Control": "no-store, private",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response("The client download is temporarily unavailable.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store, private",
        "Content-Type": "text/plain; charset=utf-8",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
}
