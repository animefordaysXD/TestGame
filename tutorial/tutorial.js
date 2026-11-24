/* Tutorial module v0.1 — persistent first-steps progress. See ENGINE_SPEC.md.
   The module owns one JSON-safe slice and listens to game events; it never reads another
   module's slice. Content (labels and hints) lives in tutorial/data.js.
   Steps: create a character, arrive in the starting town, take an action, reach the tavern. */
(function (global) {
  "use strict";
  const D = global.TutorialData;

  if (!D || !Array.isArray(D.steps) || !D.steps.length)
    throw new Error("tutorial/data.js must define TutorialData.steps");

  const REQUIRED = ["created", "arrived", "action", "travel"];
  const STEP_KEYS = D.steps.map((step) => step && step.key).filter((key) => typeof key === "string");
  for (const key of REQUIRED) {
    if (!STEP_KEYS.includes(key))
      throw new Error(`TutorialData.steps must include "${key}"`);
  }

  const byKey = new Map(D.steps.map((step) => [step.key, step]));

  function createTutorialModule() {
    let engine = null, bound = false;

    const S = () => engine.state.modules.tutorial;   // never cache: load() replaces the state

    const defaults = () => ({
      started: false,
      steps: Object.fromEntries(STEP_KEYS.map((key) => [key, false])),
      updatedAtTick: null,
      completedAtTick: null
    });

    const normalize = () => {
      const s = engine.slice("tutorial", defaults());
      if (!s.steps || typeof s.steps !== "object" || Array.isArray(s.steps)) s.steps = {};
      for (const key of STEP_KEYS) s.steps[key] = s.steps[key] === true;
      s.started = STEP_KEYS.some((key) => s.steps[key]);
      if (!Number.isFinite(s.updatedAtTick)) s.updatedAtTick = null;
      if (!Number.isFinite(s.completedAtTick)) s.completedAtTick = null;
      if (s.completedAtTick === null && STEP_KEYS.every((key) => s.steps[key]))
        s.completedAtTick = s.updatedAtTick;
      return s;
    };

    const siteName = (predicate, fallback) => {
      const sites = global.MapData && global.MapData.world && Array.isArray(global.MapData.world.locations)
        ? global.MapData.world.locations : [];
      const site = sites.find(predicate);
      return site && typeof site.name === "string" && site.name.trim() ? site.name : fallback;
    };
    const startName = () => {
      const world = global.MapData && global.MapData.world ? global.MapData.world : {};
      return siteName((site) => site.key === world.start, "the starting town");
    };
    const tavernName = () => siteName((site) => site.kind === "tavern", "the tavern");
    const fill = (text) => String(text || "")
      .replace(/\{start\}/g, startName())
      .replace(/\{tavern\}/g, tavernName());

    const mark = (key, depth = 0) => {
      if (!STEP_KEYS.includes(key)) return null;
      const s = normalize();
      if (s.steps[key]) return null;

      s.steps[key] = true;
      s.started = true;
      s.updatedAtTick = engine.now.tick;
      const complete = STEP_KEYS.every((entry) => s.steps[entry]);
      if (complete && s.completedAtTick === null) s.completedAtTick = engine.now.tick;

      const step = byKey.get(key) || {};
      engine.fire({
        type: "tutorial:progress",
        text: complete
          ? fill(D.completeText)
          : `Tutorial step complete: ${fill(step.label || key)}.`,
        data: {
          step: key,
          steps: { ...s.steps },
          completed: complete,
          updatedAtTick: s.updatedAtTick,
          completedAtTick: s.completedAtTick
        }
      }, depth + 1);
      return s;
    };

    const isTavern = (name) => typeof name === "string" && name.trim().toLowerCase() === tavernName().toLowerCase();

    const mod = {
      name: "tutorial", depends: [],

      init(eng) {
        engine = eng;
        normalize();
        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        engine.on("event:creator:created", (e) => mark("created", e.depth + 1));
        engine.on("event:mainCharacter:saved", (e) => mark("created", e.depth + 1));
        engine.on("event:location:visited", (e) => {
          mark("arrived", e.depth + 1);
          if (isTavern(e.data && e.data.name)) mark("travel", e.depth + 1);
        });
        engine.on("event:action:resolved", (e) => mark("action", e.depth + 1));
        engine.on("event:travel:completed", (e) => {
          if (isTavern(e.data && e.data.destinationName)) mark("travel", e.depth + 1);
        });
      },

      onLoad(eng) {
        engine = eng;
        normalize();
      },

      // Used by the UI/status page.
      progress() {
        const s = normalize();
        const done = STEP_KEYS.filter((key) => s.steps[key]);
        return {
          steps: { ...s.steps },
          done: done.length,
          total: STEP_KEYS.length,
          complete: done.length === STEP_KEYS.length,
          updatedAtTick: s.updatedAtTick,
          completedAtTick: s.completedAtTick
        };
      },

      steps() {
        return D.steps.map((step) => ({
          key: step.key,
          label: fill(step.label || step.key),
          hint: fill(step.hint || "")
        }));
      },

      status() {
        const s = normalize();
        return {
          started: s.started,
          steps: { ...s.steps },
          updatedAtTick: s.updatedAtTick,
          completedAtTick: s.completedAtTick
        };
      }
    };

    return mod;
  }

  global.createTutorialModule = createTutorialModule;
})(window);
