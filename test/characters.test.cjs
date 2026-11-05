/* Node tests for NPC generation and shared base stats.
   Run: node test/characters.test.cjs */
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../characters/statsData.js");
require("../characters/data.js");
require("../characters/bodyData.js");
require("../characters/body.js");
require("../characters/characters.js");

const STAT_DEFS = CharacterStatsData.stats;
assert.equal(STAT_DEFS.length, 11, "ten base stats plus armor are defined");
assert.equal(new Set(STAT_DEFS.map((def) => def.key)).size, 11, "stat keys are unique");

const BODY_PARTS = CharacterBodyData.parts;
assert.deepEqual(BODY_PARTS.map((part) => part.key), [
  "head", "torso", "leftLeg", "rightLeg", "leftArm", "rightArm",
  "leftHand", "rightHand", "leftFoot", "rightFoot"
], "the body is divided into head, torso, paired legs, arms, hands and feet");
assert.equal(new Set(BODY_PARTS.map((part) => part.key)).size, BODY_PARTS.length, "body part keys are unique");
for (const part of BODY_PARTS) {
  assert.ok(part.label, `${part.key} has a label`);
  assert.ok(["head", "torso", "leg", "arm", "hand", "foot"].includes(part.kind), `${part.key} has a known kind`);
  assert.ok(["center", "left", "right"].includes(part.side), `${part.key} has a known side`);
  assert.ok(part.parent === null || BODY_PARTS.some((other) => other.key === part.parent),
    `${part.key} parent is a body part or null`);
}

const PERSONALITIES = CharacterData.personalities;
const AXES = CharacterData.behaviorAxes;
const RELATIONS = CharacterData.relations;
assert.equal(RELATIONS.bands.length, 6, "relation bands are defined");
assert.ok(RELATIONS.types.some((type) => type.key === "neutral"), "a default relation type exists");
assert.equal(CharacterData.levels.default, 1);
assert.equal(PERSONALITIES.length, 30, "30 NPC personality archetypes are defined");
assert.equal(new Set(PERSONALITIES.map((profile) => profile.id)).size, 30, "personality ids are unique");
assert.equal(new Set(PERSONALITIES.map((profile) => profile.name)).size, 30, "personality names are unique");
assert.ok(Array.isArray(AXES) && AXES.length > 0, "behavior axes are defined");

for (const profile of PERSONALITIES) {
  assert.equal(profile.traits.length, 5, `${profile.id} has five traits`);
  assert.equal(new Set(profile.traits).size, 5, `${profile.id} traits are unique`);
  for (const trait of profile.traits) {
    assert.ok(CharacterData.traits.includes(trait), `${profile.id} trait ${trait} is in the trait pool`);
  }
  for (const [a, b] of CharacterData.opposites) {
    assert.ok(!(profile.traits.includes(a) && profile.traits.includes(b)),
      `${profile.id} does not combine ${a} and ${b}`);
  }
  for (const axis of AXES) {
    const value = profile.behavior[axis.key];
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 100,
      `${profile.id} ${axis.key} is an integer 0-100`);
  }
}

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

