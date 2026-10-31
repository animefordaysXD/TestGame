/* Save helper v0.1 — seed + changes save files.
   A save file stores the world seed, the baseline engine options and the JSON changes
   needed to rebuild the live world. It never edits engine.js. The caller supplies a
   buildEngine(opts) factory that registers every module, so both the page and the tests
   can reconstruct a fresh world.

   Format v1:
   {
     format: "text-rpg-save",
     formatVersion: 1,
     savedAt: "2026-10-29T...",
     label: "1000-01-03 06:00",
     seed: 20261029,
     baseline: { startDate: "1000-01-01T06:00:00Z", tickMinutes: 10 },
     changes: [{ op: "set", path: ["time", "tick"], value: 3 }]
   }

   Version 0 is a raw engine state (the old localStorage export). It is migrated to v1
   on import by rebuilding the fresh baseline and diffing it against the legacy state.
   See save/README.md. */
(function (global) {
  "use strict";

  const FORMAT = "text-rpg-save";
  const FORMAT_VERSION = 1;
  const MAX_CHANGES = 20000;
  const TOP_LEVEL = new Set(["version", "seed", "rngState", "time", "eventLog", "modules"]);
  const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isObject = (value) => value !== null && typeof value === "object";
  const isPlainObject = (value) => isObject(value) && !Array.isArray(value);

  function jsonClone(value, where) {
    let text;
    try { text = JSON.stringify(value); }
    catch (error) { throw new Error(`Save value at ${where} is not JSON-safe: ${error.message}`); }
    if (text === undefined) throw new Error(`Save value at ${where} is not JSON-safe.`);
    return JSON.parse(text);
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (!isObject(a) || !isObject(b)) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }

    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!hasOwn(b, key) || !deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  function pathText(path) {
    return Array.isArray(path) ? JSON.stringify(path) : String(path);
  }

  function safeSegment(segment) {
    if (typeof segment === "string") return segment.length > 0 && !UNSAFE_KEYS.has(segment);
    return typeof segment === "number" && Number.isInteger(segment) && segment >= 0;
  }

  function assertSafePath(path, where = "change") {
    if (!Array.isArray(path) || path.length === 0)
      throw new Error(`${where} must have a non-empty path array.`);
    for (const segment of path) {
      if (!safeSegment(segment))
        throw new Error(`${where} has an unsafe path segment: ${String(segment)}.`);
    }
    if (typeof path[0] !== "string" || !TOP_LEVEL.has(path[0]))
      throw new Error(`${where} points outside the engine state: ${pathText(path)}.`);
    return path;
  }

  function setAtPath(state, path, value) {
    let node = state;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!isObject(node[key])) {
        const next = path[i + 1];
        node[key] = typeof next === "number" ? [] : {};
      }
      node = node[key];
    }
    node[path[path.length - 1]] = value;
  }

  function deleteAtPath(state, path) {
    let node = state;
    for (let i = 0; i < path.length - 1; i++) {
      node = node[path[i]];
      if (!isObject(node)) return;
    }
    const last = path[path.length - 1];
    if (Array.isArray(node) && typeof last === "number") {
      if (last < node.length) node.splice(last, 1);
      return;
    }
    if (isObject(node)) delete node[last];
  }

  // Build a compact change list by replacing whole arrays/scalars and recursing objects.
  // This keeps a large event log to a single set op while still leaving module objects
  // readable as small targeted changes.
  function diff(baseline, live, path, out) {
    if (deepEqual(baseline, live)) return out;

    if (isPlainObject(baseline) && isPlainObject(live)) {
      const keys = new Set([...Object.keys(baseline), ...Object.keys(live)]);
      for (const key of keys) {
        if (!hasOwn(live, key)) {
          out.push({ op: "delete", path: [...path, key] });
        } else if (!hasOwn(baseline, key)) {
          out.push({ op: "set", path: [...path, key], value: jsonClone(live[key], pathText([...path, key])) });
        } else {
          diff(baseline[key], live[key], [...path, key], out);
        }
      }
      return out;
    }

    out.push({ op: "set", path: [...path], value: jsonClone(live, pathText(path)) });
    return out;
  }

  function changesBetween(baselineState, liveState) {
    if (!isPlainObject(baselineState) || !isPlainObject(liveState))
      throw new Error("changesBetween needs two engine state objects.");
    const changes = diff(baselineState, liveState, [], []);
    if (changes.length > MAX_CHANGES)
      throw new Error(`Save has ${changes.length} changes; the limit is ${MAX_CHANGES}.`);
    return changes;
  }

  function applyChanges(state, changes) {
    if (!isPlainObject(state)) throw new Error("Cannot apply changes to a missing state.");
    if (!Array.isArray(changes)) throw new Error("Save changes must be an array.");

    changes.forEach((change, index) => {
      const where = `change ${index + 1}`;
      if (!isPlainObject(change)) throw new Error(`${where} must be an object.`);
      assertSafePath(change.path, where);
      if (change.op === "set") {
        if (!hasOwn(change, "value")) throw new Error(`${where} has no value.`);
        setAtPath(state, change.path, jsonClone(change.value, pathText(change.path)));
      } else if (change.op === "delete") {
        deleteAtPath(state, change.path);
      } else {
        throw new Error(`${where} has an unknown op: ${String(change.op)}.`);
      }
    });
    return state;
  }

  function looksLikeState(value) {
    return isPlainObject(value) && isPlainObject(value.time) && isPlainObject(value.modules);
  }

  function labelForState(state) {
    try {
      const start = Date.parse(state.time.startDate);
      const minutes = Number(state.time.minutes);
      if (!Number.isFinite(start) || !Number.isFinite(minutes)) return "imported save";
      const date = new Date(start + minutes * 60000);
      const p = (n) => String(n).padStart(2, "0");
      return `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())} ` +
        `${p(date.getUTCHours())}:${p(date.getUTCMinutes())}`;
    } catch (error) {
      return "imported save";
    }
  }

  function normaliseBaseline(raw) {
    if (!isPlainObject(raw)) throw new Error("Save baseline is missing.");
    const startDate = typeof raw.startDate === "string" ? raw.startDate : "";
    if (!startDate || !Number.isFinite(Date.parse(startDate)))
      throw new Error("Save baseline has an invalid startDate.");
    const tickMinutes = Math.round(Number(raw.tickMinutes));
    if (!Number.isFinite(tickMinutes) || tickMinutes < 1)
      throw new Error("Save baseline has an invalid tickMinutes.");
    return { startDate, tickMinutes };
  }

  function normaliseChange(change, index) {
    const where = `change ${index + 1}`;
    if (!isPlainObject(change)) throw new Error(`${where} must be an object.`);
    assertSafePath(change.path, where);
    if (change.op === "set") {
      if (!hasOwn(change, "value")) throw new Error(`${where} has no value.`);
      return { op: "set", path: [...change.path], value: jsonClone(change.value, pathText(change.path)) };
    }
    if (change.op === "delete") return { op: "delete", path: [...change.path] };
    throw new Error(`${where} has an unknown op: ${String(change.op)}.`);
  }

  function validate(save) {
    if (!isPlainObject(save)) throw new Error("Save file must contain a JSON object.");
    if (save.format !== FORMAT)
      throw new Error(`Not a ${FORMAT} file.`);
    if (save.formatVersion !== FORMAT_VERSION)
      throw new Error(`Save format v${save.formatVersion} is not supported by this build.`);

    const seed = Number(save.seed);
    if (!Number.isFinite(seed)) throw new Error("Save seed must be a number.");
    if (!Array.isArray(save.changes))
      throw new Error("Save changes must be an array.");
    if (save.changes.length > MAX_CHANGES)
      throw new Error(`Save has too many changes (${save.changes.length}; limit ${MAX_CHANGES}).`);

    return {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      savedAt: typeof save.savedAt === "string" ? save.savedAt : new Date().toISOString(),
      label: typeof save.label === "string" && save.label ? save.label : "save",
      seed,
      baseline: normaliseBaseline(save.baseline),
      changes: save.changes.map(normaliseChange)
    };
  }

  function legacyToV1(save, options = {}) {
    const state = save && save.legacyState;
    if (!looksLikeState(state))
      throw new Error("Legacy save does not contain an engine state.");
    if (typeof options.buildEngine !== "function")
      throw new Error("Loading a legacy save needs a buildEngine(opts) function.");

    const seed = Number(state.seed);
    if (!Number.isFinite(seed)) throw new Error("Legacy state has no valid seed.");
    const baseline = normaliseBaseline({
      startDate: state.time.startDate,
      tickMinutes: state.time.tickMinutes
    });

    const fresh = options.buildEngine({
      seed,
      startDate: baseline.startDate,
      tickMinutes: baseline.tickMinutes
    });
    if (!fresh || !isPlainObject(fresh.state))
      throw new Error("buildEngine(opts) did not return an engine.");

    return validate({
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      savedAt: new Date().toISOString(),
      label: labelForState(state),
      seed,
      baseline,
      changes: changesBetween(fresh.state, state)
    });
  }

  // Version 0 = a raw engine state (the old localStorage string). Older file versions
  // get a migration here before FORMAT_VERSION is bumped.
  const MIGRATIONS = {
    0: legacyToV1
  };

  function runMigrations(save, options) {
    let current = save;
    let version = Number(current && current.formatVersion);
    if (!Number.isInteger(version) || version < 0)
      throw new Error("Save formatVersion must be a non-negative integer.");
    if (version > FORMAT_VERSION)
      throw new Error(`Save format v${version} is newer than this build (v${FORMAT_VERSION}).`);

    while (version < FORMAT_VERSION) {
      const step = MIGRATIONS[version];
      if (!step) throw new Error(`No migration from save format v${version}.`);
      current = step(current, options);
      const next = Number(current && current.formatVersion);
      if (!Number.isInteger(next) || next <= version)
        throw new Error(`Migration from save format v${version} did not advance the version.`);
      version = next;
    }
    return validate(current);
  }

  function migrate(save, options = {}) {
    if (!isPlainObject(save)) throw new Error("Save file must contain a JSON object.");

    if (save.format === FORMAT) return runMigrations(save, options);

    if (!looksLikeState(save) && !isPlainObject(save.legacyState))
      throw new Error(`Not a ${FORMAT} file and not a legacy engine state.`);

    const wrapper = looksLikeState(save)
      ? { formatVersion: 0, legacyState: save }
      : save;
    return runMigrations(wrapper, options);
  }

  function read(textOrObject, options = {}) {
    let parsed = textOrObject;
    if (typeof textOrObject === "string") {
      try { parsed = JSON.parse(textOrObject); }
      catch (error) { throw new Error(`Save file is not valid JSON: ${error.message}`); }
    }
    return migrate(parsed, options);
  }

  function capture(engine, buildEngine) {
    if (!engine || !engine.state) throw new Error("capture needs a live engine.");
    if (typeof buildEngine !== "function")
      throw new Error("capture needs a buildEngine(opts) function.");

    const live = JSON.parse(engine.serialize());
    const seed = Number(live.seed);
    if (!Number.isFinite(seed)) throw new Error("Live state has no valid seed.");

    const baseline = normaliseBaseline({
      startDate: live.time && live.time.startDate,
      tickMinutes: live.time && live.time.tickMinutes
    });
    const fresh = buildEngine({ seed, startDate: baseline.startDate, tickMinutes: baseline.tickMinutes });
    if (!fresh || !isPlainObject(fresh.state))
      throw new Error("buildEngine(opts) did not return an engine.");

    return validate({
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      savedAt: new Date().toISOString(),
      label: engine.now.text,
      seed,
      baseline,
      changes: changesBetween(fresh.state, live)
    });
  }

  function restore(input, engine, options = {}) {
    if (!engine || !engine.state) throw new Error("restore needs a live engine.");
    if (typeof options.buildEngine !== "function")
      throw new Error("restore needs a buildEngine(opts) function.");

    const save = read(input, options);
    const fresh = options.buildEngine({
      seed: save.seed,
      startDate: save.baseline.startDate,
      tickMinutes: save.baseline.tickMinutes
    });
    if (!fresh || !isPlainObject(fresh.state))
      throw new Error("buildEngine(opts) did not return an engine.");

    applyChanges(fresh.state, save.changes);
    engine.load(fresh.state);
    return save;
  }

  function stringify(save, pretty = true) {
    return JSON.stringify(save, null, pretty ? 2 : 0);
  }

  function fileName(save) {
    const label = String((save && save.label) || "save")
      .replace(/[^0-9A-Za-z-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `text-rpg-save-${label || "save"}.json`;
  }

  const GameSave = {
    FORMAT,
    FORMAT_VERSION,
    MIGRATIONS,
    capture,
    changesBetween,
    applyChanges,
    read,
    migrate,
    restore,
    validate,
    stringify,
    fileName
  };

  global.GameSave = GameSave;
})(typeof window !== "undefined" ? window : globalThis);
