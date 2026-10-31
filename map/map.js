/* Map module v0.1 — map-level spawner. See ENGINE_SPEC.md.
   It does not create locations itself: it owns map metadata and asks the locations
   module to spawn a fixed number of random locations plus the fixed landmarks in
   map/data.js. The two modules communicate only through events.
   Landmark kinds are recorded by id so future systems can find the tavern/castle/shack. */
(function (global) {
  "use strict";
  const D = global.MapData;

  if (!D || !Array.isArray(D.landmarks))
    throw new Error("map/data.js must define MapData.landmarks");

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const fallbackSize = Math.max(0, Math.floor(Number(D.defaultLocationCount) || 0));
  const minSize = Math.max(0, Math.floor(Number(D.minLocationCount) || 0));
  const maxSize = Math.max(minSize, Math.floor(Number(D.maxLocationCount) || 100));

  const validLandmarks = () => D.landmarks.filter((landmark) =>
    landmark && typeof landmark.kind === "string" && landmark.kind.trim() &&
    typeof landmark.name === "string" && landmark.name.trim()
  );

  function createMapModule() {
    let engine = null, bound = false, pending = null, batchSeq = 0;

    const defaults = () => ({
      seed: 0, size: 0, total: 0,
      lastGeneratedTick: null, lastGeneratedAt: "",
      landmarks: {}
    });

    // Never cache the slice object: load() replaces the whole state.
    const S = () => engine.state.modules.map;

    const normalize = () => {
      const s = engine.slice("map", defaults());
      if (!s.landmarks || typeof s.landmarks !== "object") s.landmarks = {};
      if (!Number.isFinite(Number(s.size))) s.size = 0;
      if (!Number.isFinite(Number(s.total))) s.total = 0;
      if (!Number.isFinite(Number(s.lastGeneratedTick))) s.lastGeneratedTick = null;
      if (typeof s.lastGeneratedAt !== "string") s.lastGeneratedAt = "";
      return s;
    };

    const mod = {
      name: "map", depends: ["locations"],

      init(eng) {
        engine = eng;
        normalize();
        pending = null;
        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        engine.on("event:map:generate", (e) => mod.generate(e.depth + 1, e.data || {}));
        engine.on("event:location:added", (e) => mod.onLocationAdded(e));
      },

      onLoad(eng) {
        engine = eng;
        normalize();
        pending = null;
      },

      // Request one batch: fixed landmarks first, then the random count. The request is
      // asynchronous through the event queue, so map:generated is emitted after every
      // location:added in this batch has arrived.
      generate(depth = 0, data = {}) {
        const requested = Number(data.count);
        const size = Number.isFinite(requested)
          ? clamp(Math.floor(requested), minSize, maxSize)
          : clamp(fallbackSize, minSize, maxSize);
        const landmarks = validLandmarks();
        const total = size + landmarks.length;
        const batch = `map_${engine.now.tick}_${++batchSeq}`;

        const s = normalize();
        s.seed = (Number(engine.state.seed) >>> 0) || 1;
        s.size = size;
        s.total = total;
        s.lastGeneratedTick = engine.now.tick;
        s.lastGeneratedAt = engine.now.text;
        s.landmarks = {};

        if (!total) {
          engine.fire({
            type: "map:generated",
            text: "Map generated with no locations.",
            data: { batch, count: 0, total: 0, landmarks: {} }
          }, depth + 1);
          return { batch, count: 0, total: 0, landmarks: {} };
        }

        pending = { batch, remaining: total, depth, size, total };
        engine.fire({
          type: "location:add",
          text: `Generating a map: ${landmarks.length} fixed landmark${landmarks.length === 1 ? "" : "s"} and ${size} random location${size === 1 ? "" : "s"}.`,
          data: { count: size, fixed: landmarks, batch }
        }, depth);
        return { batch, count: size, total, landmarks: landmarks.map((landmark) => landmark.kind) };
      },

      onLocationAdded(e) {
        const data = e.data || {};
        const s = normalize();
        if (data.kind) s.landmarks[data.kind] = data.id;

        if (!pending || data.batch !== pending.batch) return;
        pending.remaining -= 1;
        if (pending.remaining > 0) return;

        const result = {
          batch: pending.batch,
          count: pending.size,
          total: pending.total,
          landmarks: { ...s.landmarks }
        };
        pending = null;
        engine.fire({
          type: "map:generated",
          text: `Map generated: ${result.count} random location${result.count === 1 ? "" : "s"} and ${Object.keys(result.landmarks).length} fixed landmark${Object.keys(result.landmarks).length === 1 ? "" : "s"}.`,
          data: result
        }, e.depth + 1);
      },

      status() {
        const s = normalize();
        return { ...s, landmarks: { ...s.landmarks } };
      }
    };

    return mod;
  }

  global.createMapModule = createMapModule;
})(window);
