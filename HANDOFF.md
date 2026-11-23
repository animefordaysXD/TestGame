# Text RPG — Handoff

**Repository:** <https://github.com/animefordaysXD/TestGame>

**Last updated:** 2026-11-23
**Current spec:** `ENGINE_SPEC.md` v1.10
**Status:** working test page with a data-driven character creator (background, origin and
focus choose starting stats and equipment), a static authored world map (twelve sites,
thirteen routes) plus procedural landmark interiors generated on first visit, a travel graph
of connected locations, procedural locations with hostility and levels, hostility-modified
biome events, hostility-driven encounters and loot, a main character with ten base
stats plus armor and a ten-part body, NPCs with the same stats, bodies, 30 named personality
archetypes, relations and levels, basic player-first combat (Attack/Defend), an equipment
module with body-part armor plus a weapon slot (damage, Strength requirement, armor piercing),
weapon/armor types and five rarity tiers, five area actions with costs/outcomes/time,
route-based timed travel with 5-minute event checks and pause/resume, real JSON save files
(seed + baseline + changes) alongside the quick local save, and a live node-tree status page.

This file is the starting point for a new AI session. Read it first, then `README.md`,
`DESIGN.md` (what the game is and why), `ENGINE_SPEC.md` and `MODULES.md` (the per-module
map and adjustment guide). `IDEAS.md` is the running list of ideas that are not decisions.

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

- `test/locations.test.cjs` — location generation, uniqueness, bidirectional routes,
  graph invariants, legacy graph repair, reset, save/load.
- `test/locations-disk.test.cjs` — Locations folder mirror using an in-memory mock.
- `test/map.test.cjs` — static sites and authored routes, idempotent `map:load`,
  `map:generated`, procedural landmark interiors, seed determinism, save/load and reset.
- `test/characters.test.cjs` — 30 personality archetypes (unique ids/names, five valid
  non-opposite traits, 0-100 behavior axes), NPC base stats, relations/levels,
  deterministic generation, save/clear, reset, legacy saves without stats or
  personality/behavior/relation/level.
- `test/relations.test.cjs` — relation bands and labels, type-specific high labels,
  clamping, `setRelation`/`adjustRelation` events, level clamping, spawn metadata,
  source-filtered clearing, legacy relation/level migration.
- `test/main-character.test.cjs` — validation, image handling, base stats, effects,
  legacy stamina migration, save/load, reset, folder mirror.
- `test/creator.test.cjs` — background/origin/focus stats and kits, preview without state,
  profile validation, event order, profile edits, save/load and reset.
- `test/biome-events.test.cjs` — JSON loading, visit rolls, hostility-modified chances,
  stat effects, reset, save/load.
- `test/actions.test.cjs` — five-action loading, biome overrides, weighted outcomes,
  stat costs, time, route time/distance override, travel through locations, equipment
  rewards, reset, save/load.
- `test/equipment.test.cjs` — body-part inventory, free-slot auto-equip, overlap replacement,
  summed armor, the weapon slot, type/rarity/kind filtered finds, destruction, the armor
  bridge,
  combat integration, reset, save/load and v0.1 migration.
- `test/travel.test.cjs` — 5-minute checks, event pause/resume, effects, distance
  persistence, duration rounding, cancel, reset, save/load.
- `test/combat.test.cjs` — player-first turns, attack damage, weapon damage and armor
  piercing, Strength gating, defend/armor, lethal hits, invalid actions, reset, save/load.
- `test/encounters.test.cjs` — hostility spawn bands, relation/level scaling, source-tagged
  clearing, winning vs losing loot, drop chance/rarity bands, reset, save/load.
- `test/save.test.cjs` — capture, exact restore, JSON round-trip, legacy v0 migration,
  newer-format refusal, unsafe paths, `applyChanges`.
- `test/editor.test.cjs` — editor formatter stability, byte-identical round-trips of every
  content file, schema validation/previews, and global uniqueness of action outcome ids.

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
- **Update `MODULES.md` in the same change whenever a module changes.** It is the
  practical map (role, code map, events, adjustment table) and the update log. Add a
  row to its update log, and keep it consistent with the code, the spec and status.
- **`DESIGN.md` is the product source of truth.** Check a request against its pillars and
  decisions before building. Record new decisions there, and in `IDEAS.md` when an idea
  arrives. Do not present a **Proposed** item as decided.
- Keep State slices JSON-safe. Never cache a slice object; `load()` replaces the state.
- **Save files:** register every module in `buildEngine(opts)` in `index.html`. The same factory
  builds the live world and the fresh baseline for `GameSave.capture()` / `restore()`; a missing
  module makes exported saves incomplete and imports lossy.

## Git workflow

- Work on `main`; commit only when the user asks.
- Do not push without explicit approval. If a push is needed for another session or a
  GitHub-based handoff, ask first.

## Modules

| module | state slice | current behavior |
|---|---|---|
| `characters` | `nextId`, `named{}`, `temp{}` | NPC generator with personality, behavior, relation, level and base stats; Named NPC / Temporary Spawn |
| `mainCharacter` | `character` | one player character, profile image, base stats, optional starting-build metadata, JSON mirror |
| `creator` | `lastCreated` | data-driven background/origin/focus choices that set starting stats and equipment |
| `equipment` | `nextId`, `items{}`, `equippedByPart{}`, `equippedWeaponId` | main-character armor on body parts plus one weapon slot; rarity tiers; sums worn armor into the character stat |
| `combat` | `active`, `round`, `turn`, `player`, `enemy`, `defending`, `winner*`, `log[]` | basic player-first duels; weapon damage, Strength gating and armor piercing; Attack/Defend |
| `locations` | `seed`, `createdAt`, `nextId`, `locations{}` (with `connections[]`), `currentId` | procedural locations with hostility/level, travel graph, visit rolls, JSON mirror |
| `encounters` | `enemies{}`, `lastVisit`, `lastLoot` | hostility-scaled hostile spawns on visit and hostility-scaled loot on a winning fight |
| `map` | `version`, `loaded`, `seed`, `total`, `lastGeneratedTick`, `lastGeneratedAt`, `sites{}`, `landmarks{}`, `terrain{}` | static authored world: loads sites/routes once and generates procedural landmark interiors on first visit |
| `actions` | `locationId`, `locationName`, `biomeKey`, `actions[]`, `lastAction` | five area actions with costs, outcomes, time and route-aware Travel |
| `travel` | `active`, `paused`, `distance`, route, `elapsedMinutes`, `durationMinutes`, `checks`, `eventCount`, `lastEvent`, `lastCompleted` | 5-minute journey checks, event pause/resume, arrival handoff |

