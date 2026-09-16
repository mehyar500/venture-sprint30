// functions/api/sprint30/unsubscribe.js
// GET /api/sprint30/unsubscribe?token=... — one-click unsubscribe.
// Token-gated: flips the enrollment status to 'unsubscribed'. The daily
// scheduler only mails status='active' enrollments, so this stops the
// mission emails while keeping dashboard access intact.
// Also honors RFC 8058 one-click: POST with List-Unsubscribe=One-Click.

function page(title, body) {
  return new Response(
    "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + title + " — Sprint30</title>" +
    "<style>body{background:#0c0e12;color:#f2f4f7;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Inter,Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;text-align:center}" +
    ".card{max-width:420px;background:#14181f;border:1px solid #262d38;border-radius:14px;padding:32px}" +
    "h1{font-size:22px;margin:0 0 10px}p{color:#9aa4b2;font-size:15px;line-height:1.6}" +
    "a{color:#a3e635}</style></head><body><div class=\"card\">" +
    "<h1>" + title + "</h1><p>" + body + "</p>" +
    "<p><a href=\"/\">Back to Sprint30</a></p>" +
    "</div></body></html>",
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

function notFound() {
  return new Response(JSON.stringify({ ok: false, error: "Not found." }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}

async function doUnsubscribe(env, token) {
  if (!/^[0-9a-f]{32,128}$/i.test(token)) return null;
  const db = env.LEADS_DB;
  if (!db) return null;
  const row = await db
    .prepare("SELECT id FROM sprint30_enrollments WHERE access_token = ?")
    .bind(token)
    .first();
  if (!row) return null;
  await db
    .prepare("UPDATE sprint30_enrollments SET status = 'unsubscribed' WHERE id = ?")
    .bind(row.id)
    .run();
  return row.id;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = (url.searchParams.get("token") || "").trim();
  const id = await doUnsubscribe(env, token).catch(() => null);
  if (!id) return notFound();
  return page(
    "You're unsubscribed",
    "You won't receive Sprint30 mission emails anymore. Your dashboard and progress are still available with your private link."
  );
}

export async function onRequestPost({ request, env }) {
  // RFC 8058 one-click: the mail client POSTs with List-Unsubscribe=One-Click.
  let token = "";
  const ctype = request.headers.get("content-type") || "";
  try {
    if (ctype.includes("application/json")) {
      const body = await request.json();
      token = String((body && body.token) || "").trim();
    } else {
      const form = await request.formData();
      token = String(form.get("token") || "").trim();
    }
  } catch {
    return notFound();
  }
  if (!token) {
    const url = new URL(request.url);
    token = (url.searchParams.get("token") || "").trim();
  }
  const id = await doUnsubscribe(env, token).catch(() => null);
  if (!id) return notFound();
  return new Response(JSON.stringify({ ok: true, unsubscribed: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
