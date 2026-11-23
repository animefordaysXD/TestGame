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

**Last updated:** 2026-11-02
**Build:** core v0.2, characters v0.6, mainCharacter v0.7, creator v0.1, equipment v0.4,
locations v0.5, map v0.2, actions v0.3, travel v0.2, combat v0.2,
encounters v0.1, save helper v0.1, status viewer and content editor (both tools, not modules).

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
| 2026-11-23 | Creator v0.1: a data-driven character creator chooses a background, origin and focus that add starting stats and equipment. `creator:create` previews/validates a draft, fires `mainCharacter:create` with the computed stats, grants the kit through `equipment:add`, then emits `creator:created`. MainCharacter v0.7 accepts `data.stats`/`data.creator` and stores the build summary. The UI gains three selects and a live preview; the editor edits `characters/creatorData.js` (settings, backgrounds, origins, focuses). | `characters/creatorData.js`, `characters/creator.js`, `characters/mainCharacter.js`, `editor/schemas.js`, `index.html`, `status.html`, `test/creator.test.cjs`, docs |
| 2026-11-23 | Added working biome events to seven of ten biomes: forest Wolf Pack, grassland Wild Berries, hills Old Cairn, coast Washed-Up Crate, desert Heat Haze and swamp Miasma, joining the tundra Snowfall. Each pairs a themed effect with a positive, negative or neutral hostility modifier; the remaining three biomes keep their disabled templates. | `locations/events/*/events.json`, docs |
| 2026-11-05 | Map v0.2: the world is now static. `map/data.js` holds twelve authored sites and thirteen routes plus interior presets; `map:load` is idempotent and `map:generate` stays as an alias. Sites use `autoLink: false` and the new `location:link` request installs the authored graph. Landmarks generate a room-and-corridor interior on the first visit with `engine.rng`, store it in `map.terrain` and reuse it. The UI/status show the static map and terrain, and the editor now edits the map. | `map/*`, `locations/locations.js`, `editor/schemas.js`, `index.html`, `status.html`, `test/map.test.cjs`, docs |
| 2026-11-02 | Characters v0.6 and encounters v0.1: NPCs store a relation `{ value, type }` (-100..100 with data-driven bands/labels) and a level; `relationFor`, `setRelation`, `adjustRelation` and `levelFor` expose them. Locations v0.5 add per-biome level ranges, a location `level`, and hostility-modified biome event chances. The new `encounters` module spawns hostility-scaled hostile NPCs on `location:visited` and awards hostility-scaled loot on `combat:ended`; source-tagged clearing keeps ordinary spawns. The UI/status show relations, levels and encounters, and the editor now edits locations and encounters. | `characters/*`, `locations/*`, `encounters/*`, `editor/schemas.js`, `index.html`, `status.html`, tests, docs |
| 2026-11-01 | Equipment v0.4: added data-driven weapon types (`sword`, `spear`, `axe`, `mace`) and armor types (`cloth`, `leather`, `mail`, `plate`, `scale`). Every catalogue item now carries `weaponType` or `armorType`; added a five-rarity axe family; saves missing a type fall back to the catalogue definition. `equipment:add` accepts `weaponType`/`armorType` filters, module events and the UI/status views show type labels, and the editor validates type keys and wrong-kind fields. | `equipment/*`, `editor/schemas.js`, `index.html`, `combat/combat.js`, tests, docs, `status.html` |
| 2026-10-31 | Equipment v0.3: swords, spears and maces fill one weapon slot with base damage, a Strength requirement and armor piercing. Added five rarity ranks (Common, Uncommon, Rare, Legendary, Unique) with strict stat bands, a shared `strength` stat, rarity/kind filtered random finds and `equipment:remove` destruction. Combat v0.2 adds weapon damage, Strength gating and armor piercing, and armor now reduces every hit while Defend doubles it. The game UI gains Find armor/Find weapon, rarity labels, a weapon slot, Strength-gated equipping and Destroy buttons; the editor validates kind, rarity and bands. | `characters/statsData.js`, `equipment/*`, `combat/*`, `index.html`, `editor/schemas.js`, tests, docs, `status.html` |
| 2026-10-31 | Equipment v0.2: armor now targets the ten body-part keys from `characters/bodyData.js` through `parts: []`. Items can cover several parts, several items can be worn at once, and overlapping parts replace conflicting items whole. Total armor sums worn items (clamped to `maxArmor`); `equippedByPart` replaces `equippedId`, with v0.1 save migration. Added head, arm, leg, hand and foot armour plus a body coverage view in the game and status tree. The editor gains a body-part multi-select, body-data reference and part checks. | `equipment/*`, `index.html`, `editor/*`, `test/equipment.test.cjs`, `test/editor.test.cjs`, docs, `status.html` |
| 2026-10-31 | Bodies: every NPC and the main character now own the same ten-part humanoid body (`head`, `torso`, paired legs/arms/hands/feet) from `characters/bodyData.js`, built/normalised by `characters/body.js`. Parts store `key`, `label`, `kind`, `side`, `parent`, `vital` and `status` (`"intact"` by default). Characters v0.5 and mainCharacter v0.6 add `body` to generation, save/load, migration and their UI; old saves gain missing parts and keep saved statuses. Status-only for now: no injury, combat or healing rule reads it; equipment uses the part keys. | `characters/bodyData.js`, `characters/body.js`, `characters/characters.js`, `characters/mainCharacter.js`, `index.html`, tests, docs, `status.html` |
| 2026-10-31 | Added the content editor (`editor.html` + `editor/core.js` + `editor/schemas.js`), a tool with no state and no events. It edits biome events, travel, armor, actions and character names/traits/ages; saves are strict JSON with headers preserved, and unknown fields/read-only slices such as `behaviorAxes` and `personalities` survive. Added `test/editor.test.cjs` and fixed the literal "null" help text and duplicate outcome ids found while testing. | `editor.html`, `editor/*`, `characters/data.js`, `travel/data.js`, `equipment/data.js`, `actions/data.js`, `test/editor.test.cjs`, `test/serve.cjs`, `package.json`, docs, `status.html` |
| 2026-10-29 | Map v0.1: a separate map spawner requests a configurable batch from locations through `location:add`, always adding the fixed tavern, castle and shack landmarks from `map/data.js`. Locations v0.4 accepts fixed definitions, stores `kind`, and reports the batch so `map:generated` fires after the last `location:added`. | `map/*`, `locations/*`, `index.html`, `test/map.test.cjs`, `test/save.test.cjs`, `package.json`, docs, `status.html` |
| 2026-10-29 | Characters v0.4: 30 named personality archetypes each carry five traits and an eight-axis behavior profile (`aggression`, `caution`, `sociability`, `honesty`, `generosity`, `loyalty`, `curiosity`, `ambition`, 0-100). Generated NPCs store `personality: { id, name }`, their trait copy and `behavior`; legacy saves without these fields are migrated by personality id or nearest trait overlap. Behavior is data-only until a future AI module reads it. | `characters/data.js`, `characters/characters.js`, `index.html`, `test/characters.test.cjs`, docs, `status.html` |
| 2026-10-29 | Save files v0.1: `GameSave` captures the world seed, baseline options and a change list, exports/imports JSON, migrates legacy full-state saves and rejects unsafe paths. The page gains **Export save file** / **Import save file**; quick save stays in `localStorage`. `index.html` now builds live and baseline worlds through one `buildEngine()` factory. | `save/*`, `index.html`, `test/save.test.cjs`, `package.json`, docs, `status.html` |
| 2026-10-27 | Travel graph: locations own bidirectional routes with distance; Travel only offers connected destinations and route distance sets journey time; actions accept route minutes and announce `travelDistance`; travel echoes the route distance. Legacy saves/imports are repaired without RNG. | `locations/*`, `actions/*`, `travel/*`, `index.html`, tests, docs, `status.html` |
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
| save helper | 0.1 | none (not a module) | none | none | Export/Import save file | `save.test.cjs` |
| characters | 0.6 | `nextId`, `named{}`, `temp{}` | `character:spawn/save/clearTemp`, `location:changed`, `combat:damage` | `character:spawned/saved/tempCleared/relationChanged` | NPC cards + body line | `characters.test.cjs`, `relations.test.cjs` |
| mainCharacter | 0.7 | `character` (optional `creator` summary) | `location:event`, `action:resolved`, `travel:event`, `equipment:equipped/unequipped`, `combat:damage`, `mainCharacter:create` | `mainCharacter:saved/statChanged/armorChanged` | Main character + body grid | `main-character.test.cjs` |
| creator | 0.1 | `lastCreated` | `creator:create` | `mainCharacter:create`, `equipment:add`, `creator:created` | Main character build selects + preview | `creator.test.cjs` |
| equipment | 0.4 | `nextId`, `items{}`, `equippedByPart{}`, `equippedWeaponId` | `equipment:add/equip/unequip/remove`, `action:resolved` | `equipment:added/equipped/unequipped/removed` | Equipment | `equipment.test.cjs` |
| locations | 0.5 | `seed`, `createdAt`, `nextId`, `locations{}` (with `connections[]`), `currentId` | `location:add`, `location:link` | `location:added/visited/event` | Locations + biome events | `locations.test.cjs`, `locations-disk.test.cjs`, `biome-events.test.cjs` |
| map | 0.2 | `version`, `loaded`, `seed`, `total`, `lastGeneratedTick`, `lastGeneratedAt`, `sites{}`, `landmarks{}`, `terrain{}` | `map:load`, `map:generate`, `location:added`, `location:visited` | `location:add`, `location:link`, `map:generated`, `map:terrainGenerated` | Locations panel (map status + terrain) | `map.test.cjs` |
| actions | 0.3 | `locationId`, `locationName`, `biomeKey`, `actions[]`, `lastAction` | `location:visited`, `action:choose` | `actions:loaded`, `action:chosen/resolved/blocked` | Actions | `actions.test.cjs` |
| travel | 0.2 | `active`, `paused`, `distance`, route, `elapsedMinutes`, `durationMinutes`, `checks`, `eventCount`, `lastEvent`, `lastCompleted` | `travel:start/advance/continue/cancel` | `travel:started/progress/event/resumed/completed/cancelled` | Travel | `travel.test.cjs` |
| combat | 0.2 | `active`, `round`, `turn`, snapshots, `log[]` | `combat:start/action` | `combat:started/damage/defended/ended` | Combat | `combat.test.cjs` |
| encounters | 0.1 | `enemies{}`, `lastVisit`, `lastLoot` | `location:visited`, `character:spawned/tempCleared`, `combat:ended` | `character:clearTemp`, `character:spawn`, `equipment:add` | Location visit status | `encounters.test.cjs` |

