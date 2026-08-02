# Mentors Page + Nav Update — Ready to Deploy

I worked directly against your live repo (cloned from
github.com/baniyoluigi-creator/boystomencamp.com), so everything here matches
your real header, footer, and CSS exactly. Nothing has been pushed to GitHub —
I don't have write access to your repo, so you'll need to add these files
yourself.

## What changed (22 pages + mentors.html rebuilt)

1. **Nav update, every page**: "Intakes" dropdown removed from the top nav.
   "Mentors" added as the first link right after "Apply Now", so it's the
   first thing visitors see. Footer links untouched (still has the full
   Intakes column for anyone who wants deep links).
2. **mentors.html rebuilt from scratch** with all 12 mentors from your
   Mentor Profiles document: photo, title, and bio. Each bio shows about
   5 lines by default, with a "Read full profile" button that expands it in
   place and reveals "Next mentor" / "Back to all mentors" links so a visitor
   can move straight through all 12 without hunting. Full bio text sits in
   the HTML at all times (not loaded by JS), with Person/ItemList structured
   data for SEO.
3. **apply.html**: added a collapsible "Read more: Age clusters, all
   regions, and past intakes" panel, pulling in the age-band table and
   region links that used to live only on the standalone Intakes page. Your
   existing Kampala/Arua/Summer Camp fee cards are untouched.

## How to deploy

### 1. Copy these files into your repo, overwriting the originals
All 22 changed `.html` files are in this folder, flat, matching your repo's
flat structure. Copy them straight over the top of your existing files.

### 2. Add the two new mentor photos
`mentor-daniel-dratibi-drileba.jpg` and `mentor-benard-alamiga-oku.jpg` are
included, cropped and resized from what you sent. Drop both into your repo
root (same level as `founder-banio.jpg`).

### 3. Add the remaining 10 mentor photos
The other 10 mentors are showing a placeholder initials badge until you add
their photos. Save each one from your Google Drive Graphics folder into your
repo root using these **exact filenames**:

| Mentor | Filename needed |
|---|---|
| Banio Luiji Nobert | already live as `founder-banio.jpg` (reused, no action needed) |
| Alionzi Lawrence Dangote | `mentor-alionzi-dangote.jpg` |
| Dr. Joel Jaffer A'ita | `mentor-joel-aita.jpg` |
| Omia Razak Iganaci | `mentor-omia-razak.jpg` |
| Daniel Choudry | `mentor-daniel-choudry.jpg` |
| Thomas Malunda | `mentor-thomas-malunda.jpg` |
| Vincent Matsiko | `mentor-vincent-matsiko.jpg` |
| Nathan Odeke | `mentor-nathan-odeke.jpg` |
| Dr. Lawrence Okidi | `mentor-lawrence-okidi.jpg` |
| Gala Winfred | `mentor-gala-winfred.jpg` |

The page is built to fail gracefully: if a photo is missing it just shows the
initials badge, so you can add these gradually without anything looking
broken in the meantime.

### 4. Commit and push
```
git add .
git commit -m "Add Mentors page, promote Mentors in nav, fold intake details into Apply page"
git push
```

Alternatively, `boystomencamp-changes.patch` (in the parent folder) is a
git patch of the exact same change. If you're comfortable with git, you can
apply it directly instead of copying files by hand:
```
git apply boystomencamp-changes.patch
```

## Notes
- `intakes.html` and the individual `intake-*.html` pages are untouched and
  still live at their URLs (still linked from your footer, and now also
  linked from the new read-more panel on Apply). They're just no longer in
  the top nav dropdown.
- No em dashes were introduced anywhere in this content, per your standing
  style rule.
- Age range on the apply.html summary line follows your 23–8 (oldest first)
  convention.
