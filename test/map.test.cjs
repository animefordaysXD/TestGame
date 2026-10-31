/* Node tests for the procedural map spawner. Run: node test/map.test.cjs */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../locations/data.js");
require("../locations/locations.js");
require("../map/data.js");
require("../map/map.js");

const act = (engine, type, data) => { engine.fire({ type, data }); engine.flush(); };

function buildEngine(seed = 20261029) {
  const engine = new Engine({ startDate: "1000-01-01T06:00:00Z", tickMinutes: 10, seed });
  engine.register(createLocationsModule());
  engine.register(createMapModule());
  return engine;
}

assert.deepEqual(
  MapData.landmarks.map((landmark) => landmark.kind).sort(),
  ["castle", "shack", "tavern"],
  "the fixed landmarks are tavern, castle and shack"
);

const engine = buildEngine();
const generated = [];
const added = [];
engine.on("event:map:generated", (e) => generated.push(e));
engine.on("event:location:added", (e) => added.push(e));

act(engine, "map:generate", { count: 7 });

const locations = engine.state.modules.locations;
const map = engine.state.modules.map;
const all = Object.values(locations.locations);

assert.equal(all.length, 10, "7 random locations plus 3 fixed landmarks");
assert.equal(added.length, 10, "every spawned location emits location:added");
assert.equal(generated.length, 1, "one map:generated event per batch");
assert.equal(map.size, 7, "the map slice records the random count");
assert.equal(map.total, 10, "the map slice records the batch total");
assert.equal(map.lastGeneratedTick, engine.now.tick, "the generation tick is recorded");
assert.ok(map.lastGeneratedAt, "the generation time is recorded");

const byKind = Object.fromEntries(all.filter((loc) => loc.kind).map((loc) => [loc.kind, loc]));
for (const kind of ["tavern", "castle", "shack"]) {
  const loc = byKind[kind];
  assert.ok(loc, `the ${kind} landmark exists`);
  assert.equal(loc.biomeKey, "landmark", `the ${kind} uses the landmark biome`);
  assert.equal(loc.biome, "Landmark");
  assert.equal(typeof loc.name, "string");
  assert.ok(loc.name.length > 0);
  assert.equal(map.landmarks[kind], loc.id, `map.landmarks records the ${kind} id`);
}

assert.equal(
  all.filter((loc) => !loc.kind).length,
  7,
  "the requested number of random locations was spawned"
);
assert.equal(new Set(all.map((loc) => loc.name)).size, all.length, "all map names are unique");
assert.equal(
  added.filter((e) => e.data && e.data.batch === generated[0].data.batch).length,
  10,
  "all location:added events carry the map batch id"
);
assert.equal(added[0].depth, 2, "location:added follows the map request at depth + 1");
assert.equal(generated[0].depth, 3, "map:generated waits for the last location at depth + 1");
assert.deepEqual(
  generated[0].data.landmarks,
  map.landmarks,
  "map:generated reports the fixed landmark ids"
);

// Every fixed landmark name is stable across a fresh map.
const names = new Map(MapData.landmarks.map((landmark) => [landmark.kind, landmark.name]));
for (const [kind, loc] of Object.entries(byKind))
  assert.ok(loc.name === names.get(kind) || loc.name.startsWith(names.get(kind) + " ("),
    `the ${kind} keeps its fixed name`);

// The chart is connected like any other locations map.
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
assert.equal(reachable.size, all.length, "fixed landmarks are linked into the travel graph");

// Save/load keeps the map metadata, landmark ids and the location kinds.
const saved = engine.serialize();
const engine2 = buildEngine(1);
engine2.load(saved);
const loadedMap = engine2.state.modules.map;
const loadedLocations = engine2.state.modules.locations;
assert.equal(loadedMap.size, 7);
assert.equal(loadedMap.total, 10);
assert.deepEqual(loadedMap.landmarks, map.landmarks);
for (const kind of ["tavern", "castle", "shack"])
  assert.equal(loadedLocations.locations[loadedMap.landmarks[kind]].kind, kind);

// Reset clears map metadata and keeps exactly one subscription.
const resetGenerated = [];
engine.on("event:map:generated", (e) => resetGenerated.push(e));
engine.reset(999);
const freshMap = engine.state.modules.map;
assert.equal(freshMap.size, 0, "reset clears the map size");
assert.equal(freshMap.lastGeneratedAt, "", "reset clears the generation time");
assert.deepEqual(freshMap.landmarks, {}, "reset clears landmark ids");

act(engine, "map:generate", { count: 0 });
assert.equal(Object.keys(engine.state.modules.locations.locations).length, 3,
  "a zero random count still spawns the three fixed landmarks");
assert.equal(resetGenerated.length, 1, "reset did not duplicate the handler");
assert.equal(engine.state.modules.map.size, 0);

const files = ["../map/map.js", "../map/data.js"];
for (const file of files) {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
}

console.log("map test passed");
console.table(all.map((loc) => ({
  id: loc.id, name: loc.name, kind: loc.kind || "random", biome: loc.biome
})));
