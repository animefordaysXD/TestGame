# Design — Living Medieval Sandbox

**Last updated:** 2026-10-31
**Owner:** Jo (decisions) · **PM role:** the AI session (proposals, tracking, trade-offs)

This file is the source of truth for **what the game is and why**. `HANDOFF.md` says how the
code works and how to build; this file says what to build. `IDEAS.md` is the running list of
ideas that have not become decisions yet.

## How to use this file

**AI sessions:** read this before building anything. A change must fit the pillars and the
decisions below. If a request conflicts with them, say so and ask before building. When Jo
makes a new decision, record it here (and in `IDEAS.md`) in the same turn.

**Tags** used throughout:

| tag | meaning |
|---|---|
| **Decided** | Jo said so. Do not reopen without a reason. |
| **Implemented** | Decided and working in the code (version noted). |
| **Planned** | Decided, not built yet. |
| **Proposed** | PM suggestion. Jo has not approved it. Do not build as if it were decided. |
| **Open** | A question that needs Jo's answer. |

## 1. Vision

A turn-based, text-first, open-world sandbox in the spirit of Crusader Kings with Game of
Thrones-style politics and fantasy elements. The character is dropped into a very large
medieval world (at least the size of medieval Europe) with full freedom: a roaming rogue or
mercenary, a beast tamer, an elven archer scout, or a highborn noble playing court games and
ruling land. Technology is medieval; magic exists. The player has a family and children.

## 2. Pillars

1. **One simulation, many roles.** *Commoner or ruler* is not two modes. It is the same systems
   at different scales. A role changes which actions are offered and how big their effects are.
2. **The player is an actor like any other.** The world does not revolve around the player.
   Characters, NPCs and rulers share one character model; the player is the one driven by input.
3. **Fixed world, varied details.** The geography is the same in every game. What fills it (who
   holds a church, who runs a forge) differs per save.
4. **A living map.** Cities can be sacked, razed and founded. The map shows the current political
   state, not a fixed painting.
5. **Freedom with consequences.** Nothing locks the player into a role; roles are advantages.
6. **Data over code.** Content lives in data files so the world can grow without engine changes
   (existing rule, see `HANDOFF.md`).

## 3. Decisions

### 3.1 Time model — Decided, Implemented (engine v0.2, actions v0.3, travel v0.2)
Turn-based. Time advances when the player acts, by the cost of the action (a journey of three
days is a three-day step). The core already supports this through `engine.step(n)` and
`setTickMinutes`; the real-time `engine.run()` loop is simply not used by the game.

- A normal action steps whole ticks: `ceil(timeMinutes / tickMinutes)`.
- Mini-activities can step finer. Travel uses 5-minute checks and restores the player's tick
  size afterwards.

### 3.2 Roles are backgrounds — Decided, Planned
- A role (beast tamer, elven scout, mercenary, minor noble...) is only a **starting background**.
  It gives an advantage, never a lock. Anyone may try to tame a beast; a tamer is just better.
- Start with a **small number** of backgrounds, each with different starting bonuses.
- Proposed data shape: one entry per background with stat adjustments, a starting item or
  companion, and a bonus on specific checks. **Proposed** — not built.

### 3.3 Characters and family — Decided, partly Planned
- **One character type** for player and NPCs. The player is a character flagged as input-driven.
  Today `mainCharacter` and `characters` are separate modules; merging them is **Planned** and
  should happen before family and rulers are built.
- **Family and children** will be added. **Planned.**
- **Inheritance:** **Open.** Jo has not decided. Keep characters unified so either answer works.
- **What happens on death:** **Open.** Proposed default until inheritance is decided: death ends
  the run.

### 3.4 NPC tiers — Decided, Planned (current approximation: characters v0.5)
The target model has three tiers (slice `characters`):

| tier | meaning | cleared by `location:changed`? |
|---|---|---|
| `ephemeral` | generated on arrival; most commoners | **yes** |
| `notable` | the world needs to find them again (an innkeeper, a steward) | no |
| `saved` | kept by the player (family, companions, court) | no |

- Promotion only moves up: `ephemeral -> notable -> saved`. Never down.
- Promotion can happen because something happens to a character (the player saves, robs or
  hires them), so the game does not need to know in advance who matters.
- Planned events: `character:promote { id, tier }` (request),
  `character:promoted { id, from, to }`. `character:save` will keep its meaning of "promote to
  saved".
