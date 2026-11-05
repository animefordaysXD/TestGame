/* Node tests for hostility-driven encounters and loot. Run: node test/encounters.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
require("../engine.js");
require("../characters/statsData.js");
require("../characters/data.js");
require("../characters/bodyData.js");
require("../characters/body.js");
require("../characters/characters.js");
require("../equipment/data.js");
require("../equipment/equipment.js");
require("../encounters/data.js");
require("../encounters/encounters.js");

const act = (engine, type, data) => { engine.fire({ type, data }); engine.flush(); };

assert.ok(EncounterData.spawn.bands.length >= 5);
assert.ok(EncounterData.loot.rarityBands.length >= 4);

const engine = new Engine({ seed: 4242, tickMinutes: 10 });
const characters = createCharactersModule();
const equipment = createEquipmentModule();
const encounters = createEncountersModule();
engine.register(characters);
engine.register(equipment);
engine.register(encounters);

assert.equal(encounters.spawnBandFor(10).key, "safe");
assert.equal(encounters.spawnBandFor(50).key, "unsettled");
assert.equal(encounters.spawnBandFor(100).key, "deadly");
assert.ok(encounters.spawnBandFor(100).chancePercent > encounters.spawnBandFor(10).chancePercent,
  "higher hostility is more likely to spawn an encounter");
assert.ok(encounters.spawnBandFor(100).maxCount > encounters.spawnBandFor(30).maxCount,
  "higher hostility can spawn more enemies");

const calmRelation = encounters.relationFor(20).value;
const deadlyRelation = encounters.relationFor(100).value;
assert.ok(deadlyRelation < calmRelation, "higher hostility lowers enemy relation");
assert.equal(encounters.relationFor(100).value, -100);
assert.equal(encounters.relationFor(100).type, "bandit");
assert.ok(encounters.enemyLevelFor(1, 100) > encounters.enemyLevelFor(1, 50), "higher hostility raises enemy level");
assert.ok(encounters.dropChanceFor(100) > encounters.dropChanceFor(10), "higher hostility raises the drop chance");
assert.deepEqual(encounters.lootBandFor(10).rarities, ["common"]);
assert.ok(encounters.lootBandFor(100).rarities.includes("unique"), "deadly loot can be unique");
assert.ok(encounters.lootBandFor(65).rarities.includes("rare"));

const spawned = [], loot = [];
engine.on("event:character:spawned", (event) => spawned.push(event));
engine.on("event:equipment:added", (event) => loot.push(event));

const originalNext = engine.rng.next;
function stubRolls(values) {
  const queue = values.slice();
  engine.rng.next = () => (queue.length ? queue.shift() : 0);
}
function restoreRolls() { engine.rng.next = originalNext; }

// A deadly visit always spawns 2+ enemies; the first two rolls are the spawn roll and count.
stubRolls([0, 0]);
act(engine, "location:visited", { id: "loc_9001", name: "Ash Scar", hostility: 100, level: 5 });
restoreRolls();

let spawnedEnemies = spawned.filter((event) => event.data.source === "encounter");
assert.equal(spawnedEnemies.length, 2, "the deadly band starts with two enemies");
assert.equal(encounters.enemiesFor("loc_9001").length, 2, "spawned enemies are mapped to the encounter slice");
for (const event of spawnedEnemies) {
  assert.equal(event.data.level, 7, "level 5 location at hostility 100 gives level 7 enemies");
  assert.ok(event.data.relation.value <= -31, "encounter enemies are hostile");
  assert.equal(event.data.relation.type, "bandit");
  assert.equal(event.data.hostility, 100);
}
const lastVisit = encounters.lastVisit();
assert.equal(lastVisit.triggered, true);
assert.equal(lastVisit.chancePercent, 75);
assert.equal(lastVisit.count, 2);

// An ordinary spawn is not an encounter and is not cleared by the next visit.
const ordinary = characters.spawn();
engine.flush();
assert.equal(ordinary.source, "");

// A quiet visit clears only encounter spawns and brings no new enemies.
stubRolls([0.99]);
act(engine, "location:visited", { id: "loc_9002", name: "Safe Meadow", hostility: 10, level: 1 });
restoreRolls();
const temp = Object.values(engine.state.modules.characters.temp);
assert.equal(temp.length, 1, "the old encounter enemies left");
assert.equal(temp[0].id, ordinary.id, "ordinary temporary NPCs stay");
assert.equal(encounters.enemiesFor().length, 0, "the encounter map is empty");
assert.equal(encounters.lastVisit().triggered, false);

// A winning combat awards loot and removes the enemy from the encounter map.
stubRolls([0, 0]);
act(engine, "location:visited", { id: "loc_9003", name: "Ruin", hostility: 70, level: 2 });
restoreRolls();
spawnedEnemies = spawned.filter((event) => event.data.source === "encounter");
const defeated = spawnedEnemies.at(-1).data;
const enemyBefore = encounters.enemiesFor().length;
assert.equal(enemyBefore, 1, "the dangerous band spawned one enemy");

stubRolls([0, 0, 0]);   // drop roll, kind, rarity
act(engine, "combat:ended", { winnerId: "main", loserId: defeated.id, winnerName: "Hero", loserName: defeated.name, rounds: 3 });
restoreRolls();
assert.equal(encounters.enemiesFor().length, 0, "a defeated enemy leaves the encounter map");
assert.equal(loot.length, 1, "one item dropped");
assert.equal(loot[0].data.source, "loot");
assert.equal(loot[0].data.kind, "armor");
assert.equal(loot[0].data.rarity, "rare", "hostility 70 rolls rare/legendary");
const recorded = encounters.lastLoot();
assert.equal(recorded.awarded, true);
assert.equal(recorded.enemyId, defeated.id);

// Losing to an enemy never awards loot.
stubRolls([0, 0]);
act(engine, "location:visited", { id: "loc_9004", name: "Watch", hostility: 60, level: 2 });
restoreRolls();
const another = encounters.enemiesFor().at(-1);
const lootBefore = loot.length;
act(engine, "combat:ended", { winnerId: another.id, loserId: "main", winnerName: another.name, loserName: "Hero", rounds: 1 });
assert.equal(loot.length, lootBefore, "the player must win to loot");
assert.equal(encounters.enemiesFor()[0].id, another.id, "the enemy stays until the player wins");

// The next visit clears the remaining encounter enemy.
stubRolls([0.99]);
act(engine, "location:visited", { id: "loc_9005", name: "Quiet", hostility: 10, level: 1 });
restoreRolls();
assert.equal(encounters.enemiesFor().length, 0);

// Reset re-initialises the slice and does not duplicate subscriptions.
engine.reset(99);
assert.deepEqual(engine.state.modules.encounters, { enemies: {}, lastVisit: null, lastLoot: null });
const beforeResetSpawns = spawned.length;
stubRolls([0, 0]);
act(engine, "location:visited", { id: "loc_9006", name: "New World", hostility: 100, level: 1 });
restoreRolls();
assert.equal(spawned.length, beforeResetSpawns + 2, "one visit still spawns once after reset");

// Encounter enemies and loot survive a save/load round-trip.
const saved = engine.serialize();
const engine2 = new Engine({ seed: 1, tickMinutes: 10 });
engine2.register(createCharactersModule());
engine2.register(createEquipmentModule());
engine2.register(createEncountersModule());
engine2.load(saved);
assert.equal(engine2.state.modules.encounters.enemies && Object.keys(engine2.state.modules.encounters.enemies).length, 2,
  "the encounter map survives save/load");

for (const file of ["../encounters/encounters.js", "../encounters/data.js"]) {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
}

console.log("encounters test passed");
