/* Node tests for the area-actions module: loading, weighted outcomes, costs, travel
   through the locations module, equipment rewards, reset and save/load.
   Run: node test/actions.test.cjs */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../characters/statsData.js");
require("../characters/mainCharacterData.js");
require("../characters/mainCharacter.js");
require("../equipment/data.js");
require("../equipment/equipment.js");
require("../locations/data.js");
require("../locations/locations.js");
require("../actions/data.js");
require("../actions/actions.js");

// The locations module fetches relative paths. In Node, resolve them from the project folder.
global.fetch = async (url) => {
  const text = await fs.promises.readFile(path.join(__dirname, "..", url), "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

const act = (engine, type, data) => { engine.fire({ type, data }); engine.flush(); };

const TEST_ACTIONS = [
  {
    id: "test_scout", name: "Test scout", description: "Recover more than it costs.",
    timeMinutes: 30,
    costs: [{ stat: "stamina", delta: -10 }],
    outcomes: [{
      id: "test_scout_ok", name: "Scouted", text: "The scouting pays off.",
      weight: 1, effects: [{ stat: "stamina", delta: 20 }]
    }]
  },
  {
    id: "test_gear", name: "Test gear", description: "Find armor.",
    timeMinutes: 15,
    costs: [],
    outcomes: [{
      id: "test_gear_found", name: "Armor found", text: "You find a usable cuirass.",
      weight: 1, effects: [], equipmentKey: "leather_cuirass"
    }]
  },
  {
    id: "test_travel", name: "Test travel", description: "Move to another location.",
    timeMinutes: 30,
    costs: [{ stat: "stamina", delta: -5 }],
    outcomes: [],
    requiresDestination: true,
    travelText: "You set out."
  },
  {
    id: "test_quiet", name: "Test quiet", description: "Do nothing in particular.",
    timeMinutes: 10,
    costs: [],
    outcomes: [{ id: "test_quiet_ok", name: "Quiet", text: "Nothing happens.", weight: 1, effects: [] }]
  },
  {
    id: "test_skill", name: "Test skill", description: "Improve a skill.",
    timeMinutes: 10,
    costs: [{ stat: "intelligence", delta: 1 }],
    outcomes: [{ id: "test_skill_ok", name: "Studied", text: "You learn something.", weight: 1, effects: [] }]
  }
];

(async () => {
  LocationActionsData.biomes.tundra = TEST_ACTIONS;

  const engine = new Engine({ seed: 4242, tickMinutes: 10 });
  const main = createMainCharacterModule();
  const equipment = createEquipmentModule();
  const locations = createLocationsModule();
  const actions = createActionsModule();
  engine.register(main);
  engine.register(equipment);
  engine.register(locations);
  engine.register(actions);

  const character = main.save({ name: "Action Tester", gender: "female", age: 24 });
  engine.flush();
  character.stats.stamina = 50;

  const loadedEvents = [], chosenEvents = [], resolvedEvents = [], blockedEvents = [], statEvents = [];
  engine.on("event:actions:loaded", (e) => loadedEvents.push(e));
  engine.on("event:action:chosen", (e) => chosenEvents.push(e));
  engine.on("event:action:resolved", (e) => resolvedEvents.push(e));
  engine.on("event:action:blocked", (e) => blockedEvents.push(e));
  engine.on("event:mainCharacter:statChanged", (e) => statEvents.push(e));

  const s = engine.state.modules.locations;
  for (const [id, name, biome, biomeKey] of [
    ["loc_0001", "Frozen Test", "Tundra", "tundra"],
    ["loc_0002", "Quiet Woods", "Forest", "forest"]
  ]) {
    s.locations[id] = {
      id, name, biome, biomeKey, weather: "Clear", hostility: 30,
      seed: s.seed, createdAtTick: 0, createdAt: engine.now.text
    };
  }

  // A visit loads the five actions and announces them at depth + 1.
  act(engine, "location:visited", {
    id: "loc_0001", name: "Frozen Test", biome: "Tundra", biomeKey: "tundra",
    weather: "Snow", hostility: 60
  });
  const slice = engine.state.modules.actions;
  assert.equal(slice.locationId, "loc_0001");
  assert.equal(slice.locationName, "Frozen Test");
  assert.equal(slice.biomeKey, "tundra");
  assert.equal(slice.actions.length, 5, "exactly five actions load");
  assert.deepEqual(slice.actions.map((action) => action.id), TEST_ACTIONS.map((action) => action.id));
  assert.equal(loadedEvents.length, 1);
  assert.equal(loadedEvents[0].depth, 1, "actions:loaded is a follow-up");
  assert.equal(loadedEvents[0].data.actions.length, 5);
  assert.equal(slice.lastAction, null);
  assert.doesNotThrow(() => JSON.stringify(slice.actions));

  // Costs and outcome effects are announced; mainCharacter applies and clamps them.
  act(engine, "action:choose", { actionId: "test_scout" });
  assert.equal(chosenEvents.length, 1);
  assert.equal(chosenEvents[0].depth, 1);
  assert.equal(chosenEvents[0].data.actionId, "test_scout");
  assert.equal(chosenEvents[0].data.locationId, "loc_0001");
  assert.match(chosenEvents[0].text, /Test scout in Frozen Test/);

  assert.equal(resolvedEvents.length, 1);
  assert.equal(resolvedEvents[0].depth, 1, "action:resolved is a follow-up");
  const resolved = resolvedEvents[0].data;
  assert.equal(resolved.actionId, "test_scout");
  assert.equal(resolved.outcomeId, "test_scout_ok");
  assert.equal(resolved.timeMinutes, 30);
  assert.deepEqual(resolved.effects, [
    { stat: "stamina", delta: -10 },
    { stat: "stamina", delta: 20 }
  ]);
  assert.match(resolvedEvents[0].text, /\(30 min\)$/);
  assert.equal(character.stats.stamina, 60, "50 - 10 + 20");
  assert.equal(statEvents.length, 2);
  assert.equal(statEvents[0].depth, 2, "stat changes follow action:resolved");
  assert.equal(statEvents[0].data.eventId, "test_scout");
  assert.deepEqual(slice.lastAction, resolved);
  assert.doesNotThrow(() => JSON.stringify(slice.lastAction));

  // A travel action needs a destination and is blocked without one.
  const resolvedBeforeBlock = resolvedEvents.length;
  act(engine, "action:choose", { actionId: "test_travel" });
  assert.equal(resolvedEvents.length, resolvedBeforeBlock, "blocked choices do not resolve");
  assert.equal(blockedEvents.length, 1);
  assert.equal(blockedEvents[0].depth, 1);
  assert.equal(blockedEvents[0].data.reason, "destination-required");
  assert.equal(slice.lastAction.actionId, "test_scout", "a blocked choice keeps the last resolution");

  // Travel applies its cost and returns the destination for the UI to visit.
  const staminaBeforeTravel = character.stats.stamina;
  act(engine, "action:choose", { actionId: "test_travel", destinationId: "loc_0002" });
  assert.equal(resolvedEvents.length, resolvedBeforeBlock + 1);
  const travel = resolvedEvents.at(-1).data;
  assert.equal(travel.travelTo, "loc_0002");
  assert.equal(travel.timeMinutes, 30);
  assert.equal(character.stats.stamina, staminaBeforeTravel - 5, "travel costs stamina");

  // The UI now moves the party through the locations module, exactly as the page does.
  const loadedBeforeTravel = loadedEvents.length;
  const visit = await locations.visit(travel.travelTo);
  engine.flush();
  assert.equal(visit.location.id, "loc_0002");
  assert.equal(engine.state.modules.locations.currentId, "loc_0002");
  assert.equal(slice.locationId, "loc_0002", "travel reloads the destination's actions");
  assert.equal(loadedEvents.length, loadedBeforeTravel + 1);
  assert.deepEqual(slice.actions.map((action) => action.id),
    ["scout", "scavenge", "rest", "hunt", "travel"], "forest falls back to the default actions");

  // An outcome can award equipment; equipment auto-equips it and writes armor.
  act(engine, "location:visited", {
    id: "loc_0001", name: "Frozen Test", biome: "Tundra", biomeKey: "tundra",
    weather: "Snow", hostility: 60
  });
  act(engine, "action:choose", { actionId: "test_gear" });
  const gear = Object.values(engine.state.modules.equipment.items)[0];
  assert.ok(gear, "the equipment module added the awarded item");
  assert.equal(gear.key, "leather_cuirass");
  assert.equal(gear.equipped, true);
  assert.equal(engine.state.modules.mainCharacter.character.stats.armor, 3);

  // Unknown actions are ignored.
  act(engine, "action:choose", { actionId: "missing" });
  assert.equal(resolvedEvents.at(-1).data.actionId, "test_gear");

  // Reset clears the slice and keeps single subscriptions.
  const resolvedBeforeReset = resolvedEvents.length;
  engine.reset(99);
  assert.equal(engine.state.modules.actions.locationId, null);
  assert.equal(engine.state.modules.actions.actions.length, 0);
  assert.equal(engine.state.modules.actions.lastAction, null);
  act(engine, "location:visited", { id: "loc_0003", name: "After Reset", biomeKey: "forest" });
  assert.equal(engine.state.modules.actions.actions.length, 5);
  act(engine, "action:choose", { actionId: "scout" });
  assert.equal(resolvedEvents.length, resolvedBeforeReset + 1, "one resolution after reset");

  // Save/load keeps the area, the action list and the last resolution for the UI.
  const saved = engine.serialize();
  const engine2 = new Engine({ seed: 7 });
  const actions2 = createActionsModule();
  engine2.register(actions2);
  engine2.load(saved);
  assert.equal(engine2.state.modules.actions.locationName, "After Reset");
  assert.equal(engine2.state.modules.actions.actions.length, 5);
  assert.equal(engine2.state.modules.actions.lastAction.actionId, "scout");
  assert.equal(engine2.state.modules.actions.lastAction.timeMinutes, 30);

  // Too-short overrides still fall back to the five default actions.
  LocationActionsData.biomes.desert = [{ id: "only", name: "Only", description: "Too few." }];
  act(engine, "location:visited", { id: "loc_0004", name: "Dunes", biomeKey: "desert" });
  assert.equal(engine.state.modules.actions.actions.length, 5);
  assert.equal(engine.state.modules.actions.actions[0].id, "scout");
  delete LocationActionsData.biomes.desert;
  delete LocationActionsData.biomes.tundra;

  for (const file of ["../actions/actions.js", "../actions/data.js"]) {
    const text = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
  }

  console.log("actions test passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
