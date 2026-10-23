/* Node tests for NPC generation and shared base stats.
   Run: node test/characters.test.cjs */
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../characters/statsData.js");
require("../characters/data.js");
require("../characters/characters.js");

const STAT_DEFS = CharacterStatsData.stats;
assert.equal(STAT_DEFS.length, 9, "nine base stats are defined");
assert.equal(new Set(STAT_DEFS.map((def) => def.key)).size, 9, "stat keys are unique");

function assertStats(stats, label) {
  assert.ok(stats && typeof stats === "object", `${label} has a stats block`);
  for (const def of STAT_DEFS) {
    const value = stats[def.key];
    assert.ok(Number.isInteger(value), `${label} ${def.key} is an integer`);
    assert.ok(value >= def.min && value <= def.max, `${label} ${def.key} is in range`);
    if (def.kind === "resource") {
      assert.equal(stats[def.key + "Max"], def.max, `${label} ${def.key}Max matches the definition`);
      assert.ok(value <= stats[def.key + "Max"], `${label} ${def.key} does not exceed its max`);
    }
  }
}

function makeEngine(seed) {
  const engine = new Engine({ seed, tickMinutes: 10 });
  const characters = createCharactersModule();
  engine.register(characters);
  return { engine, characters };
}

(async () => {
  const { engine, characters } = makeEngine(4242);
  assert.equal(engine.generators.size, 0, "characters registers no tick generators");
  assert.deepEqual(engine.state.modules.characters, { nextId: 1, named: {}, temp: {} });

  const spawnedEvents = [];
  engine.on("event:character:spawned", (event) => spawnedEvents.push(event));

  const first = characters.spawn();
  engine.flush();
  assert.equal(first.id, "npc_0001");
  assert.equal(spawnedEvents.length, 1);
  assert.equal(spawnedEvents[0].data.id, first.id);
  assert.equal(first.traits.length, 5, "personality traits are still generated");
  assert.equal(new Set(first.traits).size, 5, "traits are unique");
  assertStats(first.stats, "NPC");
  assert.ok(JSON.stringify(first).length > 0, "NPC state is JSON-safe");

  const second = characters.spawn();
  engine.flush();
  assert.equal(second.id, "npc_0002");
  assert.equal(engine.state.modules.characters.nextId, 3);
  assertStats(second.stats, "second NPC");

  // Same seed and same calls produce the same character, including stats.
  const replay = makeEngine(4242);
  const replayFirst = replay.characters.spawn();
  replay.engine.flush();
  assert.deepEqual(replayFirst, first, "generation is deterministic for a seed");

  // Saving moves the NPC out of Temporary Spawn; clearing removes the rest.
  characters.save(first.id);
  engine.flush();
  assert.equal(engine.state.modules.characters.named[first.id], first);
  assert.equal(engine.state.modules.characters.temp[first.id], undefined);

  const third = characters.spawn();
  engine.flush();
  const cleared = [];
  engine.on("event:character:tempCleared", (event) => cleared.push(event));
  characters.clearTemp();
  engine.flush();
  assert.deepEqual(engine.state.modules.characters.temp, {});
  assert.deepEqual(cleared.at(-1).data.ids, [second.id, third.id]);

  // Reset keeps one subscription and clears the slice.
  const beforeReset = spawnedEvents.length;
  engine.reset(777);
  assert.deepEqual(engine.state.modules.characters, { nextId: 1, named: {}, temp: {} });
  const afterReset = characters.spawn();
  engine.flush();
  assert.equal(spawnedEvents.length, beforeReset + 1, "spawn subscription is not duplicated");
  assert.equal(afterReset.id, "npc_0001");
  assertStats(afterReset.stats, "NPC after reset");

  // Legacy NPCs without stats get deterministic defaults on load.
  const legacySave = JSON.parse(engine.serialize());
  const legacyNamed = legacySave.modules.characters.named;
  const legacyTemp = legacySave.modules.characters.temp;
  const oldNpc = { ...Object.values(legacyTemp)[0] };
  delete oldNpc.stats;
  legacyNamed.npc_9001 = oldNpc;
  legacyTemp.npc_9002 = { ...oldNpc, id: "npc_9002", name: "Old Timer" };
  delete legacyTemp.npc_9002.stats;

  const loaded = makeEngine(123);
  loaded.engine.load(legacySave);
  const migrated = loaded.engine.state.modules.characters.named.npc_9001;
  assertStats(migrated.stats, "legacy NPC");
  assert.equal(migrated.stats.hp, 100);
  assert.equal(migrated.stats.stamina, 100);
  assert.equal(migrated.stats.mana, 50);
  assert.equal(migrated.stats.war, 10);
  assert.equal(migrated.stats.intelligence, 10);
  assert.equal(migrated.traits.length, 5, "legacy personality traits survive");

  for (const file of ["../characters/characters.js", "../characters/mainCharacter.js", "../characters/statsData.js"]) {
    const text = require("node:fs").readFileSync(require("node:path").join(__dirname, file), "utf8");
    assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
  }

  console.log("characters test passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
