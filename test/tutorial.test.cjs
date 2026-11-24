/* Node tests for the tutorial progress module. Run: node test/tutorial.test.cjs */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../map/data.js");
require("../tutorial/data.js");
require("../tutorial/tutorial.js");

const act = (engine, type, data) => { engine.fire({ type, data }); engine.flush(); };

function buildEngine(seed = 20261124) {
  const engine = new Engine({ startDate: "1000-01-01T06:00:00Z", tickMinutes: 10, seed });
  engine.register(createTutorialModule());
  return engine;
}

assert.deepEqual(TutorialData.steps.map((step) => step.key), ["created", "arrived", "action", "travel"],
  "the tutorial keeps the four expected steps");

const engine = buildEngine();
const tutorial = engine.modules.get("tutorial");
const progressEvents = [];
engine.on("event:tutorial:progress", (e) => progressEvents.push(e));

let progress = tutorial.progress();
assert.equal(progress.done, 0, "a new tutorial starts empty");
assert.equal(progress.total, 4);
assert.equal(progress.complete, false);
assert.deepEqual(progress.steps, { created: false, arrived: false, action: false, travel: false });

act(engine, "creator:created", { name: "Rook Ash" });
progress = tutorial.progress();
assert.equal(progress.steps.created, true, "creator:created marks the character step");
assert.equal(progressEvents.length, 1);
assert.equal(progressEvents[0].depth, 2, "progress is a follow-up event");

// Repeating the same signal does not emit or change anything.
act(engine, "creator:created", { name: "Rook Ash" });
assert.equal(progressEvents.length, 1, "a completed step is idempotent");

act(engine, "location:visited", { id: "loc_0004", name: "Greywatch Village" });
progress = tutorial.progress();
assert.equal(progress.steps.arrived, true, "visiting the starting town marks arrival");
assert.equal(progress.steps.travel, false, "arriving in the village is not the tavern step");

act(engine, "action:resolved", { actionId: "scout" });
progress = tutorial.progress();
assert.equal(progress.steps.action, true, "resolving an action marks the action step");

act(engine, "travel:completed", { destinationName: "Greywatch Castle" });
progress = tutorial.progress();
assert.equal(progress.steps.travel, false, "traveling elsewhere does not finish the tavern step");

act(engine, "travel:completed", { destinationName: "The Broken Wheel" });
progress = tutorial.progress();
assert.equal(progress.steps.travel, true, "traveling to the tavern finishes the tutorial");
assert.equal(progress.done, 4);
assert.equal(progress.total, 4);
assert.equal(progress.complete, true);
assert.equal(progress.completedAtTick, engine.now.tick, "completion tick is stored");
assert.equal(progressEvents.at(-1).data.completed, true);
assert.match(progressEvents.at(-1).text, /Tutorial complete/);

const defs = tutorial.steps();
assert.equal(defs[1].label, "Arrive in Greywatch Village", "step labels fill in the start town");
assert.equal(defs[3].label, "Travel to The Broken Wheel", "step labels fill in the tavern name");
assert.ok(defs[3].hint.includes("The Broken Wheel"), "hints fill in the tavern name");

// A direct visit to the tavern also counts as reaching it.
const direct = buildEngine();
act(direct, "location:visited", { name: "The Broken Wheel" });
assert.equal(direct.modules.get("tutorial").progress().steps.travel, true);

// ----- save/load -----
const saved = engine.serialize();
const loaded = buildEngine(1);
loaded.load(saved);
const loadedProgress = loaded.modules.get("tutorial").progress();
assert.equal(loadedProgress.complete, true, "loaded saves keep tutorial progress");
assert.deepEqual(loadedProgress.steps, progress.steps);

// ----- reset -----
engine.reset(777);
const fresh = tutorial.progress();
assert.equal(fresh.done, 0, "reset clears tutorial progress");
assert.deepEqual(fresh.steps, { created: false, arrived: false, action: false, travel: false });
const before = progressEvents.length;
act(engine, "location:visited", { name: "Greywatch Village" });
assert.equal(progressEvents.length, before + 1, "reset keeps one subscription, not two");

for (const file of ["../tutorial/tutorial.js", "../tutorial/data.js"]) {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
}

console.log("tutorial test passed");
