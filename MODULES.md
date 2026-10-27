# Module Handbook

> **Living document.** Update this file in the same change whenever a module, event,
> state slice, data file, version or tuning value changes. A module change is not
> finished until this file matches the code.
>
> - `ENGINE_SPEC.md` - the contract: core rules, event catalog, module registry.
> - `HANDOFF.md` - session state and what to do next.
> - `DESIGN.md` - what the game is and why: vision, pillars, decisions, roadmap.
> - `IDEAS.md` - running idea list; decisions graduate to `DESIGN.md`.
> - `MODULES.md` (this file) - practical per-module map and adjustment guide.

**Last updated:** 2026-10-27
**Build:** core v0.2, characters v0.3, mainCharacter v0.5, equipment v0.1,
locations v0.2, actions v0.2, travel v0.1, combat v0.1, status viewer (not a module).

---

## Keeping this file current

Use this checklist in every change that touches a module:

1. Update the module's section here: role, code map, events, adjustment table.
2. Add a row to the **Update log** below (date, version, one-line change).
3. Update `ENGINE_SPEC.md` if the slice shape, event catalog or registry changed.
4. Update `status.html` branches (module versions, counts, event catalog) by hand.
5. Update `HANDOFF.md` recent work and limitations, and `README.md` if the player-
   facing feature changed.
6. Run `npm test` (Windows: `npm.cmd test`) and update the module's test file.
7. If the module version changed, bump it in the file header comment, the
   **At a glance** table and the matching `status.html` node.
8. If the change alters what the game is or why, update `DESIGN.md`; log new ideas in
   `IDEAS.md` in the same turn.

Do not record secrets, browser handles or absolute local paths here. Folder
connections are runtime-only and never part of a save.

---

## Update log

Newest first. Keep entries short; details live in the module sections.

| Date | Change | Files |
|---|---|---|
| 2026-10-27 | Added the product docs to the repo: `DESIGN.md` (vision, decisions, travel/time model, roadmap) and `IDEAS.md`; wired them into the reading order and status Docs node. | `DESIGN.md`, `IDEAS.md`, `README.md`, `HANDOFF.md`, `MODULES.md`, `status.html` |
| 2026-10-25 | Travel v0.1: journeys spend time in 5-minute checks, roll a travel event each check, pause on an event, and resume on Continue. The UI drives the clock and calls `locations.visit` only on completion. | `travel/*`, `index.html`, `actions/data.js`, `characters/mainCharacter.js`, `test/travel.test.cjs`, docs, `status.html`, `package.json` |
| 2026-10-24 | Created the module handbook and added it to the doc rules. | `MODULES.md`, `README.md`, `HANDOFF.md`, `ENGINE_SPEC.md`, `status.html` |
| 2026-10-24 | Documented the current six-item armor catalogue and removed stale "no equipment yet" comments. | `HANDOFF.md`, `combat/data.js` |
| 2026-10-24 | Standardized spelling on "armor" and updated the mainCharacter subscription list in the spec. | `ENGINE_SPEC.md`, `equipment/*`, `status.html` |
| 2026-10-24 | Actions v0.2: time, costs, weighted outcomes, equipment rewards and `lastAction`; Travel now visits through locations. | `actions/*`, `test/actions.test.cjs` |
| 2026-10-24 | Equipment v0.1: body-slot armor inventory, auto-equip/swap/unequip, armor mirrored into `stats.armor`. | `equipment/*`, `characters/mainCharacter.js`, `test/equipment.test.cjs` |
| 2026-10-24 | mainCharacter v0.4: applies action effects and the equipment armor bridge; profile stats preserved on edit. | `characters/mainCharacter.js` |
| 2026-10-24 | Travel UI: destination dropdown, whole-tick time stepping, `locations.visit(travelTo)` follow-up. | `index.html`, `README.md` |

---

## At a glance

| Module | Version | Owns slice | Listens to | Emits | UI panel | Test |
|---|---|---|---|---|---|---|
| core (engine) | 0.2 | `time`, `eventLog`, `version`, `seed`, `rngState` | - | bus + tick events | clock/log | covered indirectly |
| characters | 0.3 | `nextId`, `named{}`, `temp{}` | `character:spawn/save/clearTemp`, `location:changed`, `combat:damage` | `character:spawned/saved/tempCleared` | NPC cards | `characters.test.cjs` |
| mainCharacter | 0.5 | `character` | `location:event`, `action:resolved`, `travel:event`, `equipment:equipped/unequipped`, `combat:damage` | `mainCharacter:saved/statChanged/armorChanged` | Main character | `main-character.test.cjs` |
| equipment | 0.1 | `nextId`, `items{}`, `equippedId` | `equipment:add/equip/unequip`, `action:resolved` | `equipment:added/equipped/unequipped` | Equipment | `equipment.test.cjs` |
| locations | 0.2 | `seed`, `createdAt`, `nextId`, `locations{}`, `currentId` | `location:add` | `location:added/visited/event` | Locations + biome events | `locations.test.cjs`, `locations-disk.test.cjs`, `biome-events.test.cjs` |
| actions | 0.2 | `locationId`, `locationName`, `biomeKey`, `actions[]`, `lastAction` | `location:visited`, `action:choose` | `actions:loaded`, `action:chosen/resolved/blocked` | Actions | `actions.test.cjs` |
| travel | 0.1 | `active`, `paused`, route, `elapsedMinutes`, `durationMinutes`, `checks`, `eventCount`, `lastEvent`, `lastCompleted` | `travel:start/advance/continue/cancel` | `travel:started/progress/event/resumed/completed/cancelled` | Travel | `travel.test.cjs` |
| combat | 0.1 | `active`, `round`, `turn`, snapshots, `log[]` | `combat:start/action` | `combat:started/damage/defended/ended` | Combat | `combat.test.cjs` |

