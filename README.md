# Modular Text-RPG Engine

**Repository:** <https://github.com/animefordaysXD/TestGame>

> **New AI session? Start with [HANDOFF.md](HANDOFF.md).** It summarizes the current
> state, architecture rules, tests, known limitations and next steps. For a per-module
> map and "where do I change this?" guide, use [MODULES.md](MODULES.md). For what the
> game is and why, read [DESIGN.md](DESIGN.md); unapproved ideas live in
> [IDEAS.md](IDEAS.md).

Current build: core v0.2, characters v0.6, main character v0.7, creator v0.1, equipment v0.4,
locations v0.5, map v0.2, tutorial v0.1, actions v0.3, travel v0.2, combat v0.2, encounters v0.1,
save helper v0.1, plus the read-only status viewer and the content editor (`editor.html`
— a tool, not a module, and never loaded by the game).

## Run

The page needs to be served over HTTP because the optional folder mirror uses the File
System Access API (Chrome/Edge), and `localStorage` can be blocked on `file://`.

From the repository root:

```sh
npm run serve
```

Then open <http://127.0.0.1:8765/>. The live status tree is at
<http://127.0.0.1:8765/status.html>, and the content editor is at
<http://127.0.0.1:8765/editor.html>.

## Test

From the repository root:

```sh
npm test
```

The tests run in Node only. The disk-mirror test uses an in-memory mock of the File
System Access API; it does not prove the real browser folder picker works.

On Windows, if PowerShell blocks `npm.ps1`, use `npm.cmd test` or run the test files
directly with `node test/locations.test.cjs`, `node test/locations-disk.test.cjs`,
`node test/characters.test.cjs`, `node test/relations.test.cjs`,
`node test/main-character.test.cjs`, `node test/creator.test.cjs`,
`node test/tutorial.test.cjs`, `node test/biome-events.test.cjs`,
`node test/actions.test.cjs`, `node test/equipment.test.cjs`,
`node test/travel.test.cjs`, `node test/combat.test.cjs`, `node test/encounters.test.cjs`,
`node test/map.test.cjs`, `node test/save.test.cjs`, and `node test/editor.test.cjs`.

## Layout

- `engine.js` — core (unchanged v0.2)
- `characters/` — NPC generator, shared base stats, body data/helper, character creator, main character storage
- `equipment/` — armor and weapon catalogue, weapon/armor types, rarity tiers, main-character inventory (equip/unequip/destroy)
- `combat/` — player-first duels with weapons, Strength gating and armor piercing (Attack/Defend)
- `locations/` — procedural locations with hostility and levels, linked into a travel graph
- `encounters/` — hostility-driven hostile spawns on visit and hostility-scaled loot on a win
- `map/` — static world map with authored sites and routes, plus procedural landmark interiors
- `tutorial/` — persistent opening checklist and its labels/hints
- `locations/events/` — per-biome event JSON (working events and copy/paste templates)
- `actions/` — five area actions with costs/outcomes and optional biome overrides
- `travel/` — route-based journeys with 5-minute interruption checks and pause/resume
- `save/` — seed + baseline + changes save files, JSON export/import and legacy migration
- `editor/` — content editor core and schemas (no state, not loaded by the game)
- `editor.html` — form editor for biome events, travel, equipment, actions, character creation and map content
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
- every module and its live state slice: NPCs with personality archetypes, traits, behavior
  profiles, stats and ten-part bodies, the
  main character with HP/Stamina/Mana, armor, skills, body parts and starting build, the
  creator's last build, the equipment inventory, the
  current combat and its log, locations with their routes and the current marker, the static
  map's site keys, landmarks and generated interiors, the tutorial checklist, the five
  loaded actions plus the last resolution, and the current journey with its distance,
  checks and last interruption;
- content data counts and the enabled/total events in each biome file;
- the event catalog and the Node test files.

The page is a viewer only: it does not register modules, change the save or touch game
logic. Nodes expand/collapse on click, the canvas can be dragged, and the toolbar has
zoom, fit-width, copy-as-text and SVG download. Use **Load state JSON** to inspect a saved
engine state (not a v1 seed + changes save file), or **Reload save** after saving in the game.
Folder connections are runtime-only and are not stored in the save, so the tree cannot show
them.

## Save files

- **Quick save** / **Quick load** still use the browser's `localStorage` slot `save1`. This is
  the fast in-session path and what `status.html` reads.
- **Export save file** downloads a `.json` file. **Import save file** loads one back.
- A save file stores the world seed, the baseline engine options (`startDate`, `tickMinutes`)
  and the changes made since a fresh world. Import rebuilds the baseline and applies the
  changes, so the file does not need to be a full state dump.
- Legacy full-state saves are migrated to the new format on import. Newer format versions are
  refused with a clear message.
