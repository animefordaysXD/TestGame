# Design — Living Medieval Sandbox

**Last updated:** 2026-10-27
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

### 3.1 Time model — Decided, Implemented (engine v0.2, actions v0.2, travel v0.1)
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

### 3.4 NPC tiers — Decided, Implemented (characters v0.3)
NPCs are procedurally generated and live in one of three tiers (slice `characters`):

| tier | meaning | cleared by `location:changed`? |
|---|---|---|
| `ephemeral` | generated on arrival; most commoners | **yes** |
| `notable` | the world needs to find them again (an innkeeper, a steward) | no |
| `saved` | kept by the player (family, companions, court) | no |

- Promotion only moves up: `ephemeral -> notable -> saved`. Never down.
- Promotion can happen because something happens to a character (the player saves, robs or
  hires them), so the game does not need to know in advance who matters.
- Events: `character:promote { id, tier }` (request), `character:promoted { id, from, to }`.
  `character:save` still works and means "promote to saved".
- Saves, family members and companions belong in `saved`. A notable that is tied to a place will
  later be regenerable from the world seed (see 3.6).

### 3.5 Personality, dialogue and NPC events — Decided direction, Planned
- NPCs already have 5 traits from a 30-trait pool with opposite pairs. They are meant to drive
  **dialogue** and to **affect the player** according to personality.
- A **separate NPC event checker** rolls events for NPCs present at the current location, e.g. a
  cunning commoner trying to steal from the player.
- **Proposed shape (not built):**
  - Dialogue is data: lines tagged by intent (greet, haggle, threaten, refuse) and by trait,
    plus context (class, mood). Pick by how many traits match, using the RNG, with neutral
    fallbacks. A few lines per trait is enough to start.
  - The NPC event checker is its own module and data file, like biome events but with a
    `requires` block (for example `{ traitsAny: ["cunning","greedy"], class: "commoner" }`).
    Outcomes resolve with a skill check (for example Intrigue against Intrigue). Location
    hostility can scale the odds.

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

### 3.11 Save files — Decided, Implemented (saves v0.1)
A save is a **JSON file holding the world seed plus the changes made since a fresh world**.

```json
{
  "format": "text-rpg-save",
  "formatVersion": 1,
  "savedAt": "2026-10-25T14:00:00.000Z",
  "label": "1000-01-03 06:00",
  "seed": 20261025,
  "baseline": { "startDate": "1000-01-01T06:00:00Z", "tickMinutes": 10 },
  "changes": [
    { "op": "set", "path": ["modules", "characters", "saved", "npc_0001"], "value": { } },
    { "op": "delete", "path": ["modules", "characters", "ephemeral", "npc_0002"] }
  ]
}
```

- **Saving** builds a fresh world from the seed and records the difference to the live one.
- **Loading** reads the file, rebuilds the fresh world from the file's own seed and baseline,
  applies the changes, and hands the result to `engine.load()`. The file is the reference; the
  live engine's own seed is ignored.
- `formatVersion` plus a migration table (`GameSave.MIGRATIONS`) handles older files. Files from
  a newer version are refused with a clear message.
- Save files are untrusted input: paths that could reach the prototype chain are rejected.
- Both the page and the tests supply a `buildEngine(opts)` that returns a **new** engine with
  every module registered. **Rule:** a new module must be registered in `registerModules()` in
  `index.html`, or saves will not rebuild its baseline correctly.
- Today a save is about as large as the full state, because everything in the world is created
  by the player's actions. The size benefit arrives once the world is derived from the seed
  (see 3.6).
- The quick **Save / Load** buttons still use `localStorage` slot `save1`, which `status.html`
  reads. **Proposed:** IndexedDB autosave plus the file as export and backup.

### 3.12 Scale of simulation — Proposed
A world this size cannot simulate everything. **Proposed:** named, stat-bearing characters are
real; commoners are statistics per settlement; the area near the player ticks in detail and
distant realms tick in aggregate at coarse steps.

### 3.13 The engine core stays frozen — Decided
`engine.js` (v0.2) is not edited. The current needs (turn-based time, scoped event checking,
keyed RNG, saves) can all be met from modules and helpers. Reopen only if a real limit appears.

### 3.14 Travel — Decided, Implemented (actions v0.2, travel v0.1)
- **Travel is an action.** It has a time and stamina cost, requires a destination, and resolves
  through `action:resolved`.
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
- **Not built yet:** a travel graph (routes, connections, distance-based times), route-specific
  encounters, and weather/hostility affecting the journey. Today Travel can reach any charted
  location.

## 4. Roadmap — Proposed

Build playable slices, not systems in isolation. Each slice is a game you can play.

| slice | goal | contents |
|---|---|---|
| 1. The wanderer | a loop on a small map | travel graph; actions with time and stamina costs and one real outcome each; hostility drives risk; events for every biome |
| 2. The adventurer | gear and companions | inventory, equipment (gives armor a value), money, a companion slot, tameable beasts, 4–5 backgrounds |
| 3. The landed | the noble path | settlements, titles, holdings, income, vassals; unify player and NPC characters |
| 4. Family and court | people matter | marriage, children, ageing, death, opinions driven by traits, dialogue, NPC events, schemes |
| 5. War and magic | the big systems | armies and mercenary contracts, magic, races, the atlas and map at full scale |

**Progress:** slice 1 is partly built. Five area actions with time, costs and weighted outcomes,
timed travel with interruption checks, and biome rolls on arrival exist. The travel graph,
hostility-driven risk, and events for most biomes are still missing. Slice 2 is partly built:
armor/equipment and the armor bridge exist, but money, companions and beasts do not.

## 5. Status snapshot

| area | state |
|---|---|
| engine core v0.2, event bus, seeded RNG, turn stepping | working, frozen |
| characters v0.3: stats, traits, **three NPC tiers** | working |
| main character v0.5: stats, portrait, effect bridges, armor mirror | working |
| equipment v0.1: body armor, inventory, equip/unequip | working |
| actions v0.2: five area actions with time, costs, outcomes | working |
| travel v0.1: 5-minute checks, event pause/resume, arrival handoff | working |
| locations v0.2, combat v0.1 | working |
| biome events | 1 of 10 biomes has a live event |
| **save files v0.1 (seed + changes)** | working |
| atlas, slots, keyed RNG, founding/razing | not started |
| family, inheritance, courts, dialogue, NPC event checker | not started |
| map rendering | not started |

## 6. Open questions

1. Inheritance: yes, no, or later? What happens on the player's death until then?
2. How does magic work (schools, mana costs, who can use it)?
3. Which 4–5 starting backgrounds, and what bonuses?
4. Should the map be drawn as provinces (regions) or as a node graph with roads?

## 7. Change process

1. Jo shares an idea or decision in conversation.
2. The AI adds it to `IDEAS.md` immediately and updates its Summary.
3. When it becomes a decision, it moves into this file with a tag, and `HANDOFF.md`/`ENGINE_SPEC.md`
   are updated if the code or contracts change.
4. Anything the AI proposes itself is tagged **Proposed** until Jo approves it.
