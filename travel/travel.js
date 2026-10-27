/* Travel module v0.1 — time-based journeys with 5-minute event checks.
   Owns the `travel` slice. The UI starts a journey after an action resolves with
   `travelTo`, then advances it in `minutesPerCheck` chunks. This module checks for an
   interruption after every chunk and pauses when one triggers. It never moves the
   party: on `travel:completed` the UI calls locations.visit(destinationId), so the
   locations module stays the only mover.

   The world clock is advanced by the UI. Travel runs on 5-minute ticks while a journey
   is being driven, then the UI restores the previous tick size. Content lives in
   travel/data.js. See ENGINE_SPEC.md and MODULES.md. */
(function (global) {
  "use strict";
  const D = global.TravelData;

  if (!D || !Array.isArray(D.events) || !D.events.length)
    throw new Error("travel/data.js must define TravelData.events with at least one event");

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const cleanEffects = (list) => Array.isArray(list) ? list.map((effect) => {
    if (!effect || typeof effect !== "object") return null;
    const stat = typeof effect.stat === "string" ? effect.stat.trim() : "";
    const delta = Math.round(Number(effect.delta));
    if (!stat || !Number.isFinite(delta) || delta === 0) return null;
    return { stat, delta };
  }).filter(Boolean) : [];

  const cleanEvent = (raw, index) => {
    if (!raw || typeof raw !== "object") return null;
    if (raw.enabled === false) return null;

    const id = (typeof raw.id === "string" && raw.id.trim()) || `travel_event_${index + 1}`;
    const weight = Number(raw.weight);
    return {
      id,
      name: (typeof raw.name === "string" && raw.name.trim()) || id,
      text: (typeof raw.text === "string" && raw.text.trim()) || "",
      weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
      effects: cleanEffects(raw.effects)
    };
  };

  const EVENTS = D.events.map(cleanEvent).filter(Boolean);
  if (!EVENTS.length) throw new Error("travel/data.js must define at least one enabled travel event");

  const MINUTES_PER_CHECK = clamp(Math.round(Number(D.minutesPerCheck) || 5), 1, 60);

  function weightedPick(rng, events) {
    const total = events.reduce((sum, event) => sum + event.weight, 0);
    if (!total) return null;
    let roll = rng.next() * total;
    for (const event of events) {
      roll -= event.weight;
      if (roll < 0) return event;
    }
    return events[events.length - 1];
  }

  function chanceFor(biomeKey) {
    const overrides = D.chanceByBiome || {};
    const raw = overrides[biomeKey] !== undefined ? overrides[biomeKey] : D.chancePercent;
    return clamp(Number(raw) || 0, 0, 100) / 100;
  }

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function createTravelModule() {
    let engine = null, bound = false;

    // Never cache the slice object: load() replaces the whole state.
    const S = () => engine.state.modules.travel;

    const normalize = () => {
      const s = S();
      if (!s || typeof s !== "object" || Array.isArray(s)) return s;
      if (typeof s.active !== "boolean") s.active = false;
      if (typeof s.paused !== "boolean") s.paused = false;
      if (typeof s.originId !== "string") s.originId = null;
      if (typeof s.originName !== "string") s.originName = "";
      if (typeof s.destinationId !== "string") s.destinationId = null;
      if (typeof s.destinationName !== "string") s.destinationName = "";
      if (typeof s.destinationBiomeKey !== "string") s.destinationBiomeKey = "";
      if (!Number.isFinite(Number(s.elapsedMinutes))) s.elapsedMinutes = 0;
      if (!Number.isFinite(Number(s.durationMinutes))) s.durationMinutes = 0;
      if (!Number.isFinite(Number(s.checks))) s.checks = 0;
      if (!Number.isFinite(Number(s.eventCount))) s.eventCount = 0;
      if (s.pausedAtMinutes !== null && !Number.isFinite(Number(s.pausedAtMinutes))) s.pausedAtMinutes = null;
      if (!s.lastEvent || typeof s.lastEvent !== "object") s.lastEvent = null;
      if (!s.lastCompleted || typeof s.lastCompleted !== "object") s.lastCompleted = null;

      s.minutesPerCheck = MINUTES_PER_CHECK;
      s.elapsedMinutes = clamp(Math.round(Number(s.elapsedMinutes) || 0), 0, Math.max(0, Math.round(Number(s.durationMinutes) || 0)));
      s.checks = Math.max(0, Math.round(Number(s.checks) || 0));
      s.eventCount = Math.max(0, Math.round(Number(s.eventCount) || 0));
      s.pausedAtMinutes = s.pausedAtMinutes === null
        ? null
        : (Number.isFinite(Number(s.pausedAtMinutes)) ? Math.round(Number(s.pausedAtMinutes)) : null);
      if (s.lastEvent && !Array.isArray(s.lastEvent.effects)) s.lastEvent.effects = [];

      if (s.active && (!s.destinationId || Number(s.durationMinutes) <= 0)) {
        s.active = false;
        s.paused = false;
        s.pausedAtMinutes = null;
      }
      return s;
    };

    const complete = (depth) => {
      const s = S();
      const now = engine.now;
      s.active = false;
      s.paused = false;
      s.pausedAtMinutes = null;
      s.lastCompleted = {
        destinationId: s.destinationId,
        destinationName: s.destinationName,
        originId: s.originId,
        originName: s.originName,
        elapsedMinutes: s.elapsedMinutes,
        durationMinutes: s.durationMinutes,
        eventCount: s.eventCount,
        atTick: now.tick,
        at: now.text
      };

      engine.fire({
        type: "travel:completed",
        text: `You arrive at ${s.destinationName || "your destination"} after ${s.elapsedMinutes} minutes.`,
        data: clone(s.lastCompleted)
      }, depth);
      return s;
    };

    const mod = {
      name: "travel", depends: [], minutesPerCheck: MINUTES_PER_CHECK,

      init(eng) {
        engine = eng;
        engine.slice("travel", {
          active: false, paused: false,
          originId: null, originName: "",
          destinationId: null, destinationName: "", destinationBiomeKey: "",
          elapsedMinutes: 0, durationMinutes: 0, minutesPerCheck: MINUTES_PER_CHECK,
          checks: 0, eventCount: 0,
          pausedAtMinutes: null,
          lastEvent: null, lastCompleted: null
        });
        normalize();

        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        engine.on("event:travel:start", (e) => mod.start(e.data || {}, e.depth + 1));
        engine.on("event:travel:advance", (e) => mod.advance(e.depth + 1, e.data || {}));
        engine.on("event:travel:continue", (e) => mod.resume(e.depth + 1));
        engine.on("event:travel:cancel", (e) => mod.cancel(e.depth + 1));
      },

      onLoad(eng) {
        engine = eng;
        engine.slice("travel", {
          active: false, paused: false,
          originId: null, originName: "",
          destinationId: null, destinationName: "", destinationBiomeKey: "",
          elapsedMinutes: 0, durationMinutes: 0, minutesPerCheck: MINUTES_PER_CHECK,
          checks: 0, eventCount: 0,
          pausedAtMinutes: null,
          lastEvent: null, lastCompleted: null
        });
        normalize();
      },

      chanceFor,

      // Begin a journey. The UI supplies names and the destination snapshot so this
      // module never reads the locations slice. Duration is rounded up to a whole
      // number of checks so every check is exactly minutesPerCheck long.
      start(data = {}, depth = 0) {
        const s = S();
        if (s.active) return null;

        const destinationId = typeof data.destinationId === "string" ? data.destinationId.trim() : "";
        if (!destinationId) return null;

        const rawDuration = Math.max(1, Math.round(Number(data.durationMinutes) || MINUTES_PER_CHECK));
        const duration = Math.ceil(rawDuration / MINUTES_PER_CHECK) * MINUTES_PER_CHECK;

        s.active = true;
        s.paused = false;
        s.originId = typeof data.originId === "string" ? data.originId : null;
        s.originName = typeof data.originName === "string" ? data.originName : "";
        s.destinationId = destinationId;
        s.destinationName = typeof data.destinationName === "string" ? data.destinationName : "";
        s.destinationBiomeKey = typeof data.destinationBiomeKey === "string" ? data.destinationBiomeKey : "";
        s.elapsedMinutes = 0;
        s.durationMinutes = duration;
        s.minutesPerCheck = MINUTES_PER_CHECK;
        s.checks = 0;
        s.eventCount = 0;
        s.pausedAtMinutes = null;
        s.lastEvent = null;
        s.lastCompleted = null;

        engine.fire({
          type: "travel:started",
          text: `You set out for ${s.destinationName || "another location"} (${duration} min).`,
          data: {
            destinationId: s.destinationId,
            destinationName: s.destinationName,
            destinationBiomeKey: s.destinationBiomeKey,
            originId: s.originId,
            originName: s.originName,
            durationMinutes: s.durationMinutes,
            minutesPerCheck: s.minutesPerCheck
          }
        }, depth);
        return s;
      },

      // Advance one check. Returns null when there is no active, unpaused journey.
      // On an interruption the journey pauses before completion; resume() then clears
      // the pause and the next advance completes if the destination was reached.
      advance(depth = 0, data = {}) {
        const s = S();
        if (!s.active || s.paused) return null;

        // A journey resumed after an event on its final check has no time left.
        if (s.elapsedMinutes >= s.durationMinutes) return complete(depth);

        const step = clamp(Math.round(Number(data.minutes) || s.minutesPerCheck), 1, s.minutesPerCheck);
        s.elapsedMinutes = Math.min(s.durationMinutes, s.elapsedMinutes + step);
        s.checks += 1;

        const chance = chanceFor(s.destinationBiomeKey);
        const roll = engine.rng.next();
        if (chance > 0 && roll < chance) {
          const event = weightedPick(engine.rng, EVENTS);
          if (event) {
            const now = engine.now;
            s.paused = true;
            s.pausedAtMinutes = s.elapsedMinutes;
            s.eventCount += 1;
            s.lastEvent = {
              eventId: event.id,
              name: event.name,
              text: event.text,
              effects: clone(event.effects),
              roll: Math.round(roll * 1000) / 1000,
              elapsedMinutes: s.elapsedMinutes,
              durationMinutes: s.durationMinutes,
              destinationId: s.destinationId,
              destinationName: s.destinationName,
              atTick: now.tick,
              at: now.text
            };

            engine.fire({
              type: "travel:event",
              text: `${event.text} Travel pauses at ${s.elapsedMinutes}/${s.durationMinutes} min.`,
              data: clone(s.lastEvent)
            }, depth);
            return s;
          }
        }

        if (s.elapsedMinutes >= s.durationMinutes) return complete(depth);

        engine.fire({
          type: "travel:progress",
          text: `Travel continues (${s.elapsedMinutes}/${s.durationMinutes} min).`,
          data: {
            destinationId: s.destinationId,
            destinationName: s.destinationName,
            elapsedMinutes: s.elapsedMinutes,
            durationMinutes: s.durationMinutes,
            remainingMinutes: s.durationMinutes - s.elapsedMinutes,
            checks: s.checks
          }
        }, depth);
        return s;
      },

      resume(depth = 0) {
        const s = S();
        if (!s.active || !s.paused) return null;

        s.paused = false;
        s.pausedAtMinutes = null;
        engine.fire({
          type: "travel:resumed",
          text: `You continue toward ${s.destinationName || "your destination"} (${Math.max(0, s.durationMinutes - s.elapsedMinutes)} min left).`,
          data: {
            destinationId: s.destinationId,
            destinationName: s.destinationName,
            elapsedMinutes: s.elapsedMinutes,
            durationMinutes: s.durationMinutes,
            remainingMinutes: Math.max(0, s.durationMinutes - s.elapsedMinutes)
          }
        }, depth);
        return s;
      },

      cancel(depth = 0) {
        const s = S();
        if (!s.active) return null;

        const summary = {
          destinationId: s.destinationId,
          destinationName: s.destinationName,
          elapsedMinutes: s.elapsedMinutes,
          durationMinutes: s.durationMinutes
        };
        s.active = false;
        s.paused = false;
        s.pausedAtMinutes = null;
        s.lastEvent = null;
        s.lastCompleted = null;

        engine.fire({
          type: "travel:cancelled",
          text: `The journey to ${summary.destinationName || "your destination"} is abandoned after ${summary.elapsedMinutes} minutes.`,
          data: summary
        }, depth);
        return s;
      }
    };

    return mod;
  }

  global.createTravelModule = createTravelModule;
})(window);
