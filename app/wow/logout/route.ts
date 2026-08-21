import { expiredSessionCookie } from "../../wow-auth";

export async function POST(request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/wow",
      "Set-Cookie": expiredSessionCookie(secure),
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
    },
  });
}
