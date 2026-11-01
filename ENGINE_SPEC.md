# Modular Text-RPG Engine — Spec v1.7

Plain JS/HTML, no build step, no dependencies. A small core runs the clock, event bus,
RNG, state and save/load. All gameplay lives in modules that own one state slice and talk
only through events. Code is the source of truth; this file is the quick contract.
For the per-module code map and "where do I change this?" guide, see `MODULES.md`.
For product intent — vision, pillars, decisions and roadmap — see `DESIGN.md`; unapproved
ideas live in `IDEAS.md`.

## Core behaviour

- **Time:** simulation clock. Each tick advances by `tickMinutes` (the UI offers 1, 5,
  10, 15, 30, 60, 360 or 1440). Start date defaults to `1000-01-01T06:00:00Z`.
- **Event checking:** each tick every registered generator gets its own roll (0-1) and
  may return one event, several, or nothing. The core ships with no generators.
- **Event queue:** events are logged and announced as `event:<type>` then `event`.
  Handlers may fire follow-ups. Depth cap 8; 500 events per tick.
- **Save/load:** the whole state, including the RNG position, is JSON. Same seed plus
  same actions gives the same world.
- **Save files:** the separate `GameSave` helper (`save/gameSave.js`) stores the world seed,
  the baseline engine options and a change list, and rebuilds the live world on import. The
  core is unchanged; the helper sits on top of `serialize()` / `load()`.
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

## Save files (`save/gameSave.js` v0.1)

This is a helper, not a module: it owns no slice and emits no events. It is the contract behind
the page's **Export save file** / **Import save file** buttons.

Format v1:

```json
{
  "format": "text-rpg-save",
  "formatVersion": 1,
  "savedAt": "2026-10-29T12:00:00.000Z",
  "label": "1000-01-03 06:00",
  "seed": 20261029,
  "baseline": { "startDate": "1000-01-01T06:00:00Z", "tickMinutes": 10 },
  "changes": [
    { "op": "set", "path": ["time", "tick"], "value": 3 },
    { "op": "delete", "path": ["modules", "characters", "temp", "npc_0002"] }
  ]
}
```

- `capture(engine, buildEngine)` diffs a fresh baseline against the live state. Objects recurse;
  arrays and scalars are replaced whole, so `eventLog` becomes one change.
- `restore(input, engine, { buildEngine })` reads/migrates the file, rebuilds a fresh world from
  the file's own `seed` and `baseline`, applies the changes and calls `engine.load(fresh.state)`.
  The live engine's previous seed is ignored.
- `buildEngine(opts)` must return a new engine with every module registered and the supplied
  `seed`, `startDate` and `tickMinutes`. A new module must be added to `buildEngine()` in
  `index.html`, or the baseline will not match.
- Supported ops are `set` (with `value`) and `delete`. Paths must start at a top-level state key
  (`version`, `seed`, `rngState`, `time`, `eventLog`, `modules`) and must not contain
  `__proto__`, `prototype` or `constructor`. The limit is 20,000 changes.
- `read()` rejects invalid JSON, unknown formats, a newer `formatVersion`, malformed baselines,
  unknown ops and unsafe paths.
- **Version 0** is a raw legacy engine state (the old localStorage export). `MIGRATIONS[0]`
  rebuilds the fresh world from its seed/start date/tick size and diffs it to v1. A v0 wrapper
  without `legacyState` is rejected.
