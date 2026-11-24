/* Map module v0.2 — static world map and procedural landmark terrain. See ENGINE_SPEC.md.
   The world map is authored in map/data.js: every game loads the same sites and routes,
   so it never rolls random world locations. The module asks the locations module to chart
   those fixed sites, then installs the authored routes through location:link.
   Landmark interiors are generated lazily on the first visit. The room-and-corridor
   generator is self-contained so travel terrain can reuse it later.
   The two modules communicate only through events. */
(function (global) {
  "use strict";
  const D = global.MapData;

  if (!D || !D.world || !Array.isArray(D.world.locations) || !D.world.locations.length)
    throw new Error("map/data.js must define MapData.world.locations with at least one site");

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const int = (value, fallback) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? n : fallback;
  };
  const range = (value, lo, hi, fallback) => {
    if (!Array.isArray(value) || value.length !== 2) return fallback;
    const a = clamp(int(value[0], fallback[0]), lo, hi);
    const b = clamp(int(value[1], fallback[1]), lo, hi);
    return [Math.min(a, b), Math.max(a, b)];
  };

  const TERRAIN = D.terrain && typeof D.terrain === "object" ? D.terrain : {};
  const DEFAULT_TILES = { wall: "#", floor: ".", entrance: "<", rubble: "*", water: "~" };
  const TILES = { ...DEFAULT_TILES, ...(TERRAIN.tiles && typeof TERRAIN.tiles === "object" ? TERRAIN.tiles : {}) };
  for (const key of Object.keys(TILES)) {
    const value = TILES[key];
    TILES[key] = typeof value === "string" && value.length === 1 ? value : DEFAULT_TILES[key];
  }

  const validSites = () => {
    const seen = new Set();
    const sites = [];
    for (const site of D.world.locations) {
      if (!site || typeof site !== "object") continue;
      const key = typeof site.key === "string" ? site.key.trim() : "";
      const name = typeof site.name === "string" ? site.name.trim() : "";
      if (!key || !name || seen.has(key)) continue;
      seen.add(key);
      sites.push({ ...site, key, name });
    }
    return sites;
  };

  const validRoutes = (sites) => {
    const keys = new Set(sites.map((site) => site.key));
    const seen = new Set();
    const routes = [];
    for (const route of Array.isArray(D.world.routes) ? D.world.routes : []) {
      if (!route || typeof route !== "object") continue;
      const from = typeof route.from === "string" ? route.from.trim() : "";
      const to = typeof route.to === "string" ? route.to.trim() : "";
      if (!keys.has(from) || !keys.has(to) || from === to) continue;
      const pair = [from, to].sort().join("|");
      if (seen.has(pair)) continue;
      seen.add(pair);
      routes.push({ from, to, distance: route.distance });
    }
    return routes;
  };

  const interiorPresets = () => {
    const list = Array.isArray(TERRAIN.interiors) ? TERRAIN.interiors : [];
    const seen = new Set();
    return list.filter((preset) => {
      if (!preset || typeof preset.key !== "string" || !preset.key.trim() || seen.has(preset.key)) return false;
      seen.add(preset.key);
      return true;
    });
  };

  // The town a new character enters. Falls back to the first authored site when the
  // configured key is missing, so a hand-edited map still has a valid starting point.
  const startKey = () => {
    const sites = validSites();
    const configured = D.world && typeof D.world.start === "string" ? D.world.start.trim() : "";
    return sites.some((site) => site.key === configured) ? configured : (sites[0] ? sites[0].key : "");
  };

  function buildPreset(raw) {
    const width = clamp(int(raw.width, 21), 9, 61);
    const height = clamp(int(raw.height, 11), 7, 41);
    const roomWidth = range(raw.roomWidth, 2, Math.max(2, width - 2), [3, 6]);
    const roomHeight = range(raw.roomHeight, 2, Math.max(2, height - 2), [3, 4]);
    return {
      key: raw.key,
      label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : raw.key,
      width,
      height,
      roomAttempts: clamp(int(raw.roomAttempts, 8), 1, 40),
      roomWidth: [Math.min(roomWidth[0], width - 2), Math.min(roomWidth[1], width - 2)],
      roomHeight: [Math.min(roomHeight[0], height - 2), Math.min(roomHeight[1], height - 2)],
      rubbleChance: clamp(Number(raw.rubbleChance) || 0, 0, 1),
      waterChance: clamp(Number(raw.waterChance) || 0, 0, 1)
    };
  }

  const randInt = (rng, lo, hi) => lo + Math.floor(rng.next() * (hi - lo + 1));

  function carveRect(grid, x, y, w, h) {
    for (let row = y; row < y + h; row++)
      for (let col = x; col < x + w; col++) grid[row][col] = TILES.floor;
  }

  function carveCorridor(grid, a, b, rng) {
    const horizontalFirst = rng.next() < 0.5;
    const horizontal = () => {
      const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
      for (let x = lo; x <= hi; x++) grid[a.y][x] = TILES.floor;
    };
    const vertical = () => {
      const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
      for (let y = lo; y <= hi; y++) grid[y][b.x] = TILES.floor;
    };
    if (horizontalFirst) { horizontal(); vertical(); }
    else { vertical(); horizontal(); }
  }

  function buildTerrain(preset, engine, locationId) {
    const grid = Array.from({ length: preset.height }, () => Array(preset.width).fill(TILES.wall));
    const rooms = [];

    for (let attempt = 0; attempt < preset.roomAttempts; attempt++) {
      const w = randInt(engine.rng, preset.roomWidth[0], preset.roomWidth[1]);
      const h = randInt(engine.rng, preset.roomHeight[0], preset.roomHeight[1]);
      if (w >= preset.width - 1 || h >= preset.height - 1) continue;
      const x = randInt(engine.rng, 1, preset.width - w - 2);
      const y = randInt(engine.rng, 1, preset.height - h - 2);
      const overlaps = rooms.some((room) =>
        x - 1 < room.x + room.w + 1 && x + w + 1 > room.x - 1 &&
        y - 1 < room.y + room.h + 1 && y + h + 1 > room.y - 1
      );
      if (overlaps) continue;
      const room = { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
      rooms.push(room);
      carveRect(grid, x, y, w, h);
    }

    // Tiny presets can reject every random room. A single central room keeps terrain valid.
    if (!rooms.length) {
      const w = Math.max(3, Math.min(preset.width - 2, 7));
      const h = Math.max(3, Math.min(preset.height - 2, 5));
      const x = Math.floor((preset.width - w) / 2);
      const y = Math.floor((preset.height - h) / 2);
      rooms.push({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });
      carveRect(grid, x, y, w, h);
    }

    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      carveCorridor(grid, { x: a.cx, y: a.cy }, { x: b.cx, y: b.cy }, engine.rng);
    }

    const entrance = rooms[0];
    grid[entrance.cy][entrance.cx] = TILES.entrance;

    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (grid[y][x] !== TILES.floor) continue;
          const roll = engine.rng.next();
          if (roll < preset.waterChance) grid[y][x] = TILES.water;
          else if (roll < preset.waterChance + preset.rubbleChance) grid[y][x] = TILES.rubble;
        }
      }
    }

    const counts = {};
    for (const row of grid)
      for (const tile of row) counts[tile] = (counts[tile] || 0) + 1;

    return {
      locationId,
      interior: preset.key,
      label: preset.label,
      width: preset.width,
      height: preset.height,
      rooms: rooms.length,
      entrance: { x: entrance.cx, y: entrance.cy },
      tiles: grid.map((row) => row.join("")),
      counts,
      generatedAtTick: engine.now.tick,
      generatedAt: engine.now.text
    };
  }

  function createMapModule() {
    let engine = null, bound = false, pending = null, batchSeq = 0;

    const defaults = () => ({
      version: 2,
      loaded: false,
      seed: 0,
      total: 0,
      lastGeneratedTick: null,
      lastGeneratedAt: "",
      sites: {},
      landmarks: {},
      terrain: {}
    });

    // Never cache the slice object: load() replaces the whole state.
    const S = () => engine.state.modules.map;

    const normalize = () => {
      const s = engine.slice("map", defaults());
      if (!s.sites || typeof s.sites !== "object") s.sites = {};
      if (!s.landmarks || typeof s.landmarks !== "object") s.landmarks = {};
      if (!s.terrain || typeof s.terrain !== "object") s.terrain = {};
      s.loaded = !!s.loaded;
      if (!Number.isFinite(Number(s.seed))) s.seed = 0;
      if (!Number.isFinite(Number(s.total))) s.total = 0;
      if (!Number.isFinite(Number(s.lastGeneratedTick))) s.lastGeneratedTick = null;
      if (typeof s.lastGeneratedAt !== "string") s.lastGeneratedAt = "";
      return s;
    };

    const siteForLocation = (locationId) => {
      const s = normalize();
      for (const [key, id] of Object.entries(s.sites)) {
        if (id !== locationId) continue;
        const site = validSites().find((entry) => entry.key === key);
        if (site) return { ...site, id };
      }
      return null;
    };

    function generateTerrain(site, depth = 0) {
      const raw = interiorPresets().find((preset) => preset.key === site.interior);
      if (!raw) return null;
      const preset = buildPreset(raw);
      const terrain = buildTerrain(preset, engine, site.id);
      const s = normalize();
      s.terrain[site.id] = terrain;
      engine.fire({
        type: "map:terrainGenerated",
        text: `${site.name}: generated the ${preset.label.toLowerCase()} (${preset.width}×${preset.height}, ${terrain.rooms} room${terrain.rooms === 1 ? "" : "s"}).`,
        data: {
          locationId: site.id,
          locationName: site.name,
          interior: preset.key,
          label: preset.label,
          width: preset.width,
          height: preset.height,
          rooms: terrain.rooms
        }
      }, depth);
      return terrain;
    }

    const mod = {
      name: "map", depends: ["locations"],

      init(eng) {
        engine = eng;
        normalize();
        pending = null;
        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        engine.on("event:map:load", (e) => mod.load(e.depth + 1, e.data || {}));
        engine.on("event:map:generate", (e) => mod.load(e.depth + 1, e.data || {}));
        engine.on("event:location:added", (e) => mod.onLocationAdded(e));
        engine.on("event:location:visited", (e) => mod.onLocationVisited(e));
      },

      onLoad(eng) {
        engine = eng;
        normalize();
        pending = null;
      },

      // Load the authored map once. It is intentionally idempotent: pressing the UI
      // button twice must not chart a second copy of every site.
      load(depth = 0, data = {}) {
        const s = normalize();
        const sites = validSites();
        const routes = validRoutes(sites);

        if (s.loaded) {
          const result = {
            alreadyLoaded: true,
            total: s.total,
            sites: { ...s.sites },
            landmarks: { ...s.landmarks }
          };
          engine.fire({
            type: "map:generated",
            text: `The static map is already loaded: ${s.total} site${s.total === 1 ? "" : "s"}.`,
            data: result
          }, depth + 1);
          return result;
        }

        const batch = `map_${engine.now.tick}_${++batchSeq}`;
        s.seed = (Number(engine.state.seed) >>> 0) || 1;
        s.loaded = false;
        s.total = sites.length;
        s.lastGeneratedTick = engine.now.tick;
        s.lastGeneratedAt = engine.now.text;
        s.sites = {};
        s.landmarks = {};
        s.terrain = {};

        if (!sites.length) {
          s.loaded = true;
          engine.fire({
            type: "map:generated",
            text: "The static map has no sites.",
            data: { batch, total: 0, sites: {}, landmarks: {} }
          }, depth + 1);
          return { batch, total: 0, sites: {}, landmarks: {} };
        }

        pending = { batch, remaining: sites.length, depth, sites, routes };
        engine.fire({
          type: "location:add",
          text: `Loading the static map: ${sites.length} site${sites.length === 1 ? "" : "s"} and ${routes.length} route${routes.length === 1 ? "" : "s"}.`,
          data: {
            count: 0,
            fixed: sites.map((site) => ({
              key: site.key,
              kind: site.kind || "",
              name: site.name,
              biome: site.biome,
              biomeKey: site.biomeKey,
              weather: site.weather,
              hostility: site.hostility,
              level: site.level,
              autoLink: false
            })),
            batch
          }
        }, depth);

        return { batch, total: sites.length, sites: {}, landmarks: {} };
      },

      onLocationAdded(e) {
        const data = e.data || {};
        const s = normalize();
        if (data.key) s.sites[data.key] = data.id;
        if (data.kind) s.landmarks[data.kind] = data.id;

        if (!pending || data.batch !== pending.batch) return;
        pending.remaining -= 1;
        if (pending.remaining > 0) return;

        const done = pending;
        pending = null;
        s.loaded = true;

        // Install the authored graph after every site exists. These events are queued
        // before map:generated, so a flush leaves both locations and routes complete.
        let links = 0;
        for (const route of done.routes) {
          const fromId = s.sites[route.from];
          const toId = s.sites[route.to];
          if (!fromId || !toId) continue;
          links++;
          engine.fire({
            type: "location:link",
            text: `Charting a route between ${route.from} and ${route.to}.`,
            data: { fromId, toId, distance: route.distance }
          }, e.depth + 1);
        }

        const result = {
          batch: done.batch,
          total: done.sites.length,
          sites: { ...s.sites },
          landmarks: { ...s.landmarks },
          routes: links
        };
        engine.fire({
          type: "map:generated",
          text: `Static map loaded: ${result.total} site${result.total === 1 ? "" : "s"} and ${links} route${links === 1 ? "" : "s"}.`,
          data: result
        }, e.depth + 1);
        return result;
      },

      onLocationVisited(e) {
        const locationId = e.data && e.data.id;
        if (!locationId) return;
        const site = siteForLocation(locationId);
        if (!site || !site.interior || S().terrain[locationId]) return;
        generateTerrain(site, e.depth + 1);
      },

      // Public entry point for the UI and tests. Terrain is built once and kept in the
      // save; later visits read the stored grid instead of rolling a new layout.
      ensureTerrain(locationId, depth = 0) {
        const s = normalize();
        if (s.terrain[locationId]) return s.terrain[locationId];
        const site = siteForLocation(locationId);
        if (!site || !site.interior) return null;
        return generateTerrain(site, depth);
      },

      terrainFor(locationId) {
        return normalize().terrain[locationId] || null;
      },

      siteForLocation(locationId) {
        return siteForLocation(locationId);
      },

      siteFor(key) {
        const s = normalize();
        const id = s.sites[key];
        return id ? { ...validSites().find((site) => site.key === key), id } : null;
      },

      startKey,

      startSite() {
        const key = startKey();
        const s = normalize();
        const id = s.sites[key];
        return id ? { ...validSites().find((site) => site.key === key), id } : null;
      },

      status() {
        const s = normalize();
        return {
          ...s,
          sites: { ...s.sites },
          landmarks: { ...s.landmarks },
          terrain: { ...s.terrain }
        };
      }
    };

    return mod;
  }

  global.createMapModule = createMapModule;
})(window);
