# Ideas

**Last updated:** 2026-10-27

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
- **Built so far:** engine, stats, NPC tiers, equipment/armor, five area actions, timed travel,
  combat v0.1, locations, biome events, save files.

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

- [Built] Procedural NPCs that disappear when the location changes unless notable, important or saved by the player; three tiers: ephemeral, notable, saved — Jo, 2026-10-25
- [Decided] NPCs have different dialogue depending on their personality — Jo, 2026-10-25
- [Decided] NPCs can affect the player according to their personality — Jo, 2026-10-25
- [Decided] A separate NPC event checker, e.g. a cunning commoner trying to steal from you as a random event — Jo, 2026-10-25
- [Idea] Dialogue as data: lines tagged by intent and trait, chosen by how many traits match — PM, 2026-10-25
- [Idea] Resolve NPC events with skill checks (e.g. Intrigue vs Intrigue); hostility scales the odds — PM, 2026-10-25
- [Idea] Resolve encounters without combat (Diplomacy, Intrigue) so the stat spread matters — PM, 2026-10-25
- [Idea] Enemy AI that picks attack, defend or flee based on traits — PM, 2026-10-25

## World and map

- [Decided] Fixed map with changing details per save, e.g. an elven-held church in one game and a dwarven forge in the same city in another — Jo, 2026-10-25
- [Decided] The map is AI-generated — Jo, 2026-10-25
- [Decided] The map is dynamically coloured, like CK3 — Jo, 2026-10-25
- [Idea] Map is hierarchical: realm, region, city, slot, people; top rolled at start, bottom rolled when first visited — PM, 2026-10-25
- [Idea] "Anchor" slots that are always the same in every save — PM, 2026-10-25
- [Idea] Store a city's rolled details the first time it is seen so table edits never rewrite old saves — PM, 2026-10-25
- [Idea] Content derived from the seed uses a keyed RNG, never the shared stream — PM, 2026-10-25
- [Idea] Simulation levels of detail: named characters are real, commoners are statistics, distant realms tick coarsely — PM, 2026-10-25
- [Idea] Several map modes (political, culture, religion, terrain) — PM, 2026-10-25
- [Open] Provinces as regions, or a node graph with roads? — PM, 2026-10-25

## A changing world

- [Decided] Eventually diplomacy, so the map changes dynamically — Jo, 2026-10-25
- [Decided] Cities can be razed, ruined or sacked — Jo, 2026-10-25
- [Decided] New cities can be built, but resource-heavy to prevent spam — Jo, 2026-10-25
- [Idea] Founding needs a cost in a data file, a minimum distance from other settlements, and a claim or legitimacy — PM, 2026-10-25

## Saves and technology

- [Built] Save as a JSON file with the seed and the changes, and load from it — Jo, 2026-10-25
- [Idea] IndexedDB autosave plus the file as export and backup — PM, 2026-10-25
- [Idea] Keep `engine.js` frozen; everything so far fits in modules — PM, 2026-10-25

## Gameplay loop (PM suggestions awaiting a decision)

- [Idea] Make hostility the spine: it scales event chance, encounter chance and rest safety — PM, 2026-10-25
- [Idea] Give every action a time cost, a stamina cost and one real outcome — PM, 2026-10-25
- [Built] Five area actions with time costs, stat costs and weighted outcomes — build, 2026-10-27
- [Built] Timed travel: a journey runs in 5-minute checks, pauses on an interruption and resumes on Continue — build, 2026-10-27
- [Idea] Travel graph so Travel becomes a real choice — PM, 2026-10-25
- [Idea] Write events for all 10 biomes (only tundra has one) — PM, 2026-10-25
- [Idea] Equipment, so armor and Defend matter — PM, 2026-10-25
- [Built] Body armor with an inventory, equip/unequip and an armor stat that feeds Defend — build, 2026-10-27
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

- 2026-10-27: Design docs brought into the repository; Summary refreshed to list equipment, area actions and timed travel as built.
- 2026-10-25: File created. Filled with everything from the first design conversation, the NPC tier split and the save-file decision.
