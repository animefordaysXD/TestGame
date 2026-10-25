# Modular Text-RPG Engine — Spec v0.9

Plain JS/HTML, no build step, no dependencies. A small core runs the clock, event bus,
RNG, state and save/load. All gameplay lives in modules that own one state slice and talk
only through events. Code is the source of truth; this file is the quick contract.
For the per-module code map and "where do I change this?" guide, see `MODULES.md`.

## Core behaviour

- **Time:** simulation clock. Each tick advances by `tickMinutes` (1, 10, 15, 30, 60,
  360 or 1440). Start date defaults to `1000-01-01T06:00:00Z`.
- **Event checking:** each tick every registered generator gets its own roll (0-1) and
  may return one event, several, or nothing. The core ships with no generators.
- **Event queue:** events are logged and announced as `event:<type>` then `event`.
  Handlers may fire follow-ups. Depth cap 8; 500 events per tick.
- **Save/load:** the whole state, including the RNG position, is JSON. Same seed plus
  same actions gives the same world.
- **Per-day rates:** `engine.chancePerTick(chancePerDay)` converts a per-day probability
  into a per-tick probability.

## Core API (`engine.js`, v0.2, unchanged)

- `new Engine({ startDate, tickMinutes, seed, maxLog })`
- `register(module)`, `registerGenerator(id, fn)`
- `on(name, fn)`, `off(name, fn)`, `emit(name, payload)`
- `fire(event, depth = 0)`
- `flush()` — process queued events now (UI buttons: `fire()` then `flush()`)
- `step(n)`, `run(msPerTick)`, `pause()`, `running`
- `setTickMinutes(n)`, `now`, `reset(seed)`
- `serialize()`, `load(json)`, `slice(name, defaults)`

## Tick phases

1. `tick:start`
2. Every generator is called with its own roll
3. Event queue is processed (`event:<type>`, then `event`); follow-ups allowed
4. Each module's `onTick(ctx)` in registration order
5. `tick:end`

Bus events: `tick:start`, `tick:end`, `reset`, `load`, `run`, `pause`, `tickSize`, `error`.

## Module contract

```js
{
  name: "locations",
  depends: [],                  // dependencies must be registered earlier
  init(engine) {},              // create slice, subscribe once, register generators once
  onTick(ctx) {},               // optional
  onLoad(engine) {}             // optional: rebuild derived data after load
}
```

`ctx` is `{ engine, state, rng, time, tickMinutes }`.

### Generator contract

`engine.registerGenerator(id, ({ roll, rng, time, tickMinutes, engine, state, id }) => event | event[] | null)`

### Event shape

`{ type, text?, data?, source?, tick, when, depth }`. The core adds `tick`, `when`, and
`source` (generator id).

## State schema

```
state = {
  version, seed, rngState,
  time: { startDate, tick, minutes, tickMinutes },
  eventLog: [],                 // capped at maxLog (500)
  modules: { <name>: slice }
}
```

Slices are JSON-safe. Never cache a slice object; `load()` replaces the whole state.

## Event catalog

| type | emitted by | data |
|---|---|---|
| character:spawn (request) | UI, future location/action modules | none |
| character:save (request) | UI | `{ id }` |
| character:clearTemp (request) | UI | none |
| character:spawned | characters | `{ id }` |
| character:saved | characters | `{ id }` |
| character:tempCleared | characters | `{ ids }` |
| location:add (request) | UI, future map/action modules | `{ count? }` |
| location:added | locations | `{ id }` |
| location:visited | locations | `{ id, name, biome, biomeKey, weather, hostility }` |
| location:event | locations | `{ locationId, locationName, biomeKey, eventId, name, chancePercent, roll, effects }` |
| location:changed | UI "Leave location", future movement | none (characters clears Temporary Spawn) |
| action:choose (request) | UI, future action modules | `{ actionId, destinationId? }` |
| actions:loaded | actions | `{ locationId, locationName, biomeKey, actions }` |
| action:chosen | actions | `{ actionId, name, locationId, locationName }` |
| action:resolved | actions | `{ actionId, name, outcomeId, outcomeName, text, effects, timeMinutes, equipmentKey, travelTo, locationId, locationName, atTick, at }` |
| action:blocked | actions | `{ actionId, name, reason, locationId, locationName }` |
| equipment:add (request) | UI | `{ key? }` (omit to pick randomly) |
| equipment:equip (request) | UI | `{ itemId }` |
| equipment:unequip (request) | UI | none |
| equipment:added | equipment | `{ itemId, key, name, slot, armor, equipped, source }` |
| equipment:equipped | equipment | `{ itemId, key, name, slot, armor, totalArmor, previousItemId }` |
| equipment:unequipped | equipment | `{ itemId, key, name, armor, totalArmor }` |
| combat:start (request) | UI | `{ player, enemy }` combatant snapshots |
| combat:action (request) | UI | `{ action: "attack" \| "defend" }` |
| combat:started | combat | `{ playerId, playerName, enemyId, enemyName }` |
| combat:damage | combat | `{ action, sourceId, sourceName, targetId, targetName, amount, hpBefore, hpAfter, hpMax, defended, armor, reduction }` |
| combat:defended | combat | `{ id, name, armor, reduction }` |
| combat:ended | combat | `{ winnerId, winnerName, loserId, loserName, rounds }` |
| mainCharacter:saved | mainCharacter | `{ id, name, gender, age }` (no image) |
| mainCharacter:statChanged | mainCharacter | `{ id, stat, delta, value, max, eventId }` (any non-equipment base stat) |
| mainCharacter:armorChanged | mainCharacter | `{ id, stat: "armor", delta, value, previous, itemId, itemName }` |

