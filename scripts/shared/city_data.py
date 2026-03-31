"""
Canonical city/region mapping data for all Thirsty Pig scripts.

Merged from:
  - scripts/cleanup_locations.py (base, most complete)
  - scripts/instagram/extract_ig_venues.py
  - scripts/instagram/import_instagram.py
  - scripts/fix_venues_from_mentions.py
  - scripts/lookup_addresses.py

All scripts should import from here instead of defining their own copies.
"""

# ---------------------------------------------------------------------------
# CITY_MAP — master lookup: lowercase key -> (City Name, Region)
# ---------------------------------------------------------------------------
CITY_MAP = {
    # -- LA neighborhoods (29) ------------------------------------------
    'dtla': ('Downtown LA', 'Los Angeles'),
    'downtown la': ('Downtown LA', 'Los Angeles'),
    'downtown los angeles': ('Downtown LA', 'Los Angeles'),
    'koreatown': ('Koreatown', 'Los Angeles'),
    'ktown': ('Koreatown', 'Los Angeles'),
    'k-town': ('Koreatown', 'Los Angeles'),
    'hollywood': ('Hollywood', 'Los Angeles'),
    'west hollywood': ('West Hollywood', 'Los Angeles'),
    'weho': ('West Hollywood', 'Los Angeles'),
    'silver lake': ('Silver Lake', 'Los Angeles'),
    'echo park': ('Echo Park', 'Los Angeles'),
    'los feliz': ('Los Feliz', 'Los Angeles'),
    'eagle rock': ('Eagle Rock', 'Los Angeles'),
    'highland park': ('Highland Park', 'Los Angeles'),
    'venice': ('Venice', 'Los Angeles'),
    'santa monica': ('Santa Monica', 'Los Angeles'),
    'culver city': ('Culver City', 'Los Angeles'),
    'beverly hills': ('Beverly Hills', 'Los Angeles'),
    'brentwood': ('Brentwood', 'Los Angeles'),
    'westwood': ('Westwood', 'Los Angeles'),
    'sawtelle': ('Sawtelle', 'Los Angeles'),
    'arts district': ('Arts District', 'Los Angeles'),
    'chinatown': ('Chinatown', 'Los Angeles'),
    'little tokyo': ('Little Tokyo', 'Los Angeles'),
    'malibu': ('Malibu', 'Los Angeles'),
    'los angeles': ('Los Angeles', 'Los Angeles'),
    'east la': ('East LA', 'Los Angeles'),
    'east los angeles': ('East LA', 'Los Angeles'),
    'mar vista': ('Mar Vista', 'Los Angeles'),          # from import_instagram.py
    'la': ('Los Angeles', 'Los Angeles'),               # from import_instagram.py

    # -- San Gabriel Valley (22) ----------------------------------------
    'pasadena': ('Pasadena', 'San Gabriel Valley'),
    'alhambra': ('Alhambra', 'San Gabriel Valley'),
    'arcadia': ('Arcadia', 'San Gabriel Valley'),
    'monterey park': ('Monterey Park', 'San Gabriel Valley'),
    'san gabriel': ('San Gabriel', 'San Gabriel Valley'),
    'rosemead': ('Rosemead', 'San Gabriel Valley'),
    'rowland heights': ('Rowland Heights', 'San Gabriel Valley'),
    'temple city': ('Temple City', 'San Gabriel Valley'),
    'monrovia': ('Monrovia', 'San Gabriel Valley'),
    'duarte': ('Duarte', 'San Gabriel Valley'),
    'sierra madre': ('Sierra Madre', 'San Gabriel Valley'),
    'san marino': ('San Marino', 'San Gabriel Valley'),
    'la canada': ('La Canada', 'San Gabriel Valley'),
    'diamond bar': ('Diamond Bar', 'San Gabriel Valley'),
    'hacienda heights': ('Hacienda Heights', 'San Gabriel Valley'),
    'sgv': ('San Gabriel Valley', 'San Gabriel Valley'),
    'san gabriel valley': ('San Gabriel Valley', 'San Gabriel Valley'),
    'mpk': ('Monterey Park', 'San Gabriel Valley'),
    'el monte': ('El Monte', 'San Gabriel Valley'),
    'west covina': ('West Covina', 'San Gabriel Valley'),
    'covina': ('Covina', 'San Gabriel Valley'),
    'azusa': ('Azusa', 'San Gabriel Valley'),
    'glendora': ('Glendora', 'San Gabriel Valley'),
    'la puente': ('La Puente', 'San Gabriel Valley'),

    # -- South Bay (6) --------------------------------------------------
    'torrance': ('Torrance', 'South Bay'),
    'gardena': ('Gardena', 'South Bay'),
    'manhattan beach': ('Manhattan Beach', 'South Bay'),
    'redondo beach': ('Redondo Beach', 'South Bay'),
    'hermosa beach': ('Hermosa Beach', 'South Bay'),
    'el segundo': ('El Segundo', 'South Bay'),

    # -- San Fernando Valley (2) ----------------------------------------
    'burbank': ('Burbank', 'San Fernando Valley'),
    'glendale': ('Glendale', 'San Fernando Valley'),

    # -- Other SoCal (9) ------------------------------------------------
    'long beach': ('Long Beach', 'Long Beach'),
    'irvine': ('Irvine', 'Orange County'),
    'costa mesa': ('Costa Mesa', 'Orange County'),
    'anaheim': ('Anaheim', 'Orange County'),
    'fullerton': ('Fullerton', 'Orange County'),
    'laguna beach': ('Laguna Beach', 'Orange County'),
    'orange county': ('Orange County', 'Orange County'),
    'lake forest': ('Lake Forest', 'Orange County'),
    'garden grove': ('Garden Grove', 'Orange County'),

    # -- Mexico (2) -----------------------------------------------------
    'ensenada': ('Ensenada', 'Mexico'),
    'tijuana': ('Tijuana', 'Mexico'),

    # -- California (6) -------------------------------------------------
    'san francisco': ('San Francisco', 'San Francisco'),
    'oakland': ('Oakland', 'Bay Area'),
    'san jose': ('San Jose', 'Bay Area'),
    'san diego': ('San Diego', 'San Diego'),
    'napa': ('Napa', 'Napa Valley'),
    'solvang': ('Solvang', 'Central Coast'),

    # -- US (18) --------------------------------------------------------
    'las vegas': ('Las Vegas', 'Las Vegas'),
    'vegas': ('Las Vegas', 'Las Vegas'),
    'new york': ('New York', 'New York'),
    'nyc': ('New York', 'New York'),
    'brooklyn': ('Brooklyn', 'New York'),
    'manhattan': ('Manhattan', 'New York'),
    'west village': ('West Village', 'New York'),
    'tribeca': ('Tribeca', 'New York'),
    'honolulu': ('Honolulu', 'Hawaii'),
    'maui': ('Maui', 'Hawaii'),
    'seattle': ('Seattle', 'Seattle'),
    'portland': ('Portland', 'Portland'),
    'chicago': ('Chicago', 'Chicago'),
    'austin': ('Austin', 'Texas'),
    'houston': ('Houston', 'Texas'),
    'new orleans': ('New Orleans', 'Louisiana'),
    'bardstown': ('Bardstown', 'Kentucky'),
    'lockhart': ('Lockhart', 'Texas'),
    'san antonio': ('San Antonio', 'Texas'),

    # -- International (18) ---------------------------------------------
    'shanghai': ('Shanghai', 'Shanghai'),
    'taipei': ('Taipei', 'Taipei'),
    'tokyo': ('Tokyo', 'Tokyo'),
    'osaka': ('Osaka', 'Osaka'),
    'kyoto': ('Kyoto', 'Kyoto'),
    'seoul': ('Seoul', 'Seoul'),
    'hong kong': ('Hong Kong', 'Hong Kong'),
    'bangkok': ('Bangkok', 'Bangkok'),
    'singapore': ('Singapore', 'Singapore'),
    'beijing': ('Beijing', 'Beijing'),
    'chengdu': ('Chengdu', 'Chengdu'),
    'dalian': ('Dalian', 'China'),
    'chongming': ('Chongming Island', 'Shanghai'),
    'medellin': ('Medellin', 'Colombia'),
    'medell\u00edn': ('Medellin', 'Colombia'),
    'bogota': ('Bogota', 'Colombia'),
    'bogot\u00e1': ('Bogota', 'Colombia'),
    'london': ('London', 'London'),
    'paris': ('Paris', 'Paris'),
    'victoria': ('Victoria', 'British Columbia'),
    'koh samui': ('Koh Samui', 'Thailand'),
}


