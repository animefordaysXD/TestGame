# Static map and landmark terrain

`map/map.js` v0.2 owns the authored world map and its procedural interiors. The world
itself never rolls random locations: every game loads the same sites and routes from
`map/data.js`. The room-and-corridor generator that used to shape world locations now
builds terrain inside landmarks on the first visit (and is ready to shape travel terrain
later).

## Flow

```text
map:load
  -> map.load() is idempotent
     location:add { count: 0, fixed: authored sites, batch }
        -> locations charts each fixed site (autoLink: false)
           -> location:added { id, key, kind?, batch }
              -> map records key -> id and kind -> id
     -> after the last site: location:link { fromId, toId, distance } per authored route
     -> map:generated { total, sites, landmarks, routes }

location:visited (a landmark)
  -> map generates its interior once, stores it in map.terrain[id]
  -> map:terrainGenerated { locationId, locationName, interior, label, width, height, rooms }
```

Pressing **Load static map** again reports `alreadyLoaded: true` and changes nothing.
`map:generate` is kept as a legacy alias for `map:load`.

## State

```js
map: {
  version: 2,
  loaded: false,
  seed: 0,
  total: 12,                    // authored sites
  lastGeneratedTick: null,
  lastGeneratedAt: "",
  sites: {                      // content key -> location id
    broken_wheel: "loc_0001",
    greywatch_castle: "loc_0002"
  },
  landmarks: {                  // landmark kind -> location id
    tavern: "loc_0001",
    castle: "loc_0002",
    shack: "loc_0003"
  },
  terrain: {                    // location id -> generated interior
    loc_0001: {
      locationId: "loc_0001",
      interior: "tavern",
      label: "Tavern interior",
      width: 21,
      height: 11,
      rooms: 6,
      entrance: { x: 8, y: 5 },
      tiles: ["########...", "..."],
      counts: { "#": 150, ".": 80, "<": 1 },
      generatedAtTick: 0,
      generatedAt: "1000-01-01 06:00"
    }
  }
}
```

Interiors are generated with `engine.rng`, stored in the save, and reused. A given world
seed plus the same first visit produces the same layout.

## Content

Edit `map/data.js`:

- `world.name` — display name.
- `world.start` — the site key where a newly created character begins (currently
  `greywatch_village`). If the key is missing, the module falls back to the first site.
- `world.locations` — static sites. Each has `key`, `name`, `biome`, `biomeKey`,
  `weather`, `hostility`, `level`, optional `kind` (landmark id) and optional `interior`
  preset. Wild sites leave `kind` and `interior` empty.
- `world.routes` — authored two-way edges: `{ id, from, to, distance }` using site keys.
- `terrain.tiles` — one-character symbols for wall, floor, entrance, rubble and water.
- `terrain.legend` — labels shown under the rendered map.
- `terrain.interiors` — procedural presets: `key`, `label`, `width`, `height`,
  `roomAttempts`, `roomWidth`/`roomHeight` ranges, `rubbleChance` and `waterChance`.

`map/data.js` is strict JSON inside its `window.MapData = ...;` wrapper, so `editor.html`
can read and write it. The editor covers world settings, static sites, authored routes,
interior presets and terrain tiles.

## Terrain algorithm

1. Fill the grid with wall tiles.
2. Try `roomAttempts` random room placements, rejecting overlaps with a one-tile margin.
3. Carve a connected L-shaped corridor between each pair of rooms in placement order.
4. Mark the first room's centre as the entrance.
5. Scatter rubble and water over room floors using the preset chances.
6. Store the final tile rows, counts, room count and entrance.

The grid is display-only today. A future travel or interior movement system can read
`map.terrainFor(id).tiles` and the entrance coordinate, or call the same generator with
another preset.

## Accessors

- `terrainFor(locationId)` — generated interior or `null`.
- `ensureTerrain(locationId)` — generate on demand; safe to call repeatedly.
- `siteForLocation(locationId)` — authored site merged with its location id.
- `siteFor(key)` — authored site by content key, or `null`.
- `startKey()` — the configured starting site key (with a first-site fallback).
- `startSite()` — the starting site merged with its location id, or `null` before load.
- `status()` — copy of the slice for the UI/status page.
