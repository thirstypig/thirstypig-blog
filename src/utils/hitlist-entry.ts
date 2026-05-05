// Pure helpers for converting hit-list form state to the YAML on-disk shape.
// Lives here (not in tina/) so it falls under vitest's src/** include — the
// admin UI is hard to test, but the serialization rules are pure functions
// where a regression silently corrupts data.

export interface HitListEntry {
  id: string;
  name: string;
  neighborhood?: string;
  city: string;
  priority: number;
  date_added: string;
  notes?: string;
  links: Record<string, string | null>;
  tags: string[];
  place_id?: string;
}

export interface HitListFormState {
  name: string;
  neighborhood: string;
  city: string;
  priority: number;
  notes: string;
  yelp: string;
  google: string;
  instagram: string;
  resy: string;
  opentable: string;
  website: string;
  tags: string;
  placeId: string;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function formToEntry(
  form: HitListFormState,
  existingIds: Set<string>,
  today: string = new Date().toISOString().split("T")[0]
): HitListEntry {
  let id = slugify(form.name);
  if (existingIds.has(id)) {
    let n = 2;
    while (existingIds.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }

  const links: Record<string, string> = {};
  if (form.yelp.trim()) links.yelp = form.yelp.trim();
  if (form.google.trim()) links.google = form.google.trim();
  if (form.instagram.trim()) links.instagram = form.instagram.trim();
  if (form.resy.trim()) links.resy = form.resy.trim();
  if (form.opentable.trim()) links.opentable = form.opentable.trim();
  if (form.website.trim()) links.website = form.website.trim();

  const tags = form.tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const entry: HitListEntry = {
    id,
    name: form.name.trim(),
    city: form.city.trim(),
    priority: form.priority,
    date_added: today,
    links,
    tags,
  };

  if (form.neighborhood.trim()) entry.neighborhood = form.neighborhood.trim();
  if (form.notes.trim()) entry.notes = form.notes.trim();
  if (form.placeId.trim()) entry.place_id = form.placeId.trim();

  return entry;
}
