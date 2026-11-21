[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/TheActualLux/trophy-atlas-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/TheActualLux/trophy-atlas-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

# Trophy Atlas — Grand Theft Auto VI

Trophy Atlas is a static, offline-friendly route planner and trophy dossier for the 55-entry Grand Theft Auto VI trophy list supplied with this project’s kit. It pairs an eight-phase platinum route with an individually expandable dossier for every trophy. Official names, descriptions, and grades are kept distinct from the original route advice and editorial time and difficulty estimates.

## Features

- Eight route phases, each with an objective, an explanation of the ordering, its trophy chips, progress bar, and combined estimated hours.
- Searchable trophy list that matches names, official descriptions, and guide text, with highlighted matches, grade and tag filters, sorting, and inline dossier expansion.
- Individual dossiers with grade, tags, 1–5 difficulty, time estimate, missable note, numbered steps, a multi-sentence guide, spoiler-gated hint, prerequisites, verification, sources, and previous/next links.
- Browser-local checklist ticks, progress export/import, and a confirmation before resetting.
- Hash routes for `#route`, `#trophies`, and `#t<ID>`; `?expand=<ID>` opens a dossier. Browser back/forward follows route changes.
- Keyboard shortcuts: `/` focuses search, `S` switches spoiler hints, `J`/`K` move the trophy selection, `Enter` opens the selected dossier, and `Escape` clears search or returns from a dossier.

The interface uses plain HTML, CSS, and ES modules. It has no runtime library, build step, network request, webfont, or image dependency. Checklist state is stored in this browser’s localStorage.

## Run locally

From the repository root, start the included static server on port 8094:

```sh
node serve.ts --port 8094
```

Open `http://127.0.0.1:8094/`. The server serves `app/` directly; the app loads its local data file with a relative URL.

## Validate and package

Node 22 or newer runs the TypeScript entry point directly using Node’s built-in type stripping. The packager validates the 55 trophy dossiers, eight route phases, and three-to-four screenshot evidence files (each at most 262,144 bytes), copies `app/` and `screenshots/`, and asks the vendored `buildDossier` function to write `dossier.json`.

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

If `MAKEFUN_OUTPUT_DIR` is omitted, output is written to `out/` in the project directory.

## Data and estimates

The official identity fields—name, description, and grade—are taken character for character from `../cover-kit/gta6-trophy-guide-01-kit/starter/app/data/trophies.json`. Route phases, objectives, order notes, guide steps, hints, estimated hours, and difficulty ratings are guide-authored planning material, not official claims. For triggers that the supplied official wording does not establish, the dossier says to consult the in-game trophy details or tracker rather than presenting a guess as verified fact.
