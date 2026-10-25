# Text RPG — Handoff

**Repository:** <https://github.com/animefordaysXD/TestGame>

**Last updated:** 2026-10-24
**Current spec:** `ENGINE_SPEC.md` v0.9
**Status:** working test page with procedural locations, biome events, a main-character
creator with nine base stats plus armor, NPCs with the same stats and personality traits,
basic player-first combat (Attack/Defend), an equipment module whose armor feeds Defend,
five area actions with costs/outcomes/time and Travel through the locations module, and a
live node-tree status page.

This file is the starting point for a new AI session. Read it first, then `README.md`,
`ENGINE_SPEC.md` and `MODULES.md` (the per-module map and adjustment guide).

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
- `test/actions.test.cjs` — five-action loading, biome overrides, weighted outcomes,
  stat costs, time, travel through locations, equipment rewards, reset, save/load.
- `test/equipment.test.cjs` — inventory, auto-equip, swap/unequip, armor bridge,
  combat/Defend integration, reset, save/load.
- `test/combat.test.cjs` — player-first turns, attack damage, defend/armor, lethal hits,
  invalid actions, reset, save/load.

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
- Keep State slices JSON-safe. Never cache a slice object; `load()` replaces the state.

## Git workflow

- Work on `main`; commit only when the user asks.
- Do not push without explicit approval. If a push is needed for another session or a
  GitHub-based handoff, ask first.

## Modules

| module | state slice | current behavior |
|---|---|---|
| `characters` | `nextId`, `named{}`, `temp{}` | NPC generator with base stats; Named NPC / Temporary Spawn |
| `mainCharacter` | `character` | one player character, profile image, base stats, JSON mirror |
| `equipment` | `nextId`, `items{}`, `equippedId` | main-character armor inventory; mirrors armor into the character stat |
| `combat` | `active`, `round`, `turn`, `player`, `enemy`, `defending`, `winner*`, `log[]` | basic player-first duels; Attack/Defend |
| `locations` | `seed`, `createdAt`, `nextId`, `locations{}`, `currentId` | procedural locations, visit rolls, JSON mirror |
| `actions` | `locationId`, `locationName`, `biomeKey`, `actions[]`, `lastAction` | five area actions with costs, outcomes, time and Travel |

### Main character

- Name, gender, age, optional profile image.
- Uploaded images are centre-cropped to 256 px and stored as WebP/PNG data URLs; a
  missing image gets a generated SVG initials avatar.
- Every character (main and NPC) has the same nine base stats from
  `characters/statsData.js`: HP, Stamina, Mana, War, Diplomacy, Personal Combat, Money
  Management, Intrigue and Intelligence, plus an `armor` equipment stat. Resources are HP
  0-100, Stamina 0-100 and Mana 0-50; skills are 1-20; armor is 0-100 and starts at 0.
  Main starts full/10; NPCs roll their values.
- Stats live in `character.stats`; resources also store `hpMax`, `staminaMax` and
  `manaMax`. Old saves with top-level `stamina` are migrated on load.
- `location:event` effects with `{ stat, delta }` can change any non-equipment base stat;
  the module emits `mainCharacter:statChanged` at `depth + 1`. Armor is ignored here.
- `action:resolved` effects use the same clamping path (`applyActionEffects`), so action
  costs and outcomes can change any non-equipment stat; `eventId` is the action id.
- `equipment:equipped` / `equipment:unequipped` write `stats.armor` through
  `applyEquipment` and emit `mainCharacter:armorChanged` at `depth + 1`.
- `combat:damage` targeting `main` lowers HP directly; the combat module already logs the
  hit, so there is no duplicate `statChanged` event.
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

### Combat

- `combat/data.js` owns action names, attack/defend tuning, the enemy-action hook and
  the log limit. `combat/combat.js` owns the turn flow.
- The UI starts a duel from an NPC card's **Fight** button. It sends main/NPC snapshots
  in `combat:start`; the module never reads another module's slice.