- The quick **Save / Load** buttons remain the core's `localStorage` slot `save1`. Save files are
  a separate export/import path. See `save/README.md`.

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
| location:add (request) | UI, map module | `{ count?, fixed?, batch? }`; `fixed` is an array of `{ kind, name, biome?, biomeKey?, weather?, hostility? }` landmark definitions |
| location:added | locations | `{ id, kind?, batch? }` |
| map:generate (request) | UI | `{ count? }` (default and clamp from `MapData`) |
| map:generated | map | `{ batch, count, total, landmarks: { tavern, castle, shack } }` |
| location:visited | locations | `{ id, name, biome, biomeKey, weather, hostility }` |
| location:event | locations | `{ locationId, locationName, biomeKey, eventId, name, chancePercent, roll, effects }` |
| location:changed | UI "Leave location", future movement | none (characters clears Temporary Spawn) |
| action:choose (request) | UI, future action modules | `{ actionId, destinationId?, distance?, durationMinutes? }` |
| actions:loaded | actions | `{ locationId, locationName, biomeKey, actions }` |
| action:chosen | actions | `{ actionId, name, locationId, locationName }` |
| action:resolved | actions | `{ actionId, name, outcomeId, outcomeName, text, effects, timeMinutes, equipmentKey, travelTo, travelDistance, locationId, locationName, atTick, at }` |
| action:blocked | actions | `{ actionId, name, reason, locationId, locationName }` |
| travel:start (request) | UI | `{ destinationId, destinationName, durationMinutes, distance?, originId?, originName?, destinationBiomeKey? }` |
| travel:advance (request) | UI | `{ minutes? }` (one check) |
| travel:continue (request) | UI | none |
| travel:cancel (request) | UI | none |
| travel:started | travel | `{ destinationId, destinationName, destinationBiomeKey, originId, originName, distance, durationMinutes, minutesPerCheck }` |
| travel:progress | travel | `{ destinationId, destinationName, elapsedMinutes, durationMinutes, remainingMinutes, checks }` |
| travel:event | travel | `{ eventId, name, text, effects, roll, elapsedMinutes, durationMinutes, destinationId, destinationName, atTick, at }` |
| travel:resumed | travel | `{ destinationId, destinationName, elapsedMinutes, durationMinutes, remainingMinutes }` |
| travel:completed | travel | `{ destinationId, destinationName, originId, originName, distance, elapsedMinutes, durationMinutes, eventCount, atTick, at }` |
| travel:cancelled | travel | `{ destinationId, destinationName, elapsedMinutes, durationMinutes }` |
| equipment:add (request) | UI | `{ key?, kind?, rarity?, weaponType?, armorType? }` (`key` names an item; otherwise a weighted random pick, optionally filtered) |
| equipment:equip (request) | UI | `{ itemId }` |
| equipment:unequip (request) | UI | `{ itemId? }` (omit to clear all) |
| equipment:remove (request) | UI, future events/mobs | `{ itemId }` (destroys the item; unequips it first when worn) |
| equipment:added | equipment | `{ itemId, key, name, kind, rarity, weaponType?, armorType?, parts, armor?, damage?, strength?, armorPiercing?, equipped, source }` |
| equipment:equipped | equipment | `{ itemId, key, name, kind, rarity, weaponType?, armorType?, parts, armor?, damage?, strength?, armorPiercing?, totalArmor, replacedItemIds }` |
| equipment:unequipped | equipment | `{ itemId, itemIds, items, key, name, kind, rarity, weaponType?, armorType?, parts, armor, totalArmor }` |
| equipment:removed | equipment | `{ itemId, key, name, kind, rarity, weaponType?, armorType?, wasEquipped, totalArmor }` |
| combat:start (request) | UI | `{ player, enemy }` combatant snapshots with `personalCombat`, `strength`, `armor`, `weapon` |
| combat:action (request) | UI | `{ action: "attack" \| "defend" }` |
| combat:started | combat | `{ playerId, playerName, enemyId, enemyName, playerWeapon, enemyWeapon }` |
| combat:damage | combat | `{ action, sourceId, sourceName, targetId, targetName, amount, base, hpBefore, hpAfter, hpMax, defended, armor, effectiveArmor, armorMultiplier, reduction, armorPiercing, strength, weapon, weaponDamage, tooHeavy }` |
| combat:defended | combat | `{ id, name, armor, reduction }` |
| combat:ended | combat | `{ winnerId, winnerName, loserId, loserName, rounds }` |
| mainCharacter:saved | mainCharacter | `{ id, name, gender, age }` (no image) |
| mainCharacter:statChanged | mainCharacter | `{ id, stat, delta, value, max, eventId }` (any non-equipment base stat) |
| mainCharacter:armorChanged | mainCharacter | `{ id, stat: "armor", delta, value, previous, itemId, itemName }` |

## Module registry

| module | depends | slice | purpose |
|---|---|---|---|
| core | none | `time`, `eventLog` | clock, state, save/load, event checking |
| characters | none | `nextId`, `named{}`, `temp{}` | NPC generator with personality, behavior, base stats and body; Named NPC / Temporary Spawn |
| mainCharacter | none | `character` | player character; base stats, body; profile image; event/action/travel effects; JSON mirror |
| combat | none | `active`, `round`, `turn`, `player`, `enemy`, `defending`, `winner*`, `log[]` | basic player-first duel; attack/defend |
| locations | none | `seed`, `createdAt`, `nextId`, `locations{}`, `currentId` | procedural locations, routes, visit/event checker, JSON mirror |
| map | locations | `seed`, `size`, `total`, `lastGeneratedTick`, `lastGeneratedAt`, `landmarks{}` | one map spawn request: fixed landmarks plus random locations through `location:add` |
| actions | none | `locationId`, `locationName`, `biomeKey`, `actions[]`, `lastAction` | five area actions with costs, outcomes, time and route-based travel |
| travel | none | `active`, `paused`, `distance`, route, `elapsedMinutes`, `durationMinutes`, `checks`, `eventCount`, `lastEvent`, `lastCompleted` | 5-minute journey checks; pause/resume on travel events |
| equipment | none | `nextId`, `items{}`, `equippedByPart{}`, `equippedWeaponId` | main-character armor on body parts plus one weapon slot; weapon/armor types; mirrors summed armor into the character stat |

