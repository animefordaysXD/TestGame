# Modular Text-RPG Engine

**Repository:** <https://github.com/animefordaysXD/TestGame>

> **New AI session? Start with [HANDOFF.md](HANDOFF.md).** It summarizes the current
> state, architecture rules, tests, known limitations and next steps.

Current build: core v0.2, characters v0.3, main character v0.4, combat v0.1,
locations v0.2, actions v0.1, plus the read-only status viewer.

## Run

The page needs to be served over HTTP because the optional folder mirror uses the File
System Access API (Chrome/Edge), and `localStorage` can be blocked on `file://`.

From the repository root:

```sh
npm run serve
```

Then open <http://127.0.0.1:8765/>. The live status tree is at
<http://127.0.0.1:8765/status.html>.

## Test

From the repository root:

```sh
npm test
```

The tests run in Node only. The disk-mirror test uses an in-memory mock of the File
System Access API; it does not prove the real browser folder picker works.

On Windows, if PowerShell blocks `npm.ps1`, use `npm.cmd test` or run the test files
directly with `node test/locations.test.cjs`, `node test/locations-disk.test.cjs`,
`node test/characters.test.cjs`, `node test/main-character.test.cjs`,
`node test/biome-events.test.cjs`, `node test/actions.test.cjs`, and
`node test/combat.test.cjs`.

## Layout

- `engine.js` — core (unchanged v0.2)
- `characters/` — NPC generator, shared base stats, main character creator and storage
- `combat/` — basic player-first duels (Attack/Defend)
- `locations/` — procedural map locations
- `locations/events/` — per-biome event JSON (copy/paste templates and the tundra sample)
- `actions/` — five placeholder area actions and optional biome overrides
- `Locations/` — JSON mirror folder (written after connecting it in the page)
- `status.html` — read-only node-tree viewer for the current game state
- `ENGINE_SPEC.md` — current engine contract and event catalog
- `HANDOFF.md` — session handoff and continuation notes

## Status tree

Open `/status.html` for an interactive node tree of the current session. It reads the
same `localStorage` slot (`save1`) as the game and shows:

- the world clock, seed and event-log size;
- every module and its live state slice: NPCs with personality traits and stats, the
  main character with HP/Stamina/Mana, armor and skills, the current combat and its log,
  locations with the current marker, and the five loaded actions;
- content data counts and the enabled/total events in each biome file;
- the event catalog and the Node test files.

The page is a viewer only: it does not register modules, change the save or touch game
logic. Nodes expand/collapse on click, the canvas can be dragged, and the toolbar has
zoom, fit-width, copy-as-text and SVG download. Use **Load state JSON** to inspect a
saved state file, or **Reload save** after saving in the game. Folder connections are
runtime-only and are not stored in the save, so the tree cannot show them.

## Main character

- Enter a name, choose a gender, set an age, and pick an image for the profile picture.
- **Save main character** stores the character in the game state (and therefore in
  the normal Save/Load slot).
- Uploaded images are centre-cropped to a square, resized to 256 px, and stored as a
  WebP/PNG data URL. If no image is picked, an initials avatar is generated as SVG.
- **Connect mainChar folder** writes `characters/mainChar/main.json` and a viewable
  `profile.webp`/`.png`/`.svg` file. Later saves rewrite both. Folder access needs
  Chrome or Edge.
- The main character and every NPC share nine base stats from
  `characters/statsData.js`: HP, Stamina, Mana, War, Diplomacy, Personal Combat, Money
  Management, Intrigue and Intelligence, plus an `armor` equipment stat. HP/Stamina/Mana
  are resources; the skills are 1-20; armor is 0-100 and starts at 0. The main character
  starts at 100/100 HP, 100/100 Stamina, 50/50 Mana, 0 armor and 10 in each skill. NPCs
  roll their values.
- Location events can change any non-equipment base stat; the current values are saved
  with the character. Armor is reserved for equipment and is ignored by location events.
  The main-character panel shows all stats in a grid, and each NPC card shows a compact
  stat line.
- The main character is separate from the generated NPCs in Named NPC / Temporary Spawn.
  NPCs keep their five personality traits; those will feed a future behaviour system.

## Combat

- Each Temporary Spawn and Named NPC card has a **Fight** button. Save a main character
  first.
- The player always moves first. **Attack** deals damage based on the attacker's
  Personal Combat; a surviving enemy immediately counterattacks.
- **Defend** braces for the next attack. The provisional formula is
  `max(0, damage - armor * 2)`. Armor is 0 for everyone until equipment is added, so
  Defend currently blocks nothing.
- `combat:damage` lowers the real main/NPC HP; 0 HP ends the duel. A lethal player hit
  skips the enemy counterattack.
- The enemy always attacks in this basic version. There is no flee, initiative, hit
  chance or damage variance yet.
- Tuning lives in `combat/data.js`; the turn flow and events are documented in
  `combat/README.md` and `ENGINE_SPEC.md`.

## Locations module

- **Add location** creates one location.
- **Add 5 locations** creates a starting batch.
- Every location has `weather`, `biome` and `hostility` (integer 1-100).
- **Visit** sets the current location and rolls every enabled event for its biome.
- **JSON** downloads one location as a JSON file.
- **Connect Locations folder** writes `Locations/<map seed>/seed.json` and one
  `loc_XXXX.json` per location. Reconnecting imports unknown hand-edited `loc_*.json`
  files from the current seed folder. The game state remains the source of truth.
- Content tables (biomes, weather, names, hostility ranges) live in `locations/data.js`.
  Generation order and extra attributes live in `locations/locations.js`.

## Biome events

- Each biome has `locations/events/<biomeKey>/events.json`.
- Every enabled event rolls its own `chancePercent` (0-100) on a visit. Multiple events
  can trigger on the same visit.
- `enabled: false` marks a copy/paste template; change it to `true` and edit the text.
- The tundra file includes a working **Snowfall** event: 10% chance, -10 stamina.
- Effects support any base stat (`hp`, `stamina`, `mana`, `war`, `diplomacy`,
  `personalCombat`, `moneyManagement`, `intrigue`, `intelligence`); unknown stats are
  kept in the event data for future modules.
- Use **Reload biome events** after editing a JSON file, or refresh the page. Event
  loading uses `fetch`, so serve the project over HTTP.
- Full schema and a copy/paste template: `locations/events/README.md`.

## Area actions

- Visiting a location loads five placeholder actions in the **Actions** panel.
- The default actions are Scout, Scavenge, Rest, Hunt and Travel.
- Every **Choose** button logs `action:chosen`; no stat, time, item or travel effects
  are applied yet.
- Edit `actions/data.js` to change the default list or add a biome-specific list under
  `biomes.<biomeKey>`.
- See `actions/README.md` for the action shape and override example.
