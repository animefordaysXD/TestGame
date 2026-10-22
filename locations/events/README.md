# Biome events

Each biome has its own event list:

```
locations/events/
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
```

When you press **Visit** on a location, every **enabled** event in that biome's
`events.json` rolls its own chance. More than one event can trigger on the same visit.

## Event fields

| field | meaning |
|---|---|
| `id` | Unique id inside this biome. |
| `name` | Short name shown in the visit summary. |
| `enabled` | `false` keeps a template in the file without rolling it. |
| `chancePercent` | Chance per visit, `0`-`100` (`10` means 10%). |
| `chance` | Alternative `0`-`1` chance (`0.1` also means 10%). `chancePercent` wins if both are present. |
| `text` | Event-log text. |
| `effects` | Array of `{ "stat": "...", "delta": ... }`. |

The current effect pipeline supports `stamina` on the main character: negative values
reduce it, positive values restore it, and it is clamped between `0` and `staminaMax`.
Unknown stats are kept in the event data but ignored for now.

## Copy/paste template

Copy this object into a biome's `events` array, give it a unique `id`, set
`enabled` to `true`, and replace the text/effects:

```json
{
  "id": "biome_unique_event_id",
  "name": "Event name",
  "enabled": true,
  "chancePercent": 10,
  "text": "Describe what happens when this event triggers.",
  "effects": [
    { "stat": "stamina", "delta": -10 }
  ]
}
```

The tundra file includes a working 10% **Snowfall** example that costs 10 stamina.

## Editing

- Keep `id` unique within the biome.
- Set `enabled` to `false` for unused placeholders.
- Use **Reload biome events** on the page after editing, or refresh the page.
- The JSON is fetched by the browser, so serve the project over HTTP
  (`npm run serve`) rather than opening `index.html` from `file://`.

There are no cooldowns, once-only flags, weather filters or requirements yet. Each
enabled event is an independent roll on every visit.
