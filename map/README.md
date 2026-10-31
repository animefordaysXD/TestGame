# Map spawner

`map/map.js` v0.1 is a small module that owns map-level generation metadata. It does not
create locations itself; it asks the locations module through `location:add`.

## Flow

```text
map:generate { count? }
  -> map.generate() clamps the count, stores metadata and fires one request:
     location:add { count, fixed: MapData.landmarks, batch }
     -> locations charts each fixed landmark, then `count` random locations
        -> location:added { id, kind?, batch? }
           -> map records landmark ids
           -> after the last batch event: map:generated
```

The fixed tavern, castle and shack are guaranteed on every generated map. They are
ordinary locations with `kind` set and `biomeKey: "landmark"`, so they link into the travel
graph but roll no biome events. This is a placeholder: there are no interiors, unique
actions or layout rules yet.

## State

```js
map: {
  seed: 0,
  size: 20,               // random locations in the last batch
  total: 23,              // size + fixed landmarks
  lastGeneratedTick: 0,
  lastGeneratedAt: "1000-01-01 06:00",
  landmarks: {            // kind -> location id
    tavern: "loc_0001",
    castle: "loc_0002",
    shack: "loc_0003"
  }
}
```

## Tuning

Edit `map/data.js`:

- `defaultLocationCount` — default random count (20).
- `minLocationCount` / `maxLocationCount` — clamp range (0–100).
- `landmarks` — fixed definitions (`kind`, `name`, `biome`, `biomeKey`, `weather`,
  `hostility`). `kind` must stay unique per batch.

Generating again appends another batch. Fixed names are made unique by the locations
module, and `landmarks` points at the newest batch.