Registration order in `index.html`: `bodyData.js` -> `body.js` -> characters -> mainCharacter ->
equipment -> creator -> locations -> map -> actions -> travel -> combat -> encounters. Keep dependencies
registered earlier. The body data/helper must load before the character modules.
The live page and the save baseline both use `buildEngine(opts)`, which registers the same
modules and applies the save's seed/start date/tick size.

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
invalidates `ENGINE_SPEC.md` v1.4 and every test's assumptions.

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

Current block: HP, Stamina, Mana (resources), Strength (skill), Armor (equipment), then
War, Diplomacy, Personal Combat, Money Management, Intrigue, Intelligence (skills 1-20).

**Adding a stat:** add one entry here. Stat grids, clamping, NPC rolls, save/load and
event effects iterate the list automatically. If `kind` is `equipment`, also add a
bridge that writes it (see `mainCharacter.applyEquipment`); effects deliberately skip
equipment stats. **Changing an existing key** is a save migration: update both
`normaliseStats` functions and the legacy migration in mainCharacter.

**Armor max lives in three places:** `statsData.js` (`armor.max`),
`equipment/data.js` (`maxArmor`) and the UI/status text (`/100`, `"now ${value}/100"`).
Change all of them together.

---

## Shared character body (`characters/bodyData.js` + `characters/body.js`)

Every character, NPC or main, owns the same ten-part humanoid body. The layout is content;
the builder/normaliser is shared code used by both character modules.

- `characters/bodyData.js` defines `CharacterBodyData.parts` in display order: `head`,
  `torso`, `leftLeg`, `rightLeg`, `leftArm`, `rightArm`, `leftHand`, `rightHand`,
  `leftFoot`, `rightFoot`. Each entry has `key`, `label`, `kind`, `side`, `parent` and
  `vital`. `defaultStatus` is `"intact"`.
- `characters/body.js` exposes `CharacterBody.create()`, `CharacterBody.normalise(body)` and
  the definitions. It owns no state, emits no events and never touches the DOM.
- Shape: `body: { parts: { <key>: { key, label, kind, side, parent, vital, status } } }`.
  `head` and `torso` are vital, `torso` is the root, arms/legs attach to `torso`, hands to
  their arm and feet to their leg.
- `status` is a free string and starts at `"intact"`. No injury, combat or healing rule
  reads it yet; equipment targets the part keys, not the status.
- `normalise()` rebuilds missing parts, keeps saved statuses and preserves unknown fields on
  known parts. Unknown extra part entries are kept too. Old saves therefore gain a complete
  body without losing anything.

**Adjust it:** edit `bodyData.js` for labels/order/sides/parents/vital flags. Adding or
renaming a part key is a save migration concern; `normalise()` fills new parts but old
statuses are stored under the old key. Change the status vocabulary in `bodyData.js` first,
then add the rule that reads it.

---

## Characters (`characters/characters.js` v0.6)

### Role

Generates NPCs with a named personality archetype, five personality traits, an
eight-axis behavior profile, a relation, a level, shared stats and a ten-part humanoid
body. Keeps them in Temporary Spawn until saved as a Named NPC. Applies combat damage to
the named NPC. Has no tick generator; spawning is UI-driven.

Personality and behavior are **data only** for now. No dialogue, NPC event, travel or
combat rule reads `character.behavior`; it exists so a future AI module can act on it
without changing generation or save shape. Relations and levels are likewise foundations:
the encounters module seeds hostile values and levels, but no progression rule reads them.

### Files and state

- `characters/data.js` - names, surnames, age range, 30 traits, opposite pairs,
  30 personality archetypes, `behaviorAxes`, relation bands/types and level bounds.
- `characters/statsData.js` - shared stat definitions.
- `characters/bodyData.js` - shared ten-part body layout.
- `characters/body.js` - shared body builder/normaliser.
- `characters/characters.js` - generation, personality/behavior/body/relation/level
  normalization, storage, combat damage, disk mirror.
- Slice: `{ nextId, named: { id: character }, temp: { id: character } }`.
- Character: `{ id, gender, name, age, personality, traits[5], behavior, relation, level,
  source, stats, body, createdAtTick, createdAt }`.
- `personality` is `{ id, name }`. `behavior` holds one integer 0-100 per axis in
  `CharacterData.behaviorAxes`. `body` is the shared ten-part shape described above.
- `relation` is `{ value, type }`: value is an integer -100..100, type is a key from
  `CharacterData.relations.types`. Bands: `-100..-31` hostile, `-30..0` unfriendly,
  `1..20` ambivalent, `21..40` accepting, `41..60` friendly, `61..100` type-specific
  (neutral = Friendly, ally = Loving, guardian = Protective, merchant = Trusted,
  bandit = Devoted, beast = Bonded).
- `level` is an integer clamped to `CharacterData.levels` (1..100, default 1). It is a
  framework for later progression; nothing derives stats from it yet.
- `source` is `""` for ordinary spawns or a tag such as `"encounter"` so a caller can
  clear only its own temporary NPCs.

### Code map

| Symbol | What it does |
|---|---|
| `rollStat(rng, def)` | Rolls one stat from `npcRange`; `npcBell` averages three rolls |
| `makeStats(rng)` | Builds a full stat block; resources get `<key>Max` |
| `personalityById(id)` | Looks up one archetype by id, or `null` |
| `closestPersonality(traits)` | Picks the archetype with the most trait overlap (legacy saves only) |
| `makeBehavior(profile, saved)` | Clamps saved axes; fills missing axes from the archetype, then 50 |
| `normalisePersonality(character)` | Restores `personality`, `traits` and `behavior`; used by generation and `onLoad` |
| `normaliseStats(character)` | Fills/clamps missing stats for old saves |
| `normaliseBody(character)` | Restores the ten-part body; keeps saved statuses, fills missing parts |
| `relationValue(raw)` / `relationInfo(value, type)` | Normalize a relation and resolve its band/label |
| `normaliseRelation(character)` | Restores `relation` for generation and `onLoad` |
| `levelValue(raw)` / `normaliseLevel(character)` | Clamp a level to the data bounds |
| `ATTRIBUTES` | Ordered generation recipe: gender, name, age, personality, traits, behavior, stats, body |
| `generate(rng)` | Runs `ATTRIBUTES` in order; later entries see earlier fields |
| `spawn(depth, overrides)` | Creates `npc_0001` with optional `{ source, level, relation, locationId, hostility, encounter }`, puts it in `temp`, optionally writes disk |
| `save(id, depth)` | Moves temp -> named, rewrites the disk mirror |
| `relationFor(value, type)` | Resolved relation info for UI/callers |
| `setRelation(id, value, type, depth)` | Sets a relation, emits `character:relationChanged` when the value changes |
| `adjustRelation(id, delta, depth)` | Adds a delta through `setRelation` and clamps |
| `levelFor(character)` | The clamped level for a character |
| `applyCombatDamage(data)` | Lowers the named/temporary NPC's HP to 0..`hpMax` |
| `clearTemp(depth, filter)` | Empties Temporary Spawn, or only entries matching `filter.source` (also on `location:changed`) |
| `connectFolder()` | Picks the project root; writes `characters/Named NPC/` and `characters/Temporary Spawn/` |

### Events

- Listens: `character:spawn` (`{ source?, level?, relation?, locationId?, hostility?,
  encounter? }`), `character:save`, `character:clearTemp` (`{ source? }`),
  `location:changed` (all UI/future modules), `combat:damage` (applies HP).
