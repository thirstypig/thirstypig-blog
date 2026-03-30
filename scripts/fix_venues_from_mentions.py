#!/usr/bin/env python3
"""
Extract venue names from @mentions in Instagram post bodies.

Scans post body text for @handle mentions, converts handles to
readable venue names, and updates the location field in frontmatter.
Also sets city/region when detectable from context.

Usage:
  python3 scripts/fix_venues_from_mentions.py [--dry-run]
"""

import argparse
import glob
import os
import re

import yaml

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'content', 'posts')

# Known IG handle -> (venue name, city, region) mappings
# city/region can be None if unknown or already set
HANDLE_MAP = {
    # Texas - Austin
    'snowsbbq': ("Snow's BBQ", 'Austin', 'Texas'),
    'franklinbbq': ('Franklin BBQ', 'Austin', 'Texas'),
    'stilesswitchbbq': ('Stiles Switch BBQ', 'Austin', 'Texas'),
    'oddduckaustin': ('Odd Duck', 'Austin', 'Texas'),
    'eastsideking': ('East Side King', 'Austin', 'Texas'),
    'via313': ('Via 313', 'Austin', 'Texas'),
    'tiffstreats': ("Tiff's Treats", 'Austin', 'Texas'),
    'voodoodoughnutaustin': ('Voodoo Doughnut', 'Austin', 'Texas'),
    'valentinastexmexbbq': ("Valentina's Tex Mex BBQ", 'Austin', 'Texas'),
    'kemuritatsu_ya': ('Kemuri Tatsu-Ya', 'Austin', 'Texas'),
    'kreuzmarket': ('Kreuz Market', 'Lockhart', 'Texas'),
    'veracruztacos': ('Veracruz All Natural', 'Austin', 'Texas'),
    '2msmokehouse': ('2M Smokehouse', 'San Antonio', 'Texas'),
    'saltysow': ('Salty Sow', 'Austin', 'Texas'),
    'lucysfriedchick': ("Lucy's Fried Chicken", 'Austin', 'Texas'),
    'pacostacosaustin': ("Paco's Tacos", 'Austin', 'Texas'),
    'launderetteatx': ('Launderette', 'Austin', 'Texas'),
    'freedmens': ("Freedmen's Bar", 'Austin', 'Texas'),
    'cowtippingcreamery': ('Cow Tipping Creamery', 'Austin', 'Texas'),
    'thegranarysa': ('The Granary', 'San Antonio', 'Texas'),
    'perlassouthcongress': ("Perla's Seafood", 'Austin', 'Texas'),
    # Louisiana
    'cafedumondeofficial': ('Cafe Du Monde', 'New Orleans', 'Louisiana'),
    'cafedumonde': ('Cafe Du Monde', 'New Orleans', 'Louisiana'),
    'bigezseafood': ('Big Ez Seafood', 'New Orleans', 'Louisiana'),
    'mothersrestaurant': ("Mother's Restaurant", 'New Orleans', 'Louisiana'),
    'drgumbo': ('Dr. Gumbo Food Tour', 'New Orleans', 'Louisiana'),
    'doctorgumbo': ('Dr. Gumbo Food Tour', 'New Orleans', 'Louisiana'),
    'beviseafoodco': ('Bevi Seafood Co.', 'New Orleans', 'Louisiana'),
    'palacecafe_nola': ('Palace Cafe', 'New Orleans', 'Louisiana'),
    'oakalleyplantation': ('Oak Alley Plantation', 'New Orleans', 'Louisiana'),
    'homestate': ('HomeState', 'Los Angeles', 'Los Angeles'),
    # LA - various
    'howlinrays': ("Howlin' Ray's", 'Chinatown', 'Los Angeles'),
    'thebroadmuseum': ('The Broad', 'Downtown LA', 'Los Angeles'),
    'blossomrestaurant': ('Blossom Restaurant', 'Los Angeles', 'Los Angeles'),
    'lawrystheprimerib': ("Lawry's The Prime Rib", 'Beverly Hills', 'Los Angeles'),
    'phatbirds': ('Phat Birds', 'East LA', 'Los Angeles'),
    'theoriginaltops': ("The Original Tops", 'Pasadena', 'San Gabriel Valley'),
    'malibuseafood': ('Malibu Seafood', 'Malibu', 'Los Angeles'),
    'sanmarinoseafood': ('San Marino Seafood', 'San Marino', 'San Gabriel Valley'),
    'duparsrestaurants': ("Du-par's", 'Los Angeles', 'Los Angeles'),
    'chineselaundrytruck': ('Chinese Laundry Truck', 'Pasadena', 'San Gabriel Valley'),
    'parksbbq': ("Park's BBQ", 'Koreatown', 'Los Angeles'),
    'uncleyubeerhouse': ('Uncle Yu Beer House', 'San Gabriel', 'San Gabriel Valley'),
    'shaanxigarden': ('Shaanxi Garden', 'San Gabriel', 'San Gabriel Valley'),
    'colesfrenchdip': ("Cole's French Dip", 'Downtown LA', 'Los Angeles'),
    'clearmansboat': ("Clearman's Boat", 'San Gabriel', 'San Gabriel Valley'),
    'eatalyla': ('Eataly LA', 'Los Angeles', 'Los Angeles'),
    'sidechickla': ('Side Chick', 'Arcadia', 'San Gabriel Valley'),
    'innout': ('In-N-Out Burger', None, None),
    'californiapizzakitchen': ('California Pizza Kitchen', None, None),
    'feastownmarket': ('Feast Own Market', 'Hollywood', 'Los Angeles'),
    'bombayfrankiela': ('Bombay Frankie Company', 'Los Angeles', 'Los Angeles'),
    'cantersdeli': ("Canter's Deli", 'Los Angeles', 'Los Angeles'),
    'dintaifungusa': ('Din Tai Fung', None, None),
    'oldspaghettifactory': ('The Old Spaghetti Factory', None, None),
    'sunnongdan': ('Sun Nong Dan', 'Koreatown', 'Los Angeles'),
    'themelt': ('The Melt', None, None),
    'chicknskin': ("Chick'n Skin", 'Hollywood', 'Los Angeles'),
    'frysmith': ('Frysmith', 'Los Angeles', 'Los Angeles'),
    'thekroft': ('The Kroft', 'Anaheim', 'Orange County'),
    # New York
    'grayspapayanyc': ("Gray's Papaya", 'New York', 'New York'),
    'pjclarkes': ("P.J. Clarke's", 'New York', 'New York'),
    'momofukunoodlebar': ('Momofuku Noodle Bar', 'New York', 'New York'),
    'cafehabana': ('Cafe Habana', 'New York', 'New York'),
    'handynastynyc': ('Han Dynasty', 'Brooklyn', 'New York'),
    'themuseumofmodernart': ('Museum of Modern Art', 'New York', 'New York'),
    'guggenheim': ('Guggenheim Museum', 'New York', 'New York'),
    'metmuseum': ('The Metropolitan Museum of Art', 'New York', 'New York'),
    'whitneymuseum': ('Whitney Museum of American Art', 'New York', 'New York'),
    'radiocitymusichall': ('Radio City Music Hall', 'New York', 'New York'),
    'noguchimuseum': ('Noguchi Museum', 'New York', 'New York'),
    'american_museum_of_natural_his': ('American Museum of Natural History', 'New York', 'New York'),
    'rockcenternyc': ('Top of the Rock', 'New York', 'New York'),
    'turkisscatering': ('Turkiss', 'New York', 'New York'),
    'baohausnyc': ('BaoHaus', 'New York', 'New York'),
    'ippudous': ('Ippudo', 'San Francisco', 'San Francisco'),
    # San Francisco / Bay Area
    'hogislandoysterco': ('Hog Island Oyster Co.', 'San Francisco', 'San Francisco'),
    'chezmamansf': ('Chez Maman', 'San Francisco', 'San Francisco'),
    'fishermanswharf': ("Fisherman's Wharf", 'San Francisco', 'San Francisco'),
    'stagsleapwinecellars': ("Stag's Leap Wine Cellars", 'Napa', 'Napa Valley'),
    # Las Vegas
    'mandalaybay': ('Mandalay Bay', 'Las Vegas', 'Las Vegas'),
    # International
    'bluebellicecream': ('Blue Bell Ice Cream', None, None),
}

