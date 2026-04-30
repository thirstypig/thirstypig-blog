# Genuinely unresolvable venues

These venues returned "limited view" on Google (closed business or no chip
data) and cannot be tagged. Left in `scripts/venue-tags/venues.yaml` as
historical records — don't re-attempt without a new strategy.

- `mundo-cafe-restaurant-new-york`
- `lamour-cafe-monterey-p`
- `pizza-patron-los-angele`

## When to revisit

Only if Google's Maps coverage for the venue's region noticeably improves,
or if the underlying business reopens. Track via periodic re-runs of
`scripts/venue-tags/scrape_google.py` against just these IDs.
