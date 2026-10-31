/* Node tests for the equipment module and its armor bridge to the main character.
   Run: node test/equipment.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
require("../engine.js");
require("../characters/statsData.js");
require("../characters/bodyData.js");
require("../characters/body.js");
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
const itemByKey = (key) => Object.values(slice().items).find((item) => item.key === key);

assert.deepEqual(slice(), { nextId: 1, items: {}, equippedByPart: {}, equippedWeaponId: null });
assert.equal(equipment.totalArmor(), 0);
assert.deepEqual(equipment.coverage().map((part) => part.part), CharacterBodyData.parts.map((part) => part.key));

// A torso item is worn automatically because its part is free.
act(engine, "equipment:add", { key: "leather_cuirass" });
const cuirass = itemByKey("leather_cuirass");
assert.deepEqual(cuirass.parts, ["torso"]);
assert.equal(cuirass.equipped, true);
assert.deepEqual(slice().equippedByPart, { torso: cuirass.id });
assert.equal(character.stats.armor, 3, "equipment writes the main character's armor stat");
assert.equal(added.length, 1);
assert.equal(added[0].depth, 1, "equipment:added is a follow-up");
assert.equal(added[0].data.equipped, true);
assert.deepEqual(added[0].data.parts, ["torso"]);
assert.equal(equipped.length, 1);
assert.equal(equipped[0].depth, 1);
assert.equal(equipped[0].data.totalArmor, 3);
assert.deepEqual(equipped[0].data.replacedItemIds, []);
assert.equal(armorChanges.length, 1);
assert.equal(armorChanges[0].depth, 2, "armorChanged is a follow-up to equipment:equipped");
assert.equal(armorChanges[0].data.value, 3);
assert.equal(armorChanges[0].data.itemId, cuirass.id);

// A head item auto-equips on a free part and adds to the total.
act(engine, "equipment:add", { key: "leather_cap" });
const cap = itemByKey("leather_cap");
assert.equal(cap.equipped, true);
assert.equal(slice().equippedByPart.head, cap.id);
assert.equal(slice().equippedByPart.torso, cuirass.id);
assert.equal(character.stats.armor, 4, "worn armor is summed");
assert.equal(equipment.totalArmor(), 4);

// An item whose parts are occupied stays in the inventory.
act(engine, "equipment:add", { key: "padded_gambeson" });
const gambeson = itemByKey("padded_gambeson");
assert.equal(gambeson.equipped, false, "a conflicting item does not auto-equip");
assert.equal(slice().equippedByPart.torso, cuirass.id);
assert.equal(character.stats.armor, 4);
assert.equal(equipped.length, 2, "no equip event for an inventory item");

// Equipping the gambeson replaces the cuirass on the torso and extends over both arms.
act(engine, "equipment:equip", { itemId: gambeson.id });
assert.equal(gambeson.equipped, true);
assert.equal(slice().items[cuirass.id].equipped, false);
assert.equal(slice().equippedByPart.torso, gambeson.id);
assert.equal(slice().equippedByPart.leftArm, gambeson.id);
assert.equal(slice().equippedByPart.rightArm, gambeson.id);
assert.equal(equipment.totalArmor(), 3, "cap 1 + gambeson 2");
assert.equal(character.stats.armor, 3);
assert.equal(equipped.length, 3);
assert.deepEqual(equipped[2].data.replacedItemIds, [cuirass.id]);
assert.equal(armorChanges.at(-1).data.previous, 4);
assert.equal(armorChanges.at(-1).data.value, 3);

// Equipping the same item again is a no-op.
act(engine, "equipment:equip", { itemId: gambeson.id });
assert.equal(equipped.length, 3);

// Equipping arm bracers removes the whole conflicting gambeson, not just its arms.
act(engine, "equipment:add", { key: "leather_bracers" });
const bracers = itemByKey("leather_bracers");
assert.equal(bracers.equipped, false);
act(engine, "equipment:equip", { itemId: bracers.id });
assert.equal(bracers.equipped, true);
assert.equal(slice().items[gambeson.id].equipped, false);
assert.equal(slice().equippedByPart.leftArm, bracers.id);
assert.equal(slice().equippedByPart.rightArm, bracers.id);
assert.equal(slice().equippedByPart.torso, undefined, "the replaced item gives up every part");
assert.equal(equipment.totalArmor(), 2, "cap 1 + bracers 1");

// Free leg and foot parts take their own items, so several pieces can be worn at once.
act(engine, "equipment:add", { key: "leather_greaves" });
act(engine, "equipment:add", { key: "traveler_boots" });
const greaves = itemByKey("leather_greaves");
const boots = itemByKey("traveler_boots");
assert.equal(greaves.equipped, true);
assert.equal(boots.equipped, true);
assert.equal(character.stats.armor, 5, "1 head + 1 arms + 2 legs + 1 feet");
assert.deepEqual(
  equipment.coverage().filter((part) => part.itemId).map((part) => part.part),
  ["head", "leftLeg", "rightLeg", "leftArm", "rightArm", "leftFoot", "rightFoot"]
);

// Unequipping one item leaves the rest worn.
const beforeSingle = unequipped.length;
act(engine, "equipment:unequip", { itemId: bracers.id });
assert.equal(unequipped.length, beforeSingle + 1);
assert.equal(unequipped.at(-1).data.itemId, bracers.id);
assert.deepEqual(unequipped.at(-1).data.itemIds, [bracers.id]);
assert.equal(slice().items[bracers.id].equipped, false);
assert.equal(slice().equippedByPart.leftArm, undefined);
assert.equal(equipment.totalArmor(), 4);
assert.equal(character.stats.armor, 4);
assert.equal(unequipped.at(-1).depth, 1);

// Without an item id, unequip clears every worn item in one event.
act(engine, "equipment:unequip");
assert.deepEqual(slice().equippedByPart, {});
assert.equal(equipment.totalArmor(), 0);
assert.equal(character.stats.armor, 0);
assert.equal(unequipped.at(-1).data.itemId, null);
assert.deepEqual(unequipped.at(-1).data.itemIds.sort(), [cap.id, greaves.id, boots.id].sort());
assert.equal(armorChanges.at(-1).data.value, 0);
assert.ok(Object.values(slice().items).every((item) => item.equipped === false));

// Unknown items and catalogue keys are ignored.
const beforeInvalid = Object.keys(slice().items).length;
act(engine, "equipment:equip", { itemId: "eq_9999" });
act(engine, "equipment:add", { key: "not_a_real_item" });
act(engine, "equipment:unequip", { itemId: "eq_9999" });
assert.equal(Object.keys(slice().items).length, beforeInvalid);
assert.deepEqual(slice().equippedByPart, {});

// Without a key, add() picks from the catalogue with engine.rng and auto-equips it.
act(engine, "equipment:add");
assert.equal(Object.keys(slice().items).length, beforeInvalid + 1);
const randomItem = Object.values(slice().items).at(-1);
assert.ok(EquipmentData.items.some((item) => item.key === randomItem.key));
assert.equal(randomItem.equipped, true, "a free item auto-equips");
assert.ok(["armor", "weapon"].includes(randomItem.kind));
if (randomItem.kind === "weapon") assert.equal(slice().equippedWeaponId, randomItem.id);
else assert.ok(character.stats.armor >= 1);

// End-to-end: summed equipped armor makes Defend reduce real combat damage.
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
act(fight, "equipment:add", { key: "leather_cap" });
assert.equal(hero.stats.armor, 5, "chain shirt 4 over torso and arms + cap 1");

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
assert.equal(hero.stats.hp, 100, "5 armor blocks all 8 damage while defending");
const hit = fight.state.eventLog.filter((event) => event.type === "combat:damage").at(-1);
assert.equal(hit.data.reduction, 8);
assert.equal(hit.data.amount, 0);

// Reset clears the slice without duplicating subscriptions.
const addedBeforeReset = added.length;
engine.reset(4001);
assert.deepEqual(slice(), { nextId: 1, items: {}, equippedByPart: {}, equippedWeaponId: null });
assert.equal(equipment.totalArmor(), 0);
main.save({ name: "After Reset", gender: "female", age: 22 });
engine.flush();
act(engine, "equipment:add", { key: "traveler_cloak" });
assert.equal(engine.state.modules.mainCharacter.character.stats.armor, 1);
assert.equal(added.length, addedBeforeReset + 1, "one added event after reset");

// Save/load keeps the inventory, every part assignment and the armor stat.
const saved = engine.serialize();
const savedCloak = Object.values(slice().items)[0];
const loadedEngine = new Engine({ seed: 5001 });
const loadedMain = createMainCharacterModule();
const loadedGear = createEquipmentModule();
loadedEngine.register(loadedMain);
loadedEngine.register(loadedGear);
loadedEngine.load(saved);
const loadedSlice = loadedEngine.state.modules.equipment;
assert.equal(Object.keys(loadedSlice.items).length, 1);
assert.equal(loadedSlice.equippedByPart.torso, savedCloak.id);
assert.deepEqual(loadedSlice.items[savedCloak.id].parts, ["torso", "leftArm", "rightArm"]);
assert.equal(loadedSlice.items[savedCloak.id].equipped, true);
assert.equal(loadedEngine.state.modules.mainCharacter.character.stats.armor, 1);
assert.equal(loadedGear.totalArmor(), 1);
assert.doesNotThrow(() => JSON.parse(JSON.stringify(loadedSlice)));

act(loadedEngine, "equipment:unequip", { itemId: savedCloak.id });
assert.equal(loadedEngine.state.modules.mainCharacter.character.stats.armor, 0);

// A v0.1 save has a single equippedId and slot-based items. Load turns it into parts.
const legacy = JSON.parse(saved);
legacy.modules.equipment = {
  nextId: 2,
  items: {
    eq_0001: {
      id: "eq_0001", key: "leather_cuirass", name: "Leather Cuirass", slot: "body",
      armor: 3, equipped: true, acquiredAtTick: 0, acquiredAt: "1000-01-01 06:00"
    }
  },
  equippedId: "eq_0001"
};
legacy.modules.mainCharacter.character.stats.armor = 3;
const legacyEngine = new Engine({ seed: 5002 });
const legacyMain = createMainCharacterModule();
const legacyGear = createEquipmentModule();
legacyEngine.register(legacyMain);
legacyEngine.register(legacyGear);
legacyEngine.load(legacy);
const legacySlice = legacyEngine.state.modules.equipment;
assert.equal("equippedId" in legacySlice, false, "the old single id is removed");
assert.deepEqual(legacySlice.equippedByPart, { torso: "eq_0001" });
assert.deepEqual(legacySlice.items.eq_0001.parts, ["torso"]);
assert.equal("slot" in legacySlice.items.eq_0001, false);
assert.equal(legacySlice.items.eq_0001.equipped, true);
assert.equal(legacyGear.totalArmor(), 3);
assert.equal(legacyEngine.state.modules.mainCharacter.character.stats.armor, 3);

// Weapons use one slot, carry a rarity and never change armor.
{
  const w = makeWorld(3100);
  const wSlice = () => w.engine.state.modules.equipment;
  const equipEvents = [], removedEvents = [];
  w.engine.on("event:equipment:equipped", (e) => equipEvents.push(e));
  w.engine.on("event:equipment:removed", (e) => removedEvents.push(e));

  act(w.engine, "equipment:add", { key: "iron_shortsword" });
  const sword = Object.values(wSlice().items)[0];
  assert.equal(sword.kind, "weapon");
  assert.equal(sword.rarity, "common");
  assert.deepEqual(sword.parts, []);
  assert.equal(sword.damage, 3);
  assert.equal(sword.strength, 4);
  assert.equal(sword.armorPiercing, 6);
  assert.equal(wSlice().equippedWeaponId, sword.id, "a free weapon slot auto-equips");
  assert.equal(w.equipment.weaponFor("main").key, "iron_shortsword");
  assert.equal(w.equipment.weaponFor("someone_else"), null);
  assert.equal(w.character.stats.armor, 0, "a weapon never changes armor");
  assert.equal(w.equipment.totalArmor(), 0);

  // A second weapon stays in the inventory; equipping it replaces the first.
  act(w.engine, "equipment:add", { key: "warhammer" });
  const hammer = Object.values(wSlice().items).find((item) => item.key === "warhammer");
  assert.equal(hammer.equipped, false);
  act(w.engine, "equipment:equip", { itemId: hammer.id });
  assert.equal(wSlice().equippedWeaponId, hammer.id);
  assert.equal(wSlice().items[sword.id].equipped, false);
  assert.deepEqual(equipEvents.at(-1).data.replacedItemIds, [sword.id]);
  assert.equal(equipEvents.at(-1).data.kind, "weapon");
  assert.equal(equipEvents.at(-1).data.rarity, "rare");
  assert.equal(equipEvents.at(-1).data.totalArmor, 0, "weapon events keep the armor total");

  // Rarity and kind filters narrow a random find.
  act(w.engine, "equipment:add", { kind: "weapon", rarity: "unique" });
  const uniqueWeapon = Object.values(wSlice().items).at(-1);
  assert.equal(uniqueWeapon.kind, "weapon");
  assert.equal(uniqueWeapon.rarity, "unique");
  assert.equal(uniqueWeapon.equipped, false, "the one weapon slot is taken");

  act(w.engine, "equipment:add", { kind: "armor", rarity: "legendary" });
  const legendaryArmor = Object.values(wSlice().items).at(-1);
  assert.equal(legendaryArmor.kind, "armor");
  assert.equal(legendaryArmor.rarity, "legendary");
  assert.equal(legendaryArmor.key, "dragonscale_cuirass", "it is the only legendary armor");
  assert.equal(legendaryArmor.equipped, true);
  assert.equal(w.character.stats.armor, 8);

  // Destroy an inventory item.
  const beforeRemove = Object.keys(wSlice().items).length;
  act(w.engine, "equipment:remove", { itemId: uniqueWeapon.id });
  assert.equal(Object.keys(wSlice().items).length, beforeRemove - 1);
  assert.equal(wSlice().items[uniqueWeapon.id], undefined);
  assert.equal(removedEvents.at(-1).data.rarity, "unique");
  assert.equal(removedEvents.at(-1).data.wasEquipped, false);

  // Destroying a worn weapon clears the slot and reports it.
  act(w.engine, "equipment:remove", { itemId: hammer.id });
  assert.equal(wSlice().equippedWeaponId, null);
  assert.equal(w.equipment.equippedWeapon(), null);
  assert.equal(removedEvents.at(-1).data.wasEquipped, true);
  assert.equal(removedEvents.at(-1).data.kind, "weapon");

  // The rarity bands get stricter with rank.
  assert.deepEqual(EquipmentData.rarities.map((rarity) => rarity.key),
    ["common", "uncommon", "rare", "legendary", "unique"]);
  for (let i = 1; i < EquipmentData.rarities.length; i++) {
    const lower = EquipmentData.rarities[i - 1], higher = EquipmentData.rarities[i];
    assert.ok(higher.armor[0] > lower.armor[1], `${higher.key} armor starts above ${lower.key}`);
    assert.ok(higher.damage[0] > lower.damage[1], `${higher.key} damage starts above ${lower.key}`);
  }
}

for (const file of ["../equipment/equipment.js", "../equipment/data.js"]) {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
}

console.log("equipment test passed");