Registration order in `index.html`: characters -> mainCharacter -> equipment ->
locations -> actions -> travel -> combat. Keep dependencies registered earlier.

---

## Core engine (`engine.js` v0.2)

**Do not edit it.** If a feature seems to need a core change, add a module instead.

What it does:

- Owns the world clock, event queue, seeded RNG, whole-state save/load and the module
  registry.
- `reset(seed)` rebuilds the state and calls every module's `init(engine)` again.
  Modules must guard subscription setup with a `bound` flag.
- `load(json)` replaces the state and calls `onLoad(engine)`; it does **not** call
  `init()`. Modules re-run their normalization in `onLoad`.
- `fire(event, depth)` queues an event. `flush()` logs and announces it on
  `event:<type>` and then `event`. Depth cap 8, 500 events per flush.
- `step(n)` runs n ticks: `tick:start` -> generators -> flush -> `onTick` -> `tick:end`.
- `slice(name, defaults)` creates the module slice from a deep copy of defaults. Never
  cache the returned object; `load()` replaces it.
- `chancePerTick(chancePerDay)` converts a daily rate for the current tick size.
- RNG is mulberry32; its state is saved so the same seed and actions replay the same
  world. Modules use `engine.rng` (or the tick `rng`), never `Math.random`.

If you need a new shared engine capability, stop and discuss it first: changing core
invalidates `ENGINE_SPEC.md` v1.0 and every test's assumptions.

---

## Shared character stats (`characters/statsData.js`)

`CharacterStatsData.stats` is read by both the characters and mainCharacter modules
and by the UI. It is the single definition of the stat block.

Each entry:

| Field | Meaning |
|---|---|
| `key` | Property name in `character.stats`; also the `{ stat }` key used by events/actions |
| `label`, `short` | Full and compact UI labels |
| `kind` | `resource` (paired `<key>Max`, starts full), `skill` (fixed max), `equipment` (written by equipment) |
| `min`, `max` | Clamp range |
| `start` | Main-character starting value (NPCs use `npcRange`) |
| `npcRange` | `[low, high]` rolled for NPCs |
| `npcBell` | Average three rolls for a mid-range cluster |

Current block: HP, Stamina, Mana (resources), Armor (equipment), then War, Diplomacy,
Personal Combat, Money Management, Intrigue, Intelligence (skills 1-20).

**Adding a stat:** add one entry here. Stat grids, clamping, NPC rolls, save/load and
event effects iterate the list automatically. If `kind` is `equipment`, also add a
bridge that writes it (see `mainCharacter.applyEquipment`); effects deliberately skip
equipment stats. **Changing an existing key** is a save migration: update both
`normaliseStats` functions and the legacy migration in mainCharacter.

**Armor max lives in three places:** `statsData.js` (`armor.max`),
`equipment/data.js` (`maxArmor`) and the UI/status text (`/100`, `"now ${value}/100"`).
Change all of them together.

---

## Characters (`characters/characters.js` v0.3)

### Role

Generates NPCs with shared stats and five personality traits. Keeps them in
Temporary Spawn until saved as a Named NPC. Applies combat damage to the named NPC.
Has no tick generator; spawning is UI-driven.

### Files and state

- `characters/data.js` - names, surnames, age range, 30 traits, opposite pairs.
- `characters/statsData.js` - shared stat definitions.
- `characters/characters.js` - generation, storage, combat damage, disk mirror.
- Slice: `{ nextId, named: { id: character }, temp: { id: character } }`.
- Character: `{ id, gender, name, age, traits[5], stats, createdAtTick, createdAt }`.

### Code map

| Symbol | What it does |
|---|---|
| `rollStat(rng, def)` | Rolls one stat from `npcRange`; `npcBell` averages three rolls |
| `makeStats(rng)` | Builds a full stat block; resources get `<key>Max` |
| `normaliseStats(character)` | Fills/clamps missing stats for old saves |
| `ATTRIBUTES` | Ordered generation recipe: gender, name, age, traits, stats |
| `generate(rng)` | Runs `ATTRIBUTES` in order; later entries see earlier fields |
| `spawn(depth)` | Creates `npc_0001`, puts it in `temp`, optionally writes disk |
| `save(id, depth)` | Moves temp -> named, rewrites the disk mirror |
| `applyCombatDamage(data)` | Lowers the named/temporary NPC's HP to 0..`hpMax` |
| `clearTemp(depth)` | Empties Temporary Spawn (also on `location:changed`) |
| `connectFolder()` | Picks the project root; writes `characters/Named NPC/` and `characters/Temporary Spawn/` |