function assertBody(body, label, statuses = {}) {
  assert.ok(body && body.parts && typeof body.parts === "object", `${label} has a body`);
  assert.equal(Object.keys(body.parts).length, BODY_PARTS.length, `${label} has every body part`);
  for (const def of BODY_PARTS) {
    const part = body.parts[def.key];
    assert.ok(part, `${label} has ${def.key}`);
    assert.equal(part.key, def.key, `${label} ${def.key} key`);
    assert.equal(part.label, def.label, `${label} ${def.key} label`);
    assert.equal(part.kind, def.kind, `${label} ${def.key} kind`);
    assert.equal(part.side, def.side, `${label} ${def.key} side`);
    assert.equal(part.parent, def.parent, `${label} ${def.key} parent`);
    assert.equal(part.vital, !!def.vital, `${label} ${def.key} vital flag`);
    assert.equal(part.status, statuses[def.key] || CharacterBodyData.defaultStatus,
      `${label} ${def.key} status`);
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
  const firstProfile = PERSONALITIES.find((profile) => profile.id === first.personality.id);
  assert.ok(firstProfile, "the NPC stores a known personality id");
  assert.equal(first.personality.name, firstProfile.name);
  assert.deepEqual(first.traits, firstProfile.traits, "traits come from the personality archetype");
  for (const axis of AXES) {
    assert.ok(Number.isInteger(first.behavior[axis.key]), `NPC behavior has ${axis.key}`);
    assert.ok(first.behavior[axis.key] >= 0 && first.behavior[axis.key] <= 100,
      `NPC behavior ${axis.key} is in range`);
  }
  assertStats(first.stats, "NPC");
  assertBody(first.body, "NPC");
  assert.equal(first.stats.armor, 0, "armor starts at 0");
  assert.deepEqual(first.relation, { value: 0, type: "neutral" }, "NPCs start with a neutral relation");
  assert.equal(first.level, 1, "NPCs start at level 1");
  assert.equal(spawnedEvents[0].data.level, 1);
  assert.deepEqual(spawnedEvents[0].data.relation, { value: 0, type: "neutral" });
  assert.ok(JSON.stringify(first).length > 0, "NPC state is JSON-safe");

  const second = characters.spawn();
  engine.flush();
  assert.equal(second.id, "npc_0002");
  assert.equal(engine.state.modules.characters.nextId, 3);
  assertStats(second.stats, "second NPC");
  assertBody(second.body, "second NPC");

  // Combat damage is applied to the NPC named by the event.
  const hpBeforeCombat = second.stats.hp;
  engine.fire({ type: "combat:damage", data: { targetId: second.id, amount: 5 } });
  engine.flush();
  assert.equal(second.stats.hp, hpBeforeCombat - 5, "combat:damage lowers NPC HP");
  engine.fire({ type: "combat:damage", data: { targetId: second.id, amount: 500 } });
  engine.flush();
  assert.equal(second.stats.hp, 0, "NPC HP clamps at zero");

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
  assertBody(afterReset.body, "NPC after reset");

  // Legacy NPCs without stats get deterministic defaults on load.
  const legacySave = JSON.parse(engine.serialize());
  const legacyNamed = legacySave.modules.characters.named;
  const legacyTemp = legacySave.modules.characters.temp;
  const oldNpc = { ...Object.values(legacyTemp)[0] };
  delete oldNpc.stats;
  delete oldNpc.personality;
  delete oldNpc.behavior;
  delete oldNpc.body;
  delete oldNpc.relation;
  delete oldNpc.level;
  legacyNamed.npc_9001 = oldNpc;
  legacyTemp.npc_9002 = {
    ...oldNpc, id: "npc_9002", name: "Old Timer",
    body: { parts: { head: { status: "scarred" } } }
  };
  delete legacyTemp.npc_9002.stats;
  delete legacyTemp.npc_9002.personality;
  delete legacyTemp.npc_9002.behavior;

  const loaded = makeEngine(123);
  loaded.engine.load(legacySave);
  const migrated = loaded.engine.state.modules.characters.named.npc_9001;
  assertStats(migrated.stats, "legacy NPC");
  assertBody(migrated.body, "legacy NPC");
  assert.equal(migrated.stats.hp, 100);
  assert.equal(migrated.stats.stamina, 100);
  assert.equal(migrated.stats.mana, 50);
  assert.equal(migrated.stats.armor, 0);
  assert.equal(migrated.stats.war, 10);
  assert.equal(migrated.stats.intelligence, 10);
  assert.equal(migrated.traits.length, 5, "legacy personality traits survive");
  assert.ok(migrated.personality && migrated.personality.id, "legacy NPCs get a personality archetype");
  assert.ok(PERSONALITIES.some((profile) => profile.id === migrated.personality.id),
    "the migrated personality id is known");
  for (const axis of AXES) {
    assert.ok(Number.isInteger(migrated.behavior[axis.key]), `legacy NPC behavior has ${axis.key}`);
  }
  assert.deepEqual(migrated.relation, { value: 0, type: "neutral" }, "legacy NPCs get the default relation");
  assert.equal(migrated.level, 1, "legacy NPCs get the default level");

  const partialBody = loaded.engine.state.modules.characters.temp.npc_9002;
  assertBody(partialBody.body, "partial-body NPC", { head: "scarred" });
  assert.equal(partialBody.body.parts.head.status, "scarred", "a saved part status survives migration");

  for (const file of ["../characters/characters.js", "../characters/mainCharacter.js", "../characters/statsData.js"]) {
    const text = require("node:fs").readFileSync(require("node:path").join(__dirname, file), "utf8");
    assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
  }

  console.log("characters test passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
