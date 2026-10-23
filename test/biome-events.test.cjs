/* Node test for biome event JSON loading, visit rolls, and stat effects.
   Run: node test/biome-events.test.cjs */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../characters/statsData.js");
require("../characters/mainCharacterData.js");
require("../characters/mainCharacter.js");
require("../locations/data.js");
require("../locations/locations.js");

// The module fetches relative paths. In Node, resolve them from the project folder.
global.fetch = async (url) => {
  const text = await fs.promises.readFile(path.join(__dirname, "..", url), "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

(async () => {
  const engine = new Engine({ seed: 1234, tickMinutes: 10 });
  const mainCharacter = createMainCharacterModule();
  const locations = createLocationsModule();
  engine.register(mainCharacter);
  engine.register(locations);

  const summary = await locations.loadEvents();
  assert.equal(summary.errors.length, 0, "all biome event files load");
  assert.equal(summary.biomes, LocationData.biomes.length, "one file per biome");
  assert.ok(summary.events >= summary.biomes, "each biome keeps at least one event/template");
  assert.ok(summary.enabled >= 1, "the tundra sample is enabled");
  assert.ok(locations.eventsFor("tundra").length >= 2);
  const forestTemplate = locations.eventsFor("forest").find((event) => event.id === "forest_template");
  assert.ok(forestTemplate, "forest keeps its copy/paste template");
  assert.equal(forestTemplate.enabled, false);

  const snow = locations.eventsFor("tundra").find((event) => event.id === "tundra_snowfall");
  assert.equal(snow.chancePercent, 10);
  assert.equal(snow.chance, 0.1);
  assert.deepEqual(snow.effects, [{ stat: "stamina", delta: -10 }]);

  const character = mainCharacter.save({ name: "Event Tester", gender: "female", age: 20 });
  engine.flush();
  assert.equal(character.stats.stamina, 100, "a new main character starts with full stamina");

  const s = engine.state.modules.locations;
  s.locations.loc_9001 = {
    id: "loc_9001", name: "Frozen Test", biome: "Tundra", biomeKey: "tundra",
    weather: "Snow", hostility: 60, seed: s.seed, createdAtTick: 0, createdAt: engine.now.text
  };
  s.locations.loc_9002 = {
    id: "loc_9002", name: "Quiet Woods", biome: "Forest", biomeKey: "forest",
    weather: "Clear", hostility: 20, seed: s.seed, createdAtTick: 0, createdAt: engine.now.text
  };

  const visitedEvents = [], locationEvents = [], statEvents = [];
  engine.on("event:location:visited", (e) => visitedEvents.push(e));
  engine.on("event:location:event", (e) => locationEvents.push(e));
  engine.on("event:mainCharacter:statChanged", (e) => statEvents.push(e));

  const originalNext = engine.rng.next;
  engine.rng.next = () => 0.05;   // below 10%
  const firstVisit = await locations.visit("loc_9001");
  engine.flush();
  engine.rng.next = originalNext;

  assert.equal(s.currentId, "loc_9001", "visit stores the current location");
  assert.equal(visitedEvents.length, 1);
  assert.equal(visitedEvents[0].depth, 0);
  assert.equal(visitedEvents[0].data.id, "loc_9001");
  assert.equal(firstVisit.events.length, 1);
  assert.equal(firstVisit.events[0].id, "tundra_snowfall");

  assert.equal(locationEvents.length, 1);
  assert.equal(locationEvents[0].depth, 1, "the triggered event is a follow-up");
  assert.equal(locationEvents[0].data.eventId, "tundra_snowfall");
  assert.equal(locationEvents[0].data.chancePercent, 10);
  assert.equal(locationEvents[0].data.effects[0].stat, "stamina");
  assert.equal(locationEvents[0].data.effects[0].delta, -10);

  assert.equal(engine.state.modules.mainCharacter.character.stats.stamina, 90);
  assert.equal(statEvents.length, 1);
  assert.equal(statEvents[0].depth, 2, "stat changes are follow-ups to location events");
  assert.equal(statEvents[0].data.value, 90);
  assert.equal(statEvents[0].data.max, 100);
  assert.equal(statEvents[0].data.eventId, "tundra_snowfall");

  // A 50% roll does not trigger the 10% event.
  engine.rng.next = () => 0.5;
  const secondVisit = await locations.visit("loc_9001");
  engine.flush();
  engine.rng.next = originalNext;
  assert.equal(secondVisit.events.length, 0);
  assert.equal(locationEvents.length, 1);
  assert.equal(statEvents.length, 1);

  // The forest file contains only a disabled template.
  engine.rng.next = () => 0.0;
  const forestVisit = await locations.visit("loc_9002");
  engine.flush();
  engine.rng.next = originalNext;
  assert.equal(forestVisit.events.length, 0, "disabled templates never roll");

  await assert.rejects(() => locations.visit("loc_9999"), /Unknown location/);

  const saved = engine.serialize();
  const engine2 = new Engine({ seed: 999 });
  const main2 = createMainCharacterModule();
  const locations2 = createLocationsModule();
  engine2.register(main2);
  engine2.register(locations2);
  engine2.load(saved);
  assert.equal(engine2.state.modules.locations.currentId, "loc_9002");
  assert.equal(engine2.state.modules.mainCharacter.character.stats.stamina, 90);

  engine.reset(555);
  assert.equal(engine.state.modules.locations.currentId, null, "reset clears the current location");
  assert.equal(engine.state.modules.mainCharacter.character, null);

  // Reset must not duplicate the main character's location:event subscription.
  mainCharacter.save({ name: "After Reset", gender: "female", age: 22 });
  engine.flush();
  const beforeResetEffect = statEvents.length;
  engine.fire({ type: "location:event", data: { eventId: "manual", effects: [{ stat: "stamina", delta: -5 }] } });
  engine.flush();
  assert.equal(statEvents.length, beforeResetEffect + 1, "one statChanged per effect after reset");
  assert.equal(engine.state.modules.mainCharacter.character.stats.stamina, 95);

  const beforeUnknownStat = statEvents.length;
  engine.fire({ type: "location:event", data: { effects: [{ stat: "luck", delta: -50 }] } });
  engine.flush();
  assert.equal(statEvents.length, beforeUnknownStat, "unknown stats are ignored");
  assert.equal(engine.state.modules.mainCharacter.character.stats.stamina, 95);

  engine.fire({ type: "location:event", data: { effects: [{ stat: "mana", delta: -50 }] } });
  engine.flush();
  assert.equal(statEvents.length, beforeUnknownStat + 1, "mana is a real stat");
  assert.equal(engine.state.modules.mainCharacter.character.stats.mana, 0);

  engine.fire({ type: "location:event", data: { effects: [{ stat: "stamina", delta: -500 }] } });
  engine.flush();
  assert.equal(engine.state.modules.mainCharacter.character.stats.stamina, 0, "stamina clamps at zero");
  assert.equal(statEvents.at(-1).data.delta, -95);

  assert.ok(locations.eventStatus().enabled >= 1);

  for (const file of ["../locations/locations.js", "../characters/mainCharacter.js"]) {
    const text = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
  }

  console.log("biome events test passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