- Save files are untrusted input: prototype-pollution paths and paths outside the engine state
  are rejected.
- Modules are registered in one `buildEngine(opts)` factory in `index.html`, used by both the
  live page and the save baseline. **A new module must be added there** or saves will not
  rebuild it.
- The full format, API, migration and limits are in `save/README.md`.

## Opening and tutorial

- The game opens on the character creator. Choose a background, origin and focus, then press
  **Create character**.
- The first save loads the static map and places the character in **Greywatch Village**.
  The rest of the game appears, with the starting kit already in the **Inventory**.
- The **Tutorial** panel tracks four steps: create a character, arrive in the village, take
  your first action, and travel to **The Broken Wheel** tavern. Travel from the starting
  town defaults to the tavern.
- Tutorial progress is stored in the save. It is guidance, not a gate; after the checklist
  you can explore, scavenge, fight or travel onward.
- On a later visit, the landing page offers **Continue saved game** and **Import save file**.

## Character creator

- The Main character panel has **Background**, **Origin** and **Focus** selects. Each option
  adds starting stat changes and equipment from `characters/creatorData.js`. On the first
  visit this panel is the landing screen.
- A live preview shows the resulting stats and starting kit. Resources start at 80% of
  their maximum, so positive and negative choices both matter.
- The first **Create character** save uses the build: the creator fires
  `mainCharacter:create`, grants each item through `equipment:add`, and leaves the normal
  auto-equip and armor bridge to run. Later **Save profile** calls keep the current stats,
  equipment and build.
- The creator data is editable in `editor.html` (settings, backgrounds, origins, focuses).

## Main character

- Enter a name, choose a gender, set an age, and pick an image for the profile picture.
- **Create character** (first save) or **Save profile** stores the character in the game
  state (and therefore in the normal Save/Load slot).
- Uploaded images are centre-cropped to a square, resized to 256 px, and stored as a
  WebP/PNG data URL. If no image is picked, an initials avatar is generated as SVG.
- **Connect mainChar folder** writes `characters/mainChar/main.json` and a viewable
  `profile.webp`/`.png`/`.svg` file. Later saves rewrite both. Folder access needs
  Chrome or Edge.
- The main character and every NPC share ten base stats from
  `characters/statsData.js`: HP, Stamina, Mana, Strength, War, Diplomacy, Personal Combat,
  Money Management, Intrigue and Intelligence, plus an `armor` equipment stat.
  HP/Stamina/Mana are resources; the skills are 1-20; armor is 0-100 and starts at 0.
  The creator path starts resources at 80% of their maximum, then applies the chosen
  background/origin/focus changes; a profile-only save starts at 100/100 HP, 100/100
  Stamina, 50/50 Mana, 0 armor and 10 in each skill. NPCs roll their values. Strength is
  the weapon requirement used by combat.
- Location events, resolved area actions and travel interruptions can change any
  non-equipment base stat; the current values are saved with the character. Armor is
  written by the equipment module and is ignored by event/action/travel effects. The
  main-character panel shows all stats in a grid, and each NPC card shows a compact stat
  line.
- Every character, including the main character, has a ten-part humanoid body: head,
  torso, left/right leg, left/right arm, left/right hand and left/right foot. The parts,
  their side/parent links and the vital flags live in `characters/bodyData.js`; the shared
  builder/normaliser is `characters/body.js`. Each part stores a status that starts at
  `"intact"`. The main-character panel shows a Body grid and NPC cards show a compact body
  line; no injury, combat or healing rule reads part status yet. Equipment targets the
  part keys, so armor and injuries stay independent. Old saves gain a
  complete body on load, and saved statuses survive.
- The main character is separate from the generated NPCs in Named NPC / Temporary Spawn.
  Each NPC rolls one of 30 named personality archetypes. The archetype supplies five traits
  and an eight-axis behavior profile (`aggression`, `caution`, `sociability`, `honesty`,
  `generosity`, `loyalty`, `curiosity`, `ambition`, each 0-100). The card shows the
  personality name; hover the trait line to see the behavior values. No AI reads the
  profile yet — it is the foundation for future dialogue, NPC events and combat behavior.
- Every NPC also has a level and a relation to the player (-100..100). Relation bands are
  hostile (≤ -31), unfriendly (-30..0), ambivalent (1..20), accepting (21..40), friendly
  (41..60) and a type-specific 61+ label such as Loving or Protective. New NPCs start
  neutral at level 1. `setRelation`/`adjustRelation` and `levelFor` are ready for future
  dialogue and progression; encounters use them today.

## Combat

- Each Temporary Spawn and Named NPC card has a **Fight** button. Save a main character
  first.
- The player always moves first. **Attack** deals Personal Combat damage plus the equipped
  weapon's damage; a surviving enemy immediately counterattacks.