- The player always moves first. **Attack** deals Personal Combat damage; a surviving
  enemy immediately counterattacks. **Defend** braces for that counterattack.
- `combat:damage` is applied to the real main/NPC slices by their modules. Lethal player
  hits skip the counterattack; 0 HP ends the fight with `combat:ended`.
- Defend uses `max(0, damage - armor * 2)`. Armor is written by the equipment module;
  with no armor equipped, Defend blocks nothing.
- The enemy always attacks in v0.1. There is no flee, positioning, initiative, hit
  chance or damage variance yet.

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
  Each action stores `timeMinutes`, `costs[]`, `outcomes[]` and optional
  `requiresDestination` / `travelText`.
- Optional `LocationActionsData.biomes.<biomeKey>` lists override the default when they
  contain five valid actions.
- The module listens to `location:visited`, replaces the action list, clears `lastAction`,
  and emits `actions:loaded` at `depth + 1`.
- `action:choose` (`{ actionId, destinationId? }`) emits `action:chosen`, picks one
  outcome with `engine.rng` (weighted by `weight`), stores `lastAction`, and emits
  `action:resolved` at `depth + 1` with combined costs/effects, `timeMinutes`,
  `equipmentKey` and `travelTo`.
- The actions module applies nothing itself. `mainCharacter` applies the effects,
  `equipment` adds an awarded item, and the UI advances the clock by whole ticks.
- Travel requires a destination; without one the module emits `action:blocked` and
  resolves nothing. The UI then calls `locations.visit(travelTo)`, so the destination's
  actions load and its biome events roll. No module edits another's slice.
- The UI shows an **Actions** panel with the area name, five actions, cost/time text, a
  destination dropdown for Travel, and the last resolution in the status line.

### Equipment

- `equipment/data.js` owns the armor catalogue (`key`, `name`, `slot`, `armor`, `weight`),
  `maxArmor` and `autoEquip`. All six current items use the one `body` slot.
- The first acquired item is auto-equipped; equipping another swaps it. Requests are
  `equipment:add`, `equipment:equip` and `equipment:unequip`; module events are
  `equipment:added`, `equipment:equipped` and `equipment:unequipped`.
- The module listens to `action:resolved` and adds the item named by `equipmentKey`.
- `mainCharacter` listens to the equipped/unequipped events, clamps `totalArmor` to
  0-100, writes `stats.armor` and emits `mainCharacter:armorChanged`. The equipment
  module never reads another slice.
- Only the main character can equip. The UI has an **Equipment** panel with **Find
  armor**, the inventory, and **Equip** / **Unequip**; Find armor needs a saved main
  character. Scavenge can award armor.

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
  -> action:choose { actionId, destinationId? }
  -> actions.choose() -> action:chosen, action:resolved
  -> mainCharacter.applyActionEffects() -> mainCharacter:statChanged
  -> equipment.add() for a rewarded item -> equipment:added/equipped
  -> UI engine.flush()
  -> UI engine.step(ceil(timeMinutes / tickMinutes))
  -> for Travel: locations.visit(travelTo) -> location:visited -> actions:loaded + biome events
  -> engine.flush() from the UI
```

```text
UI Equip / Unequip / Find armor
  -> equipment:equip / unequip / add
  -> equipment.equip()/unequip()/add() -> equipment:equipped / unequipped / added
  -> mainCharacter.applyEquipment() -> mainCharacter:armorChanged
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

## Recent work

- Added the `equipment` module: a six-item body-armor catalogue, inventory with
  auto-equip/swap/unequip, `equipment:add/equip/unequip` requests and
  `equipment:added/equipped/unequipped` events. Armor is mirrored into the main
  character's `stats.armor` by `mainCharacter.applyEquipment()`.
- Made area actions playable: each default action now has a time cost, stat costs and
  weighted outcomes. `action:resolved` carries effects, `timeMinutes`, an optional
  `equipmentKey` and an optional `travelTo`; `lastAction` is saved for the UI/status tree.
