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
- Each `loc_XXXX.json` is one location: `id`, `name`, `biome`, `biomeKey`,
  `weather`, `hostility` (1-100), `seed`, `createdAtTick`, `createdAt`.
- Locations are added only when you press **Add location** (or **Add 5 locations**).
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