- A weapon only works when the attacker's Strength meets its requirement. A too-heavy
  weapon adds no damage and no armor piercing, and the log says so.
- Armor reduces every hit. A weapon's armor piercing ignores part of it. **Defend** braces
  for the next attack and doubles the armor reduction; with no armor it blocks nothing.
- `combat:damage` lowers the real main/NPC HP; 0 HP ends the duel. A lethal player hit
  skips the enemy counterattack.
- The enemy always attacks in this version. There is no flee, initiative, hit chance or
  damage variance yet.
- Tuning lives in `combat/data.js`; the turn flow and events are documented in
  `combat/README.md` and `ENGINE_SPEC.md`.

## Equipment

- **Find armor** and **Find weapon** add random items from `equipment/data.js`. Equipment
  has five rarity ranks (Common, Uncommon, Rare, Legendary and Unique) and item types:
  weapons are swords, spears, axes or maces; armor is cloth, leather, mail, plate or scale.
  Higher ranks have better stat bands.
- Armor items target body parts (`head`, `torso`, arms, hands, legs, feet) and can cover
  more than one part. Several items can be worn at once when their parts do not overlap.
  Equipping an overlapping item replaces the conflicting items whole; total armor is the
  sum of all worn armor.
- Weapons fill one weapon slot. They add `damage` and `armorPiercing` (a percentage of the
  target's armor) and can only be equipped when the character's Strength meets the
  weapon's requirement. The panel shows the slot and warns when a weapon is too heavy.
- Armor is written into the main character's Armor stat and used by every incoming hit;
  Defend doubles the reduction. **Unequip all** clears the loadout, and **Destroy**
  permanently removes an item.
- Scavenging can also award equipment through an action outcome.
- The catalogue, type lists and rarity bands live in `equipment/data.js`. Only the main
  character can equip in this version; NPCs still have armor 0 and no weapon.
- `equipment:add` accepts `{ kind, rarity, weaponType, armorType }` filters and
  `equipment:remove` destroys an item, so future events and mobs can generate or destroy
  loot.
- See `equipment/README.md`.

## Locations module

- **Load static map** charts the authored world from `map/data.js`: every game gets the
  same sites and routes. See the static map below.
- Every location has `weather`, `biome`, `hostility` (integer 1-100; 50 is neutral, higher
  is more dangerous), `level`, and bidirectional `connections[]`. A connection stores the
  neighbour id and a distance in leagues (1-5). A biome's `levelRange` sets a generated
  location's level; hostility sets event and encounter risk.
- **Visit** sets the current location and rolls every enabled event for its biome plus a
  hostility-scaled encounter. It is only available for the current location or a direct
  route from it; reach other places by choosing Travel in the Actions panel.
- **JSON** downloads one location as a JSON file.
- **Connect Locations folder** writes `Locations/<map seed>/seed.json` and one
  `loc_XXXX.json` per location. Reconnecting imports unknown hand-edited `loc_*.json`
  files from the current seed folder. The game state remains the source of truth.
- Content tables (biomes, weather, names, hostility ranges, route tuning) live in
  `locations/data.js`. Generation order, graph repair and extra attributes live in
  `locations/locations.js`.

## Static map

- The world lives in `map/data.js`: twelve authored sites (the tavern, castle and shack plus
  nine wild sites) and thirteen authored routes. Every game loads the same map; there is no
  random location count.
- **Load static map** is idempotent. It charts the sites once, then installs the authored
  routes; pressing it again reports that the map is already loaded and creates nothing.
- `map` is a separate module. It never creates locations directly; it sends
  `location:add` for the fixed sites and `location:link` for each authored route, then
  emits `map:generated`.
- Landmarks use the synthetic `Landmark` biome, so visiting one does not roll biome events.
  They are linked into the travel graph like any other location.
- The tavern, castle and shack declare an interior preset. The first visit generates a
  room-and-corridor tile grid with the seeded RNG, stores it in the save and shows it under
  the Locations panel. Later visits reuse the same layout.
- Full content guide and terrain algorithm: `map/README.md`.

## Biome events

- Each biome has `locations/events/<biomeKey>/events.json`.
- Every enabled event rolls its own `chancePercent` (0-100) on a visit. Multiple events
  can trigger on the same visit.
- `hostilityModifier` (-1..1) shifts an event's chance as the location gets more dangerous:
  `baseChance × clamp(1 + modifier × ((hostility - 50) / 50), 0, 5)`. Positive makes a bad
  event likelier in dangerous places; negative makes a helpful event fade; 0 ignores
  hostility.
- `enabled: false` marks a copy/paste template; change it to `true` and edit the text.
- Several biome files include working examples: tundra **Snowfall**, forest **Wolf Pack**,
  grassland **Wild Berries**, hills **Old Cairn**, coast **Washed-Up Crate**, desert
  **Heat Haze** and swamp **Miasma**. Each uses `hostilityModifier` to swing with danger.
- Effects support any base stat (`hp`, `stamina`, `mana`, `war`, `diplomacy`,
  `personalCombat`, `moneyManagement`, `intrigue`, `intelligence`); unknown stats are
  kept in the event data for future modules.
- Use **Reload biome events** after editing a JSON file, or refresh the page. Event
  loading uses `fetch`, so serve the project over HTTP.
- Full schema and a copy/paste template: `locations/events/README.md`.

## Encounters

- Visiting a location also rolls an encounter. Higher hostility means a higher chance, more
  enemies, a lower relation and a higher enemy level; safe places rarely or never spawn a
  hostile NPC.
- Encounter enemies appear in Temporary Spawn like normal NPCs and are cleared when the
  next location is visited. Ordinary spawns are not cleared.
- Winning a fight against an encounter enemy rolls loot. Higher hostility raises the drop
  chance and the gear rarity (common up to unique). Loot is added through the normal
  equipment flow, so it appears in the Equipment panel.
- Losing, or fighting an ordinary NPC, awards no encounter loot.
- Tuning lives in `encounters/data.js`: spawn bands, enemy relation/level curve, drop chance
  and loot rarity bands.

## Area actions

- Visiting a location loads five actions in the **Actions** panel.
- The default actions are Scout, Scavenge, Rest, Hunt and Travel. Each has a time cost,
  stat costs and one weighted outcome; the last resolution is shown in the panel.
- Choosing an action emits `action:chosen` then `action:resolved`. The main-character
  module applies the effects, equipment can award an item, and the UI advances the clock
  by the action's `timeMinutes`.
- **Travel** shows a destination dropdown of direct routes only, with each route's biome,
  distance and journey time. A destination is required; choosing it costs stamina and
  starts a timed journey. The route distance sets the journey time
  (`distance * 15` minutes). Arrival visits the destination through the locations module,
  reloads its actions and rolls its biome events.
- Edit `actions/data.js` to change the default list, outcomes or add a biome-specific
  list under `biomes.<biomeKey>`.
- See `actions/README.md` for the full action shape and override example.

## Travel

- Travel follows a direct route from the current location. The panel shows the route, its
  distance in leagues and the countdown.
- A journey spends its route time in 5-minute checks. Route time is
  `distance * 15` minutes, supplied by the travel graph; the Travel action's own
  `timeMinutes` is only a fallback. The clock advances once per check; the panel shows
  elapsed time and how many checks have run.
- After each check the journey rolls for an interruption. The chance is 6-10% per check
  depending on the destination biome, with an 8% fallback in `travel/data.js`.
- An interruption pauses the journey and applies its stat effects. Read the event, then
  press **Continue travel** to resume the remaining checks.
- A journey can be abandoned with **Cancel journey**. Time, stamina and effects already
  spent are not refunded.
- On arrival, the locations module visits the destination and rolls its biome events as
  usual. The travel event catalogue is separate from biome events.
- Tune checks, chances, event text and effects in `travel/data.js`; tune route distance
  and the league-to-minute rate in `locations/data.js`. See `travel/README.md`.

## Content editor

`editor.html` is a form-based editor for the content files. It is a tool, not a game
module: it owns no state, emits no events and is not registered in `buildEngine`.

- Run `npm run serve`, then open <http://127.0.0.1:8765/editor.html>.
- It edits biome events, travel events and tuning, equipment items (armor, weapons, types,
  rarity tiers) and settings, area actions and outcomes, character names/traits/ages,
  relation bands/types and levels, locations (biomes, hostility bands, level ranges, travel
  graph) and encounters (spawn bands, enemy relation/level, loot rarity bands).
- **Open game folder** (Chrome/Edge) writes changes straight into the files. Without a
  folder, **Save changes** downloads each changed file; downloads flatten the path
  (`travel/data.js` becomes `travel-data.js`), so put the file back at its real path.
- The data files it writes are strict JSON inside their `window.X = { ... };` wrapper,
  with the header comment preserved. Unknown fields are kept, so fields the form does not
  show survive a save. Files using older JavaScript syntax can be opened, but saving them
  rewrites the object as strict JSON and warns that comments inside it are lost.
- Nothing is saved until it passes validation; the page lists errors and warnings.
- Read-only references (`characters/statsData.js`, `characters/bodyData.js`,
  `combat/data.js`) supply stat names, body parts and the armor multiplier. Armor items
  pick their body parts with a multi-select.
- The editor does not yet cover `map/data.js`, combat stats, or
  `CharacterData.behaviorAxes` / `CharacterData.personalities`. It also
  cannot add a new biome: `editor/schemas.js` hardcodes the same biome order as
  `locations/data.js`.
- Full usage, file formats and how to add a content type: `editor/README.md`.
