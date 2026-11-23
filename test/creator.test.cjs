/* Node tests for the character creator module. Run: node test/creator.test.cjs */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../characters/statsData.js");
require("../characters/bodyData.js");
require("../characters/body.js");
require("../characters/mainCharacterData.js");
require("../characters/creatorData.js");
require("../characters/mainCharacter.js");
require("../equipment/data.js");
require("../equipment/equipment.js");
require("../characters/creator.js");

const act = (engine, type, data) => { engine.fire({ type, data }); engine.flush(); };

function buildEngine(seed = 20261123) {
  const engine = new Engine({ startDate: "1000-01-01T06:00:00Z", tickMinutes: 10, seed });
  engine.register(createMainCharacterModule());
  engine.register(createEquipmentModule());
  engine.register(createCreatorModule());
  return engine;
}

// ----- content -----
assert.ok(CharacterCreatorData.backgrounds.length >= 4, "several backgrounds exist");
assert.ok(CharacterCreatorData.origins.length >= 3, "several origins exist");
assert.ok(CharacterCreatorData.focuses.length >= 3, "several focuses exist");
for (const field of ["backgrounds", "origins", "focuses"]) {
  const keys = CharacterCreatorData[field].map((entry) => entry.key);
  assert.equal(new Set(keys).size, keys.length, `${field} keys are unique`);
}
assert.equal(new Set(CharacterCreatorData.backgrounds.map((entry) => entry.name)).size,
  CharacterCreatorData.backgrounds.length, "background names are unique");

// ----- preview -----
const engine = buildEngine();
const creator = engine.modules.get("creator");
const mainCharacter = engine.modules.get("mainCharacter");
const equipment = engine.modules.get("equipment");
const draft = {
  name: "Aria Vale", gender: "female", age: 27,
  background: "soldier", origin: "frontier", focus: "blade"
};
const preview = creator.preview(draft);
assert.equal(preview.background.key, "soldier");
assert.equal(preview.origin.key, "frontier");
assert.equal(preview.focus.key, "blade");
assert.equal(preview.stats.hp, 80, "resources start at the configured percentage");
assert.equal(preview.stats.hpMax, 100);
assert.equal(preview.stats.mana, 40, "mana starts at 80% of 50");
assert.equal(preview.stats.stamina, 77, "soldier -5 and frontier +2 apply to starting stamina");
assert.equal(preview.stats.strength, 14, "soldier +2, frontier +1 and blade +1 apply");
assert.equal(preview.stats.personalCombat, 14, "soldier +2 and blade +2 apply");
assert.deepEqual(preview.equipment, ["chain_shirt", "iron_shortsword", "leather_cap"],
  "background and origin equipment are combined in order");
assert.equal(engine.state.modules.mainCharacter.character, null, "preview creates no character");
assert.equal(Object.keys(engine.state.modules.equipment.items).length, 0, "preview grants no equipment");

// Every shipped combination produces valid, JSON-safe stats.
const statDefs = CharacterStatsData.stats;
for (const background of CharacterCreatorData.backgrounds)
  for (const origin of CharacterCreatorData.origins)
    for (const focus of CharacterCreatorData.focuses) {
      const p = creator.preview({ background: background.key, origin: origin.key, focus: focus.key });
      for (const def of statDefs) {
        const value = p.stats[def.key];
        assert.ok(Number.isInteger(value), `${background.key}/${origin.key}/${focus.key}: ${def.key} is an integer`);
        const max = def.kind === "resource" ? p.stats[def.key + "Max"] : def.max;
        assert.ok(value >= def.min && value <= max, `${background.key}/${origin.key}/${focus.key}: ${def.key} stays in range`);
      }
      assert.ok(p.equipment.length <= CharacterCreatorData.settings.maxStartingItems, "the starting kit stays under the cap");
    }