`save/gameSave.js` is a helper, not a module: no slice and no events. It exports/imports the
seed + baseline + changes format and migrates the old full-state saves.

`editor.html` (with `editor/core.js` and `editor/schemas.js`) is also a tool, not a module: it
has no slice, no events and is not registered in `buildEngine()`. It edits the content files
directly; see the content-editor section below.

### Character creator

- `characters/creatorData.js` holds `settings.resourceStartPercent` (80),
  `settings.maxStartingItems` (6), and the `backgrounds`, `origins` and `focuses` lists.
  Each option has `key`, `name`, `description`, `stats` and `equipment`.
- `characters/creator.js` v0.1 adds the chosen option stat deltas to the base stats, starts
  resources at the configured percentage, combines the option equipment (de-duped and
  capped), and exposes `preview()`, `validate()` and `create()`.
- `creator:create { draft }` is the UI request. `create()` fires `mainCharacter:create`
  first, then one `equipment:add { key, source: "creator" }` per item, then
  `creator:created`. The normal auto-equip and armor bridge run against the new character.
- The first **Create character** save uses this path. Later **Save profile** calls
  `mainCharacter.save()` and keeps the current stats, equipment and build metadata.
- The creator slice stores only `lastCreated`. Reset clears it; save/load keeps it.

### Main character

- Name, gender, age, optional profile image.
- Uploaded images are centre-cropped to 256 px and stored as WebP/PNG data URLs; a
  missing image gets a generated SVG initials avatar.
- Every character (main and NPC) has the same ten base stats from
  `characters/statsData.js`: HP, Stamina, Mana, Strength, War, Diplomacy, Personal Combat,
  Money Management, Intrigue and Intelligence, plus an `armor` equipment stat. Resources
  are HP 0-100, Stamina 0-100 and Mana 0-50; skills are 1-20; armor is 0-100 and starts
  at 0. Main starts full/10; NPCs roll their values.
- Stats live in `character.stats`; resources also store `hpMax`, `staminaMax` and
  `manaMax`. Old saves with top-level `stamina` are migrated on load.
- `location:event` effects with `{ stat, delta }` can change any non-equipment base stat;
  the module emits `mainCharacter:statChanged` at `depth + 1`. Armor is ignored here.
- `action:resolved` effects use the same clamping path (`applyActionEffects`), so action
  costs and outcomes can change any non-equipment stat; `eventId` is the action id.
- `travel:event` effects use the same path (`applyTravelEffects`), so an interrupted
  journey applies its stat changes; `eventId` is the travel event id.
- `equipment:equipped` / `equipment:unequipped` write `stats.armor` through
  `applyEquipment` and emit `mainCharacter:armorChanged` at `depth + 1`.
- `combat:damage` targeting `main` lowers HP directly; the combat module already logs the
  hit, so there is no duplicate `statChanged` event.
- The UI calls `mainCharacter.save()` directly, then `engine.flush()`.
- `mainCharacter:saved` deliberately omits the image from event data.
- `characters/mainChar/` is a write-only mirror (`main.json` + `profile.<ext>`).

### NPCs and personality

- `characters/data.js` owns names, surnames, ages, the 30-trait pool with opposite pairs,
  and 30 named personality archetypes. Each archetype carries exactly five traits and a
  behavior profile over eight axes.
- Every generated NPC stores `personality: { id, name }`, copies its archetype's five
  traits, and copies the behavior values into `character.behavior`. Behavior axes are
  `aggression`, `caution`, `sociability`, `honesty`, `generosity`, `loyalty`, `curiosity`
  and `ambition`, each an integer 0-100.
- The behavior profile is the foundation for a future Crusader-Kings-style AI. **No rule
  reads it yet**: dialogue, NPC events, travel and combat are unchanged. Future AI should
  read `character.behavior` rather than infer intent from the name or traits.
- Legacy NPCs without `personality`/`behavior` are migrated deterministically on load: a
  valid personality id is kept, otherwise the nearest archetype by trait overlap is used.
  Missing traits and behavior axes fill from that archetype; behavior falls back to `50`.
- The NPC card shows the personality name and lists the traits; hovering the trait line
  shows the behavior values. The card also shows the level and relation label/value.
- Every NPC stores `relation: { value, type }` (-100..100) and `level` (1..100). Bands:
  hostile ≤ -31, unfriendly -30..0, ambivalent 1..20, accepting 21..40, friendly
  41..60, and 61+ uses the type label (Friendly/Loving/Protective/Trusted/Devoted/Bonded).
  `relationFor`, `setRelation` and `adjustRelation` expose it; changes fire
  `character:relationChanged`. Level is a framework: no rule derives stats from it yet.
- `character:spawn` accepts `{ source, level, relation, locationId, hostility, encounter }`
  and `character:spawned` echoes the metadata. `character:clearTemp { source }` clears
  only that tag; a plain `character:clearTemp` or `location:changed` clears all temp NPCs.
- `characters/statsData.js` owns the shared stat definitions. Add or tune a stat there;
  both the NPC and main-character modules iterate the list.

### Combat

- `combat/data.js` owns action names, attack/defend tuning, the enemy-action hook and
  the log limit. `combat/combat.js` owns the turn flow.
- The UI starts a duel from an NPC card's **Fight** button. It sends main/NPC snapshots
  in `combat:start`; the module never reads another module's slice.
- The player always moves first. **Attack** deals Personal Combat damage plus the
  equipped weapon's damage (when Strength meets its requirement); a surviving enemy
  immediately counterattacks. **Defend** braces for that counterattack.
- `combat:damage` is applied to the real main/NPC slices by their modules. Lethal player
  hits skip the counterattack; 0 HP ends the fight with `combat:ended`.