`save/gameSave.js` is not a module and has no registry row: it owns no slice and emits no
events. It captures, migrates and restores the whole state (see **Save files** above).

`editor.html` (with `editor/core.js` and `editor/schemas.js`) is also tooling, not a module:
it owns no slice, emits no events and is not registered. It reads and writes the content
files directly; see `editor/README.md`.

## Characters module v0.5

- Files: `characters/statsData.js`, `characters/data.js`, `characters/bodyData.js`,
  `characters/body.js`, `characters/characters.js`.
- Character shape: `{ id, gender, name, age, personality, traits[5], behavior, stats, body,
  createdAtTick, createdAt }`.
- `personality` is `{ id, name }` from one of 30 archetypes in
  `CharacterData.personalities`. An archetype owns its five traits and its behavior
  profile.
- `traits[5]` is copied from the archetype, never both sides of an opposite pair.
- `behavior` holds one integer 0-100 per axis in `CharacterData.behaviorAxes`:
  `aggression`, `caution`, `sociability`, `honesty`, `generosity`, `loyalty`,
  `curiosity`, `ambition`. It is the foundation for future AI; **no rule reads it yet**.
  Future dialogue, NPC events, travel and combat AI should read `character.behavior`
  rather than infer intent from the name or traits.
- `stats` is shared by every character. See **Base stats** below.
- `body` is shared by every character. See **Character body** below.
- Spawned characters go to `temp`; saving moves them to `named`.
- `character:clearTemp` or `location:changed` empties `temp`.
- New NPCs roll personality, then traits, then behavior, then stats with `engine.rng`.
  Skill rolls are bell-curved around the middle of their range. Armor rolls its `[0, 0]`
  range, so it starts at 0. The body is deterministic: no RNG.
- Old NPC saves are migrated deterministically on load: a valid `personality.id` is kept,
  otherwise the archetype with the most trait overlap is chosen, then missing traits and
  behavior axes are filled from that archetype (behavior falls back to `50`). Old saves
  without stats get the definition defaults, and missing body parts are rebuilt.
- `combat:damage` targeting an NPC lowers that NPC's HP, clamped to 0..`hpMax`. The
  combat module announces the hit; characters does not emit a second stat event.
- Optional disk mirror: `characters/Named NPC/<id>.json`, `characters/Temporary Spawn/<id>.json`.

## Base stats

- Files: `characters/statsData.js` (content only). The characters and mainCharacter
  modules both read `CharacterStatsData.stats`.
- Every character has the same ten base stats plus an empty armor stat, in this order:

| key | label | kind | range | main start | NPC roll |
|---|---|---|---|---|---|
| `hp` | HP | resource | 0-100 | 100/100 | 70-100 |
| `stamina` | Stamina | resource | 0-100 | 100/100 | 70-100 |
| `mana` | Mana | resource | 0-50 | 50/50 | 20-50 |
| `strength` | Strength | skill | 1-20 | 10 | 1-20, bell |
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
  location and action effects never change it. Combat reduces every incoming hit by armor
  and doubles that reduction while defending (see **Combat module**). NPCs do not equip
  yet and stay at 0.
- `strength` gates weapons: a weapon only adds damage and armor piercing when the
  wielder's Strength meets its requirement. It is a normal skill for effects and rolls.
- Character stat block example:

```json
{
  "hp": 100, "hpMax": 100,
  "stamina": 90, "staminaMax": 100,
  "mana": 50, "manaMax": 50,
  "strength": 10,
  "armor": 0,
  "war": 10, "diplomacy": 10, "personalCombat": 10,
  "moneyManagement": 10, "intrigue": 10, "intelligence": 10
}
```

- The stat list, ranges and labels are data. Add a stat by editing `statsData.js`;
  module code iterates the definitions.
- The main character starts from the `start` values. NPCs roll from `npcRange`;
  `npcBell: true` averages three rolls for a mid-range cluster.
