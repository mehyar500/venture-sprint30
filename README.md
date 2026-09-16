# Sprint30 PWA

$37 one-time · 30-day side-income challenge. Live at https://sprint30.mehyar.us.

## Layout

```
pwa/
  public/
    index.html          landing (teaser days 1–3 + locked 4–30, checkout form)
    success.html        post-Stripe confirmation, reads ?token=
    dashboard.html      token-gated 30-day dashboard + progress checklist
    manifest.json       robots.txt
    assets/
      missions.json     CANONICAL missions (single source of truth — copy of ~/workspace/sprint30/missions.json)
      sprint30-logo.png 1024×1024 brand tile
  functions/
    api/sprint30/
      checkout.js       POST {email} → centralized mehyar.us checkout → {url}
      status.js         GET ?token= → {day, email, progress} (404 on bogus token)
      progress.js       POST {token, day, done} → merged progress_json
  wrangler.toml         documents bindings (AI + LEADS_DB); project binds via dashboard
```

## Content rule

`public/assets/missions.json` is the single source of truth for all 30 missions.
Both the landing teaser and the dashboard read it via `fetch("assets/missions.json")`.
To update copy: edit `~/workspace/sprint30/missions.json`, copy it over this file, commit, push.

## Checkout flow

1. Buyer enters email on `/#pricing` → `POST /api/sprint30/checkout`
2. Function validates email, POSTs `https://mehyar.us/api/pay/checkout`
   (`product_id: "sprint30-challenge"`, browser User-Agent required server-side,
   `params` JSON ≤ 2048 bytes) → returns `{url}` (Stripe)
3. Stripe → `success.html?token={access_token}` → dashboard link
4. mehyar.us webhook `fulfillHooks.sprint30` creates the enrollment, sends Day 1,
   unifies the token onto `billing_payments.access_token`
5. Days 2–30 go out via the daily scheduler (idempotent on `sprint30_sends`)

## Deploy

Via Cloudflare Pages GitHub integration on this repo. Custom domain
`sprint30.mehyar.us`. Bindings on the project: `AI` (Workers AI) + `LEADS_DB`
(D1 `mehyar_leads_prod` / `e4f22065-e3e8-4772-87a8-51d4976be042`).
Never `wrangler pages deploy` from a directory with `[vars]`.
