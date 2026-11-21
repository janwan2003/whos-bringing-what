#!/usr/bin/env python3
"""Google Search Console for the Who's Bringing What site only (the token also sees the operator's other sites: never touch them).

  python3 scripts/gsc.py token     -> gets the META verification tag and inserts it into public/index.html
  python3 scripts/gsc.py verify    -> verifies the site (META), then adds it to Search Console
  python3 scripts/gsc.py sitemap   -> submits sitemap.xml
  python3 scripts/gsc.py status    -> site permission, sitemaps, last 28 days of search analytics

Credentials: CWS_CLIENT_ID / CWS_CLIENT_SECRET / GSC_REFRESH_TOKEN from the studio .env (never printed).
META is used instead of FILE because Cloudflare Pages redirects *.html to the extensionless URL.
"""
import datetime, json, re, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = dict(l.split("=", 1) for l in (ROOT.parent.parent / ".env").read_text().splitlines() if "=" in l)
SITE = "https://pb-whos-bringing-what.pages.dev/"
SITEMAP = SITE + "sitemap.xml"
ENC = urllib.parse.quote(SITE, safe="")
SV = "https://www.googleapis.com/siteVerification/v1"
WM = "https://www.googleapis.com/webmasters/v3"


def access_token():
    data = urllib.parse.urlencode(dict(client_id=ENV["CWS_CLIENT_ID"], client_secret=ENV["CWS_CLIENT_SECRET"],
                                       refresh_token=ENV["GSC_REFRESH_TOKEN"], grant_type="refresh_token")).encode()
    for attempt in range(4):
        try:
            return json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", data))["access_token"]
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))


def call(method, url, body=None):
    headers = {"Authorization": f"Bearer {access_token()}"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw[:500].decode(errors="replace")


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    site = {"type": "SITE", "identifier": SITE}
    if cmd == "token":
        code, res = call("POST", f"{SV}/token", {"site": site, "verificationMethod": "META"})
        print("token:", code)
        if code == 200:
            tag = res["token"]
            idx = ROOT / "public" / "index.html"
            html = idx.read_text()
            html = re.sub(r'<meta name="google-site-verification"[^>]*>\n?', "", html)
            html = html.replace('<meta name="theme-color"', tag + '\n<meta name="theme-color"', 1)
            idx.write_text(html)
            print("inserted verification meta into public/index.html")
    elif cmd == "verify":
        print("verify:", *call("POST", f"{SV}/webResource?verificationMethod=META", {"site": site}))
        print("add to Search Console:", *call("PUT", f"{WM}/sites/{ENC}"))
    elif cmd == "sitemap":
        print("submit:", *call("PUT", f"{WM}/sites/{ENC}/sitemaps/{urllib.parse.quote(SITEMAP, safe='')}"))
    elif cmd == "status":
        print("site:", *call("GET", f"{WM}/sites/{ENC}"))
        print("sitemaps:", json.dumps(call("GET", f"{WM}/sites/{ENC}/sitemaps")[1], indent=1))
        end = datetime.date.today()
        start = end - datetime.timedelta(days=28)
        q = {"startDate": str(start), "endDate": str(end), "dimensions": ["query"], "rowLimit": 50}
        code, res = call("POST", f"{WM}/sites/{ENC}/searchAnalytics/query", q)
        rows = (res or {}).get("rows", []) if code == 200 else res
        print(f"search analytics {start}..{end}:", json.dumps(rows, indent=1) if rows else "no rows")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
