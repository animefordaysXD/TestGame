/* Node tests for NPC relations and levels. Run: node test/relations.test.cjs */
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

const D = CharacterData;
assert.equal(D.relations.min, -100);
assert.equal(D.relations.max, 100);
assert.equal(D.relations.default, 0);
assert.equal(D.relations.bands.length, 6);
assert.deepEqual(D.relations.bands.map((b) => [b.min, b.max]), [
  [-100, -31], [-30, 0], [1, 20], [21, 40], [41, 60], [61, 100]
], "relation bands cover -100..100 without gaps");
assert.ok(D.relations.bands.at(-1).typeSpecific, "the 61+ band uses the type-specific label");
assert.deepEqual(D.relations.types.map((t) => t.key).slice(0, 4), ["neutral", "ally", "guardian", "merchant"]);
assert.equal(D.levels.default, 1);

function makeEngine(seed = 321) {
  const engine = new Engine({ seed, tickMinutes: 10 });
  const characters = createCharactersModule();
  engine.register(characters);
  return { engine, characters };
}

const { engine, characters } = makeEngine();
const labels = (value, type) => characters.relationFor(value, type);
assert.equal(labels(-100).label, "Hostile");
assert.equal(labels(-31).label, "Hostile");
assert.equal(labels(-30).label, "Unfriendly");
assert.equal(labels(0).label, "Unfriendly");
assert.equal(labels(1).label, "Ambivalent");
assert.equal(labels(20).label, "Ambivalent");
assert.equal(labels(21).label, "Accepting");
assert.equal(labels(40).label, "Accepting");
assert.equal(labels(41).label, "Friendly");
assert.equal(labels(60).label, "Friendly");
assert.equal(labels(61, "neutral").label, "Friendly", "a neutral type keeps the friendly label");
assert.equal(labels(61, "ally").label, "Loving", "the type supplies the 61+ label");
assert.equal(labels(100, "guardian").label, "Protective");
assert.equal(labels(75, "merchant").label, "Trusted");
assert.equal(labels(70, "not_a_type").label, "Friendly", "unknown types fall back to the default type");
assert.equal(labels(-40, "ally").label, "Hostile", "the type only changes the high band");

const spawned = [];
engine.on("event:character:spawned", (event) => spawned.push(event));

const ordinary = characters.spawn();
engine.flush();
assert.equal(ordinary.level, 1, "ordinary NPCs start at level 1");
assert.deepEqual(ordinary.relation, { value: 0, type: "neutral" }, "ordinary NPCs start neutral");
assert.equal(spawned.at(-1).data.level, 1, "character:spawned echoes the level");
assert.deepEqual(spawned.at(-1).data.relation, { value: 0, type: "neutral" });
assert.equal(spawned.at(-1).data.source, "");

const enemy = characters.spawn(0, {
  source: "encounter", level: 7, relation: { value: -66, type: "bandit" },
  locationId: "loc_0001", hostility: 90
});
engine.flush();
assert.equal(enemy.level, 7);
assert.deepEqual(enemy.relation, { value: -66, type: "bandit" });
assert.equal(enemy.source, "encounter");
const enemyEvent = spawned.at(-1).data;
assert.equal(enemyEvent.id, enemy.id);
assert.equal(enemyEvent.source, "encounter");
assert.equal(enemyEvent.level, 7);
assert.equal(enemyEvent.locationId, "loc_0001");
assert.equal(enemyEvent.hostility, 90);
assert.equal(enemyEvent.relationLabel, "Hostile");
assert.equal(enemyEvent.band, "hostile");

assert.equal(characters.levelFor({ level: 250 }), 100, "levels clamp at the data maximum");
assert.equal(characters.levelFor({ level: -5 }), 1, "levels clamp at the data minimum");

// Relation changes are clamped and announced.
const changes = [];
engine.on("event:character:relationChanged", (event) => changes.push(event));
assert.equal(characters.adjustRelation(ordinary.id, -50).value, -50);
engine.flush();
assert.equal(changes.at(-1).data.before, 0);
assert.equal(changes.at(-1).data.after, -50);
assert.equal(changes.at(-1).data.delta, -50);
assert.equal(changes.at(-1).data.band, "hostile");
assert.equal(changes.at(-1).data.label, "Hostile");

assert.equal(characters.adjustRelation(ordinary.id, -500).value, -100, "relations clamp at the minimum");
engine.flush();
assert.equal(changes.at(-1).data.after, -100);
assert.equal(characters.setRelation(ordinary.id, 500, "ally").value, 100, "relations clamp at the maximum");
engine.flush();
assert.equal(changes.at(-1).data.label, "Loving", "the high-band label follows the type");

// Source-filtered clearing leaves ordinary temporary NPCs alone.
characters.spawn(0, { source: "encounter", relation: { value: -40, type: "bandit" } });
engine.flush();
assert.equal(Object.keys(engine.state.modules.characters.temp).length, 3);
characters.clearTemp(0, { source: "encounter" });
engine.flush();
const temp = Object.values(engine.state.modules.characters.temp);
assert.equal(temp.length, 1, "only encounter spawns were cleared");
assert.equal(temp[0].id, ordinary.id);
assert.equal(characters.relationFor(ordinary.relation.value, ordinary.relation.type).label, "Loving");

// Old saves gain a neutral relation and level 1 deterministically.
const saved = JSON.parse(engine.serialize());
const legacy = saved.modules.characters.temp[ordinary.id];
delete legacy.relation;
delete legacy.level;
const loadedWorld = makeEngine(999);
loadedWorld.engine.load(saved);
const migrated = loadedWorld.engine.state.modules.characters.temp[ordinary.id];
assert.deepEqual(migrated.relation, { value: 0, type: "neutral" }, "legacy NPCs get the default relation");
assert.equal(migrated.level, 1, "legacy NPCs get the default level");

// Reset must not duplicate the spawn or relation listeners.
const before = spawned.length;
engine.reset(77);
const afterReset = characters.spawn();
engine.flush();
assert.equal(spawned.length, before + 1);
assert.equal(afterReset.relation.value, 0);

const source = fs.readFileSync(path.join(__dirname, "../characters/characters.js"), "utf8");
assert.ok(!/Math\.random/.test(source), "characters must not use Math.random");

console.log("relations test passed");
