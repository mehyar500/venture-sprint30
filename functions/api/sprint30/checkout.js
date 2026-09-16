// functions/api/sprint30/checkout.js
// Sprint30 checkout proxy: validates the buyer email, then calls the
// centralized mehyar.us checkout and returns the Stripe URL.
// Server-side calls to mehyar.us REQUIRE a browser User-Agent (bot firewall).

const CHECKOUT_URL = "https://mehyar.us/api/pay/checkout";
const PRODUCT_ID = "sprint30-challenge";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost({ request }) {
  let body = null;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }
  const email = String((body && body.email) || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "Enter a valid email — that's where Day 1 goes." }, 400);
  }

  // params JSON must stay ≤2048 bytes (centralized checkout contract).
  const params = { source: "sprint30-landing", product: PRODUCT_ID };
  const paramsJson = JSON.stringify(params);
  if (paramsJson.length > 2048) {
    return json({ ok: false, error: "Checkout params too large." }, 500);
  }

  let res;
  try {
    res = await fetch(CHECKOUT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": BROWSER_UA },
      body: JSON.stringify({ product_id: PRODUCT_ID, email, params }),
    });
  } catch (e) {
    return json({ ok: false, error: "Couldn't reach checkout — check your connection and try again." }, 502);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* fall through to error handling */
  }
  const url = data && (data.checkout_url || data.url);
  if (!res.ok || !data || data.ok !== true || !url) {
    const msg = (data && (data.message || data.error)) || "Checkout failed (HTTP " + res.status + ").";
    return json({ ok: false, error: String(msg).slice(0, 200) }, 502);
  }
  return json({ ok: true, url });
}
