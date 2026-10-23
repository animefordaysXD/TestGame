# Text RPG — Handoff

**Repository:** <https://github.com/animefordaysXD/TestGame>

**Last updated:** 2026-10-24  
**Current spec:** `ENGINE_SPEC.md` v0.7  
**Status:** working test page with procedural locations, biome events, a main-character
creator with nine base stats, NPCs with the same stats and personality traits, five
placeholder area actions, and a live node-tree status page.

This file is the starting point for a new AI session. Read it first, then `README.md`
and `ENGINE_SPEC.md`.

## Clone

```sh
git clone https://github.com/animefordaysXD/TestGame.git
cd TestGame
```

The repository root **is** the game project. There is no nested `text-rpg/` folder in the
clone. The unrelated hello-world scaffold from the original local workspace was not
committed.

## Run it

```sh
npm run serve
```

Open <http://127.0.0.1:8765/>. The read-only status tree is at
<http://127.0.0.1:8765/status.html>.

On Windows PowerShell, if `npm.ps1` is blocked, use `npm.cmd run serve` and
`npm.cmd test`. The page must be served over HTTP; biome event JSON is loaded with
`fetch`, and the optional folder mirrors use the File System Access API.

## Test it

```sh
npm test
```

Windows equivalent:

```sh
npm.cmd test
```

Tests currently cover:

- `test/locations.test.cjs` — location generation, uniqueness, reset, save/load.
- `test/locations-disk.test.cjs` — Locations folder mirror using an in-memory mock.
- `test/characters.test.cjs` — NPC base stats, deterministic generation, save/clear,
  reset, legacy saves without stats.
- `test/main-character.test.cjs` — validation, image handling, base stats, effects,
  legacy stamina migration, save/load, reset, folder mirror.
- `test/biome-events.test.cjs` — JSON loading, visit rolls, stat effects, reset,
  save/load.
- `test/actions.test.cjs` — five-action loading, biome overrides, choices, reset,
  save/load.

## Architecture rules

- **Do not edit `engine.js`.** Core is v0.2.
- A module owns exactly one JSON-safe state slice.
- Modules do not import or call each other. Communicate through events.
- UI-fired events are followed by `engine.flush()`. Follow-up events use `depth + 1`.
- `init()` runs again on reset; subscribe and register generators only once.
- Use `engine.rng` or the tick `rng`; never use `Math.random`.
- Put content in data files, not generation logic.
- Update the event catalog and module registry in `ENGINE_SPEC.md` whenever a module or
  event changes. The module and event branches in `status.html` are hand-maintained;
  keep them in sync too.
- Keep State slices JSON-safe. Never cache a slice object; `load()` replaces the state.

## Modules

| module | state slice | current behavior |
|---|---|---|
| `characters` | `nextId`, `named{}`, `temp{}` | NPC generator with base stats; Named NPC / Temporary Spawn |
| `mainCharacter` | `character` | one player character, profile image, base stats, JSON mirror |
| `locations` | `seed`, `createdAt`, `nextId`, `locations{}`, `currentId` | procedural locations, visit rolls, JSON mirror |
| `actions` | `locationId`, `locationName`, `biomeKey`, `actions[]` | five placeholder area actions |

### Main character

- Name, gender, age, optional profile image.
- Uploaded images are centre-cropped to 256 px and stored as WebP/PNG data URLs; a
  missing image gets a generated SVG initials avatar.
- Every character (main and NPC) has the same nine base stats from
  `characters/statsData.js`: HP, Stamina, Mana, War, Diplomacy, Personal Combat, Money
  Management, Intrigue and Intelligence. Resources are HP 0-100, Stamina 0-100 and Mana
  0-50; skills are 1-20. Main starts full/10; NPCs roll their values.
- Stats live in `character.stats`; resources also store `hpMax`, `staminaMax` and
  `manaMax`. Old saves with top-level `stamina` are migrated on load.
- `location:event` effects with `{ stat, delta }` can change any base stat; the module
  emits `mainCharacter:statChanged` at `depth + 1`.
- The UI calls `mainCharacter.save()` directly, then `engine.flush()`.
- `mainCharacter:saved` deliberately omits the image from event data.
- `characters/mainChar/` is a write-only mirror (`main.json` + `profile.<ext>`).

### NPCs and personality

- `characters/data.js` owns names, surnames, ages and the 30-trait pool with opposite
  pairs. Each NPC gets five non-conflicting traits.
- Traits are kept as the personality hook for a future Crusader-Kings-style behaviour
  system. No behaviour rules read them yet.
- `characters/statsData.js` owns the shared stat definitions. Add or tune a stat there;
  both the NPC and main-character modules iterate the list.

### Locations

- Button-driven generation: `location:add` request, then `location:added`.
- Each location has `id`, `name`, `biome`, `biomeKey`, `weather`, `hostility` 1-100,
  `seed`, `createdAtTick`, `createdAt`.
- Map seed is `engine.state.seed >>> 0` with fallback `1`.
- `visit(id)` is async: it sets `currentId`, awaits biome event loading, emits
  `location:visited`, then rolls enabled events and emits `location:event` at
  `depth + 1`.
- Biome event content lives in `locations/events/<biomeKey>/events.json` for all ten
  biomes. Each file has a disabled copy/paste template. `tundra/events.json` has a
  working 10% Snowfall event that costs 10 stamina.