### Events

- Listens: `character:spawn`, `character:save`, `character:clearTemp`,
  `location:changed` (all UI/future modules), `combat:damage` (applies HP).
- Emits: `character:spawned`, `character:saved`, `character:tempCleared` at
  `depth + 1`.
- Damage is not re-announced as a stat event; `combat:damage` is the record.

### Adjust it

| If you want to... | Change |
|---|---|
| Add names, surnames, traits or opposite pairs | `characters/data.js` |
| Change NPC age range | `characters/data.js` `ageRange` |
| Change NPC stat ranges or bell curve | `characters/statsData.js` `npcRange` / `npcBell` |
| Change how many traits an NPC gets | `characters.js` `chosen.length < 5` in `ATTRIBUTES` |
| Add a generated NPC field | Push `{ key, generate }` into `ATTRIBUTES`; it sees `{ rng, char, engine }` |
| Change spawn/save behavior | `spawn()` / `save()` |
| Change where NPC mirrors are written | `FOLDERS`, and the `"characters"` folder name in `connectFolder()` |
| Make traits affect behavior | Add a module that reads `traits` through events; do not edit generation |

### Gotchas

- `init()` reruns on reset; the module subscribes only once via `bound`.
- NPCs roll armor from `[0, 0]`, so it starts at 0. NPCs cannot equip yet.
- Old saves without stats are filled deterministically from `start` values.
- Disk writes are fire-and-forget; tests use an in-memory picker mock.

---

## Main character (`characters/mainCharacter.js` v0.5)

### Role

Owns the one player character: identity, portrait, shared stats, event/action/travel
effects, combat HP and the armor mirror. It never reads the equipment, actions,
travel or combat slices; everything arrives through events. The UI calls `save()`
directly and then `engine.flush()`.

### Files and state

- `characters/mainCharacterData.js` - genders, age range, name limit, image settings,
  mirror file names.
- `characters/mainCharacter.js` - validation, stats, effects, armor bridge, mirror.
- Slice: `{ character: null }` or one object with
  `{ id, name, gender, age, image, imageSource, stats, createdAtTick, createdAt, updatedAtTick, updatedAt }`.
- `image` is a data URL; `imageSource` is `"upload"` or `"default"`.

### Code map

| Symbol | What it does |
|---|---|
| `normaliseStats(source, legacy)` | Builds/clamps the full stat block; migrates old top-level stamina |
| `defaultStats()` | `normaliseStats(null)` - start values |
| `defaultAvatar(name)` | Generates an SVG initials portrait as a data URL |
| `prepareImage(file)` | Browser-only center-crop, resize, WebP/PNG compression |
| `save(data, depth)` | Validates, preserves stats and the previous custom image, stores, emits `mainCharacter:saved` |
| `applyEffects(depth, effects, eventId)` | Shared clamp-and-apply loop for `{ stat, delta }`; emits one `statChanged` per real change |
| `applyEventEffects` / `applyActionEffects` | Thin wrappers that pass the location event id / action id |
| `applyTravelEffects` | Thin wrapper that applies a `travel:event` interruption with its event id |
| `applyEquipment(data, depth)` | Mirrors `totalArmor` into `stats.armor`; emits `armorChanged` only when it changes |
| `applyCombatDamage(data)` | Lowers HP when `targetId === "main"`; no duplicate event |
| `toJSON()` | Pretty character JSON for the UI |
| `writeToFolder()` / `connectFolder()` | Writes `characters/mainChar/main.json` + `profile.<ext>` |

### Events

- Listens once: `location:event` -> `applyEventEffects`;
  `action:resolved` -> `applyActionEffects`;
  `travel:event` -> `applyTravelEffects`;
  `equipment:equipped` / `equipment:unequipped` -> `applyEquipment`;
  `combat:damage` -> `applyCombatDamage`.
- Emits: `mainCharacter:saved` (identity only, no image); `mainCharacter:statChanged`
  (`{ id, stat, delta, value, max, eventId }`) and `mainCharacter:armorChanged`
  (`{ id, stat: "armor", delta, value, previous, itemId, itemName }`) at `depth + 1`.

### Adjust it

| If you want to... | Change |
|---|---|
| Genders, age range, name length | `mainCharacterData.js` |
| Starting stats | `characters/statsData.js` `start` |
| Image size, quality or upload cap | `mainCharacterData.js` `imageSize`, `imageQuality`, `maxUploadBytes` |
| Default avatar colors or initials | `defaultAvatar()` (logic) |
| Which effects are applied | `applyEffects()`; it skips unknown and `equipment` stats |
| Clamp rules | `statsData.js` `min`/`max`; resources use `<key>Max` |
| Armor text (`/100`) | `applyEquipment()` plus the same text in `index.html` and `status.html` |
| Mirror file names | `mainCharacterData.js` `folder`, `jsonFile`, `imageBase` |
| Keep stats when editing the profile | Already handled in `save()`; do not rebuild stats there |

### Gotchas

- The image is deliberately left out of `mainCharacter:saved` to keep logs and saves small.
- Profile edits keep the current stats and a previously uploaded image.
- Effects never change armor; only equipment does.
- If no character exists, all effect/armor handlers return without writing state.
  An item equipped before the character is saved will not update `stats.armor` later.