- Emits: `character:spawned` (`{ id, name, source, level, relation, relationLabel, band,
  locationId?, hostility?, encounter? }`), `character:saved`,
  `character:tempCleared` (`{ ids, source? }`) and `character:relationChanged`
  (`{ id, name, before, after, delta, relation, label, band, previousLabel, source }`) at
  `depth + 1`. `character:spawned` text includes the level.
- Damage is not re-announced as a stat event; `combat:damage` is the record.

### Adjust it

| If you want to... | Change |
|---|---|
| Add names, surnames, traits or opposite pairs | `characters/data.js` |
| Add, retune or rename a personality | `characters/data.js` `personalities` |
| Add or remove a behavior axis | `characters/data.js` `behaviorAxes`, then give every personality a value |
| Change NPC age range | `characters/data.js` `ageRange` |
| Add or retune relation bands, labels or types | `characters/data.js` `relations` |
| Change level bounds | `characters/data.js` `levels` |
| Seed a relation or level when spawning | `character:spawn` data (`relation`, `level`) or `spawn()` |
| Change a relation later | `setRelation()` / `adjustRelation()`; both fire `character:relationChanged` |
| Clear only one caller's temporary NPCs | `clearTemp(depth, { source })` or the `character:clearTemp` event |
| Change NPC stat ranges or bell curve | `characters/statsData.js` `npcRange` / `npcBell` |
| Add or retune body parts, sides, parents or vital flags | `characters/bodyData.js` (shared by NPCs and the main character) |
| Change the default body-part status | `characters/bodyData.js` `defaultStatus` |
| Add a generated NPC field | Push `{ key, generate }` into `ATTRIBUTES`; it sees `{ rng, char, engine }` |
| Change spawn/save behavior | `spawn()` / `save()` |
| Change where NPC mirrors are written | `FOLDERS`, and the `"characters"` folder name in `connectFolder()` |
| Make personality/behavior affect behavior | Add a module that reads `personality`/`behavior` through events; do not edit generation |

### Gotchas

- `init()` reruns on reset; the module subscribes only once via `bound`.
- Personality traits are copied from the archetype, not rolled independently, so the
  five traits and the behavior profile stay coherent. Generation uses one personality
  pick per NPC.
- Legacy NPCs without `personality` get the nearest archetype by trait overlap; if they
  also lack traits, the archetype traits are used. Missing behavior axes fill from the
  archetype, then `50`. Migration is deterministic and does not use RNG.
- NPCs roll armor from `[0, 0]`, so it starts at 0. NPCs cannot equip yet.
- Old saves without stats are filled deterministically from `start` values.
- Old saves without a body get all ten parts on load; a partial body keeps its saved
  statuses and unknown fields, and gains the missing parts. Body generation is
  deterministic and uses no RNG.
- Old saves without a relation or level are migrated deterministically to neutral and
  level 1; no RNG is used for migration.
- `clearTemp()` without a filter still clears every temporary NPC. `source` is opt-in, so
  ordinary UI spawns and encounter spawns can coexist.
- `relationChanged` only fires when the numeric value actually changes; a type-only change
  is silent.
- Disk writes are fire-and-forget; tests use an in-memory picker mock.

---

## Main character (`characters/mainCharacter.js` v0.7)

### Role

Owns the one player character: identity, portrait, shared stats, ten-part body,
starting-build metadata, event/action/travel effects, combat HP and the armor mirror. It
never reads the equipment, actions, travel or combat slices; everything arrives through
events. The UI calls `save()` directly and then `engine.flush()`, or uses the creator module
for a first build.

### Files and state

- `characters/mainCharacterData.js` - genders, age range, name limit, image settings,
  mirror file names.
- `characters/bodyData.js`, `characters/body.js` - shared body layout and normaliser.
- `characters/mainCharacter.js` - validation, stats, body, effects, armor bridge, mirror.
- Slice: `{ character: null }` or one object with
  `{ id, name, gender, age, image, imageSource, stats, body, creator?, createdAtTick, createdAt, updatedAtTick, updatedAt }`.
- `image` is a data URL; `imageSource` is `"upload"` or `"default"`.
- `creator` is optional `{ background, backgroundName, origin, originName, focus, focusName, equipment[] }`.

### Code map

| Symbol | What it does |
|---|---|
| `normaliseStats(source, legacy)` | Builds/clamps the full stat block; migrates old top-level stamina |
| `defaultStats()` | `normaliseStats(null)` - start values |
| `cleanCreator(raw)` | Keeps only the JSON-safe starting-build summary |
| `normaliseCharacter()` | Runs stats + body + creator normalisation on init/load |
| `defaultAvatar(name)` | Generates an SVG initials portrait as a data URL |
| `prepareImage(file)` | Browser-only center-crop, resize, WebP/PNG compression |
| `save(data, depth)` | Validates, accepts optional `data.stats`/`data.creator`, preserves stats/body/image otherwise, stores, emits `mainCharacter:saved` |
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
  `combat:damage` -> `applyCombatDamage`;
  `mainCharacter:create` -> `save` with the creator's validated plan.
- Emits: `mainCharacter:saved` (identity only, no image); `mainCharacter:statChanged`
  (`{ id, stat, delta, value, max, eventId }`) and `mainCharacter:armorChanged`
  (`{ id, stat: "armor", delta, value, previous, itemId, itemName }`) at `depth + 1`.

### Adjust it

| If you want to... | Change |
|---|---|
| Genders, age range, name length | `mainCharacterData.js` |
| Starting stats | `characters/statsData.js` `start` |
| Body parts, labels or status defaults | `characters/bodyData.js` (shared with NPCs) |
| Image size, quality or upload cap | `mainCharacterData.js` `imageSize`, `imageQuality`, `maxUploadBytes` |
| Default avatar colors or initials | `defaultAvatar()` (logic) |
| Which effects are applied | `applyEffects()`; it skips unknown and `equipment` stats |
| Clamp rules | `statsData.js` `min`/`max`; resources use `<key>Max` |
| Armor text (`/100`) | `applyEquipment()` plus the same text in `index.html` and `status.html` |
| Mirror file names | `mainCharacterData.js` `folder`, `jsonFile`, `imageBase` |
| Keep stats when editing the profile | Already handled in `save()`; do not rebuild stats there |
| Change a starting build | `characters/creatorData.js`, not this module |
| Keep body-part statuses when editing the profile | Already handled in `save()` via `B.normalise(existing.body)` |

### Gotchas

- The image is deliberately left out of `mainCharacter:saved` to keep logs and saves small.
- Profile edits keep the current stats, body and a previously uploaded image.
- Body normalisation rebuilds missing parts on load/save, so every saved main character has
  the full ten-part body. Part `status` is stored but no rule changes it yet.
- Effects never change armor; only equipment does.
- If no character exists, all effect/armor handlers return without writing state.
  An item equipped before the character is saved will not update `stats.armor` later.
- `applyEquipment` accepts `totalArmor` then falls back to `armor`.
- A zero delta is skipped, so no empty log lines.

---

## Character creator (`characters/creator.js` v0.1)

### Role

Turns the choice of a background, origin and focus into a starting stat block and an
equipment kit. It never writes the main character or equipment slices: it validates the
draft, then fires `mainCharacter:create`, one `equipment:add` per item and finally
`creator:created`. The UI uses `preview()` for live feedback and the first
**Create character** save; later profile edits go straight to `mainCharacter.save()`.

### Files and state

- `characters/creatorData.js` - `settings.resourceStartPercent`,
  `settings.maxStartingItems`, and the `backgrounds` / `origins` / `focuses` lists. Each
  option has `key`, `name`, `description`, `stats` (effect list) and `equipment` (keys).
- `characters/creator.js` - validation, stat calculation, kit assembly, event requests.
- Slice: `{ lastCreated: null }` or
  `{ name, background, backgroundName, origin, originName, focus, focusName, stats, equipment, createdAtTick, createdAt }`.

### Code map

| Symbol | What it does |
|---|---|
| `baseStats()` | Starts resources at the configured percentage and skills at their `start` values |
| `applyChanges(stats, changes)` | Adds an option's `{ stat, delta }` list and clamps every value |
| `planFor(draft)` | Picks the three options, combines stats and builds the de-duped, capped kit |
| `cleanProfile(draft)` | Name/gender/age rules from `mainCharacterData.js` |
| `preview(draft)` | Stats/equipment preview without validating the profile or changing state |
| `validate(draft)` | Full profile + option validation; returns the `mainCharacter:create` payload |
| `create(depth, draft)` | Stores `lastCreated`, fires the character and equipment requests, then `creator:created` |
| `backgrounds()` / `origins()` / `focuses()` | JSON-safe copies for the UI |
| `status()` | Copy of the slice for the status page |

### Events

- Listens: `creator:create` (`{ draft }`).
- Emits: `mainCharacter:create` (validated plan), `equipment:add` per item
  (`{ key, source: "creator" }`), and `creator:created`
  (`{ name, background, backgroundName, origin, originName, focus, focusName, stats, equipment }`).
- No RNG and no tick generator. `depends: ["mainCharacter", "equipment"]`.

### Adjust it

