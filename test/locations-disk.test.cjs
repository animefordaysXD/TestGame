/* Node test for the optional Locations folder mirror, using an in-memory File System API mock.
   Run: node test/locations-disk.test.cjs */
const assert = require("node:assert/strict");

global.window = global;
require("../engine.js");
require("../locations/data.js");
require("../locations/locations.js");

function makeFileHandle(name, entry) {
  return {
    kind: "file",
    name,
    async getFile() { return { text: async () => entry.data }; },
    async createWritable() {
      return {
        write: async (text) => { entry.data = String(text); },
        close: async () => {}
      };
    }
  };
}

function makeDir(name) {
  const entries = new Map();
  const handle = {
    kind: "directory",
    name,
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
  return handle;
}

async function readJson(dir, name) {
  const handle = await dir.getFileHandle(name);
  return JSON.parse(await (await handle.getFile()).text());
}

async function writeJson(dir, name, data) {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data));
  await writable.close();
}

(async () => {
  const engine = new Engine({ seed: 4242, tickMinutes: 10 });
  const locations = createLocationsModule();
  engine.register(locations);

  engine.fire({ type: "location:add", data: { count: 2 } });
  engine.flush();
  const s = engine.state.modules.locations;
  const originalSecondName = s.locations.loc_0002.name;

  const root = makeDir("root");
  global.showDirectoryPicker = async () => root;

  const first = await locations.connectFolder();
  assert.equal(first.seed, s.seed);
  assert.equal(first.count, 2);
  assert.equal(first.imported, 0);

  const base = await root.getDirectoryHandle("Locations");
  const world = await base.getDirectoryHandle(String(s.seed));
  const seedFile = await readJson(world, "seed.json");
  assert.equal(seedFile.seed, s.seed);
  assert.equal(seedFile.createdAt, s.createdAt);

  const names = [];
  for await (const [name] of world.entries()) names.push(name);
  assert.ok(names.includes("seed.json"));
  assert.ok(names.includes("loc_0001.json"));
  assert.ok(names.includes("loc_0002.json"));
  assert.equal((await readJson(world, "loc_0001.json")).id, "loc_0001");

  // Hand-edit a new location and a stale copy of an existing one.
  await writeJson(world, "loc_0009.json", {
    id: "loc_0009",
    name: "Hand Made",
    biome: "Hills",
    biomeKey: "hills",
    weather: "Fog",
    hostility: 44,
    seed: 1,
    createdAtTick: 2,
    createdAt: "1000-01-01 06:20"
  });
  await writeJson(world, "loc_0002.json", {
    ...s.locations.loc_0002,
    name: "Wrong Name"
  });

  const second = await locations.connectFolder();
  assert.equal(second.imported, 1, "one new hand-edited location is imported");
  assert.equal(Object.keys(s.locations).length, 3);
  assert.equal(s.locations.loc_0009.name, "Hand Made");
  assert.equal(s.locations.loc_0009.seed, s.seed, "imported location adopts the current world seed");
  assert.equal(s.locations.loc_0002.name, originalSecondName, "existing state id wins over a stale file");
  assert.equal(s.nextId, 10, "nextId moves past imported numeric ids");

  engine.fire({ type: "location:add" });
  engine.flush();
  assert.ok(s.locations.loc_0010, "new locations continue after imported ids");
  await locations.whenDiskIdle();
  assert.equal((await readJson(world, "loc_0010.json")).id, "loc_0010");

  const syncedSecond = await readJson(world, "loc_0002.json");
  assert.equal(syncedSecond.name, originalSecondName, "folder is overwritten from state");
  assert.equal((await readJson(world, "loc_0009.json")).seed, s.seed);

  console.log("locations disk-mirror test passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
