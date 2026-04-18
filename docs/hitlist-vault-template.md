# Hit List

Mobile-edit this file in Obsidian. The GitHub Action in the main repo syncs it
to `src/data/places-hitlist.yaml` on each push.

**Schema:** `## Name, City` header starts an entry. First paragraph = notes.
`- key: value` bullets set metadata. Everything except the header + city is optional.

**Keys:** `priority` (1–3), `neighborhood`, `tags` (comma-separated), `date_added`,
plus link fields: `yelp`, `google`, `instagram`, `resy`, `opentable`, `website`.

---

## Miopane, Pasadena
Taiwanese bakery, Roman-style pizza, cream cheese-filled bagels.
- priority: 1
- neighborhood: Old Town
- tags: bakery, taiwanese, pastries
- date_added: 2026-04-15
- yelp: https://www.yelp.com/biz/miopane-pasadena
- google: https://maps.google.com/maps?q=Miopane+Pasadena+CA
- instagram: https://www.instagram.com/miopaneusa/
- website: https://miopaneusa.com/

## Kato, Los Angeles
Taiwanese-American tasting menu, Row DTLA, two Michelin stars.
- priority: 1
- neighborhood: DTLA
- tags: taiwanese, tasting-menu, michelin
- date_added: 2026-04-16
- yelp: https://www.yelp.com/biz/kato-los-angeles
- instagram: https://www.instagram.com/katorestaurant/
- opentable: https://www.opentable.com/r/kato-los-angeles
- website: https://www.katorestaurant.com/

## Quick jot, Los Angeles
Just a name and city is enough — everything else can be filled in later.