## Module registry

| module | depends | slice | purpose |
|---|---|---|---|
| core | none | `time`, `eventLog` | clock, state, save/load, event checking |
| characters | none | `nextId`, `named{}`, `temp{}` | NPC generator with base stats; Named NPC / Temporary Spawn |
| mainCharacter | none | `character` | player character; base stats; profile image; JSON mirror |
| combat | none | `active`, `round`, `turn`, `player`, `enemy`, `defending`, `winner*`, `log[]` | basic player-first duel; attack/defend |
| locations | none | `seed`, `createdAt`, `nextId`, `locations{}`, `currentId` | map locations; visit/event checker; JSON mirror |
| actions | none | `locationId`, `locationName`, `biomeKey`, `actions[]`, `lastAction` | five area actions with costs, outcomes, time and travel |
| equipment | none | `nextId`, `items{}`, `equippedId` | main-character armor; mirrors armor into the character stat |

## Characters module v0.3

- Files: `characters/statsData.js`, `characters/data.js`, `characters/characters.js`.
- Character shape: `{ id, gender, name, age, traits[5], stats, createdAtTick, createdAt }`.
- Five of 30 traits, never both sides of an opposite pair. Traits are the personality
  hook for future behaviour weighting; no behaviour rules read them yet.
- `stats` is shared by every character. See **Base stats** below.
- Spawned characters go to `temp`; saving moves them to `named`.
- `character:clearTemp` or `location:changed` empties `temp`.
- New NPCs roll their stats from `CharacterStatsData` with `engine.rng`. Skill rolls are
  bell-curved around the middle of their range. Armor rolls its `[0, 0]` range, so it
  starts at 0. Old NPC saves without stats get the definition defaults on load,
  deterministically.
- `combat:damage` targeting an NPC lowers that NPC's HP, clamped to 0..`hpMax`. The
  combat module announces the hit; characters does not emit a second stat event.
- Optional disk mirror: `characters/Named NPC/<id>.json`, `characters/Temporary Spawn/<id>.json`.

## Base stats

- Files: `characters/statsData.js` (content only). The characters and mainCharacter
  modules both read `CharacterStatsData.stats`.
- Every character has the same nine base stats plus an empty armor stat, in this order:

| key | label | kind | range | main start | NPC roll |
|---|---|---|---|---|---|
| `hp` | HP | resource | 0-100 | 100/100 | 70-100 |
| `stamina` | Stamina | resource | 0-100 | 100/100 | 70-100 |
| `mana` | Mana | resource | 0-50 | 50/50 | 20-50 |
| `armor` | Armor | equipment | 0-100 | 0 | 0 |
| `war` | War | skill | 1-20 | 10 | 1-20, bell |
| `diplomacy` | Diplomacy | skill | 1-20 | 10 | 1-20, bell |
| `personalCombat` | Personal Combat | skill | 1-20 | 10 | 1-20, bell |
| `moneyManagement` | Money Management | skill | 1-20 | 10 | 1-20, bell |
| `intrigue` | Intrigue | skill | 1-20 | 10 | 1-20, bell |
| `intelligence` | Intelligence | skill | 1-20 | 10 | 1-20, bell |

- Resource stats store a paired `<key>Max` field (`hpMax`, `staminaMax`, `manaMax`).
  Skills use the definition `max` directly.
