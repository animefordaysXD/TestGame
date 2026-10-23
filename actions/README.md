# Actions

Five placeholder actions load when a location is visited. The action panel is driven by
the `actions` module and the content in `actions/data.js`.

- `default` — the five actions used by every biome unless an override exists.
- `biomes.<biomeKey>` — optional list of five actions for one biome.
- Each action is `{ id, name, description }`.
- Choosing an action emits `action:chosen` and logs a placeholder line. No stat,
  item, time or location effects are applied yet.

To add a biome override, copy the commented `tundra` example in `actions/data.js` and
use the biome key from `locations/data.js` (`forest`, `tundra`, `desert`, ...). Keep at
least five entries; a shorter override is ignored and the default list is used.

The current UI shows the loaded actions under **Actions** and refreshes them on each
visit. Use the **Choose** button to log a placeholder choice.