- Armor reduces every hit and Defend doubles that reduction. A weapon's armor piercing
  shrinks the target's effective armor before the reduction. Armor is written by the
  equipment module; with no armor equipped it blocks nothing.
- The enemy always attacks in v0.2. There is no flee, positioning, initiative, hit
  chance or damage variance yet.

### Locations

- Button-driven or map-driven generation: `location:add` request, then `location:added`.
- Each location has `id`, `name`, `biome`, `biomeKey`, `kind`, `weather`, `hostility` 1-100,
  `level`, `connections[]`, `seed`, `createdAtTick`, `createdAt`.
- Hostility 50 is neutral; biomes define a range. Level rolls from the biome `levelRange`.
  `locations/data.js` also owns `defaultHostility` (50) and `defaultLevel` (1).
- `kind` is empty for ordinary locations or `tavern`/`castle`/`shack` for authored
  landmarks. Landmarks use `biomeKey: "landmark"` and therefore roll no biome events.
- Every new location links to the current area plus a random neighbour. A connection is
  `{ id, distance }` and is stored on both endpoints with the same distance; distance is
  1-5 leagues. `travelGraph.minutesPerDistance` (15) turns distance into journey minutes.
- `connectionsFor(id)` returns UI-ready routes sorted by distance then name;
  `routeBetween(fromId, toId)` returns one route or `null`; `travelMinutes(distance)`
  converts leagues to minutes.
- Legacy saves and hand-edited imports without `connections` are repaired on load by
  `normalizeGraph()` without using the RNG: isolated locations are linked deterministically
  and distance falls back to `travelGraph.legacyDistance`.
- Map seed is `engine.state.seed >>> 0` with fallback `1`.
- `visit(id)` is async: it sets `currentId`, awaits biome event loading, emits
  `location:visited`, then rolls enabled events and emits `location:event` at
  `depth + 1`.
- The **Visit** button and `visitLocation()` only allow a direct route from the current
  location (or any location when none is current). `visit()` itself stays permissive so
  travel arrival and tests can call it directly.
- Biome event content lives in `locations/events/<biomeKey>/events.json` for all ten
  biomes. Each file has a disabled copy/paste template. Working examples exist in tundra
  (**Snowfall**), forest (**Wolf Pack**), grassland (**Wild Berries**), hills
  (**Old Cairn**), coast (**Washed-Up Crate**), desert (**Heat Haze**) and swamp
  (**Miasma**), covering both positive and negative modifiers.
- Each event's effective chance is
  `baseChance * clamp(1 + hostilityModifier * ((hostility - 50) / 50), 0, 5)`. Positive
  modifiers make bad events likelier in dangerous places; negative modifiers make good
  events fade. The logged `location:event` data includes both the effective and base
  chance plus the hostility and modifier.
- `loadEvents(force)` fetches and caches events; `eventStatus()` reports load counts and
  errors; the UI has **Reload biome events**.
- `Locations/<map seed>/seed.json` and `loc_XXXX.json` are written when the folder is
  connected. Reconnecting imports unknown `loc_*.json` files.

### Encounters

- `encounters/data.js` owns five spawn bands, `clearSource` (`"encounter"`),
  `maxPerVisit` (4), the enemy relation curve, enemy level scaling, drop chance and five
  loot rarity bands plus armor/weapon weights.
- On `location:visited` the module fires `character:clearTemp { source: "encounter" }`,
  rolls the band that covers the location's hostility, and fires one `character:spawn`
  per enemy with the location id, hostility, level and a hostile relation. Higher
  hostility means a higher chance, more enemies, lower relations and higher levels.
- Spawned encounter ids map to `enemies{}` through `character:spawned`; clearing removes
  them. Ordinary UI spawns have an empty source and survive.
- On `combat:ended` with `winnerId: "main"`, a mapped loser leaves the map. The module
  rolls the drop chance, then a kind and rarity band for that hostility, and fires
  `equipment:add { kind, rarity, source: "loot", enemyId }`. Losing or fighting an
  ordinary NPC awards nothing.
- The UI Visit status reports the encounter chance/roll and spawn count; `status.html`
  shows the last visit, active enemies and last loot.

### Static map and interiors

- `map/data.js` owns the whole world: `world.locations` (twelve authored sites with `key`,
  `kind`, `name`, `biome`, `biomeKey`, `weather`, `hostility`, `level`, optional
  `interior`), `world.routes` (`{ id, from, to, distance }`), `terrain.tiles`,
  `terrain.legend` and `terrain.interiors` presets. The tavern, castle and shack are
  landmarks; the other nine sites are wilds.
- `map:load` is idempotent. It fires one `location:add { count: 0, fixed, batch }`; sites
  carry `autoLink: false`, so the locations module adds no random routes. After the last
  `location:added` the map fires `location:link` per authored route, then `map:generated`.
  A second load reports `alreadyLoaded: true`. `map:generate` remains an alias.
- The map slice stores `loaded`, `total`, `sites` (key -> location id), `landmarks`
  (kind -> id) and `terrain` (location id -> generated interior). Save/load keeps all of it,
  so reloading a save never duplicates the world.
- On a landmark's first `location:visited`, the map builds a room-and-corridor grid with
  `engine.rng`, stores the tile rows/counts/entrance and emits `map:terrainGenerated`.
  Later visits reuse the stored grid. Terrain is display-only today: no movement, collision,
  doors or loot.
- The UI adds **Load static map**, a map status line, a terrain text grid and its legend.
  `status.html` shows sites, landmarks, generated interiors and the map event catalog.

### Actions

- `actions/data.js` has five default actions: Scout, Scavenge, Rest, Hunt, Travel.
  Each action stores `timeMinutes`, `costs[]`, `outcomes[]` and optional
  `requiresDestination` / `travelText`.
- Optional `LocationActionsData.biomes.<biomeKey>` lists override the default when they
  contain five valid actions.
- The module listens to `location:visited`, replaces the action list, clears `lastAction`,
  and emits `actions:loaded` at `depth + 1`.
