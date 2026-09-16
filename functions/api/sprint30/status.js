// functions/api/sprint30/status.js
// Token-gated dashboard status. GET /api/sprint30/status?token=
// Validates the token against sprint30_enrollments.access_token in LEADS_DB.
// 404 on bogus token. current_day = min(30, 1 + full days since started_at).

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function currentDay(startedAt) {
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return 1;
  const days = Math.floor((Date.now() - start) / 86400000);
  return Math.min(30, Math.max(1, 1 + days));
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") || "").trim();
  if (!/^[0-9a-f]{32,128}$/i.test(token)) {
    return json({ ok: false, error: "Not found." }, 404);
  }
  const db = env.LEADS_DB;
  if (!db) {
    return json({ ok: false, error: "Service unavailable." }, 500);
  }
  let row = null;
  try {
    row = await db
      .prepare(
        "SELECT id, email, access_token, status, started_at, current_day, progress_json FROM sprint30_enrollments WHERE access_token = ?"
      )
      .bind(token)
      .first();
  } catch (e) {
    return json({ ok: false, error: "Service unavailable." }, 500);
  }
  if (!row) {
    return json({ ok: false, error: "Not found." }, 404);
  }
  let progress = {};
  try {
    progress = JSON.parse(row.progress_json || "{}") || {};
  } catch {
    progress = {};
  }
  // progress_json shape: { "<day>": true } — tolerate a nested {days:{}} variant.
  if (progress.days && typeof progress.days === "object") progress = progress.days;

  return json({
    ok: true,
    day: currentDay(row.started_at),
    email: row.email,
    status: row.status,
    started_at: row.started_at,
    progress,
  });
}