- Personality (`personality`, `traits` and `behavior`) is NPC-only for now. The main
  character has no behavior profile; future modules may add one separately.

## Character body

- Files: `characters/bodyData.js` (content), `characters/body.js` (shared builder/normaliser).
  Both must load before `characters.js` and `mainCharacter.js`.
- Every character, NPC or main, has:

```json
{
  "body": {
    "parts": {
      "head": { "key": "head", "label": "Head", "kind": "head", "side": "center",
                "parent": "torso", "vital": true, "status": "intact" }
    }
  }
}
```

- The full part list, in display order: `head`, `torso`, `leftLeg`, `rightLeg`, `leftArm`,
  `rightArm`, `leftHand`, `rightHand`, `leftFoot`, `rightFoot`.
- `kind` is `head`, `torso`, `leg`, `arm`, `hand` or `foot`; `side` is `center`, `left` or
  `right`. `parent` links a part to the part it attaches to (`torso` is the root). `vital`
  marks `head` and `torso`.
- `status` starts at `CharacterBodyData.defaultStatus` (`"intact"`) and is stored per
  character. **No injury, combat or healing rule reads it yet.** It is a free string so a
  future injury system can add values without a save migration. Equipment targets the part
  keys (not `status`), so armor and injuries stay independent for now.
- `CharacterBody.create()` builds a fresh body; `CharacterBody.normalise(body)` rebuilds
  missing parts, keeps saved statuses and unknown fields on known parts, and keeps unknown
  extra parts. Old saves without a body gain the full ten-part body on load.

## Main character module v0.6

- Files: `characters/mainCharacterData.js`, `characters/mainCharacter.js`, plus the shared
  `characters/bodyData.js` and `characters/body.js`.
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
  "body": { "parts": { "head": { "key": "head", "status": "intact" } } },
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
- `body` uses the shared **Character body** shape. Profile edits preserve saved part
  statuses; a missing or partial body is completed on load/save. It is included in
  `main.json`.
- Legacy saves with top-level `stamina`/`staminaMax` are migrated into
  `stats.stamina`/`stats.staminaMax` on load, and the old top-level fields are removed.
- The module subscribes once to `location:event` and applies effects with
  `{ stat, delta }` through `applyEventEffects()`. Any defined non-equipment stat works;
  unknown and equipment stats are ignored. It emits `mainCharacter:statChanged` at
  `depth + 1`; resources clamp to their max and skills clamp to the definition range.
- It subscribes once to `action:resolved` and applies the combined costs and outcome
  effects through `applyActionEffects()` with the same clamping. The stat event's
  `eventId` is the action id.
- It subscribes once to `travel:event` and applies the interruption effects through
  `applyTravelEffects()` with the same clamping. The stat event's `eventId` is the
  travel event id.
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
  `action:resolved`, `travel:event`, `equipment:equipped` / `equipment:unequipped` and
  `combat:damage`; reset clears the character but keeps those single subscriptions.
- UI on the test page: name, gender, age, image picker with preview, a stat grid
  (ten base stats plus armor), a Body grid, **Save main character**, and **Connect
  mainChar folder**. NPC cards show a compact stat line and body line.

## Combat module v0.2

- Files: `combat/data.js`, `combat/combat.js`; notes in `combat/README.md`.
- Slice:

