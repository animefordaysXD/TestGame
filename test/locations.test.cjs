/* Node smoke test for the locations module. Run: node test/locations.test.cjs */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../characters/statsData.js");
require("../characters/bodyData.js");
require("../characters/body.js");
require("../characters/data.js");
require("../characters/characters.js");
require("../locations/data.js");
require("../locations/locations.js");

const act = (engine, type, data) => { engine.fire({ type, data }); engine.flush(); };

const engine = new Engine({ startDate: "1000-01-01T06:00:00Z", tickMinutes: 10, seed: 20261019 });
engine.register(createCharactersModule());
const locations = createLocationsModule();
engine.register(locations);

const added = [];
engine.on("event:location:added", (e) => added.push(e));

act(engine, "location:add", { count: 5 });

const s = engine.state.modules.locations;
const firstFive = Object.values(s.locations);

assert.equal(firstFive.length, 5, "five locations were added");
assert.equal(added.length, 5, "five location:added events were emitted");
assert.ok(added.every((e) => e.depth === 1), "follow-up events use depth + 1");
assert.equal(s.seed, engine.state.seed >>> 0, "map seed follows the world seed");

assert.deepEqual(firstFive.map((l) => l.id), ["loc_0001", "loc_0002", "loc_0003", "loc_0004", "loc_0005"]);
assert.equal(new Set(firstFive.map((l) => l.name)).size, 5, "location names are unique");
assert.equal(
  new Set(firstFive.map((l) => `${l.biome}|${l.weather}`)).size,
  5,
  "the first five locations use different biome/weather pairs"
);

for (const loc of firstFive) {
  assert.match(loc.id, /^loc_\d{4}$/);
  assert.ok(loc.name.length > 0);
  assert.ok(loc.biome.length > 0);
  assert.ok(loc.weather.length > 0);
  assert.ok(Number.isInteger(loc.hostility));
  assert.ok(loc.hostility >= 1 && loc.hostility <= 100, "hostility is 1-100");
  assert.ok(Number.isInteger(loc.level) && loc.level >= 1, "every location has a level");
  assert.equal(loc.seed, s.seed);
  assert.equal(typeof loc.createdAtTick, "number");
  assert.equal(typeof loc.createdAt, "string");
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(loc)), "location is JSON-safe");
}

// Routes: every edge is mutual, distances are in range, and the charted map is connected.
const [distanceMin, distanceMax] = LocationData.travelGraph.distanceRange;
for (const loc of firstFive) {
  assert.ok(Array.isArray(loc.connections), "locations carry a connections array");
  for (const route of loc.connections) {
    assert.notEqual(route.id, loc.id, "no self routes");
    assert.ok(s.locations[route.id], "routes point at charted locations");
    assert.ok(Number.isInteger(route.distance), "route distance is an integer");
    assert.ok(route.distance >= distanceMin && route.distance <= distanceMax, "route distance is in range");
    const reverse = s.locations[route.id].connections.find((entry) => entry.id === loc.id);
    assert.ok(reverse, `route ${loc.id} -> ${route.id} is mutual`);
    assert.equal(reverse.distance, route.distance, "mutual routes share one distance");
  }
}

const reachable = new Set(["loc_0001"]);
const queue = ["loc_0001"];
while (queue.length) {
  const id = queue.shift();
  for (const route of s.locations[id].connections) {
    if (reachable.has(route.id)) continue;
    reachable.add(route.id);
    queue.push(route.id);
  }
}
assert.equal(reachable.size, firstFive.length, "all charted locations are reachable");

assert.equal(locations.travelMinutes(3), 3 * LocationData.travelGraph.minutesPerDistance);
assert.equal(locations.routeBetween("loc_0001", "loc_0001"), null, "no route to self");
const firstRoute = locations.connectionsFor("loc_0001")[0];
assert.ok(firstRoute, "the first location has a route");
assert.equal(firstRoute.minutes, locations.travelMinutes(firstRoute.distance));
assert.equal(locations.connectionsFor("loc_0001").length, s.locations.loc_0001.connections.length);
assert.equal(locations.routeBetween("loc_0001", firstRoute.id).distance, firstRoute.distance);

