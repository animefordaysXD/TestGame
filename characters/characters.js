/* Characters module v0.1 — NPC generator + Named NPC / Temporary Spawn storage. See ENGINE_SPEC.md.
   Add an attribute: push one { key, generate } entry into ATTRIBUTES. Order matters; each gets the character built so far. */
(function (global) {
  "use strict";
  const D = global.CharacterData;
  const pick = (rng, arr) => arr[Math.floor(rng.next() * arr.length)];

  const ATTRIBUTES = [
    { key: "gender", generate: ({ rng }) => pick(rng, ["male", "female"]) },
    { key: "name",   generate: ({ rng, char }) => `${pick(rng, D.firstNames[char.gender])} ${pick(rng, D.surnames)}` },
    { key: "age",    generate: ({ rng }) => { const [a, b] = D.ageRange; return a + Math.floor(((rng.next() + rng.next()) / 2) * (b - a + 1)); } },
    { key: "traits", generate: ({ rng }) => {
        const chosen = [], pool = D.traits.slice();
        while (chosen.length < 5 && pool.length) {
          const t = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
          if (!D.opposites.some(([x, y]) => (t === x && chosen.includes(y)) || (t === y && chosen.includes(x)))) chosen.push(t);
        }
        return chosen;
    } }
  ];

  const FOLDERS = { named: "Named NPC", temp: "Temporary Spawn" };

  function createCharactersModule() {
    let engine = null, bound = false, disk = null;
    const S = () => engine.state.modules.characters;   // never cache: state is replaced on load

    // Optional mirror to real folders (Chrome/Edge). The game state is always the source of truth.
    const put = async (dir, c) => { try { const w = await (await dir.getFileHandle(c.id + ".json", { create: true })).createWritable(); await w.write(JSON.stringify(c, null, 2)); await w.close(); } catch (e) { console.warn(e); } };
    const del = async (dir, id) => { try { await dir.removeEntry(id + ".json"); } catch (e) { /* already gone */ } };

    const mod = {
      name: "characters", depends: [], attributes: ATTRIBUTES,

      init(eng) {
        engine = eng;
        engine.slice("characters", { nextId: 1, named: {}, temp: {} });
        if (bound) return; bound = true;   // init runs again on reset: subscribe only once
        engine.on("event:character:spawn", (e) => mod.spawn(e.depth + 1));
        engine.on("event:character:save", (e) => mod.save(e.data.id, e.depth + 1));
        engine.on("event:character:clearTemp", (e) => mod.clearTemp(e.depth + 1));
        engine.on("event:location:changed", (e) => mod.clearTemp(e.depth + 1)); // future location module
      },

      generate(rng) { const char = {}; for (const a of ATTRIBUTES) char[a.key] = a.generate({ rng: rng, char, engine }); return char; },

      spawn(depth = 0) {
        const s = S(), n = engine.now;
        const c = { id: "npc_" + String(s.nextId++).padStart(4, "0"), ...mod.generate(engine.rng), createdAtTick: n.tick, createdAt: n.text };
        s.temp[c.id] = c;
        if (disk) put(disk.temp, c);
        engine.fire({ type: "character:spawned", text: `${c.name} (${c.age}, ${c.gender}) appears.`, data: { id: c.id } }, depth);
        return c;
      },

      save(id, depth = 0) {
        const s = S(), c = s.temp[id]; if (!c) return;
        delete s.temp[id]; s.named[id] = c;
        if (disk) { put(disk.named, c); del(disk.temp, id); }
        engine.fire({ type: "character:saved", text: `${c.name} was saved as a Named NPC.`, data: { id } }, depth);
      },

      clearTemp(depth = 0) {
        const s = S(), ids = Object.keys(s.temp);
        s.temp = {};
        if (disk) ids.forEach((id) => del(disk.temp, id));
        if (ids.length) engine.fire({ type: "character:tempCleared", text: `${ids.length} temporary character(s) left behind.`, data: { ids } }, depth);
      },

      async connectFolder() {   // pick the folder that contains index.html
        const root = await global.showDirectoryPicker({ mode: "readwrite" });
        const base = await root.getDirectoryHandle("characters", { create: true });
        disk = { named: await base.getDirectoryHandle(FOLDERS.named, { create: true }), temp: await base.getDirectoryHandle(FOLDERS.temp, { create: true }) };
        for (const c of Object.values(S().named)) await put(disk.named, c);
        for (const c of Object.values(S().temp)) await put(disk.temp, c);
      }
    };
    return mod;
  }

  global.createCharactersModule = createCharactersModule;
})(window);
