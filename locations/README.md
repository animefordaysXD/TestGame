# Locations

The Locations module writes one subfolder per map seed when you use
**Connect Locations folder** on the test page:

```
Locations/
  <map seed>/
    seed.json
    loc_0001.json
    loc_0002.json
    ...
```

- `seed.json` records the seed, creation time, tick and tick size.
- Each `loc_XXXX.json` is one location: `id`, `name`, `biome`, `biomeKey`, `kind`,
  `weather`, `hostility` (1-100), `connections[]`, `seed`, `createdAtTick`,
  `createdAt`.
- `kind` is empty for ordinary locations, or `tavern`/`castle`/`shack` for the fixed
  landmarks that the map module adds to every generated map. Landmarks use
  `biomeKey: "landmark"` and roll no biome events.
- A connection is `{ id, distance }`, where `distance` is 1-5 leagues. Routes are
  bidirectional: both endpoints store the same distance.
- New locations link to the current area plus a random neighbour. Old saves and imported
  files without `connections` are repaired deterministically on load.
- **Visit** only allows the current location or a direct route from it. Travel along the
  graph from the Actions panel to reach a farther place.
- Locations are added when you press **Add location**, **Add 5 locations**, or **Generate
  map**. The map spawner always includes the fixed tavern, castle and shack landmarks.
- Reconnecting the folder imports any unknown `loc_*.json` files from the current
  seed folder. Existing ids in the game state win.
- The game state is the source of truth; the folder is a readable, editable mirror.
- Biome event content is separate: use `locations/events/<biomeKey>/events.json`, not
  this mirror folder. See `locations/events/README.md`.
- Browser folder access needs Chrome or Edge. If `index.html` is opened through
  `file://`, serve the folder instead (`npm run serve`, then open
  <http://127.0.0.1:8765/>).

Combat is separate from visiting locations. A visit rolls biome events; fights start from
an NPC card's **Fight** button. See `combat/README.md`.

The **Travel** area action does not edit this slice directly. It resolves its cost, then
the UI starts the travel module with the route distance and time; on completion it calls
`locations.visit(destinationId)`. That is the same path as the **Visit** button, so the
destination's actions load and its biome events roll. See `actions/README.md` and
`travel/README.md`.