- `action:choose` (`{ actionId, destinationId?, distance?, durationMinutes? }`) emits
  `action:chosen`, picks one outcome with `engine.rng` (weighted by `weight`), stores
  `lastAction`, and emits `action:resolved` at `depth + 1` with combined costs/effects,
  `timeMinutes`, `equipmentKey`, `travelTo` and `travelDistance`.
- The actions module applies nothing itself. `mainCharacter` applies the effects,
  `equipment` adds an awarded item, and the UI advances the clock by whole ticks for a
  normal action.
- Travel requires a destination; without one the module emits `action:blocked` and
  resolves nothing. The UI only offers destinations with a direct route from the current
  location; it sends the route's `distance` and `minutes`, so the journey time follows the
  graph. `timeMinutes` is the fallback when a caller sends no route data.
- For a valid journey the UI starts the travel module, which spends the route time in
  5-minute checks. On completion the UI calls `locations.visit(travelTo)`, so the
  destination's actions load and its biome events roll. No module edits another's slice.
- The UI shows an **Actions** panel with the area name, five actions, cost/time text, a
  route-only destination dropdown (name, biome, distance, minutes), and the last
  resolution in the status line.

### Travel

- `travel/data.js` owns `minutesPerCheck` (5), `chancePercent` (8% fallback),
  `chanceByBiome` overrides (6-10% across the ten biomes) and the travel event catalogue.
  Each event has `{ id, name, text, weight, enabled, effects }`.
- A journey starts from `travel:start` after a Travel action resolves. The UI passes a
  destination snapshot, the route `distance` and `durationMinutes`; the module never
  reads the locations slice.
- Duration comes from the travel graph (`distance * 15` minutes), rounded up to whole
  checks. The Travel action's `timeMinutes` is only a fallback when no route data arrives.
  The UI temporarily sets a 5-minute tick, advances one check, fires `travel:advance`, and
  repeats. It restores the previous tick size after a pause or completion.
- `distance` is stored in the slice and echoed in `travel:started` and `travel:completed`
  for the panel/status. It does not change the per-check event chance; longer routes get
  more checks, so they see more total risk.
- Each check rolls once. On a hit the journey pauses, stores `lastEvent`, emits
  `travel:event`, and `mainCharacter.applyTravelEffects()` applies the effects. Press
  **Continue travel** to emit `travel:continue` and resume.
- Quiet checks emit `travel:progress`; the last one emits `travel:completed`. An event on
  the final check pauses first; Continue then completes without adding time.
- On completion the UI calls `locations.visit(destinationId)`. Travel events are separate
  from biome events, which still roll on arrival.
- A paused/in-flight journey is saved. The UI shows **Continue travel** after load.
  **Cancel journey** abandons it without a refund.

### Equipment

- `equipment/data.js` owns the catalogue, five rarity ranks (`common`, `uncommon`,
  `rare`, `legendary`, `unique`) with stat bands for armor, damage, Strength and armor
  piercing, and the type lists. Every item has `kind` (`"armor"` or `"weapon"`), `rarity`
  and a matching `weaponType` (`sword`, `spear`, `axe`, `mace`) or `armorType` (`cloth`,
  `leather`, `mail`, `plate`, `scale`).
- Armor uses `parts` (the ten keys from `characters/bodyData.js`) and `armor`. Weapons use
  one weapon slot and carry `damage`, a `strength` requirement and `armorPiercing`.
  Types are descriptive grouping today; combat still reads the numeric stats.
- An armor item can cover several parts. Several armor items can be worn at once as long as
  no part is shared; equipping an overlapping item removes the conflicting items whole.
  Total armor is the sum of the distinct worn armor, clamped to `maxArmor`.
- A new item auto-equips when its slot is free (every covered part for armor, an empty
  weapon slot for a weapon); otherwise it stays in the inventory. Requests are
  `equipment:add` (`{ key?, kind?, rarity?, weaponType?, armorType? }`), `equipment:equip`,
  `equipment:unequip` (`{ itemId? }`), `equipment:remove` (`{ itemId }`); module events are
  `equipment:added`, `equipment:equipped`, `equipment:unequipped` and
  `equipment:removed`, each carrying `weaponType` or `armorType`.
- `equippedByPart` is the source of truth for armor and `equippedWeaponId` for the weapon;
  v0.1 saves with `equippedId`/`slot` are migrated on load.
- The module listens to `action:resolved` and adds the item named by `equipmentKey`.
- `mainCharacter` listens to the equipped/unequipped events, clamps `totalArmor` to
  0-100, writes `stats.armor` and emits `mainCharacter:armorChanged`. Weapon events keep
  the unchanged `totalArmor`, so they do not touch the armor stat. The equipment module
  never reads another slice.
- Only the main character can equip. The UI has an **Equipment** panel with **Find
  armor**, **Find weapon**, total armor, covered parts, the weapon slot, per-item type and
  rarity, **Equip** / **Unequip** / **Destroy** and **Unequip all**; finds need a saved
  main character. Scavenge can award equipment.

### Content editor

- `editor.html` edits content files in forms. It is not a module: no state slice, no
  events, not registered in `buildEngine()`.
- It edits `travel/data.js`, `equipment/data.js`, `actions/data.js`, `characters/data.js`
  and every `locations/events/<biome>/events.json`. `locations/data.js`,
  `characters/statsData.js`, `characters/bodyData.js` and `combat/data.js` are read-only
  references. Armor items pick their `parts` from the body data with a multi-select.
- The object in each `window.X = {...};` file is strict JSON, so it can be rewritten
  losslessly. The header comment is preserved. Unknown fields are kept, so fields without
  a form (for example `behaviorAxes` and `personalities`) survive a save.
- **Open game folder** writes directly (Chrome/Edge). Without it, saving downloads each
  changed file, flattening the path (`travel-data.js`).
- `editor/schemas.js` owns the file/section/field model and validators;
  `editor/core.js` owns parsing and formatting. To add a content type, extend the schemas;
  `editor.html` needs no change.
- `BIOMES` in `editor/schemas.js` mirrors `locations/data.js`; update both when adding a
  biome.

### Save files

