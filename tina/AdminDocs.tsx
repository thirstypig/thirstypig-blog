import React, { useState } from "react";

// Sidebar icon — open-book glyph
export const AdminDocsIcon = () => (
	<span style={{ fontSize: 16, lineHeight: 1 }}>&#x1F4D6;</span>
);

// ---------------------------------------------------------------------------
// Operator-facing docs for thirstypig.com.
//
// Lives inside the TinaCMS admin UI as a fullscreen screen plugin. Single
// source of truth for "how do the moving parts work" — IG sync flow,
// venue-tags scraping pipeline, current pipeline status, recent shipped
// work, and what's queued.
//
// Renders inside its own iframe so we can't rely on Tailwind. Inline styles
// mirror the cream/ink/amber tokens from src/styles/global.css.
// ---------------------------------------------------------------------------

type SectionId =
	| "ig"
	| "scraping"
	| "status"
	| "todo"
	| "changelog"
	| "roadmap";

interface Section {
	id: SectionId;
	label: string;
	emoji: string;
}

const SECTIONS: Section[] = [
	{ id: "ig", label: "Instagram sync", emoji: "📸" },
	{ id: "scraping", label: "Venue-tags scraping", emoji: "🏷️" },
	{ id: "status", label: "Pipeline status", emoji: "📊" },
	{ id: "todo", label: "Todo", emoji: "✅" },
	{ id: "changelog", label: "Completed", emoji: "📝" },
	{ id: "roadmap", label: "Roadmap", emoji: "🗺️" },
];

