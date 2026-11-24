/* Game module v0.1 — the playable journal layer. See ENGINE_SPEC.md.
   It owns the small amount of campaign state the game screen needs: which sites have been
   visited, how many fights were won or lost, and which journal objectives are complete.
   It never reads another module's slice; progress arrives through events and the authored
   site names are read from map/data.js.
   Data lives in game/data.js. The old sandbox UI lives in debug.html. */
(function (global) {
  "use strict";
  const D = global.GameData;

  if (!D || !Array.isArray(D.objectives) || !D.objectives.length)
    throw new Error("game/data.js must define GameData.objectives");

  const OBJECTIVES = D.objectives
    .filter((objective) => objective && typeof objective.key === "string" && objective.key.trim())
    .map((objective) => ({
      key: objective.key.trim(),
      label: typeof objective.label === "string" && objective.label.trim() ? objective.label : objective.key,
      hint: typeof objective.hint === "string" ? objective.hint : "",
      type: ["visit", "action", "victory"].includes(objective.type) ? objective.type : "visit",
      site: typeof objective.site === "string" ? objective.site : "",
      siteKind: typeof objective.siteKind === "string" ? objective.siteKind : "",
      after: typeof objective.after === "string" ? objective.after : ""
    }));

  if (!OBJECTIVES.length) throw new Error("game/data.js must define at least one valid objective");

  const SITES = () => (global.MapData && global.MapData.world && Array.isArray(global.MapData.world.locations))
    ? global.MapData.world.locations : [];
  const startKey = () => {
    const world = global.MapData && global.MapData.world ? global.MapData.world : {};
    const sites = SITES();
    const configured = typeof world.start === "string" ? world.start : "";
    return sites.some((site) => site.key === configured) ? configured : (sites[0] ? sites[0].key : "");
  };
  const siteForKey = (key) => SITES().find((site) => site.key === key) || null;
  const siteForKind = (kind) => SITES().find((site) => site.kind === kind) || null;
  const tavernSite = () => siteForKind("tavern");

  function createGameModule() {
    let engine = null, bound = false;

    const S = () => engine.state.modules.game;   // never cache: load() replaces the state

    const defaults = () => ({
      started: false,
      startedAtTick: null,
      completedAtTick: null,
      visited: {},
      completed: {},
      objectiveOrder: {},
      sequence: 0,
      actions: 0,
      lastActionOrder: 0,
      victories: 0,
      lastVictoryOrder: 0,
      defeats: 0,
      updatedAtTick: null
    });

    const normalize = () => {
      const s = engine.slice("game", defaults());
      if (!s.visited || typeof s.visited !== "object" || Array.isArray(s.visited)) s.visited = {};
      if (!s.completed || typeof s.completed !== "object" || Array.isArray(s.completed)) s.completed = {};
      if (!s.objectiveOrder || typeof s.objectiveOrder !== "object" || Array.isArray(s.objectiveOrder)) s.objectiveOrder = {};
      for (const objective of OBJECTIVES) s.completed[objective.key] = s.completed[objective.key] === true;
      s.started = s.started === true;
      s.sequence = Math.max(0, Math.round(Number(s.sequence) || 0));
      s.actions = Math.max(0, Math.round(Number(s.actions) || 0));
      s.lastActionOrder = Math.max(0, Math.round(Number(s.lastActionOrder) || 0));
      s.victories = Math.max(0, Math.round(Number(s.victories) || 0));
      s.lastVictoryOrder = Math.max(0, Math.round(Number(s.lastVictoryOrder) || 0));
      s.defeats = Math.max(0, Math.round(Number(s.defeats) || 0));
      if (!Number.isFinite(s.startedAtTick)) s.startedAtTick = null;
      if (!Number.isFinite(s.completedAtTick)) s.completedAtTick = null;
      if (!Number.isFinite(s.updatedAtTick)) s.updatedAtTick = null;
      if (s.completedAtTick === null && OBJECTIVES.every((objective) => s.completed[objective.key]))
        s.completedAtTick = s.updatedAtTick;
      return s;
    };

    const resolveSiteKey = (objective) => {
      if (objective.siteKind) {
        const site = siteForKind(objective.siteKind);
        return site ? site.key : "";
      }
      if (objective.site === "{start}") return startKey();
      return objective.site || "";
    };

    const fill = (text, objective = null) => {
      const tavern = tavernSite();
      const siteKey = objective ? resolveSiteKey(objective) : "";
      const site = siteKey ? siteForKey(siteKey) : null;
      const start = siteForKey(startKey());
      return String(text || "")
        .replace(/\{start\}/g, (start && start.name) || "the starting town")
        .replace(/\{tavern\}/g, (tavern && tavern.name) || "the tavern")
        .replace(/\{site\}/g, (site && site.name) || siteKey || "the road");
    };

    const publicObjectives = (s) => OBJECTIVES.map((objective) => ({
      key: objective.key,
      label: fill(objective.label, objective),
      hint: fill(objective.hint, objective),
      type: objective.type,
      done: s.completed[objective.key] === true
    }));

    const emit = (event, objective, depth) => {
      const s = normalize();
      const objectives = publicObjectives(s);
      const done = objectives.filter((entry) => entry.done).length;
      engine.fire({
        type: "game:progress",
        text: objective
          ? `Journal: ${objective.label} complete.`
          : event === "started" ? "The journal opens." : (D.completeText || "Journal complete."),
        data: {
          event,
          objective: objective ? { key: objective.key, label: objective.label } : null,
          objectives,
          done,
          total: objectives.length,
          complete: done === objectives.length,
          visited: Object.keys(s.visited).length,
          victories: s.victories,
          defeats: s.defeats,
          actions: s.actions,
          updatedAtTick: s.updatedAtTick,
          completedAtTick: s.completedAtTick
        }
      }, depth + 1);
    };

    const evaluate = (depth = 0) => {
      const s = normalize();
      let changed = false;
      for (const objective of OBJECTIVES) {
        if (s.completed[objective.key]) continue;
        if (objective.after && !s.completed[objective.after]) continue;
        let done = false;
        if (objective.type === "visit") {
          const key = resolveSiteKey(objective);
          const visit = key ? s.visited[key] : null;
          done = !!visit;
          if (done && objective.after && s.objectiveOrder[objective.after] !== undefined)
            done = (Number(visit.order) || 0) > (Number(s.objectiveOrder[objective.after]) || 0);
        } else if (objective.type === "action") {
          done = s.actions > 0;
          if (done && objective.after && s.objectiveOrder[objective.after] !== undefined)
            done = s.lastActionOrder > (Number(s.objectiveOrder[objective.after]) || 0);
        } else if (objective.type === "victory") {
          done = s.victories > 0;
          if (done && objective.after && s.objectiveOrder[objective.after] !== undefined)
            done = s.lastVictoryOrder > (Number(s.objectiveOrder[objective.after]) || 0);
        }
        if (!done) continue;
        s.completed[objective.key] = true;
        s.objectiveOrder[objective.key] = s.sequence;
        s.updatedAtTick = engine.now.tick;
        const allDone = OBJECTIVES.every((entry) => s.completed[entry.key]);
        if (allDone && s.completedAtTick === null) s.completedAtTick = engine.now.tick;
        emit(allDone ? "complete" : "objective", { key: objective.key, label: fill(objective.label, objective) }, depth);
        changed = true;
        if (allDone) break;
      }
      return changed;
    };

    const visitKey = (data) => {
      const name = data && typeof data.name === "string" ? data.name.trim().toLowerCase() : "";
      const site = SITES().find((entry) => String(entry.name || "").trim().toLowerCase() === name);
      return site ? site.key : "";
    };

    const mod = {
      name: "game", depends: [],

      init(eng) {
        engine = eng;
        normalize();
        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        const start = (depth) => {
          const s = normalize();
          if (s.started) return;
          s.started = true;
          s.startedAtTick = engine.now.tick;
          s.updatedAtTick = engine.now.tick;
          emit("started", null, depth);
        };
        engine.on("event:creator:created", (e) => start(e.depth + 1));
        engine.on("event:mainCharacter:saved", (e) => start(e.depth + 1));
        engine.on("event:location:visited", (e) => {
          const key = visitKey(e.data || {});
          if (!key) return;
          const s = normalize();
          s.sequence += 1;
          s.visited[key] = { atTick: engine.now.tick, order: s.sequence };
          s.updatedAtTick = engine.now.tick;
          evaluate(e.depth + 1);
        });
        engine.on("event:action:resolved", (e) => {
          const s = normalize();
          s.sequence += 1;
          s.actions += 1;
          s.lastActionOrder = s.sequence;
          s.updatedAtTick = engine.now.tick;
          evaluate(e.depth + 1);
        });
        engine.on("event:combat:ended", (e) => {
          const data = e.data || {};
          const s = normalize();
          s.sequence += 1;
          if (data.winnerId === "main") {
            s.victories += 1;
            s.lastVictoryOrder = s.sequence;
          } else if (data.loserId === "main") s.defeats += 1;
          s.updatedAtTick = engine.now.tick;
          evaluate(e.depth + 1);
        });
      },

      onLoad(eng) {
        engine = eng;
        normalize();
      },

      objectives() {
        return publicObjectives(normalize());
      },

      currentObjective() {
        return publicObjectives(normalize()).find((objective) => !objective.done) || null;
      },

      progress() {
        const s = normalize();
        const objectives = publicObjectives(s);
        const done = objectives.filter((objective) => objective.done).length;
        return {
          objectives,
          done,
          total: objectives.length,
          complete: done === objectives.length,
          started: s.started,
          visited: Object.keys(s.visited).length,
          victories: s.victories,
          defeats: s.defeats,
          actions: s.actions,
          updatedAtTick: s.updatedAtTick,
          completedAtTick: s.completedAtTick
        };
      },

      status() {
        const s = normalize();
        return {
          started: s.started,
          startedAtTick: s.startedAtTick,
          completedAtTick: s.completedAtTick,
          visited: { ...s.visited },
          completed: { ...s.completed },
          actions: s.actions,
          victories: s.victories,
          defeats: s.defeats,
          updatedAtTick: s.updatedAtTick
        };
      }
    };

    return mod;
  }

  global.createGameModule = createGameModule;
})(window);