- `applyEquipment` accepts `totalArmor` then falls back to `armor`.
- A zero delta is skipped, so no empty log lines.

---

## Equipment (`equipment/equipment.js` v0.1)

### Role

Owns the main character's armor inventory and the one body slot. Announces equip
changes; the character module mirrors armor into its own stat. It never reads or
writes another module's slice.

### Files and state

- `equipment/data.js` - six armor items (`key`, `name`, `slot`, `armor`, `weight`,
  `description`), `slots: ["body"]`, `maxArmor`, `autoEquip`.
- Slice: `{ nextId, items: { id: item }, equippedId }`.
- Item: `{ id: "eq_0001", key, name, slot, armor, equipped, acquiredAtTick, acquiredAt }`.

### Code map

| Symbol | What it does |
|---|---|
| `CATALOG` | Map of catalogue `key` -> definition; unknown keys are rejected |
| `weightedPick(rng, items)` | Random Find armor, weighted by `weight` (default 1) |
| `cleanItem(raw)` | Validates an item during load; drops unknown keys |
| `normalize()` | Repairs `nextId`, drops invalid items, enforces one equipped id |
| `totalArmor()` / `armorFor(id)` | Equipped armor, or 0 for non-main characters |
| `add(depth, data)` | Adds an item; random when no `key`; auto-equips if nothing is worn |
| `equip(itemId, depth)` | Swaps the body item and emits `equipment:equipped` |
| `unequip(depth)` | Clears the slot and emits `equipment:unequipped` with `totalArmor: 0` |

### Events

- Listens: `equipment:add` (`{ key? }`), `equipment:equip` (`{ itemId }`),
  `equipment:unequip`, and `action:resolved` (adds the item named by
  `equipmentKey` with `source: actionId`).
- Emits at `depth + 1`: `equipment:added`, `equipment:equipped`
  (includes `totalArmor` and `previousItemId`), `equipment:unequipped`.

### Adjust it

| If you want to... | Change |
|---|---|
| Add or retune armor | `equipment/data.js` `items` (then use its `key` in `actions/data.js` if it should drop) |
| Change drop odds from Find armor | Item `weight` |
| Change the equip cap | `maxArmor` and `statsData.js` `armor.max` |
| Stop auto-equipping | `autoEquip: false` |
| Add another slot | `slots`, the slice (`equippedId` becomes per-slot), `equip()`/`normalize()`, the UI panel and the armor bridge |
| Let NPCs equip | Extend the slice with per-character loadouts; add new events and a characters-side bridge |
| Change the random source | Keep `engine.rng`; never use `Math.random` |

### Gotchas

- Only one body item can be worn; `equippedId` is the single source of truth.
- Inventory is unlimited and items do not stack.
- `add()` only auto-equips when the slot is empty; it never replaces worn armor.
- Unknown `equipmentKey` values are ignored silently (no item, no error).
- Load drops items whose `key` disappeared from the catalogue; do not rename keys
  without migrating saves.
- `armorFor()` only returns armor for `"main"`; NPCs stay at 0.

---

## Combat (`combat/combat.js` v0.1)

### Role

Runs a deterministic, player-first duel between the main character and one NPC.
Combatant snapshots arrive from the UI so the module never reads another slice.
Damage is announced; the character modules apply it to the real characters.

### Files and state

- `combat/data.js` - action names/descriptions, attack/defend tuning, the unused
  `enemyAction` AI hook, log limit.
- Slice: `active`, `round`, `turn`, `player`, `enemy`, `defending`, `winner*`,
  `loser*`, `startedAt*`, `endedAt*`, `log[]`.
- Snapshots: `{ id, name, hp, hpMax, personalCombat, armor }`.

### Code map

| Symbol | What it does |
|---|---|
| `cleanCombatant(raw, fallback)` | Validates a snapshot; rejects missing ids and 0 HP |
| `attackDamage(attacker)` | `max(minDamage, round(stat * multiplier))` |
| `finish(winner, depth)` | Stores winner/loser, logs, emits `combat:ended` |
| `enemyTurn(depth)` | Applies player armor when defending, emits `combat:damage`, advances the round |
| `playerAttack(depth)` | Player damage; starts the enemy turn if the enemy survives |
| `playerDefend(depth)` | Sets `defending`, emits `combat:defended`, then the enemy turn |
| `start(data, depth)` | Validates snapshots, resets the slice, emits `combat:started` |
| `action(data, depth)` | Accepts `attack` or `defend` only on the player's turn |

### Events

- Listens: `combat:start` (`{ player, enemy }`), `combat:action`
  (`{ action: "attack" | "defend" }`).
- Emits at `depth + 1` (one deeper for the enemy response): `combat:started`,
  `combat:damage`, `combat:defended`, `combat:ended`.
- `combat:damage` includes `amount`, `hpBefore`, `hpAfter`, `hpMax`, `defended`,
  `armor`, `reduction`.

### Adjust it