const s = {
	root: {
		display: "flex",
		minHeight: "100vh",
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
		color: "#1f2937",
		background: "#F5EFE3",
	} as React.CSSProperties,

	sidebar: {
		width: 240,
		flexShrink: 0,
		background: "#E9DFC9",
		borderRight: "1px solid #d6c9a8",
		padding: "24px 0",
	} as React.CSSProperties,

	sidebarTitle: {
		fontSize: 12,
		fontWeight: 700,
		textTransform: "uppercase" as const,
		letterSpacing: 0.5,
		color: "#655F5B",
		padding: "0 24px 12px",
	} as React.CSSProperties,

	navItem: (active: boolean) =>
		({
			display: "block",
			width: "100%",
			textAlign: "left" as const,
			padding: "10px 24px",
			background: active ? "#F5EFE3" : "transparent",
			border: "none",
			borderLeft: active ? "3px solid #B45309" : "3px solid transparent",
			color: active ? "#1A1A1A" : "#374151",
			fontSize: 14,
			fontWeight: active ? 600 : 400,
			cursor: "pointer",
			fontFamily: "inherit",
		}) as React.CSSProperties,

	main: {
		flex: 1,
		padding: "32px 48px",
		maxWidth: 880,
	} as React.CSSProperties,

	h1: {
		fontFamily: "'Playfair Display', Georgia, serif",
		fontSize: 32,
		fontWeight: 700,
		marginBottom: 8,
		color: "#1A1A1A",
	} as React.CSSProperties,

	subtitle: {
		color: "#655F5B",
		marginBottom: 32,
		fontSize: 15,
	} as React.CSSProperties,

	h2: {
		fontFamily: "'Playfair Display', Georgia, serif",
		fontSize: 22,
		fontWeight: 700,
		margin: "32px 0 12px",
		color: "#1A1A1A",
	} as React.CSSProperties,

	h3: {
		fontSize: 16,
		fontWeight: 600,
		margin: "20px 0 8px",
		color: "#1A1A1A",
	} as React.CSSProperties,

	p: {
		fontSize: 14,
		lineHeight: 1.6,
		marginBottom: 12,
	} as React.CSSProperties,

	code: {
		fontFamily:
			"ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
		background: "#E9DFC9",
		padding: "1px 6px",
		borderRadius: 3,
		fontSize: 13,
	} as React.CSSProperties,

	pre: {
		fontFamily:
			"ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
		background: "#1A1A1A",
		color: "#E8E4DF",
		padding: 16,
		borderRadius: 6,
		fontSize: 13,
		overflow: "auto" as const,
		marginBottom: 16,
	} as React.CSSProperties,

	callout: {
		background: "#fff8ed",
		border: "1px solid #f3d19f",
		borderLeft: "4px solid #B45309",
		padding: "12px 16px",
		borderRadius: 4,
		marginBottom: 16,
		fontSize: 14,
		lineHeight: 1.5,
	} as React.CSSProperties,

	calloutBad: {
		background: "#fef2f2",
		border: "1px solid #fecaca",
		borderLeft: "4px solid #dc2626",
		padding: "12px 16px",
		borderRadius: 4,
		marginBottom: 16,
		fontSize: 14,
		lineHeight: 1.5,
	} as React.CSSProperties,

	stat: {
		display: "inline-block",
		marginRight: 24,
		marginBottom: 16,
	} as React.CSSProperties,

	statNum: {
		fontSize: 28,
		fontWeight: 700,
		color: "#1A1A1A",
		display: "block",
	} as React.CSSProperties,

	statLabel: {
		fontSize: 12,
		color: "#655F5B",
		textTransform: "uppercase" as const,
		letterSpacing: 0.5,
	} as React.CSSProperties,

	ul: {
		fontSize: 14,
		lineHeight: 1.7,
		marginBottom: 12,
		paddingLeft: 20,
	} as React.CSSProperties,

	link: {
		color: "#B45309",
		textDecoration: "underline",
	} as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Section content
// ---------------------------------------------------------------------------

const InstagramSection = () => (
	<>
		<h1 style={s.h1}>Instagram sync</h1>
		<p style={s.subtitle}>
			How new IG posts get from your phone onto thirstypig.com.
		</p>

		<div style={s.calloutBad}>
			<strong>Not a daily pull.</strong> Meta's Graph API is walled for
			personal-use Pages on the new Pages experience (no Business
			Verification, no System User token). The flow is{" "}
			<em>manual export → automatic upload → automatic import</em>, gated
			on you triggering a data export.
		</div>

		<h2 style={s.h2}>The four-step loop</h2>
		<ol style={s.ul}>
			<li>
				<strong>Monday 9am PT reminder</strong> — an Anthropic Cloud
				routine pings you to request a data export.
			</li>
			<li>
				<strong>You request the export</strong> at{" "}
				<a
					style={s.link}
					href="https://www.instagram.com/accounts/access_tool/manage_data"
					target="_blank"
					rel="noopener noreferrer"
				>
					instagram.com/accounts/access_tool/manage_data
				</a>
				. Meta emails a download link 30 min – 2 hr later.
			</li>
			<li>
				<strong>You click the email link.</strong> A ZIP named{" "}
				<code style={s.code}>instagram-*.zip</code> lands in{" "}
				<code style={s.code}>~/Downloads</code>.
			</li>
			<li>
				<strong>Local launchd watcher</strong> ({" "}
				<code style={s.code}>scripts/local/ig_watcher.sh</code>) sees
				the ZIP and uploads it as a GitHub release tagged{" "}
				<code style={s.code}>ig-YYYY-MM-DD-HHMM</code>. The release
				event triggers{" "}
				<code style={s.code}>.github/workflows/instagram-sync.yml</code>
				, which runs <code style={s.code}>sync_pipeline.py</code>,
				commits new posts to <code style={s.code}>main</code>, and
				Vercel auto-deploys.
			</li>
		</ol>

		<h2 style={s.h2}>One-time setup the watcher needs</h2>
		<div style={s.callout}>
			Check whether the watcher is installed:
			<pre style={s.pre}>{`launchctl list | grep thirstypig`}</pre>
			If nothing prints, the auto-upload step is broken — you'd need to
			create the GitHub release manually. Install:
			<pre style={s.pre}>{`bash scripts/local/install_ig_watcher.sh`}</pre>
			After install, dropping any <code style={s.code}>instagram-*.zip</code>{" "}
			into Downloads triggers the full chain end-to-end.
		</div>

		<h2 style={s.h2}>If something looks wrong</h2>
		<ul style={s.ul}>
			<li>
				<strong>Reminders not firing</strong> — check the IG-reminder
				routine in <code style={s.code}>claude.ai/code → Routines</code>.
			</li>
			<li>
				<strong>Watcher not triggering</strong> — check{" "}
				<code style={s.code}>~/Library/Logs/thirstypig-ig-watcher.log</code>{" "}
				and <code style={s.code}>launchctl list | grep ig-watcher</code>.
			</li>
			<li>
				<strong>Workflow run failed</strong> — see{" "}
				<code style={s.code}>gh run list --workflow=instagram-sync.yml</code>
				.
			</li>
		</ul>
		<p style={s.p}>
			Setup walkthrough lives at{" "}
			<code style={s.code}>docs/local-ig-automation.md</code>. The Meta
			API wall reasoning is in memory at{" "}
			<code style={s.code}>project_meta_api_wall.md</code> — don't
			re-explore that path; it's closed.
		</p>
	</>
);

const ScrapingSection = () => (
	<>
		<h1 style={s.h1}>Venue-tags scraping</h1>
		<p style={s.subtitle}>
			How "Refine reviews" topic tags get from Google Maps onto post
			pages as pill widgets.
		</p>

		<h2 style={s.h2}>Pipeline shape</h2>
		<ol style={s.ul}>
			<li>
				<code style={s.code}>curate_candidates.py</code> walks{" "}
				<code style={s.code}>src/content/posts/</code>, groups by{" "}
				<code style={s.code}>(location, city)</code>, drops non-food
				and already-tagged venues. Output: YAML candidate list.
			</li>
			<li>
				<code style={s.code}>lookup_place_ids_api.py --apply</code>{" "}
				calls Google's Places API (New) <code style={s.code}>
					places:searchText
				</code>{" "}
				endpoint. Writes either FID hex (rare) or a CID (common) back
				into <code style={s.code}>venues.yaml</code>. ~100ms per
				venue, ~95% hit rate. Free tier covers our needs.
			</li>
			<li>
				<code style={s.code}>scrape_google.py</code> opens headed
				Chrome, navigates via{" "}
				<code style={s.code}>?ftid=&lt;FID&gt;</code> (preferred),{" "}
				<code style={s.code}>?cid=&lt;N&gt;</code> (cid fallback), or{" "}
				<code style={s.code}>?q=&lt;text&gt;</code> (last resort).
				Extracts chips from{" "}
				<code style={s.code}>[role="radio"]</code> aria-labels. If
				navigated by cid, extracts FID hex from the page's sign-in
				continuation link and writes it back to venues.yaml so the next
				run goes direct via ftid.
			</li>
			<li>
				<code style={s.code}>publish.py</code> copies{" "}
				<code style={s.code}>data/&#123;key&#125;_chips.json</code> →{" "}
				<code style={s.code}>
					public/venue-tags/&#123;place_id&#125;.json
				</code>
				.
			</li>
			<li>
				<code style={s.code}>sync_post_placeids.py --apply</code>{" "}
				joins venues.yaml on post frontmatter and injects the matching{" "}
				<code style={s.code}>placeId</code> field. The auto-tag step.
			</li>
		</ol>

		<h2 style={s.h2}>Why it's "self-healing"</h2>
		<p style={s.p}>
			Each venue resolves once. The first scrape converts a{" "}
			<code style={s.code}>cid</code> (decimal) into a{" "}
			<code style={s.code}>place_id</code> (FID hex pair) and writes it
			back. Future runs skip the cid resolution dance and navigate
			directly via <code style={s.code}>?ftid=</code>. Failure mode
			documented at{" "}
			<code style={s.code}>
				docs/solutions/api-migration/google-maps-cid-fid-self-healing-scrape.md
			</code>
			.
		</p>

		<h2 style={s.h2}>Auth wall (Google)</h2>
		<div style={s.callout}>
			Cold/anonymous Playwright sessions hit Google's "limited view" —
			no Reviews tab, no chips. Gate is{" "}
			<strong>session trust</strong> (signed-in Google account), not
			fingerprint detection.{" "}
			<code style={s.code}>bootstrap_profile.py</code> opens real Chrome
			(not Playwright — Google blocks sign-in via automated browsers)
			for the one-time sign-in; the scraper inherits cookies on
			subsequent runs.
		</div>

		<h2 style={s.h2}>Yelp source</h2>
		<p style={s.p}>
			<strong>Paused since 2026-04-27.</strong> Yelp's "Popular Dishes"
			widget is richer than Google's chips, but a 5-URL probe tripped
			Yelp's PerimeterX-grade anti-bot at the IP level (block ID
			returned in HTML). Resumption playbook in{" "}
			<code style={s.code}>scripts/venue-tags/YELP.md</code>. Don't
			re-scrape Yelp without reading that file first.
		</p>

		<h2 style={s.h2}>Running a batch</h2>
		<pre style={s.pre}>{`# 1. Curate candidates (start with high-confidence 2+ post venues)
scripts/venue-tags/venv/bin/python scripts/venue-tags/curate_candidates.py \\
  --min-posts 2 > /tmp/batch-candidates.yaml

# 2. Append to venues.yaml, then resolve via Places API
scripts/venue-tags/venv/bin/python scripts/venue-tags/lookup_place_ids_api.py --apply

# 3. Scrape (run in background — 12s/venue)
scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py

# 4. Publish + auto-tag
scripts/venue-tags/venv/bin/python scripts/venue-tags/publish.py
scripts/venue-tags/venv/bin/python scripts/venue-tags/sync_post_placeids.py --apply`}</pre>

		<h2 style={s.h2}>API key trap</h2>
		<div style={s.calloutBad}>
			"Application restrictions" in Google Cloud Console must be set to{" "}
			<strong>None</strong> for server-side use — "Websites" with an
			empty domain list silently 403s every request and the error
			names the empty referer, not the restriction. Full diagnosis at{" "}
			<code style={s.code}>docs/operator/api-key-trap.md</code>.
		</div>
	</>
);