- Saves, family members and companions belong in `saved`. A notable that is tied to a place will
  later be regenerable from the world seed (see 3.6).

**Current code:** `characters` v0.5 has only `temp` (Temporary Spawn) and `named` (Named NPC).
That approximates ephemeral vs saved: `temp` is cleared by `location:changed` and `named`
survives. There is **no** `notable` tier, no `tier` field and no
`character:promote`/`character:promoted` event yet. Read the table above as the target, not
the current schema.

### 3.5 Personality, dialogue and NPC events — Decided direction, Planned
- NPCs roll 1 of 30 named personality archetypes. Each archetype owns five traits from a
  30-trait pool with opposite pairs, plus an eight-axis behavior profile. Personality is
  meant to drive **dialogue** and to **affect the player** according to character.
- **Built (data foundation):** `character.personality` (`{ id, name }`), `character.traits[5]`
  and `character.behavior` with `aggression`, `caution`, `sociability`, `honesty`,
  `generosity`, `loyalty`, `curiosity` and `ambition`, each 0-100. Archetypes and axes live in
  `characters/data.js`. Nothing reads behavior yet; generation, saves and the UI only store,
  migrate and display it.
- A **separate NPC event checker** rolls events for NPCs present at the current location, e.g. a
  cunning commoner trying to steal from the player.
- **Proposed shape (not built):**
  - Dialogue is data: lines tagged by intent (greet, haggle, threaten, refuse) and by
    personality/trait, plus context (class, mood). Pick by how many traits match, using the
    RNG, with neutral fallbacks. A few lines per trait is enough to start.
  - The NPC event checker is its own module and data file, like biome events but with a
    `requires` block (for example `{ behavior: { aggression: { min: 60 } }, class: "commoner" }`).
    Outcomes resolve with a skill check (for example Intrigue against Intrigue). Location
    hostility can scale the odds.
  - Future AI should read `character.behavior` as the primary signal and use traits as
    flavour/fallback, so tuning one data table changes dialogue, events and combat together.

### 3.6 World model — Decided concept, Planned
Two layers plus changes:

- **The atlas — fixed.** A data file shipped with the game: cities and sites with position,
  terrain, size, connections and a number of **slots** (religion, craft, market, keep...). Every
  save shares it.
- **The world state — per save.** Each slot is filled from weighted tables using region,
  terrain, size and culture, so one save has an elven-held church in a city and another has a
  dwarven forge in the same spot.
- **Changes — per save.** Anything that happens afterwards (razed, founded, changed hands) is
  stored as changes to that state.
- The atlas is **AI-generated once, then hand-editable**, and committed as data. **Decided.**
- World size is **at least medieval Europe**. **Decided.**