| If you want to... | Change |
|---|---|
| Add or retune a background, origin or focus | `characters/creatorData.js` lists |
| Change how full resources start | `creatorData.js` `settings.resourceStartPercent` |
| Change the kit size cap | `creatorData.js` `settings.maxStartingItems` |
| Change stat calculation or validation | `creator.js` `baseStats()` / `planFor()` |
| Change what happens on creation | `creator.js` `create()` event order |

### Gotchas

- Equipment is requested after `mainCharacter:create` so auto-equip and the armor bridge
  see the new character. Do not reorder those events.
- Starting items that conflict with an earlier item stay in the inventory rather than
  replacing worn gear; the kit lists are authored to avoid conflicts today.
- The creator is only used for the first character. Profile edits preserve stats and build
  metadata; there is no in-game rebuild yet.
- The option keys are also the stored creator metadata. Renaming a key in the data file
  makes old saves keep the old display names but still work, because metadata stores names.

---

## Equipment (`equipment/equipment.js` v0.4)

### Role

Owns the main character's armor inventory, the ten body-part assignments and one weapon
slot. Announces equip changes; the character module mirrors the summed armor into its own
stat. It never reads or writes another module's slice.

### Files and state

- `equipment/data.js` - the catalogue, five rarity ranks and the type lists. Every item has
  `kind` (`"armor"` or `"weapon"`), `rarity` and `weaponType` or `armorType`; armor has
  `parts` and `armor`, weapons have `damage`, `strength` and `armorPiercing`. Also
  `maxArmor` and `autoEquip`. `parts` uses the keys from `characters/bodyData.js`.
- Type keys: weapons `sword`, `spear`, `axe`, `mace`; armor `cloth`, `leather`, `mail`,
  `plate`, `scale`. They are listed in `weaponTypes` and `armorTypes`, so adding a family
  is a data change.
- Slice: `{ nextId, items: { id: item }, equippedByPart: { part: id }, equippedWeaponId }`.
- Armor item: `{ id: "eq_0001", key, name, kind: "armor", rarity, armorType, parts, armor,
  equipped, acquiredAtTick, acquiredAt }`.
- Weapon item: `{ id: "eq_0002", key, name, kind: "weapon", rarity, weaponType, parts: [],
  damage, strength, armorPiercing, equipped, acquiredAtTick, acquiredAt }`.

### Code map

| Symbol | What it does |
|---|---|
| `CATALOG` | Map of catalogue `key` -> definition; unknown keys are rejected; armor needs a known part, weapons need damage |
| `cleanParts(value)` | De-duplicates and filters part keys to `characters/bodyData.js` |
| `cleanRarity(value, fallback)` | Falls back to the item definition, then `common` |
| `cleanType(set, value, fallback, defaultKey)` | Validates a `weaponType`/`armorType` against its list |
| `weightedPick(rng, items)` | Random find, weighted by `weight` (default 1) |
| `cleanItem(raw)` | Validates an item during load; migrates legacy `slot` items through the catalogue |
| `normalize()` | Repairs `nextId`, drops invalid items, rebuilds `equippedByPart`, migrates `equippedId` and `equippedWeaponId` |
| `totalArmor()` / `armorFor(id)` | Sum of distinct worn armor (clamped), or 0 for non-main characters |
| `equippedWeapon()` / `weaponFor(id)` | The weapon in the slot, or null; weapons only for `"main"` |
| `rarityFor(key)` | The rarity definition for a key |
| `weaponTypeFor(key)` / `armorTypeFor(key)` | The type definition for a key, or null |
| `coverage()` | Body-ordered `{ part, label, itemId }` rows for the UI |
| `add(depth, data)` | Adds an item; random when no `key`, filtered by `kind`/`rarity`/type; auto-equips a free slot |
| `equip(itemId, depth)` | Claims every part for armor, or the weapon slot; emits `equipment:equipped` |
| `unequip(itemId, depth)` | Removes one item, or every worn item and the weapon when no id is given |
| `remove(itemId, depth)` | Unequips when needed, deletes the item, emits `equipment:removed` |

### Events

- Listens: `equipment:add` (`{ key?, kind?, rarity?, weaponType?, armorType? }`),
  `equipment:equip` (`{ itemId }`), `equipment:unequip` (`{ itemId? }`),
  `equipment:remove` (`{ itemId }`), and `action:resolved` (adds the item named by
  `equipmentKey` with `source: actionId`).
- Emits at `depth + 1`: `equipment:added`, `equipment:equipped` (includes `kind`, `rarity`,
  `weaponType`/`armorType`, `parts`, item stats, `totalArmor` and `replacedItemIds`),
  `equipment:unequipped` (includes `itemIds` and the removed `items`) and
  `equipment:removed`.

### Adjust it

| If you want to... | Change |
|---|---|
| Add or retune armor or a weapon | `equipment/data.js` `items` (then use its `key` in `actions/data.js` if it should drop) |
| Change what armor covers | Its `parts` list, using `characters/bodyData.js` keys |
| Change a weapon's power | Its `damage`, `strength` requirement and `armorPiercing` |
| Change rarity stat bands | `equipment/data.js` `rarities` (the four ranges) |
| Add an item family | Add a `{ key, label }` to `weaponTypes` or `armorTypes`, then use it on items |
| Change drop odds from Find armor/weapon | Item `weight` |
| Change the equip cap | `maxArmor` and `statsData.js` `armor.max` |
| Stop auto-equipping | `autoEquip: false` |
| Add a body part | Add it to `characters/bodyData.js`; equipment and the editor pick it up |
| Let NPCs equip | Extend the slice with per-character loadouts; add new events and a characters-side bridge |
| Change the random source | Keep `engine.rng`; never use `Math.random` |

### Gotchas

- `equippedByPart` is the source of truth for armor and `equippedWeaponId` for the weapon;
  `item.equipped` is a convenience flag.
- Armor items are atomic. Equipping bracers that overlap a gambeson's arms removes the
  whole gambeson, not just its arm coverage.
- A weapon never changes `stats.armor`; its equip/unequip events carry the unchanged
  `totalArmor`, so `mainCharacter` ignores them.
- Inventory is unlimited and items do not stack.
- `add()` auto-equips only when the slot is free; it never replaces worn equipment.
- `equipment:add` with a `rarity`, `kind` or type that matches nothing returns `null` and
  fires no event.
- A saved item's missing or unknown type falls back to its catalogue definition, then to
  the first defined type. Types are descriptive; combat reads the numeric stats.
- Unknown `equipmentKey` values are ignored silently (no item, no error).
- Load drops items whose `key` disappeared from the catalogue; do not rename keys
  without migrating saves.
- A v0.1 save's `equippedId` is migrated to `equippedByPart`; `slot` is no longer stored.
- The module does not check Strength when equipping; the UI disables the button and combat
  treats a too-heavy weapon as unusable. Keep those rules aligned.
- `armorFor()` only returns armor for `"main"`; NPCs stay at 0. `weaponFor()` only returns
  the main character's weapon.

---

## Combat (`combat/combat.js` v0.2)

### Role

Runs a deterministic, player-first duel between the main character and one NPC.
Combatant snapshots arrive from the UI so the module never reads another slice.
Damage is announced; the character modules apply it to the real characters.

### Files and state

- `combat/data.js` - action names/descriptions, attack/defend tuning, the unused
  `enemyAction` AI hook, log limit.
- Slice: `active`, `round`, `turn`, `player`, `enemy`, `defending`, `winner*`,
  `loser*`, `startedAt*`, `endedAt*`, `log[]`.
- Snapshots: `{ id, name, hp, hpMax, personalCombat, strength, armor, weapon }`.
  `weapon` is `null` or `{ key, name, damage, strength, armorPiercing, rarity, weaponType? }`.

### Code map

| Symbol | What it does |
|---|---|
| `cleanCombatant(raw, fallback)` | Validates a snapshot, clamps Strength/armor, cleans the weapon; rejects missing ids and 0 HP |
| `cleanWeapon(raw)` | Validates a weapon snapshot; returns null without damage |
| `weaponInHand(combatant)` | Returns the weapon only when Strength meets its requirement |
| `attackDamage(attacker)` | `max(minDamage, round(stat * multiplier) + weaponDamage)` |
| `resolveHit(attacker, defender, defending)` | Base damage, piercing, effective armor, reduction and final amount |
| `finish(winner, depth)` | Stores winner/loser, logs, emits `combat:ended` |
| `enemyTurn(depth)` | Applies the enemy's weapon and the player's armor, emits `combat:damage`, advances the round |
| `playerAttack(depth)` | Player damage against enemy armor; starts the enemy turn if the enemy survives |
| `playerDefend(depth)` | Sets `defending`, emits `combat:defended`, then the enemy turn |
| `start(data, depth)` | Validates snapshots, resets the slice, emits `combat:started` |
| `action(data, depth)` | Accepts `attack` or `defend` only on the player's turn |

### Events

- Listens: `combat:start` (`{ player, enemy }`), `combat:action`
  (`{ action: "attack" | "defend" }`).
- Emits at `depth + 1` (one deeper for the enemy response): `combat:started`,
  `combat:damage`, `combat:defended`, `combat:ended`.
- `combat:damage` includes `amount`, `base`, `hpBefore`, `hpAfter`, `hpMax`, `defended`,
  `armor`, `effectiveArmor`, `armorMultiplier`, `reduction`, `armorPiercing`, `strength`,
  `weapon`, `weaponDamage` and `tooHeavy`.

