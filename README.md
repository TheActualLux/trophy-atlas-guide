[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/TheActualLux/trophy-atlas-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/TheActualLux/trophy-atlas-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

# Leonida Trophy Atlas

A static, offline-first GTA VI trophy guide for planning a PlayStation 5 platinum run. Eight route phases organize the official 55-trophy list into manageable sessions; each trophy also has a dossier with practical steps, a note about uncertainty, and a source trail. Difficulty and time are editorial estimates, not official measurements.

## Use the guide

Serve the `app/` directory with any static HTTP server. From the project directory, the included Node server can be started on port 8094:

```sh
node serve.ts --port 8094
```

Open `http://127.0.0.1:8094/`. The app loads its data with a relative URL and needs no compilation, third-party package, external request, webfont, or image asset.

Choose **Route** to work through the eight ordered phases. Each phase has a goal, an explanation for its placement, tickable trophy chips, a progress meter, and a combined hour estimate. Choose **Trophies** to search names, official descriptions, and guide text; use grade and tag filters, sorting, and inline dossier expansion. A dossier also opens at `?expand=7` or `#t7`, and its previous/next links use hash navigation.

Ticks are kept in this browser’s localStorage. Use Export and Import to move a progress file, or Reset to clear ticks after confirmation. Hints are hidden until Spoilers is enabled. Keyboard controls: `/` focuses search, `S` toggles spoilers, `J` and `K` move through the filtered list, Enter opens the selected trophy, and Escape clears search or leaves a dossier.

## Package check

With Node 22 or newer, run the Node-standard-library packager directly:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

It validates the trophy data and screenshot limits, copies `app/` and `screenshots/`, and writes `dossier.json` only through the vendored `buildDossier` function. The default destination is `out/`.

## Editorial boundary

The trophy names, descriptions, and grades are copied from the supplied kit list. The route order and all guide text are original advice. Since the game has not released, uncertain mechanics and missability are identified as unverified; check the in-game objective and trophy tracker when available rather than treating an estimate as confirmed fact.