```js
combat: {
  active: false,
  round: 0,
  turn: null,             // "player" while waiting for input
  player: null,           // { id, name, hp, hpMax, personalCombat, strength, armor, weapon }
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
  for the fight. `strength` defaults to 10 when omitted. `weapon` is `null` or
  `{ key, name, damage, strength, armorPiercing, rarity, weaponType? }`.
- The player always moves first: round 1, `turn: "player"`. The player chooses
  **Attack** or **Defend** with `combat:action`.
- Attack damage is based on the attacker's Personal Combat plus a usable weapon:
  `max(minDamage, round(personalCombat * multiplier) + weapon.damage)`. Defaults are `1`
  and `1`, so Personal Combat 10 deals 10 damage without a weapon.
- A weapon is usable only when the attacker's `strength` is at least `weapon.strength`.
  A too-heavy weapon adds no damage and no armor piercing; the hit still happens with the
  bare Personal Combat value and the log says the weapon is too heavy.
- Armor reduces **every** incoming hit. The attacker's weapon armor piercing shrinks it:
  `effectiveArmor = round(armor * (100 - armorPiercing) / 100)`, then
  `reduction = round(effectiveArmor * armorMultiplier)`, and finally
  `damage = max(0, baseDamage - reduction)`. `armorMultiplier` is 1 for a normal hit and
  `CombatData.defend.armorMultiplier` (2) while the defender used Defend.
- Defend sets `defending` for the next enemy attack; the flag is consumed by that hit.
  After a surviving enemy is hit, it immediately attacks back. A lethal player hit ends
  the fight before the counterattack.
- The enemy always attacks in v0.2; `CombatData.enemyAction` is the future AI hook.
- Damage is emitted as `combat:damage`; the mainCharacter and characters modules apply it
  to the real character slices. The module also emits `combat:started`,
  `combat:defended` and `combat:ended` at `depth + 1` (or one deeper for the enemy turn).
- `combat:damage` includes `amount`, `base`, `hpBefore`, `hpAfter`, `hpMax`, `defended`,
  `armor`, `effectiveArmor`, `armorMultiplier`, `reduction`, `armorPiercing`, `strength`,
  `weapon`, `weaponDamage` and `tooHeavy`, so the UI and future modules can react without
  parsing text.
- The slice keeps the final snapshots, winner and log after a fight, so the UI can show
  the result. Starting a new fight resets the slice. Reset clears it.
- UI on the test page: every NPC card has a **Fight** button; the **Combat** panel shows
  both HP totals, round/turn, **Attack** and **Defend**, and the last eight log lines.
  The player snapshot includes the equipped weapon and Strength from the equipment panel.

## Locations module v0.4

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
  "kind": "",
  "weather": "Sandstorm",
  "hostility": 75,
  "seed": 1419639272,
  "createdAtTick": 0,
  "createdAt": "1000-01-01 06:00",
  "connections": [
    { "id": "loc_0002", "distance": 3 }
  ]
}
```

- `hostility` is an integer 1-100. Biomes define a range; labels come from
  `LocationData.hostilityBands` (`Peaceful`, `Watchful`, `Unsettled`, `Dangerous`, `Deadly`).
- `connections` is the travel graph. Each route is `{ id, distance }`, stored on both
  endpoints and sharing one distance. `distance` is an abstract whole number; the module
  exposes `travelMinutes(distance)` (`distance × travelGraph.minutesPerDistance`, 15 min
  by default, clamped to 1-1440).
- Each newly charted location links to the current area when there is one, plus enough
  random neighbours to reach `travelGraph.links` (1-2 by default). Different distances are
  rolled per route. The charted map therefore stays connected, but it is an abstract link
  graph: there are no coordinates, and a journey only traverses one route.
- `connectionsFor(id)` returns UI-ready routes (`id`, `name`, `biome`, `biomeKey`,
  `kind`, `weather`, `hostility`, `distance`, `minutes`), sorted by distance then name.
  `routeBetween(fromId, toId)` returns one route or `null`.
- `kind` is `""` for ordinary random locations and a landmark id such as `tavern`,
  `castle` or `shack` for a fixed definition. Landmarks use the synthetic
  `biomeKey: "landmark"` so biome event files do not roll on them.
- On load/import, dangling and self routes are dropped, one-way routes are made mutual,
  duplicates collapse to the shortest distance, and isolated legacy locations are linked
  deterministically with `travelGraph.legacyDistance`. This repair uses no RNG.
- Generation is request-driven only. The module registers **no generator** and does
  nothing on tick. A new world creates a new map seed in `init()`; no locations are
  created until `location:add` arrives. The UI and the map module both use that request.
- `location:add` accepts `{ count, fixed, batch }`. `fixed` entries bypass the random
  rolls and keep their supplied name/kind/biome/weather/hostility; they still get an id,
  route links and a `location:added` event like any other location. Fixed names are made
  unique if a map is generated twice.
- Randomness comes from `engine.rng`. Names are unique. New locations try to avoid
  repeating an existing biome + weather pair until the data is exhausted. Route targets
  and distances also use `engine.rng`.
- The page's **Visit** button only enables a direct route from the current location (or
  any location when none is current). `visit(id)` itself stays permissive so arrival
  handoffs and tests can call it directly; the UI is what enforces the graph for manual
  movement.
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
- UI on the test page: **Generate map** with a random-location count, **Add location**,
  **Add 5 locations**, **Connect Locations folder**, **Reload biome events**, a **Visit**
  button per location (direct routes only), a current-location marker, route counts, visit
  status, and a **JSON** download button per location.

## Map module v0.1

- Files: `map/data.js`, `map/map.js`.
- Slice:

```js
map: {
  seed: 0,                 // world/map seed copied when a map is generated
  size: 0,                 // random locations requested (excluding landmarks)
  total: 0,                // size + fixed landmarks
  lastGeneratedTick: null,
  lastGeneratedAt: "",
  landmarks: {}            // kind -> location id, e.g. { tavern: "loc_0001", ... }
}
```