### Adjust it

| If you want to... | Change |
|---|---|
| Rename actions or descriptions | `combat/data.js` `actions` |
| Change attack damage | `combat/data.js` `attack.stat`, `multiplier`, `minDamage` |
| Change Defend strength | `combat/data.js` `defend.armorMultiplier` |
| Change log length | `combat/data.js` `logLimit` (UI shows the last 8) |
| Change how armor reduces damage | `resolveHit()`; update this doc, `ENGINE_SPEC.md` and tests |
| Change weapon gating or piercing | `weaponInHand()` and `resolveHit()` |
| Add an enemy AI | Use the `enemyAction` hook and branch in `enemyTurn()` |
| Change turn order, flee, hit chance, variance | `combat.js` logic; update this doc and `ENGINE_SPEC.md` |
| Change who can fight | UI `startCombat()` checks plus `cleanCombatant()` |

### Gotchas

- The player always moves first; the enemy always attacks.
- Damage has no hit chance or variance; it is fully deterministic.
- Armor reduces every hit: `effectiveArmor = round(armor * (100 - piercing) / 100)` and
  `reduction = round(effectiveArmor * armorMultiplier)`. `armorMultiplier` is 1 normally
  and 2 while Defend is active.
- A weapon only works at or above its Strength requirement. Otherwise the log says it is
  too heavy and `combat:damage.tooHeavy` is true.
- The player snapshot weapon comes from `equipmentModule.weaponFor("main")`. NPC
  snapshots may carry a weapon, so the counterattack path is ready for NPC loadouts.
- `start()` refuses to run while a fight is active or if both ids match.
- Lethal player damage skips the counterattack; 0 HP ends the fight immediately.
- After a fight the final snapshots and log remain until a new fight or reset.

---

## Locations (`locations/locations.js` v0.5)

### Role

Generates charted locations with a hostility and a level, links them into a travel graph,
and rolls their biome events on a visit. All randomness uses `engine.rng`. Generation is
request-driven (`location:add` from the UI or the map module); there is no tick generator.
The actions module loads actions from `location:visited`, the encounters module rolls a
hostility-scaled encounter from the same event, the travel module runs the journey, and
the UI calls `visit()` for both the Visit button and a completed journey. The graph is an
abstract link graph (no coordinates), so it does not decide how a future map is drawn.

### Files and state

- `locations/data.js` - `defaultHostility` (50) and `defaultLevel` (1), biomes with
  weather, nouns, weights, hostility ranges, `levelRange`, name
  prefixes/suffixes/patterns, hostility bands, `travelGraph` tuning.
- `locations/events/<biomeKey>/events.json` - per-biome event content, including each
  event's `hostilityModifier`.
- `locations/locations.js` - generation, fixed landmarks, routes, visits, event cache,
  disk mirror.
- Slice: `{ seed, createdAt, nextId, locations: { id: loc }, currentId }`.
- Location: `{ id, key, name, biome, biomeKey, kind, weather, hostility, level,
  connections[], seed, createdAtTick, createdAt }`.
- Connection: `{ id, distance }`; the route is stored on both endpoints with the same
  distance.
- `key` is `""` for random locations or the authored content key for a static-map site.
  `kind` is `""` for ordinary locations or a landmark id (`tavern`, `castle`, `shack`) for a
  landmark definition. Landmarks use `biomeKey: "landmark"`.
- `hostility` is 1-100 and `level` is an integer of at least 1; both are frameworks that
  encounters and later progression read.

### Code map

| Symbol | What it does |
|---|---|
| `weatherList(biome)` | Weather options with a `["Clear"]` fallback |
| `weightedPick(rng, items)` | Weighted biome choice |
| `makeName(rng, biome, usedNames)` | Builds a unique name from patterns |
| `uniqueName(base, usedNames)` | Keeps fixed landmark names unique across repeated maps |
| `hostilityFor(rng, biome)` | Integer roll inside the biome range |
| `levelFor(rng, biome)` | Integer roll inside the biome `levelRange` |
| `normalizeFixed(raw)` | Validates a fixed site from `location:add`; keeps `key` and `autoLink` |
| `normalizeDistance` / `travelMinutes` / `rollDistance` | Route distance clamps, distance -> minutes, random distance |
| `cleanConnections(raw)` | Validates loaded routes and de-duplicates ids |
| `ATTRIBUTES` | Ordered generation: biome, name, weather, hostility, level |
| `normalizeLocation` / `normalizeEvent` | Validate loaded JSON/disk content; keeps `kind`, fills level/hostility |
| `generate(rng, usedNames, usedCombos)` | Builds a candidate, avoiding repeated biome+weather until exhausted |
| `add(depth, count, fixed, batch)` / `spawn(depth, fixed, batch)` | Chart fixed landmarks and 0-100 random locations, link each, emit `location:added` |
| `labelFor(hostility)` | Band label from `hostilityBands` |
| `connectionsFor(id)` | UI-ready routes sorted by distance then name |
| `routeBetween(fromId, toId)` | One route (`distance`, `minutes`) or `null` |
| `link(data)` | Installs a static-map route from `{ fromId, toId, distance }`; unknown ids are ignored |
| `addRoute` / `connectNew` / `normalizeGraph` | Internal: mutual edges, link a new location, repair a loaded/imported graph |
| `loadEvents(force)` | Fetch + cache every biome file; records errors |
| `eventStatus()` / `eventsFor(key)` | Load summary / normalized list |
| `eventChance(event, hostility)` | Effective chance after the hostility modifier |
| `checkEvents(loc, depth)` | Independent roll per enabled event; emits `location:event` |
| `visit(id, depth)` | Async: set `currentId`, await events, emit `location:visited`, roll events |
| `writeSeed` / `writeLocation` / `writeAll` / `importDisk` / `connectFolder` | Optional `Locations/<seed>/` mirror |

### Events

- Listens: `location:add` (`{ count?, fixed?, batch? }`), `location:link`
  (`{ fromId, toId, distance }`).
- Emits: `location:added` (`{ id, key?, level, hostility, kind?, batch? }`), `location:visited`
  (`{ id, name, biome, biomeKey, weather, hostility, level }`), `location:event`
  (`{ locationId, locationName, biomeKey, eventId, name, chancePercent,
  baseChancePercent, hostility, hostilityModifier, roll, effects }`).
- Biome events roll only on a visit, not every tick.
- Route changes are part of `location:added`/`location:visited` state; there is no separate
  route event.

### Adjust it

| If you want to... | Change |
|---|---|
| Add/retune a biome or weather list | `locations/data.js` `biomes`; add a matching `locations/events/<key>/events.json` |
| Change biome frequency | Biome `weight` |
| Change hostility ranges or labels | `hostility` arrays / `hostilityBands` |
| Change location level ranges | Biome `levelRange`; `defaultLevel` for missing values |
| Change naming | `namePrefixes`, `nameSuffixes`, `namePatterns` |
| Change route distance, duration or link count | `locations/data.js` `travelGraph` (`distanceRange`, `minutesPerDistance`, `links`, `legacyDistance`) |
| Change which location a new one links to | `connectNew()` (currently current area + random neighbours) |
| Change route validation or repair | `normalizeGraph()` and `addRoute()` |
| Add a generated location field | Push `{ key, generate }` into `ATTRIBUTES`; also update `normalizeLocation()` and the disk seed import |
| Change a fixed landmark's name, biome or hostility | `map/data.js` `landmarks` (content), not this module |
| Add support for another fixed-location field | `normalizeFixed()` and `normalizeLocation()` here |
| Change an event's chance or text | The biome `events.json` (`chancePercent` 0-100 or `chance` 0-1) |
| Make an event react to hostility | Its `hostilityModifier` (-1..1); see `locations/events/README.md` |
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
- `add()` clamps random counts to 0-100; fixed landmarks are always added. A request with
  both `fixed` and `count` adds every fixed entry first, then the random count.
- Fixed landmarks bypass the biome/weather uniqueness roll but still receive routes and
  `location:added`. Their synthetic `biomeKey: "landmark"` has no event file, so visits
  cannot trigger biome events on them.
- Name generation retries 40 times, then appends a number to keep names unique. Fixed
  landmark names get a ` (2)` suffix if the same map is generated twice.
- The location mirror writes under `Locations/<seed>/`; on Windows `Locations/` and
  `locations/` are the same folder (case-insensitive). Do not add a broad ignore rule.
- `currentId` means "last visited". The UI's **Visit** button only allows a direct route
  from it (or any location when none is current), but `visit()` itself stays permissive
  for arrival handoffs and tests.
- `location:changed` only clears Temporary Spawn; it does not move the party or
  change `currentId`.
- `eventChance()` clamps hostility to 1-100, so a "0" input behaves like 1: a bad event
  with modifier 1 still has a tiny chance (2% of its base) rather than exactly 0.
- Event `hostilityModifier` is clamped to ±4, but shipped content stays within ±1 so the
  effective chance at hostility 100 is at most doubled (or removed).
- Old saves and fixed definitions without `level` get the biome's minimum level (or
  `defaultLevel`); missing hostility gets `defaultHostility`. Both migrations are
  deterministic.
