/* Node tests for the equipment module and its armor bridge to the main character.
   Run: node test/equipment.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
require("../engine.js");
require("../characters/statsData.js");
require("../characters/mainCharacterData.js");
require("../characters/mainCharacter.js");
require("../equipment/data.js");
require("../equipment/equipment.js");
require("../combat/data.js");
require("../combat/combat.js");

const act = (engine, type, data) => { engine.fire({ type, data }); engine.flush(); };

function makeWorld(seed) {
  const engine = new Engine({ seed, tickMinutes: 10 });
  const main = createMainCharacterModule();
  const equipment = createEquipmentModule();
  engine.register(main);
  engine.register(equipment);
  const character = main.save({ name: "Armor Tester", gender: "female", age: 28 });
  engine.flush();
  return { engine, main, equipment, character };
}

const added = [], equipped = [], unequipped = [], armorChanges = [];
function watch(engine) {
  engine.on("event:equipment:added", (e) => added.push(e));
  engine.on("event:equipment:equipped", (e) => equipped.push(e));
  engine.on("event:equipment:unequipped", (e) => unequipped.push(e));
  engine.on("event:mainCharacter:armorChanged", (e) => armorChanges.push(e));
}

const { engine, main, equipment, character } = makeWorld(3001);
watch(engine);
const slice = () => engine.state.modules.equipment;

assert.deepEqual(slice(), { nextId: 1, items: {}, equippedId: null });
assert.equal(equipment.totalArmor(), 0);

// The first item is equipped automatically and the armor stat follows it.
act(engine, "equipment:add", { key: "leather_cuirass" });
assert.equal(Object.keys(slice().items).length, 1);
const cuirass = Object.values(slice().items)[0];
assert.equal(cuirass.key, "leather_cuirass");
assert.equal(cuirass.armor, 3);
assert.equal(cuirass.equipped, true);
assert.equal(slice().equippedId, cuirass.id);
assert.equal(character.stats.armor, 3, "equipment writes the main character's armor stat");
assert.equal(added.length, 1);
assert.equal(added[0].depth, 1, "equipment:added is a follow-up");
assert.equal(added[0].data.equipped, true);
assert.equal(equipped.length, 1);
assert.equal(equipped[0].depth, 1);
assert.equal(equipped[0].data.totalArmor, 3);
assert.equal(armorChanges.length, 1);
assert.equal(armorChanges[0].depth, 2, "armorChanged is a follow-up to equipment:equipped");
assert.equal(armorChanges[0].data.value, 3);
assert.equal(armorChanges[0].data.itemId, cuirass.id);

// A second item stays in the inventory while something is already worn.
act(engine, "equipment:add", { key: "padded_gambeson" });
const gambeson = Object.values(slice().items).find((item) => item.key === "padded_gambeson");
assert.equal(gambeson.equipped, false);
assert.equal(slice().equippedId, cuirass.id);
assert.equal(character.stats.armor, 3);
assert.equal(equipped.length, 1, "no equip event for an inventory item");

// Equipping a different item swaps the armor value.
act(engine, "equipment:equip", { itemId: gambeson.id });
assert.equal(slice().equippedId, gambeson.id);
assert.equal(slice().items[cuirass.id].equipped, false);
assert.equal(character.stats.armor, 2);
assert.equal(equipped.length, 2);
assert.equal(equipped[1].data.previousItemId, cuirass.id);
assert.equal(armorChanges.at(-1).data.previous, 3);
assert.equal(armorChanges.at(-1).data.value, 2);

// Equipping the same item again is a no-op.
act(engine, "equipment:equip", { itemId: gambeson.id });
assert.equal(equipped.length, 2);

// Unequipping sets armor back to zero.
act(engine, "equipment:unequip");
assert.equal(slice().equippedId, null);
assert.equal(slice().items[gambeson.id].equipped, false);
assert.equal(character.stats.armor, 0);
assert.equal(unequipped.length, 1);
assert.equal(unequipped[0].depth, 1);
assert.equal(armorChanges.at(-1).data.value, 0);

// Unknown items and catalogue keys are ignored.
const beforeInvalid = Object.keys(slice().items).length;
act(engine, "equipment:equip", { itemId: "eq_9999" });
act(engine, "equipment:add", { key: "not_a_real_item" });
assert.equal(Object.keys(slice().items).length, beforeInvalid);
assert.equal(slice().equippedId, null);

// Without a key, add() picks from the catalogue with engine.rng.
act(engine, "equipment:add");
assert.equal(Object.keys(slice().items).length, beforeInvalid + 1);
const randomItem = Object.values(slice().items).at(-1);
assert.ok(EquipmentData.items.some((item) => item.key === randomItem.key));
assert.equal(randomItem.equipped, true, "the first free slot auto-equips");
assert.ok(character.stats.armor >= 1);

// End-to-end: equipped armor makes Defend reduce real combat damage.
const fight = new Engine({ seed: 3002, tickMinutes: 10 });
const fightMain = createMainCharacterModule();
const fightGear = createEquipmentModule();
const combat = createCombatModule();
fight.register(fightMain);
fight.register(fightGear);
fight.register(combat);
const hero = fightMain.save({ name: "Shield Bearer", gender: "male", age: 30 });
fight.flush();
act(fight, "equipment:add", { key: "chain_shirt" });
assert.equal(hero.stats.armor, 4);

fight.fire({
  type: "combat:start",
  data: {
    player: {
      id: "main", name: hero.name, hp: hero.stats.hp, hpMax: hero.stats.hpMax,
      personalCombat: hero.stats.personalCombat, armor: hero.stats.armor
    },
    enemy: { id: "npc_test", name: "Dummy", hp: 100, hpMax: 100, personalCombat: 8, armor: 0 }
  }
});
fight.flush();
fight.fire({ type: "combat:action", data: { action: "defend" } });
fight.flush();
assert.equal(hero.stats.hp, 100, "4 armor blocks all 8 damage while defending");
const hit = fight.state.eventLog.filter((event) => event.type === "combat:damage").at(-1);
assert.equal(hit.data.reduction, 8);
assert.equal(hit.data.amount, 0);

// Reset clears the slice without duplicating subscriptions.
const addedBeforeReset = added.length;
engine.reset(4001);
assert.deepEqual(slice(), { nextId: 1, items: {}, equippedId: null });
assert.equal(equipment.totalArmor(), 0);
main.save({ name: "After Reset", gender: "female", age: 22 });
engine.flush();
act(engine, "equipment:add", { key: "traveler_cloak" });
assert.equal(engine.state.modules.mainCharacter.character.stats.armor, 1);
assert.equal(added.length, addedBeforeReset + 1, "one added event after reset");

// Save/load keeps the inventory, the equipped item and the armor stat.
const saved = engine.serialize();
const loadedEngine = new Engine({ seed: 5001 });
const loadedMain = createMainCharacterModule();
const loadedGear = createEquipmentModule();
loadedEngine.register(loadedMain);
loadedEngine.register(loadedGear);
loadedEngine.load(saved);
const loadedSlice = loadedEngine.state.modules.equipment;
assert.equal(Object.keys(loadedSlice.items).length, 1);
assert.equal(loadedSlice.equippedId, Object.values(loadedSlice.items)[0].id);
assert.equal(loadedEngine.state.modules.mainCharacter.character.stats.armor, 1);
assert.equal(loadedGear.totalArmor(), 1);
assert.doesNotThrow(() => JSON.parse(JSON.stringify(loadedSlice)));

act(loadedEngine, "equipment:unequip");
assert.equal(loadedEngine.state.modules.mainCharacter.character.stats.armor, 0);

for (const file of ["../equipment/equipment.js", "../equipment/data.js"]) {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
}

console.log("equipment test passed");