const StatusSection = () => (
	<>
		<h1 style={s.h1}>Pipeline status</h1>
		<p style={s.subtitle}>
			Counts drift batch-to-batch — this section deliberately doesn't
			hard-code numbers. Run the one-liners below for current values.
		</p>

		<h2 style={s.h2}>Venue-tags coverage — count it now</h2>
		<pre style={s.pre}>{`# Venues curated (entries in venues.yaml)
grep -c '^- key:' scripts/venue-tags/venues.yaml

# Venues with FID hex resolved
grep -c 'place_id: "0x' scripts/venue-tags/venues.yaml

# Chip JSONs published
ls public/venue-tags/*.json | wc -l

# Posts displaying tags (placeId frontmatter set)
grep -lrE '^placeId:' src/content/posts/ | wc -l`}</pre>

		<h2 style={s.h2}>Long tail remaining</h2>
		<p style={s.p}>
			Single-post candidates (venues mentioned in exactly one post) are
			the long tail. Quality drops as we go deeper — limited-view
			failure rate has been climbing batch-over-batch.{" "}
			<strong>Tighten curator filters before the next sweep.</strong>{" "}
			See{" "}
			<code style={s.code}>docs/operator/curator-bugs.md</code> for the
			specific patterns to add.
		</p>

		<h2 style={s.h2}>Known curator bug</h2>
		<p style={s.p}>
			The <code style={s.code}>\bpark\b</code> non-food filter
			false-matches names like "Park's BBQ". Full write-up at{" "}
			<code style={s.code}>docs/operator/curator-bugs.md</code>.
		</p>

		<h2 style={s.h2}>Genuinely unresolvable venues</h2>
		<p style={s.p}>
			Three venues returned "limited view" on Google and cannot be
			tagged. Roster + revisit conditions at{" "}
			<code style={s.code}>docs/operator/unresolvable-venues.md</code>.
		</p>

		<h2 style={s.h2}>Instagram sync</h2>
		<ul style={s.ul}>
			<li>
				<strong>Last release:</strong>{" "}
				<code style={s.code}>gh release list --limit 5</code>
			</li>
			<li>
				<strong>Watcher installed?</strong>{" "}
				<code style={s.code}>launchctl list | grep thirstypig</code>
			</li>
		</ul>
	</>
);

