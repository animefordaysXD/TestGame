/* Node tests for the game journal module. Run: node test/game.test.cjs */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../map/data.js");
require("../game/data.js");
require("../game/game.js");

const act = (engine, type, data) => { engine.fire({ type, data }); engine.flush(); };

function buildEngine(seed = 20261124) {
  const engine = new Engine({ startDate: "1000-01-01T06:00:00Z", tickMinutes: 10, seed });
  engine.register(createGameModule());
  return engine;
}

assert.deepEqual(GameData.objectives.map((entry) => entry.key), ["arrive", "look", "road", "fight", "tavern"],
  "the journal keeps the expected objectives");

const engine = buildEngine();
const game = engine.modules.get("game");
const progressEvents = [];
engine.on("event:game:progress", (e) => progressEvents.push(e));

let progress = game.progress();
assert.equal(progress.total, 5);
assert.equal(progress.done, 0, "a new journal is empty");
assert.equal(progress.started, false);

act(engine, "creator:created", { name: "Rook Ash" });
progress = game.progress();
assert.equal(progress.started, true, "character creation starts the journal");
assert.equal(progressEvents.length, 1);
assert.equal(progressEvents[0].data.event, "started");

act(engine, "location:visited", { id: "loc_0004", name: "Greywatch Village" });
progress = game.progress();
assert.equal(progress.objectives[0].done, true, "arriving in the village completes the first objective");
assert.equal(progress.visited, 1);
assert.equal(progress.done, 1);

act(engine, "action:resolved", { actionId: "scout" });
progress = game.progress();
assert.equal(progress.objectives[1].done, true, "an area action completes the action objective");
assert.equal(progress.actions, 1);

// The tavern objective is gated behind the fight objective.
act(engine, "location:visited", { name: "The Broken Wheel" });
progress = game.progress();
assert.equal(progress.objectives[4].done, false, "the tavern wait is not skipped");
assert.equal(progress.visited, 2);

act(engine, "location:visited", { name: "Old Stone Road" });
progress = game.progress();
assert.equal(progress.objectives[2].done, true, "visiting the old road completes the road objective");
assert.equal(progress.done, 3);

act(engine, "combat:ended", { winnerId: "main", loserId: "npc_0001" });
progress = game.progress();
assert.equal(progress.objectives[3].done, true, "a win completes the fight objective");
assert.equal(progress.victories, 1);
assert.equal(progress.done, 4);

act(engine, "location:visited", { name: "The Broken Wheel" });
progress = game.progress();
assert.equal(progress.objectives[4].done, true, "returning to the tavern finishes the journal");
assert.equal(progress.done, 5);
assert.equal(progress.complete, true);
assert.equal(progress.completedAtTick, engine.now.tick);
assert.equal(progressEvents.at(-1).data.event, "complete");
assert.match(progressEvents.at(-1).text, /Journal:/);

const objectives = game.objectives();
assert.match(objectives[0].label, /Greywatch Village/, "the start token is filled in");
assert.match(objectives[2].hint, /Old Stone Road/, "the site token is filled in hints");
assert.match(objectives[4].label, /Broken Wheel/, "the tavern token is filled in");

// Duplicate events do not double-count the journal.
const before = progressEvents.length;
act(engine, "location:visited", { name: "Greywatch Village" });
assert.equal(progressEvents.length, before, "completed objectives do not re-fire");

// A fight won before the road objective does not count for the later fight objective.
const earlyFight = buildEngine();
act(earlyFight, "creator:created", {});
act(earlyFight, "action:resolved", {});
act(earlyFight, "combat:ended", { winnerId: "main", loserId: "npc_0001" });
act(earlyFight, "location:visited", { name: "Old Stone Road" });
let early = earlyFight.modules.get("game").progress();
assert.equal(early.objectives[2].done, true, "the road objective completes");
assert.equal(early.objectives[3].done, false, "an earlier victory does not satisfy the later fight objective");
act(earlyFight, "combat:ended", { winnerId: "main", loserId: "npc_0002" });
early = earlyFight.modules.get("game").progress();
assert.equal(early.objectives[3].done, true, "a new victory after the road completes the fight objective");

// A defeat is recorded but does not complete the victory objective.
const second = buildEngine();
act(second, "combat:ended", { winnerId: "npc_0001", loserId: "main" });
const defeated = second.modules.get("game").progress();
assert.equal(defeated.defeats, 1);
assert.equal(defeated.victories, 0);
assert.equal(defeated.objectives[3].done, false);

// ----- save/load -----
const saved = engine.serialize();
const loaded = buildEngine(1);
loaded.load(saved);
const loadedProgress = loaded.modules.get("game").progress();
assert.equal(loadedProgress.complete, true, "loaded saves keep journal progress");
assert.equal(loadedProgress.visited, 3, "visited sites are saved");
assert.equal(loadedProgress.victories, 1);

// ----- reset -----
engine.reset(777);
const fresh = game.progress();
assert.equal(fresh.done, 0, "reset clears journal progress");
assert.equal(fresh.started, false);
assert.deepEqual(fresh.objectives.map((objective) => objective.done), [false, false, false, false, false]);

for (const file of ["../game/game.js", "../game/data.js"]) {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
}

console.log("game test passed");
