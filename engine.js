/* Core engine v0.2 — rules and contracts live in ENGINE_SPEC.md. */
(function (global) {
  "use strict";

  // Seeded RNG (mulberry32). Its state is saved, so loaded games continue the same dice rolls.
  class Rng {
    constructor(seed) { this.s = seed >>> 0; }
    next() {
      this.s = (this.s + 0x6D2B79F5) >>> 0;
      let t = this.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  }

  const MAX_EVENT_DEPTH = 8;      // events caused by events stop here
  const MAX_EVENTS_PER_TICK = 500;

  class Engine {
    constructor(opts = {}) {
      this.opts = { startDate: "1000-01-01T06:00:00Z", tickMinutes: 10, maxLog: 500, seed: Date.now(), ...opts };
      this.modules = new Map();     // name -> module
      this.generators = new Map();  // id -> { fn, module }
      this.handlers = {};           // bus: name -> [fn]
      this.timer = null;
      this._queue = [];
      this.reset(this.opts.seed);
    }

    /* ---------- state ---------- */
    reset(seed = Date.now()) {
      this.pause();
      this.state = {
        version: 1, seed, rngState: seed >>> 0,
        time: { startDate: this.opts.startDate, tick: 0, minutes: 0, tickMinutes: this.opts.tickMinutes },
        eventLog: [], modules: {}
      };
      this.rng = new Rng(this.state.rngState);
      for (const m of this.modules.values()) m.init && m.init(this);
      this.emit("reset", this);
    }

    // A module's private, JSON-safe state. Created from defaults the first time it is requested.
    slice(name, defaults = {}) {
      if (!this.state.modules[name]) this.state.modules[name] = JSON.parse(JSON.stringify(defaults));
      return this.state.modules[name];
    }

    /* ---------- time ---------- */
    get now() {
      const t = this.state.time;
      const d = new Date(Date.parse(t.startDate) + t.minutes * 60000);
      const p = (n) => String(n).padStart(2, "0");
      const date = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
      return {
        tick: t.tick, minutes: t.minutes, tickMinutes: t.tickMinutes,
        year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
        hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: d.getUTCDay(),
        date, text: `${date} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
      };
    }
    setTickMinutes(n) { this.state.time.tickMinutes = Math.max(1, Math.floor(n)); this.emit("tickSize", n); }

    // Convert "chance per game-day" into a chance for one tick, so rates stay sensible at any tick size.
    chancePerTick(chancePerDay) {
      return 1 - Math.pow(1 - chancePerDay, this.state.time.tickMinutes / 1440);
    }

    /* ---------- registration ---------- */
    register(mod) {
      for (const dep of mod.depends || [])
        if (!this.modules.has(dep)) throw new Error(`Module "${mod.name}" needs "${dep}" registered first`);
      this.modules.set(mod.name, mod);
      mod.init && mod.init(this);
      return this;
    }
    // fn({ roll, rng, time, tickMinutes, engine, state }) -> event | [events] | null
    registerGenerator(id, fn, module = null) {
      this.generators.set(id, { fn, module });
      return this;
    }

    /* ---------- event bus ---------- */
    on(name, fn) { (this.handlers[name] ||= []).push(fn); return () => this.off(name, fn); }
    off(name, fn) { this.handlers[name] = (this.handlers[name] || []).filter((f) => f !== fn); }
    emit(name, payload) {
      for (const fn of this.handlers[name] || []) {
        try { fn(payload); } catch (e) { console.error(`[bus] handler for "${name}" failed`, e); }
      }
    }
    // Queue a game event: { type, data }. Handlers listen on "event" or "event:<type>".
    fire(evt, depth = 0) {
      if (depth > MAX_EVENT_DEPTH) return;
      this._queue.push({ ...evt, depth });
    }

    /* ---------- tick loop ---------- */
    step(n = 1) { for (let i = 0; i < n; i++) this._tick(); }

    _tick() {
      const t = this.state.time;
      t.tick++; t.minutes += t.tickMinutes;
      const base = { engine: this, state: this.state, rng: this.rng, time: this.now, tickMinutes: t.tickMinutes };

      this.emit("tick:start", base);

      // Event check: every generator gets its own random roll (0-1).
      for (const [id, g] of this.generators) {
        try {
          const out = g.fn({ ...base, roll: this.rng.next(), id });
          for (const e of [].concat(out || [])) this.fire({ ...e, source: id });
        } catch (err) { console.error(`[generator] "${id}" failed`, err); }
      }

      this.flush();

      for (const m of this.modules.values()) m.onTick && m.onTick(base);
      this.emit("tick:end", base);
      this.state.rngState = this.rng.s;
    }

    // Process queued events now. Runs every tick; UI buttons call it after fire() so they don't wait for the next tick.
    flush() {
      const t = this.state.time, when = this.now.text;
      let handled = 0;
      while (this._queue.length && handled++ < MAX_EVENTS_PER_TICK) {
        const evt = { ...this._queue.shift(), tick: t.tick, when };
        this.state.eventLog.push(evt);
        if (this.state.eventLog.length > this.opts.maxLog) this.state.eventLog.shift();
        this.emit("event:" + evt.type, evt);
        this.emit("event", evt);
      }
    }

    run(msPerTick = 300) { this.pause(); this.timer = setInterval(() => this.step(), msPerTick); this.emit("run"); }
    pause() { if (this.timer) { clearInterval(this.timer); this.timer = null; this.emit("pause"); } }
    get running() { return !!this.timer; }

    /* ---------- save / load ---------- */
    serialize() { this.state.rngState = this.rng.s; return JSON.stringify(this.state); }
    load(json) {
      this.pause();
      this.state = typeof json === "string" ? JSON.parse(json) : json;
      this.rng = new Rng(this.state.rngState);
      for (const m of this.modules.values()) m.onLoad && m.onLoad(this);
      this.emit("load", this);
    }
  }

  global.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