const TodoSection = () => (
	<>
		<h1 style={s.h1}>Todo</h1>
		<p style={s.subtitle}>
			Smaller, actionable items. Macro initiatives live in Roadmap.
		</p>

		<h2 style={s.h2}>Photo import — backlog</h2>
		<ul style={s.ul}>
			<li>
				<strong>127 MEDIUM-confidence matches</strong> — date matches, city
				didn't match slug. Run{" "}
				<code style={s.code}>cat /tmp/photo-matches.csv | grep MEDIUM</code>{" "}
				and manually verify each folder before copying. Some will be right;
				some are coincidental date collisions.
			</li>
			<li>
				<strong>13 shared-folder cases</strong> — same-day folder matched to
				multiple posts (e.g. 3 Shanghai restaurants on June 3, 2011). Need
				manual photo selection per post — open each folder, identify which
				photos belong to which restaurant, copy selectively.
			</li>
			<li>
				<strong>257 NO_MATCH posts</strong> — no folder found. Many are
				imageless-by-nature (editorial posts, trips without SSD photos). Review
				the list in <code style={s.code}>/tmp/photo-matches.csv</code> to
				confirm which genuinely have no photos vs. folder naming mismatches.
			</li>
			<li>
				<strong>1,341 date-only folders</strong> on the SSD weren't matched
				(format: <code style={s.code}>"April 1, 2007"</code>, no city prefix).
				A second-pass date-only lookup could recover more MEDIUM-confidence
				hits from the NO_MATCH pool.
			</li>
		</ul>

		<h2 style={s.h2}>Venue tags — next batch</h2>
		<ul style={s.ul}>
			<li>
				<strong>Tighten curator filters</strong> before next sweep. Add{" "}
				<code style={s.code}>\bservice\b</code>,{" "}
				<code style={s.code}>\brepair\b</code>,{" "}
				<code style={s.code}>\bauto\b</code>; fix apostrophe-in-name
				false-match; add length cap for sentence-shaped values. See{" "}
				<code style={s.code}>docs/operator/curator-bugs.md</code>.
			</li>
			<li>
				<strong>~664 posts still untagged.</strong> Run{" "}
				<code style={s.code}>curate_candidates.py --min-posts 1</code> for
				next batch. Each sweep ≈ 30 min, yields ~70–90 newly tagged posts.
			</li>
		</ul>

		<h2 style={s.h2}>SEO P2s</h2>
		<ul style={s.ul}>
			<li>
				<strong>~199 posts with duplicate titles</strong> — different posts,
				same title string. Mostly IG posts with generic captions. Fix: set
				a more descriptive <code style={s.code}>title</code> in frontmatter.
			</li>
			<li>
				<strong>38 posts missing og:image</strong> — no{" "}
				<code style={s.code}>heroImage</code> set. These get a default
				og:image fallback. Fix: add a heroImage or leave as-is if truly
				imageless.
			</li>
			<li>
				<strong>431 venue posts need geocoding</strong> — have a{" "}
				<code style={s.code}>location</code> field but no{" "}
				<code style={s.code}>address</code> or{" "}
				<code style={s.code}>coordinates</code>. The Google Places lookup
				pipeline already handles this for tagged venues; these are posts
				where <code style={s.code}>sync_post_placeids</code> hasn't run yet
				or the venue wasn't in venues.yaml.
			</li>
		</ul>

		<h2 style={s.h2}>Pending code todos (todos/001–003)</h2>
		<ul style={s.ul}>
			<li>
				<code style={s.code}>001</code> — <strong>TinaCMS CORS errors on
				production admin.</strong> Some admin API calls getting blocked.
				Fix: add <code style={s.code}>TINA_PUBLIC_*</code> env vars and
				verify allowed origins in TinaCMS cloud config.
			</li>
			<li>
				<code style={s.code}>002</code> — <strong>Google Places API key
				missing on Vercel.</strong> Key works locally via{" "}
				<code style={s.code}>google-places-config.json</code> but isn't set
				as a Vercel env var. Run{" "}
				<code style={s.code}>vercel env add TINA_PUBLIC_GOOGLE_PLACES_API_KEY</code>.
			</li>
			<li>
				<code style={s.code}>003</code> — <strong>Phase 2 enrichment
				for ~820 imageless posts.</strong> AI-vision title/description pass
				for posts that have images but generic titles. Low priority; only
				matters for SEO.
			</li>
		</ul>

		<h2 style={s.h2}>Code review todos pending triage (todos/015–022)</h2>
		<p style={s.p}>
			From the venue-tags arc. Highlights:
		</p>
		<ul style={s.ul}>
			<li>
				<code style={s.code}>021</code> — distinct exit codes for scraper
				failure modes (auth-gated vs. network error vs. zero chips).
			</li>
			<li>
				<code style={s.code}>022</code> —{" "}
				<code style={s.code}>--check-auth</code> flag +{" "}
				<code style={s.code}>probe_yelp.py</code> for periodic health checks.
			</li>
		</ul>
	</>
);

