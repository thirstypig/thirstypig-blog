import { describe, it, expect } from "vitest";
import { formToEntry, type HitListFormState } from "./hitlist-entry";

const baseForm: HitListFormState = {
  name: "",
  neighborhood: "",
  city: "",
  priority: 2,
  notes: "",
  yelp: "",
  google: "",
  instagram: "",
  resy: "",
  opentable: "",
  website: "",
  tags: "",
  placeId: "",
};

describe("formToEntry", () => {
  it("includes place_id when the autocomplete captured one", () => {
    const entry = formToEntry(
      { ...baseForm, name: "Sushi Onodera", city: "Beverly Hills", placeId: "ChIJabc123" },
      new Set(),
      "2026-05-04"
    );
    expect(entry.place_id).toBe("ChIJabc123");
  });

  it("omits place_id entirely when the operator typed manually", () => {
    // Critical: an empty-string place_id in YAML would make it look like the
    // venue was pinned to Google Maps when it wasn't, polluting the join.
    const entry = formToEntry(
      { ...baseForm, name: "Some Place", city: "LA", placeId: "" },
      new Set(),
      "2026-05-04"
    );
    expect(entry).not.toHaveProperty("place_id");
  });

  it("trims whitespace from place_id but treats whitespace-only as empty", () => {
    const onlySpaces = formToEntry(
      { ...baseForm, name: "X", city: "Y", placeId: "   " },
      new Set(),
      "2026-05-04"
    );
    expect(onlySpaces).not.toHaveProperty("place_id");

    const padded = formToEntry(
      { ...baseForm, name: "X", city: "Y", placeId: "  ChIJxyz  " },
      new Set(),
      "2026-05-04"
    );
    expect(padded.place_id).toBe("ChIJxyz");
  });

  it("disambiguates IDs against existing entries", () => {
    const entry = formToEntry(
      { ...baseForm, name: "Badmaash", city: "Los Angeles" },
      new Set(["badmaash", "badmaash-2"]),
      "2026-05-04"
    );
    expect(entry.id).toBe("badmaash-3");
  });

  it("only emits link keys that have a value", () => {
    const entry = formToEntry(
      { ...baseForm, name: "X", city: "Y", website: "https://x.com", yelp: "" },
      new Set(),
      "2026-05-04"
    );
    expect(entry.links).toEqual({ website: "https://x.com" });
  });
});