- Legacy saves and hand-edited imports without `connections` are repaired on load. The
  repair links isolated locations deterministically and does not use the RNG.

---

## Encounters (`encounters/encounters.js` v0.1)

### Role

Turns hostility into hostile NPCs and loot. The module owns the `encounters` slice and
communicates only through events. On `location:visited` it asks the characters module to
clear its previous spawns, rolls the location's hostility band, and fires one
`character:spawn` per enemy with a low relation and a hostility-scaled level. When the
player wins a fight against one of those enemies (`combat:ended` with
`winnerId: "main"`), it rolls a drop and asks the equipment module for an item from a
hostility-scaled rarity band. It never reads another module's slice.

### Files and state

- `encounters/data.js` - spawn bands, `clearSource`, `maxPerVisit`, enemy relation curve,
  levels tuning, drop chance and loot rarity bands / kind weights.
- `encounters/encounters.js` - visit/spawn/loot flow, source mapping and state.
- Slice: `{ enemies: { id: enemy }, lastVisit: null, lastLoot: null }`.
- Enemy record: `{ id, name, locationId, hostility, level, relation, relationType,
  spawnedAtTick }`.
- `lastVisit`: `{ locationId, locationName, hostility, level, band, chancePercent, roll,
  triggered, count }`.
- `lastLoot`: `{ enemyId, enemyName, locationId, hostility, level, dropChancePercent, roll,
  awarded, kind, rarity }`.

### Code map

| Symbol | What it does |
|---|---|
| `bandFor(bands, key, hostility)` | First band whose `maxHostility` covers the value |
| `spawnBandFor(hostility)` | The spawn band for a visit |
| `relationFor(hostility)` | Enemy relation from `base + perHostility * hostility`, clamped |
| `enemyLevelFor(locationLevel, hostility)` | Location level plus `floor((hostility - 50) / hostilityPerLevel)` |
| `dropChanceFor(hostility)` | Drop chance from the base and per-hostility change, capped |
| `lootBandFor(hostility)` / `rarityFor(hostility)` | Rarity band and one rarity roll |
| `kindFor()` | Weighted armor/weapon pick |
| `onVisit(data, depth)` | Clears the old source, rolls spawn chance/count, fires spawns, stores `lastVisit` |
| `onSpawned(data)` | Maps a source-tagged `character:spawned` to an enemy record |
| `onCombatEnded(data, depth)` | On a main win, rolls the drop and fires `equipment:add` |
| `onTempCleared(data)` | Drops records for cleared ids |
| `enemiesFor(locationId)` / `lastVisit()` / `lastLoot()` | UI/status accessors |

### Events

- Listens: `location:visited`, `character:spawned`, `character:tempCleared`,
  `combat:ended`.
- Emits: `character:clearTemp` (`{ source }`) and `character:spawn` (with `source`,
  `locationId`, `hostility`, `level`, `relation`) from a visit, plus `equipment:add`
  (`{ kind, rarity, source: "loot", enemyId }`) on a winning fight. It does not emit its
  own event type; the state and the forwarded spawns/loot are the record.

### Adjust it

| If you want to... | Change |
|---|---|
| Change spawn odds or enemy counts | `encounters/data.js` `spawn.bands` (`chancePercent`, `minCount`, `maxCount`) |
| Change the maximum enemies per visit | `spawn.maxPerVisit` |
| Change the source tag used for clearing | `spawn.clearSource` (also update any external callers) |
| Make enemies friendlier/hostiler | `relations.base`, `relations.perHostility`, `relations.type` |
| Change how fast enemies level | `levels.hostilityPerLevel` |
| Change drop odds | `loot.dropChancePercent`, `chancePerHostility`, `maxDropChancePercent` |
| Change loot rarity by danger | `loot.rarityBands` (raise `maxHostility` and add rarities) |
| Change armor vs weapon frequency | `loot.kindWeights` |
| Change which location stats are read | `onVisit()`; locations sends them in `location:visited` |
| Stop automatic encounters | Give the module no bands, or do not register it |

### Gotchas

- The module is event-driven: register characters/equipment first, and register
  encounters in `buildEngine()` so saves include its slice.
- A visit clears only `source: "encounter"` spawns. Ordinary UI spawns and Named NPCs are
  untouched.
- The queued `character:tempCleared` arrives before the new `character:spawned` events,
  so the mapping drops old ids without deleting new enemies.
- Loot is awarded only when the main character wins and the loser is a mapped encounter
  enemy. Enemy wins and ordinary NPC fights award nothing.
- Rarity is picked from the band's list uniformly; weighting inside a band is not
  supported yet.
- `lastVisit` and `lastLoot` are informational and survive save/load.
- All randomness uses `engine.rng`; never add `Math.random`.

---

## Map (`map/map.js` v0.2)

### Role

Owns the authored world map and its procedural interiors. The world is **static**: every
game loads the same sites and routes from `map/data.js`, so this module never charts random
world locations. It asks the locations module to create the fixed sites through
`location:add`, installs the authored routes through `location:link`, and generates a
room-and-corridor interior for a landmark the first time it is visited. It never reads or
writes the locations slice; requests and results travel as events. The terrain generator is
self-contained so future travel terrain can reuse it.

### Files and state

- `map/data.js` - `world.name`, `world.locations` (twelve authored sites with `key`,
  `kind`, `name`, `biome`, `biomeKey`, `weather`, `hostility`, `level`, optional
  `interior`), `world.routes` (`{ id, from, to, distance }`), `terrain.tiles`,
  `terrain.legend` and `terrain.interiors` presets.
- `map/map.js` - validation, the idempotent load, route install, terrain generator and
  accessors.
- Slice:

```js
{
  version: 2, loaded: false, seed: 0, total: 12,
  lastGeneratedTick: null, lastGeneratedAt: "",
  sites: { contentKey: locationId },
  landmarks: { kind: locationId },
  terrain: { locationId: generatedInterior }
}
```

- `total` is the authored site count (`world.locations.length`), not a random batch size.

### Code map

| Symbol | What it does |
|---|---|
| `validSites()` / `validRoutes()` | Drops malformed or duplicate sites/routes; routes must join two known sites |
| `load(depth, data)` | Idempotent static load; fires one `location:add`, installed routes on completion |
| `onLocationAdded(e)` | Records `key -> id` / `kind -> id`; after the last site fires `location:link` per route then `map:generated` |
| `onLocationVisited(e)` | Generates the landmark interior once, when the site declares an `interior` |
| `buildTerrain(preset, engine, id)` | Room-and-corridor generator; uses `engine.rng`, returns tile rows/counts |
| `ensureTerrain(id)` / `terrainFor(id)` | Generate on demand / read the stored interior |
| `siteForLocation(id)` / `siteFor(key)` | Authored site merged with its location id |
| `status()` | Copy of the slice for the UI |

### Events

- Listens: `map:load` (`{}`), `map:generate` (legacy alias), `location:added`,
  `location:visited`.
- Emits: `location:add` (fixed sites), `location:link` (authored routes),
  `map:generated` (`{ batch, total, sites, landmarks, routes, alreadyLoaded? }`) and
  `map:terrainGenerated` (`{ locationId, locationName, interior, label, width, height,
  rooms }`).
- No tick generator. Terrain uses `engine.rng`, so a seed and the same first visit produce
  the same layout.

### Adjust it

| If you want to... | Change |
|---|---|
| Add, remove or retune a site | `map/data.js` `world.locations` (`key` must be unique) |
| Add or move a route | `map/data.js` `world.routes` (`from`/`to` are site keys) |
| Change a landmark's interior | `map/data.js` `terrain.interiors` preset, then set the site's `interior` |
| Change the tile symbols or legend | `map/data.js` `terrain.tiles` / `terrain.legend` |
| Change generation behaviour | `map/map.js` `buildTerrain()` |
| Change how locations are built | `locations/`; this module only requests them |

### Gotchas

- `depends: ["locations"]`; register locations first. The dependency is event-based.
- Sites are sent with `autoLink: false`, so the locations module adds no random routes; the
  authored `world.routes` are the entire graph. If you add a site, add routes for it.
- `map:load` is idempotent. A second call reports `alreadyLoaded: true` and creates no
  locations; a save/load round trip keeps `loaded`, so reloading does not duplicate the map.
- Interiors are generated once and stored in `map.terrain`; later visits reuse the grid.
  They are display-only: no movement, collision, doors or loot yet.
- Reset clears the slice and any in-flight batch. Load normalizes old saves without the new
  fields (they gain `sites`/`terrain`/`version` and keep working with an empty map until
  loaded).

---

## Actions (`actions/actions.js` v0.3)

### Role

Loads five area actions for the visited biome. On a choice it announces one weighted
outcome plus costs and time. It applies nothing itself: the character module applies
effects, equipment adds rewards, the UI advances the clock, and the travel module runs
a journey when the resolved action carries `travelTo`. For a Travel action the UI also
sends the route's `distance` and `durationMinutes`, so the graph decides the journey
time instead of the action's fallback `timeMinutes`.

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
| `choose(actionId, destinationId, depth, request)` | Emits chosen, validates travel, merges costs + outcome; a valid route request overrides time and stores `travelDistance`, then emits resolved/blocked |

