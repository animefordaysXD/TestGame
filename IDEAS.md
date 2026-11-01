# Ideas

**Last updated:** 2026-10-31

A running list of Jo's ideas, kept short so both Jo and an AI session can read it in a minute.
The **Summary** is the part to read first. Decisions graduate to `DESIGN.md`.

## How this file works

- **AI sessions:** whenever Jo shares an idea, preference or decision, add it here **in the same
  turn**, then refresh the Summary (rewrite it, do not just append). Keep Jo's wording where you
  can. Mark your own suggestions as **PM** so they are never mistaken for decisions.
- **Jo:** edit freely. Change a status, delete a line, or add your own.
- **Statuses:** `Idea` (raw) · `Leaning` (likely, not final) · `Decided` (also in `DESIGN.md`) ·
  `Built` (in the code) · `Parked` (later, on purpose) · `Dropped`.
- Format: `- [Status] idea — source, date`. Ideas never get deleted silently; move them to
  **Dropped** with a reason.

## Summary

A **turn-based, text-first, open-world sandbox** in the spirit of Crusader Kings with Game of
Thrones politics and fantasy. One very large medieval world (at least medieval Europe) with
magic, beasts and several peoples. The player is dropped in with full freedom, as a rogue or
mercenary, a beast tamer or elven scout, or a highborn noble with court games, and has a family.

- **Roles** are only starting backgrounds that give an advantage. A handful at first.
- **The map** is fixed but its details change per save (who holds the church, who runs the forge).
  It is AI-generated, coloured politically like CK3, and changes over time: sacking, razing,
  founding costly new cities, later diplomacy.
- **NPCs** are procedural, in three tiers (ephemeral / notable / saved), with personality-driven
  dialogue and their own event checker (a cunning commoner may try to rob you).
- **Saves** are JSON files holding the seed plus the changes.
- **Open:** inheritance, death rules, how magic works.
- **Built so far:** engine, stats (including Strength), ten-part humanoid bodies for every
  character (status-only), NPCs with 30 personality archetypes (traits plus 0-100 behavior
  profiles, data-only) and `temp`/`named` buckets (three-tier model planned), equipment with
  body-part armor, a weapon slot (swords/spears/axes/maces), weapon and armor types, and five
  rarity tiers, five area actions, timed travel, a travel graph with route distances, combat
  v0.2 (weapon damage, Strength gating and armor piercing), locations, a placeholder map
  spawner with fixed tavern/castle/shack landmarks, biome events, save files, and a
  form-based content editor (`editor.html`; tooling, not a module).

## Vision and scope

- [Decided] Open-world, sandbox, Crusader Kings-like with Game of Thrones elements — Jo, 2026-10-25
- [Decided] Play as a commoner or a ruler; a free-roaming rogue/mercenary or a highborn noble with political and court games — Jo, 2026-10-25
- [Decided] Fantasy elements; medieval tech level with magic — Jo, 2026-10-25
- [Decided] World at least as big as medieval Europe — Jo, 2026-10-25
- [Decided] The character is dropped into a massive world with full freedom — Jo, 2026-10-25
- [Decided] Turn-based, definitely — Jo, 2026-10-25

## Roles and backgrounds

- [Decided] Roles are nothing more than a background; being a beast tamer does not force taming, it gives an advantage — Jo, 2026-10-25
- [Decided] Starting backgrounds limited to a few, each with different starting bonuses — Jo, 2026-10-25
- [Idea] Beast tamer — Jo, 2026-10-25
- [Idea] Elven archer scout — Jo, 2026-10-25
- [Idea] Free-roaming rogue / mercenary — Jo, 2026-10-25
- [Idea] Highborn nobility with political and court games — Jo, 2026-10-25
- [Idea] Tamed beasts as companions, a companion is a character with stats — PM, 2026-10-25

## Characters and family

- [Decided] Merge the player and NPCs into one character type — Jo, 2026-10-25 (Planned, not built)
- [Decided] Children and a family system will be added — Jo, 2026-10-25
- [Idea] An inheritance system — Jo is not sure yet — 2026-10-25
- [Idea] What happens on the player's death (until inheritance is decided: death ends the run) — PM, 2026-10-25

## NPCs and personality