// ----- validation -----
assert.throws(() => creator.validate({ ...draft, name: "  " }), /Enter a name/);
assert.throws(() => creator.validate({ ...draft, gender: "unknown" }), /Choose a gender/);
assert.throws(() => creator.validate({ ...draft, age: 0 }), /Age must be/);
assert.throws(() => creator.validate({ ...draft, background: "nope" }), /valid background/);
assert.throws(() => creator.validate({ ...draft, origin: "nope" }), /valid origin/);
assert.throws(() => creator.validate({ ...draft, focus: "nope" }), /valid focus/);
const clean = creator.validate({ ...draft, name: "  Aria   Vale  ", age: "27" });
assert.equal(clean.name, "Aria Vale", "names are trimmed and spaced");
assert.equal(clean.age, 27);
assert.ok(clean.creator && clean.creator.background === "soldier");
assert.deepEqual(clean.creator.equipment, preview.equipment);

// ----- create through the event request -----
const createdEvents = [];
const savedEvents = [];
engine.on("event:creator:created", (e) => createdEvents.push(e));
engine.on("event:mainCharacter:saved", (e) => savedEvents.push(e));
act(engine, "creator:create", { draft });

const character = engine.state.modules.mainCharacter.character;
assert.ok(character, "creator:create saves the main character");
assert.equal(character.name, "Aria Vale");
assert.equal(character.stats.stamina, preview.stats.stamina, "the created character keeps the previewed stats");
assert.equal(character.stats.strength, preview.stats.strength);
assert.equal(character.creator.background, "soldier");
assert.equal(character.creator.backgroundName, "Soldier");
assert.equal(character.creator.origin, "frontier");
assert.equal(character.creator.focus, "blade");
assert.deepEqual(character.creator.equipment, preview.equipment);
assert.equal(createdEvents.length, 1, "creator:created fires once");
assert.equal(createdEvents[0].depth, 2, "creator:created is a follow-up");
assert.equal(createdEvents[0].data.name, "Aria Vale");
assert.equal(savedEvents.length, 1, "mainCharacter:saved comes from mainCharacter:create");
assert.equal(savedEvents[0].depth, 2);

const items = Object.values(engine.state.modules.equipment.items);
assert.equal(items.length, preview.equipment.length, "every starting item is granted");
assert.deepEqual(items.map((item) => item.key).sort(), preview.equipment.slice().sort());
assert.ok(items.every((item) => item.equipped), "free starting gear auto-equips");
assert.equal(equipment.equippedWeapon().key, "iron_shortsword");
assert.equal(equipment.totalArmor(), 5, "chain shirt plus leather cap is worn");
assert.equal(character.stats.armor, 5, "equipment mirrors armor into the character");

// ----- profile edits keep the build -----
mainCharacter.save({ name: "Aria Vale", gender: "female", age: 28 });
engine.flush();
assert.equal(character.stats.stamina, preview.stats.stamina, "profile edits do not reset starting stats");
assert.equal(character.creator.background, "soldier", "profile edits keep creator metadata");
assert.equal(Object.keys(engine.state.modules.equipment.items).length, preview.equipment.length,
  "profile edits do not add equipment");

// ----- save/load -----
const saved = engine.serialize();
const engine2 = buildEngine(1);
engine2.load(saved);
const loaded = engine2.state.modules.mainCharacter.character;
assert.equal(loaded.stats.stamina, preview.stats.stamina);
assert.equal(loaded.creator.focusName, "Blade");
assert.equal(engine2.state.modules.creator.lastCreated.name, "Aria Vale");
assert.equal(Object.keys(engine2.state.modules.equipment.items).length, preview.equipment.length);
assert.equal(engine2.modules.get("equipment").totalArmor(), 5);

// ----- reset and re-create without duplicate subscriptions -----
engine.reset(444);
assert.equal(engine.state.modules.creator.lastCreated, null, "reset clears the last build");
assert.equal(engine.state.modules.mainCharacter.character, null, "reset clears the character");
assert.equal(Object.keys(engine.state.modules.equipment.items).length, 0, "reset clears equipment");
const before = createdEvents.length;
act(engine, "creator:create", { draft });
assert.equal(createdEvents.length, before + 1, "one creator handler after reset");
assert.equal(engine.state.modules.mainCharacter.character.stats.strength, preview.stats.strength);

for (const file of ["../characters/creator.js", "../characters/creatorData.js"]) {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  assert.ok(!/Math\.random/.test(text), `${file} must not use Math.random`);
}

console.log("creator test passed");