# ---------------------------------------------------------------------------
# HASHTAG_CITY_MAP — Instagram hashtag -> (City Name, Region)
# Copied from extract_ig_venues.py (43 entries)
# ---------------------------------------------------------------------------
HASHTAG_CITY_MAP = {
    'dtla': ('Downtown LA', 'Los Angeles'),
    'dtlafood': ('Downtown LA', 'Los Angeles'),
    'dtlaeats': ('Downtown LA', 'Los Angeles'),
    'lafood': ('Los Angeles', 'Los Angeles'),
    'lafoodie': ('Los Angeles', 'Los Angeles'),
    'laeats': ('Los Angeles', 'Los Angeles'),
    'losangeles': ('Los Angeles', 'Los Angeles'),
    'losangelesfood': ('Los Angeles', 'Los Angeles'),
    'koreatown': ('Koreatown', 'Los Angeles'),
    'koreatownla': ('Koreatown', 'Los Angeles'),
    'ktown': ('Koreatown', 'Los Angeles'),
    'pasadena': ('Pasadena', 'San Gabriel Valley'),
    'pasadenafood': ('Pasadena', 'San Gabriel Valley'),
    'sgv': ('San Gabriel Valley', 'San Gabriel Valley'),
    'sgvfood': ('San Gabriel Valley', 'San Gabriel Valley'),
    'sangabrielvalley': ('San Gabriel Valley', 'San Gabriel Valley'),
    'santamonica': ('Santa Monica', 'Los Angeles'),
    'beverlyhills': ('Beverly Hills', 'Los Angeles'),
    'silverlake': ('Silver Lake', 'Los Angeles'),
    'echopark': ('Echo Park', 'Los Angeles'),
    'nyc': ('New York', 'New York'),
    'nycfood': ('New York', 'New York'),
    'newyork': ('New York', 'New York'),
    'brooklyn': ('Brooklyn', 'New York'),
    'shanghai': ('Shanghai', 'Shanghai'),
    'taipei': ('Taipei', 'Taipei'),
    'tokyo': ('Tokyo', 'Tokyo'),
    'seoul': ('Seoul', 'Seoul'),
    'hongkong': ('Hong Kong', 'Hong Kong'),
    'bangkok': ('Bangkok', 'Bangkok'),
    'singapore': ('Singapore', 'Singapore'),
    'lasvegas': ('Las Vegas', 'Las Vegas'),
    'sanfrancisco': ('San Francisco', 'San Francisco'),
    'sandiego': ('San Diego', 'San Diego'),
    'seattle': ('Seattle', 'Seattle'),
    'chicago': ('Chicago', 'Chicago'),
    'hawaii': ('Hawaii', 'Hawaii'),
    'honolulu': ('Honolulu', 'Hawaii'),
    'maui': ('Maui', 'Hawaii'),
    'medellin': ('Medellin', 'Colombia'),
    'colombiafood': ('Colombia', 'Colombia'),
    'socal': ('Los Angeles', 'Los Angeles'),
    'southerncalifornia': ('Los Angeles', 'Los Angeles'),
}


