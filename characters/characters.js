/* Characters module v0.6 — NPC generator + Named NPC / Temporary Spawn storage. See ENGINE_SPEC.md.
   Add an attribute: push one { key, generate } entry into ATTRIBUTES. Order matters; each gets the character built so far.
   Base stats are defined once in characters/statsData.js and shared with the mainCharacter module.
   Every character owns a humanoid body built from characters/bodyData.js.
   Personalities, behavior axes, relation bands/types and level bounds are data in
   characters/data.js. Relations run -100..100 and store { value, type }; the band names
   the value and a type supplies the 61+ label. NPCs also carry a level, which is a
   framework for later progression (nothing reads it for stats yet).
   character:spawn accepts overrides { source, level, relation, locationId, hostility };
   character:spawned echoes that metadata so other modules can map the new NPC.
   The module also applies combat:damage to the NPC it names. */
(function (global) {
  "use strict";
  const D = global.CharacterData;
  const SD = global.CharacterStatsData;
  const B = global.CharacterBody;
  const pick = (rng, arr) => arr[Math.floor(rng.next() * arr.length)];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  if (!SD || !Array.isArray(SD.stats) || !SD.stats.length)
    throw new Error("characters/statsData.js must define CharacterStatsData.stats");
  if (!B) throw new Error("characters/bodyData.js and characters/body.js must define CharacterBody");
  if (!Array.isArray(D.personalities) || !D.personalities.length)
    throw new Error("characters/data.js must define CharacterData.personalities");
  if (!Array.isArray(D.behaviorAxes) || !D.behaviorAxes.length)
    throw new Error("characters/data.js must define CharacterData.behaviorAxes");
  if (!D.relations || !Array.isArray(D.relations.bands) || !D.relations.bands.length)
    throw new Error("characters/data.js must define CharacterData.relations.bands");
  if (!Array.isArray(D.relations.types) || !D.relations.types.length)
    throw new Error("characters/data.js must define CharacterData.relations.types");
  const STAT_DEFS = SD.stats;
  const BEHAVIOR_AXES = D.behaviorAxes;
  const PERSONALITIES = D.personalities;
  const RELATIONS = D.relations;
  const REL_BANDS = RELATIONS.bands;
  const REL_TYPES = RELATIONS.types;
  const REL_BY_TYPE = new Map(REL_TYPES.map((type) => [type.key, type]));
  const REL_MIN = Number.isFinite(Number(RELATIONS.min)) ? Math.round(Number(RELATIONS.min)) : -100;
  const REL_MAX = Number.isFinite(Number(RELATIONS.max)) ? Math.round(Number(RELATIONS.max)) : 100;
  const REL_DEFAULT = clamp(
    Number.isFinite(Number(RELATIONS.default)) ? Math.round(Number(RELATIONS.default)) : 0,
    REL_MIN, REL_MAX
  );
  const REL_DEFAULT_TYPE = REL_BY_TYPE.has(RELATIONS.defaultType) ? RELATIONS.defaultType : REL_TYPES[0].key;
  const LEVELS = D.levels || {};
  const LEVEL_MIN = Number.isFinite(Number(LEVELS.min)) ? Math.round(Number(LEVELS.min)) : 1;
  const LEVEL_MAX = Math.max(LEVEL_MIN, Number.isFinite(Number(LEVELS.max)) ? Math.round(Number(LEVELS.max)) : 100);
  const LEVEL_DEFAULT = clamp(
    Number.isFinite(Number(LEVELS.default)) ? Math.round(Number(LEVELS.default)) : LEVEL_MIN,
    LEVEL_MIN, LEVEL_MAX
  );

  // Roll one NPC stat. Bell-curved skills stay near the middle of their range.
  const rollStat = (rng, def) => {
    const range = Array.isArray(def.npcRange) ? def.npcRange : [def.min, def.max];
    const lo = clamp(Math.round(Number(range[0])), def.min, def.max);
    const hi = clamp(Math.round(Number(range[1])), def.min, def.max);
    const top = Math.max(lo, hi);
    const t = def.npcBell ? (rng.next() + rng.next() + rng.next()) / 3 : rng.next();
    return clamp(Math.round(lo + t * (top - lo)), def.min, def.max);
  };

  const makeStats = (rng) => {
    const stats = {};
    for (const def of STAT_DEFS) {
      stats[def.key] = rollStat(rng, def);
      if (def.kind === "resource") stats[def.key + "Max"] = def.max;
    }
    return stats;
  };

  const personalityById = (id) => PERSONALITIES.find((profile) => profile.id === id) || null;

  // Nearest archetype by trait overlap. Used only for old saves without a personality id.
  const closestPersonality = (traits) => {
    const list = Array.isArray(traits) ? traits : [];
    let best = PERSONALITIES[0], bestScore = -1;
    for (const profile of PERSONALITIES) {
      const score = profile.traits.reduce((total, trait) => total + (list.includes(trait) ? 1 : 0), 0);
      if (score > bestScore) { best = profile; bestScore = score; }
    }
    return best;
  };

  // Clamp saved values; fill missing axes from the archetype, then from 50.
  const makeBehavior = (profile, saved = null) => {
    const behavior = {};
    for (const def of BEHAVIOR_AXES) {
      const savedRaw = saved ? saved[def.key] : undefined;
      const savedNumber = Number(savedRaw);
      const profileNumber = Number(profile && profile.behavior && profile.behavior[def.key]);
      const value = savedRaw !== undefined && savedRaw !== null && Number.isFinite(savedNumber)
        ? savedNumber
        : Number.isFinite(profileNumber) ? profileNumber : 50;
      behavior[def.key] = clamp(Math.round(value), 0, 100);
    }
    return behavior;
  };

  const normalisePersonality = (character) => {
    let profile = personalityById(character.personality && character.personality.id);
    if (!profile) profile = closestPersonality(character.traits);
    if (!Array.isArray(character.traits) || !character.traits.length) character.traits = profile.traits.slice();
    character.personality = { id: profile.id, name: profile.name };
    character.behavior = makeBehavior(profile, character.behavior);
    return character;
  };

  // Fill missing/partial stats deterministically for old saves. New NPCs roll in generate().
  const normaliseStats = (character) => {
    const source = character.stats && typeof character.stats === "object" ? character.stats : {};
    const stats = {};
    for (const def of STAT_DEFS) {
      const max = def.kind === "resource"
        ? clamp(Math.round(Number(source[def.key + "Max"]) || def.max), def.min + 1, def.max)
        : def.max;
      const raw = Number(source[def.key]);
      stats[def.key] = clamp(Number.isFinite(raw) ? Math.round(raw) : def.start, def.min, max);
      if (def.kind === "resource") stats[def.key + "Max"] = max;
    }
    character.stats = stats;
    return character;
  };

  // Restore the ten-part body. Saved part statuses survive; missing parts are filled.
  const normaliseBody = (character) => {
    character.body = B.normalise(character.body);
    return character;
  };

  const relationValue = (raw) => {
    let value = REL_DEFAULT, type = REL_DEFAULT_TYPE;
    if (raw && typeof raw === "object") {
      const number = Number(raw.value);
      if (Number.isFinite(number)) value = number;
      if (typeof raw.type === "string" && REL_BY_TYPE.has(raw.type)) type = raw.type;
    } else if (raw !== undefined && raw !== null && raw !== "") {
      const number = Number(raw);
      if (Number.isFinite(number)) value = number;
    }
    return { value: clamp(Math.round(value), REL_MIN, REL_MAX), type };
  };

  const relationInfo = (value, type) => {
    const relation = relationValue({ value, type });
    const band = REL_BANDS.find((entry) => relation.value >= Number(entry.min) && relation.value <= Number(entry.max))
      || REL_BANDS[REL_BANDS.length - 1];
    const typeDef = REL_BY_TYPE.get(relation.type) || REL_TYPES[0];
    const label = band && band.typeSpecific
      ? (typeDef.highLabel || band.label || typeDef.label)
      : (band && band.label) || String(relation.value);
    return {
      ...relation,
      band: band ? band.key : "",
      bandLabel: band ? band.label : "",
      typeLabel: typeDef.label || typeDef.key,
      label
    };
  };

  const normaliseRelation = (character) => {
    character.relation = relationValue(character.relation);
    return character;
  };

  const levelValue = (raw) => {
    const value = Number(raw);
    return clamp(Number.isFinite(value) ? Math.round(value) : LEVEL_DEFAULT, LEVEL_MIN, LEVEL_MAX);
  };

  const normaliseLevel = (character) => {
    character.level = levelValue(character.level);
    return character;
  };

  const ATTRIBUTES = [
    { key: "gender", generate: ({ rng }) => pick(rng, ["male", "female"]) },
    { key: "name",   generate: ({ rng, char }) => `${pick(rng, D.firstNames[char.gender])} ${pick(rng, D.surnames)}` },
    { key: "age",    generate: ({ rng }) => { const [a, b] = D.ageRange; return a + Math.floor(((rng.next() + rng.next()) / 2) * (b - a + 1)); } },
    { key: "personality", generate: ({ rng }) => {
        const profile = pick(rng, PERSONALITIES);
        return { id: profile.id, name: profile.name };
    } },
    { key: "traits", generate: ({ char }) => {
        const profile = personalityById(char.personality.id) || PERSONALITIES[0];
        return profile.traits.slice();
    } },
    { key: "behavior", generate: ({ char }) => {
        const profile = personalityById(char.personality.id) || PERSONALITIES[0];
        return makeBehavior(profile);
    } },
    { key: "stats",  generate: ({ rng }) => makeStats(rng) },
    { key: "body",   generate: () => B.create() }
  ];

  const FOLDERS = { named: "Named NPC", temp: "Temporary Spawn" };

  function createCharactersModule() {
    let engine = null, bound = false, disk = null;
    const S = () => engine.state.modules.characters;   // never cache: state is replaced on load

    const normaliseAll = () => {
      for (const character of [...Object.values(S().named), ...Object.values(S().temp)]) {
        normaliseStats(character);
        normalisePersonality(character);
        normaliseBody(character);
        normaliseRelation(character);
        normaliseLevel(character);
      }
    };

    // Optional mirror to real folders (Chrome/Edge). The game state is always the source of truth.
    const put = async (dir, c) => { try { const w = await (await dir.getFileHandle(c.id + ".json", { create: true })).createWritable(); await w.write(JSON.stringify(c, null, 2)); await w.close(); } catch (e) { console.warn(e); } };
    const del = async (dir, id) => { try { await dir.removeEntry(id + ".json"); } catch (e) { /* already gone */ } };

    const mod = {
      name: "characters", depends: [], attributes: ATTRIBUTES,

      init(eng) {
        engine = eng;
        engine.slice("characters", { nextId: 1, named: {}, temp: {} });
        normaliseAll();
        if (bound) return; bound = true;   // init runs again on reset: subscribe only once
        engine.on("event:character:spawn", (e) => mod.spawn(e.depth + 1, e.data || {}));
        engine.on("event:character:save", (e) => mod.save(e.data.id, e.depth + 1));
        engine.on("event:character:clearTemp", (e) => mod.clearTemp(e.depth + 1, e.data || {}));
        engine.on("event:location:changed", (e) => mod.clearTemp(e.depth + 1, e.data || {})); // future location module
        engine.on("event:combat:damage", (e) => mod.applyCombatDamage(e.data || {}));
      },

      onLoad(eng) {
        engine = eng;
        engine.slice("characters", { nextId: 1, named: {}, temp: {} });
        normaliseAll();
      },

      generate(rng) { const char = {}; for (const a of ATTRIBUTES) char[a.key] = a.generate({ rng: rng, char, engine }); return char; },

      spawn(depth = 0, overrides = {}) {
        const s = S(), n = engine.now;
        const options = overrides && typeof overrides === "object" ? overrides : {};
        const c = {
          id: "npc_" + String(s.nextId++).padStart(4, "0"),
          ...mod.generate(engine.rng),
          level: levelValue(options.level),
          relation: relationValue(options.relation),
          source: typeof options.source === "string" ? options.source : "",
          createdAtTick: n.tick, createdAt: n.text
        };
        s.temp[c.id] = c;
        if (disk) put(disk.temp, c);
        const info = relationInfo(c.relation.value, c.relation.type);
        const data = {
          id: c.id, name: c.name, source: c.source, level: c.level,
          relation: { ...c.relation }, relationLabel: info.label, band: info.band
        };
        if (options.locationId !== undefined) data.locationId = options.locationId;
        if (options.hostility !== undefined) data.hostility = Number(options.hostility);
        if (options.encounter !== undefined) data.encounter = options.encounter;
        engine.fire({
          type: "character:spawned",
          text: `${c.name} (${c.age}, ${c.gender}, ${c.personality.name}, level ${c.level}) appears.`,
          data
        }, depth);
        return c;
      },

      save(id, depth = 0) {
        const s = S(), c = s.temp[id]; if (!c) return;
        delete s.temp[id]; s.named[id] = c;
        if (disk) { put(disk.named, c); del(disk.temp, id); }
        engine.fire({ type: "character:saved", text: `${c.name} was saved as a Named NPC.`, data: { id } }, depth);
      },

      // Combat damage is already announced by combat:damage; update the NPC's HP here.
      applyCombatDamage(data = {}) {
        const s = S(), c = s.named[data.targetId] || s.temp[data.targetId];
        if (!c) return null;
        normaliseStats(c);
        const amount = Math.max(0, Math.round(Number(data.amount)));
        if (!amount) return null;

        const max = Math.max(1, Math.round(Number(c.stats.hpMax) || 1));
        c.stats.hp = clamp(c.stats.hp - amount, 0, max);
        return c.stats.hp;
      },

      // Relations are stored as { value, type }. Relations are data; no rule acts on them yet.
      relationFor(value, type) {
        return relationInfo(value, type);
      },

      setRelation(id, value, type, depth = 0) {
        const s = S(), c = s.named[id] || s.temp[id];
        if (!c) return null;
        const before = relationValue(c.relation).value;
        const previous = relationInfo(before, c.relation && c.relation.type);
        c.relation = relationValue({ value, type: type === undefined ? (c.relation && c.relation.type) : type });
        const info = relationInfo(c.relation.value, c.relation.type);
        if (info.value !== before)
          engine.fire({
            type: "character:relationChanged",
            text: `${c.name} is now ${info.label.toLowerCase()} (${info.value}).`,
            data: {
              id: c.id, name: c.name, before, after: info.value, delta: info.value - before,
              relation: { ...c.relation }, label: info.label, band: info.band,
              previousLabel: previous.label, source: "set"
            }
          }, depth);
        return info;
      },

      adjustRelation(id, delta, depth = 0) {
        const s = S(), c = s.named[id] || s.temp[id];
        if (!c) return null;
        const before = relationValue(c.relation).value;
        const amount = Number(delta);
        if (!Number.isFinite(amount) || amount === 0) return relationInfo(before, c.relation && c.relation.type);
        const info = mod.setRelation(id, before + amount, c.relation && c.relation.type, depth);
        if (info) info.previousValue = before;
        return info;
      },

      levelFor(character) {
        return levelValue(character && character.level);
      },

      clearTemp(depth = 0, filter = {}) {
        const s = S();
        const source = filter && typeof filter.source === "string" && filter.source ? filter.source : "";
        const ids = Object.keys(s.temp).filter((id) => !source || s.temp[id].source === source);
        for (const id of ids) delete s.temp[id];
        if (disk) ids.forEach((id) => del(disk.temp, id));
        if (ids.length) {
          const data = { ids };
          if (source) data.source = source;
          engine.fire({ type: "character:tempCleared", text: `${ids.length} temporary character(s) left behind.`, data }, depth);
        }
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
