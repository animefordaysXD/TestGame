/* Actions module v0.2 — five area actions loaded when a location is visited.
   It listens to location:visited and action:choose; it never calls the locations,
   mainCharacter or equipment modules directly. Resolution emits action:resolved with
   costs, outcome effects, time, an optional equipmentKey and an optional travelTo id;
   those modules react on the bus. Content lives in actions/data.js.
   See ENGINE_SPEC.md. */
(function (global) {
  "use strict";
  const D = global.LocationActionsData;

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const cleanEffects = (list) => Array.isArray(list) ? list.map((effect) => {
    if (!effect || typeof effect !== "object") return null;
    const stat = typeof effect.stat === "string" ? effect.stat.trim() : "";
    const delta = Math.round(Number(effect.delta));
    if (!stat || !Number.isFinite(delta) || delta === 0) return null;
    return { stat, delta };
  }).filter(Boolean) : [];

  const cleanOutcome = (raw, actionId, index) => {
    if (!raw || typeof raw !== "object") return null;
    const id = (typeof raw.id === "string" && raw.id.trim()) || `${actionId}_outcome_${index + 1}`;
    const weight = Number(raw.weight);
    return {
      id,
      name: (typeof raw.name === "string" && raw.name.trim()) || id,
      text: (typeof raw.text === "string" && raw.text.trim()) || "",
      weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
      effects: cleanEffects(raw.effects),
      equipmentKey: typeof raw.equipmentKey === "string" ? raw.equipmentKey.trim() : ""
    };
  };

  const cleanAction = (action) => {
    if (!action || typeof action !== "object") return null;
    const id = typeof action.id === "string" ? action.id.trim() : "";
    if (!id) return null;

    const timeMinutes = clamp(Math.round(Number(action.timeMinutes) || 0), 0, 1440);
    const outcomes = Array.isArray(action.outcomes)
      ? action.outcomes.map((outcome, index) => cleanOutcome(outcome, id, index)).filter(Boolean)
      : [];

    return {
      id,
      name: (typeof action.name === "string" && action.name.trim()) || id,
      description: (typeof action.description === "string" && action.description.trim()) || "",
      timeMinutes,
      costs: cleanEffects(action.costs),
      outcomes,
      requiresDestination: action.requiresDestination === true,
      travelText: (typeof action.travelText === "string" && action.travelText.trim()) || ""
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
    return source.map((action) => JSON.parse(JSON.stringify(action)));
  };

  function weightedPick(rng, outcomes) {
    const total = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
    if (!total) return null;
    let roll = rng.next() * total;
    for (const outcome of outcomes) {
      roll -= outcome.weight;
      if (roll < 0) return outcome;
    }
    return outcomes[outcomes.length - 1];
  }

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
      if (!s.lastAction || typeof s.lastAction !== "object") s.lastAction = null;
      return s;
    };

    const mod = {
      name: "actions", depends: [],

      init(eng) {
        engine = eng;
        engine.slice("actions", {
          locationId: null, locationName: "", biomeKey: "", actions: [], lastAction: null
        });
        normalize();

        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        engine.on("event:location:visited", (e) => mod.loadFor(e.depth + 1, e.data || {}));
        engine.on("event:action:choose", (e) => mod.choose(
          e.data && e.data.actionId,
          e.data && e.data.destinationId,
          e.depth + 1
        ));
      },

      onLoad(eng) {
        engine = eng;
        engine.slice("actions", {
          locationId: null, locationName: "", biomeKey: "", actions: [], lastAction: null
        });
        normalize();
      },

      // Replace the previous area's five actions with the new area's list.
      loadFor(depth = 0, data = {}) {
        const s = S();
        s.locationId = data.id || null;
        s.locationName = data.name || "";
        s.biomeKey = data.biomeKey || "";
        s.actions = actionsFor(s.biomeKey);
        s.lastAction = null;

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

      // Resolve one choice. Costs and outcome effects are announced, not applied here:
      // mainCharacter applies them, equipment grants an item, and the UI moves the party
      // for a travelTo action. The UI calls engine.flush() after the request.
      choose(actionId, destinationId, depth = 0) {
        const s = S();
        const action = s.actions.find((item) => item.id === actionId);
        if (!action) return null;

        engine.fire({
          type: "action:chosen",
          text: `${action.name} in ${s.locationName || "the area"}.`,
          data: {
            actionId: action.id,
            name: action.name,
            locationId: s.locationId,
            locationName: s.locationName
          }
        }, depth);

        let travelTo = null;
        if (action.requiresDestination) {
          travelTo = typeof destinationId === "string" ? destinationId.trim() : "";
          if (!travelTo) {
            engine.fire({
              type: "action:blocked",
              text: `${action.name} needs a destination. Choose another location first.`,
              data: {
                actionId: action.id,
                name: action.name,
                reason: "destination-required",
                locationId: s.locationId,
                locationName: s.locationName
              }
            }, depth);
            return null;
          }
        }

        const outcome = action.requiresDestination ? null : weightedPick(engine.rng, action.outcomes);
        const effects = [
          ...action.costs.map((effect) => ({ ...effect })),
          ...(outcome ? outcome.effects.map((effect) => ({ ...effect })) : [])
        ];
        const text = (outcome && outcome.text)
          || action.travelText
          || `${action.name} in ${s.locationName || "the area"}.`;

        const resolution = {
          actionId: action.id,
          name: action.name,
          outcomeId: outcome ? outcome.id : null,
          outcomeName: outcome ? outcome.name : "",
          text,
          effects,
          timeMinutes: action.timeMinutes,
          equipmentKey: outcome ? outcome.equipmentKey : "",
          travelTo,
          locationId: s.locationId,
          locationName: s.locationName,
          atTick: engine.now.tick,
          at: engine.now.text
        };
        s.lastAction = resolution;

        engine.fire({
          type: "action:resolved",
          text: `${text}${action.timeMinutes ? ` (${action.timeMinutes} min)` : ""}`,
          data: resolution
        }, depth);
        return { action, outcome, resolution };
      }
    };

    return mod;
  }

  global.createActionsModule = createActionsModule;
})(window);