### Events

- Listens: `location:visited` (load the area) and `action:choose`
  (`{ actionId, destinationId?, distance?, durationMinutes? }`).
- Emits: `actions:loaded`, `action:chosen`, `action:resolved`, `action:blocked` at
  `depth + 1`.
- `action:resolved` data: `{ actionId, name, outcomeId, outcomeName, text, effects,
  timeMinutes, equipmentKey, travelTo, travelDistance, locationId, locationName, atTick,
  at }`.

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
| Change a journey's duration | `locations/data.js` `travelGraph` (`distanceRange`, `minutesPerDistance`); the Travel action's `timeMinutes` is only a fallback when no route data arrives |
| Add requirements/skill checks | New logic in `choose()` plus a new event; document it |

### Gotchas

- The default list must contain five valid actions or the module throws at load.
  `cleanList` silently drops extra actions after five.
- An override with fewer than five valid actions is ignored completely.
- `action:chosen` is emitted before the destination check, so a blocked travel still
  logs the choice, then `action:blocked`; no costs or time are applied.
- Travel actions have no outcomes, so `outcomeId` is null and `travelTo` is the chosen
  location id. The UI sends the route's `distance`/`durationMinutes`; both are optional,
  so tests and other callers can still use the action's fallback time.
- Effects are the merged costs + outcome effects; the module never edits stats.
- Saves keep the loaded `actions[]`. Editing `actions/data.js` does not change a save
  until the next visit reloads the area.
- The UI steps `ceil(timeMinutes / tickMinutes)` ticks only for non-travel actions.
  Travel hands the route's `durationMinutes` to the travel module and calls
  `locations.visit(travelTo)` only after the journey completes.
- `lastAction` clears on the next visit; it is not a history log.

---

## Travel (`travel/travel.js` v0.2)

### Role

