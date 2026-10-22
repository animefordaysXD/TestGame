/* Node tests for the main character module and its characters/mainChar/ mirror.
   Run: node test/main-character.test.cjs */
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../characters/mainCharacterData.js");
require("../characters/mainCharacter.js");

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nGQAAAAASUVORK5CYII=";

function makeFileHandle(name, entry) {
  return {
    kind: "file",
    name,
    async getFile() {
      const data = entry.data;
      return {
        text: async () => (typeof data === "string" ? data : ""),
        size: typeof data === "string" ? data.length : (data && data.size) || 0
      };
    },
    async createWritable() {
      return {
        write: async (value) => { entry.data = value; },
        close: async () => {}
      };
    }
  };
}

function makeDir(name) {
  const entries = new Map();
  return {
    kind: "directory",
    name,
    entries,
    async getDirectoryHandle(child, options = {}) {
      let entry = entries.get(child);
      if (!entry) {
        if (!options.create) throw new Error(`Directory not found: ${child}`);
        entry = { kind: "directory", handle: makeDir(child) };
        entries.set(child, entry);
      }
      if (entry.kind !== "directory") throw new Error(`Not a directory: ${child}`);
      return entry.handle;
    },
    async getFileHandle(child, options = {}) {
      let entry = entries.get(child);
      if (!entry) {
        if (!options.create) throw new Error(`File not found: ${child}`);
        entry = { kind: "file", data: "" };
        entries.set(child, entry);
      }
      if (entry.kind !== "file") throw new Error(`Not a file: ${child}`);
      return makeFileHandle(child, entry);
    },
    async *entries() {
      for (const [child, entry] of entries)
        yield [child, entry.kind === "file" ? makeFileHandle(child, entry) : entry.handle];
    },
    async removeEntry(child) { entries.delete(child); }
  };
}

async function readJson(dir, name) {
  const handle = await dir.getFileHandle(name);
  const file = await handle.getFile();
  return JSON.parse(await file.text());
}

async function listNames(dir) {
  const names = [];
  for await (const [name] of dir.entries()) names.push(name);
  return names.sort();
}

