# Trophy Atlas — GTA VI Platinum Guide (PS5)

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/TheActualLux/trophy-atlas-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/TheActualLux/trophy-atlas-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

**Trophy Atlas** is a polished, responsive single-page platinum guide for Grand Theft Auto VI on
PlayStation 5, covering all 55 official trophies. It opens with a live scoreboard — earned count,
percent to platinum and a grade-segmented progress bar — and an ordered platinum roadmap in eight
phases, each naming the trophies it includes and a rough (explicitly unverified) time estimate.
Every trophy row expands into an authored field guide: multi-sentence walkthrough framing, a
spoiler-gated spoiler-free hint, a 1–5 difficulty rating, a time estimate and an honest missability
note. Guide copy is written only from the official trophy list; anything beyond it is labeled as an
estimate, not a verified fact.

## Using the guide

- **Track progress:** tick trophies as you earn them; ticks persist in `localStorage`.
- **Find and filter:** search (press `/`), filter by grade, toggle the *missable*,
  *collectible* and *story-critical* tag filters, and sort by ID, grade or name.
- **Spoilers:** hints are hidden by default; reveal a hint per trophy or press `s` to flip the
  global spoiler setting. `Escape` clears the search box.
- **Deep links:** every trophy has a hash anchor (`#t7` opens and expands trophy 7).
- **Back up progress:** *Export* writes your ticks as JSON; *Import* restores them (strictly
  validated); *Reset* clears everything.

## Running it

No build step, no dependencies, no network. Static files only:

```sh
node serve.ts            # serves app/ on http://localhost:8080
node serve.ts --port 8094
```

To hand the entry in the way the grader expects:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` preflights `app/data/trophies.json` (valid JSON, every record carrying
id/name/grade/guide with at least three sentences) and the screenshots (at most 4 images, each at
most 256 KiB) before copying anything, then copies `app/` and `screenshots/` to the output
directory and writes `dossier.json` through the vendored make.fun library.

## Files

- `app/index.html`, `app/style.css`, `app/app.js` — the guide itself (plain static files).
- `app/data/trophies.json` — the 55 official trophies plus authored guide text, hints, tags,
  difficulty, time estimates, roadmap phases and missability notes.
- `screenshots/` — three captured views of the running guide.
- `main.ts` — the submission entrypoint (Node standard library only).