- `loadEvents(force)` fetches and caches events; `eventStatus()` reports load counts and
  errors; the UI has **Reload biome events**.
- `Locations/<map seed>/seed.json` and `loc_XXXX.json` are written when the folder is
  connected. Reconnecting imports unknown `loc_*.json` files.

### Actions

- `actions/data.js` has five default actions: Scout, Scavenge, Rest, Hunt, Travel.
- Optional `LocationActionsData.biomes.<biomeKey>` lists override the default when they
  contain five valid actions.
- The module listens to `location:visited`, replaces the action list, and emits
  `actions:loaded` at `depth + 1`.
- `action:choose` from the UI is handled by `actions`; it emits `action:chosen` at
  `depth + 1`. This is a placeholder: no stat, time, item, reward, travel or other
  effects are applied yet.
- The UI shows an **Actions** panel with the area name, five actions and **Choose**
  buttons. Selecting one updates the panel status and event log.

## Current event flow

```text
UI Visit
  -> locations.visit()
  -> location:visited
  -> actions.loadFor() -> actions:loaded
  -> location:event (if a biome event rolls)
  -> mainCharacter.applyEventEffects() -> mainCharacter:statChanged
  -> engine.flush() from the UI
```

```text
UI Choose action
  -> action:choose
  -> actions.choose() -> action:chosen
  -> engine.flush() from the UI
```

## Recent work

- Added shared base stats for every character: HP, Stamina, Mana, War, Diplomacy,
  Personal Combat, Money Management, Intrigue and Intelligence. `characters/statsData.js`
  is the single content source; main characters start from its defaults, NPCs roll
  ranges with `engine.rng`, and old saves are normalized on load.
- Extended `location:event` effects from stamina-only to any base stat, with resource
  and skill clamping.
- Added stat grids to the game page and status tree; NPC cards now show compact stats.
- Added `test/characters.test.cjs` and updated the main-character/biome-event tests for
  the `character.stats` shape.
- Added `status.html`: a read-only, interactive node tree of the current save
  (world, modules, live slices, content counts, biome event status, event catalog and
  tests). It reads `localStorage` slot `save1`, does not register modules, and can also
  load an exported state JSON file. Supports collapse/expand, drag-pan, zoom, fit-width,
  copy-as-text and SVG export. Linked from the game page.
- Added the per-biome event JSON system and the tundra Snowfall sample.
- Added the `actions` module and five-action Action panel.
- Updated docs to `ENGINE_SPEC.md` v0.7.
- All Node tests pass; browser checks passed for visit rolls, stat loss, five-action
  loading, choosing an action, reset and save/load. No console warnings or errors.

## Known limitations and quirks

- Area actions are placeholders. **Travel** does not move the party.
- Base stats are stored and location events can change them, but no progression,
  training, equipment, checks or opposed rolls use them yet.
- NPC personality traits are generated but do not weight behaviour yet.
- Biome events have no cooldowns, once-only flags, weather filters or requirements.
  Every enabled event is an independent roll on each visit.
- `location:changed` still only clears Temporary Spawn; there is no travel graph,
  coordinates or location connections.
- The real OS folder pickers are untested in a browser. The disk tests use an in-memory
  File System Access API mock. Chrome/Edge is required.
- `mainChar/` is a write mirror, not an import source. `localStorage` or the in-game load
  button remains the way back into a session.
- On Windows, `Locations/` and `locations/` are the same case-insensitive directory.
  The mirror therefore writes seed folders inside the module folder on Windows. This is
  a known platform quirk; do not add a broad `Locations/` ignore rule without checking
  case-sensitivity.
- The test page stores saves in `localStorage` slot `save1`, which some contexts block.
  `status.html` reads only that slot or a manually loaded state JSON file.
- Folder connections (`mainChar/`, `Locations/`) are runtime handles and are not in the
  save, so the status tree cannot report whether they are connected.
- The local test server may not be running in a new session. Start it with
  `npm run serve`.

## Suggested next steps

1. Give actions real placeholder-to-playable outcomes, starting with stat/time costs
   and an `action:resolved` event.
2. Make **Travel** use the locations module instead of being a placeholder action.
3. Add per-biome action overrides and test them in the UI.
4. Add event conditions (weather, time, once/cooldown) to the biome event schema.
5. Use the new stats in checks or opposed rolls, and decide how they progress.
6. Add a travel graph/connections between locations.
7. Manually verify both real folder pickers in Chrome/Edge.

## Quick prompt for a new AI

```text
Continue the modular text-RPG in this repository. Read HANDOFF.md, README.md and
ENGINE_SPEC.md first, then run the tests with npm test (Windows: npm.cmd test).

Do not edit engine.js (core v0.2). Keep every module's state slice JSON-safe and make
modules communicate only through events. UI events must be followed by engine.flush();
follow-up events use depth + 1. init() reruns on reset, so subscribe/register only once.
Use engine.rng or the tick rng, never Math.random. Put content in data files. Update the
event catalog and module registry in ENGINE_SPEC.md for every module or event change.

Current state: locations, biome events, main-character and NPC base stats, personality
traits and five placeholder area actions are working. Start by asking what feature to
build next; do not add unrequested scope.
```
