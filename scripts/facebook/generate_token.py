"""One-time helper: exchange a short-lived FB user token for a never-expiring
Page Access Token, then optionally save it as a GitHub secret.

The flow this automates:
1. You have a short-lived (~1 hour) USER access token from Graph API Explorer.
2. Exchange it for a long-lived (~60 day) USER token via oauth/access_token.
3. Use the long-lived USER token to fetch the Page's access token, which
   does NOT expire when issued from a long-lived user token to a Page admin.
4. Save the Page Access Token as a GitHub secret so the sync workflow can
   read it.

Pre-reqs:
    export FB_APP_ID="..."
    export FB_APP_SECRET="..."

Steps to get the short-lived USER token (one-time):
    https://developers.facebook.com/tools/explorer/
    - Select your app from the top-right dropdown
    - In Permissions, add: pages_show_list, pages_read_engagement
    - Click "Generate Access Token" — authorize when prompted
    - Copy the token (treat as a secret — do NOT paste in chat)

Then run:
    cd ~/Projects/thirstypig
    python3 scripts/facebook/generate_token.py
"""

from __future__ import annotations

import getpass
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request

GRAPH_VERSION = "v22.0"
GRAPH = f"https://graph.facebook.com/{GRAPH_VERSION}"


def fail(msg: str) -> None:
    print(f"\n[error] {msg}", file=sys.stderr)
    sys.exit(1)


def http_get_json(url: str) -> dict:
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        fail(f"HTTP {e.code} from Graph API:\n{body}")
    except Exception as e:  # noqa: BLE001
        fail(f"request failed: {e}")
    return {}  # unreachable, satisfies type checker


def main() -> None:
    app_id = os.environ.get("FB_APP_ID")
    app_secret = os.environ.get("FB_APP_SECRET")
    if not app_id:
        fail('FB_APP_ID env var not set. Run: export FB_APP_ID="..."')
    if not app_secret:
        fail('FB_APP_SECRET env var not set. Run: export FB_APP_SECRET="..."')

    print(f"App ID: {app_id}")
    print()
    print("Visit https://developers.facebook.com/tools/explorer/")
    print("- Select your app from the dropdown")
    print("- Add permissions: pages_show_list, pages_read_engagement")
    print('- Click "Generate Access Token", authorize')
    print()
    short_token = getpass.getpass(
        "Paste the short-lived USER access token (input is hidden): "
    ).strip()
    if not short_token:
        fail("no token provided")

    print("\nExchanging for a long-lived USER token...")
    params = urllib.parse.urlencode({
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_token,
    })
    long_user = http_get_json(f"{GRAPH}/oauth/access_token?{params}")
    long_user_token = long_user.get("access_token")
    if not long_user_token:
        fail(f"no access_token in response: {long_user}")
    expires_in = long_user.get("expires_in", "unknown")
    print(f"  got long-lived USER token (expires_in={expires_in}s)")

    print("\nFetching Pages you admin...")
    pages_resp = http_get_json(
        f"{GRAPH}/me/accounts?access_token={long_user_token}"
    )
    pages = pages_resp.get("data", [])
    if not pages:
        fail(
            "no Pages returned. Possible causes:\n"
            "  - You're not actually a Page admin\n"
            "  - You didn't grant pages_show_list when generating the token\n"
            f"  - response: {pages_resp}"
        )

    if len(pages) == 1:
        page = pages[0]
    else:
        print("\nMultiple Pages found:")
        for i, p in enumerate(pages):
            print(f"  [{i}] {p.get('name')} (id={p.get('id')})")
        idx = int(input("Pick page number: ").strip())
        page = pages[idx]

    page_id = page["id"]
    page_name = page.get("name", "(unknown)")
    page_token = page["access_token"]
    print(f"\n  Page: {page_name} (id={page_id})")
    print("  Got never-expiring Page Access Token.")
    print()

    # Offer to set GH secrets directly so the token never has to be copy-pasted.
    set_secrets = input(
        "Set FB_PAGE_ID and FB_PAGE_TOKEN as GitHub Actions secrets via gh? [Y/n] "
    ).strip().lower()
    if set_secrets in ("", "y", "yes"):
        try:
            subprocess.run(
                ["gh", "secret", "set", "FB_PAGE_ID", "--body", page_id],
                check=True,
            )
            subprocess.run(
                ["gh", "secret", "set", "FB_PAGE_TOKEN", "--body", page_token],
                check=True,
            )
            print("\n  Secrets set. Verify with: gh secret list")
        except subprocess.CalledProcessError as e:
            fail(f"gh secret set failed: {e}")
        except FileNotFoundError:
            fail("gh CLI not found. Install: https://cli.github.com/")
    else:
        print("\nManual fallback — run these in your shell:")
        print(f'  gh secret set FB_PAGE_ID --body "{page_id}"')
        print("  gh secret set FB_PAGE_TOKEN")
        print("    (then paste the Page token when prompted)")
        print()
        print("Page token (treat as a secret, don't paste in chat):")
        print(f"  {page_token}")


if __name__ == "__main__":
    main()