**Proposed** (needs Jo's approval before building):
- *Hierarchy:* realm → region → city → slot → people. The top level (realms, rulers, factions)
  is rolled eagerly when a game starts, because the simulation needs it every turn. The bottom
  (a city's buildings, its shopkeepers) is rolled lazily, the first time someone looks.
- *Anchors:* the atlas can mark some slots as fixed (a capital's keep is always the same). This
  is the dial between "fixed map" and "varied details".
- *Memoize on first resolve:* once a city has been rolled, store the result in the save so later
  edits to the tables never silently rewrite old saves.

**Rule (applies as soon as lazy generation exists):** content derived from the world seed must
use a **keyed** RNG, `rng(seed + id)`, never the shared `engine.rng` stream. The shared stream
depends on the order in which the player visits things; a keyed one does not.

### 3.7 A dynamic world — Decided concept, Planned
- Cities and other sites can be **razed, ruined or sacked**.
- **New cities can be founded**, at a high resource cost so the player cannot spam them.
  Proposed anti-spam levers (not built): cost in a data file, minimum distance from other
  settlements, a claim or legitimacy requirement.
- **Diplomacy** comes later and is what drives the map changing hands.

### 3.8 Map presentation — Decided
- The map is **AI-generated** and **dynamically coloured like Crusader Kings** (political state
  shown by colour).
- **Colour is a view, not data.** It is computed at render time from the world state; the atlas
  never stores colours.
- **Proposed:** several map modes (political, culture, religion, terrain), provinces drawn as
  regions on an SVG or canvas and coloured by lookup of owner.

### 3.9 Setting — Decided, details Open
Medieval technology with magic. Fantasy peoples (elves, dwarves...), tameable beasts, and Game of
Thrones-flavoured politics. How magic works is **Open** (the `mana` stat already exists).

### 3.10 Beasts — Decided concept, Planned
The player can tame beasts. **Proposed:** a tamed beast is a character with stats in a
companion slot, which falls out of the unified character model for free.

### 3.11 Save files — Decided, Implemented (save helper v0.1)
A save is a **JSON file holding the world seed plus the changes made since a fresh world**.

```json
{
  "format": "text-rpg-save",
  "formatVersion": 1,
  "savedAt": "2026-10-29T12:00:00.000Z",
  "label": "1000-01-03 06:00",
  "seed": 20261029,
  "baseline": { "startDate": "1000-01-01T06:00:00Z", "tickMinutes": 10 },
  "changes": [
    { "op": "set", "path": ["modules", "characters", "named", "npc_0001"], "value": { } },
    { "op": "delete", "path": ["modules", "characters", "temp", "npc_0002"] }
  ]
}
```

- **Saving** builds a fresh world from the seed and records the difference to the live one.
- **Loading** reads the file, rebuilds the fresh world from the file's own seed and baseline,
  applies the changes, and hands the result to `engine.load()`. The file is the reference; the
  live engine's own seed is ignored.
- `formatVersion` plus a migration table (`GameSave.MIGRATIONS`) handles older files. A raw
  full-state save from before v1 is migrated by rebuilding its baseline and diffing. Files from
  a newer version are refused with a clear message.
- Save files are untrusted input: paths that could reach the prototype chain, or that point
  outside the engine state, are rejected.
- Both the page and the tests supply a `buildEngine(opts)` that returns a **new** engine with
  every module registered. **Rule:** a new module must be registered in `buildEngine()` in
  `index.html`, or saves will not rebuild its baseline correctly.
- The page has **Export save file** and **Import save file** for this format. The quick
  **Save / Load** buttons still use `localStorage` slot `save1`, which `status.html` reads.
- Today a save is about as large as the full state, because everything in the world is created
  by the player's actions. The size benefit arrives once the world is derived from the seed
  (see 3.6).
- **Proposed:** IndexedDB autosave plus the file as export and backup.

### 3.12 Scale of simulation — Proposed
A world this size cannot simulate everything. **Proposed:** named, stat-bearing characters are
real; commoners are statistics per settlement; the area near the player ticks in detail and
distant realms tick in aggregate at coarse steps.

### 3.13 The engine core stays frozen — Decided
`engine.js` (v0.2) is not edited. The current needs (turn-based time, scoped event checking,
keyed RNG, saves) can all be met from modules and helpers. Reopen only if a real limit appears.

### 3.14 Travel — Decided, Implemented (locations v0.4, actions v0.3, travel v0.2)
- **Travel is an action.** It has a time and stamina cost, requires a destination, and resolves
  through `action:resolved`.
- **Locations form a travel graph.** Each location owns bidirectional `connections` with a
  distance in leagues. Travel offers only direct routes from the current location, and the route
  distance sets the journey time (`distance × 15` minutes). The Travel action's own time is a
  fallback. **Decided and built.** The graph is an abstract link graph, not a coordinate map.
- **A journey spends its duration in 5-minute checks.** The UI temporarily switches to a
  5-minute tick, steps once per check, and restores the previous tick size. Normal actions still
  step whole ticks.
- **Each check can be interrupted.** A travel event applies its stat effects and pauses the
  journey until the player presses **Continue travel**. Cancel abandons the journey without a
  refund. Travel interruptions are stat-effect scenes; choices and combat handoffs are future
  work.
- **Travel never moves the party.** On completion the UI calls `locations.visit(destinationId)`,
  so locations remains the only module that changes `currentId`. The destination's biome events
  roll as usual on arrival.
- **Not built yet:** route-specific encounters, weather/hostility affecting the journey, and
  multi-hop route planning. The graph has no coordinates or map view.

### 3.15 Content editing — Decided, Implemented (editor tool v0.3)

Content stays in data files, but hand-editing them is error-prone and slows down playtesting.
`editor.html` is a form-based tool over the same files: it validates entries, shows previews,
and writes the data back without touching the game or the engine.

- **A tool, not a module.** It has no state slice, fires no events, and is never registered in
  `buildEngine()`. It cannot change a running game.
- **Strict JSON in a JS wrapper.** Files keep their `window.X = { ... };` form and header
  comment, but the object is strict JSON so the editor can round-trip it losslessly. Unknown
  fields survive saves; older JavaScript-syntax files open with a lossy warning.
- **Editable today:** biome events, travel events/tuning, equipment items (armor, weapons,
  types), rarity tiers and settings, area actions and outcomes, character names/traits/ages,
  character creation (backgrounds, origins, focuses), locations, encounters, and the static
  map. Stats, combat tuning, body layout, behavior axes and personality archetypes are not
  editable yet.
- **Direct or downloaded saves.** With a folder connection (Chrome/Edge) saves write straight
  to disk; otherwise files download and must be moved back by hand.

### 3.16 Character bodies — Decided, Implemented (characters v0.5, mainCharacter v0.6)

Every character, including the player, has a detailed humanoid body rather than a single
abstract health pool. The body is structural: equipment already targets its parts, and it
gives future injury and dismemberment rules a stable shape without committing to those rules
yet.

- **Ten parts:** `head`, `torso`, left/right leg, left/right arm, left/right hand and
  left/right foot. Each part records its side, its parent part and whether it is vital
  (`head`, `torso`).
- **Status is per character.** Each part starts `"intact"`; the status is saved but no
  injury, combat, healing or equipment rule reads or changes it yet. Equipment targets the
  part keys; the two systems stay independent for now.
- **Shared shape, data-driven layout.** `characters/bodyData.js` owns the part list and
  metadata; `characters/body.js` creates/normalises the body for both character modules.
  Old saves gain missing parts and keep saved statuses.
- **Visible in the UI.** The main-character panel has a Body grid and NPC cards show a
  compact body line; `status.html` expands the parts.

### 3.17 Equipment, weapons, types and rarity — Decided, Implemented (equipment v0.4, combat v0.2)

Equipment is the first real source of combat power. Armor already existed per body part; this
slice adds weapons, item families and item quality without replacing the body-part model.

- **Weapon families and armor types are data.** Weapons use `weaponType` (sword, spear, axe,
  mace); armor uses `armorType` (cloth, leather, mail, plate, scale). Both lists live in
  `equipment/data.js`, so adding a family is a content change, not module code.
- **A weapon needs three numbers:** base damage, a Strength requirement, and armor piercing as
  a percentage of the target's total armor. A character below the requirement cannot use the
  weapon: it adds no damage and no piercing. Strength becomes a shared base stat for this.
- **One weapon slot.** Weapons are not body parts, so `equippedWeaponId` sits beside
  `equippedByPart`. Armor keeps its multi-part coverage and overlap-replacement rules.
- **Five rarity ranks, weakest first:** Common, Uncommon, Rare, Legendary and Unique. Each rank
  defines a stat band for armor, damage, Strength requirement and armor piercing, and every
  higher rank starts above the previous rank's maximum. Items live in one list with a `kind`
  (`"armor"` or `"weapon"`) and a `rarity`; the content editor checks each item against its
  band and warns when a value falls outside it.
- **Random finds can be filtered by kind, rarity or type**, and an item can be destroyed. Those
  hooks are the path for events, loot tables and mobs to generate or remove equipment later;
  no content uses them yet.
- **Combat v0.2:** attack = Personal Combat plus a usable weapon's damage; armor piercing
  shrinks the target's effective armor; armor reduces every hit, and Defend doubles that
  reduction. Everything stays deterministic.
- **Still open:** how quickly higher rarities should appear, whether rarity has non-stat effects,
  and how NPC loadouts and loot tables will hand out or destroy items.

### 3.18 Character creation — Decided, Implemented (creator v0.1)

The player should start as a character with a little history, not a blank stat block. Three
data-driven choices — background, origin and focus — add starting stat changes and equipment.
The first save uses the build; later saves only edit the profile.

- **Three choice groups.** Background is the main identity (soldier, hunter, scholar, thief,
  merchant, outlander); origin is where the character grew up; focus is what they practised.
  Every option lives in `characters/creatorData.js`.
- **Stats are additive and clamped.** Resource stats start at 80% of maximum so positive and
  negative changes both matter; skills start at their shared `start` value. The creator adds
  each option's `{ stat, delta }` list and clamps to the stat definition.
- **Equipment is a real kit.** Option lists name equipment keys; the creator grants them
  through the normal `equipment:add` path, so auto-equip and the armor bridge work unchanged.
- **One creator path.** `creator:create` validates a draft, fires `mainCharacter:create`, then
  the equipment requests, then `creator:created`. Profile saves keep the current build.
- **Still open:** point-buy or free allocation, rerolling, in-game rebuilding, and
  background-specific events or dialogue.

## 4. Roadmap — Proposed

Build playable slices, not systems in isolation. Each slice is a game you can play.

| slice | goal | contents |
|---|---|---|
| 1. The wanderer | a loop on a small map | travel graph; actions with time and stamina costs and one real outcome each; hostility drives risk; events for every biome |
| 2. The adventurer | gear and companions | inventory, equipment (gives armor a value), money, a companion slot, tameable beasts, 4–5 backgrounds |
| 3. The landed | the noble path | settlements, titles, holdings, income, vassals; unify player and NPC characters |
| 4. Family and court | people matter | marriage, children, ageing, death, opinions driven by traits, dialogue, NPC events, schemes |
| 5. War and magic | the big systems | armies and mercenary contracts, magic, races, the atlas and map at full scale |

**Progress:** slice 1 is mostly built. The travel graph (connections, distances and
distance-based times), five area actions with time, costs and weighted outcomes, timed travel
with interruption checks, and biome rolls on arrival exist. The world map is now static:
`map/data.js` authors twelve sites and thirteen routes, and the tavern, castle and shack
generate procedural interiors on first visit. Drawn layouts and atlas slots are still
missing. Hostility-driven risk and events for most biomes are still missing. Slice 2 is
partly built: a background/origin/focus character creator sets starting stats and a kit;
body-part armor, one weapon slot and five item rarities exist with the armor bridge, but
money, companions and beasts do not.

## 5. Status snapshot

| area | state |
|---|---|
| engine core v0.2, event bus, seeded RNG, turn stepping | working, frozen |
| characters v0.6: stats, ten-part body, 30 personality archetypes with traits and 0-100 behavior profiles (data-only); `temp`/`named` approximation (three-tier model planned) | working |
| main character v0.7: stats, ten-part body, portrait, effect bridges, armor mirror, optional starting-build metadata | working |
| creator v0.1: background/origin/focus choices set starting stats and equipment; live preview; editor support | working |
| equipment v0.4: body-part armor, one weapon slot (swords/spears/axes/maces), weapon and armor types, five rarity tiers, inventory, equip/unequip/destroy | working |
| actions v0.3: five area actions with time, costs, outcomes, route-aware Travel | working |
| travel v0.2: 5-minute checks, event pause/resume, arrival handoff | working |
| locations v0.5: procedural locations and a travel graph with distances; fixed `kind` landmarks and authored static sites | working |
| map v0.2: static authored world (sites + routes) and procedural landmark interiors generated on first visit | working |
| combat v0.2: weapon damage, Strength gating and armor piercing; armor reduces every hit | working |
| biome events | 7 of 10 biomes have a live event |
| **save files v0.1 (seed + changes, JSON export/import)** | working |
| **content editor v0.3 (`editor.html`, tool — not a module)** | working for biome events, travel, equipment (armor, weapons, types, rarity bands), actions, character names/traits/ages, character creation, locations, encounters, and the static map (sites, routes, interiors, tiles) |
| character injury, healing and body-part effects | not started (body shape + status field exist) |
| atlas, slots, keyed RNG, founding/razing | not started |
| family, inheritance, courts, dialogue, NPC event checker | not started |
| map rendering | interiors render as a tile grid; no drawn atlas or overworld movement |

## 6. Open questions

1. Inheritance: yes, no, or later? What happens on the player's death until then?
2. How does magic work (schools, mana costs, who can use it)?
3. How should creation grow: keep the authored backgrounds/origins/focuses, or add
   point-buy allocation, rerolls and in-game rebuilding?
4. Should the drawn map use provinces (regions) or show the route graph with roads? The travel
   graph exists as data; the visual map is still open.

## 7. Change process

1. Jo shares an idea or decision in conversation.
2. The AI adds it to `IDEAS.md` immediately and updates its Summary.
3. When it becomes a decision, it moves into this file with a tag, and `HANDOFF.md`/`ENGINE_SPEC.md`
   are updated if the code or contracts change.
4. Anything the AI proposes itself is tagged **Proposed** until Jo approves it.
