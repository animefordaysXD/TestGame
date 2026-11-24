# Game

`game/game.js` v0.1 is the journal layer for the player-facing `index.html`. It records
which sites have been visited, actions taken, fights won/lost, and which authored objectives
are complete. The old all-panels sandbox is `debug.html`.

## Data

`game/data.js` owns:

- `title`, `tagline`, `opening` and `completeText`;
- `siteText` (one atmospheric blurb per authored site key);
- `objectives`: `visit`, `action` or `victory`; optional `site`, `siteKind` and `after`;
  labels/hints support `{start}`, `{tavern}` and `{site}` tokens.

## Flow

```text
creator:created / mainCharacter:saved -> started
location:visited -> record site + visit order -> evaluate journal
action:resolved  -> action count -> evaluate
combat:ended     -> victory/defeat count -> evaluate

objective complete -> game:progress { event, objective, objectives, done, total, ... }
```

`after` gates an objective behind an earlier one. A visit, action or victory that happened
before its prerequisite does not count, so visiting the tavern before the fight does not
count as returning after it.

## Accessors

- `objectives()` — filled labels/hints and done flags.
- `currentObjective()` — the next open objective or `null`.
- `progress()` — objective list, counts, visited sites, victories/defeats.
- `status()` — copy of the slice for the status page.

## Adjust it

- Journal text/objectives: `game/data.js`.
- Event rules and evaluation: `game/game.js`.
- Game layout and combat/travel UI: `index.html`.
- Raw debugging: `debug.html`.
