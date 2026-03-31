#!/usr/bin/env python3
"""
Fix obvious Foursquare venue mismatches where the location is clearly wrong.

For each fix, we:
1. Update the location name to match the restaurant named in the title
2. Remove the wrong address and coordinates (since they belong to the wrong venue)
3. Keep city and region intact
"""

import re
from pathlib import Path

POSTS_DIR = Path(__file__).resolve().parent.parent / "src" / "content" / "posts"

# Map of filename -> correct location name
# Only includes cases where the title clearly names a specific restaurant
# and the Foursquare location is obviously wrong (different business entirely)
FIXES = {
    # Title: "The tried and true . . . The Hat" -> Location: "The Comic Cellar"
    "2009-08-17-the-tried-and-true-the-hat.md": "The Hat",

    # Title: "The Sub – Guilianos" -> Location: "The Crab Shack"
    "2009-09-01-the-sub-guilianos.md": "Guiliano's",

    # Title: "To the Slaughterhouse We Go! ... LA's Animal" -> Location: "The Last Bookstore"
    "2009-09-30-to-the-slaughterhouse-we-go-las-animal.md": "Animal",

    # Title: "Good Times at Rockwell" -> Location: "Water Court at California Plaza"
    "2009-10-03-good-times-at-rockwell.md": "Rockwell",

    # Title: "Liang's Kitchen 梁媽媽家" -> Location: "Spices Thai Kitchen"
    "2009-12-30-liangs-kitchen-梁媽媽家-arcadia.md": "Liang's Kitchen",

    # Title: "Curry House" -> Location: "New Golden City Dumpling House"
    "2010-01-16-curry-house-rowland-heights.md": "Curry House",

    # Title: "Strawberry Cones Japanese Pizza & Pasta" -> Location: "Pulciano's Deli & Cafe"
    "2010-01-18-strawberry-cones-japanese-pizza-pasta-san-gabriel.md": "Strawberry Cones",

    # Title: "Bossam at The Kobawoo House" -> Location: "Dynasty Typewriter At The Hayworth"
    "2010-02-05-bossam-보쌈-at-the-kobawoo-house-los-angeles.md": "Kobawoo House",

    # Title: "Steam Buns at the Noodle House 麵香園" -> Location: "Mama Lu's Dumpling House"
    "2010-02-23-steam-buns-at-the-noodle-house-麵香園-monterey-park.md": "Noodle House",

    # Title: "Mountain Cafe Revisited" -> Location: "Tea Master Matcha Cafe and Green Tea Shop"
    "2010-03-08-mountain-cafe-revisited.md": "Mountain Cafe",

    # Title: "Larkin's" -> Location: "Jennifer Larkins Hair"
    "2010-03-26-larkins-eagle-rock-closed.md": "Larkin's",

    # Title: "Border Grill Truck" -> Location: "Water Grill"
    "2010-04-05-border-grill-truck-with-chilaquiles-tacos.md": "Border Grill Truck",

    # Title: "Churrasco at Fogo de Chao" -> Location: "Larder at Maple Drive"
    "2010-07-05-churrasco-at-fogo-de-chao-beverly-hills.md": "Fogo de Chao",

    # Title: "I-Naba" -> Location: "I Love Boba"
    "2010-05-12-i-naba.md": "I-Naba",

    # Title: "LA Koreatown's Stop Number One – Gaam" -> Location: "BADMAASH Downtown LA"
    "2010-05-16-gaam.md": "Gaam",

    # Title: "Lamb at Mo Zai Yang 莫宰羊" -> Location: "Water Court at California Plaza"
    "2010-05-18-mo-zai-yang-lamb.md": "Mo Zai Yang",

    # Title: "David Laris' Yucca" -> Location: "Davidoff Shop"
    "2010-12-02-david-laris-yucca-shanghai-closed.md": "Yucca",

    # Title: "The Brazilian Pot Pies at Wood Spoon" -> Location: "Woodcat"
    "2010-12-05-the-brazilian-pot-pies-at-wood-spoon-in-los-angeles.md": "Wood Spoon",

    # Title: "The Budaejeongol at Nolboo 놀부" -> Location: "The Stables at Santa Anita Park"
    "2011-01-27-the-budaejeongol-부대전골-at-nolboo-놀부.md": "Nolboo",

    # Title: "The Crispy Pork Buns at Che's Cantonese Restaurant" -> Location: "The Spa at Four Seasons"
    "2011-03-07-the-crispy-pork-buns-at-ches-cantonese-restaurant-hong-kong.md": "Che's Cantonese Restaurant",

    # Title: "The Cold Egg Tart at Tai Cheong Bakery" -> Location: "The Spa at Four Seasons"
    "2011-04-08-the-cold-egg-tart-at-tai-cheong-bakery-hong-kong.md": "Tai Cheong Bakery",

    # Title: "Dinner at David Chang's Majordomo" -> Location: "Water Court at California Plaza"
    "2018-02-22-dinner-at-david-changs-majordomo.md": "Majordomo",

    # Title: "Dinner at Rossoblu" -> Location: "Water Court at California Plaza"
    "2018-02-28-dinner-at-rossoblu.md": "Rossoblu",

    # Title: "Lunch with mom at Ahgoo's" -> Location: "Atlas Home Repairs"
    "2018-03-23-lunch-with-mom-at-ahgoos.md": "Ahgoo's Kitchen",

    # Title: "Taco Tuesday at Tacos Ensenada" -> Location: "Farmers Insurance"
    "2018-04-24-taco-tuesday-at-tacos-ensenada-in-sierra-madre.md": "Tacos Ensenada",

    # Title: "Picanha at lunch at Fogo de Chão" -> Location: "Water Court at California Plaza"
    "2018-05-02-picanha-at-lunch-at-fogo-de-chão.md": "Fogo de Chão",

    # Title: "Family lunch at the Shanghailander Palace" -> Location: "The Stables at Santa Anita Park"
    "2018-05-04-family-lunch-at-the-shanghailander-palace-in-arcadia-上海攤shan.md": "Shanghailander Palace",

    # Title: "A return to Gammeeok" -> Location: "Tacos Tumbras a Tomas"
    "2018-05-20-a-return-to-gammeeok.md": "Gammeeok",

    # Title: "Chuan Chuan in LA at JiouDing Hot Pot" -> Location: "Hotel Per La"
    "2018-06-28-chuan-chuan-in-la-at-jiouding-hot-pot.md": "JiouDing Hot Pot",

    # Title: "Steam Pork Soup Dumplings at Din Tai Fung" -> Location: "Atlas Home Repairs"
    "2019-08-26-steam-pork-soup-dumplings-at-din-tai-fung.md": "Din Tai Fung",

    # Title: "Birthday dinner at Chuan's" -> Location: "Atlas Home Repairs"
    "2019-01-28-birthday-dinner-at-chuans.md": "Chuan's",

    # Title: "Christmas Eve Dessert at hooshik" -> Location: "Atlas Home Repairs"
    "2018-12-25-christmas-eve-dessert-at-hooshik.md": "Hooshik",

    # Title: "Galbi and Soondubu at Young Dong Tofu" -> Location: "Pulciano's Deli & Cafe"
    "2019-01-25-galbi-and-soondubu-at-young-dong-tofu.md": "Young Dong Tofu",

    # Title: "Brunch at Paul Martin's American Grill" -> Location: "Eden Garden Bar & Grill"
    "2019-06-02-brunch-at-paul-martins-american-grill.md": "Paul Martin's American Grill",

    # Title: "Oyaku-Don at Suehiro's" -> Location: "Water Court at California Plaza"
    "2019-06-02-oyaku-don-at-suehiros.md": "Suehiro's",

    # Title: "Good times with old friends at Inko Nito" -> Location: "Good Clean Fun"
    "2019-06-30-good-times-with-old-friends-at-inko-nito.md": "Inko Nito",

    # Title: "Brunch at ERB" -> Location: "Water Court at California Plaza"
    "2019-08-04-brunch-at-erb.md": "ERB",

    # Title: "Brunch at Sqirl" -> Location: "Water Court at California Plaza"
    "2019-08-04-brunch-at-sqirl.md": "Sqirl",

    # Title: "Beijing Roast Duck at the Duck House" -> Location: "Mama Lu's Dumpling House"
    "2019-11-24-beijing-roast-duck-北京烤鴨-at-the-duck-house.md": "Duck House",

    # Title: "Hangzhou Cuisine at Chang's Garden 樓外樓" -> Location: "The Stables at Santa Anita Park"
    "2019-04-08-hangzhou-cuisine-at-changs-garden-樓外樓.md": "Chang's Garden",

    # Title: "Shaved ice at Salju Desserts" -> Location: "Vino at Trios"
    "2019-04-14-shaved-ice-at-salju-desserts.md": "Salju Desserts",

    # Title: "Korean Bbq at Kang Ho Dong Baekjeong" -> Location: "Hui Tou Xiang Noodles House"
    "2019-05-01-korean-bbq-at-kang-ho-dong-baekjeong.md": "Kang Ho Dong Baekjeong",

    # Title: "The famous clam pizza at Lombardi's" -> Location: "Raines Law Room at The William"
    "2019-05-17-the-famous-clam-pizza-at-lombardis.md": "Lombardi's",

    # Title: "Just a couple of sandwiches for dinner at Katz" -> Location: "Museum at FIT"
    "2019-05-19-just-a-couple-of-sandwiches-for-dinner-at-katz.md": "Katz's Delicatessen",

    # Title: "Garlicky Tonkotsu Ramen at Hironiro Craft Ramen" -> Location: "The Lounge At Mi Piace"
    "2019-09-08-garlicky-tonkotsu-ramen-at-hironiro-craft-ramen.md": "Hironori Craft Ramen",

    # Title: "Big Ben Combo at Pie n'Burger" -> Location: "The Lounge At Mi Piace"
    "2019-09-14-big-ben-combo-at-pie-nburger.md": "Pie 'n Burger",

    # Title: "Taiwanese dinner at Monja Taiker" -> Location: "Attorney Edmund V. Yan"
    "2019-10-11-taiwanese-dinner-at-monja-taiker.md": "Monja Taiker",

    # Title: "Taiwanese breakfast at Yi Mei" -> Location: "The Stables at Santa Anita Park"
    "2019-12-07-taiwanese-breakfast-at-yi-mei.md": "Yi Mei",

    # Title: "New Year's Day brunch at Granville" -> Location: "The Lounge At Mi Piace"
    "2020-01-03-new-years-day-brunch-at-granville.md": "Granville",

    # Title: "Tonkotsu ramen at King of Ramen" -> Location: "Rotisserie Chicken Of California"
    "2020-01-06-tonkotsu-ramen-at-king-of-ramen.md": "King of Ramen",

    # Title: "Chicken sando at pikunico" -> Location: "Water Court at California Plaza"
    "2020-09-11-chicken-sando-at-pikunico.md": "Pikunico",

    # Title: "The cheeseburger potsticker at Ms Chi" -> Location: "Honey's Kettle Fried Chicken"
    "2018-10-13-the-cheeseburger-potsticker-at-ms-chi-in-culver-city.md": "Ms Chi",

    # Title: "Outdoor dining at Gozen Shun" -> Location: "The Lounge At Mi Piace"
    "2021-05-16-outdoor-dining-at-gozen-shun.md": "Gozen Shun",

    # Title: "Early lunch/brunch at L'antica in Hollywood" -> Location: "Omni Los Angeles Hotel"
    "2021-05-18-early-lunchbrunch-at-lantica-in-hollywood.md": "L'Antica Pizzeria da Michele",

    # Title: "Weekend brunch at All Day Baby on Sunset" -> Location: "The United Theater On Broadway"
    "2021-07-14-weekend-brunch-at-all-day-baby-on-sunset.md": "All Day Baby",

    # Title: "Breakfast burritos at Homestate" -> Location: "The Lounge At Mi Piace"
    "2021-09-01-breakfast-burritos-at-homestate.md": "HomeState",

    # Title: "Breakfast at JiST cafe" -> Location: "Tea Master Matcha Cafe and Green Tea Shop"
    "2021-09-17-breakfast-at-jist-cafe.md": "JiST Cafe",

    # Title: "Lunch at Ola Mexican" -> Location: "Harvey Milk Equality Plaza"
    "2021-09-30-lunch-at-ola-mexican-at-2nd-pch-in-the-lbc.md": "Ola Mexican Kitchen",

    # Title: "Bloody Mary and happy hour at The Dive" -> Location: "Pulciano's Deli & Cafe"
    "2021-10-09-bloody-mary-and-happy-hour-at-the-dive.md": "The Dive",

    # Title: "Brunch at Poppy & Rose" -> Location: "Water Court at California Plaza"
    "2022-03-22-brunch-at-poppy-rose.md": "Poppy & Rose",

    # Title: "Prime Rib at the Derby" -> Location: "The Stables at Santa Anita Park"
    "2022-04-07-prime-rib-at-the-derby.md": "The Derby",

    # Title: "Happy Hour at Sara the Wine Bar" -> Location: "Bar Bohémien"
    "2022-07-30-happy-hour-at-sara-the-wine-bar.md": "Sara the Wine Bar",

    # Title: "Texas BBQ at Slab" -> Location: "Water Court at California Plaza"
    "2022-02-19-texas-bbq-at-slab.md": "Slab",

    # Title: "Barbecue Day at Moo's Craft Barbecue" -> Location: "Water Court at California Plaza"
    "2022-02-26-barbecue-day-at-moos-craft-barbecue.md": "Moo's Craft Barbecue",

    # Title: "Bone marrow and beef at NIKU X" -> Location: "Water Court at California Plaza"
    "2024-08-22-bone-marrow-and-beef-at-niku-x.md": "NIKU X",

    # Title: "Japanese BBQ at Hibiki" -> Location: "The Ortega-Vigare Adobe"
    "2024-08-31-japanese-bbq-at-hibiki-in-the-sgv.md": "Hibiki",

    # Title: "Brunch at Westwood's Egg Tuck" -> Location: "Eggslut"
    "2024-11-20-brunch-at-westwoods-egg-tuck.md": "Egg Tuck",

    # Title: "Really good sandwich from All'Antico Vinaio" -> Location: "Artisanal Goods by Car"
    "2025-01-15-really-good-sandwich-from-allantico-vinaio.md": "All'Antico Vinaio",

    # Title: "The Cubano at Porto's" -> Location: "The Spicery in Our 1895 Home"
    "2025-02-13-the-cubano-at-portos.md": "Porto's Bakery",

    # Title: "The big Met at Petit Trois" -> Location: "Big Man Bakes"
    "2025-04-15-the-big-met-at-petit-trois.md": "Petit Trois",

    # Title: "Seolleongtang at Gammeeok, in NYC Koreatown" -> Location: "Water Court at California Plaza"
    "2018-01-04-seolleongtang-at-gammeeok-in-nyc-koreatown.md": "Gammeeok",

    # Title: "Dim sum at Xiang Yuan Gourmet" -> Location: "Summer Rolls"
    "2017-12-08-dim-sum-at-xiang-yuan-gourmet-on-las-tunas-in-temple-city-cr.md": "Xiang Yuan Gourmet",

    # Title: "Hunan cuisine at Hunan Mao Restaurant" -> Location: "Hop Li Seafood Restaurant"
    "2019-03-15-hunan-cuisine-at-hunan-mao-restaurant.md": "Hunan Mao",

    # Title: "Philadelphia Hoagies at Big Jo's" -> Location: "Big Dean's Ocean Front Cafe"
    "2019-03-23-philadelphia-hoagies-at-big-jos.md": "Big Jo's",

    # Title: "Satisfying breakfast at Jenny's Kitchen" -> Location: "Water Court at California Plaza"
    "2019-03-24-satisfying-breakfast-at-jennys-kitchen.md": "Jenny's Kitchen",

    # Title: "Cold and hot desserts at Blackball Desserts" -> Location: "Pulciano's Deli & Cafe"
    "2019-03-15-cold-and-hot-desserts-at-blackball-desserts.md": "Blackball Desserts",

    # Title: "Awesome Taiwanese breakfast at JJ Bakery & Cafe" -> Location: "Pulciano's Deli & Cafe"
    "2017-11-26-awesome-taiwanese-breakfast-at-jj-bakery-cafe.md": "JJ Bakery & Cafe",

    # Title: "Tonkotsu Ramen and Spicy Miso Ramen" -> Location: "Pulciano's Deli & Cafe"
    # (Title doesn't name the restaurant clearly - SKIP)

    # Title: "Taiwanese lunch in the SGV at Bopomofo cafe" -> Location: "Pulciano's Deli & Cafe"
    "2025-01-30-taiwanese-lunch-in-the-sgv-at-bopomofo-cafe.md": "Bopomofo",

    # Title: "Barbecue at Domestic in La Puente" -> Location: "BADMAASH Downtown LA"
    "2025-02-11-barbecue-at-domestic-in-la-puente.md": "Domestic",

    # Title: "Weekend brunch with friends at LA Brisket" -> Location: "BADMAASH Downtown LA"
    "2023-04-27-weekend-brunch-with-friends-at-la-brisket.md": "LA Brisket",

    # Title: "Sichuan food at Xiang La Hui 香辣汇" -> Location: "BADMAASH Downtown LA"
    "2022-03-07-sichuan-food-川菜-at-xiang-la-hui-香辣汇.md": "Xiang La Hui",

    # Title: "Birria Burritos from Burritos La Palma" -> Location: "BADMAASH Downtown LA"
    "2021-02-07-birria-burritos-from-burritos-la-palma.md": "Burritos La Palma",

    # Title: "Nee Orleans/Creole cuisine in LA" -> Location: "BADMAASH Downtown LA"
    # (Title doesn't name the restaurant clearly - SKIP)

    # Title: "Amazing ceviche at La Guerrerense in Ensenada" -> Location: "BADMAASH Downtown LA"
    "2018-06-25-amazing-ceviche-at-la-guerrerense-in-ensenada.md": "La Guerrerense",

    # Title: "Porchetta Sandwich at A tasty sandwich" -> Location: "The Kroft"
    # (Ambiguous - "A tasty sandwich" might not be the venue name - SKIP)

    # Title: "Beef Dip Sandwich and wedge fries" -> Location: "Pulciano's Deli & Cafe"
    # (Title doesn't name the restaurant - SKIP)

    # Title: "Seolleongtang on a chilly December day" -> Location: "The United Theater On Broadway"
    # (Title doesn't name the restaurant - SKIP)

    # Title: "Haven't been back to OB Bear in over 20 years" -> Location: "Alaska Flight 458 To LAX"
    "2018-03-03-havent-been-back-to-ob-bear-in-over-20-years.md": "OB Bear",

    # Title: "Mundo Cafe & Restaurant" -> Location: "Amélie Restaurant, Bistro & Wine Bar"
    "2009-01-28-mundo-cafe-restaurant.md": "Mundo Cafe & Restaurant",

    # Title: "Bowls and mini Bangs at David Chang's Bāng Bar" -> Location: "The Bar at Eleven Madison Park"
    "2019-05-17-bowls-and-mini-bangs-at-david-changs-bāng-bar.md": "Bāng Bar",

    # Title: "Sliders at Bitez Burger in Sierra Madre" -> Location: "Water Court at California Plaza"
    "2021-10-06-sliders-at-bitez-burger-in-sierra-madre.md": "Bitez Burger",

    # Title: "Barbecue at Mooooooooooo's" -> Location: "Water Court at California Plaza"
    "2025-02-09-barbecue-at-mooooooooooos.md": "Moo's Craft Barbecue",

    # Title: "Cubans sandwich with a refugiado and concha" -> Location: "Inspire Martial Arts & Fitness"
    # (Title doesn't name the restaurant - SKIP)

    # Title: "Lunch at Plate 38" -> Location: "The Lounge At Mi Piace"
    "2019-02-21-lunch-at-plate-38.md": "Plate 38",

    # Title: "Burgers and fish at Stinko 2" -> Location: "The Lounge At Mi Piace"
    "2017-12-01-burgers-and-fish-at-stinko-2.md": "Stinko's",

    # Title: "The 50/50 burgers and the 50/50 pizza burger" -> Location: "The Blind Donkey"
    # (Title doesn't name the restaurant - SKIP)

    # Title: "Had a chance to visit Lou's Café in Westwood" -> Location: "Liu's Cafe"
    # Close match (Liu's vs Lou's) - could be the same place or nearby - SKIP
}


def fix_location_in_file(filepath, new_location):
    """Update location field and remove bad address/coordinates."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace the location field
    content = re.sub(
        r"^location:.*$",
        f"location: {new_location}",
        content,
        count=1,
        flags=re.MULTILINE,
    )

    # Remove address line (it belongs to the wrong venue)
    content = re.sub(
        r"^address:.*\n",
        "",
        content,
        count=1,
        flags=re.MULTILINE,
    )

    # Remove coordinates block (it belongs to the wrong venue)
    content = re.sub(
        r"^coordinates:\n\s+lat:.*\n\s+lng:.*\n",
        "",
        content,
        count=1,
        flags=re.MULTILINE,
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)


def main():
    fixed = 0
    skipped = 0

    for filename, new_location in sorted(FIXES.items()):
        filepath = POSTS_DIR / filename
        if not filepath.exists():
            print(f"SKIP (not found): {filename}")
            skipped += 1
            continue

        fix_location_in_file(filepath, new_location)
        print(f"FIXED: {filename} -> {new_location}")
        fixed += 1

    print(f"\nTotal fixed: {fixed}")
    print(f"Total skipped: {skipped}")


if __name__ == "__main__":
    main()
