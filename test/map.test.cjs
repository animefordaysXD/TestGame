/* Node tests for the static world map and procedural landmark terrain.
   Run: node test/map.test.cjs */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

global.window = global;
global.fetch = undefined;   // biome event loading is not part of this test
require("../engine.js");
require("../locations/data.js");
require("../locations/locations.js");
require("../map/data.js");
require("../map/map.js");

const act = (engine, type, data) => { engine.fire({ type, data }); engine.flush(); };

async function main() {

function buildEngine(seed = 20261029) {
  const engine = new Engine({ startDate: "1000-01-01T06:00:00Z", tickMinutes: 10, seed });
  engine.register(createLocationsModule());
  engine.register(createMapModule());
  return engine;
}

// ----- static content -----
const sites = MapData.world.locations;
const siteByKey = new Map(sites.map((site) => [site.key, site]));
assert.ok(sites.length >= 3, "the static map has sites");
assert.equal(new Set(sites.map((site) => site.key)).size, sites.length, "site keys are unique");
assert.equal(new Set(sites.map((site) => site.name)).size, sites.length, "site names are unique");

const interiors = new Map((MapData.terrain.interiors || []).map((preset) => [preset.key, preset]));
assert.deepEqual(
  sites.filter((site) => site.interior).map((site) => site.interior).sort(),
  ["castle", "shack", "tavern"],
  "the three landmarks declare interiors"
);
for (const site of sites)
  if (site.interior) assert.ok(interiors.has(site.interior), `${site.name} uses a known interior preset`);

for (const route of MapData.world.routes) {
  assert.ok(siteByKey.has(route.from), `route from ${route.from} points at a site`);
  assert.ok(siteByKey.has(route.to), `route to ${route.to} points at a site`);
  assert.notEqual(route.from, route.to, "routes do not loop");
}

// ----- loading the authored map -----
const engine = buildEngine();
const generated = [];
const added = [];
engine.on("event:map:generated", (e) => generated.push(e));
engine.on("event:location:added", (e) => added.push(e));

act(engine, "map:load");

const locations = engine.state.modules.locations;
const locationsModule = engine.modules.get("locations");
const map = engine.state.modules.map;
const mapModule = engine.modules.get("map");
const all = Object.values(locations.locations);

assert.equal(all.length, sites.length, "the static map charts every site");
assert.equal(added.length, sites.length, "every site emits location:added");
assert.equal(generated.length, 1, "one map:generated event per load");
assert.equal(map.loaded, true, "the map is marked loaded");
assert.equal(map.total, sites.length, "the map records the static site count");
assert.equal(map.lastGeneratedTick, engine.now.tick, "the load tick is recorded");
assert.ok(map.lastGeneratedAt, "the load time is recorded");
assert.equal(added[0].depth, 2, "location:added follows the map request at depth + 1");
assert.equal(generated[0].depth, 3, "map:generated waits for the last site at depth + 1");

for (const site of sites) {
  const id = map.sites[site.key];
  assert.ok(id, `map.sites records ${site.key}`);
  const loc = locations.locations[id];
  assert.equal(loc.key, site.key, `${site.key} keeps its content key`);
  assert.equal(loc.name, site.name, `${site.key} keeps its authored name`);
  assert.equal(loc.biome, site.biome);
  assert.equal(loc.biomeKey, site.biomeKey);
  assert.equal(loc.weather, site.weather);
  assert.equal(loc.hostility, site.hostility);
  assert.equal(loc.level, site.level);
  if (site.kind) {
    assert.equal(loc.kind, site.kind);
    assert.equal(map.landmarks[site.kind], id, `map.landmarks records ${site.kind}`);
  } else {
    assert.equal(loc.kind, "");
  }
}
assert.deepEqual(
  Object.keys(map.landmarks).sort(),
  sites.filter((site) => site.kind).map((site) => site.kind).sort(),
  "only authored landmarks are recorded by kind"
);
assert.deepEqual(added.map((e) => e.data.key).sort(), sites.map((site) => site.key).sort(),
  "location:added reports the static site key");

// The authored graph replaces random auto-links.
for (const route of MapData.world.routes) {
  const fromId = map.sites[route.from], toId = map.sites[route.to];
  const forward = locationsModule.routeBetween(fromId, toId);
  const backward = locationsModule.routeBetween(toId, fromId);
  assert.ok(forward && backward, `${route.from} <-> ${route.to} is a two-way route`);
  assert.equal(forward.distance, route.distance, `${route.from} <-> ${route.to} keeps its distance`);
  assert.equal(backward.distance, route.distance, "route distances are symmetric");
}
const authoredEdges = MapData.world.routes.length;
const actualEdges = all.reduce((sum, loc) => sum + loc.connections.length, 0) / 2;
assert.equal(actualEdges, authoredEdges, "the static map has no random routes");

const reachable = new Set([all[0].id]);
const queue = [all[0].id];
while (queue.length) {
  const id = queue.shift();
  for (const route of locations.locations[id].connections) {
    if (reachable.has(route.id)) continue;
    reachable.add(route.id);
    queue.push(route.id);
  }
}
assert.equal(reachable.size, all.length, "the whole static map is reachable");

// Loading again is idempotent and does not duplicate sites.
const countBefore = Object.keys(locations.locations).length;
act(engine, "map:load");
assert.equal(Object.keys(locations.locations).length, countBefore, "a second load adds no sites");
assert.equal(generated.length, 2);
assert.equal(generated[1].data.alreadyLoaded, true, "the second load reports that it changed nothing");

// ----- procedural interiors -----
const terrainEvents = [];
engine.on("event:map:terrainGenerated", (e) => terrainEvents.push(e));
const tavernId = map.sites.broken_wheel;
const tavernPreset = interiors.get("tavern");

const visit = await locationsModule.visit(tavernId);
engine.flush();
const tavern = mapModule.terrainFor(tavernId);
assert.ok(tavern, "visiting a landmark generates its interior");
assert.equal(tavern.interior, "tavern");
assert.equal(tavern.width, tavernPreset.width);
assert.equal(tavern.height, tavernPreset.height);
assert.equal(tavern.tiles.length, tavern.height, "the grid has one row per tile of height");
assert.ok(tavern.tiles.every((row) => row.length === tavern.width), "every row is the full width");
assert.ok(tavern.rooms >= 1, "the interior has at least one room");
assert.equal(tavern.tiles[tavern.entrance.y][tavern.entrance.x], MapData.terrain.tiles.entrance,
  "the entrance tile is marked");
assert.ok(tavern.counts[MapData.terrain.tiles.wall] > 0, "the interior has walls");
assert.ok(tavern.counts[MapData.terrain.tiles.floor] > 0, "the interior has floors");
assert.equal(terrainEvents.length, 1, "terrain generation emits one event");
assert.equal(terrainEvents[0].data.locationId, tavernId);
assert.equal(visit.location.id, tavernId);

const firstTiles = tavern.tiles.join("\n");
await locationsModule.visit(tavernId);
engine.flush();
assert.equal(mapModule.terrainFor(tavernId).tiles.join("\n"), firstTiles, "the stored interior is reused");
assert.equal(terrainEvents.length, 1, "a second visit generates no new terrain");

// The same seed and the same first visit produce the same interior.
const engineB = buildEngine();
act(engineB, "map:load");
const mapB = engineB.state.modules.map;
await engineB.modules.get("locations").visit(mapB.sites.broken_wheel);
engineB.flush();
assert.equal(
  engineB.modules.get("map").terrainFor(mapB.sites.broken_wheel).tiles.join("\n"),
  firstTiles,
  "terrain generation is deterministic for a seed"
);

// Wilderness sites have no interior.
const woodId = map.sites.whispering_wood;
await locationsModule.visit(woodId);
engine.flush();
assert.equal(mapModule.terrainFor(woodId), null, "only landmarks have interiors");
assert.equal(mapModule.ensureTerrain(woodId), null);
assert.equal(mapModule.siteForLocation(woodId).interior, undefined);

// ----- save/load and reset -----
const saved = engine.serialize();
const engine2 = buildEngine(1);
engine2.load(saved);
const loadedMap = engine2.state.modules.map;
const loadedLocations = engine2.state.modules.locations;
assert.equal(loadedMap.loaded, true);
assert.equal(loadedMap.total, sites.length);
assert.deepEqual(loadedMap.sites, map.sites);
assert.deepEqual(loadedMap.landmarks, map.landmarks);
assert.equal(
  engine2.modules.get("map").terrainFor(loadedMap.sites.broken_wheel).tiles.join("\n"),
  firstTiles,
  "loaded saves keep their generated interiors"
);
for (const kind of Object.keys(map.landmarks))
  assert.equal(loadedLocations.locations[loadedMap.landmarks[kind]].kind, kind);

act(engine2, "map:load");
assert.equal(Object.keys(loadedLocations.locations).length, sites.length,
  "loading after a save does not duplicate the static map");

engine.reset(999);
const freshMap = engine.state.modules.map;
assert.equal(freshMap.loaded, false, "reset clears the loaded flag");
assert.equal(freshMap.lastGeneratedAt, "", "reset clears the load time");
assert.deepEqual(freshMap.sites, {}, "reset clears site ids");
assert.deepEqual(freshMap.terrain, {}, "reset clears interiors");

const resetGenerated = [];
engine.on("event:map:generated", (e) => resetGenerated.push(e));
act(engine, "map:load");
assert.equal(Object.keys(engine.state.modules.locations.locations).length, sites.length,
  "reset reloads the same static map");
assert.equal(resetGenerated.length, 1, "reset did not duplicate the handler");
const resetMap = engine.state.modules.map;
assert.equal(resetMap.sites.broken_wheel, "loc_0001", "static site ids restart from loc_0001");

for (const file of ["../map/map.js", "../map/data.js"]) {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
}

console.log("map test passed");
console.table(all.map((loc) => ({
  id: loc.id, key: loc.key, name: loc.name, kind: loc.kind || "wilds", biome: loc.biome
})));

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