- `save/gameSave.js` is a helper, not a module. Format v1 is
  `{ format: "text-rpg-save", formatVersion: 1, savedAt, label, seed, baseline:
  { startDate, tickMinutes }, changes[] }`.
- `GameSave.capture(engine, buildEngine)` diffs a fresh baseline against the live state.
  `GameSave.restore(text, engine, { buildEngine })` rebuilds the file's seed/baseline, applies
  the changes and calls `engine.load()`.
- `buildEngine(opts)` in `index.html` is the single module-registration factory for both the
  live page and save baselines. Register new modules there; `map` must come after
  `locations`.
- `MIGRATIONS[0]` turns a raw legacy engine state (the old full-state JSON) into v1 by rebuilding
  and diffing. Newer `formatVersion` values are refused.
- Change paths must start at a top-level state key; `__proto__`, `prototype` and `constructor`
  are rejected. Limit: 20,000 changes.
- The UI keeps **Quick save** / **Quick load** in `localStorage` slot `save1` and adds
  **Export save file** / **Import save file** for real JSON downloads/uploads.
- `save/README.md` documents the format, API, migration and limits.

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
  -> action:choose { actionId, destinationId?, distance?, durationMinutes? }
  -> actions.choose() -> action:chosen, action:resolved
  -> mainCharacter.applyActionEffects() -> mainCharacter:statChanged
  -> equipment.add() for a rewarded item -> equipment:added/equipped
  -> UI engine.flush()
  -> normal action: UI engine.step(ceil(timeMinutes / tickMinutes))
  -> Travel: UI travel:start { distance, durationMinutes } -> travel:started
     -> UI sets 5-minute ticks, steps one tick, then travel:advance
        -> travel:progress (loop continues)
        -> travel:event (pause; mainCharacter applies effects)
           -> Continue -> travel:continue -> travel:resumed -> loop resumes
        -> travel:completed
           -> UI restores tick size and calls locations.visit(destinationId)
              -> location:visited -> actions:loaded + biome events
  -> engine.flush() from the UI
```

```text
UI Travel interruption
  -> travel:advance
  -> travel:event { text, effects }
  -> mainCharacter.applyTravelEffects() -> mainCharacter:statChanged
  -> UI shows the event and disables the Actions buttons
  -> no clock/journey progress until travel:continue
```

```text
UI Equip / Unequip / Find / Destroy
  -> equipment:equip / unequip / add / remove
  -> equipment.equip()/unequip()/add()/remove() -> equipment:equipped / unequipped / added / removed
  -> mainCharacter.applyEquipment() -> mainCharacter:armorChanged when armor changed
  -> engine.flush() from the UI
```

```text
UI Fight on an NPC
  -> combat:start { player, enemy } snapshots
  -> combat.start() -> combat:started
  -> UI Attack/Defend -> combat:action
  -> combat.action() -> combat:damage
  -> mainCharacter/characters apply HP
  -> combat:ended when a combatant reaches 0 HP
  -> engine.flush() from the UI
```

```text
UI Export save file
  -> GameSave.capture(engine, buildEngine)
  -> engine.serialize() + fresh buildEngine(seed/baseline)
  -> changesBetween(fresh.state, live) -> v1 JSON download

UI Import save file
  -> GameSave.restore(fileText, engine, { buildEngine })
  -> read/parse -> validate -> migrate legacy v0 if needed
  -> buildEngine(file baseline) -> applyChanges -> engine.load()
  -> modules normalize in onLoad(); the UI re-renders
