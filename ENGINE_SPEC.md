# Modular Text-RPG Engine — Spec v0.7

Plain JS/HTML, no build step, no dependencies. A small core runs the clock, event bus,
RNG, state and save/load. All gameplay lives in modules that own one state slice and talk
only through events. Code is the source of truth; this file is the quick contract.

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
| action:choose (request) | UI, future action modules | `{ actionId }` |
| actions:loaded | actions | `{ locationId, locationName, biomeKey, actions }` |
| action:chosen | actions | `{ actionId, name, locationId, locationName }` |
| mainCharacter:saved | mainCharacter | `{ id, name, gender, age }` (no image) |
| mainCharacter:statChanged | mainCharacter | `{ id, stat, delta, value, max, eventId }` (any base stat) |

## Module registry

| module | depends | slice | purpose |
|---|---|---|---|
| core | none | `time`, `eventLog` | clock, state, save/load, event checking |
| characters | none | `nextId`, `named{}`, `temp{}` | NPC generator with base stats; Named NPC / Temporary Spawn |
| mainCharacter | none | `character` | player character; base stats; profile image; JSON mirror |
| locations | none | `seed`, `createdAt`, `nextId`, `locations{}`, `currentId` | map locations; visit/event checker; JSON mirror |
| actions | none | `locationId`, `locationName`, `biomeKey`, `actions[]` | five placeholder area actions loaded on visit |

## Characters module v0.2

- Files: `characters/statsData.js`, `characters/data.js`, `characters/characters.js`.
- Character shape: `{ id, gender, name, age, traits[5], stats, createdAtTick, createdAt }`.
- Five of 30 traits, never both sides of an opposite pair. Traits are the personality
  hook for future behaviour weighting; no behaviour rules read them yet.
- `stats` is shared by every character. See **Base stats** below.
- Spawned characters go to `temp`; saving moves them to `named`.
- `character:clearTemp` or `location:changed` empties `temp`.
- New NPCs roll their stats from `CharacterStatsData` with `engine.rng`. Skill rolls are
  bell-curved around the middle of their range. Old NPC saves without stats get the
  definition defaults on load, deterministically.
- Optional disk mirror: `characters/Named NPC/<id>.json`, `characters/Temporary Spawn/<id>.json`.

## Base stats

- Files: `characters/statsData.js` (content only). The characters and mainCharacter
  modules both read `CharacterStatsData.stats`.
- Every character has the same nine stats in this order:

| key | label | kind | range | main start | NPC roll |
|---|---|---|---|---|---|
| `hp` | HP | resource | 0-100 | 100/100 | 70-100 |
| `stamina` | Stamina | resource | 0-100 | 100/100 | 70-100 |
| `mana` | Mana | resource | 0-50 | 50/50 | 20-50 |
| `war` | War | skill | 1-20 | 10 | 1-20, bell |
| `diplomacy` | Diplomacy | skill | 1-20 | 10 | 1-20, bell |
| `personalCombat` | Personal Combat | skill | 1-20 | 10 | 1-20, bell |
| `moneyManagement` | Money Management | skill | 1-20 | 10 | 1-20, bell |
| `intrigue` | Intrigue | skill | 1-20 | 10 | 1-20, bell |
| `intelligence` | Intelligence | skill | 1-20 | 10 | 1-20, bell |

- Resource stats store a paired `<key>Max` field (`hpMax`, `staminaMax`, `manaMax`).
  Skills use the definition `max` directly.
- Character stat block example:

```json
{
  "hp": 100, "hpMax": 100,
  "stamina": 90, "staminaMax": 100,
  "mana": 50, "manaMax": 50,
  "war": 10, "diplomacy": 10, "personalCombat": 10,
  "moneyManagement": 10, "intrigue": 10, "intelligence": 10
}
```

- The stat list, ranges and labels are data. Add a stat by editing `statsData.js`;
  module code iterates the definitions.
- The main character starts from the `start` values. NPCs roll from `npcRange`;
  `npcBell: true` averages three rolls for a mid-range cluster.
- Personality (`traits`) is unchanged and remains NPC-only for now.

## Main character module v0.3

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
  `{ stat, delta }` through `applyEventEffects()`. Any defined base stat works; unknown
  stats are ignored. It emits `mainCharacter:statChanged` at `depth + 1`; resources
  clamp to their max and skills clamp to the definition range.
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
- No tick generator. `init()` creates the slice and subscribes to `location:event` once;
  reset clears the character but keeps that single subscription.
- UI on the test page: name, gender, age, image picker with preview, a nine-stat grid,
  **Save main character**, and **Connect mainChar folder**.

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
  `moneyManagement`, `intrigue`, `intelligence`). Unknown stats stay in the event data
  for future modules.
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

## Actions module v0.1

- Files: `actions/data.js`, `actions/actions.js`; notes in `actions/README.md`.
- Slice:

```js
actions: {
  locationId: null,     // last visited location
  locationName: "",
  biomeKey: "",
  actions: []           // exactly five action objects
}
```

- Action shape: `{ id, name, description }`.
- `actions/data.js` owns `LocationActionsData.default` (five actions) and optional
  `biomes.<biomeKey>` overrides. An override with fewer than five entries is ignored.
- The module listens to `location:visited`; it replaces the previous area's actions,
  stores the area id/name/biome, and emits `actions:loaded` at `depth + 1`.
- It listens to `action:choose` and emits `action:chosen` at `depth + 1`. This is a
  placeholder: choices are logged, but no costs, rewards, travel or other effects apply.
- `init()` subscribes once; reset empties the slice and keeps the subscription. On load,
  `onLoad()` normalizes the loaded slice for the UI.
- UI on the test page: an **Actions** panel appears/updates after a visit, showing five
  **Choose** buttons. The last placeholder choice is shown in the panel status.

## File layout

```
index.html
status.html        read-only live node-tree viewer (not a module)
engine.js
ENGINE_SPEC.md
package.json
actions/
  actions.js
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
  serve.cjs
```

## Known limitations

- The Locations folder mirror (`connectFolder`) is tested with an in-memory File System
  Access API mock in Node, but the real browser picker is untested; it needs Chrome/Edge.
- `location:changed` still only clears Temporary Spawn; it does not move the party or
  relate locations to each other yet.
- Locations have no coordinates, connections, travel, population or resources yet.
  `currentId` marks the last visit only; it is not a travel graph.
- Biome events have no cooldowns, once-only flags, weather filters or requirements.
  Each enabled event is an independent roll on every visit.
- Base stats are stored and location events can change them, but no progression,
  training, equipment, checks or opposed rolls use them yet.
- Biome event JSON is fetched with `fetch`; open the page through the static server,
  not `file://`.
- Area actions are placeholders. Choosing one only emits `action:chosen`; there are no
  stat costs, rewards, time costs, travel or per-action outcomes yet.
- The real mainChar folder picker is untested in a browser; its write logic is covered
  by the Node mock test. It needs Chrome/Edge.
- Uploaded portraits are resized to 256 px and stored as data URLs in state and
  `localStorage`; very large source files are rejected (8 MB default).
- `mainChar/` is a write mirror. It is not imported automatically; `localStorage` or
  the in-game load button remains the way back into a session.
- The test page stores saves in `localStorage` slot `save1`, which some contexts block.