Runs a journey from the current location to a destination after a Travel action
resolves. It owns the in-between state: route distance, elapsed minutes, checks, pauses
and the last interruption. Travel spends time in 5-minute checks; after every check it
rolls for a travel event. An event pauses the journey until the player presses
**Continue travel**. The module never advances the clock and never moves the party: the
UI steps the clock and calls `locations.visit(destinationId)` after `travel:completed`.
Duration is supplied by the caller (normally the route's computed minutes); this module
only rounds it up to whole checks and echoes `distance` for the panel/status.

### Files and state

- `travel/data.js` - `minutesPerCheck` (5), `chancePercent` per check, optional
  `chanceByBiome` overrides, and the travel event catalogue.
- `travel/travel.js` - journey lifecycle, checks, pause/resume, duration rounding.
- Slice:
  `{ active, paused, originId, originName, destinationId, destinationName,
  destinationBiomeKey, distance, elapsedMinutes, durationMinutes, minutesPerCheck, checks,
  eventCount, pausedAtMinutes, lastEvent, lastCompleted }`.
- Event: `{ id, name, text, weight, enabled, effects: [{ stat, delta }] }`; disabled
  entries are skipped at load.
- `lastEvent` stores the interruption that caused the current pause:
  `{ eventId, name, text, effects, roll, elapsedMinutes, durationMinutes,
  destinationId, destinationName, atTick, at }`.
- `lastCompleted` stores the arrival summary:
  `{ destinationId, destinationName, originId, originName, distance, elapsedMinutes,
  durationMinutes, eventCount, atTick, at }`.

### Code map

| Symbol | What it does |
|---|---|
| `cleanEffects(list)` | Drops invalid/zero `{ stat, delta }` entries |
| `cleanEvent(raw, index)` | Normalizes one travel event and skips `enabled: false` |
| `weightedPick(rng, events)` | Picks one event by relative weight |
| `chanceFor(biomeKey)` | Per-check chance from the biome override, else `chancePercent` |
| `normalize()` | Repairs a loaded slice and clears invalid active journeys |
| `start(data, depth)` | Stores the route (`distance`, duration) and duration rounded up to whole checks; emits `travel:started` |
| `advance(depth, data)` | Adds one check, rolls for an event, pauses or emits progress/completion |
| `complete(depth)` | Clears `active`, writes `lastCompleted`, emits `travel:completed` |
| `resume(depth)` | Clears `paused` and emits `travel:resumed`; the next advance continues/completes |
| `cancel(depth)` | Abandons the journey without completing it; no refund |

### Events

- Listens: `travel:start` (`{ destinationId, destinationName, durationMinutes, distance?,
  originId?, originName?, destinationBiomeKey? }`), `travel:advance`
  (`{ minutes? }`), `travel:continue`, `travel:cancel`.
- Emits at `depth + 1`: `travel:started`, `travel:progress`, `travel:event`,
  `travel:resumed`, `travel:completed`, `travel:cancelled`. `travel:started` and
  `travel:completed` echo the route `distance`.
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
| Change journey duration | The route distance in `locations/data.js` `travelGraph`; the UI derives minutes and passes them through `action:resolved` |
| Change distance-to-time conversion | `locations/data.js` `travelGraph.minutesPerDistance` |
| Change pause/resume wording or UX | `travel/travel.js` event text plus the Travel panel in `index.html` |
| Add event choices (fight/continue/turn back) | Add a request event and options; keep resolution in modules, not the UI |
| Let travel move the party | It already asks the UI to call `locations.visit` on completion; do not call locations from this module |
| Change tick behavior during travel | `index.html` `driveTravel()`; it temporarily uses 5-minute ticks and restores the old size |

### Gotchas

- Travel events are a separate catalogue from biome events. Biome events still roll
  once when the destination is visited at the end of the journey.
- Positive events pause travel too, because every event is a scene the player sees.
- Duration is rounded up to a whole number of checks. Route times come from
  `distance * 15` minutes, so they are already multiples of 5; a hand-entered duration
  such as 27 minutes becomes 30, while the action still announced 27. Keep caller times
  multiples of 5 in content.
- `distance` is informational: event chance depends on the destination biome, not on
  route length. Longer routes get more checks, so they still see more total risk.
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

## Save helper (`save/gameSave.js` v0.1)

### Role

Exports and imports a game as a JSON file: world seed + baseline engine options + the changes
needed to rebuild the live state. It is **not a module**: no slice, no events, no tick work. It
sits on top of `engine.serialize()` and `engine.load()` and never edits core. The page and the
Node tests supply the same `buildEngine(opts)` factory for the baseline.

### Format and API

- Format v1: `{ format: "text-rpg-save", formatVersion: 1, savedAt, label, seed, baseline:
  { startDate, tickMinutes }, changes[] }`.
- Changes are `{ op: "set", path, value }` or `{ op: "delete", path }`; paths are arrays.
- Objects diff key by key; arrays (including `eventLog`) are replaced whole.
- `capture(engine, buildEngine)` -> save object.
- `read(textOrObject, { buildEngine })` -> validated/migrated save object.
- `restore(input, engine, { buildEngine })` -> rebuilds the baseline, applies changes, calls
  `engine.load()`, returns the save object.
- `changesBetween`, `applyChanges`, `validate`, `stringify`, `fileName` are exposed for tests/UI.
- `MIGRATIONS = { 0: legacyToV1 }`; v0 is a raw legacy engine state. A newer `formatVersion` is
  refused.
- `test/save.test.cjs` covers all of the above.

### Adjust it

| If you want to... | Change |
|---|---|
| Add a module | Register it in `buildEngine()` in `index.html`; otherwise the save baseline is incomplete |
| Change the file name | `fileName()` |
| Change the change limit | `MAX_CHANGES` (default 20,000) |
| Add a format version | Bump `FORMAT_VERSION`, add `MIGRATIONS[<old>]`, update `save/README.md` and `ENGINE_SPEC.md` |
| Change what is exported | `capture()`; keep `restore()` symmetric |
| Inspect a file by hand | Keep the pretty JSON from `stringify()` |

### Gotchas

- The live engine's seed is ignored on import; the file's seed and baseline win.
- `buildEngine(opts)` must return a **new** engine with every module registered and `opts`
  applied; reusing the live engine would corrupt the diff.
- Save paths must start at a top-level state key and cannot contain `__proto__`, `prototype` or
  `constructor`.
- Quick Save/Load still uses `localStorage` slot `save1`; save files are a separate path.
  `status.html` reads the quick-save slot.
- In-memory event-log entries can hold `data: undefined`; JSON drops that property, so restored
  state matches the JSON form of the live state.
- Today a save is often close to full-state size because most content is created by play.

---

## UI wiring (`index.html`)

The page is not a module. It registers modules, renders panels and fires requests.

| Area | Key symbols | Notes |
|---|---|---|
| Module registration | `buildEngine(opts)` | One factory for the live world and the save baseline; registers modules in dependency order and applies `seed`/`startDate`/`tickMinutes` |
| Request helper | `act(type, data)` | `engine.fire(...)` then `engine.flush()`; use it for simple buttons |
| Save files | `#saveFile`, `#loadFile`, `#saveFileInput` | **Export** calls `GameSave.capture(engine, buildEngine)` and downloads JSON; **Import** reads the file and calls `GameSave.restore(text, engine, { buildEngine })`. Quick Save/Load still uses `localStorage` |
| Action flow | `chooseAction(action, destinationId, route)` | Fires `action:choose` with the route `distance`/`minutes`, flushes, then steps time for a normal action or hands `travelTo` to `beginTravel()` |
| Travel destinations | `renderActions()` | Travel's dropdown is built from `locationsModule.connectionsFor(locationId)`; each option shows name, biome, distance and minutes, and the Choose button is disabled when there are no routes |
| Route gating | `visitLocation(id)` / `renderLocations()` | **Visit** and the Visit button require a direct route from `currentId`; the tooltip names the blocker. `locations.visit()` itself stays permissive |
| Travel flow | `beginTravel(last)` / `driveTravel()` / `arriveTravel(completed)` | Starts a journey with the route distance and time, steps the clock one 5-minute tick per check, restores the tick size, and visits the destination only on completion |
| Travel panel | `renderTravel()` / `#travelContinue` / `#travelCancel` | Shows origin/destination, route distance, elapsed minutes, checks and the paused event; Continue clears the pause and resumes |
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
- The **Save files** node under **World** (quick-save slot vs export/import).

Adding or changing an event means updating both the `Request events` / `Module events`
groups and the group count shown on the parent node.

## Content editor (`editor.html`, tool)

The content editor is a static page, not a module. It has no engine slice, subscribes to
nothing and emits nothing; `buildEngine()` never registers it.

| Area | Key symbols | Notes |
|---|---|---|
| Page | `editor.html` | Forms, list tools, previews, validation display, folder picker, save/download |
| Parser/serializer | `editor/core.js` | Reads the `window.<Global> = {...};` wrapper and plain JSON, preserves the header, writes deterministic compact JSON |
| Content model | `editor/schemas.js` | `FILES`, `REFS`, `SECTIONS` describe each editable file and field; validators, previews and `outcomeIds` live here |
| Tests | `test/editor.test.cjs` | Formatter stability, byte-identical round-trips, schema checks, previews and outcome-id uniqueness |

Editable files: `travel/data.js`, `equipment/data.js`, `actions/data.js`,
`characters/data.js`, `locations/data.js`, `encounters/data.js`, and
`locations/events/<biome>/events.json` for all 10 biomes.
Read-only references: `characters/statsData.js`, `characters/bodyData.js`, `combat/data.js`.

Rules that keep saves loss-free:

- The object inside the wrapper is strict JSON. Unknown fields are kept, and sections only
  edit declared fields, so `characters/data.js` keeps `behaviorAxes` and `personalities`
  even though the form does not show them.
- The header comment is preserved word for word. Older JavaScript-syntax files open with a
  `lossy` warning; saving rewrites them as strict JSON and drops comments inside the object.
- Every change is validated before saving; errors block the save.
- Action outcome ids are unique across the whole actions file. Duplicating an action and
  adding an outcome both allocate fresh ids.
- `BIOMES` in `editor/schemas.js` mirrors `locations/data.js`; adding a biome requires
  updating both.

To add a content type, extend `FILES`/`SECTIONS` in `editor/schemas.js` (and a check or
preview if useful); `editor.html` needs no changes. See `editor/README.md`.

## Adding a module

1. Create `<module>/data.js` (content) and `<module>/<module>.js` (logic), plus a
   `README.md` for module-specific notes.
2. Give the module a unique `name`, `depends: []`, and a factory that returns it.
3. In `init(engine)`: create the slice with `engine.slice(name, defaults)`, normalize
   it, and subscribe/register generators exactly once behind a `bound` flag.
4. In `onLoad(engine)`: re-acquire the slice and normalize; do not subscribe again.
5. Announce results with `engine.fire(...)` at `depth + 1`; never call another module.
6. Add the script tags to `index.html` and `status.html` as needed.
7. Register it in `buildEngine()` in `index.html` after its dependencies. The same factory is
   used for save baselines, so a missing registration breaks imports.
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
    -> encounters clears the previous source and rolls a hostility band
       -> character:spawn (source "encounter") -> character:spawned
    -> enabled biome events roll (location:event)
       -> mainCharacter applies effects (mainCharacter:statChanged)
  -> UI engine.flush()
```

```text
Win an encounter fight
  combat:ended { winnerId: "main", loserId: <encounter npc> }
    -> encounters rolls drop chance, kind and rarity
       -> equipment:add { kind, rarity, source: "loot" } -> equipment:added
          -> mainCharacter mirrors armor (mainCharacter:armorChanged) when worn
```

```text
Choose action
  action:choose { actionId, destinationId?, distance?, durationMinutes? }
    -> action:chosen, action:resolved (effects, time, equipmentKey?, travelTo?, travelDistance?)
       -> mainCharacter applies effects
       -> equipment adds a rewarded item (equipment:added/equipped)
          -> mainCharacter mirrors armor (mainCharacter:armorChanged)
  -> UI flush
     -> normal action: step whole ticks
     -> travelTo: travel:start { distance, durationMinutes } -> travel:started
        -> UI steps a 5-minute tick, then travel:advance
           -> travel:progress (quiet check; loop continues)
           -> travel:event (pause)
              -> mainCharacter applies effects; Continue -> travel:resumed
           -> travel:completed
              -> UI restores tick size and calls locations.visit(destinationId)
                 -> the Visit flow above
```

```text
Load static map
  map:load
    -> map.load() is idempotent; stores metadata and fires one location:add
       { count: 0, fixed: authored sites (autoLink: false), batch }
       -> locations.add() charts each fixed site
          -> location:added { id, key?, kind?, batch? } per site
             -> map records key -> id and kind -> id
       -> after the last site: location:link { fromId, toId, distance } per authored route
       -> map:generated { total, sites, landmarks, routes }

Visit a landmark
  location:visited
    -> map generates the interior once with engine.rng, stores it in map.terrain[id]
       -> map:terrainGenerated { locationId, interior, width, height, rooms }
```

```text
Travel graph
  location:add
    -> locations.connectNew()
       -> mutual connections { id, distance } on the new location and its neighbours
          -> location:added (the UI re-renders and offers only direct routes)
  -> choose Travel -> action:resolve carries distance + minutes
     -> travel:start echoes distance in travel:started
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

```text
Export save file
  GameSave.capture(engine, buildEngine)
    -> engine.serialize() (live JSON)
    -> buildEngine({ seed, startDate, tickMinutes }) (fresh baseline)
    -> changesBetween(fresh.state, live) -> v1 changes
  -> download text-rpg-save-<label>.json

Import save file
  GameSave.restore(fileText, engine, { buildEngine })
    -> read/parse -> validate -> migrate v0 if needed
    -> buildEngine(file seed/baseline) -> applyChanges(fresh.state, changes)
    -> engine.load(fresh.state) -> module onLoad() normalization
```

## Quick "where do I change..." table

| Goal | File |
|---|---|
| Vision, pillars, decisions, roadmap | `DESIGN.md` |
| New idea or unapproved preference | `IDEAS.md` |
| Edit biome/travel/equipment/action/character content in a form | `editor.html` (tool, not a module) |
| Add a content type, field, check or preview to the editor | `editor/schemas.js` |
| Editor file parsing, headers or JSON formatting | `editor/core.js` |
| Add/tune a stat | `characters/statsData.js` |
| More NPC names or traits | `characters/data.js` |
| Personality archetypes or behavior tuning | `characters/data.js` `personalities` / `behaviorAxes` |
| Character creation rules or portrait limits | `characters/mainCharacterData.js` |
| Armor/weapon types and stats, rarity bands, item drop weights, auto-equip | `equipment/data.js` |
| Attack/defend formulas, combat log size | `combat/data.js` |
| Map default size, fixed landmarks | `map/data.js` |
| Relation bands, types, labels and levels | `characters/data.js` `relations` / `levels` |
| Hostility spawn bands, enemy relation/level, loot rarity | `encounters/data.js` |
| Biomes, weather, naming, hostility bands, level ranges | `locations/data.js` |
| Biome event text/chance/hostility modifier/effects | `locations/events/<biome>/events.json` |
| Area actions, costs, outcomes, travel | `actions/data.js` |
| Route distance, league-to-minute rate, link count | `locations/data.js` `travelGraph` |
| Which locations are connected | `locations.js` `connectNew()` / `normalizeGraph()` |
| Travel event text/chance/effects, check length | `travel/data.js` |
| Journey duration | route `distance` in `locations/data.js`; the Travel action `timeMinutes` is a fallback |
| Save-file format, limits, migrations | `save/gameSave.js` + `save/README.md` |
| Live/baseline module registration for saves | `buildEngine()` in `index.html` |
| Travel pause/resume UI | `index.html` Travel panel + `driveTravel()` |
| Travel destination dropdown, Visit gating | `index.html` `renderActions()` / `renderLocations()` |
| Draw order, new fields in generation | The module's `ATTRIBUTES` array |
| Event names or depth handling | The emitting module, then `ENGINE_SPEC.md` + `status.html` |
| Panel markup or button wiring | `index.html` |
| Node tree display | `status.html` |
| Engine behavior | **Do not edit**; add a module |
