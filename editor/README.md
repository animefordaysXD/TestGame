# Content editor

`editor.html` is a form-based editor for the game's content: biome events, travel events and
tuning, equipment items (armor, weapons, types, rarity tiers), area actions, and NPC names and
traits. It replaces hand-editing data files and asking an AI to write each entry. It is a tool,
not a game module: it owns no state and the game does not load it.

## Using it

1. Run `npm run serve` and open <http://127.0.0.1:8765/editor.html>, or open the file from
   the server you already use for the game.
2. Click **Open game folder** and pick this project's folder (the one with `engine.js`; Chrome or Edge). From then on
   **Save changes** (or Ctrl+S) writes straight into the files. You commit with git as usual.
3. Without a folder (other browsers, or you skipped step 2) you can still edit; saving
   downloads each changed file. Downloads cannot keep folders, so the file name includes the
   path (`travel-data.js`, `locations-events-tundra-events.json`); put it back at the matching
   path in the game folder.

On the left pick what to edit. Biome events, travel events, armor and actions show a list:
**Add**, **Duplicate**, **Delete**, **Up** and **Down** work on the selected entry. Each entry
has a form and, below it, two panels:

- **In the game** shows the text as the player sees it, the stat effects, and the odds. For
  example a travel event shows how often it is picked and how likely a 60 minute journey is to
  be interrupted, and armor shows which body parts it covers and how much damage Defend blocks.
- **Checks** lists problems next to the entry: duplicate ids, a chance outside 0 to 100, an
  unknown stat, an item that does not exist, and so on. **Errors block saving** that file.
  Warnings do not.

An unsaved file shows a dot in the left list. Reverting an edit by hand clears it. **Reload
from disk** throws away unsaved changes.

## What it never loses

- The header comment at the top of each data file is kept word for word.
- Saving a file you did not change reproduces it byte for byte, so git shows only what you
  edited.
- Line endings (LF or CRLF) are preserved.
- Fields the editor does not know about stay in the file untouched.

## Rule for content files

Inside `window.X = { ... };` write **strict JSON**: quoted keys, no comments, no trailing
commas. Put notes in the header comment. `npm test` checks this (`test/editor.test.cjs`), so
a hand edit that breaks it is caught. A file that is valid JavaScript but not strict JSON still
opens, flagged "uses JavaScript syntax"; saving it rewrites it as JSON and drops any comments
inside the object, after asking you.

## Files

| file | role |
|---|---|
| `editor.html` | the page: navigation, list, forms, previews, save |
| `editor/core.js` | reads and writes the data files, the compact JSON formatter, small helpers |
| `editor/schemas.js` | which files exist, the sections and their fields, the checks, the previews |
| `test/editor.test.cjs` | formatter, round trips, every check, previews, and that shipped content is valid |

`core.js` and `schemas.js` have no DOM and run in Node. The page is plain JavaScript with no
build step.

## Adding a content type

1. Put the data in a file in strict JSON form (`window.X = {...};` or a `.json` file).
2. In `editor/schemas.js`, add it to `FILES`.
3. Add a section to `SECTIONS`: `kind: "list"` for a list of entries, `kind: "form"` for one
   form. Describe each field with a type (`text`, `textarea`, `number`, `bool`, `select`,
   `multiselect`, `effects`, `list`, `lines`, `pairs`, `map`, `range`). Add `label`, `sub`,
   `newItem` and optionally `preview` for lists.
4. Add a check to `VALIDATORS` and a case to `test/editor.test.cjs`.

The page itself does not change. Biome files are listed from `BIOMES` in `schemas.js`; add a
biome there when `locations/data.js` gains one.

## Not included yet

- No undo; use **Reload from disk** to revert a file.
- No editing of `statsData.js`, `combat/data.js`, `locations/data.js` or
  `characters/bodyData.js`; they are used as read-only references (stat names, body parts,
  biome list, the armor multiplier). Armor items pick their `parts` from the body data, but
  the ten-part layout itself has no editor form; add a new content type in `schemas.js` if it
  should become editable.
- No editing of `CharacterData.behaviorAxes` or `CharacterData.personalities`. They are kept
  untouched when the character file is saved; add form fields in `schemas.js` to edit them.
- No editor for per-biome action overrides to be created (existing ones appear and are
  editable), the map, or dialogue. These need their own content types first.
- The folder picker needs Chrome or Edge. It was tested in Node with a mock folder, not in a
  real browser.