(async () => {
  const engine = new Engine({ seed: 1234, tickMinutes: 10 });
  const mainCharacter = createMainCharacterModule();
  engine.register(mainCharacter);

  assert.equal(engine.generators.size, 0, "main character registers no tick generators");
  assert.equal(engine.state.modules.mainCharacter.character, null);

  const avatar = mainCharacter.defaultAvatar("Aria Vale");
  assert.ok(avatar.startsWith("data:image/svg+xml"), "default avatar is an SVG data URL");
  assert.ok(decodeURIComponent(avatar).includes("AV"), "default avatar uses initials");

  const savedEvents = [];
  engine.on("event:mainCharacter:saved", (e) => savedEvents.push(e));

  const first = mainCharacter.save({ name: "  Aria   Vale  ", gender: "female", age: "27" }, 2);
  engine.flush();
  assert.equal(first.name, "Aria Vale", "name whitespace is normalized");
  assert.equal(first.age, 27);
  assert.equal(first.imageSource, "default");
  assert.ok(first.image.startsWith("data:image/svg+xml"));
  assert.equal(first.id, "main");
  assert.equal(first.stamina, 100);
  assert.equal(first.staminaMax, 100);
  assert.equal(savedEvents.length, 1);
  assert.equal(savedEvents[0].depth, 2, "save uses the supplied event depth");
  assert.equal(savedEvents[0].data.name, "Aria Vale");
  assert.equal(savedEvents[0].data.image, undefined, "image stays out of the event log");
  assert.equal(JSON.stringify(engine.state.eventLog).includes("data:image"), false);

  const statEvents = [];
  engine.on("event:mainCharacter:statChanged", (e) => statEvents.push(e));
  engine.fire({
    type: "location:event",
    data: { eventId: "test_snow", effects: [{ stat: "stamina", delta: -10 }] }
  });
  engine.flush();
  assert.equal(engine.state.modules.mainCharacter.character.stamina, 90);
  assert.equal(statEvents.length, 1);
  assert.equal(statEvents[0].depth, 1, "stat changes are follow-ups to location events");
  assert.equal(statEvents[0].data.value, 90);
  assert.equal(statEvents[0].data.eventId, "test_snow");

  assert.throws(() => mainCharacter.save({ name: "", gender: "female", age: 27 }), /Enter a name/);
  assert.throws(() => mainCharacter.save({ name: "Aria", gender: "robot", age: 27 }), /Choose a gender/);
  assert.throws(() => mainCharacter.save({ name: "Aria", gender: "female", age: 0 }), /Age must be/);
  assert.throws(() => mainCharacter.save({ name: "Aria", gender: "female", age: 121 }), /Age must be/);
  assert.throws(() => mainCharacter.save({ name: "x".repeat(41), gender: "female", age: 27 }), /Name must be/);

  const custom = mainCharacter.save({ name: "Aria Vale", gender: "female", age: 27, image: PNG });
  engine.flush();
  assert.equal(custom.image, PNG);
  assert.equal(custom.imageSource, "upload");
  assert.equal(custom.stamina, 90, "profile saves preserve stamina");
  assert.equal(custom.createdAtTick, first.createdAtTick, "updates keep createdAtTick");
  assert.equal(custom.createdAt, first.createdAt, "updates keep createdAt");

  const reused = mainCharacter.save({ name: "Aria V.", gender: "female", age: 28 });
  engine.flush();
  assert.equal(reused.image, PNG, "an uploaded image is reused on later saves");
  assert.equal(reused.imageSource, "upload");
  assert.equal(reused.stamina, 90);

  assert.deepEqual(JSON.parse(mainCharacter.toJSON()), reused);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(engine.state.modules.mainCharacter)));

  const saved = engine.serialize();
  const engine2 = new Engine({ seed: 99 });
  const main2 = createMainCharacterModule();
  engine2.register(main2);
  engine2.load(saved);
  assert.equal(engine2.state.modules.mainCharacter.character.name, "Aria V.");
  assert.equal(engine2.state.modules.mainCharacter.character.image, PNG);
  assert.equal(engine2.state.modules.mainCharacter.character.stamina, 90);

  const beforeUnknown = statEvents.length;
  engine.fire({ type: "location:event", data: { effects: [{ stat: "mana", delta: -20 }] } });
  engine.flush();
  assert.equal(statEvents.length, beforeUnknown, "unknown stats are ignored");
  assert.equal(engine.state.modules.mainCharacter.character.stamina, 90);

  engine.fire({ type: "location:event", data: { effects: [{ stat: "stamina", delta: -500 }] } });
  engine.flush();
  assert.equal(engine.state.modules.mainCharacter.character.stamina, 0, "stamina clamps at zero");
  assert.equal(statEvents.at(-1).data.delta, -90);

  engine.reset(777);
  assert.equal(engine.state.modules.mainCharacter.character, null, "reset clears the main character");

  // Reset must not subscribe the location:event handler twice.
  mainCharacter.save({ name: "Reset Hero", gender: "male", age: 30 });
  engine.flush();
  const beforeResetEffect = statEvents.length;
  engine.fire({ type: "location:event", data: { effects: [{ stat: "stamina", delta: -7 }] } });
  engine.flush();
  assert.equal(statEvents.length, beforeResetEffect + 1);
  assert.equal(engine.state.modules.mainCharacter.character.stamina, 93);

  // ----- Folder mirror -----
  const engine3 = new Engine({ seed: 5 });
  const main3 = createMainCharacterModule();
  engine3.register(main3);
  assert.equal(main3.folderConnected, false);

  const root = makeDir("root");
  global.showDirectoryPicker = async () => root;

  const connectedEmpty = await main3.connectFolder();
  assert.equal(connectedEmpty.wrote, false);
  assert.equal(main3.folderConnected, true);
  assert.equal(connectedEmpty.path, "characters/mainChar");

  const base = await root.getDirectoryHandle("characters");
  const folder = await base.getDirectoryHandle("mainChar");
  assert.deepEqual(await listNames(folder), [], "empty folder when no character is saved");

  main3.save({ name: "Borin", gender: "male", age: 44, image: PNG });
  engine3.flush();
  assert.equal(await main3.writeToFolder(), true);

  const json = await readJson(folder, "main.json");
  assert.equal(json.id, "main");
  assert.equal(json.name, "Borin");
  assert.equal(json.image, PNG);
  assert.equal(json.imageSource, "upload");
  assert.equal(json.stamina, 100);
  assert.equal(json.staminaMax, 100);
  assert.deepEqual(await listNames(folder), ["main.json", "profile.png"]);

  // Switching extension removes the old profile image.
  main3.save({ name: "Borin", gender: "male", age: 45, image: "data:image/webp;base64,AAAA" });
  engine3.flush();
  assert.equal(await main3.writeToFolder(), true);
  assert.deepEqual(await listNames(folder), ["main.json", "profile.webp"]);
  assert.equal((await readJson(folder, "main.json")).age, 45);

  // Default SVG avatars also get a mirror file, not just base64 uploads.
  const engine4 = new Engine({ seed: 6 });
  const main4 = createMainCharacterModule();
  engine4.register(main4);
  main4.save({ name: "Default One", gender: "non-binary", age: 33 });
  const root2 = makeDir("root2");
  global.showDirectoryPicker = async () => root2;
  const connected = await main4.connectFolder();
  assert.equal(connected.wrote, true);
  const folder2 = await (await root2.getDirectoryHandle("characters")).getDirectoryHandle("mainChar");
  assert.deepEqual(await listNames(folder2), ["main.json", "profile.svg"]);
  const defaultJson = await readJson(folder2, "main.json");
  assert.equal(defaultJson.imageSource, "default");
  assert.equal(defaultJson.stamina, 100);
  assert.ok(defaultJson.image.startsWith("data:image/svg+xml"));

  console.log("main character test passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
