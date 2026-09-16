// functions/api/sprint30/progress.js
// POST /api/sprint30/progress {token, day, done}
// Token-gated, idempotent: merges one day's done-flag into
// sprint30_enrollments.progress_json without touching other keys.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  let body = null;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }
  const token = String((body && body.token) || "").trim();
  const day = Number(body && body.day);
  const done = !!(body && body.done);
  if (!/^[0-9a-f]{32,128}$/i.test(token)) {
    return json({ ok: false, error: "Not found." }, 404);
  }
  if (!Number.isInteger(day) || day < 1 || day > 30) {
    return json({ ok: false, error: "Day must be 1–30." }, 400);
  }
  const db = env.LEADS_DB;
  if (!db) {
    return json({ ok: false, error: "Service unavailable." }, 500);
  }

  let row = null;
  try {
    row = await db
      .prepare("SELECT id, progress_json FROM sprint30_enrollments WHERE access_token = ?")
      .bind(token)
      .first();
  } catch {
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
  if (progress.days && typeof progress.days === "object") progress = progress.days;

  // Merge: set or clear this day's flag; never drop other days.
  if (done) {
    progress[String(day)] = true;
  } else {
    delete progress[String(day)];
  }

  try {
    await db
      .prepare("UPDATE sprint30_enrollments SET progress_json = ? WHERE id = ?")
      .bind(JSON.stringify(progress), row.id)
      .run();
  } catch {
    return json({ ok: false, error: "Service unavailable." }, 500);
  }

  return json({ ok: true, progress });
}
