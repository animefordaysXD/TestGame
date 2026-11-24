/* Node tests for save files: seed + baseline + changes, export/import, legacy state
   migration and unsafe-path rejection.
   Run: node test/save.test.cjs */
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../characters/statsData.js");
require("../characters/bodyData.js");
require("../characters/body.js");
require("../characters/data.js");
require("../characters/characters.js");
require("../characters/mainCharacterData.js");
require("../characters/creatorData.js");
require("../characters/mainCharacter.js");
require("../characters/creator.js");
require("../tutorial/data.js");
require("../tutorial/tutorial.js");
require("../equipment/data.js");
require("../equipment/equipment.js");
require("../locations/data.js");
require("../locations/locations.js");
require("../map/data.js");
require("../map/map.js");
require("../actions/data.js");
require("../actions/actions.js");
require("../travel/data.js");
require("../travel/travel.js");
require("../combat/data.js");
require("../combat/combat.js");
require("../save/gameSave.js");

const act = (engine, type, data) => { engine.fire({ type, data }); engine.flush(); };

function buildEngine(opts = {}) {
  const engine = new Engine({ startDate: "1000-01-01T06:00:00Z", tickMinutes: 10, ...opts });
  engine.register(createCharactersModule());
  engine.register(createMainCharacterModule());
  engine.register(createEquipmentModule());
  engine.register(createCreatorModule());
  engine.register(createLocationsModule());
  engine.register(createMapModule());
  engine.register(createTutorialModule());
  engine.register(createActionsModule());
  engine.register(createTravelModule());
  engine.register(createCombatModule());
  return engine;
}

const live = buildEngine({ seed: 20261029 });

// Build a world with every kind of change: a main character, equipment, locations,
// an NPC, a completed action and advanced time.
live.modules.get("mainCharacter").save({ name: "Save Tester", gender: "female", age: 27 });
live.flush();
act(live, "equipment:add", { key: "leather_cuirass" });
act(live, "location:add", { count: 5 });
act(live, "character:spawn");
const actionsModule = live.modules.get("actions");
actionsModule.loadFor(0, { id: "loc_0001", name: "Test Camp", biomeKey: "forest" });
live.flush();
act(live, "action:choose", { actionId: live.state.modules.actions.actions[0].id });
live.step(3);

const save = GameSave.capture(live, buildEngine);

assert.equal(save.format, "text-rpg-save");
assert.equal(save.formatVersion, 1);
assert.equal(save.seed, live.state.seed, "the save stores the world seed");
assert.equal(save.label, live.now.text, "the save labels itself with the world clock");
assert.equal(save.baseline.startDate, live.state.time.startDate);
assert.equal(save.baseline.tickMinutes, live.state.time.tickMinutes);
assert.ok(save.changes.length > 0, "the save has changes");
assert.ok(
  save.changes.every((change) => Array.isArray(change.path) && change.path.length > 0),
  "every change has a path"
);
assert.ok(
  save.changes.every((change) => change.op === "set" || change.op === "delete"),
  "every change has a known op"
);
assert.equal(
  save.changes.filter((change) => change.path[0] === "eventLog").length,
  1,
  "the event log is stored as one change"
);
assert.doesNotThrow(() => JSON.parse(GameSave.stringify(save)), "the save is JSON-safe");

// A save file round-trips the entire live state. Compare against the JSON form of the
// live state: the event log can hold `data: undefined`, which JSON intentionally drops.
const liveJson = JSON.parse(live.serialize());
const restored = buildEngine({ seed: 1 });
const restoredSave = GameSave.restore(GameSave.stringify(save), restored, { buildEngine });
assert.equal(restoredSave.label, save.label);
assert.deepEqual(restored.state, liveJson, "restore rebuilds the exact live state");
assert.equal(restored.state.modules.locations.locations.loc_0001.connections.length > 0, true);

// Read/validate is idempotent and keeps the same changes.
const readBack = GameSave.read(GameSave.stringify(save), { buildEngine });
assert.deepEqual(readBack, save);

// Legacy v0: the old full-state JSON is migrated by rebuilding the fresh baseline and
// diffing it against the legacy state.
const legacyState = JSON.parse(live.serialize());
const legacySave = GameSave.read(JSON.stringify(legacyState), { buildEngine });
assert.equal(legacySave.formatVersion, 1);
assert.equal(legacySave.seed, legacyState.seed);
assert.equal(legacySave.label, live.now.text);
assert.ok(legacySave.changes.length > 0, "legacy migration produces changes");

const legacyRestored = buildEngine({ seed: 2 });
GameSave.restore(legacySave, legacyRestored, { buildEngine });
assert.deepEqual(legacyRestored.state, liveJson, "legacy migration restores the exact state");

// A newer format is refused with a clear message.
const newer = { ...save, formatVersion: 99 };
assert.throws(
  () => GameSave.read(newer, { buildEngine }),
  /newer than this build/,
  "newer save formats are refused"
);

// Unknown older formats without a migration payload are refused.
const unknown = { ...save, formatVersion: 0 };
assert.throws(
  () => GameSave.read(unknown, { buildEngine }),
  /Legacy save does not contain an engine state/,
  "older formats without a legacy state are refused"
);

// Invalid JSON is refused.
assert.throws(() => GameSave.read("{not json", { buildEngine }), /not valid JSON/);

// Prototype-pollution paths are rejected during validation and application.
for (const key of ["__proto__", "prototype", "constructor"]) {
  const bad = JSON.parse(JSON.stringify(save));
  bad.changes.push({ op: "set", path: ["modules", key, "polluted"], value: true });
  assert.throws(
    () => GameSave.read(bad, { buildEngine }),
    /unsafe path segment/,
    `${key} paths are rejected`
  );
}

const outside = JSON.parse(JSON.stringify(save));
outside.changes.push({ op: "set", path: ["notEngineState"], value: true });
assert.throws(
  () => GameSave.read(outside, { buildEngine }),
  /outside the engine state/,
  "paths outside the engine state are rejected"
);

// applyChanges does not create a prototype property.
const target = { modules: {} };
GameSave.applyChanges(target, [
  { op: "set", path: ["modules", "safe"], value: { ok: true } }
]);
assert.deepEqual(target.modules.safe, { ok: true });
assert.equal({}.polluted, undefined, "prototype pollution did not leak");

console.log("save test passed");
