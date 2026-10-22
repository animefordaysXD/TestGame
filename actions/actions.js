/* Actions module v0.1 — five placeholder choices loaded when a location is visited.
   It listens to location:visited and action:choose; it does not call the locations
   module directly. Content lives in actions/data.js. See ENGINE_SPEC.md. */
(function (global) {
  "use strict";
  const D = global.LocationActionsData;

  const cleanAction = (action) => {
    if (!action || typeof action !== "object") return null;
    const id = typeof action.id === "string" ? action.id.trim() : "";
    if (!id) return null;
    return {
      id,
      name: (typeof action.name === "string" && action.name.trim()) || id,
      description: (typeof action.description === "string" && action.description.trim()) || ""
    };
  };

  const cleanList = (list) => list.map(cleanAction).filter(Boolean).slice(0, 5);
  const DEFAULT_ACTIONS = cleanList(D && Array.isArray(D.default) ? D.default : []);

  if (DEFAULT_ACTIONS.length < 5)
    throw new Error("actions/data.js must define five valid LocationActionsData.default actions");

  const actionsFor = (biomeKey) => {
    const override = D.biomes && Array.isArray(D.biomes[biomeKey]) ? D.biomes[biomeKey] : null;
    const overrideActions = override ? cleanList(override) : [];
    const source = overrideActions.length === 5 ? overrideActions : DEFAULT_ACTIONS;
    return source.map((action) => ({ ...action }));
  };

  function createActionsModule() {
    let engine = null, bound = false;

    // Never cache the slice object: load() replaces the whole state.
    const S = () => engine.state.modules.actions;

    const normalize = () => {
      const s = S();
      if (!Array.isArray(s.actions)) s.actions = [];
      if (typeof s.locationId !== "string") s.locationId = null;
      if (typeof s.locationName !== "string") s.locationName = "";
      if (typeof s.biomeKey !== "string") s.biomeKey = "";
      return s;
    };

    const mod = {
      name: "actions", depends: [],

      init(eng) {
        engine = eng;
        engine.slice("actions", { locationId: null, locationName: "", biomeKey: "", actions: [] });
        normalize();

        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        engine.on("event:location:visited", (e) => mod.loadFor(e.depth + 1, e.data || {}));
        engine.on("event:action:choose", (e) => mod.choose(e.data && e.data.actionId, e.depth + 1));
      },

      onLoad(eng) {
        engine = eng;
        engine.slice("actions", { locationId: null, locationName: "", biomeKey: "", actions: [] });
        normalize();
      },

      // Replace the previous area's five actions with the new area's list.
      loadFor(depth = 0, data = {}) {
        const s = S();
        s.locationId = data.id || null;
        s.locationName = data.name || "";
        s.biomeKey = data.biomeKey || "";
        s.actions = actionsFor(s.biomeKey);

        engine.fire({
          type: "actions:loaded",
          text: `Five actions are available in ${s.locationName || "the area"}.`,
          data: {
            locationId: s.locationId,
            locationName: s.locationName,
            biomeKey: s.biomeKey,
            actions: s.actions
          }
        }, depth);
        return s.actions;
      },

      // Placeholder choice: log it now, apply costs/outcomes in a later module.
      choose(actionId, depth = 0) {
        const s = S();
        const action = s.actions.find((item) => item.id === actionId);
        if (!action) return null;

        const detail = action.description ? `: ${action.description}` : "";
        engine.fire({
          type: "action:chosen",
          text: `${action.name} in ${s.locationName || "the area"}${detail} (placeholder).`,
          data: {
            actionId: action.id,
            name: action.name,
            locationId: s.locationId,
            locationName: s.locationName
          }
        }, depth);
        return action;
      }
    };

    return mod;
  }

  global.createActionsModule = createActionsModule;
})(window);