| If you want to... | Change |
|---|---|
| Rename actions or descriptions | `combat/data.js` `actions` |
| Change attack damage | `combat/data.js` `attack.stat`, `multiplier`, `minDamage` |
| Change Defend strength | `combat/data.js` `defend.armorMultiplier` |
| Change log length | `combat/data.js` `logLimit` (UI shows the last 8) |
| Add an enemy AI | Use the `enemyAction` hook and branch in `enemyTurn()` |
| Change turn order, flee, hit chance, variance | `combat.js` logic; update this doc and `ENGINE_SPEC.md` |
| Change who can fight | UI `startCombat()` checks plus `cleanCombatant()` |

### Gotchas

- The player always moves first; the enemy always attacks.
- Damage has no hit chance or variance; it is fully deterministic.
- Defend reduction is `min(baseDamage, armor * armorMultiplier)`; armor comes from the
  player snapshot, which the UI builds from `stats.armor`.
- The enemy's `armor` is stored but does not reduce player attacks. NPCs cannot equip,
  so this has no effect today; add the reduction if NPC loadouts arrive.
- `start()` refuses to run while a fight is active or if both ids match.
- Lethal player damage skips the counterattack; 0 HP ends the fight immediately.
- After a fight the final snapshots and log remain until a new fight or reset.

---

## Locations (`locations/locations.js` v0.2)

### Role

Generates charted locations and rolls their biome events on a visit. All randomness
uses `engine.rng`. Generation is button-driven; there is no tick generator and no
travel graph. The actions module loads actions from `location:visited`, the travel
module runs the journey, and the UI calls `visit()` for both the Visit button and a
completed journey.

### Files and state

- `locations/data.js` - biomes, weather, nouns, weights, hostility ranges, name
  prefixes/suffixes/patterns, hostility bands.
- `locations/events/<biomeKey>/events.json` - per-biome event content.
- `locations/locations.js` - generation, visits, event cache, disk mirror.
- Slice: `{ seed, createdAt, nextId, locations: { id: loc }, currentId }`.
- Location: `{ id, name, biome, biomeKey, weather, hostility, seed, createdAtTick, createdAt }`.

### Code map

| Symbol | What it does |
|---|---|
| `weatherList(biome)` | Weather options with a `["Clear"]` fallback |
| `weightedPick(rng, items)` | Weighted biome choice |
| `makeName(rng, biome, usedNames)` | Builds a unique name from patterns |
| `hostilityFor(rng, biome)` | Integer roll inside the biome range |
| `ATTRIBUTES` | Ordered generation: biome, name, weather, hostility |
| `normalizeLocation` / `normalizeEvent` | Validate loaded JSON/disk content |
| `generate(rng, usedNames, usedCombos)` | Builds a candidate, avoiding repeated biome+weather until exhausted |
| `add(depth, count)` / `spawn(depth)` | Chart 1-100 locations and emit `location:added` |
| `labelFor(hostility)` | Band label from `hostilityBands` |
| `loadEvents(force)` | Fetch + cache every biome file; records errors |
| `eventStatus()` / `eventsFor(key)` | Load summary / normalized list |
| `checkEvents(loc, depth)` | Independent roll per enabled event; emits `location:event` |
| `visit(id, depth)` | Async: set `currentId`, await events, emit `location:visited`, roll events |
| `writeSeed` / `writeLocation` / `writeAll` / `importDisk` / `connectFolder` | Optional `Locations/<seed>/` mirror |

### Events

- Listens: `location:add` (`{ count? }`).
- Emits: `location:added` (`{ id }`), `location:visited`
  (`{ id, name, biome, biomeKey, weather, hostility }`), `location:event`
  (`{ locationId, locationName, biomeKey, eventId, name, chancePercent, roll, effects }`).
- Biome events roll only on a visit, not every tick.

### Adjust it

| If you want to... | Change |
|---|---|
| Add/retune a biome or weather list | `locations/data.js` `biomes`; add a matching `locations/events/<key>/events.json` |
| Change biome frequency | Biome `weight` |
| Change hostility ranges or labels | `hostility` arrays / `hostilityBands` |
| Change naming | `namePrefixes`, `nameSuffixes`, `namePatterns` |
| Add a generated location field | Push `{ key, generate }` into `ATTRIBUTES`; also update `normalizeLocation()` and the disk seed import |
| Change an event's chance or text | The biome `events.json` (`chancePercent` 0-100 or `chance` 0-1) |
| Disable an event | `enabled: false` in its JSON |
| Change event effects | `effects: [{ stat, delta }]` using `statsData.js` keys; armor is ignored |
| Change how many events can fire | `checkEvents()` (currently all enabled events roll independently) |
| Change event cadence | Add a new event/tick generator; keep using the tick `rng` |
| Change map seed behavior | `init()` seed fallback; note the world seed is the source |

### Gotchas

- `visit()` is async because the first visit fetches JSON. The UI awaits it and then
  calls `engine.flush()`.
- Biome JSON loading uses `fetch`; serve over HTTP, not `file://`. Use **Reload biome
  events** after editing content.
- Duplicate event ids in one file keep the first; load errors are reported in
  `eventStatus()`.