- `armor` is an equipment stat. It starts at 0 for everyone. The `equipment` module
  writes the main character's armor through `equipment:equipped` / `equipment:unequipped`;
  location and action effects never change it. Combat's Defend action reads it (see
  **Combat module**). NPCs do not equip yet and stay at 0.
- Character stat block example:

```json
{
  "hp": 100, "hpMax": 100,
  "stamina": 90, "staminaMax": 100,
  "mana": 50, "manaMax": 50,
  "armor": 0,
  "war": 10, "diplomacy": 10, "personalCombat": 10,
  "moneyManagement": 10, "intrigue": 10, "intelligence": 10
}
```

- The stat list, ranges and labels are data. Add a stat by editing `statsData.js`;
  module code iterates the definitions.
- The main character starts from the `start` values. NPCs roll from `npcRange`;
  `npcBell: true` averages three rolls for a mid-range cluster.
- Personality (`traits`) is unchanged and remains NPC-only for now.

## Main character module v0.4

- Files: `characters/mainCharacterData.js`, `characters/mainCharacter.js`.
- Slice:

```js
mainCharacter: {
  character: null   // or one main-character object
}
```

- Character shape:

```json
{
  "id": "main",
  "name": "Aria Vale",
  "gender": "female",
  "age": 27,
  "image": "data:image/webp;base64,...",
  "imageSource": "upload",
  "stats": {
    "hp": 100, "hpMax": 100,
    "stamina": 90, "staminaMax": 100,
    "mana": 50, "manaMax": 50,
    "armor": 0,
    "war": 10, "diplomacy": 10, "personalCombat": 10,
    "moneyManagement": 10, "intrigue": 10, "intelligence": 10
  },
  "createdAtTick": 0,
  "createdAt": "1000-01-01 06:00",
  "updatedAtTick": 4,
  "updatedAt": "1000-01-01 06:40"
}
```

- `image` is a JSON-safe data URL. Uploaded files are centre-cropped to a square,
  resized to `MainCharacterData.imageSize` (256 px) and compressed as WebP/PNG.
  `imageSource` is `"upload"` or `"default"`; a missing image gets an initials avatar
  generated by `defaultAvatar(name)` as an SVG data URL.
- `stats` uses the shared **Base stats** block. A new main character starts from the
  `start` values; profile edits preserve the current values. Stats are included in the
  normal save and in `main.json`.
- Legacy saves with top-level `stamina`/`staminaMax` are migrated into
  `stats.stamina`/`stats.staminaMax` on load, and the old top-level fields are removed.
- The module subscribes once to `location:event` and applies effects with
  `{ stat, delta }` through `applyEventEffects()`. Any defined non-equipment stat works;
  unknown and equipment stats are ignored. It emits `mainCharacter:statChanged` at
  `depth + 1`; resources clamp to their max and skills clamp to the definition range.
- It subscribes once to `action:resolved` and applies the combined costs and outcome
  effects through `applyActionEffects()` with the same clamping. The stat event's
  `eventId` is the action id.
- It subscribes once to `equipment:equipped` / `equipment:unequipped`. The announced
  `totalArmor` is clamped to 0-100, written to `stats.armor`, and announced as
  `mainCharacter:armorChanged` at `depth + 1`. The module never reads the equipment
  slice.
- It also subscribes once to `combat:damage`; when the target is `main`, it lowers HP and
  clamps to 0..`hpMax`. The combat module already announces that hit, so this does not
  emit a second `mainCharacter:statChanged` line.
- `save(data, depth = 0)` validates name, gender and age, stores the character, and
  emits `mainCharacter:saved`. The image is deliberately **not** included in the event
  data, so the event log and save file stay small. The UI calls `save()` directly and
  then `engine.flush()`.
- `prepareImage(file)` is browser-only: validates type/size, crops, resizes, compresses.
- `toJSON()` returns the current character as pretty JSON.
- `connectFolder()` picks the folder containing `index.html` and uses
  `characters/mainChar/`. It writes `main.json` plus a viewable `profile.<ext>` image.
- `writeToFolder()` rewrites the mirror from state. `folderConnected` reports whether a
  folder handle is held.
- No tick generator. `init()` creates the slice and subscribes once to `location:event`,
  `action:resolved`, `equipment:equipped` / `equipment:unequipped` and `combat:damage`;
  reset clears the character but keeps those single subscriptions.