// A newly charted location prefers the current area, so exploring stays coherent.
s.currentId = "loc_0001";
act(engine, "location:add");
const newest = Object.values(s.locations).find((loc) => loc.id === "loc_0006");
assert.ok(newest, "one more location was charted");
assert.ok(newest.connections.some((route) => route.id === "loc_0001"), "a new location links to the current area");

const json = locations.toJSON("loc_0001");
assert.equal(typeof json, "string");
assert.deepEqual(JSON.parse(json), firstFive[0], "toJSON round-trips");

assert.equal(locations.labelFor(1), "Peaceful");
assert.equal(locations.labelFor(20), "Peaceful");
assert.equal(locations.labelFor(21), "Watchful");
assert.equal(locations.labelFor(40), "Watchful");
assert.equal(locations.labelFor(41), "Unsettled");
assert.equal(locations.labelFor(60), "Unsettled");
assert.equal(locations.labelFor(61), "Dangerous");
assert.equal(locations.labelFor(80), "Dangerous");
assert.equal(locations.labelFor(81), "Deadly");
assert.equal(locations.labelFor(100), "Deadly");

for (const biome of LocationData.biomes) {
  assert.ok(biome.key && biome.name);
  assert.ok(Array.isArray(biome.weather) && biome.weather.length > 0);
  assert.ok(Array.isArray(biome.hostility));
  assert.ok(biome.hostility[0] >= 1 && biome.hostility[1] <= 100);
  assert.ok(Array.isArray(biome.levelRange));
  assert.ok(biome.levelRange[0] >= 1 && biome.levelRange[0] <= biome.levelRange[1], `${biome.key} has a level range`);
}
assert.equal(LocationData.defaultHostility, 50, "50 is the neutral hostility");
assert.equal(LocationData.defaultLevel, 1);
assert.ok(LocationData.hostilityBands.every((band) => band.key && band.label), "hostility bands have editor keys");

// Save/load keeps the generated map, its routes and its seed.
const saved = engine.serialize();
const engine2 = new Engine({ seed: 1 });
engine2.register(createLocationsModule());
engine2.load(saved);
const loaded = engine2.state.modules.locations;
assert.equal(Object.keys(loaded.locations).length, 6, "load keeps all locations");
assert.equal(loaded.seed, s.seed, "load keeps the map seed");
assert.equal(
  loaded.locations.loc_0001.connections.length,
  s.locations.loc_0001.connections.length,
  "load keeps the travel graph"
);

// Old saves have no connections. Loading repairs the graph without touching the RNG.
const legacyState = JSON.parse(saved);
for (const loc of Object.values(legacyState.modules.locations.locations)) delete loc.connections;
const engine3 = new Engine({ seed: 5 });
engine3.register(createLocationsModule());
engine3.load(legacyState);
const legacy = engine3.state.modules.locations;
assert.equal(Object.keys(legacy.locations).length, 6);
for (const loc of Object.values(legacy.locations)) {
  assert.ok(Array.isArray(loc.connections), "legacy locations gain a connections array");
  assert.ok(loc.connections.length > 0, "legacy locations are linked into the graph");
  for (const route of loc.connections) {
    const reverse = legacy.locations[route.id].connections.find((entry) => entry.id === loc.id);
    assert.ok(reverse, "legacy routes are made mutual");
  }
}

// Reset creates a new seed and an empty map, and does not duplicate bus handlers.
engine.reset(999);
const fresh = engine.state.modules.locations;
assert.equal(fresh.seed, 999, "reset creates a new map seed");
assert.equal(Object.keys(fresh.locations).length, 0, "reset clears the map");
act(engine, "location:add");
assert.equal(Object.keys(fresh.locations).length, 1, "handler was not subscribed twice");
assert.equal(fresh.locations.loc_0001.seed, 999);

// Add a larger batch to exercise name uniqueness.
act(engine, "location:add", { count: 20 });
const batch = Object.values(fresh.locations);
assert.equal(batch.length, 21);
assert.equal(new Set(batch.map((l) => l.name)).size, batch.length, "names stay unique in a larger batch");

const files = [
  "../locations/locations.js", "../locations/data.js",
  "../characters/characters.js", "../characters/mainCharacter.js",
  "../actions/actions.js", "../engine.js"
];
for (const file of files) {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
}

console.log("locations test passed");
console.table(firstFive.map((l) => ({
  id: l.id, name: l.name, biome: l.biome, weather: l.weather, hostility: l.hostility
})));
