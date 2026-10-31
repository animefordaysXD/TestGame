# Travel module v0.2

A journey is the time between choosing **Travel** and arriving at the destination. The
caller supplies the route distance and duration (normally from the locations travel
graph); the module rounds the duration up to whole 5-minute checks. After every check it
rolls once for an interruption from `data.js`. An interruption pauses the journey and
waits for the player to press **Continue travel**.

The module does **not** move the party or advance the core clock. The UI owns both:

1. `travel:start` stores the route (distance and duration).
2. `driveTravel()` switches to 5-minute ticks and, for each check, steps the clock
   once, then fires `travel:advance`.
3. A quiet check emits `travel:progress`; an interruption emits `travel:event` and
   sets `paused`. The UI restores the player's tick size and waits.
4. **Continue travel** fires `travel:continue`, then the UI drives the remaining
   checks.
5. On `travel:completed`, the UI restores the tick size and calls
   `locations.visit(destinationId)`, so locations remains the only mover.

## Files

| File | Contents |
|---|---|
| `data.js` | `minutesPerCheck`, `chancePercent`, `chanceByBiome`, event catalogue |
| `travel.js` | journey state, checks, weighted event pick, pause/resume/cancel |

## State

`engine.state.modules.travel`:

```js
{
  active: false,
  paused: false,
  originId, originName,
  destinationId, destinationName, destinationBiomeKey,
  distance: 0,
  elapsedMinutes: 0,
  durationMinutes: 0,
  minutesPerCheck: 5,
  checks: 0,
  eventCount: 0,
  pausedAtMinutes: null,
  lastEvent: null,
  lastCompleted: null
}
```

`distance` is the route distance in leagues; it is echoed for the panel/status and does
not change the event chance. `durationMinutes` is rounded up to a whole number of checks,
so 27 minutes becomes 30. `lastEvent` is the interruption that caused the current pause;
`lastCompleted` is the most recent arrival summary (including `distance`).

## Events

Requests (UI -> module):

- `travel:start` - `{ destinationId, destinationName, durationMinutes, distance?,
  originId?, originName?, destinationBiomeKey? }`
- `travel:advance` - `{ minutes? }`; the UI sends one check at a time.
- `travel:continue` - clears a pause.
- `travel:cancel` - abandons the journey; spent time is not refunded.

Module events (all at `depth + 1`):

- `travel:started`, `travel:progress`, `travel:event`, `travel:resumed`,
  `travel:completed`, `travel:cancelled`.

`travel:started` and `travel:completed` echo the route `distance`. `travel:event` carries
`effects`. `mainCharacter` applies them and emits `mainCharacter:statChanged`. Travel
events are separate from biome events; biome events still roll once when
`locations.visit()` runs on arrival.

## Tuning

| Goal | Change |
|---|---|
| Check length | `minutesPerCheck` (keep 5; the UI loop assumes it) |
| Interruption frequency | `chancePercent`, or `chanceByBiome.<key>` |
| Event mix | `events[].weight` |
| Event text/effects | `events[].text` / `events[].effects` |
| Disable an event | `events[].enabled: false` |
| Journey length | Route `distance` in `locations/data.js` `travelGraph`; the caller passes `durationMinutes` |
| Route distance-to-minutes rate | `locations/data.js` `travelGraph.minutesPerDistance` |

Chances are per check, not per journey. The shipped biomes use 6-10% per check, with an
8% fallback; a 30-minute journey has six checks.

## Gotchas

- A positive event pauses as well; every event is a scene.
- `distance` is informational; per-check chance comes from the destination biome. A longer
  route simply has more checks and therefore more total risk.
- An event on the final check pauses first. After Continue, the next advance completes
  without adding time; the UI also skips its clock step in that case.
- The UI restores the previous tick size after a pause or completion.
- Only one journey can be active. Starting another is ignored.
- A paused journey survives save/load; the player resumes with **Continue travel**.
- Travel events cannot start combat yet. Add a request/event handoff if that changes.
- Use `engine.rng`; never `Math.random`.

## Test

`node test/travel.test.cjs` (also part of `npm test`). The test controls
`TravelData.chancePercent` to make checks deterministic and covers pause/resume,
effects, distance persistence, cancel, reset, duration rounding and save/load.
