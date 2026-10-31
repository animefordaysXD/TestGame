# Save files (`save/gameSave.js`)

Save files are plain JSON. They hold the **world seed**, the **baseline engine options** and
the **changes** needed to rebuild the live world. The helper never edits `engine.js` and adds
no module or event. The page and the Node tests both pass a `buildEngine(opts)` factory so the
same format can rebuild a fresh world.

See `DESIGN.md` §3.11 for the product decision and `ENGINE_SPEC.md` for the engine contract.

## Two ways to save

| Action | Storage | Notes |
|---|---|---|
| **Quick save** / **Quick load** | `localStorage`, slot `save1` | The whole engine state as before. `status.html` reads this slot. |
| **Export save file** / **Import save file** | A `.json` file | The seed + baseline + changes format below. It can be copied, backed up or loaded into another browser. |

The two paths are independent. A quick save is not automatically a save file, and importing a
save file does not write the quick-save slot.

## Format v1

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
    { "op": "set", "path": ["modules", "locations", "locations"], "value": {} },
    { "op": "delete", "path": ["modules", "characters", "temp", "npc_0002"] }
  ]
}
```

- `seed` is the world seed. The same seed and baseline must rebuild the same fresh world.
- `baseline` is only the engine options that affect the fresh state: `startDate` and
  `tickMinutes`. The file's values win over the live engine's own settings.
- `changes` is a list of `{ op: "set", path, value }` or `{ op: "delete", path }`.
  Paths are arrays of object keys and array indexes. The first segment must be a top-level
  engine-state key (`version`, `seed`, `rngState`, `time`, `eventLog`, `modules`).
- `label` is a display name, normally the world clock at save time. `fileName()` turns it into
  `text-rpg-save-1000-01-03-06-00.json`.
- `savedAt` is the wall-clock time of the export, not game time.

### Diff rules

- Objects are compared key by key, so a module slice stays readable as small targeted changes.
- Arrays and scalars are replaced whole. A large `eventLog` therefore becomes one `set`, not
  one change per entry.
- Keys present only in the baseline become `delete` changes.
- The diff refuses non-JSON values and stops at 20,000 changes.
- There is no compression beyond normal JSON whitespace.

## API

`GameSave` is a global helper script (`<script src="save/gameSave.js"></script>`).

| Function | Purpose |
|---|---|
| `capture(engine, buildEngine)` | Serializes the live engine, builds a fresh baseline, returns a validated v1 save object. |
| `read(textOrObject, { buildEngine })` | Parses JSON (if needed), migrates, validates and returns a save object. |
| `migrate(save, options)` | Runs the migration table. A v1 file is validated directly. |
| `restore(input, engine, { buildEngine })` | Reads the save, rebuilds the baseline, applies changes and calls `engine.load()`. Returns the save object. |
| `changesBetween(baselineState, liveState)` | Builds the change list for two engine states. |
| `applyChanges(state, changes)` | Applies a validated change list to a state object. Used by `restore()` and tests. |
| `validate(save)` | Checks the format, baseline and every change; returns normalized data. |
| `stringify(save, pretty)` | Pretty-prints by default for a readable file. |
| `fileName(save)` | Safe download name based on `label`. |
| `MIGRATIONS` | Version -> migration function table. Currently `{ 0: legacyToV1 }`. |

`buildEngine(opts)` must return a **new** engine with every module registered and `opts`
applied (`seed`, `startDate`, `tickMinutes`). In `index.html` it is the single factory used for
the live page and for save/restore. **When you add a module, register it in `buildEngine()`** or
the baseline will not match the live world.

## Loading and migration

1. Parse JSON, then read `format`. A file with `format: "text-rpg-save"` goes through the
   version migration table.
2. A v1 file is validated. A newer `formatVersion` is refused with a clear error.
3. **Version 0** is the old localStorage/full-state export: a raw engine state with `time` and
   `modules`. On import the helper rebuilds the fresh world from that state's seed, start date
   and tick size, then diffs the fresh state against the legacy state to create v1 changes.
   This is why v0 needs `buildEngine`.
4. `restore()` rebuilds the world from the file's own seed/baseline, applies the changes and
   replaces the live state with `engine.load()`. The live engine's previous seed is ignored.

There is no v0 wrapper in normal use. A wrapper with `formatVersion: 0` and a `legacyState`
property is also accepted for hand-made migrations; without `legacyState` it is rejected.

## Safety

- Save files are untrusted input.
- `__proto__`, `prototype` and `constructor` are rejected as path segments, so a file cannot
  reach the prototype chain.
- Paths must start at a known top-level engine-state key. A change cannot add unrelated globals.
- Every `set` value is JSON round-tripped before use, so functions, `undefined` and malformed
  values never enter the state.
- Unknown ops, missing values and malformed baselines are refused.
- The helper does not run UI code or events. `restore()` ends with `engine.load()`; modules
  normalize their slices in `onLoad()` as usual.

## Limits

- Today's world is created by player actions, so a save is often close to the size of the full
  state. The size benefit comes when more content is derived from the seed (see `DESIGN.md`
  §3.6).
- The change list is a snapshot diff, not a replay log. It cannot merge two divergent saves.
- `eventLog` entries can contain `data: undefined` in memory; JSON drops that property. The
  restored state therefore matches the JSON form of the live state, which is what a save file
  represents.
- Folder connections (`mainChar/`, `Locations/`) are runtime handles and are not in a save.
- `status.html` still reads the quick-save slot. To inspect an exported file, use its **Load
  state JSON** button; the file's `changes` are not expanded into a state.
- Quick save depends on `localStorage`; some browser contexts block it. Save files avoid that
  by using a real download/upload.

## Tests

`test/save.test.cjs` covers capture, JSON round-trip, exact restore, read/validate idempotence,
v0 migration, newer-format refusal, invalid JSON, prototype-pollution paths, paths outside the
engine state and `applyChanges`.
