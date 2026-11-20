[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/TheActualLux/trophy-atlas-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/TheActualLux/trophy-atlas-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

# Trophy Atlas — a Grand Theft Auto VI trophy guide for the PS5 platinum

Trophy Atlas is a plain, static trophy guide built around two ideas: a **route** that walks the
fifty-five trophies phase by phase, and a **dossier** that documents every individual trophy.
It ships as three hand-written files (HTML, CSS, JavaScript), a trophy data file, and a small
packaging script. There are no libraries, no build step, no network calls, no webfonts and no
images in the interface itself.

## What the atlas does

- **Top bar progress** — earned count out of 55, progress bars segmented by grade, and an
  estimate of remaining hours recalculated from your own ticks.
- **Route view** — eight phase cards in a deliberate order: story first, then street work,
  stranger strands, activities, and the long collection tail. Each card carries a one-line
  objective, the reasoning behind its place in the route, per-phase progress, an estimated
  hour cost, and tickable chips for every trophy in it.
- **Trophy dossier** — open any trophy through its route chip, the trophies list, `#t<id>`
  in the URL, or `?expand=<id>`. Each dossier records the official name, description and
  grade, plus difficulty dots, an estimated time in hours and minutes, a missable warning
  where the scenario warrants one, a numbered step list, a guide paragraph, a spoiler-free
  hint (revealed by the Spoilers switch), prerequisites, how to verify the unlock, links to
  the previous and next trophies, and a jump back to the owning phase.
- **Trophies view** — searchable across names, descriptions and guide text with highlighted
  matches, filterable by grade and by missable / collectible / story-critical / online tags,
  sortable by id, grade, name or difficulty.
- **Local progress** — ticks persist in `localStorage`, export and import as JSON, and a
  reset button that asks before it deletes.
- **Keyboard** — `/` jumps to search, `Escape` clears or closes, `s` toggles the Spoilers
  switch, `j`/`k` move through the trophies list, `Enter` opens the selected trophy.
- **Routing** — `#route`, `#trophies` and `#t<id>` are real hash routes, so browser back and
  forward behave the way you expect.

## Running it

Any static file server pointed at `app/` works. The repository includes a tiny one:

```
node serve.ts --port 8080
```

To package the guide (validates the trophy data first, then copies `app/` and `screenshots/`
into the output directory and writes a `dossier.json` summary):

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Both scripts use only Node built-ins and were written against Node 22+.

## Data honesty

The trophy list — ids, names, descriptions and grades — is the official 55-trophy list and is
preserved verbatim in `app/data/trophies.json`. Everything around it is original guide writing
for this atlas: the phase order, step lists, hour estimates, difficulty ratings, prerequisite
graph and scenario interpretations. Where the official wording does not settle a question
(replay behavior, exact counts, trigger details), the guide says so instead of guessing, and
the in-game trackers are treated as the only authority on counts.

## Files

- `app/index.html`, `app/style.css`, `app/app.js` — the atlas itself
- `app/data/trophies.json` — the official list plus the guide layer
- `main.ts` — validation and packaging entry point
- `serve.ts` — minimal development static server
- `screenshots/` — reference captures of the interface