- Travel now uses the locations module. The Actions panel shows a destination dropdown;
  choosing Travel pays its stamina cost, advances time, then calls `locations.visit`,
  which reloads actions and rolls biome events. `action:blocked` covers a missing
  destination.
- Added the **Equipment** panel (Find armor, inventory, Equip/Unequip) and the **Actions**
  panel's cost/time/travel UI. Armor is shown in the main stat grid and combat note.
- Defend now has a visible effect: with equipment equipped, `combat:damage` reports the
  armor reduction and the real HP loss is smaller.
- Added `test/equipment.test.cjs`, rewrote `test/actions.test.cjs` for outcomes/time/
  travel/equipment, and extended the status tree with equipment, action resolution,
  events and content counts. Docs are at `ENGINE_SPEC.md` v0.9.
- All eight Node test files pass. Browser checks passed for: saving a character, adding
  and visiting locations, Rest advancing 60 minutes, Find armor/Equip/Unequip, Travel to
  another location, a Defend with armor 1 blocking 2 damage, and the new status branches.
  No console errors.
- Added `MODULES.md`, a living per-module handbook: role, files, state, code map, events,
  adjustment tables, gotchas and an update log. It must be updated with every module
  change (also listed in the architecture rules).

## Known limitations and quirks

- Area actions resolve costs, one weighted outcome, time and travel, but have no
  requirements or skill checks yet. Travel can reach any charted location.
- The UI applies action time by stepping whole ticks; there is no separate time-cost API.
- Base stats are stored, and location events/actions can change them. Combat uses Personal
  Combat and armor, but there is no progression, training or opposed-roll system yet.
- Combat is one-on-one and player-first. There is no flee, positioning, initiative, hit
  chance, damage variance or enemy AI; the enemy always attacks.
- Equipment is main-character-only with one body slot. NPCs still fight at armor 0.
  Armor is mirrored to the main character present when the item is equipped; the UI
  requires a saved character before **Find armor**.
- NPC personality traits are generated but do not weight behaviour yet.
- Biome events have no cooldowns, once-only flags, weather filters or requirements.
  Every enabled event is an independent roll on each visit.
- `location:changed` still only clears Temporary Spawn; there is no travel graph,
  coordinates or location connections. Travel moves `currentId` through any known
  location.
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

1. Expand equipment: NPC loadouts, more slots (head/hands/weapon), item quality and
   inventory limits; keep the armor-to-stat bridge event-based.
2. Use stats in action and event checks (success/chance based on skill and difficulty)
   and add requirements such as minimum stamina or a needed item.
3. Add a travel graph/connections between locations with distance and travel time,
   instead of letting Travel reach any charted location.
4. Add per-biome action overrides and test them in the UI.
5. Add event conditions (weather, time, once/cooldown) to the biome event schema.
6. Expand combat: enemy AI, flee, multiple opponents, hit chance/damage variance, or
   initiative, depending on the desired feel.
7. Decide how stats progress through training, actions and equipment.
8. Manually verify both real folder pickers in Chrome/Edge.

## Quick prompt for a new AI

```text
Continue the project at https://github.com/animefordaysXD/TestGame.
Read HANDOFF.md first, then README.md and ENGINE_SPEC.md. Follow the architecture rules
in HANDOFF.md. Run the tests with npm test (Windows: npm.cmd test).

Do not edit engine.js (core v0.2). Keep every module's state slice JSON-safe and make
modules communicate only through events. UI events must be followed by engine.flush();
follow-up events use depth + 1. init() reruns on reset, so subscribe/register only once.
Use engine.rng or the tick rng, never Math.random. Put content in data files. Update the
event catalog and module registry in ENGINE_SPEC.md for every module or event change,
and update MODULES.md (role, code map, events, adjustment table, update log) whenever a
module changes.

Current state: locations, biome events, main-character and NPC base stats, equipment and
armor, personality traits, five area actions with costs/outcomes/time and Travel through
the locations module, and basic player-first combat (Attack/Defend) are working. Start by
asking what feature to build next; do not add unrequested scope.
```