const ChangelogSection = () => (
	<>
		<h1 style={s.h1}>Completed</h1>
		<p style={s.subtitle}>
			Shipped work, newest first. Public user-facing changelog at{" "}
			<code style={s.code}>/changelog</code>.
		</p>

		<h2 style={s.h2}>June 9 — Admin image previews, code review, isSafeSrc tests (PRs #131–#133)</h2>
		<ul style={s.ul}>
			<li>
				<strong>TinaCMS admin image previews</strong> — heroImage and images[]
				fields now show thumbnails instead of bare text inputs.{" "}
				<code style={s.code}>tina/ImagePreview.tsx</code>: lazy-loaded 72×72
				thumbnail strip + editable path inputs per row. CE code review found
				8 issues (4 P2, 4 P3); all resolved in PR #133 — including eager-load
				memory blowout fix, per-keystroke re-render debounce, and{" "}
				<code style={s.code}>isSafeSrc()</code> URL guard.
			</li>
			<li>
				<strong>Security:</strong> <code style={s.code}>data:</code> URI removed
				from admin <code style={s.code}>img-src</code> CSP; <code style={s.code}>/admin/</code>{" "}
				trailing-slash CSP gap fixed in <code style={s.code}>vercel.json</code>.
			</li>
			<li>
				<strong>10 new unit tests</strong> for <code style={s.code}>isSafeSrc()</code>{" "}
				(extracted to <code style={s.code}>src/utils/image-validation.ts</code>).
				Tests caught a real subdomain-spoofing bypass during writing.
				Suite now 283 total (178 pytest + 105 Vitest).
			</li>
		</ul>

		<h2 style={s.h2}>June 8 — Photo import from SSD + venue-tags batch (PRs #128, #129)</h2>
		<ul style={s.ul}>
			<li>
				<strong>49 draft posts published</strong> with photos matched from
				the external SSD — exact date + city-slug matching (HIGH confidence
				only). Date range: 2009-08-21 → 2016-09-21. ~930 JPEGs copied into{" "}
				<code style={s.code}>public/images/posts/&lt;slug&gt;/</code>,
				renamed <code style={s.code}>01.jpg…NN.jpg</code>. Each post got{" "}
				<code style={s.code}>heroImage</code> + <code style={s.code}>images[]</code>{" "}
				frontmatter and <code style={s.code}>draft: false</code>.
			</li>
			<li>
				<strong>Match pipeline:</strong> parsed 3,240 SSD folders →
				matched on date + city string in slug → 79 HIGH (49 clean 1:1),
				127 MEDIUM, 60 LOW, 257 NO_MATCH. Shared-folder and MEDIUM matches
				deferred for manual review.{" "}
				<code style={s.code}>/tmp/photo-matches.csv</code> has the full
				candidate list.
			</li>
			<li>
				<strong>28 new venues</strong> added to venues.yaml (PR #129),
				27/28 place_ids resolved. 33 posts got placeId synced. Rich chips
				for Father's Office (burger×546) and Mo-Mo-Paradise (shabu×59).
			</li>
		</ul>
		<details>
			<summary style={{ cursor: "pointer", color: "#B45309", marginBottom: 8 }}>
				View all 49 published posts ▸
			</summary>
			<ul style={{ ...s.ul, columns: 2, columnGap: 32 }}>
				<li><a style={s.link} href="https://thirstypig.com/posts/2009-08-21-green-street-tavern-pasadena" target="_blank">Green Street Tavern, Pasadena</a> — 2009-08-21</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2009-09-02-pien-burger-pasadena-los-angeles" target="_blank">Pie'n Burger, Pasadena</a> — 2009-09-02</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2009-09-25-westside-tavern-los-angeles" target="_blank">Westside Tavern, Los Angeles</a> — 2009-09-25</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2009-09-26-rockwell-table-stage-los-angeles" target="_blank">Rockwell Table &amp; Stage, Los Angeles</a> — 2009-09-26</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2009-11-07-ikes-place-san-francisco" target="_blank">Ike's Place, San Francisco</a> — 2009-11-07</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-03-18-hai-di-lao-海底捞火锅-shanghai" target="_blank">Haidilao Hot Pot, Shanghai</a> — 2011-03-18</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-05-21-mapuwu-麻浦屋-shanghai" target="_blank">Lillian Cake Shop, Shanghai</a> — 2011-05-21</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-05-26-uminosachi-海之幸-shanghai" target="_blank">Umi No Sachi 海之幸, Shanghai</a> — 2011-05-26</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-06-01-annion-kitchen-shanghai" target="_blank">Annion Kitchen, Shanghai</a> — 2011-06-01</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-06-04-xiao-san-tang-小三堂-shanghai" target="_blank">Xiao San Tang, Shanghai</a> — 2011-06-04</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-06-05-spicy-moment-shanghai" target="_blank">Spicy Moment, Shanghai</a> — 2011-06-05</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-06-18-orange-shabu-shabu-橘色涮涮锅-shanghai" target="_blank">Orange Shabu Shabu, Shanghai</a> — 2011-06-18</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-07-04-cest-cupcake-口袋蛋糕-shanghai" target="_blank">C'est Cupcake, Shanghai</a> — 2011-07-04</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-07-09-boxing-cat-brewery-brunch-shanghai" target="_blank">Boxing Cat Brewery, Shanghai</a> — 2011-07-09</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-07-14-craft-shanghai" target="_blank">Craft, Shanghai</a> — 2011-07-14</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-07-18-xinyi-public-assembly-hall-信義公民會館-四四南村-taipei" target="_blank">Xinyi Public Assembly Hall, Taipei</a> — 2011-07-18</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-08-04-lanxin-兰心餐厅-shanghai" target="_blank">Lanting Restaurant, Shanghai</a> — 2011-08-04</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-08-14-love-bun-ho-chi-minh-city" target="_blank">I Love Bún, Ho Chi Minh City</a> — 2011-08-14</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-08-15-quan-lau-de-306-ho-chi-minh-city" target="_blank">Quán Lẩu Dê 306, Ho Chi Minh City</a> — 2011-08-15</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-08-24-my-dining-place-shanghai" target="_blank">My Dining Place, Shanghai</a> — 2011-08-24</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-08-25-upstairs-urbn-hotel-shanghai" target="_blank">Upstairs, Shanghai</a> — 2011-08-25</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-08-29-noodle-bull-狠牛-shanghai-closed" target="_blank">Noodle Bull, Shanghai</a> — 2011-08-29</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-09-07-la-finca-庄源-shanghai-restaurant-week-closed" target="_blank">La Finca, Shanghai</a> — 2011-09-07</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-09-10-whampoa-club-黄浦会-weekend-brunch-shanghai" target="_blank">Whampoa Club Weekend Brunch, Shanghai</a> — 2011-09-10</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-12-10-le-saleya-shanghai" target="_blank">Le Saleya, Shanghai</a> — 2011-12-10</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2011-12-23-long-bar-waldorf-astoria-hotel-shanghai" target="_blank">Long Bar, Waldorf Astoria, Shanghai</a> — 2011-12-23</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-01-05-yoogane-chicken-galbi-유가네-닭갈비-seoul" target="_blank">Yoogane, Seoul</a> — 2012-01-05</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-01-06-cheonghakdong-청학동-seoul" target="_blank">청학동, Seoul</a> — 2012-01-06</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-01-23-moffetts-family-restaurant-chicken-pie-shoppe-arcadia" target="_blank">Moffett's Family Restaurant, Arcadia</a> — 2012-01-23</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-01-27-pizzeria-mozza-los-angeles" target="_blank">Pizzeria Mozza, Los Angeles</a> — 2012-01-27</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-02-17-caliburger-shanghai" target="_blank">CaliBurger, Shanghai</a> — 2012-02-17</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-02-24-new-red-house-restaurant-新虹樓飯莊-chongming-island" target="_blank">New Red House Restaurant, Chongming Island</a> — 2012-02-24</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-02-28-pizzeria-mozza-los-angeles" target="_blank">Pizzeria Mozza (revisit), Los Angeles</a> — 2012-02-28</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-04-04-yuzu-柚-日式餐厅-shanghai" target="_blank">Yamazato, Shanghai</a> — 2012-04-04</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-04-17-kechara-tea-house-shanghai" target="_blank">Kechara Tea House, Shanghai</a> — 2012-04-17</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-04-26-kathleens-waitan-shanghai" target="_blank">Kathleen's Waitan, Shanghai</a> — 2012-04-26</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-05-03-xibo-shanghai" target="_blank">Xibo, Shanghai</a> — 2012-05-03</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-05-04-wonton-soup-street-vendor-pudong-shanghai" target="_blank">Fujian Wonton King, Shanghai</a> — 2012-05-04</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-05-09-mokkos-shanghai-closed" target="_blank">Mokkos Bar, Shanghai</a> — 2012-05-09</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-05-11-glamour-bar-shanghai-closed" target="_blank">Glamour Bar, Shanghai</a> — 2012-05-11</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-05-12-gram-bodega-shanghai" target="_blank">Gran Bodega, Shanghai</a> — 2012-05-12</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2012-08-20-le-cafe-des-stagiaires-shanghai" target="_blank">Le Café des Stagiaires, Shanghai</a> — 2012-08-20</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2014-04-01-da-spring-onion-pancake-shanghai-阿大葱油饼" target="_blank">Da Spring Onion Pancake, Shanghai</a> — 2014-04-01</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2014-05-09-el-luchador-shanghai" target="_blank">El Luchador, Shanghai</a> — 2014-05-09</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2014-06-07-tsui-wah-shanghai" target="_blank">Tsui Wah Restaurant, Shanghai</a> — 2014-06-07</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2015-10-31-fathers-office-los-angeles" target="_blank">Father's Office, Los Angeles</a> — 2015-10-31</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2015-11-15-kang-ho-dong-baekjeong-k-town-los-angeles" target="_blank">Kang Ho Dong Baekjeong, K-Town</a> — 2015-11-15</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2016-09-18-young-dong-tofu-san-gabriel" target="_blank">Young Dong Tofu, San Gabriel</a> — 2016-09-18</li>
				<li><a style={s.link} href="https://thirstypig.com/posts/2016-09-21-mo-mo-paradise-rowland-heights" target="_blank">Mo-Mo-Paradise, Rowland Heights</a> — 2016-09-21</li>
			</ul>
		</details>

		<h2 style={s.h2}>April 29–30 — Venue-tags scale-up via Places API (PR #96)</h2>
		<ul style={s.ul}>
			<li>
				<strong>3 batches shipped</strong> — significantly grew the
				FID-resolved, published, and tagged-post counts. Run the
				one-liners on the Status page for current numbers.
			</li>
			<li>
				<strong>cid→FID self-healing scraper.</strong> Two-stage FID
				extraction: <code style={s.code}>location.href</code> first,
				then URL-encoded form in sign-in continuation links, then
				full-HTML regex scan. Plus a 5s wait for Maps' delayed URL
				rewrite.
			</li>
			<li>
				<strong>16 new unit tests</strong> at{" "}
				<code style={s.code}>
					scripts/venue-tags/test_lookup_place_ids_api.py
				</code>
				. Anchored to two real silent-fail modes (parser returning
				None on valid URI; YAML writeback regex no-op).
			</li>
			<li>
				<strong>Solution doc</strong> at{" "}
				<code style={s.code}>
					docs/solutions/api-migration/google-maps-cid-fid-self-healing-scrape.md
				</code>{" "}
				captures the full failure mode + fix.
			</li>
		</ul>

		<h2 style={s.h2}>April 25–27 — Bold Red Poster redesign (10 PRs)</h2>
		<p style={s.p}>
			Homepage rebuild, region landing pages (38 new statically-generated
			routes), favicon swap, local IG-watcher launchd agent, Facebook
			Page sync attempt + walled by Meta, E2E suite caught up to the
			redesign. Full bullet inventory at{" "}
			<code style={s.code}>/changelog</code>.
		</p>

		<h2 style={s.h2}>April 18–20 — Testing stack (8 PRs)</h2>
		<p style={s.p}>
			Vitest + Playwright + GitHub Actions CI on every PR; pytest with
			Hit List + post_utils tests; pre-commit hook for fast tests;
			nightly E2E run against production. Full inventory at{" "}
			<code style={s.code}>/admin → Testing</code>.
		</p>
	</>
);

const RoadmapSection = () => (
	<>
		<h1 style={s.h1}>Roadmap</h1>
		<p style={s.subtitle}>
			Macro initiatives — large arcs, not task lists. Smaller actionable
			items live in Todo.
		</p>

		<h2 style={s.h2}>Queued</h2>
		<ul style={s.ul}>
			<li>
				<strong>Bold Red Poster redesign.</strong> Homepage + post layout
				redesign is designed but not rolled out. The visual direction is
				settled; this is an implementation arc.
			</li>
			<li>
				<strong>Photo import — complete the long tail.</strong> 127 MEDIUM
				and 13 shared-folder candidates from the SSD still need manual
				review. 257 NO_MATCH posts may have photos in date-only folders.
				Details in Todo.
			</li>
			<li>
				<strong>Venue tags — finish the long tail.</strong> ~664 posts
				still untagged. Filter tightening + several more batches needed.
				Current quality degrades below 50 Google reviews (mainland China,
				obscure international). Accept that floor and stop pushing past it.
			</li>
			<li>
				<strong>Comments system.</strong> Direction TBD — Webmentions /
				Bridgy path rejected (Meta API lockdown, no-account constraint).
				Alternative idea pending.
			</li>
			<li>
				<strong>Venue tags cron — durable persistence.</strong> The
				session-only cron dies when Claude restarts. Move to{" "}
				<code style={s.code}>launchd</code> or a Monday GitHub Actions
				workflow trigger.
			</li>
		</ul>

		<h2 style={s.h2}>Blocked — won't pursue</h2>
		<ul style={s.ul}>
			<li>
				<strong>Meta Graph API for IG sync.</strong> Walled for
				personal-use Pages. Requires Business Verification +
				registered business entity. Not justifiable for a personal blog.
				Memory at <code style={s.code}>project_meta_api_wall.md</code>.
			</li>
			<li>
				<strong>Yelp scraping at scale.</strong> IP-blocked since
				2026-04-27. Resumption playbook in{" "}
				<code style={s.code}>scripts/venue-tags/YELP.md</code>; Google
				chips are sufficient.
			</li>
		</ul>
	</>
);

// ---------------------------------------------------------------------------
// Top-level component
// ---------------------------------------------------------------------------

// SectionId / SECTIONS / SECTION_RENDERERS are kept as three coordinated
// artifacts on purpose: the Record<SectionId, ...> map gives compile-time
// exhaustiveness — adding a new SectionId without a renderer fails the
// build. Collapsing into one array of {id, label, render} would lose that
// guarantee.
const SECTION_RENDERERS: Record<SectionId, () => React.ReactElement> = {
	ig: InstagramSection,
	scraping: ScrapingSection,
	status: StatusSection,
	todo: TodoSection,
	changelog: ChangelogSection,
	roadmap: RoadmapSection,
};

const AdminDocs = () => {
	const [active, setActive] = useState<SectionId>("ig");
	const ActiveSection = SECTION_RENDERERS[active];

	return (
		<div style={s.root}>
			<aside
				style={s.sidebar}
				role="tablist"
				aria-label="Documentation sections"
			>
				<div style={s.sidebarTitle}>Docs</div>
				{SECTIONS.map((sec) => (
					<button
						key={sec.id}
						type="button"
						role="tab"
						aria-selected={active === sec.id}
						aria-controls={`docs-panel-${sec.id}`}
						style={s.navItem(active === sec.id)}
						onClick={() => setActive(sec.id)}
					>
						<span style={{ marginRight: 8 }}>{sec.emoji}</span>
						{sec.label}
					</button>
				))}
			</aside>
			<main
				style={s.main}
				role="tabpanel"
				id={`docs-panel-${active}`}
				aria-labelledby={`docs-tab-${active}`}
			>
				<ActiveSection />
			</main>
		</div>
	);
};

export default AdminDocs;
