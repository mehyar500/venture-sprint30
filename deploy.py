#!/usr/bin/env python3
"""
Sprint30 deploy script — deploys the PWA to Cloudflare Pages WITHOUT GitHub Actions.

Usage:  python3 deploy.py            (from ~/workspace/sprint30)

What it does:
  1. Stages a clean copy in /tmp/s30-deploy: ./pwa/public/* at the stage ROOT
     (Pages serves the deploy dir as the site root), ./pwa/functions at the
     stage root, plus wrangler.toml (bindings only, no [vars]).
  2. Mints a short-lived (3h), scoped Cloudflare API token (Pages Write +
     Memberships Read + User Details Read). The raw token value is NEVER
     printed, logged, or written to disk — passed to wrangler only via env —
     and REVOKED right after the deploy (account token cap is 50).
  3. Runs `wrangler pages deploy . --project-name=sprint30 --branch=main`
     with CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID set.

Safety note: `wrangler pages deploy` syncs wrangler.toml bindings. This project
has NO [vars] section and NO dashboard plain_text vars, so deploys are safe.
Bindings (AI, LEADS_DB -> mehyar_leads_prod, DELIVERABLES R2) are declared in
wrangler.toml. Never use this pattern on a project whose secrets live only in
the dashboard (e.g. mehyar-web).

Requires: node + npm, and `wrangler` (installed automatically if missing).
"""
import json, os, shutil, subprocess, sys

PROJECT_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pwa")
STAGE_DIR = "/tmp/s30-deploy"
PROJECT_NAME = "sprint30"
ACCOUNT_ID = "621600637337cc1c9ecb7095508bc732"

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
import dynamic_credentials as dc
import urllib.request, urllib.error

EMAIL = json.load(open("/home/hatch/workspace/skills/cloudflare/config.json")).get("email")


def cf(path, method="GET", body=None):
    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4" + path, method=method,
        headers={"X-Auth-Email": EMAIL, "Accept": "application/json",
                 "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"})
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    dc.add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
    try:
        with urllib.request.urlopen(req, data=data, timeout=60) as resp:
            return resp.status, dc.read_json_response(resp)
    except urllib.error.HTTPError as e:
        return e.code, {"http_error": e.code,
                        "body": e.read(2000).decode("utf-8", "replace")}


def mint_deploy_token():
    import datetime
    expires = (datetime.datetime.now(datetime.timezone.utc)
               + datetime.timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
    s, d = cf("/user/tokens", "POST", {
        "name": "venture-sprint30-pages-deploy",
        "policies": [
            {"effect": "allow",
             "resources": {"com.cloudflare.api.account." + ACCOUNT_ID: "*"},
             "permission_groups": [
                 {"id": "8d28297797f24fb8a0c332fe0866ec89"},  # Pages Write
                 {"id": "3518d0f75557482e952c6762d3e64903"},  # Memberships Read
             ]},
            {"effect": "allow",
             "resources": {"com.cloudflare.api.user.1e1235d798707498a0b23a4cf83ecd0b": "*"},
             "permission_groups": [
                 {"id": "8acbe5bb0d54464ab867149d7f7cf8ac"},  # User Details Read
             ]},
        ],
        "not_before": "2026-09-15T00:00:00Z",
        "expires_on": expires,
    })
    res = d.get("result") or {}
    tok = res.get("value")
    tok_id = res.get("id")
    if s != 200 or not tok:
        print("TOKEN MINT FAILED", s, json.dumps(d)[:300])
        sys.exit(1)
    print("deploy token minted (value redacted, expires %s)" % expires)
    return tok, tok_id


def delete_deploy_token(tok_id):
    # Self-clean: don't leak one API token per deploy (account cap is 50).
    if not tok_id:
        return
    s, _ = cf("/user/tokens/" + tok_id, "DELETE")
    print("deploy token revoked:", s)


def ensure_wrangler():
    if shutil.which("wrangler"):
        return
    print("installing wrangler@3 ...")
    r = subprocess.run(["npm", "install", "-g", "wrangler@3"],
                       capture_output=True, text=True, timeout=600)
    if r.returncode != 0 or not shutil.which("wrangler"):
        print("wrangler install failed")
        sys.exit(1)


def main():
    if not os.path.isdir(PROJECT_ROOT):
        print("pwa dir missing:", PROJECT_ROOT)
        sys.exit(1)
    # 1. stage: public/* lands at the STAGE ROOT (Pages serves the deploy dir
    #    as the site root — deploying the pwa dir itself would put every page
    #    under /public/). functions/ goes to STAGE root for Functions routes.
    if os.path.isdir(STAGE_DIR):
        shutil.rmtree(STAGE_DIR)
    os.makedirs(STAGE_DIR)
    public_dir = os.path.join(PROJECT_ROOT, "public")
    for entry in os.listdir(public_dir):
        s = os.path.join(public_dir, entry)
        d = os.path.join(STAGE_DIR, entry)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)
    shutil.copytree(os.path.join(PROJECT_ROOT, "functions"),
                    os.path.join(STAGE_DIR, "functions"))
    # wrangler.toml carries bindings only (no [vars]) — safe to sync.
    shutil.copy2(os.path.join(PROJECT_ROOT, "wrangler.toml"),
                 os.path.join(STAGE_DIR, "wrangler.toml"))
    print("staged ->", STAGE_DIR)

    # 2. token
    token, token_id = mint_deploy_token()

    # 3. deploy
    ensure_wrangler()
    env = dict(os.environ)
    env["CLOUDFLARE_API_TOKEN"] = token
    env["CLOUDFLARE_ACCOUNT_ID"] = ACCOUNT_ID
    env["WRANGLER_SEND_METRICS"] = "false"
    del token
    p = subprocess.run(
        ["wrangler", "pages", "deploy", ".",
         "--project-name=" + PROJECT_NAME, "--branch=main"],
        cwd=STAGE_DIR, env=env, capture_output=True, text=True, timeout=600)
    print(p.stdout[-2500:])
    if p.stderr:
        print(p.stderr[-1000:])
    delete_deploy_token(token_id)
    sys.exit(p.returncode)


if __name__ == "__main__":
    main()
