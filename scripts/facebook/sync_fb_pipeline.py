"""Pull recent posts from a Facebook Page via Graph API and turn them into
Astro markdown posts under src/content/posts/.

Auto-publishes (draft: false) — per the user's stated preference. Idempotent:
posts already on disk (matched by FB post ID in the filename) are skipped, so
the workflow can run hourly without dupes.

Image strategy: download every image into public/images/posts/ at sync time.
FB's CDN URLs are signed and expire, so we can't link to them directly.

Run locally:
    export FB_PAGE_ID="..."
    export FB_PAGE_TOKEN="..."
    python3 scripts/facebook/sync_fb_pipeline.py

Run from CI: see .github/workflows/facebook-sync.yml.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import yaml  # type: ignore[import-untyped]

GRAPH_VERSION = "v22.0"
GRAPH = f"https://graph.facebook.com/{GRAPH_VERSION}"

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
POSTS_DIR = REPO_ROOT / "src" / "content" / "posts"
IMAGES_DIR = REPO_ROOT / "public" / "images" / "posts"

# Fields we ask Graph API to return per post.
POST_FIELDS = ",".join([
    "id",
    "message",
    "created_time",
    "permalink_url",
    "full_picture",
    "attachments{type,subattachments{type,media},media}",
])

# How many posts to fetch per run. The API returns most-recent first; with
# hourly polling, 25 is plenty of headroom for catching multi-post bursts.
LIMIT = 25


def fail(msg: str) -> None:
    print(f"[error] {msg}", file=sys.stderr)
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
    return {}  # unreachable


def http_download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as resp:
        dest.write_bytes(resp.read())


@dataclass(frozen=True)
class FBImage:
    url: str


@dataclass(frozen=True)
class FBPost:
    id: str
    message: str
    created_time: datetime
    permalink_url: str
    images: tuple[FBImage, ...]

    @property
    def short_id(self) -> str:
        # FB ids look like "pageid_postid"; the postid suffix is stable + unique
        # within the page, which is what we want for filenames.
        return self.id.split("_", 1)[-1] if "_" in self.id else self.id

    @property
    def date_prefix(self) -> str:
        return self.created_time.strftime("%Y-%m-%d")

    @property
    def post_filename(self) -> str:
        return f"{self.date_prefix}-fb-{self.short_id}.md"


def parse_post(raw: dict) -> FBPost:
    created_raw = raw.get("created_time", "")
    # Graph API returns ISO 8601 with offset like "2026-04-27T10:00:00+0000".
    try:
        created = datetime.strptime(created_raw, "%Y-%m-%dT%H:%M:%S%z")
    except ValueError:
        created = datetime.now(timezone.utc)

    images: list[FBImage] = []
    attachments = (raw.get("attachments") or {}).get("data") or []
    for att in attachments:
        # Carousel: attachments.data[0].subattachments.data[].media.image.src
        sub = (att.get("subattachments") or {}).get("data") or []
        if sub:
            for s in sub:
                src = ((s.get("media") or {}).get("image") or {}).get("src")
                if src:
                    images.append(FBImage(url=src))
        else:
            src = ((att.get("media") or {}).get("image") or {}).get("src")
            if src:
                images.append(FBImage(url=src))

    # Fallback to full_picture if attachments didn't yield anything.
    if not images and raw.get("full_picture"):
        images.append(FBImage(url=raw["full_picture"]))

    return FBPost(
        id=raw["id"],
        message=(raw.get("message") or "").strip(),
        created_time=created,
        permalink_url=raw.get("permalink_url", ""),
        images=tuple(images),
    )


def fetch_posts(page_id: str, page_token: str) -> list[FBPost]:
    params = urllib.parse.urlencode({
        "fields": POST_FIELDS,
        "limit": LIMIT,
        "access_token": page_token,
    })
    resp = http_get_json(f"{GRAPH}/{page_id}/posts?{params}")
    return [parse_post(p) for p in resp.get("data", [])]


def derive_title(message: str, fallback_date: str) -> str:
    if not message:
        return f"Facebook post {fallback_date}"
    # First non-empty line, trimmed to a reasonable length, no trailing punct.
    first_line = next((ln.strip() for ln in message.splitlines() if ln.strip()), "")
    if not first_line:
        return f"Facebook post {fallback_date}"
    if len(first_line) > 100:
        first_line = first_line[:97].rsplit(" ", 1)[0] + "..."
    return first_line


def truncate_description(message: str, limit: int = 160) -> str:
    if not message:
        return ""
    flat = re.sub(r"\s+", " ", message).strip()
    if len(flat) <= limit:
        return flat
    return flat[: limit - 1].rsplit(" ", 1)[0] + "..."


def write_post(post: FBPost) -> bool:
    """Returns True if a new post was written, False if skipped (already exists)."""
    out_md = POSTS_DIR / post.post_filename
    if out_md.exists():
        return False

    # Download images.
    image_paths: list[str] = []
    for i, img in enumerate(post.images, start=1):
        ext = ".jpg"
        # FB serves jpegs from scontent-* hosts; we don't bother content-sniffing
        # because the build pipeline doesn't care about extension accuracy.
        local_name = f"{post.date_prefix}-fb-{post.short_id}-{i}{ext}"
        local_path = IMAGES_DIR / local_name
        if not local_path.exists():
            try:
                http_download(img.url, local_path)
            except Exception as e:  # noqa: BLE001
                print(f"[warn] image download failed for {img.url}: {e}", file=sys.stderr)
                continue
        image_paths.append(f"/images/posts/{local_name}")

    frontmatter: dict = {
        "title": derive_title(post.message, post.date_prefix),
        "pubDate": post.date_prefix,
        "description": truncate_description(post.message),
        "source": "facebook",
        "draft": False,
    }
    if post.permalink_url:
        frontmatter["originalUrl"] = post.permalink_url
    if image_paths:
        frontmatter["heroImage"] = image_paths[0]
        if len(image_paths) > 1:
            frontmatter["images"] = image_paths

    body = post.message or ""

    # Build the file. yaml.safe_dump quotes appropriately and escapes properly.
    fm_yaml = yaml.safe_dump(
        frontmatter, sort_keys=False, allow_unicode=True, default_flow_style=False
    ).rstrip()

    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_md.write_text(f"---\n{fm_yaml}\n---\n\n{body}\n", encoding="utf-8")
    print(f"[new]  {post.post_filename}  ({len(image_paths)} image(s))")
    return True


def main() -> None:
    page_id = os.environ.get("FB_PAGE_ID")
    page_token = os.environ.get("FB_PAGE_TOKEN")
    if not page_id:
        fail("FB_PAGE_ID env var not set")
    if not page_token:
        fail("FB_PAGE_TOKEN env var not set")

    print(f"Fetching last {LIMIT} posts from page {page_id}...")
    posts = fetch_posts(page_id, page_token)
    print(f"  got {len(posts)} posts from API")

    new_count = 0
    for post in posts:
        if write_post(post):
            new_count += 1

    print(f"\nDone. {new_count} new post(s) written; {len(posts) - new_count} already on disk.")


if __name__ == "__main__":
    main()