- `map/data.js` owns `defaultLocationCount` (20), `minLocationCount` (0),
  `maxLocationCount` (100) and the fixed `landmarks` list. The current placeholders are a
  tavern (`The Broken Wheel`), a castle (`Greywatch Castle`) and a shack
  (`Abandoned Shack`). They are intentionally simple and can change without code.
- `map:generate { count? }` clamps the count and fires **one** `location:add` request with
  `{ count, fixed: landmarks, batch }`. It does not create locations or read the locations
  slice itself.
- `location:added` events carrying that `batch` are counted. When the last one arrives,
  the module emits `map:generated` at `depth + 1` and records the fixed landmark ids.
  A batch of 0 (landmarks only, or nothing) emits immediately.
- `map` declares `depends: ["locations"]` so it is registered after the module it drives.
  It has no RNG and registers no generator. Reset clears the slice and the in-flight batch;
  load normalizes old saves without map metadata.
- Future maps can add more landmarks or per-map layout rules in `map/data.js`; nothing
  outside the map and locations modules reads the slice yet.

## Actions module v0.3

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
- It listens to `action:choose` with `{ actionId, destinationId?, distance?, durationMinutes? }`.
  It emits `action:chosen`, then picks one outcome with `engine.rng` (weighted by `weight`,
  default 1) and emits `action:resolved` at `depth + 1`.
- `action:resolved` carries the combined `costs` + outcome `effects`, `timeMinutes`,
  an optional `equipmentKey`, an optional `travelTo` and `travelDistance`. The module
  applies none of them itself:
  - `mainCharacter` applies the effects and emits `mainCharacter:statChanged`.
  - `equipment` adds the item named by `equipmentKey`.
  - the UI advances the clock by whole ticks for a normal action. For `travelTo`, the UI
    starts the travel module, which drives 5-minute checks; the destination is visited
    only after the journey completes.
- For a travel action the UI supplies the chosen route's `distance` and `durationMinutes`
  from the locations module, so `timeMinutes` follows the route instead of the action's
  fallback `timeMinutes`. Without that data (tests or a non-UI caller), the action value is
  used. `travelDistance` is `null` for normal actions.
- Travel actions set `requiresDestination: true` and have no outcomes. Without a
  destination the module emits `action:blocked` and resolves nothing. Movement stays in
  the locations module; actions never edits the locations slice.
- `lastAction` is JSON-safe and included in saves, so the UI/status tree can show the
  last resolution.
- `init()` subscribes once; reset empties the slice and keeps the subscription. On load,
  `onLoad()` normalizes the loaded slice for the UI.
- UI on the test page: an **Actions** panel with five **Choose** buttons, cost/time text
  in each row, a destination dropdown for Travel (connected routes only, with distance and
  route time), and the last resolution in the status.

## Travel module v0.2

- Files: `travel/data.js`, `travel/travel.js`; notes in `travel/README.md`.
- Slice:

```js
travel: {
  active: false,
  paused: false,
  originId: null, originName: "",
  destinationId: null, destinationName: "", destinationBiomeKey: "",
  distance: 0,               // route units echoed from the travel graph
  elapsedMinutes: 0,
  durationMinutes: 0,       // rounded up to whole checks
  minutesPerCheck: 5,
  checks: 0,
  eventCount: 0,
  pausedAtMinutes: null,
  lastEvent: null,          // interruption that caused the current pause
  lastCompleted: null       // most recent arrival summary
}
```

- A journey starts from `travel:start` after the UI resolves a Travel action. The UI
  passes a destination snapshot (`destinationId`, `destinationName`,
  `destinationBiomeKey`), the route `distance` and `durationMinutes`; the module never
  reads the locations slice. `distance` is an echo for the panel/status; duration still
  comes from the caller, which derives it from the route.
- Duration is rounded up to a whole number of checks. A 30-minute journey is six
  5-minute checks; a 27-minute journey becomes 30.
- The UI drives time. It temporarily sets the core tick size to
  `TravelData.minutesPerCheck` (5), steps one tick, fires `travel:advance`, and repeats.
  It restores the previous tick size after a pause or completion. The module itself
  does not touch `state.time`. Generators and `onTick` modules, if added later, see one
  5-minute tick per travel check.
- After each check the module rolls once: `chancePercent` (or
  `chanceByBiome[destinationBiomeKey]`) is the per-check chance. On a hit it picks one
  enabled event by `weight`, sets `paused`, stores `lastEvent`, and emits
  `travel:event`. Positive and negative events both pause.