- UI on the test page: name, gender, age, image picker with preview, a stat grid
  (nine base stats plus armor), **Save main character**, and **Connect mainChar folder**.

## Combat module v0.1

- Files: `combat/data.js`, `combat/combat.js`; notes in `combat/README.md`.
- Slice:

```js
combat: {
  active: false,
  round: 0,
  turn: null,             // "player" while waiting for input
  player: null,           // { id, name, hp, hpMax, personalCombat, armor }
  enemy: null,
  defending: false,
  winnerId: null, winnerName: "",
  loserId: null, loserName: "",
  startedAtTick: null, startedAt: "",
  endedAtTick: null, endedAt: "",
  log: []                 // capped at CombatData.logLimit
}
```

- The UI starts a duel with `combat:start` and passes `{ player, enemy }` snapshots.
  The module never reads another module's slice; the snapshots contain the stats needed
  for the fight.
- The player always moves first: round 1, `turn: "player"`. The player chooses
  **Attack** or **Defend** with `combat:action`.
- Attack damage is based on the attacker's Personal Combat:
  `max(minDamage, round(personalCombat * multiplier))`. Defaults are `1` and `1`, so a
  Personal Combat of 10 deals 10 damage. After a surviving enemy is hit, it immediately
  attacks back. A lethal player hit ends the fight before the counterattack.
- The enemy always attacks in v0.1; `CombatData.enemyAction` is the future AI hook.
- Defend sets `defending` for the next enemy attack. The formula is
  `max(0, incomingDamage - armor * armorMultiplier)`, with `armorMultiplier: 2`. Armor is
  written by the equipment module; without equipment it is 0 and Defend blocks nothing.
- Damage is emitted as `combat:damage`; the mainCharacter and characters modules apply it
  to the real character slices. The module also emits `combat:started`,
  `combat:defended` and `combat:ended` at `depth + 1` (or one deeper for the enemy turn).
- `combat:damage` includes `amount`, `hpBefore`, `hpAfter`, `hpMax`, `defended`, `armor`
  and `reduction`, so the UI and future modules can react without parsing text.
- The slice keeps the final snapshots, winner and log after a fight, so the UI can show
  the result. Starting a new fight resets the slice. Reset clears it.
- UI on the test page: every NPC card has a **Fight** button; the **Combat** panel shows
  both HP totals, round/turn, **Attack** and **Defend**, and the last eight log lines.

## Locations module v0.2

- Files: `locations/data.js`, `locations/locations.js`; biome event content lives in
  `locations/events/<biomeKey>/events.json`.
- Slice:

```js
locations: {
  seed: 0,          // map seed derived from the world seed (uint32)
  createdAt: "",    // game time when the map seed was created
  nextId: 1,
  locations: {      // id -> location
    "loc_0001": { ... }
  },
  currentId: null   // last visited location, or null
}
```

- Location JSON shape:

```json
{
  "id": "loc_0001",
  "name": "The Shadow Oasis",
  "biome": "Desert",
  "biomeKey": "desert",
  "weather": "Sandstorm",
  "hostility": 75,
  "seed": 1419639272,
  "createdAtTick": 0,
  "createdAt": "1000-01-01 06:00"
}
```

- `hostility` is an integer 1-100. Biomes define a range; labels come from
  `LocationData.hostilityBands` (`Peaceful`, `Watchful`, `Unsettled`, `Dangerous`, `Deadly`).
- Generation is button-driven only. The module registers **no generator** and does
  nothing on tick. A new world creates a new map seed in `init()`; no locations are
  created until `location:add` arrives.
- Randomness comes from `engine.rng`. Names are unique. New locations try to avoid
  repeating an existing biome + weather pair until the data is exhausted.
- `ATTRIBUTES` order controls generation: `biome`, `name`, `weather`, `hostility`.
  Each entry sees the location built so far. Add a field by adding one entry.
- `locations/data.js` owns biomes, weather lists, place-nouns, name prefixes, suffixes,
  patterns and hostility bands. Add or edit entries without touching logic.
- `labelFor(hostility)` returns the band label.
- `toJSON(id)` returns one location as pretty JSON.
- `loadEvents(force = false)` fetches and normalizes every biome's event JSON, then
  caches it. `eventStatus()` returns `{ biomes, events, enabled, errors }`;
  `eventsFor(biomeKey)` returns the normalized list.
- Event shape:

```json
{
  "id": "tundra_snowfall",
  "name": "Snowfall",
  "enabled": true,
  "chancePercent": 10,
  "text": "Snow falls across the tundra, sapping your stamina.",
  "effects": [{ "stat": "stamina", "delta": -10 }]
}
```

