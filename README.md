# The Thirsty Pig

A food, drink, and dining adventure blog exploring restaurants, street food, cocktails, and culinary culture across Los Angeles, the SGV, Shanghai, and beyond.

**Live site:** [thirstypig.com](https://thirstypig.com)

## Overview

This site is a complete archive of The Thirsty Pig blog (2007-present), rebuilt from multiple sources:

- **923 blog posts** recovered from the Wayback Machine across three domains
- **1,649 Instagram posts** imported from a data export
- **7,500+ images** and **213 videos**
- **2,700+ pages** including category, search, map, and best-of pages

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| [Astro](https://astro.build) | Static site generator |
| [Tailwind CSS v4](https://tailwindcss.com) | Styling |
| [Tina CMS](https://tina.io) | Git-backed visual content editing |
| [Vercel](https://vercel.com) | Hosting & deployment |
| Python | Wayback Machine scraper & Instagram importer |

## Data Sources

### Wayback Machine (2007-2017)

The original blog ran across three domains, all now offline:

| Domain | Platform | Posts Recovered |
|--------|----------|----------------|
| `thirstypig.com` | WordPress | 408 |
| `thethirstypig.com` | WordPress | 505 |
| `blog.thethirstypig.com` | Blogspot/Blogger | 10 |

After deduplication (228 exact + 10 fuzzy matches removed): **923 unique posts**.

Images were recovered where available:
- Blogspot CDN images: ~98% recovered (Google still serves them)
- thethirstypig.com WordPress uploads: ~45% recovered from Wayback
- thirstypig.com WordPress images: ~1% (wp.com Photon CDN was not archived)

### Instagram (2011-present)

Imported from Instagram's JSON data export:
- **1,649 posts** with 4,664 images and 213 videos
- Captions, hashtags, timestamps, and GPS coordinates preserved
- Posts with epoch-0 timestamps recovered via media-level timestamps and folder dates

## Project Structure

```
thirstypig/
├── src/
│   ├── content/posts/        # 2,100+ Markdown blog posts
│   ├── components/           # Astro components (Header, Footer, PostCard, etc.)
│   ├── layouts/              # BaseLayout, BlogPost
│   ├── pages/                # Routes (index, posts, categories, search, map, best-of)
│   └── styles/global.css     # Tailwind CSS theme
├── public/
│   ├── images/posts/         # Blog & Instagram images (~1.6 GB)
│   └── videos/posts/         # Instagram videos (~428 MB)
├── scripts/
│   ├── scraper/              # Wayback Machine scraper (Python)
│   ├── instagram/            # Instagram JSON importer (Python)
│   └── categorizer.py        # Restaurant info extractor
├── tina/config.ts            # Tina CMS schema
├── vercel.json               # Vercel deployment config
└── astro.config.mjs          # Astro configuration
```

## Features

- **Search** — Client-side instant search across all posts (`/search`)
- **Map** — 782 restaurant locations on an interactive map (`/map`)
- **Best Of** — Curated lists by cuisine, type, and region (`/best-of`)
- **Related Posts** — Contextual recommendations at the bottom of each post
- **Closed Restaurant Badges** — 39 restaurants detected and marked as closed
- **Categories** — City, region, cuisine, and type categorization
- **SEO** — Sitemap, RSS, Open Graph, Twitter Cards, JSON-LD structured data
- **Tina CMS** — Visual editor at `/admin` for creating and editing posts

## Commands

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server with Tina CMS at `localhost:4321` |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview production build locally |

## Scripts

### Wayback Machine Scraper

Re-scrape content from the Internet Archive:

```bash
cd scripts/scraper
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Full pipeline
python main.py

# Individual steps
python main.py --step cdx      # Fetch URLs from CDX API
python main.py --step fetch    # Download archived HTML
python main.py --step parse    # Parse HTML to structured data
python main.py --step dedup    # Deduplicate across domains
python main.py --step images   # Download images
python main.py --step write    # Generate Markdown files

# Test with small batch
python main.py --test 10

# Re-run image recovery
python image_recovery.py
```

### Instagram Importer

Import posts from an Instagram data export:

```bash
cd scripts/instagram

# 1. Request your data from Instagram:
#    Settings > Your Activity > Download Your Information
#    Format: JSON, Date Range: All Time

# 2. Extract the ZIP to the data directory:
unzip ~/Downloads/instagram-*.zip -d data/
unzip ~/Downloads/instagram-*.zip "media/posts/*" -d data/

# 3. Run the importer:
cd /path/to/thirstypig
source scripts/scraper/venv/bin/activate
python scripts/instagram/import_instagram.py

# The importer will:
# - Parse all posts from the JSON export
# - Copy images and videos to public/
# - Deduplicate against existing blog posts
# - Generate Markdown files with frontmatter
```

### Restaurant Categorizer

Extract restaurant names, cities, regions, and detect closures:

```bash
source scripts/scraper/venv/bin/activate
python scripts/categorizer.py
```

### Image Optimization (WebP)

Convert images to WebP for faster loading (requires `cwebp`):

```bash
brew install webp  # macOS
find public/images/posts/ -type f \( -name "*.jpg" -o -name "*.png" \) | while read f; do
    cwebp -quiet -q 80 "$f" -o "${f%.*}.webp"
done
```

## Instagram-to-Blog Automation

There are three approaches for automatically syncing Instagram posts to this blog:

### Option 1: Manual Re-import (Recommended to start)

1. Periodically export your Instagram data (Settings > Your Activity > Download Your Information)
2. Run the importer script — it will only add new posts (deduplication built in)
3. Commit and push — Vercel auto-deploys

### Option 2: IFTTT / Zapier Webhook

1. Create an [IFTTT](https://ifttt.com) applet:
   - **IF**: Instagram > Any new photo by you
   - **THEN**: GitHub > Create a file in repository
   - Repository: `thirstypig/thirstypig-blog`
   - File path: `src/content/posts/{{CreatedAt}}-ig-auto.md`
   - Commit message: `Auto-post from Instagram`
2. Vercel detects the new commit and auto-rebuilds
3. Limitation: IFTTT free tier only supports single photos (not carousels)

### Option 3: GitHub Actions (Most robust)

Set up a scheduled GitHub Action that uses the Instagram Basic Display API:

1. Create a Meta App at [developers.facebook.com](https://developers.facebook.com)
2. Enable the Instagram Basic Display API
3. Generate a long-lived access token
4. Add the token as a GitHub secret: `INSTAGRAM_TOKEN`
5. Create `.github/workflows/instagram-sync.yml`:

```yaml
name: Sync Instagram Posts
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:        # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install requests pyyaml
      - run: python scripts/instagram/sync_from_api.py
        env:
          INSTAGRAM_TOKEN: ${{ secrets.INSTAGRAM_TOKEN }}
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'Auto-sync Instagram posts'
```

6. The `sync_from_api.py` script (to be built) would fetch recent posts via the API and generate Markdown files

## Tina CMS Setup

1. Create a project at [app.tina.io](https://app.tina.io) and connect this GitHub repo
2. Copy your **Client ID** (Overview tab) and create a **Token** (Tokens tab)
3. Add environment variables to Vercel:
   - `TINA_CLIENT_ID` — your Client ID
   - `TINA_TOKEN` — your API token
4. Redeploy on Vercel
5. Access the CMS at `https://thirstypig.com/admin/`

## Domains

| Domain | Purpose |
|--------|---------|
| `thirstypig.com` | Primary domain (production) |
| `www.thirstypig.com` | 308 redirect to thirstypig.com |
| `thethirstypig.com` | 308 redirect to thirstypig.com |
| `www.thethirstypig.com` | 308 redirect to thirstypig.com |

DNS is managed at Squarespace (registrar). A records point to Vercel (`76.76.21.21` or newer IP). CNAME for `www` points to `cname.vercel-dns.com`.

## License

All content copyright The Thirsty Pig. All rights reserved.
