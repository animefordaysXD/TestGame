# Modular Text-RPG Engine

**Repository:** <https://github.com/animefordaysXD/TestGame>

> **New AI session? Start with [HANDOFF.md](HANDOFF.md).** It summarizes the current
> state, architecture rules, tests, known limitations and next steps. For a per-module
> map and "where do I change this?" guide, use [MODULES.md](MODULES.md). For what the
> game is and why, read [DESIGN.md](DESIGN.md); unapproved ideas live in
> [IDEAS.md](IDEAS.md).

Current build: core v0.2, characters v0.3, main character v0.5, equipment v0.1,
locations v0.2, actions v0.2, travel v0.1, combat v0.1, plus the read-only status viewer.

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
`node test/biome-events.test.cjs`, `node test/actions.test.cjs`,
`node test/equipment.test.cjs`, `node test/travel.test.cjs`, and
`node test/combat.test.cjs`.

## Layout

- `engine.js` — core (unchanged v0.2)
- `characters/` — NPC generator, shared base stats, main character creator and storage
- `equipment/` — armor catalogue and main-character inventory (equip/unequip)
- `combat/` — basic player-first duels (Attack/Defend)
- `locations/` — procedural map locations
- `locations/events/` — per-biome event JSON (copy/paste templates and the tundra sample)
- `actions/` — five area actions with costs/outcomes and optional biome overrides
- `travel/` — timed journeys with 5-minute interruption checks and pause/resume
- `Locations/` — JSON mirror folder (written after connecting it in the page)
- `status.html` — read-only node-tree viewer for the current game state
- `DESIGN.md` — what the game is and why: vision, pillars, decisions, roadmap
- `IDEAS.md` — running idea list; decisions graduate to `DESIGN.md`
- `ENGINE_SPEC.md` — current engine contract and event catalog
- `MODULES.md` — living per-module handbook: role, code map, events, adjustment guide
- `HANDOFF.md` — session handoff and continuation notes

## Status tree

Open `/status.html` for an interactive node tree of the current session. It reads the
same `localStorage` slot (`save1`) as the game and shows:

- the world clock, seed and event-log size;
- every module and its live state slice: NPCs with personality traits and stats, the
  main character with HP/Stamina/Mana, armor and skills, the equipment inventory, the
  current combat and its log, locations with the current marker, the five loaded
  actions plus the last resolution, and the current journey with its checks and last
  interruption;
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
- Location events, resolved area actions and travel interruptions can change any
  non-equipment base stat; the current values are saved with the character. Armor is
  written by the equipment module and is ignored by event/action/travel effects. The
  main-character panel shows all stats in a grid, and each NPC card shows a compact stat
  line.
- The main character is separate from the generated NPCs in Named NPC / Temporary Spawn.
  NPCs keep their five personality traits; those will feed a future behaviour system.

## Combat

- Each Temporary Spawn and Named NPC card has a **Fight** button. Save a main character
  first.
- The player always moves first. **Attack** deals damage based on the attacker's
  Personal Combat; a surviving enemy immediately counterattacks.
- **Defend** braces for the next attack. The formula is
  `max(0, damage - armor * 2)`. Armor comes from equipped equipment; with no armor,
  Defend blocks nothing.
- `combat:damage` lowers the real main/NPC HP; 0 HP ends the duel. A lethal player hit
  skips the enemy counterattack.
- The enemy always attacks in this basic version. There is no flee, initiative, hit
  chance or damage variance yet.
- Tuning lives in `combat/data.js`; the turn flow and events are documented in
  `combat/README.md` and `ENGINE_SPEC.md`.

## Equipment

- **Find armor** adds a random item from `equipment/data.js`; the first item is equipped
  automatically. Each item has **Equip** / **Unequip**.
- Armor is written into the main character's Armor stat and used by combat's Defend
  action (`armor × 2` damage blocked). The panel shows the equipped item and total armor.
- Scavenging can also award armor through an action outcome.
- The catalogue (name, slot, armor, weight) lives in `equipment/data.js`. Only the main
  character can equip in this version; NPCs still have armor 0.
- See `equipment/README.md`.

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

- Visiting a location loads five actions in the **Actions** panel.
- The default actions are Scout, Scavenge, Rest, Hunt and Travel. Each has a time cost,
  stat costs and one weighted outcome; the last resolution is shown in the panel.
- Choosing an action emits `action:chosen` then `action:resolved`. The main-character
  module applies the effects, equipment can award an item, and the UI advances the clock
  by the action's `timeMinutes`.
- **Travel** shows a destination dropdown. A destination is required; choosing it costs
  stamina and starts a timed journey. Arrival visits the destination through the
  locations module, reloads its actions and rolls its biome events.
- Edit `actions/data.js` to change the default list, outcomes or add a biome-specific
  list under `biomes.<biomeKey>`.
- See `actions/README.md` for the full action shape and override example.

## Travel

- Travel spends the action's `timeMinutes` in 5-minute checks. The clock advances once
  per check; the panel shows elapsed time and how many checks have run.
- After each check the journey rolls for an interruption. The chance is 6-10% per check
  depending on the destination biome, with an 8% fallback in `travel/data.js`.
- An interruption pauses the journey and applies its stat effects. Read the event, then
  press **Continue travel** to resume the remaining checks.
- A journey can be abandoned with **Cancel journey**. Time, stamina and effects already
  spent are not refunded.
- On arrival, the locations module visits the destination and rolls its biome events as
  usual. The travel event catalogue is separate from biome events.
- Tune checks, chances, event text and effects in `travel/data.js`. See
  `travel/README.md`.
