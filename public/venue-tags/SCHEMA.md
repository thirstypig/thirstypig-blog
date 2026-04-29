# Venue Tags JSON — Public Schema

Each file in this directory is a **public**, CORS-enabled JSON document
describing one venue's "tags" (Google Maps "Refine reviews" topic chips,
scraped + republished). Files are served at:

```
https://thirstypig.com/venue-tags/{place_id}.json
```

Intended consumers: the thirstypig.com site (post pages render these
via the `<VenueTags>` component), the planned tastemakers-iOS client,
and any external integration that wants to surface what people say
about a place.

## URL & filename

`{place_id}` is the **Google Maps FID hex pair**, e.g.
`0x80c2b8d33ce3dcc9:0xb0a9252822b856f6`. The colon is part of the
identifier — it's preserved literally in the filename and the URL path.

⚠ **URL portability gotcha:** some HTTP clients percent-encode `:` in
URL paths (RFC 3986 reserves it). Vercel + most browsers serve it
literally. If you build a client that constructs these URLs by
templating, **don't URL-encode the path component** — the file is
literally named with a `:`.

If your client can't tolerate `:` in URLs, fetch the index file (TBD)
and use its mapping table.

## File shape

```json
{
  "place_id": "0x80c2b8d33ce3dcc9:0xb0a9252822b856f6",
  "venue_name": "Petit Trois",
  "chips": [
    { "label": "escargot", "mention_count": 43 },
    { "label": "french onion soup", "mention_count": 38 }
  ],
  "scraped_at": "2026-04-29T17:42:18Z",
  "city": "Los Angeles",
  "key": "petit-trois-la"
}
```

## Fields

| Field          | Type           | Required | Notes                                                                                              |
| -------------- | -------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `place_id`     | `string`       | yes      | Google Maps FID hex pair. Matches `^0x[0-9a-f]+:0x[0-9a-f]+$`. Identical to the filename stem.    |
| `venue_name`   | `string`       | yes      | Google Maps' canonical display name. May be locale-translated (e.g. Wulao Hotpot Taipei is shown in English). |
| `chips`        | `Chip[]`       | yes      | Topic phrases scraped from the "Refine reviews" widget. Always present, may be `[]` for thin-coverage venues. |
| `chips[].label`        | `string`       | yes      | The phrase as Google rendered it. Typically lowercase, food-related. May contain spaces, accents, CJK. |
| `chips[].mention_count` | `number`       | yes      | Integer count of reviews containing the phrase. As reported by Google. |
| `scraped_at`   | `string`       | yes      | ISO-8601 UTC timestamp, format `%Y-%m-%dT%H:%M:%SZ`. Use this for cache freshness.                 |
| `city`         | `string\|null` | optional | City as listed in our `venues.yaml`. May be missing if the venue was added ad-hoc without a city.   |
| `key`          | `string\|null` | optional | Internal slug used by our scraper. Stable across runs but not part of the URL.                     |

## Ordering of `chips[]`

`chips[]` is currently sorted by Google's render order (which roughly
matches mention_count descending, but isn't guaranteed). **Don't trust
the sort** — re-sort by `mention_count` desc on your end if you need
strict ordering. Our own `<VenueTags>` component does this defensively.

## Coverage caveats

- **Thin coverage venues**: some places (especially mainland China and
  smaller venues) return < 5 chips. The widget is sparse there.
- **Empty `chips[]`**: a published file with `chips: []` means we
  successfully scraped but Google had no chips to report. Treat as
  "no signal" rather than an error.
- **Missing files**: if a `place_id` exists in our scraper config but no
  file is present, the scraper failed (auth gate, rate limit, etc.) and
  the venue should be retried. There is no public manifest of expected
  vs published files.

## Data freshness

Files are **manually published** via
`scripts/venue-tags/{scrape_google.py, publish.py}`. There is no
scheduled refresh today. `scraped_at` reflects the most recent run.
Mention counts on a real venue will tick up over time as Google
indexes new reviews; expect drift on the order of a few percent per
month for high-traffic places.

## CORS

All files in this directory are served with permissive CORS headers
(`Access-Control-Allow-Origin: *`) by Vercel's static file handler.
Suitable for direct fetch from any origin.

## Stability commitment

The fields above are stable as of 2026-04-29. Adding new fields is
considered non-breaking. Removing or renaming a field is breaking and
will be coordinated via a migration note.