- `chancePercent` is 0-100 (10 = 10%); `chance` is accepted as an alternative 0-1
  value. Each enabled event rolls independently on a visit, so more than one can trigger.
  `enabled: false` keeps a copy/paste template in the file without rolling it.
- `visit(id, depth = 0)` is async: it sets `currentId`, fires `location:visited`, then
  `checkEvents` rolls each enabled event with `engine.rng.next()` and fires
  `location:event` at `depth + 1`. It returns `{ location, events }`. The UI calls
  `visit()` directly and then `engine.flush()`, matching the main-character save flow.
- `location:event` effects are applied by the main character module for any defined base
  stat (`hp`, `stamina`, `mana`, `war`, `diplomacy`, `personalCombat`,
  `moneyManagement`, `intrigue`, `intelligence`). `armor` is an equipment stat and is
  ignored; unknown stats stay in the event data for future modules.
- Event JSON is fetched by the browser, so serve the project over HTTP. The UI shows
  event-load status and a **Reload biome events** button.
- Disk writes are serialized; `whenDiskIdle()` returns a promise for tests/UI.
- `connectFolder()` picks the folder containing `index.html`, then uses
  `Locations/<map seed>/`:
  - `seed.json` — `{ seed, createdAt, tick, tickMinutes }`
  - `loc_0001.json` — one location per file
  - Writes all state locations, then imports unknown `loc_*.json` files from that seed
    folder. Existing ids in state win. Hand-edited JSON can be loaded this way.
- Browser folder access needs Chrome or Edge (File System Access API). Serving the
  folder over localhost is the fallback; `file://` may block the picker.
- UI on the test page: **Add location**, **Add 5 locations**, **Connect Locations
  folder**, **Reload biome events**, a **Visit** button per location, a current-location
  marker, visit status, and a **JSON** download button per location.

## Actions module v0.2

- Files: `actions/data.js`, `actions/actions.js`; notes in `actions/README.md`.
- Slice:

```js
actions: {
  locationId: null,     // last visited location
  locationName: "",
  biomeKey: "",
  actions: [],          // exactly five action objects
  lastAction: null      // the most recent action:resolved data, cleared on visit
}
```

- Action shape:
  `{ id, name, description, timeMinutes, costs[], outcomes[], requiresDestination, travelText }`.
  Costs and outcome effects use `{ stat, delta }`.
- `actions/data.js` owns `LocationActionsData.default` (five actions) and optional
  `biomes.<biomeKey>` overrides. An override with fewer than five entries is ignored.
- The module listens to `location:visited`; it replaces the previous area's actions,
  stores the area id/name/biome, clears `lastAction`, and emits `actions:loaded` at
  `depth + 1`.
- It listens to `action:choose` with `{ actionId, destinationId? }`. It emits
  `action:chosen`, then picks one outcome with `engine.rng` (weighted by `weight`,
  default 1) and emits `action:resolved` at `depth + 1`.
- `action:resolved` carries the combined `costs` + outcome `effects`, `timeMinutes`,
  an optional `equipmentKey` and an optional `travelTo`. The module applies none of them
  itself:
  - `mainCharacter` applies the effects and emits `mainCharacter:statChanged`.
  - `equipment` adds the item named by `equipmentKey`.
  - the UI advances the clock by whole ticks and, for `travelTo`, calls
    `locations.visit(destinationId)`.
- Travel actions set `requiresDestination: true` and have no outcomes. Without a
  destination the module emits `action:blocked` and resolves nothing. Movement stays in
  the locations module; actions never edits the locations slice.
- `lastAction` is JSON-safe and included in saves, so the UI/status tree can show the
  last resolution.
- `init()` subscribes once; reset empties the slice and keeps the subscription. On load,
  `onLoad()` normalizes the loaded slice for the UI.
- UI on the test page: an **Actions** panel with five **Choose** buttons, cost/time text
  in each row, a destination dropdown for Travel, and the last resolution in the status.

## Equipment module v0.1

- Files: `equipment/data.js`, `equipment/equipment.js`; notes in `equipment/README.md`.
- Slice:

```js
equipment: {
  nextId: 1,
  items: {                       // item id -> item
    "eq_0001": {
      id: "eq_0001", key: "leather_cuirass", name: "Leather Cuirass",
      slot: "body", armor: 3, equipped: true,
      acquiredAtTick: 0, acquiredAt: "1000-01-01 06:00"
    }
  },
  equippedId: "eq_0001"          // one body item, or null
}
```