- [Decided] Procedural NPCs that disappear when the location changes unless notable, important or saved by the player; three tiers: ephemeral, notable, saved — Jo, 2026-10-25 (planned; current code approximates with `temp`/`named`)
- [Decided] NPCs have different dialogue depending on their personality — Jo, 2026-10-25
- [Decided] NPCs can affect the player according to their personality — Jo, 2026-10-25
- [Decided] A separate NPC event checker, e.g. a cunning commoner trying to steal from you as a random event — Jo, 2026-10-25
- [Built] 30 named NPC personality archetypes; each carries five traits and an eight-axis behavior profile (aggression, caution, sociability, honesty, generosity, loyalty, curiosity, ambition; 0-100). Generation, saves and the UI store/migrate/display it; no AI reads it yet — build, 2026-10-29
- [Idea] Dialogue as data: lines tagged by intent and trait, chosen by how many traits match — PM, 2026-10-25
- [Idea] Resolve NPC events with skill checks (e.g. Intrigue vs Intrigue); hostility scales the odds — PM, 2026-10-25
- [Idea] Resolve encounters without combat (Diplomacy, Intrigue) so the stat spread matters — PM, 2026-10-25
- [Idea] Enemy AI that picks attack, defend or flee based on traits — PM, 2026-10-25

## World and map

- [Built] Placeholder procedural map spawner: a configurable batch of random locations plus a fixed tavern, castle and shack on every map; landmarks are ordinary linked locations with no interiors yet — build, 2026-10-29
- [Decided] Fixed map with changing details per save, e.g. an elven-held church in one game and a dwarven forge in the same city in another — Jo, 2026-10-25
- [Decided] The map is AI-generated — Jo, 2026-10-25
- [Decided] The map is dynamically coloured, like CK3 — Jo, 2026-10-25
- [Idea] Map is hierarchical: realm, region, city, slot, people; top rolled at start, bottom rolled when first visited — PM, 2026-10-25
- [Idea] "Anchor" slots that are always the same in every save — PM, 2026-10-25
- [Idea] Store a city's rolled details the first time it is seen so table edits never rewrite old saves — PM, 2026-10-25
- [Idea] Content derived from the seed uses a keyed RNG, never the shared stream — PM, 2026-10-25
- [Idea] Simulation levels of detail: named characters are real, commoners are statistics, distant realms tick coarsely — PM, 2026-10-25
- [Idea] Several map modes (political, culture, religion, terrain) — PM, 2026-10-25
- [Open] Drawn map: provinces as regions, or show the route graph with roads? — PM, 2026-10-25

## A changing world

- [Decided] Eventually diplomacy, so the map changes dynamically — Jo, 2026-10-25
- [Decided] Cities can be razed, ruined or sacked — Jo, 2026-10-25
- [Decided] New cities can be built, but resource-heavy to prevent spam — Jo, 2026-10-25
- [Idea] Founding needs a cost in a data file, a minimum distance from other settlements, and a claim or legitimacy — PM, 2026-10-25

## Saves and technology

- [Built] Save as a JSON file with the seed and the changes, and load from it — Jo, 2026-10-25 (v1 seed + baseline + changes; export/import; legacy migration)
- [Built] A form-based content editor for biome events, travel, body-part armor, weapons, rarity tiers, actions and character names/traits/ages — build, 2026-10-31 (`editor.html`; strict-JSON round-trip, validation, folder saves or downloads; tooling, not a module)
- [Idea] IndexedDB autosave plus the file as export and backup — PM, 2026-10-25
- [Idea] Keep `engine.js` frozen; everything so far fits in modules — PM, 2026-10-25

## Gameplay loop (PM suggestions awaiting a decision)

