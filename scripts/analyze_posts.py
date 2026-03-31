import os, re

posts_dir = 'src/content/posts'
titles_venue_city = 0
titles_other = 0
tag_counts = {}
cat_counts = {}
has_location = 0
has_city = 0
has_cuisine = 0
total = 0
sample_titles_other = []
sample_titles_good = []

for f in sorted(os.listdir(posts_dir)):
    if not f.endswith('.md'):
        continue
    total += 1
    with open(os.path.join(posts_dir, f), 'r') as fh:
        content = fh.read()
    m = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not m:
        continue
    fm_text = m.group(1)

    # Parse title
    tm = re.search(r"^title:\s*['\"]?(.*?)['\"]?\s*$", fm_text, re.MULTILINE)
    title = tm.group(1).strip() if tm else ''

    # Check if Venue, City format
    if ',' in title:
        after_comma = title.split(',')[-1].strip()
        if after_comma and after_comma[0].isupper():
            titles_venue_city += 1
            if len(sample_titles_good) < 8:
                sample_titles_good.append(title)
        else:
            titles_other += 1
            if len(sample_titles_other) < 15:
                sample_titles_other.append(title)
    else:
        titles_other += 1
        if len(sample_titles_other) < 15:
            sample_titles_other.append(title)

    if re.search(r'^location:', fm_text, re.MULTILINE):
        has_location += 1
    if re.search(r'^city:', fm_text, re.MULTILINE):
        has_city += 1

    # cuisine
    cm = re.search(r'^cuisine:\s*\n((?:\s+-\s+.*\n)*)', fm_text, re.MULTILINE)
    if cm and cm.group(1).strip():
        has_cuisine += 1

    # tags
    tm2 = re.search(r'^tags:\s*\n((?:\s+-\s+.*\n)*)', fm_text, re.MULTILINE)
    if tm2:
        for tag in re.findall(r'^\s+-\s+(.*)', tm2.group(1), re.MULTILINE):
            t = tag.strip().strip("'\"")
            tag_counts[t] = tag_counts.get(t, 0) + 1

    # categories
    cm2 = re.search(r'^categories:\s*\n((?:\s+-\s+.*\n)*)', fm_text, re.MULTILINE)
    if cm2:
        for cat in re.findall(r'^\s+-\s+(.*)', cm2.group(1), re.MULTILINE):
            c = cat.strip().strip("'\"")
            cat_counts[c] = cat_counts.get(c, 0) + 1

print(f'Total posts: {total}')
print(f'Titles already ~Venue, City format: {titles_venue_city}')
print(f'Titles needing rework: {titles_other}')
print(f'Has location field: {has_location}')
print(f'Has city field: {has_city}')
print(f'Has cuisine field: {has_cuisine}')
print()
print('=== Sample GOOD titles (Venue, City) ===')
for t in sample_titles_good:
    print(f'  {t}')
print()
print('=== Sample titles needing rework ===')
for t in sample_titles_other:
    print(f'  {t}')
print()
print('=== Top 30 Categories (to be cleaned) ===')
for k, v in sorted(cat_counts.items(), key=lambda x: -x[1])[:30]:
    print(f'  {v:4d}  {k}')
print()
print('=== Top 30 Tags (to be replaced) ===')
for k, v in sorted(tag_counts.items(), key=lambda x: -x[1])[:30]:
    print(f'  {v:4d}  {k}')
print()
print(f'Total unique tags: {len(tag_counts)}')
print(f'Total unique categories: {len(cat_counts)}')