- Events are cached; a reset does not re-fetch unless forced.
- `add()` clamps the count to 1-100.
- Name generation retries 40 times, then appends a number to keep names unique.
- The location mirror writes under `Locations/<seed>/`; on Windows `Locations/` and
  `locations/` are the same folder (case-insensitive). Do not add a broad ignore rule.
- `currentId` means "last visited", not a travel graph. Travel can reach any location;
  the travel module owns the in-between journey and the UI calls `visit()` on arrival.
- `location:changed` only clears Temporary Spawn; it does not move the party or
  change `currentId`.

---

## Actions (`actions/actions.js` v0.2)

### Role

Loads five area actions for the visited biome. On a choice it announces one weighted
outcome plus costs and time. It applies nothing itself: the character module applies
effects, equipment adds rewards, the UI advances the clock, and the travel module runs
a journey when the resolved action carries `travelTo`.

### Files and state

- `actions/data.js` - five default actions plus optional `biomes.<biomeKey>` overrides
  (exactly five entries or the override is ignored).
- Slice: `{ locationId, locationName, biomeKey, actions[], lastAction }`.
- Action:
  `{ id, name, description, timeMinutes, costs[], outcomes[], requiresDestination, travelText }`.
- Outcome: `{ id, name, text, weight, effects[], equipmentKey }`.
- `lastAction` mirrors the last `action:resolved` data and is included in saves.

### Code map

| Symbol | What it does |
|---|---|
| `cleanEffects(list)` | Drops invalid/zero `{ stat, delta }` entries |
| `cleanOutcome(raw, actionId, index)` | Normalizes one outcome; weight <= 0 becomes 1 |
| `cleanAction(action)` | Normalizes fields and clamps `timeMinutes` to 0-1440 |
| `cleanList(list)` | Keeps the first five valid actions |
| `actionsFor(biomeKey)` | Uses the biome override only when it yields five actions |
| `weightedPick(rng, outcomes)` | Picks one outcome by weight |
| `loadFor(depth, data)` | Replaces the area's actions, clears `lastAction`, emits `actions:loaded` |
| `choose(actionId, destinationId, depth)` | Emits chosen, validates travel, merges costs + outcome, stores `lastAction`, emits resolved/blocked |

### Events

- Listens: `location:visited` (load the area) and `action:choose`
  (`{ actionId, destinationId? }`).
- Emits: `actions:loaded`, `action:chosen`, `action:resolved`, `action:blocked` at
  `depth + 1`.
- `action:resolved` data: `{ actionId, name, outcomeId, outcomeName, text, effects,
  timeMinutes, equipmentKey, travelTo, locationId, locationName, atTick, at }`.

### Adjust it

| If you want to... | Change |
|---|---|
| Change the default five actions | `actions/data.js` `default` (keep exactly five) |
| Add biome-specific actions | `actions/data.js` `biomes.<biomeKey>` with five entries |
| Change time/costs/outcomes | The action/outcome fields in `actions/data.js` |
| Change outcome odds | `weight` (relative; default 1) |
| Award armor | Outcome `equipmentKey` matching `equipment/data.js` |
| Give an item on every use | Not supported yet; add an outcome with no effects and an `equipmentKey`, or add a new event |
| Make a new travel action | `requiresDestination: true`, `outcomes: []`, `travelText` |
| Change how time is applied | `index.html` `chooseAction()` for normal actions; `driveTravel()` for journeys |
| Change a journey's duration | The Travel action's `timeMinutes`; travel rounds it up to whole 5-minute checks |
| Add requirements/skill checks | New logic in `choose()` plus a new event; document it |

### Gotchas

- The default list must contain five valid actions or the module throws at load.
  `cleanList` silently drops extra actions after five.
- An override with fewer than five valid actions is ignored completely.
- `action:chosen` is emitted before the destination check, so a blocked travel still
  logs the choice, then `action:blocked`; no costs or time are applied.
- Travel actions have no outcomes, so `outcomeId` is null and `travelTo` is the chosen
  location id.
- Effects are the merged costs + outcome effects; the module never edits stats.
- Saves keep the loaded `actions[]`. Editing `actions/data.js` does not change a save
  until the next visit reloads the area.
- The UI steps `ceil(timeMinutes / tickMinutes)` ticks only for non-travel actions.
  Travel hands `timeMinutes` to the travel module and calls `locations.visit(travelTo)`
  only after the journey completes.
- `lastAction` clears on the next visit; it is not a history log.

---

## Travel (`travel/travel.js` v0.1)

### Role

Runs a journey from the current location to a destination after a Travel action
resolves. It owns the in-between state: elapsed minutes, checks, pauses and the last
interruption. Travel spends time in 5-minute checks; after every check it rolls for a
travel event. An event pauses the journey until the player presses **Continue travel**.
The module never advances the clock and never moves the party: the UI steps the clock
and calls `locations.visit(destinationId)` after `travel:completed`.

### Files and state

- `travel/data.js` - `minutesPerCheck` (5), `chancePercent` per check, optional
  `chanceByBiome` overrides, and the travel event catalogue.
- `travel/travel.js` - journey lifecycle, checks, pause/resume, duration rounding.
- Slice:
  `{ active, paused, originId, originName, destinationId, destinationName,
  destinationBiomeKey, elapsedMinutes, durationMinutes, minutesPerCheck, checks,
  eventCount, pausedAtMinutes, lastEvent, lastCompleted }`.
