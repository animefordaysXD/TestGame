/* Locations module v0.2 — procedural map locations + biome events on visit.
   Locations are generated only when the UI fires location:add (button-driven for now).
   Add a generated field: push one { key, generate } entry into ATTRIBUTES. Order matters;
   each entry sees the location built so far. Content belongs in data.js.
   Biome events live in locations/events/<biomeKey>/events.json and are fetched lazily. */
(function (global) {
  "use strict";
  const D = global.LocationData;

  if (!D || !Array.isArray(D.biomes) || !D.biomes.length)
    throw new Error("locations/data.js must define LocationData.biomes with at least one biome");

  const pick = (rng, arr) => arr[Math.floor(rng.next() * arr.length)];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const comboKey = (biomeName, weather) => `${biomeName}|${weather}`;

  function weatherList(biome) {
    return Array.isArray(biome.weather) && biome.weather.length ? biome.weather : ["Clear"];
  }

  function weightedPick(rng, items) {
    const total = items.reduce((sum, item) => sum + (Number(item.weight) || 1), 0);
    let roll = rng.next() * total;
    for (const item of items) {
      roll -= Number(item.weight) || 1;
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  }

  function makeName(rng, biome, usedNames) {
    const nouns = Array.isArray(biome.nouns) && biome.nouns.length ? biome.nouns : [biome.name];
    const prefixes = Array.isArray(D.namePrefixes) && D.namePrefixes.length ? D.namePrefixes : ["Nameless"];
    const suffixes = Array.isArray(D.nameSuffixes) && D.nameSuffixes.length ? D.nameSuffixes : ["Reach"];
    const patterns = Array.isArray(D.namePatterns) && D.namePatterns.length ? D.namePatterns : ["{prefix} {noun}"];

    for (let attempt = 0; attempt < 40; attempt++) {
      let name = pick(rng, patterns)
        .replace(/\{prefix\}/g, pick(rng, prefixes))
        .replace(/\{noun\}/g, pick(rng, nouns))
        .replace(/\{suffix\}/g, pick(rng, suffixes))
        .replace(/\s+/g, " ")
        .trim();
      if (name && !usedNames.has(name)) return name;
    }

    // Tiny data sets can still collide. Keep names unique with a numeric suffix.
    const base = `${pick(rng, prefixes)} ${pick(rng, nouns)}`;
    let n = 2, name = `${base} ${n}`;
    while (usedNames.has(name)) name = `${base} ${++n}`;
    return name;
  }

  function hostilityFor(rng, biome) {
    const range = Array.isArray(biome.hostility) ? biome.hostility : [1, 100];
    const lo = clamp(Math.round(Number(range[0]) || 1), 1, 100);
    const hi = clamp(Math.round(Number(range[1]) || 100), 1, 100);
    const min = Math.min(lo, hi), max = Math.max(lo, hi);
    return min + Math.floor(rng.next() * (max - min + 1));
  }

  const ATTRIBUTES = [
    { key: "biome", generate: ({ rng }) => weightedPick(rng, D.biomes) },
    { key: "name", generate: ({ rng, loc, usedNames }) => makeName(rng, loc.biome, usedNames) },
    { key: "weather", generate: ({ rng, loc }) => pick(rng, weatherList(loc.biome)) },
    { key: "hostility", generate: ({ rng, loc }) => hostilityFor(rng, loc.biome) }
  ];

  function comboCount() {
    return D.biomes.reduce((sum, biome) => sum + weatherList(biome).length, 0);
  }

  function normalizeLocation(data, seed) {
    if (!data || typeof data !== "object") return null;
    const id = typeof data.id === "string" ? data.id.trim() : "";
    if (!/^loc_\d+$/.test(id)) return null;

    const name = typeof data.name === "string" ? data.name.trim() : "";
    const biome = typeof data.biome === "string" ? data.biome.trim() : "";
    const weather = typeof data.weather === "string" ? data.weather.trim() : "";
    const hostility = Math.round(Number(data.hostility));
    if (!name || !biome || !weather || !Number.isFinite(hostility)) return null;

    const knownBiome = D.biomes.find((b) => b.name === biome || b.key === data.biomeKey);
    return {
      id,
      name,
      biome,
      biomeKey: typeof data.biomeKey === "string" && data.biomeKey ? data.biomeKey : (knownBiome ? knownBiome.key : ""),
      weather,
      hostility: clamp(hostility, 1, 100),
      seed: seed >>> 0,
      createdAtTick: Number.isFinite(Number(data.createdAtTick)) ? Number(data.createdAtTick) : 0,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : ""
    };
  }

  function normalizeEvent(raw, biomeKey, index) {
    if (!raw || typeof raw !== "object") return null;

    const id = (typeof raw.id === "string" && raw.id.trim()) || `${biomeKey}_event_${index + 1}`;
    const name = (typeof raw.name === "string" && raw.name.trim()) || id;
    const text = (typeof raw.text === "string" && raw.text.trim()) || name;

    const hasPercent = raw.chancePercent !== undefined && raw.chancePercent !== null;
    const rawChance = hasPercent ? Number(raw.chancePercent) / 100 : Number(raw.chance);
    const chance = clamp(Number.isFinite(rawChance) ? rawChance : 0, 0, 1);

    const effects = Array.isArray(raw.effects) ? raw.effects.map((effect) => {
      if (!effect || typeof effect !== "object") return null;
      const stat = typeof effect.stat === "string" ? effect.stat.trim() : "";
      const delta = Math.round(Number(effect.delta));
      if (!stat || !Number.isFinite(delta) || delta === 0) return null;
      return { stat, delta };
    }).filter(Boolean) : [];

    return {
      biomeKey,
      id,
      name,
      text,
      enabled: raw.enabled !== false,
      chance,
      chancePercent: Math.round(chance * 1000) / 10,
      effects
    };
  }

  function createLocationsModule() {
    let engine = null, bound = false, disk = null, diskQueue = Promise.resolve();
    const eventCache = new Map();
    let eventLoadPromise = null;
    let eventSummary = { biomes: 0, events: 0, enabled: 0, errors: [] };

    // Never cache the slice object: load() replaces the whole state.
    const S = () => engine.state.modules.locations;

    // Disk writes are fire-and-forget from the game loop, but serialized here so files
    // cannot overtake each other. Tests and UI can await whenDiskIdle().
    const queueDisk = (task) => {
      diskQueue = diskQueue.then(task).catch((e) => console.warn("[locations] disk write failed", e));
      return diskQueue;
    };

    const writeFile = async (dir, name, data) => {
      try {
        const handle = await dir.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
      } catch (e) {
        console.warn(`[locations] could not write ${name}`, e);
      }
    };

    const mod = {
      name: "locations", depends: [], attributes: ATTRIBUTES,

      init(eng) {
        engine = eng;
        const defaults = { seed: 0, createdAt: "", nextId: 1, locations: {}, currentId: null };
        const s = engine.slice("locations", defaults);

        // A new world gets a new map seed. The world seed is the source of that number.
        if (!s.seed) {
          s.seed = (Number(engine.state.seed) >>> 0) || 1;
          s.createdAt = engine.now.text;
        }
        if (!s.createdAt) s.createdAt = engine.now.text;
        if (!s.locations || typeof s.locations !== "object") s.locations = {};
        if (!Number.isFinite(s.nextId) || s.nextId < 1) s.nextId = 1;
        if (!s.currentId || !s.locations[s.currentId]) s.currentId = null;

        if (bound) {   // init runs again on reset: subscribe only once
          if (disk) queueDisk(() => mod.writeSeed());
          return;
        }
        bound = true;
        engine.on("event:location:add", (e) => mod.add(e.depth + 1, e.data && e.data.count));
      },

      onLoad(eng) {
        engine = eng;
        const defaults = { seed: 0, createdAt: "", nextId: 1, locations: {}, currentId: null };
        const s = engine.slice("locations", defaults);
        if (!s.seed) {
          s.seed = (Number(engine.state.seed) >>> 0) || 1;
          s.createdAt = engine.now.text;
        }
        if (!s.locations || typeof s.locations !== "object") s.locations = {};
        if (!Number.isFinite(s.nextId) || s.nextId < 1) s.nextId = 1;
        if (!s.currentId || !s.locations[s.currentId]) s.currentId = null;
        if (disk) queueDisk(() => mod.writeAll());
      },

      // Build one candidate. Retries keep the first locations distinct by biome+weather.
      generate(rng, usedNames, usedCombos) {
        const totalCombos = comboCount();
        let candidate = null;

        for (let attempt = 0; attempt < 40; attempt++) {
          candidate = {};
          for (const attr of ATTRIBUTES)
            candidate[attr.key] = attr.generate({ rng, loc: candidate, engine, usedNames });

          const key = comboKey(candidate.biome.name, candidate.weather);
          if (!usedCombos.has(key) || usedCombos.size >= totalCombos) return candidate;
        }

        // The data is tiny or nearly exhausted: choose an unused pair directly.
        const pairs = [];
        for (const biome of D.biomes)
          for (const weather of weatherList(biome))
            if (!usedCombos.has(comboKey(biome.name, weather))) pairs.push({ biome, weather });

        if (pairs.length) {
          const pair = pick(rng, pairs);
          return {
            biome: pair.biome,
            name: makeName(rng, pair.biome, usedNames),
            weather: pair.weather,
            hostility: hostilityFor(rng, pair.biome)
          };
        }
        return candidate;
      },

      add(depth = 0, count = 1) {
        const n = Math.max(1, Math.min(100, Math.floor(Number(count) || 1)));
        const added = [];
        for (let i = 0; i < n; i++) added.push(mod.spawn(depth));
        return added;
      },

      spawn(depth = 0) {
        const s = S(), now = engine.now;
        const usedNames = new Set(Object.values(s.locations).map((l) => l.name));
        const usedCombos = new Set(Object.values(s.locations).map((l) => comboKey(l.biome, l.weather)));
        const raw = mod.generate(engine.rng, usedNames, usedCombos);

        const loc = {
          id: "loc_" + String(s.nextId++).padStart(4, "0"),
          name: raw.name,
          biome: raw.biome.name,
          biomeKey: raw.biome.key,
          weather: raw.weather,
          hostility: raw.hostility,
          seed: s.seed,
          createdAtTick: now.tick,
          createdAt: now.text
        };

        s.locations[loc.id] = loc;
        if (disk) queueDisk(() => mod.writeLocation(loc));

        const label = mod.labelFor(loc.hostility);
        engine.fire({
          type: "location:added",
          text: `${loc.name} is charted: ${loc.biome.toLowerCase()}, ${loc.weather.toLowerCase()}, hostility ${loc.hostility}/100 (${label}).`,
          data: { id: loc.id }
        }, depth);
        return loc;
      },

      labelFor(hostility) {
        const value = clamp(Math.round(Number(hostility) || 0), 1, 100);
        for (const band of D.hostilityBands || [])
          if (value <= band.max) return band.label;
        return `${value}/100`;
      },

      toJSON(id) {
        const loc = S().locations[id];
        return loc ? JSON.stringify(loc, null, 2) : null;
      },

      eventsFor(biomeKey) {
        return eventCache.get(biomeKey) || [];
      },

      eventStatus() {
        return { ...eventSummary, errors: eventSummary.errors.map((error) => ({ ...error })) };
      },

      // Content is JSON on disk so it can be edited without touching module code.
      async loadEvents(force = false) {
        if (eventLoadPromise && !force) return eventLoadPromise;

        if (force) eventCache.clear();
        if (typeof global.fetch !== "function") {
          eventSummary = {
            biomes: 0, events: 0, enabled: 0,
            errors: [{ biome: "*", error: "fetch() is unavailable; serve the project over HTTP." }]
          };
          eventLoadPromise = Promise.resolve(eventSummary);
          return eventLoadPromise;
        }

        eventLoadPromise = (async () => {
          const summary = { biomes: 0, events: 0, enabled: 0, errors: [] };

          for (const biome of D.biomes) {
            try {
              const response = await global.fetch(`locations/events/${biome.key}/events.json`, { cache: "no-store" });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const raw = await response.json();
              const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.events) ? raw.events : []);
              const seen = new Set();
              const events = [];
              for (const [index, event] of list.entries()) {
                const normalized = normalizeEvent(event, biome.key, index);
                if (!normalized) continue;
                if (seen.has(normalized.id)) {
                  console.warn(`[locations] duplicate event id "${normalized.id}" in ${biome.key}; keeping the first.`);
                  continue;
                }
                seen.add(normalized.id);
                events.push(normalized);
              }

              eventCache.set(biome.key, events);
              summary.biomes++;
              summary.events += events.length;
              summary.enabled += events.filter((event) => event.enabled).length;
            } catch (error) {
              eventCache.set(biome.key, []);
              summary.errors.push({ biome: biome.key, error: error.message });
              console.warn(`[locations] could not load biome events for ${biome.key}`, error);
            }
          }

          eventSummary = summary;
          return summary;
        })();

        return eventLoadPromise;
      },

      // Roll each enabled event independently. This is called on a visit, not every tick.
      checkEvents(loc, depth = 0) {
        const triggered = [];
        for (const event of mod.eventsFor(loc.biomeKey)) {
          if (!event.enabled || event.chance <= 0) continue;
          const roll = engine.rng.next();
          if (roll >= event.chance) continue;

          const record = { ...event, roll };
          triggered.push(record);
          engine.fire({
            type: "location:event",
            text: event.text,
            data: {
              locationId: loc.id,
              locationName: loc.name,
              biomeKey: loc.biomeKey,
              eventId: event.id,
              name: event.name,
              chancePercent: event.chancePercent,
              roll: Math.round(roll * 1000) / 1000,
              effects: event.effects
            }
          }, depth);
        }
        return triggered;
      },

      // UI calls this directly and then engine.flush(). It is async because JSON is loaded
      // on first use; the cache makes later visits immediate.
      async visit(id, depth = 0) {
        const s = S();
        const loc = s.locations[id];
        if (!loc) throw new Error(`Unknown location: ${id}`);

        s.currentId = loc.id;
        await mod.loadEvents();
        engine.fire({
          type: "location:visited",
          text: `You visit ${loc.name}.`,
          data: {
            id: loc.id, name: loc.name, biome: loc.biome,
            biomeKey: loc.biomeKey, weather: loc.weather, hostility: loc.hostility
          }
        }, depth);

        const events = mod.checkEvents(loc, depth + 1);
        return { location: loc, events };
      },

      whenDiskIdle() { return diskQueue; },

      async writeSeed() {
        if (!disk) return;
        const s = S();
        const dir = await disk.getDirectoryHandle(String(s.seed), { create: true });
        await writeFile(dir, "seed.json", {
          seed: s.seed,
          createdAt: s.createdAt,
          tick: engine.now.tick,
          tickMinutes: engine.now.tickMinutes
        });
      },

      async writeLocation(loc) {
        if (!disk) return;
        const s = S();
        const dir = await disk.getDirectoryHandle(String(s.seed), { create: true });
        await writeFile(dir, loc.id + ".json", loc);
      },

      async writeAll() {
        if (!disk) return;
        const s = S();
        const dir = await disk.getDirectoryHandle(String(s.seed), { create: true });
        await writeFile(dir, "seed.json", {
          seed: s.seed,
          createdAt: s.createdAt,
          tick: engine.now.tick,
          tickMinutes: engine.now.tickMinutes
        });
        for (const loc of Object.values(s.locations))
          await writeFile(dir, loc.id + ".json", loc);
      },

      // Read hand-edited loc_*.json files from the current seed folder. Existing ids win.
      async importDisk() {
        if (!disk) return 0;
        const s = S();
        const dir = await disk.getDirectoryHandle(String(s.seed), { create: true });
        let imported = 0;

        for await (const [name, handle] of dir.entries()) {
          if (handle.kind !== "file" || name === "seed.json" || !name.toLowerCase().endsWith(".json")) continue;
          try {
            const text = await (await handle.getFile()).text();
            const loc = normalizeLocation(JSON.parse(text), s.seed);
            if (!loc || s.locations[loc.id]) continue;

            s.locations[loc.id] = loc;
            const match = /^loc_(\d+)$/.exec(loc.id);
            if (match) s.nextId = Math.max(s.nextId, Number(match[1]) + 1);
            imported++;
          } catch (e) {
            console.warn(`[locations] skipped ${name}:`, e.message);
          }
        }
        return imported;
      },

      // Pick the folder that contains index.html. Files go to Locations/<world seed>/.
      async connectFolder() {
        if (typeof global.showDirectoryPicker !== "function")
          throw new Error("Folder access needs Chrome or Edge (File System Access API).");
        await diskQueue;
        const root = await global.showDirectoryPicker({ mode: "readwrite" });
        disk = await root.getDirectoryHandle("Locations", { create: true });
        const imported = await mod.importDisk();
        await mod.writeAll();
        return { seed: S().seed, count: Object.keys(S().locations).length, imported };
      }
    };

    return mod;
  }

  global.createLocationsModule = createLocationsModule;
})(window);
