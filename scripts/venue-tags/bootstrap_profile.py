"""One-time bootstrap: open the scraper's persistent Chrome profile so you
can sign into Google manually.

Why this script doesn't use Playwright: Google's sign-in flow detects
Playwright's automation flags (--enable-automation, navigator.webdriver)
and refuses login with "Couldn't sign you in: this browser or app may
not be secure". So we bootstrap with **real Chrome, no Playwright**,
pointed at the same user-data-dir Playwright will read later. Chrome's
profile format is the same either way; cookies set in real Chrome are
seen by Playwright on the next run.

Usage:
    scripts/venue-tags/venv/bin/python scripts/venue-tags/bootstrap_profile.py

What this script does:
1. Closes nothing — make sure no other Chrome instance is using the
   profile dir before running (your daily Chrome with its own profile
   is fine; only conflicts if you already have an instance pointed at
   .chrome-profile).
2. Launches real /Applications/Google Chrome.app with --user-data-dir
   pointed at .chrome-profile/.
3. Returns immediately — Chrome runs detached. Sign in there, browse a
   couple Maps pages to warm cookies, close the window when done.
"""

from __future__ import annotations

import shlex
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
USER_DATA_DIR = HERE / ".chrome-profile"
CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def main() -> int:
    if not Path(CHROME_BIN).exists():
        print(f"ERROR: real Chrome not found at {CHROME_BIN}", file=sys.stderr)
        print("Install Google Chrome from https://www.google.com/chrome/", file=sys.stderr)
        return 1

    USER_DATA_DIR.mkdir(exist_ok=True)
    # Clear stale Chrome singleton locks left by previous Playwright runs.
    # Without this, real Chrome aborts with "Failed to create a ProcessSingleton".
    for name in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
        (USER_DATA_DIR / name).unlink(missing_ok=True)
    cmd = [CHROME_BIN, f"--user-data-dir={USER_DATA_DIR}"]
    print("Launching real Chrome (no Playwright) at:")
    print(f"  {USER_DATA_DIR}")
    print()
    print("In the window that opens:")
    print("  1. Sign in to Google (use a non-primary account if you're cautious)")
    print("  2. Optionally visit google.com/maps + a place page to warm cookies")
    print("  3. Close the window when done")
    print()
    print("Then run scrape_google.py.")
    print()
    print(f"Command: {' '.join(shlex.quote(c) for c in cmd)}")
    # Detach: don't block this script on Chrome's lifetime.
    subprocess.Popen(cmd, start_new_session=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