- `equipment/data.js` owns the armor catalogue: `key`, `name`, `slot`, `armor`, `weight`,
  plus `maxArmor` and `autoEquip`. Add or tune armor there; module code iterates the list.
- The first acquired item is equipped automatically when nothing is worn. Equipping
  another item swaps it; only one body item is worn.
- Requests: `equipment:add` (`{ key? }`; omit the key for a weighted random pick),
  `equipment:equip` (`{ itemId }`) and `equipment:unequip`.
- Module events: `equipment:added`, `equipment:equipped` and `equipment:unequipped` at
  `depth + 1`. The equipped event includes `totalArmor` for the bridge.
- The module listens to `action:resolved`; an outcome with `equipmentKey` adds that item
  (auto-equipping when free) without the actions module calling it.
- `mainCharacter` listens to the equipped/unequipped events, clamps `totalArmor` to
  0-100, writes `stats.armor` and emits `mainCharacter:armorChanged`. The equipment module
  never reads or writes another module's slice.
- Only the main character can equip in v0.1. NPCs stay at armor 0.
- UI on the test page: an **Equipment** panel with **Find armor**, the inventory, the
  equipped item and **Equip** / **Unequip** buttons. Find armor requires a saved main
  character.

## File layout

```
index.html
status.html        read-only live node-tree viewer (not a module)
engine.js
ENGINE_SPEC.md
MODULES.md         living per-module handbook (update with every module change)
package.json
actions/
  actions.js
  data.js
  README.md
equipment/
  equipment.js
  data.js
  README.md
combat/
  combat.js
  data.js
  README.md
characters/
  characters.js
  data.js
  statsData.js
  mainCharacter.js
  mainCharacterData.js
  mainChar/
    README.md
    main.json        (written on folder connect/save)
    profile.webp     (written on folder connect/save; or .png/.jpg/.svg)
  Named NPC/          (created on folder connect)
  Temporary Spawn/    (created on folder connect)
locations/
  data.js
  locations.js
  events/
    README.md
    forest/events.json
    grassland/events.json
    hills/events.json
    coast/events.json
    desert/events.json
    mountains/events.json
    swamp/events.json
    tundra/events.json
    jungle/events.json
    wasteland/events.json
Locations/
  README.md
  <map seed>/
    seed.json
    loc_0001.json
test/
  locations.test.cjs
  locations-disk.test.cjs
  characters.test.cjs
  main-character.test.cjs
  biome-events.test.cjs
  actions.test.cjs
  equipment.test.cjs
  combat.test.cjs
  serve.cjs
```

## Known limitations

- The Locations folder mirror (`connectFolder`) is tested with an in-memory File System
  Access API mock in Node, but the real browser picker is untested; it needs Chrome/Edge.
- `location:changed` still only clears Temporary Spawn; it does not move the party.
- Locations have no coordinates, connections, population or resources. The Travel action
  can visit any known location; `currentId` marks the last visit, not a travel graph.
- Biome events have no cooldowns, once-only flags, weather filters or requirements.
  Each enabled event is an independent roll on every visit.
- Base stats are stored, and location events and area actions can change them. Combat uses
  Personal Combat and armor, but there is no progression, training or opposed-roll system
  yet.
- Combat is one-on-one and player-first. There is no flee, positioning, initiative, hit
  chance, damage variance or enemy AI; the enemy always attacks.
- Armor comes from the equipment module, which is main-character-only with one body slot.
  NPCs still fight at armor 0. Defend uses `max(0, damage - armor * 2)`.
- Equipment armor is mirrored to the main character present when it is equipped. The UI
  requires a saved character before **Find armor**; an action reward equipped before the
  character exists will not change `stats.armor` later.
- Area actions resolve costs, one weighted outcome, time and travel, but have no
  requirements or skill checks, and travel can reach any charted location.
- Biome event JSON is fetched with `fetch`; open the page through the static server,
  not `file://`.
- The real mainChar folder picker is untested in a browser; its write logic is covered
  by the Node mock test. It needs Chrome/Edge.
- Uploaded portraits are resized to 256 px and stored as data URLs in state and
  `localStorage`; very large source files are rejected (8 MB default).
- `mainChar/` is a write mirror. It is not imported automatically; `localStorage` or
  the in-game load button remains the way back into a session.
- The test page stores saves in `localStorage` slot `save1`, which some contexts block.