- Event: `{ id, name, text, weight, enabled, effects: [{ stat, delta }] }`; disabled
  entries are skipped at load.
- `lastEvent` stores the interruption that caused the current pause:
  `{ eventId, name, text, effects, roll, elapsedMinutes, durationMinutes,
  destinationId, destinationName, atTick, at }`.
- `lastCompleted` stores the arrival summary:
  `{ destinationId, destinationName, originId, originName, elapsedMinutes,
  durationMinutes, eventCount, atTick, at }`.

### Code map

| Symbol | What it does |
|---|---|
| `cleanEffects(list)` | Drops invalid/zero `{ stat, delta }` entries |
| `cleanEvent(raw, index)` | Normalizes one travel event and skips `enabled: false` |
| `weightedPick(rng, events)` | Picks one event by relative weight |
| `chanceFor(biomeKey)` | Per-check chance from the biome override, else `chancePercent` |
| `normalize()` | Repairs a loaded slice and clears invalid active journeys |
| `start(data, depth)` | Stores the route and duration; rounds duration up to whole checks; emits `travel:started` |
| `advance(depth, data)` | Adds one check, rolls for an event, pauses or emits progress/completion |
| `complete(depth)` | Clears `active`, writes `lastCompleted`, emits `travel:completed` |
| `resume(depth)` | Clears `paused` and emits `travel:resumed`; the next advance continues/completes |
| `cancel(depth)` | Abandons the journey without completing it; no refund |

### Events

- Listens: `travel:start` (`{ destinationId, destinationName, durationMinutes,
  originId?, originName?, destinationBiomeKey? }`), `travel:advance`
  (`{ minutes? }`), `travel:continue`, `travel:cancel`.
- Emits at `depth + 1`: `travel:started`, `travel:progress`, `travel:event`,
  `travel:resumed`, `travel:completed`, `travel:cancelled`.
- `travel:event` carries `effects`; `mainCharacter` listens and applies them, emitting
  `mainCharacter:statChanged` one depth deeper.
- The UI emits `travel:advance` once per 5-minute step; the module does not schedule
  itself.

### Adjust it

| If you want to... | Change |
|---|---|
| Change check length | `travel/data.js` `minutesPerCheck` (keep 5 unless the UI tick loop is updated) |
| Make interruptions more/less common | `chancePercent`, or a biome entry in `chanceByBiome` |
| Add/retune a travel event | `travel/data.js` `events` (`weight`, `text`, `effects`) |
| Disable an event without deleting it | `enabled: false` |
| Change event effects | `effects: [{ stat, delta }]` using `statsData.js` keys; armor is ignored |
| Change journey duration | The Travel action's `timeMinutes` in `actions/data.js` |
| Change pause/resume wording or UX | `travel/travel.js` event text plus the Travel panel in `index.html` |
| Add event choices (fight/continue/turn back) | Add a request event and options; keep resolution in modules, not the UI |
| Let travel move the party | It already asks the UI to call `locations.visit` on completion; do not call locations from this module |
| Change tick behavior during travel | `index.html` `driveTravel()`; it temporarily uses 5-minute ticks and restores the old size |

### Gotchas

- Travel events are a separate catalogue from biome events. Biome events still roll
  once when the destination is visited at the end of the journey.
- Positive events pause travel too, because every event is a scene the player sees.
- Duration is rounded up to a whole number of checks: 27 minutes becomes 30, in three
  5-minute checks. The action still announced 27 minutes, so keep travel times
  multiples of 5 in content.
- An event on the final check pauses the journey; after Continue, the next
  `travel:advance` completes without adding a phantom check. The UI checks
  `elapsed >= duration` and does not step another tick before that advance.
- The module does not move `state.time`; the UI owns the clock. This keeps travel
  testable without a real clock and avoids editing core state directly.
- `driveTravel()` restores the player's previous tick size after completion or pause.
  A 5-minute tick size is a temporary travel setting. Any future generator or `onTick`
  module runs once per travel check while the journey is being driven.
- Starting a journey while one is active is ignored. Cancel does not refund time,
  costs or stat effects already spent.
- A saved in-flight journey survives `load()` (including a pause and `lastEvent`).
  Continue works after load; the UI does not auto-resume on its own.
- Travel events cannot start combat yet. Use effects only; add a new request/event pair
  if an interruption should hand off to the combat module.

---

## UI wiring (`index.html`)

The page is not a module. It registers modules, renders panels and fires requests.

