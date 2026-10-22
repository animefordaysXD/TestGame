/* Node test for the placeholder area-actions module. Run: node test/actions.test.cjs */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../actions/data.js");
require("../actions/actions.js");

const engine = new Engine({ seed: 4242, tickMinutes: 10 });
const actions = createActionsModule();
engine.register(actions);

const loadedEvents = [], chosenEvents = [];
engine.on("event:actions:loaded", (e) => loadedEvents.push(e));
engine.on("event:action:chosen", (e) => chosenEvents.push(e));

const act = (type, data) => { engine.fire({ type, data }); engine.flush(); };

act("location:visited", {
  id: "loc_0001", name: "Frozen Test", biome: "Tundra", biomeKey: "tundra",
  weather: "Snow", hostility: 60
});

const s = engine.state.modules.actions;
assert.equal(s.locationId, "loc_0001");
assert.equal(s.locationName, "Frozen Test");
assert.equal(s.biomeKey, "tundra");
assert.equal(s.actions.length, 5, "exactly five actions load");
assert.equal(new Set(s.actions.map((action) => action.id)).size, 5, "actions are distinct");
assert.equal(loadedEvents.length, 1);
assert.equal(loadedEvents[0].depth, 1, "actions:loaded is a follow-up");
assert.equal(loadedEvents[0].data.actions.length, 5);
assert.deepEqual(s.actions.map((action) => action.id), ["scout", "scavenge", "rest", "hunt", "travel"]);
assert.doesNotThrow(() => JSON.stringify(s.actions));

act("action:choose", { actionId: "scout" });
assert.equal(chosenEvents.length, 1);
assert.equal(chosenEvents[0].depth, 1, "action:chosen is a follow-up");
assert.equal(chosenEvents[0].data.actionId, "scout");
assert.equal(chosenEvents[0].data.locationId, "loc_0001");
assert.match(chosenEvents[0].text, /Scout in Frozen Test/);
assert.match(chosenEvents[0].text, /placeholder/);

act("action:choose", { actionId: "missing" });
assert.equal(chosenEvents.length, 1, "unknown actions are ignored");

// Per-biome overrides replace the default list when they have five entries.
LocationActionsData.biomes.tundra = [
  { id: "tundra_1", name: "Build shelter", description: "Find a windbreak." },
  { id: "tundra_2", name: "Gather firewood", description: "Collect dry fuel." },
  { id: "tundra_3", name: "Read tracks", description: "Study the snow." },
  { id: "tundra_4", name: "Warm up", description: "Recover by the fire." },
  { id: "tundra_5", name: "Move on", description: "Leave the cold." }
];
act("location:visited", { id: "loc_0002", name: "Another Tundra", biomeKey: "tundra" });
assert.deepEqual(s.actions.map((action) => action.id), [
  "tundra_1", "tundra_2", "tundra_3", "tundra_4", "tundra_5"
]);
assert.equal(loadedEvents.length, 2);
delete LocationActionsData.biomes.tundra;

// Too-short overrides fall back to the five default actions.
LocationActionsData.biomes.desert = [{ id: "only", name: "Only", description: "Too few." }];
act("location:visited", { id: "loc_0003", name: "Dunes", biomeKey: "desert" });
assert.equal(s.actions.length, 5);
assert.equal(s.actions[0].id, "scout");
delete LocationActionsData.biomes.desert;

// Reset clears the slice without duplicating the event subscriptions.
engine.reset(99);
assert.equal(engine.state.modules.actions.locationId, null);
assert.equal(engine.state.modules.actions.actions.length, 0);
const loadedBeforeResetVisit = loadedEvents.length;
act("location:visited", { id: "loc_0004", name: "After Reset", biomeKey: "forest" });
assert.equal(loadedEvents.length, loadedBeforeResetVisit + 1);
assert.equal(engine.state.modules.actions.actions.length, 5);

// Save/load keeps the loaded area and actions for the UI to render.
const saved = engine.serialize();
const engine2 = new Engine({ seed: 7 });
const actions2 = createActionsModule();
engine2.register(actions2);
engine2.load(saved);
assert.equal(engine2.state.modules.actions.locationName, "After Reset");
assert.equal(engine2.state.modules.actions.actions.length, 5);

const source = fs.readFileSync(path.join(__dirname, "../actions/actions.js"), "utf8");
assert.ok(!/Math\.random/.test(source), "actions.js must not use Math.random");

console.log("actions test passed");
