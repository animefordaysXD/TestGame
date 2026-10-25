# Actions

Five area actions load when a location is visited. The action panel is driven by the
`actions` module and the content in `actions/data.js`. Choosing an action now resolves
costs, an outcome, time and (for Travel) a destination.

- `default` — the five actions used by every biome unless an override exists.
- `biomes.<biomeKey>` — optional list of five actions for one biome.
- An action is:

```js
{
  id: "scout",
  name: "Scout",
  description: "Survey the area for landmarks and danger.",
  timeMinutes: 30,
  costs: [{ stat: "stamina", delta: -5 }],
  outcomes: [
    { id: "scout_ok", name: "Useful landmarks", weight: 2, text: "...", effects: [] }
  ],
  requiresDestination: false,   // true for Travel
  travelText: ""               // shown for a travel action
}
```

## Resolution

1. The UI fires `action:choose` with `{ actionId, destinationId? }`.
2. `actions` emits `action:chosen`, then picks one outcome with `engine.rng` (weighted by
   `weight`; default 1) and emits `action:resolved` at `depth + 1`.
3. `action:resolved` carries `{ actionId, name, outcomeId, outcomeName, text, effects,
   timeMinutes, equipmentKey, travelTo, locationId, locationName }`.
4. The `mainCharacter` module applies the combined `effects` (costs plus outcome) and
   emits `mainCharacter:statChanged`. The `equipment` module adds an item when
   `equipmentKey` names an entry in `equipment/data.js`.
5. The UI advances the clock by `timeMinutes` (whole ticks) and, for `travelTo`, visits
   that location through the locations module. That fires `location:visited`, which
   reloads the destination's five actions and rolls its biome events.

The slice keeps the last resolution in `lastAction` so the status page and save/load can
show it; visiting a new area clears it.

## Travel

Travel has `requiresDestination: true` and no outcomes. The UI shows a destination
dropdown of every other known location and sends its id as `destinationId`. A missing
destination emits `action:blocked` and resolves nothing. Movement itself is done by the
locations module (`locations.visit`), not by editing the locations slice here.

## Biome overrides

To add a biome override, copy the commented `tundra` example in `actions/data.js` and use
the biome key from `locations/data.js` (`forest`, `tundra`, `desert`, ...). Keep exactly
five entries; a shorter override is ignored and the default list is used.

## Adding outcomes

Keep stat keys in sync with `characters/statsData.js`. Resources clamp at their max and
skills clamp to 1-20 when the main character applies them. An outcome can award armor by
using an equipment key such as `scavenged_leather`; the first free item is auto-equipped.

Combat is a separate module. Choosing an area action never starts a fight; fights start
from an NPC card's **Fight** button. See `combat/README.md`.