```

## Recent work

- Character creator: added `characters/creatorData.js` and `characters/creator.js` v0.1.
  Background, origin and focus choices add starting stat changes and equipment; resources
  start at 80% so both positive and negative changes matter. `creator:create` validates a
  draft, `mainCharacter:create` stores the computed stats, `equipment:add` grants the kit,
  and `creator:created` reports the build. MainCharacter v0.7 accepts `data.stats` and
  stores optional build metadata. The UI has three selects and a live preview; the editor
  edits the creator data (settings, backgrounds, origins, focuses); the status page shows
  the last build. All fifteen Node test files pass.
- Biome events: added working events to six more biomes — forest **Wolf Pack**, grassland
  **Wild Berries**, hills **Old Cairn**, coast **Washed-Up Crate**, desert **Heat Haze**
  and swamp **Miasma** — joining tundra **Snowfall**. They mix positive and negative
  effects and modifiers; jungle, mountains and wasteland still hold only templates.
- Static map and interiors: the world is now authored in `map/data.js` (twelve sites,
  thirteen routes) and `map:load` is idempotent; `map:generate` is a legacy alias. Sites
  use `autoLink: false` and the new `location:link` request installs the authored graph.
  Landmarks generate a room-and-corridor interior on the first visit with `engine.rng`,
  store it in `map.terrain` and reuse it across visits and saves. The UI gains **Load static
  map**, a terrain grid and legend; `status.html` shows sites/landmarks/interiors; the editor
  now edits the map (`world`, sites, routes, interior presets, tiles). All fourteen Node
  test files pass.
- Relations, levels and encounters: characters v0.6 stores `relation: { value, type }`
  (-100..100 with data-driven bands and type-specific high labels) and a level, exposes
  `relationFor`/`setRelation`/`adjustRelation`/`levelFor`, and supports spawn metadata and
  source-filtered clearing. Locations v0.5 adds a per-biome `levelRange`, a location
  `level`, and biome event `hostilityModifier` scaling by `((hostility - 50) / 50)`.
  Encounters v0.1 spawns hostility-scaled hostile NPCs on `location:visited` and awards
  hostility-scaled loot on a winning `combat:ended`. The UI/status show relations, levels
  and encounters; the editor now edits `locations/data.js` and `encounters/data.js`
  (biomes, hostility bands, levels, travel graph, relation bands/types, spawn and loot
  bands). Reloaded biome JSON now carries `hostilityModifier` everywhere. All fourteen
  Node test files pass.
- Equipment v0.4: added data-driven weapon types (sword, spear, axe, mace) and armor
  types (cloth, leather, mail, plate, scale). Every item now carries `weaponType` or
  `armorType`; added a five-rarity axe family and typed all existing gear. `equipment:add`
  accepts type filters, event payloads and serialized items carry the type, old saves fall
  back to the catalogue definition, and the UI/status/editor show and validate types. All
  twelve Node test files pass.
- Equipment v0.3 and combat v0.2: added swords, spears and maces in one weapon slot with
  base damage, a Strength requirement and armor piercing; added five rarity tiers
  (Common, Uncommon, Rare, Legendary, Unique) with strict stat bands. A new shared
  `strength` stat gates weapons. `equipment:add` accepts `kind`/`rarity` filters and
  `equipment:remove` destroys items, so future events and mobs can generate or destroy
  loot. Combat now adds weapon damage, ignores part of the target's armor, and armor
  reduces every hit while Defend doubles it. The game UI gains Find armor/Find weapon,
  rarity labels, a weapon slot, Strength-gated equipping and Destroy buttons; the editor
  validates kind, rarity and stat bands. All twelve Node test files pass.
- Equipment v0.2: armor now targets the ten body-part keys. Item `parts` can cover several
  parts, several items can be worn at once, and overlapping items replace each other whole.
  `equippedByPart` replaces `equippedId` with save migration; total armor is summed and
  clamped. The catalogue grew to twelve pieces covering head, torso, arms, hands, legs and
  feet, and the game/status views show per-part coverage. The content editor gained a
  body-part multi-select, body-data reference, part checks and new previews. All twelve Node
  test files pass.
- Added ten-part humanoid bodies to every character. `characters/bodyData.js` defines
  head, torso, left/right legs, arms, hands and feet with side/parent/vital metadata;
  `characters/body.js` builds and normalises the shared shape. Characters v0.5 and
  mainCharacter v0.6 generate/keep `body`, old saves gain missing parts, and saved part
  statuses survive. The main-character panel shows a Body grid and NPC cards show a compact
  body line; status.html shows body nodes. Part status starts at `"intact"` and is not read
  by any injury, combat or healing rule yet; equipment targets the part keys. Browser
  smoke-tested saving the main character, spawning an NPC and loading status.html with no
  console errors; all twelve Node test files pass.
- Added the content editor (`editor.html`, `editor/core.js`, `editor/schemas.js`) as a
  tool, not a module. It edits biome events, travel events/tuning, equipment items
  (armor, weapons, rarity tiers)/settings, area actions/outcomes, and character
  names/traits/ages in forms, with validation, previews and both direct folder saves and
  per-file downloads.
- Converted `travel/data.js`, `equipment/data.js`, `actions/data.js` and
  `characters/data.js` to strict JSON inside their `window.X = { ... };` wrapper so the
  editor can round-trip them byte-for-byte. The characters conversion preserves all 30
  personalities and eight behavior axes; the editor leaves them untouched.
- Fixed editor issues found while testing: literal `"null"` text under fields without help,
  duplicated action outcomes keeping duplicate ids, and new outcome ids colliding across
  actions. Outcome ids are now globally unique via `S.outcomeIds()` /
  `S.duplicateOutcomeIds()`.
- Added `test/editor.test.cjs` (formatter, round-trip, validation, previews, outcome ids)
  to `npm test`, and added `Cache-Control: no-store` to the dev server so browser tests do
  not load stale scripts.
- Added the procedural map spawner (`map` v0.1) as a separate module. **Generate map**
  requests a configurable number of random locations plus the fixed tavern/castle/shack
  landmarks from `map/data.js`. The map module drives the existing location spawner
  through `location:add` and waits for the batch's `location:added` events before emitting
  `map:generated`.
- Extended locations to v0.4: fixed definitions bypass the random rolls, `kind` is stored
  and normalized, landmark names stay unique across repeated maps, and `location:added`
  carries the fixed kind and batch id. Landmarks use `biomeKey: "landmark"` so biome events
  do not fire on them. The graph links landmarks like any other location.
- Added `test/map.test.cjs` and registered it in `npm test`; updated the save-test module
  list to include `map`.
- Added 30 named NPC personality archetypes (`characters` v0.4) in `characters/data.js`.
  Each archetype owns five traits and an eight-axis behavior profile (0-100). Generated NPCs
  now store `personality: { id, name }`, their trait copy and `behavior`; the spawn line and
  NPC card show the personality, and hovering the traits shows the behavior values.
- Legacy NPC saves are migrated deterministically by personality id or nearest trait
  overlap, with missing behavior axes filled from the archetype then `50`. Behavior is
  data-only: no dialogue, event, travel or combat rule reads it yet.
- Extended `test/characters.test.cjs` to validate the 30 archetypes, trait uniqueness and
  opposite rules, behavior ranges, generation and legacy migration.
- Added real save files (`save/gameSave.js` v0.1): format v1 stores the world seed, baseline
  engine options and a change list; export/import uses a real JSON download/upload. Legacy
  full-state saves are migrated by rebuilding the baseline and diffing. Unsafe paths and newer
  formats are refused.
- Refactored `index.html` to a shared `buildEngine(opts)` factory used by both the live page and
  save baselines. Quick **Save / Load** still uses `localStorage` slot `save1`.
- Added `test/save.test.cjs` and wired it into `npm test`; all ten test files pass.
- Added `save/README.md` and updated `ENGINE_SPEC.md` to v1.2, plus `MODULES.md`, `HANDOFF.md`,
  `README.md`, `DESIGN.md`, `IDEAS.md` and `status.html`.
- Corrected the design/status drift on NPC tiers: `characters` v0.3 has `temp` and `named`
  buckets, not the full three-tier `ephemeral -> notable -> saved` model.
- Added the travel graph (`locations` v0.3, `actions` v0.3, `travel` v0.2). Locations own
  bidirectional `connections[]` with a distance; new locations link to the current area
  plus a random neighbour. Travel only offers direct routes, and the route distance sets
  the journey time (`distance * 15` minutes) instead of the action's fallback. The UI gates
  **Visit** the same way. Actions accept and announce `travelDistance`, and travel stores
  and echoes `distance`.
- Legacy saves and hand-edited imports without `connections` are repaired deterministically
  (no RNG) so old state still travels.
- Extended the tests: route invariants and legacy repair in `locations.test.cjs`, the route
  time/distance override in `actions.test.cjs`, and distance persistence in
  `travel.test.cjs`. All nine test files pass; a browser smoke test completed a 3-league
  (45-minute) journey with route-gated Visit buttons and no console errors.
- Added `DESIGN.md` (vision, pillars, decisions, roadmap) and `IDEAS.md` (running idea
  list) to the repository, and wired them into the reading order, architecture rules,
  `README.md`, `MODULES.md` and the status page's Docs node. `DESIGN.md` records timed
  travel and the action time model; its status snapshot now matches the code versions.
- Added the `travel` module: a journey owns elapsed time, 5-minute checks, event rolls and
  pause/resume. `travel/data.js` has six interruption events and per-biome chance
  overrides. The UI drives a temporary 5-minute tick, restores the player's tick size,
  and calls `locations.visit` only on arrival.
- Main character v0.5 applies `travel:event` effects via `applyTravelEffects`, so
  interruptions use the same clamp/`statChanged` path as location and action effects.
- Added the Travel panel (**Continue travel**, **Cancel journey**, route/progress/event)
  and disabled Actions while a journey is active. The tick-size selector now offers 5 min.
- Added `test/travel.test.cjs` covering checks, pause/resume, effects, cancel, duration
  rounding, reset and save/load. The travel test controls `TravelData.chancePercent` for
  deterministic event rolls.
- Added the `equipment` module: a six-item body-armor catalogue, inventory with
  auto-equip/swap/unequip, `equipment:add/equip/unequip` requests and
  `equipment:added/equipped/unequipped` events. Armor is mirrored into the main
  character's `stats.armor` by `mainCharacter.applyEquipment()`.
- Made area actions playable: each default action now has a time cost, stat costs and
  weighted outcomes. `action:resolved` carries effects, `timeMinutes`, an optional
  `equipmentKey` and an optional `travelTo`; `lastAction` is saved for the UI/status tree.
- Added the **Equipment** panel (Find armor, inventory, Equip/Unequip) and the **Actions**
  panel's cost/time/travel UI. Armor is shown in the main stat grid and combat note.
- Defend now has a visible effect: with equipment equipped, `combat:damage` reports the
  armor reduction and the real HP loss is smaller.
- Added `test/equipment.test.cjs`, rewrote `test/actions.test.cjs` for outcomes/time/
  travel/equipment, and extended the status tree with equipment, action resolution,
  events and content counts. Docs are at `ENGINE_SPEC.md` v1.0.
- All nine Node test files pass. Browser checks passed for: saving a character, adding
  and visiting locations, Rest advancing 60 minutes, Find armor/Equip/Unequip, a
  30-minute Travel pausing at 5 minutes then completing after Continue, a Defend with
  armor 1 blocking 2 damage, and the new status branches. No console errors.
- Added `MODULES.md`, a living per-module handbook: role, files, state, code map, events,
  adjustment tables, gotchas and an update log. It must be updated with every module
  change (also listed in the architecture rules).

## Known limitations and quirks

- The static map is authored content, not a placeholder: `map/data.js` fixes the sites and
  routes for every game. Landmarks generate a room-and-corridor interior on first visit,
  stored in the save; interiors are display-only (no movement, collision, doors or loot)
  and there is no drawn atlas yet. Loading the map twice does not duplicate it.
- Area actions resolve costs, one weighted outcome, time and travel, but have no
  requirements or skill checks yet. Travel follows direct routes in the location graph;
  a journey spends its route time in 5-minute checks.
- Normal action time is applied by stepping whole ticks. Travel temporarily switches to
  5-minute ticks, then restores the previous tick size.
- Travel interruptions are stat-effect scenes: they cannot start combat or offer choices.
  The per-check chance depends on the destination biome, not on route distance or weather;
  longer routes simply roll more checks.
- The travel graph is an abstract link graph with distances, not a coordinate map. New
  locations link to the current area plus a random neighbour, so the graph can grow as a
  chain and the layout is not geographic.
- Base stats are stored, and location events/actions can change them. Combat uses Personal
  Combat, Strength, armor and a weapon, but there is no progression, training or
  opposed-roll system yet. NPC level is stored (and encounters scale it) but no rule levels
  characters up or derives stats from level.
- NPC relations are stored and encounter enemies start hostile, but no dialogue, faction or
  reputation rule reads them yet; `setRelation`/`adjustRelation` are the future hook.
- Combat is one-on-one and player-first. There is no flee, positioning, initiative, hit
  chance, damage variance or enemy AI; the enemy always attacks.
- Equipment is main-character-only. Armor targets the ten body parts and one weapon can be
  carried. NPCs still fight at armor 0 with no weapon. Armor is mirrored to the main
  character present when the item is equipped; the UI requires a saved character before
  **Find armor** or **Find weapon**.
- Rarity and type affect stats, labels and find filters only. `equipment:add` and
  `equipment:remove` are ready for events/mobs, but no content generates or destroys a
  rarity-tiered item yet.
- NPC personality archetypes, traits and behavior profiles are generated and displayed, but
  no AI reads them yet. Combat has no enemy AI, dialogue is not implemented, and NPC events
  do not use personality.
- Every character has a ten-part body with per-part `status`, but no injury, combat,
  healing or equipment rule reads or changes the status yet. Equipment uses the part keys;
  the statuses are structure and UI only.
- Biome events have no cooldowns, once-only flags, weather filters or requirements.
  Every enabled event is an independent roll on each visit; hostility only shifts its
  chance through `hostilityModifier`.
- Encounters are automatic and one-sided: a hostile NPC appears on a visit, the player
  still has to press **Fight**, and nothing resolves the fight automatically. Loot is
  awarded only on a player win; there is no enemy inventory or drop table per enemy.
- `location:changed` still only clears Temporary Spawn. The location graph now has
  connections and distances, but no coordinates; the travel module runs the in-between
  journey and the UI calls `locations.visit` on arrival, moving `currentId` along a direct
  route.
- The real OS folder pickers are untested in a browser. The disk tests use an in-memory
  File System Access API mock. Chrome/Edge is required.
- The content editor covers biome events, travel, equipment, actions, characters,
  locations, encounters and the static map (`map/data.js`). It cannot edit
  `characters/statsData.js`, `characters/bodyData.js`, `combat/data.js`, `behaviorAxes`
  or `personalities`, and it cannot create a new biome without a matching `BIOMES` change
  in `editor/schemas.js`.
- The editor saves strict JSON. Opening a file with older JavaScript syntax works, but
  saving rewrites the object and drops comments inside it (the header comment is kept).
- The editor's folder picker was tested with a mocked File System Access API; the real OS
  picker has not been exercised. Without a folder, downloads cannot keep directories, so
  saved files are renamed to flattened paths and must be moved back by hand.
- `mainChar/` is a write mirror, not an import source. The quick save or an imported save file
  is the way back into a session.
- Save files are snapshot diffs, not replay logs. They cannot merge two divergent saves, and
  because most world content is created by play they are often close to full-state size.
- Quick save uses `localStorage` slot `save1`, which some contexts block. **Export/Import save
  file** is the fallback and uses a real JSON download/upload.
- On Windows, `Locations/` and `locations/` are the same case-insensitive directory.
  The mirror therefore writes seed folders inside the module folder on Windows. This is
  a known platform quirk; do not add a broad `Locations/` ignore rule without checking
  case-sensitivity.
- `status.html` reads only the quick-save slot or a manually loaded state JSON file. It does
  not expand a save file's `changes`; import the file in the game first.
- Folder connections (`mainChar/`, `Locations/`) are runtime handles and are not in the
  save, so the status tree cannot report whether they are connected.
- The local test server may not be running in a new session. Start it with
  `npm run serve`.

## Suggested next steps

1. Turn the static map into visual terrain: movement and collision inside landmarks, or a
   drawn route graph/atlas that uses the existing site keys and distances.
2. Give travel interruptions choices (press on, turn back, fight) through new request/event
   pairs; keep travel resolution modular.
3. Use stats in action and event checks (success/chance based on skill and difficulty)
   and add requirements such as minimum stamina or a needed item.
4. Expand equipment: NPC loadouts and loot tables that call `equipment:add` with a rarity
   filter or `equipment:remove`; inventory limits and maybe more slots. Keep the
   armor-to-stat bridge event-based.
5. Add per-biome action overrides and test them in the UI.
6. Add event conditions (weather, time, once/cooldown) to the biome event schema.
7. Expand combat: enemy AI, flee, multiple opponents, hit chance/damage variance, or
   initiative, depending on the desired feel.
8. Decide how stats progress through training, actions and equipment, and how NPC/biome
   levels unlock that progression.
9. Add dialogue/faction reactions that read NPC relation bands.
10. Consider IndexedDB autosave and named save slots on top of the file export/import.
11. Manually verify both real folder pickers in Chrome/Edge.

## Quick prompt for a new AI

```text
Continue the project at https://github.com/animefordaysXD/TestGame.

