/* Node tests for the travel module: 5-minute checks, pause/resume, effects and save/load.
   Run: node test/travel.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
require("../engine.js");
require("../characters/statsData.js");
require("../characters/mainCharacterData.js");
require("../characters/mainCharacter.js");
require("../travel/data.js");

const shippedEvents = TravelData.events.slice();
assert.ok(shippedEvents.length >= 5, "travel/data.js should ship a usable event list");
assert.equal(TravelData.minutesPerCheck, 5);
for (const event of shippedEvents) {
  assert.ok(event.id && event.name && event.text, "every shipped travel event needs id, name and text");
  assert.ok(Array.isArray(event.effects), "every shipped travel event needs effects");
}

// Use a small deterministic catalog so the picked event is easy to assert.
TravelData.events = [
  { id: "test_hit", name: "Test hit", text: "A test hit.", weight: 1, effects: [{ stat: "stamina", delta: -5 }] },
  { id: "test_toll", name: "Test toll", text: "A test toll.", weight: 1, effects: [{ stat: "hp", delta: -3 }] }
];
require("../travel/travel.js");

const act = (engine, type, data) => { engine.fire({ type, data }); engine.flush(); };

function makeWorld(seed) {
  const engine = new Engine({ seed, tickMinutes: 10 });
  const main = createMainCharacterModule();
  const travel = createTravelModule();
  engine.register(main);
  engine.register(travel);
  const character = main.save({ name: "Road Tester", gender: "female", age: 29 });
  engine.flush();
  return { engine, main, travel, character };
}

const events = { started: [], progress: [], interrupted: [], resumed: [], completed: [], cancelled: [], stat: [] };
function watch(engine) {
  engine.on("event:travel:started", (e) => events.started.push(e));
  engine.on("event:travel:progress", (e) => events.progress.push(e));
  engine.on("event:travel:event", (e) => events.interrupted.push(e));
  engine.on("event:travel:resumed", (e) => events.resumed.push(e));
  engine.on("event:travel:completed", (e) => events.completed.push(e));
  engine.on("event:travel:cancelled", (e) => events.cancelled.push(e));
  engine.on("event:mainCharacter:statChanged", (e) => events.stat.push(e));
}

const journey = (destinationId = "loc_0002", durationMinutes = 30) => ({
  originId: "loc_0001", originName: "Start",
  destinationId, destinationName: "Finish", destinationBiomeKey: "forest",
  durationMinutes
});

const { engine, main, travel, character } = makeWorld(6001);
watch(engine);
const slice = () => engine.state.modules.travel;

// Empty slice starts idle.
assert.equal(slice().active, false);
assert.equal(slice().paused, false);
assert.equal(travel.minutesPerCheck, 5);

// A journey rounds its duration up to whole 5-minute checks.
act(engine, "travel:start", journey("loc_0002", 7));
assert.equal(slice().active, true);
assert.equal(slice().durationMinutes, 10, "7 minutes becomes two 5-minute checks");
assert.equal(slice().elapsedMinutes, 0);
assert.equal(slice().destinationId, "loc_0002");
assert.equal(events.started.length, 1);
assert.equal(events.started[0].depth, 1, "travel:started is a follow-up to the request");

// A second start while travelling is ignored.
act(engine, "travel:start", journey("loc_0003", 30));
assert.equal(slice().destinationId, "loc_0002");
assert.equal(events.started.length, 1);

// Cancel abandons the journey without completing it.
act(engine, "travel:cancel");
assert.equal(slice().active, false);
assert.equal(slice().lastCompleted, null);
assert.equal(events.cancelled.length, 1);

// Missing destination is rejected.
act(engine, "travel:start", { destinationName: "Nowhere", durationMinutes: 30 });
assert.equal(slice().active, false);

// No-event journey: five progress events, then completion on the sixth check.
TravelData.chanceByBiome = {};
TravelData.chancePercent = 0;
act(engine, "travel:start", journey("loc_0002", 30));
for (let i = 0; i < 5; i++) act(engine, "travel:advance", { minutes: 5 });
assert.equal(slice().active, true);
assert.equal(slice().elapsedMinutes, 25);
assert.equal(slice().checks, 5);
assert.equal(events.progress.length, 5);
assert.equal(events.progress[0].depth, 1);
assert.equal(events.progress.at(-1).data.elapsedMinutes, 25);
assert.equal(events.interrupted.length, 0);
assert.equal(engine.state.time.minutes, 0, "the module does not move the core clock; the UI does");

act(engine, "travel:advance", { minutes: 5 });
assert.equal(slice().active, false);
assert.equal(slice().elapsedMinutes, 30);
assert.equal(events.completed.length, 1);
assert.equal(events.completed[0].data.elapsedMinutes, 30);
assert.equal(events.completed[0].data.destinationName, "Finish");
assert.equal(slice().lastCompleted.destinationId, "loc_0002");
assert.ok(slice().lastCompleted.atTick >= 0);

// A forced event pauses travel, applies its effects through mainCharacter, and waits.
TravelData.chancePercent = 100;
act(engine, "travel:start", journey("loc_0003", 15));
const staminaBefore = character.stats.stamina;
const hpBefore = character.stats.hp;
act(engine, "travel:advance", { minutes: 5 });
assert.equal(slice().active, true);
assert.equal(slice().paused, true);
assert.equal(slice().elapsedMinutes, 5);
assert.equal(slice().eventCount, 1);
assert.ok(slice().lastEvent);
assert.equal(events.interrupted.length, 1);
assert.equal(events.interrupted[0].depth, 1);
assert.equal(slice().lastEvent.eventId, events.interrupted[0].data.eventId);
assert.equal(events.stat.length, 1, "mainCharacter applies the travel event effects");
assert.equal(events.stat[0].depth, 2, "statChanged is a follow-up to travel:event");
assert.equal(events.stat[0].data.eventId, slice().lastEvent.eventId);
assert.ok(
  (character.stats.stamina === staminaBefore - 5 && character.stats.hp === hpBefore) ||
  (character.stats.hp === hpBefore - 3 && character.stats.stamina === staminaBefore),
  "one test event effect is applied"
);

// Advancing while paused is ignored.
act(engine, "travel:advance", { minutes: 5 });
assert.equal(slice().elapsedMinutes, 5);
assert.equal(events.interrupted.length, 1);

// Continue clears the pause; the next advance resumes the checks.
act(engine, "travel:continue");
assert.equal(slice().paused, false);
assert.equal(events.resumed.length, 1);
assert.equal(events.resumed[0].depth, 1);

TravelData.chancePercent = 0;
act(engine, "travel:advance", { minutes: 5 });
assert.equal(slice().elapsedMinutes, 10);
assert.equal(slice().paused, false);
act(engine, "travel:advance", { minutes: 5 });
assert.equal(slice().active, false);
assert.equal(slice().lastCompleted.elapsedMinutes, 15);

// An interruption on the final check still pauses; Continue then completes without
// adding a phantom fifth minute.
TravelData.chancePercent = 100;
act(engine, "travel:start", journey("loc_0004", 5));
act(engine, "travel:advance", { minutes: 5 });
assert.equal(slice().paused, true);
assert.equal(slice().elapsedMinutes, 5);
assert.equal(slice().active, true);
TravelData.chancePercent = 0;
act(engine, "travel:continue");
assert.equal(slice().paused, false);
act(engine, "travel:advance", { minutes: 5 });
assert.equal(slice().active, false);
assert.equal(slice().elapsedMinutes, 5, "completion does not overshoot the duration");

// Reset clears the slice and keeps a single subscription.
const startedBeforeReset = events.started.length;
engine.reset(7001);
assert.equal(slice().active, false);
assert.equal(slice().durationMinutes, 0);
assert.equal(slice().lastCompleted, null);
main.save({ name: "Reset Traveler", gender: "male", age: 31 });
engine.flush();
act(engine, "travel:start", journey("loc_0005", 5));
assert.equal(events.started.length, startedBeforeReset + 1, "one started event after reset");
TravelData.chancePercent = 0;
act(engine, "travel:advance", { minutes: 5 });
assert.equal(slice().active, false);

// Save/load keeps an in-flight paused journey and its last event.
TravelData.chancePercent = 100;
act(engine, "travel:start", journey("loc_0006", 20));
act(engine, "travel:advance", { minutes: 5 });
assert.equal(slice().paused, true);
const savedEventId = slice().lastEvent.eventId;
const saved = engine.serialize();
const loadedEngine = new Engine({ seed: 9001 });
const loadedMain = createMainCharacterModule();
const loadedTravel = createTravelModule();
loadedEngine.register(loadedMain);
loadedEngine.register(loadedTravel);
loadedEngine.load(saved);
const loadedSlice = loadedEngine.state.modules.travel;
assert.equal(loadedSlice.active, true);
assert.equal(loadedSlice.paused, true);
assert.equal(loadedSlice.destinationId, "loc_0006");
assert.equal(loadedSlice.elapsedMinutes, 5);
assert.equal(loadedSlice.lastEvent.eventId, savedEventId);
assert.doesNotThrow(() => JSON.parse(JSON.stringify(loadedSlice)));

TravelData.chancePercent = 0;
act(loadedEngine, "travel:continue");
act(loadedEngine, "travel:advance", { minutes: 5 });
act(loadedEngine, "travel:advance", { minutes: 5 });
act(loadedEngine, "travel:advance", { minutes: 5 });
assert.equal(loadedSlice.active, false);
assert.equal(loadedSlice.elapsedMinutes, 20);

for (const file of ["../travel/travel.js", "../travel/data.js"]) {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
}

console.log("travel test passed");