# Handles that are people, not venues — skip these
PERSON_HANDLES = {
    'yalin_wu', 'bingyeh', 'chaoswrld', 'chewy321', 'uscott', 'jcllee',
    'jclee', 'davidlee_72', 'bettywyy', 'yiu8', 'nerdspeed', 'fwidjaya',
    'clai919', 'dhuang25', 'fongjf123', 'michifu1222', 'krystyna.kao',
    'sochon881', 'travistu110968', 'bckc38.', 'johnnyrayzone', 'jj_kingman',
    'twangg007', 'cody_bellinger', 'redturn2', 'darvishsefat11',
    'thirstypig', 'thethirstypig', 'instagram',
    # Generic brand handles that aren't venue-specific
    'atx', 'bbq', 'texasmonthly', 'yuenglingbeer', 'southwestair',
    'yummiapp', 'innout', 'shakeshack', 'whataburger', 'figat7th',
    'packingdistrict', 'ferry_building', 'irvinespectrumcenter',
    'westfieldcenturycity', 'dekalbmarkethall', 'centralparknyc',
    '432parkavenue', 'abitabeer',
}


def handle_to_venue_name(handle: str) -> str:
    """Convert an IG handle to a readable venue name."""
    h = handle.rstrip('.').lower()
    # Remove trailing underscores/numbers
    h = re.sub(r'_+$', '', h)
    # Remove common suffixes
    for suffix in ['.com', '.com.tw', '.cn', '.co', '_official', 'official']:
        if h.endswith(suffix):
            h = h[:-len(suffix)]
    # Split on underscores and dots, title case
    parts = re.split(r'[_.]', h)
    name = ' '.join(p.capitalize() for p in parts if p)
    return name


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    print('=' * 60)
    print('  FIX VENUES FROM @MENTIONS')
    print('=' * 60)

    md_files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f'Scanning {len(md_files)} posts...\n')

    updated = 0
    venue_set = 0
    city_set = 0
    unknown_handles = {}

    for path in md_files:
        with open(path, encoding='utf-8') as f:
            content = f.read()

        parts = content.split('---', 2)
        if len(parts) < 3:
            continue

        try:
            fm = yaml.safe_load(parts[1])
        except Exception:
            continue

        if not fm:
            continue

        # Skip already geocoded posts
        if fm.get('coordinates'):
            continue

        body = parts[2]
        # Get @mentions from body (not image alt text)
        body_lines = [l for l in body.split('\n')
                      if l.strip() and not l.strip().startswith('![')]
        body_text = '\n'.join(body_lines)
        mentions = re.findall(r'@([\w.]+)', body_text)

        if not mentions:
            continue

        # Filter to venue handles only
        venue_handles = []
        for m in mentions:
            h = m.rstrip('.').lower()
            if h in PERSON_HANDLES:
                continue
            if len(h) <= 2:
                continue
            venue_handles.append(h)

        if not venue_handles:
            continue

        # Check if location field is messy or missing
        loc = str(fm.get('location', ''))
        city = str(fm.get('city', ''))
        loc_is_bad = (
            not loc or
            len(loc) > 50 or
            '...' in loc or
            loc.lower().startswith(('we ', 'had ', 'the ', 'my ', 'i ', 'finally',
                                     'just ', 'check ', 'this ', 'enjoying',
                                     'almost ', 'great ', 'best ', 'tasty ',
                                     'missed ', 'our ', 'saving ', 'late ',
                                     'she said', 'hot soup', 'did the',
                                     'views ', 'an afternoon', 'on this',
                                     'lunch', 'dinner', 'breakfast', 'dessert at ',
                                     'pork ', 'beef ', 'chicken ', 'pizza ',
                                     'burger', 'seared', 'homemade', 'ate too',
                                     'oysters', 'moule', 'galbi', 'keyhole',
                                     'blue monster', 'chillin', 'and decadent',
                                     'what a hamburger', 'reuben', 'cheeseburger',
                                     'sichuan', 'gamjatang', 'pho at', 'grilled',
                                     'mild chicken', 'roast chicken', '12oz',
                                     'porchetta', 'korean dessert', 'fed the',
                                     'stumbled', 'pork belly', 'pork sandwich'))
        )

        changed = False
        fname = os.path.basename(path)

        # Try to find a known venue from the handles
        best_venue = None
        best_city = None
        best_region = None

        for h in venue_handles:
            if h in HANDLE_MAP:
                venue_name, v_city, v_region = HANDLE_MAP[h]
                best_venue = venue_name
                if v_city:
                    best_city = v_city
                if v_region:
                    best_region = v_region
                break  # Use first known handle match

        if best_venue and loc_is_bad:
            fm['location'] = best_venue
            venue_set += 1
            changed = True
            if args.dry_run:
                print(f'  VENUE  {fname}')
                print(f'         @{venue_handles[0]} -> {best_venue}')
                if loc:
                    print(f'         was: {loc[:60]}')

        if best_city and not city:
            fm['city'] = best_city
            if best_region:
                fm['region'] = best_region
            city_set += 1
            changed = True
            if args.dry_run:
                print(f'  CITY   {fname}')
                print(f'         -> {best_city}, {best_region}')

        # Track unknown handles for future mapping
        if not best_venue and loc_is_bad:
            for h in venue_handles:
                if h not in HANDLE_MAP:
                    unknown_handles.setdefault(h, []).append(fname)

        if changed:
            if not args.dry_run:
                yaml_str = yaml.dump(fm, default_flow_style=False,
                                     allow_unicode=True, sort_keys=False, width=1000)
                with open(path, 'w', encoding='utf-8') as f:
                    f.write('---\n')
                    f.write(yaml_str)
                    f.write('---')
                    f.write(parts[2])
            updated += 1
            if args.dry_run:
                print()

    print(f'\nResults:')
    print(f'  Posts updated: {updated}')
    print(f'  Venue names set: {venue_set}')
    print(f'  Cities set: {city_set}')

    if unknown_handles:
        print(f'\n  Unknown handles ({len(unknown_handles)}) — could add to HANDLE_MAP:')
        for h, files in sorted(unknown_handles.items(), key=lambda x: -len(x[1]))[:30]:
            print(f'    @{h:30s} ({len(files)} posts)')

    if args.dry_run:
        print(f'\n  (DRY RUN — no files changed)')


if __name__ == '__main__':
    main()
