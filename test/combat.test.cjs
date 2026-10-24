/* Node tests for the basic combat module.
   Run: node test/combat.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
require("../engine.js");
require("../characters/statsData.js");
require("../characters/data.js");
require("../characters/characters.js");
require("../characters/mainCharacterData.js");
require("../characters/mainCharacter.js");
require("../combat/data.js");
require("../combat/combat.js");

const snap = (character) => ({
  id: character.id,
  name: character.name,
  hp: character.stats.hp,
  hpMax: character.stats.hpMax,
  personalCombat: character.stats.personalCombat,
  armor: character.stats.armor
});

function makeWorld(seed) {
  const engine = new Engine({ seed, tickMinutes: 10 });
  const main = createMainCharacterModule();
  const chars = createCharactersModule();
  const combat = createCombatModule();
  engine.register(main);
  engine.register(chars);
  engine.register(combat);

  const player = main.save({ name: "Test Hero", gender: "female", age: 25 });
  engine.flush();
  const npc = chars.spawn();
  engine.flush();

  const events = [];
  for (const type of ["combat:started", "combat:damage", "combat:defended", "combat:ended"])
    engine.on(`event:${type}`, (event) => events.push(event));

  return { engine, main, chars, combat, player, npc, events };
}

function prepare(world, options = {}) {
  const {
    playerHp = 100, playerArmor = 0, playerPc = 10,
    enemyHp = 100, enemyArmor = 0, enemyPc = 8
  } = options;

  world.player.stats.hp = playerHp;
  world.player.stats.hpMax = 100;
  world.player.stats.personalCombat = playerPc;
  world.player.stats.armor = playerArmor;

  world.npc.stats.hp = enemyHp;
  world.npc.stats.hpMax = 100;
  world.npc.stats.personalCombat = enemyPc;
  world.npc.stats.armor = enemyArmor;

  world.engine.fire({
    type: "combat:start",
    data: { player: snap(world.player), enemy: snap(world.npc) }
  });
  world.engine.flush();
}

function state(world) { return world.engine.state.modules.combat; }

(async () => {
  // Basic round: player attacks first, then the enemy counterattacks.
  const world = makeWorld(1001);
  prepare(world);
  const s = state(world);

  assert.equal(s.active, true);
  assert.equal(s.round, 1);
  assert.equal(s.turn, "player", "the player always moves first");
  assert.equal(world.events.filter((event) => event.type === "combat:started").length, 1);
  assert.equal(world.events[0].depth, 1);

  world.engine.fire({ type: "combat:action", data: { action: "attack" } });
  world.engine.flush();

  assert.equal(s.enemy.hp, 90, "player damage equals Personal Combat");
  assert.equal(world.npc.stats.hp, 90, "the NPC slice receives the damage");
  assert.equal(s.player.hp, 92, "the enemy counterattacks with its Personal Combat");
  assert.equal(world.player.stats.hp, 92, "the main character slice receives the damage");
  assert.equal(s.round, 2);
  assert.equal(s.turn, "player");

  const damage = world.events.filter((event) => event.type === "combat:damage");
  assert.equal(damage.length, 2);
  assert.equal(damage[0].data.amount, 10);
  assert.equal(damage[0].data.targetId, world.npc.id);
  assert.equal(damage[0].depth, 1);
  assert.equal(damage[1].data.amount, 8);
  assert.equal(damage[1].data.targetId, "main");
  assert.equal(damage[1].depth, 2);

  // Defend consumes the next enemy attack; with armor 0 it reduces nothing.
  const hpBeforeDefend = world.player.stats.hp;
  world.engine.fire({ type: "combat:action", data: { action: "defend" } });
  world.engine.flush();
  assert.equal(world.player.stats.hp, hpBeforeDefend - 8);
  assert.equal(s.round, 3);
  assert.equal(s.turn, "player");
  assert.equal(s.defending, false);
  assert.equal(world.events.filter((event) => event.type === "combat:defended").length, 1);

  // The provisional defend formula: damage - armor * 2, clamped at zero.
  const armored = makeWorld(1002);
  prepare(armored, { playerArmor: 3, enemyPc: 8 });
  armored.engine.fire({ type: "combat:action", data: { action: "defend" } });
  armored.engine.flush();
  assert.equal(armored.player.stats.hp, 98, "3 armor blocks 6 of 8 damage");
  const armoredHit = armored.events.filter((event) => event.type === "combat:damage").at(-1);
  assert.equal(armoredHit.data.amount, 2);
  assert.equal(armoredHit.data.reduction, 6);
  assert.equal(armoredHit.data.defended, true);

  // Player-first lethal hit ends combat before the enemy can retaliate.
  const lethal = makeWorld(1003);
  prepare(lethal, { enemyHp: 10, enemyPc: 8 });
  const playerHpBeforeKill = lethal.player.stats.hp;
  lethal.engine.fire({ type: "combat:action", data: { action: "attack" } });
  lethal.engine.flush();
  assert.equal(lethal.npc.stats.hp, 0);
  assert.equal(lethal.player.stats.hp, playerHpBeforeKill, "a dead enemy does not counterattack");
  assert.equal(state(lethal).active, false);
  assert.equal(state(lethal).winnerId, "main");
  assert.equal(state(lethal).round, 1);
  assert.equal(lethal.events.filter((event) => event.type === "combat:ended").length, 1);

  // Enemy lethal hit ends combat with the NPC as winner.
  const defeat = makeWorld(1004);
  prepare(defeat, { playerHp: 5, enemyPc: 8, enemyHp: 100 });
  defeat.engine.fire({ type: "combat:action", data: { action: "attack" } });
  defeat.engine.flush();
  assert.equal(defeat.player.stats.hp, 0);
  assert.equal(state(defeat).active, false);
  assert.equal(state(defeat).winnerId, defeat.npc.id);
  assert.equal(state(defeat).winnerName, defeat.npc.name);

  // Invalid starts and actions are ignored.
  const invalid = makeWorld(1005);
  const beforeInvalid = invalid.events.length;
  invalid.engine.fire({ type: "combat:action", data: { action: "attack" } });
  invalid.engine.flush();
  assert.equal(invalid.events.length, beforeInvalid, "actions before combat are ignored");

  invalid.player.stats.hp = 0;
  invalid.engine.fire({
    type: "combat:start",
    data: { player: snap(invalid.player), enemy: snap(invalid.npc) }
  });
  invalid.engine.flush();
  assert.equal(state(invalid).active, false, "a dead combatant cannot start a fight");

  prepare(invalid);
  const roundBeforeRepeat = state(invalid).round;
  invalid.engine.fire({
    type: "combat:start",
    data: { player: snap(invalid.player), enemy: snap(invalid.npc) }
  });
  invalid.engine.flush();
  assert.equal(state(invalid).round, roundBeforeRepeat, "starting again mid-combat is ignored");

  const enemyHpBeforeUnknown = state(invalid).enemy.hp;
  invalid.engine.fire({ type: "combat:action", data: { action: "flee" } });
  invalid.engine.flush();
  assert.equal(state(invalid).enemy.hp, enemyHpBeforeUnknown, "unknown actions are ignored");

  // Combat state survives save/load, and damage still reaches loaded characters.
  const loaded = makeWorld(1006);
  prepare(loaded, { enemyHp: 30, enemyPc: 8 });
  loaded.engine.fire({ type: "combat:action", data: { action: "attack" } });
  loaded.engine.flush();

  const saved = loaded.engine.serialize();
  const reloaded = makeWorld(1007);
  reloaded.engine.load(saved);
  const loadedState = reloaded.engine.state;
  assert.equal(loadedState.modules.combat.active, true);
  assert.equal(loadedState.modules.combat.player.hp, 92);
  assert.equal(loadedState.modules.combat.enemy.hp, 20);
  const loadedNpc = Object.values(loadedState.modules.characters.temp)[0];
  assert.equal(loadedNpc.stats.hp, 20);

  reloaded.engine.fire({ type: "combat:action", data: { action: "attack" } });
  reloaded.engine.flush();
  assert.equal(loadedState.modules.combat.enemy.hp, 10);
  assert.equal(loadedNpc.stats.hp, 10);

  // Reset clears combat and does not duplicate subscriptions.
  const beforeResetDamage = reloaded.events.filter((event) => event.type === "combat:damage").length;
  reloaded.engine.reset(777);
  assert.deepEqual(reloaded.engine.state.modules.combat, {
    active: false, round: 0, turn: null, player: null, enemy: null, defending: false,
    winnerId: null, winnerName: "", loserId: null, loserName: "",
    startedAtTick: null, startedAt: "", endedAtTick: null, endedAt: "", log: []
  });
  assert.equal(reloaded.engine.state.modules.mainCharacter.character, null, "reset clears the main character");
  assert.deepEqual(reloaded.engine.state.modules.characters.temp, {}, "reset clears temporary NPCs");

  const resetPlayer = reloaded.main.save({ name: "After Reset", gender: "female", age: 25 });
  reloaded.engine.flush();
  const resetNpc = reloaded.chars.spawn();
  reloaded.engine.flush();
  reloaded.player = resetPlayer;
  reloaded.npc = resetNpc;

  prepare(reloaded, { enemyHp: 100, enemyPc: 8 });
  reloaded.engine.fire({ type: "combat:action", data: { action: "attack" } });
  reloaded.engine.flush();
  assert.equal(state(reloaded).enemy.hp, 90, "combat resolves once after reset");
  assert.equal(resetNpc.stats.hp, 90, "damage reaches the new NPC");
  assert.equal(reloaded.events.filter((event) => event.type === "combat:damage").length,
    beforeResetDamage + 2, "one player attack and one enemy counter after reset");

  for (const file of ["../combat/combat.js", "../combat/data.js"]) {
    const text = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
  }

  console.log("combat test passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