- `travel:event` carries `effects`; `mainCharacter` applies them with
  `applyTravelEffects()` and emits `mainCharacter:statChanged` at `depth + 1`.
- Quiet checks emit `travel:progress`; the final quiet check emits `travel:completed`.
  An event on the final check pauses first; after `travel:continue` the next
  `travel:advance` completes without adding time.
- `travel:continue` clears the pause and emits `travel:resumed`; the UI then resumes the
  check loop. `travel:cancel` abandons the journey without a refund.
- The module calls no other module. On `travel:completed` the UI calls
  `locations.visit(destinationId)`, so locations remains the only mover.
- Travel events are a separate catalogue from biome events. Biome events still roll
  once when the destination is visited.
- `init()` subscribes once and `onLoad()` normalizes the slice, including an in-flight
  journey. A paused journey survives save/load; the player resumes with **Continue
  travel**.
- UI on the test page: a **Travel** panel with route, distance, elapsed/duration, check
  count, the paused event, **Continue travel** and **Cancel journey**. Actions are
  disabled while a journey is active.
- Content: `travel/data.js` owns `minutesPerCheck`, `chancePercent`,
  `chanceByBiome` and `events: [{ id, name, text, weight, enabled, effects }]`.

## Equipment module v0.4

- Files: `equipment/data.js`, `equipment/equipment.js`; notes in `equipment/README.md`.
- Slice:

```js
equipment: {
  nextId: 1,
  items: {                       // item id -> item
    "eq_0001": {
      id: "eq_0001", key: "leather_cuirass", name: "Leather Cuirass",
      kind: "armor", rarity: "uncommon", armorType: "leather",
      parts: ["torso"], armor: 3, equipped: true,
      acquiredAtTick: 0, acquiredAt: "1000-01-01 06:00"
    },
    "eq_0002": {
      id: "eq_0002", key: "tempered_longsword", name: "Tempered Longsword",
      kind: "weapon", rarity: "uncommon", weaponType: "sword",
      parts: [], damage: 6, strength: 6, armorPiercing: 16, equipped: true,
      acquiredAtTick: 0, acquiredAt: "1000-01-01 06:00"
    }
  },
  equippedByPart: { torso: "eq_0001" },   // body part key -> armor item id
  equippedWeaponId: "eq_0002"             // one weapon slot, or null
}
```

- `equipment/data.js` owns the catalogue, `rarities`, `weaponTypes` and `armorTypes`.
  Every item has `kind` (`"armor"` or `"weapon"`), `rarity` (one of the five keys below)
  and a type from the matching list: weapons use `weaponType` (`sword`, `spear`, `axe`,
  `mace`), armor uses `armorType` (`cloth`, `leather`, `mail`, `plate`, `scale`). Armor
  also has `parts` and `armor`; weapons have `damage`, `strength` and `armorPiercing`.
  Add or tune content there; module code iterates the lists.
- A missing or unknown type falls back to the item definition and then to the first
  defined type when an old save loads.
- Rarity ranks, weakest first: `common`, `uncommon`, `rare`, `legendary`, `unique`. Each
  rank defines stat bands (`armor`, `damage`, `strength`, `armorPiercing`) that are
  strictly stronger than the previous rank. The content editor checks shipped values
  against those bands. `weight` is the random-find weight.
- Armor is worn as one piece over every part it lists. Two worn armor items may not share
  a part. Equipping an overlapping item replaces the conflicting items wholly; they stay
  in the inventory. `equippedByPart` is the source of truth, and `item.equipped` is true
  when the item is worn (armor) or in the weapon slot (weapon).
- Total armor is the sum of the distinct worn armor items' armor, clamped to `maxArmor`.
  A newly acquired item auto-equips when its slot is free (every covered part for armor,
  an empty weapon slot for a weapon); otherwise it stays in the inventory.
- Requests: `equipment:add` (`{ key?, kind?, rarity?, weaponType?, armorType? }`; omit the
  key for a weighted random pick, optionally filtered by kind, rarity or type),
  `equipment:equip` (`{ itemId }`), `equipment:unequip` (`{ itemId? }`; omit the id to
  clear every worn item and the weapon) and `equipment:remove` (`{ itemId }`, which
  destroys the item and unequips it first).
- Module events: `equipment:added`, `equipment:equipped`, `equipment:unequipped` and
  `equipment:removed` at `depth + 1`. Equip/unequip events include `kind`, `rarity`, the
  item's `weaponType` or `armorType`, `parts`, `totalArmor` and the item's stats; the
  equipped event also carries `replacedItemIds`. Weapon events keep `totalArmor`
  unchanged, so the armor bridge ignores them.