Read HANDOFF.md first, then README.md, DESIGN.md, ENGINE_SPEC.md and MODULES.md (the
per-module handbook). IDEAS.md is the running idea list. Follow the architecture rules and
git workflow in HANDOFF.md. Run the tests with npm test (Windows: npm.cmd test) and start
the page with npm run serve (Windows: npm.cmd run serve).

DESIGN.md is the product source of truth: check requests against its pillars and decisions,
do not build Proposed items as if they were decided, and record new ideas in IDEAS.md in the
same turn. Update DESIGN.md when a decision is made.

Do not edit engine.js (core v0.2). Keep every module's state slice JSON-safe and make modules
communicate only through events. UI events must be followed by engine.flush(); follow-up
events use depth + 1. init() reruns on reset, so subscribe/register only once. Use engine.rng
or the tick rng, never Math.random. Put content in data files. For every module or event
change, update ENGINE_SPEC.md, MODULES.md (including its update log), HANDOFF.md, README.md
and the hand-maintained branches in status.html. Commit only when asked; do not push without
explicit approval.

Current build: core v0.2; characters v0.6; mainCharacter v0.7; creator v0.1; equipment v0.4;
locations v0.5; map v0.2; actions v0.3; travel v0.2; combat v0.2; encounters v0.1; save helper v0.1.
Working: a data-driven character creator (background, origin and focus set starting stats
and equipment); a static authored world map (twelve sites, thirteen routes) with procedural
landmark interiors generated on first visit; a travel graph of connected locations with
distances and route-based times; procedural locations with hostility and levels;
hostility-modified biome events; hostility-driven encounters with hostility-scaled enemies
and loot; shared stats (including Strength) and ten-part bodies; 30 named NPC personality
archetypes with traits and behavior profiles (data-only, no AI reads them yet) plus relation
bands and levels; body-part armor plus a weapon slot, weapon/armor types, five rarity tiers,
and armor/weapon stats feeding combat; five area actions with time, costs and weighted
outcomes; route-based timed travel with 5-minute checks, event pause/resume and arrival
through locations; basic player-first combat with weapon damage, Strength gating and armor
piercing; real JSON save files (seed + baseline + changes) with legacy migration and
unsafe-path guards, alongside quick localStorage saves; a read-only status tree; and a
form-based content editor (`editor.html`) that is a tool, not a module. Fifteen Node test
files are wired into npm test.

Known gaps: the creator is a fixed set of authored choices with no point-buy, reroll or
in-game rebuild; landmark interiors are display-only (no movement, collision, doors or loot)
and the world map has no drawn atlas; actions and events have no requirements or skill
checks; travel events are stat-only scenes with no choices or combat handoff; NPC relations
and levels are stored but no dialogue/progression rule reads them; jungle, mountains and
wasteland still have only event templates; NPCs cannot equip and carry no weapon; combat has
no flee, enemy AI, hit chance or variance; personality and behavior do not drive behaviour
yet; body part status is structural only and no rule injures, heals or equips it;
encounters depend on the player pressing Fight; the three-tier NPC model is only
approximated by temp/named buckets.

Suggested next step: give creation and progression more depth (point-buy or rebuild) or give
the generated interiors movement/collision and reuse the terrain generator for travel. Ask
what to build next; do not add unrequested scope.
```