# ---------------------------------------------------------------------------
# CITY_REGIONS — simple key -> region string (backward compat for import_instagram.py)
# Derived automatically from CITY_MAP.
# ---------------------------------------------------------------------------
CITY_REGIONS = {key: region for key, (city, region) in CITY_MAP.items()}


# ---------------------------------------------------------------------------
# HANDLE_MAP — Instagram @handle -> (venue_name, city, region)
# Copied from fix_venues_from_mentions.py (80+ entries)
# ---------------------------------------------------------------------------
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
    # Generic / unknown location
    'bluebellicecream': ('Blue Bell Ice Cream', None, None),
}


# ---------------------------------------------------------------------------
# REAL_CITIES — set of all canonical city names (for lookup_addresses.py)
# Derived from CITY_MAP values, plus explicit additions.
# ---------------------------------------------------------------------------
REAL_CITIES = set(city for city, region in CITY_MAP.values()) | {
    'Lake Forest', 'Garden Grove',
}


# ---------------------------------------------------------------------------
# CITY_SEARCH_NAMES — Foursquare search overrides for LA neighborhoods etc.
# Copied from lookup_addresses.py (19 entries)
# ---------------------------------------------------------------------------
CITY_SEARCH_NAMES = {
    'Downtown LA': 'Los Angeles, CA',
    'Koreatown': 'Los Angeles, CA',
    'Hollywood': 'Los Angeles, CA',
    'West Hollywood': 'West Hollywood, CA',
    'Silver Lake': 'Los Angeles, CA',
    'Echo Park': 'Los Angeles, CA',
    'Venice': 'Venice, Los Angeles, CA',
    'Chinatown': 'Los Angeles, CA',
    'Little Tokyo': 'Los Angeles, CA',
    'East LA': 'Los Angeles, CA',
    'Arts District': 'Los Angeles, CA',
    'Highland Park': 'Los Angeles, CA',
    'Eagle Rock': 'Los Angeles, CA',
    'Los Feliz': 'Los Angeles, CA',
    'Brentwood': 'Los Angeles, CA',
    'Westwood': 'Los Angeles, CA',
    'Brooklyn': 'Brooklyn, NY',
    'Maui': 'Maui, HI',
    'Honolulu': 'Honolulu, HI',
}