- [Idea] Make hostility the spine: it scales event chance, encounter chance and rest safety — PM, 2026-10-25
- [Idea] Give every action a time cost, a stamina cost and one real outcome — PM, 2026-10-25
- [Built] Five area actions with time costs, stat costs and weighted outcomes — build, 2026-10-27
- [Built] Timed travel: a journey runs in 5-minute checks, pauses on an interruption and resumes on Continue — build, 2026-10-27
- [Built] Travel graph so Travel becomes a real choice — locations own bidirectional routes with distances; Travel offers only direct routes and route distance sets journey time — build, 2026-10-27
- [Idea] Multi-hop route planning: pick a far destination and let the UI chain direct routes, showing each leg — PM, 2026-10-27
- [Idea] Write events for all 10 biomes (only tundra has one) — PM, 2026-10-25
- [Idea] Equipment, so armor and Defend matter — PM, 2026-10-25
- [Built] Body armor with an inventory, equip/unequip and an armor stat that feeds Defend — build, 2026-10-27
- [Built] Body-part armor targeting: items cover one or more of the ten body parts, several pieces can be worn at once, overlapping items replace each other and total armor is summed — build, 2026-10-31
- [Built] Weapons (swords, spears, axes, maces) in one weapon slot with base damage, a Strength requirement and armor piercing; five rarity tiers (Common, Uncommon, Rare, Legendary, Unique) with strict stat bands; rarity/kind filtered finds and item destruction — build, 2026-10-31
- [Built] Weapon types (sword, spear, axe, mace) and armor types (cloth, leather, mail, plate, scale), data-driven and shown in the game, status page and editor; type-filtered finds and a five-rarity axe family — build, 2026-11-01
- [Idea] Use the filtered `equipment:add` / `equipment:remove` hooks from events, loot tables and mobs so a given rarity can be generated or destroyed without the editor — PM, 2026-10-31
- [Idea] A shared skill-check rule: roll plus skill against a difficulty — PM, 2026-10-25
- [Idea] A slow survival clock (hunger, exposure) so Rest, Hunt and Scavenge are needs — PM, 2026-10-25

## Open questions

- How does magic work?
- Inheritance, and what happens when the player dies?
- Which 4–5 starting backgrounds?

## Parked

- Nothing parked yet.

## Dropped

- Nothing dropped yet.

## Log

- 2026-11-01: Equipment v0.4 built: every item now has a data-driven weapon or armor type. Weapons use sword/spear/axe/mace, armor uses cloth/leather/mail/plate/scale, and a five-rarity axe family fills out the new family. `equipment:add` filters by type, event payloads carry the type, old saves fall back to the catalogue, and the game, status page and editor show and validate it. Summary refreshed.
- 2026-10-31: Equipment v0.3 built: swords, spears and maces fill one weapon slot with base damage, a Strength requirement and armor piercing. Five rarity tiers (Common, Uncommon, Rare, Legendary, Unique) define strict stat bands, and `equipment:add` accepts kind/rarity filters while `equipment:remove` destroys items. Combat v0.2 adds weapon damage, Strength gating and armor piercing; armor now reduces every hit and Defend doubles it. The game UI and editor were updated. Summary refreshed.
- 2026-10-31: Equipment v0.2 built: armor items target the ten body parts, multi-part items are supported, several worn items sum their armor, and overlapping items replace each other whole. `equippedByPart` replaces `equippedId` with save migration; the editor uses a body-part multi-select. Summary refreshed.
- 2026-10-31: Character bodies built for NPCs and the main character. Ten parts (head, torso, left/right legs, arms, hands, feet) share one data layout and normaliser; each part stores a status starting at `"intact"`. No injury, healing or combat rule reads the status yet; equipment targets the part keys. Summary refreshed.
- 2026-10-31: Content editor added: `editor.html` edits biome events, travel, armor, actions and character names/traits/ages, validates before saving, and writes strict JSON with headers preserved. It is tooling, not a module. Fixed null help text and duplicate outcome ids during testing. Summary refreshed.
- 2026-10-29: Placeholder procedural map spawner built: `map` requests one `location:add` batch with fixed tavern/castle/shack landmarks and a configurable random count, then reports `map:generated`. Locations gained fixed `kind` support. Summary refreshed.
- 2026-10-29: NPC personality expanded to 30 named archetypes with five traits and an eight-axis 0-100 behavior profile. NPCs store `personality`, `traits` and `behavior`; legacy saves migrate deterministically. Behavior is data-only for now; future dialogue/events/combat AI should read it. Summary refreshed.
- 2026-10-29: Save files built: v1 stores the seed, baseline options and changes; the page exports/imports JSON and migrates legacy full-state saves; unsafe paths are rejected. The NPC-tier line was corrected to "planned" because the code only has `temp`/`named`. Summary refreshed.
- 2026-10-27: Travel graph built: locations own bidirectional routes with distances, Travel offers only direct routes, and route distance sets journey time. Summary refreshed; multi-hop route planning added as a PM idea.
- 2026-10-27: Design docs brought into the repository; Summary refreshed to list equipment, area actions and timed travel as built.
- 2026-10-25: File created. Filled with everything from the first design conversation, the NPC tier split and the save-file decision.