- The module listens to `action:resolved`; an outcome with `equipmentKey` adds that item
  (auto-equipping when its slot is free) without the actions module calling it.
- `mainCharacter` listens to the equipped/unequipped events, clamps `totalArmor` to
  0-100, writes `stats.armor` and emits `mainCharacter:armorChanged`. The equipment module
  never reads or writes another module's slice.
- Save migration: a v0.1 `equippedId` is assigned to every part the item covers; legacy
  items with `slot: "body"` take `parts` from the catalogue. `equippedId` is removed and
  a missing `equippedWeaponId` becomes `null`.
- Only the main character can equip in v0.4. NPCs stay at armor 0 and have no weapon.
- UI on the test page: an **Equipment** panel with **Find armor**, **Find weapon**, total
  armor, covered parts, the weapon slot, each item's type and rarity and per-item
  **Equip** / **Unequip** / **Destroy**, plus **Unequip all**. A weapon whose Strength
  requirement is above the character's Strength cannot be equipped from the UI.

## File layout

```
index.html
status.html        read-only live node-tree viewer (not a module)
editor.html        form-based content editor (not a module)
engine.js
ENGINE_SPEC.md
MODULES.md         living per-module handbook (update with every module change)
package.json
actions/
  actions.js
  data.js
  README.md
travel/
  travel.js
  data.js
  README.md
save/
  gameSave.js
  README.md
editor/
  core.js
  schemas.js
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
  travel.test.cjs
  equipment.test.cjs
  combat.test.cjs
  save.test.cjs
  editor.test.cjs
  serve.cjs
```

## Known limitations

- The Locations folder mirror (`connectFolder`) is tested with an in-memory File System
  Access API mock in Node, but the real browser picker is untested; it needs Chrome/Edge.
- `location:changed` still only clears Temporary Spawn; it does not move the party.
- Locations have no coordinates, population or resources. The travel graph is an abstract
  link graph: each route has a distance but no drawn road, and a journey traverses one
  route. Multi-hop route planning, route-specific encounters and weather/hostility effects
  on travel are not built.
- The page's **Visit** button requires a direct route from the current location; the
  module's `visit()` remains permissive for tests and arrival handoffs.
- Travel events are generic interruptions with stat effects. They do not start combat,
  offer choices or depend on route distance, weather or hostility. Each check is an
  independent roll.
- Biome events have no cooldowns, once-only flags, weather filters or requirements.
  Each enabled event is an independent roll on every visit.
- Base stats are stored, and location events and area actions can change them. Combat uses
  Personal Combat and armor, but there is no progression, training or opposed-roll system
  yet.
- Combat is one-on-one and player-first. There is no flee, positioning, initiative, hit
  chance, damage variance or enemy AI; the enemy always attacks.
- Armor comes from the equipment module, which is main-character-only and targets the ten
  body parts. NPCs still fight at armor 0. Defend uses `max(0, damage - armor * 2)`.
- Equipment armor is mirrored to the main character present when it is equipped. The UI
  requires a saved character before **Find armor**; an action reward equipped before the
  character exists will not change `stats.armor` later.
- Area actions resolve costs, one weighted outcome, time and travel, but have no
  requirements or skill checks. Travel only offers connected destinations; a journey
  spends time in 5-minute checks and pauses on interruptions. There is no multi-hop route
  planning or encounter choice yet.
- Biome event JSON is fetched with `fetch`; open the page through the static server,
  not `file://`.
- The real mainChar folder picker is untested in a browser; its write logic is covered
  by the Node mock test. It needs Chrome/Edge.
- The content editor edits only biome events, travel, armor, actions and character
  names/traits/ages; map, locations, stats, combat tuning, behavior axes and personality
  archetypes are read-only or absent. Its folder picker is likewise tested only with a mock.
  Without a folder, downloads cannot keep directories.
- Uploaded portraits are resized to 256 px and stored as data URLs in state and
  `localStorage`; very large source files are rejected (8 MB default).
- `mainChar/` is a write mirror. It is not imported automatically; `localStorage` or
  the in-game load button remains the way back into a session.
- Quick save uses `localStorage` slot `save1`, which some contexts block. **Export save file**
  writes a real JSON download and **Import save file** reads it back; the two paths are
  independent.
- A save file is a snapshot diff, not a replay log. It cannot merge two divergent saves, and
  today it is often close to full-state size because most content is created by play rather
  than derived from the seed.
