/* Locations module v0.5 — procedural map locations, routes, levels and biome events.
   Locations are generated when the UI or map module fires location:add. A request may
   carry a fixed definition (name/kind/biome/weather/hostility/level) used for guaranteed
   map landmarks; normal requests still roll from the content tables.
   Add a generated field: push one { key, generate } entry into ATTRIBUTES. Order matters;
   each entry sees the location built so far. Content belongs in data.js.
   Every location has a hostility (1-100, 50 is neutral) and a level from its biome's
   levelRange; both are stored as a framework for later progression.
   Each new location is linked to 1-2 existing locations (bidirectional connections with an
   abstract distance); route time is distance * travelGraph.minutesPerDistance.
   Biome events live in locations/events/<biomeKey>/events.json and are fetched lazily.
   An event's hostilityModifier scales its chance: positive makes a bad event more likely at
   high hostility, negative makes it less likely. See locations/events/README.md. */
(function (global) {
  "use strict";
  const D = global.LocationData;

  if (!D || !Array.isArray(D.biomes) || !D.biomes.length)
    throw new Error("locations/data.js must define LocationData.biomes with at least one biome");

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const DEFAULT_HOSTILITY = clamp(
    Math.round(Number(D.defaultHostility)) || 50, 1, 100
  );
  const DEFAULT_LEVEL = Math.max(1, Math.round(Number(D.defaultLevel)) || 1);

  const GRAPH = D.travelGraph && typeof D.travelGraph === "object" ? D.travelGraph : {};
  const distanceRange = Array.isArray(GRAPH.distanceRange) ? GRAPH.distanceRange : [1, 4];
  const DISTANCE_MIN = Math.max(1, Math.min(Number(distanceRange[0]) || 1, Number(distanceRange[1]) || 4));
  const DISTANCE_MAX = Math.max(DISTANCE_MIN, Number(distanceRange[1]) || 4);
  const MINUTES_PER_DISTANCE = clamp(Math.round(Number(GRAPH.minutesPerDistance) || 15), 1, 1440);
  const linkRange = Array.isArray(GRAPH.links) ? GRAPH.links : [1, 2];
  const LINKS_MIN = Math.max(1, Math.min(Number(linkRange[0]) || 1, Number(linkRange[1]) || 2));
  const LINKS_MAX = Math.max(LINKS_MIN, Number(linkRange[1]) || 2);
  const LEGACY_DISTANCE = clamp(
    Math.round(Number(GRAPH.legacyDistance) || DISTANCE_MIN), DISTANCE_MIN, DISTANCE_MAX
  );

  const pick = (rng, arr) => arr[Math.floor(rng.next() * arr.length)];
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
    const range = Array.isArray(biome.hostility) ? biome.hostility : [DEFAULT_HOSTILITY, DEFAULT_HOSTILITY];
    const lo = clamp(Math.round(Number(range[0]) || DEFAULT_HOSTILITY), 1, 100);
    const hi = clamp(Math.round(Number(range[1]) || DEFAULT_HOSTILITY), 1, 100);
    const min = Math.min(lo, hi), max = Math.max(lo, hi);
    return min + Math.floor(rng.next() * (max - min + 1));
  }

  function levelFor(rng, biome) {
    const range = Array.isArray(biome && biome.levelRange) ? biome.levelRange : [DEFAULT_LEVEL, DEFAULT_LEVEL];
    const lo = Math.max(1, Math.round(Number(range[0]) || DEFAULT_LEVEL));
    const hi = Math.max(lo, Math.round(Number(range[1]) || DEFAULT_LEVEL));
    return lo + Math.floor(rng.next() * (hi - lo + 1));
  }

  function uniqueName(base, usedNames) {
    let name = base, n = 2;
    while (usedNames.has(name)) name = `${base} (${n++})`;
    return name;
  }

  // Fixed definitions come from the map module (guaranteed landmarks). They still go
  // through spawn(), connections and location:added like any other location.
  function normalizeFixed(raw) {
    if (!raw || typeof raw !== "object") return null;
    const kind = typeof raw.kind === "string" ? raw.kind.trim() : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!kind || !name) return null;
    const biome = typeof raw.biome === "string" && raw.biome.trim() ? raw.biome.trim() : "Landmark";
    const biomeKey = typeof raw.biomeKey === "string" && raw.biomeKey.trim() ? raw.biomeKey.trim() : "landmark";
    const weather = typeof raw.weather === "string" && raw.weather.trim() ? raw.weather.trim() : "Clear";
    const hostility = clamp(Math.round(Number(raw.hostility)) || DEFAULT_HOSTILITY, 1, 100);
    const level = Math.max(1, Math.round(Number(raw.level)) || DEFAULT_LEVEL);
    return { kind, name, biome, biomeKey, weather, hostility, level };
  }

  // Route distance is an abstract whole number. Duration is derived from it, so content
  // only edits the distance range and the minutes-per-distance ratio.
  function normalizeDistance(value) {
    const n = Math.round(Number(value));
    return clamp(Number.isFinite(n) ? n : DISTANCE_MIN, DISTANCE_MIN, DISTANCE_MAX);
  }

  function travelMinutes(distance) {
    const value = Math.max(1, Math.round(Number(distance) || 1));
    return clamp(value * MINUTES_PER_DISTANCE, 1, 1440);
  }

  function rollDistance(rng) {
    return DISTANCE_MIN + Math.floor(rng.next() * (DISTANCE_MAX - DISTANCE_MIN + 1));
  }

  function cleanConnections(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const list = [];
    for (const entry of raw) {
      const id = typeof entry === "string"
        ? entry.trim()
        : (entry && typeof entry.id === "string" ? entry.id.trim() : "");
      if (!/^loc_\d+$/.test(id) || seen.has(id)) continue;
      seen.add(id);
      list.push({ id, distance: normalizeDistance(entry && entry.distance) });
    }
    return list;
  }

  const ATTRIBUTES = [
    { key: "biome", generate: ({ rng }) => weightedPick(rng, D.biomes) },
    { key: "name", generate: ({ rng, loc, usedNames }) => makeName(rng, loc.biome, usedNames) },
    { key: "weather", generate: ({ rng, loc }) => pick(rng, weatherList(loc.biome)) },
    { key: "hostility", generate: ({ rng, loc }) => hostilityFor(rng, loc.biome) },
    { key: "level", generate: ({ rng, loc }) => levelFor(rng, loc.biome) }
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
    const hostility = Number(data.hostility);
    if (!name || !biome || !weather) return null;

    const knownBiome = D.biomes.find((b) => b.name === biome || b.key === data.biomeKey);
    const level = Math.max(1, Math.round(Number(data.level)) || (knownBiome ? Number(knownBiome.levelRange && knownBiome.levelRange[0]) : DEFAULT_LEVEL) || DEFAULT_LEVEL);
    return {
      id,
      name,
      biome,
      biomeKey: typeof data.biomeKey === "string" && data.biomeKey ? data.biomeKey : (knownBiome ? knownBiome.key : ""),
      kind: typeof data.kind === "string" ? data.kind.trim() : "",
      weather,
      hostility: Number.isFinite(hostility) ? clamp(hostility, 1, 100) : DEFAULT_HOSTILITY,
      level,
      connections: cleanConnections(data.connections),
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
    const rawModifier = Number(raw.hostilityModifier);
    const hostilityModifier = clamp(Number.isFinite(rawModifier) ? rawModifier : 0, -4, 4);

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
      hostilityModifier,
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

    // Routes are stored on both endpoints so either location can list them. Distances are
    // symmetric; when a loaded save disagrees, the shorter route wins deterministically.
    const addRoute = (fromId, toId, distance) => {
      const s = S();
      const from = s.locations[fromId], to = s.locations[toId];
      if (!from || !to || fromId === toId) return null;
      if (!Array.isArray(from.connections)) from.connections = [];
      if (!Array.isArray(to.connections)) to.connections = [];

      const forward = from.connections.find((route) => route.id === toId);
      const backward = to.connections.find((route) => route.id === fromId);
      const value = Math.min(
        forward ? normalizeDistance(forward.distance) : normalizeDistance(distance),
        backward ? normalizeDistance(backward.distance) : normalizeDistance(distance)
      );

      if (forward) forward.distance = value;
      else from.connections.push({ id: toId, distance: value });
      if (backward) backward.distance = value;
      else to.connections.push({ id: fromId, distance: value });
      return { fromId, toId, distance: value };
    };

    // Repair a loaded/imported graph: drop dangling and self routes, make edges mutual,
    // de-duplicate and link isolated legacy locations into the charted map.
    const normalizeGraph = () => {
      const s = S();
      if (!s.locations || typeof s.locations !== "object") s.locations = {};
      const locations = Object.values(s.locations);
      const byId = new Map(locations.map((loc) => [loc.id, loc]));

      for (const loc of locations) {
        if (!Number.isFinite(Number(loc.hostility))) loc.hostility = DEFAULT_HOSTILITY;
        else loc.hostility = clamp(Math.round(Number(loc.hostility)), 1, 100);
        if (!Number.isFinite(Number(loc.level))) loc.level = DEFAULT_LEVEL;
        else loc.level = Math.max(1, Math.round(Number(loc.level)));
        loc.connections = cleanConnections(loc.connections)
          .filter((route) => route.id !== loc.id && byId.has(route.id));
      }

      for (const loc of locations) {
        for (const route of loc.connections) {
          const other = byId.get(route.id);
          if (!other) continue;
          const reverse = other.connections.find((entry) => entry.id === loc.id);
          if (!reverse) {
            other.connections.push({ id: loc.id, distance: normalizeDistance(route.distance) });
          } else {
            const value = Math.min(normalizeDistance(route.distance), normalizeDistance(reverse.distance));
            route.distance = value;
            reverse.distance = value;
          }
        }
      }

      for (const loc of locations) {
        const seen = new Set();
        loc.connections = loc.connections.filter((route) => {
          if (seen.has(route.id)) return false;
          seen.add(route.id);
          route.distance = normalizeDistance(route.distance);
          return true;
        });
      }

      if (locations.length > 1) {
        const anchor = locations[0];
        for (const loc of locations) {
          if (loc.connections.length) continue;
          const target = loc === anchor ? locations[1] : anchor;
          addRoute(loc.id, target.id, LEGACY_DISTANCE);
        }
      }
      return locations;
    };

    // A newly charted location links to the current area when there is one, plus enough
    // random neighbours to reach the configured link count. This keeps the graph connected.
    const connectNew = (loc) => {
      const s = S();
      const others = Object.values(s.locations).filter((other) => other.id !== loc.id);
      if (!others.length) return [];

      const count = LINKS_MIN + Math.floor(engine.rng.next() * (LINKS_MAX - LINKS_MIN + 1));
      const targets = [];
      const current = s.currentId ? s.locations[s.currentId] : null;
      if (current && current.id !== loc.id) targets.push(current);

      const pool = others.filter((other) => !targets.some((target) => target.id === other.id));
      while (targets.length < Math.min(count, others.length) && pool.length) {
        const index = Math.floor(engine.rng.next() * pool.length);
        targets.push(pool.splice(index, 1)[0]);
      }

      return targets.map((target) => addRoute(loc.id, target.id, rollDistance(engine.rng)));
    };

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
        normalizeGraph();

        if (bound) {   // init runs again on reset: subscribe only once
          if (disk) queueDisk(() => mod.writeSeed());
          return;
        }
        bound = true;
        engine.on("event:location:add", (e) => mod.add(
          e.depth + 1,
          e.data && e.data.count,
          e.data && e.data.fixed,
          e.data && e.data.batch
        ));
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
        normalizeGraph();
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
            hostility: hostilityFor(rng, pair.biome),
            level: levelFor(rng, pair.biome)
          };
        }
        return candidate;
      },

      add(depth = 0, count = 1, fixed = null, batch = "") {
        const fixedList = (Array.isArray(fixed) ? fixed : fixed ? [fixed] : [])
          .map(normalizeFixed).filter(Boolean);
        const requested = Number(count);
        const n = count === undefined || count === null
          ? 1
          : Number.isFinite(requested) ? clamp(Math.floor(requested), 0, 100) : 1;

        const added = [];
        for (const item of fixedList) added.push(mod.spawn(depth, item, batch));
        for (let i = 0; i < n; i++) added.push(mod.spawn(depth, null, batch));
        return added;
      },

      spawn(depth = 0, fixed = null, batch = "") {
        const s = S(), now = engine.now;
        const usedNames = new Set(Object.values(s.locations).map((l) => l.name));
        const fixedDef = normalizeFixed(fixed);
        let loc;

        if (fixedDef) {
          loc = {
            id: "loc_" + String(s.nextId++).padStart(4, "0"),
            name: uniqueName(fixedDef.name, usedNames),
            biome: fixedDef.biome,
            biomeKey: fixedDef.biomeKey,
            kind: fixedDef.kind,
            weather: fixedDef.weather,
            hostility: fixedDef.hostility,
            level: fixedDef.level,
            connections: [],
            seed: s.seed,
            createdAtTick: now.tick,
            createdAt: now.text
          };
        } else {
          // Landmarks use a synthetic biome/weather pair; keep them out of the random
          // biome/weather uniqueness pool.
          const usedCombos = new Set(Object.values(s.locations)
            .filter((l) => l.biomeKey !== "landmark")
            .map((l) => comboKey(l.biome, l.weather)));
          const raw = mod.generate(engine.rng, usedNames, usedCombos);
          loc = {
            id: "loc_" + String(s.nextId++).padStart(4, "0"),
            name: raw.name,
            biome: raw.biome.name,
            biomeKey: raw.biome.key,
            kind: "",
            weather: raw.weather,
            hostility: raw.hostility,
            level: raw.level,
            connections: [],
            seed: s.seed,
            createdAtTick: now.tick,
            createdAt: now.text
          };
        }

        s.locations[loc.id] = loc;
        connectNew(loc);
        if (disk) queueDisk(() => mod.writeLocation(loc));

        const label = mod.labelFor(loc.hostility);
        const routes = loc.connections.length;
        const routeText = routes ? `, ${routes} route${routes === 1 ? "" : "s"}` : "";
        const text = loc.kind
          ? `${loc.name} (${loc.kind}) is charted as a landmark: ${loc.biome.toLowerCase()}, ${loc.weather.toLowerCase()}, level ${loc.level}, hostility ${loc.hostility}/100 (${label})${routeText}.`
          : `${loc.name} is charted: ${loc.biome.toLowerCase()}, ${loc.weather.toLowerCase()}, level ${loc.level}, hostility ${loc.hostility}/100 (${label})${routeText}.`;
        const data = { id: loc.id, level: loc.level, hostility: loc.hostility };
        if (loc.kind) data.kind = loc.kind;
        if (batch) data.batch = batch;

        engine.fire({ type: "location:added", text, data }, depth);
        return loc;
      },

      labelFor(hostility) {
        const value = clamp(Math.round(Number(hostility) || 0), 1, 100);
        for (const band of D.hostilityBands || [])
          if (value <= band.max) return band.label;
        return `${value}/100`;
      },

      // Routes from one location, enriched for the UI. Sorted by distance, then name.
      connectionsFor(id) {
        const s = S();
        const loc = s.locations[id];
        if (!loc) return [];
        return (loc.connections || []).map((route) => {
          const target = s.locations[route.id];
          if (!target) return null;
          const distance = normalizeDistance(route.distance);
          return {
            id: target.id,
            name: target.name,
            biome: target.biome,
            biomeKey: target.biomeKey,
            kind: target.kind || "",
            weather: target.weather,
            hostility: target.hostility,
            level: target.level,
            distance,
            minutes: travelMinutes(distance)
          };
        }).filter(Boolean).sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
      },

      routeBetween(fromId, toId) {
        const from = S().locations[fromId];
        if (!from || fromId === toId) return null;
        const route = (from.connections || []).find((entry) => entry.id === toId);
        if (!route) return null;
        const distance = normalizeDistance(route.distance);
        return { fromId, toId, distance, minutes: travelMinutes(distance) };
      },

      travelMinutes,

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

      // A bad event has a positive modifier: at hostility 100 its chance is doubled for
      // modifier 1, while a safe location (hostility 0) removes it. A negative modifier
      // does the reverse for helpful events. 50 is the neutral point.
      eventChance(event, hostility) {
        const base = clamp(Number(event && event.chance) || 0, 0, 1);
        const modifier = clamp(Number(event && event.hostilityModifier) || 0, -4, 4);
        const value = clamp(Number(hostility), 1, 100);
        const level = Number.isFinite(value) ? value : DEFAULT_HOSTILITY;
        const factor = clamp(1 + modifier * ((level - 50) / 50), 0, 5);
        return clamp(base * factor, 0, 1);
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
          const chance = mod.eventChance(event, loc.hostility);
          if (!event.enabled || chance <= 0) continue;
          const roll = engine.rng.next();
          if (roll >= chance) continue;

          const chancePercent = Math.round(chance * 1000) / 10;
          const record = { ...event, chance, chancePercent, roll };
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
              chancePercent,
              baseChancePercent: event.chancePercent,
              hostility: loc.hostility,
              hostilityModifier: event.hostilityModifier,
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
            biomeKey: loc.biomeKey, weather: loc.weather, hostility: loc.hostility,
            level: loc.level
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
        normalizeGraph();
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