| Area | Key symbols | Notes |
|---|---|---|
| Module registration | `createCharactersModule`, `createMainCharacterModule`, `createEquipmentModule`, `createLocationsModule`, `createActionsModule`, `createTravelModule`, `createCombatModule` | Registration order matters; add new modules before their dependents |
| Request helper | `act(type, data)` | `engine.fire(...)` then `engine.flush()`; use it for simple buttons |
| Action flow | `chooseAction(action, destinationId)` | Fires, flushes, then steps time for a normal action or hands `travelTo` to `beginTravel()` |
| Travel flow | `beginTravel(last)` / `driveTravel()` / `arriveTravel(completed)` | Starts a journey, steps the clock one 5-minute tick per check, restores the tick size, and visits the destination only on completion |
| Travel panel | `renderTravel()` / `#travelContinue` / `#travelCancel` | Shows route, elapsed minutes, checks and the paused event; Continue clears the pause and resumes |
| Main character | `#mcSave` handler | Calls `mainCharModule.save(...)` directly, then `engine.flush()` |
| Combat | `combatSnapshot(c)` / `startCombat(c)` | Snapshots include `stats.armor`; the module never reads slices |
| Renderers | `renderChars`, `renderMainCharacter`, `renderMainStats`, `renderEquipment`, `renderActions`, `renderTravel`, `renderCombat`, `renderLocations` | Re-run on their module events and on reset/load; the clock renderer runs on tick end |

When adding a panel: add markup, a render function, subscribe to the module's events,
call the renderer on `reset`/`load`, and add the script tag if a new data file is used.

## Status page (`status.html`)

Hand-maintained viewer. It reads `localStorage` `save1` (or a loaded JSON) and never
registers modules. Keep it in sync:

- Per-module branches with version strings and live slice fields.
- The event catalog nodes and its count.
- Content nodes (catalogue counts, actions, travel events, biome events).
- The test list and its count.
- The **Docs** node.

Adding or changing an event means updating both the `Request events` / `Module events`
groups and the group count shown on the parent node.

## Adding a module

1. Create `<module>/data.js` (content) and `<module>/<module>.js` (logic), plus a
   `README.md` for module-specific notes.
2. Give the module a unique `name`, `depends: []`, and a factory that returns it.
3. In `init(engine)`: create the slice with `engine.slice(name, defaults)`, normalize
   it, and subscribe/register generators exactly once behind a `bound` flag.
4. In `onLoad(engine)`: re-acquire the slice and normalize; do not subscribe again.
5. Announce results with `engine.fire(...)` at `depth + 1`; never call another module.
6. Add the script tags to `index.html` and `status.html` as needed.
7. Register it in `index.html` after its dependencies.
8. Add a Node test with a fake engine/state; follow the existing `test/*.test.cjs`
   pattern (no DOM).
9. Update `ENGINE_SPEC.md` (registry + event catalog), this file, `HANDOFF.md`,
   `README.md`, `status.html` and `package.json`'s test script.
10. Run `npm test` and do a browser smoke test.

## Cross-module flows

```text
Visit
  location:visited
    -> actions loads five actions (actions:loaded)
    -> enabled biome events roll (location:event)
       -> mainCharacter applies effects (mainCharacter:statChanged)
  -> UI engine.flush()
```

```text
Choose action
  action:choose
    -> action:chosen, action:resolved (effects, time, equipmentKey?, travelTo?)
       -> mainCharacter applies effects
       -> equipment adds a rewarded item (equipment:added/equipped)
          -> mainCharacter mirrors armor (mainCharacter:armorChanged)
  -> UI flush
     -> normal action: step whole ticks
     -> travelTo: travel:start -> travel:started
        -> UI steps a 5-minute tick, then travel:advance
           -> travel:progress (quiet check; loop continues)
           -> travel:event (pause)
              -> mainCharacter applies effects; Continue -> travel:resumed
           -> travel:completed
              -> UI restores tick size and calls locations.visit(destinationId)
                 -> the Visit flow above
```

```text
Travel interruption
  travel:advance
    -> travel:event (paused, effects)
       -> mainCharacter applies effects (mainCharacter:statChanged)
  -> UI shows the event and waits; no clock or journey progress while paused
  -> travel:continue -> travel:resumed -> UI resumes the 5-minute loop
```

```text
Fight
  combat:start (snapshots)
    -> combat:started
    -> combat:action -> combat:damage / combat:defended -> combat:ended
       -> mainCharacter / characters apply HP
  -> UI engine.flush()
```

## Quick "where do I change..." table

| Goal | File |
|---|---|
| Vision, pillars, decisions, roadmap | `DESIGN.md` |
| New idea or unapproved preference | `IDEAS.md` |
| Add/tune a stat | `characters/statsData.js` |
| More NPC names or traits | `characters/data.js` |
| Character creation rules or portrait limits | `characters/mainCharacterData.js` |
| Armor stats, drop weights, auto-equip | `equipment/data.js` |
| Attack/defend formulas, combat log size | `combat/data.js` |
| Biomes, weather, naming, hostility bands | `locations/data.js` |
| Biome event text/chance/effects | `locations/events/<biome>/events.json` |
| Area actions, costs, outcomes, travel | `actions/data.js` |
| Travel event text/chance/effects, check length | `travel/data.js` |
| Journey duration | Travel action `timeMinutes` in `actions/data.js` |
| Travel pause/resume UI | `index.html` Travel panel + `driveTravel()` |
| Draw order, new fields in generation | The module's `ATTRIBUTES` array |
| Event names or depth handling | The emitting module, then `ENGINE_SPEC.md` + `status.html` |
| Panel markup or button wiring | `index.html` |
| Node tree display | `status.html` |
| Engine behavior | **Do not edit**; add a module |
