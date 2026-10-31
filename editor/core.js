/* Editor core v0.1 — reads and writes the game's content files. No DOM; tested in Node.
   See editor/README.md.

   Two file formats are handled:
     "js"   window.<Global> = { ...strict JSON... };   with an optional header comment
     "json" a plain JSON file (biome events)
   The header comment is preserved word for word. The object inside is strict JSON (quoted keys,
   no comments, no trailing commas) so the editor can rewrite it without losing anything.
   A file that is valid JavaScript but not strict JSON can still be opened; it is flagged `lossy`
   because saving it would drop any comments inside the object. */
(function (root) {
  "use strict";

  const WIDTH = 100;
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const isPrimitive = (v) => v === null || typeof v !== "object";

  // ---- compact JSON formatter -------------------------------------------------------------
  // Short values stay on one line, long ones break. Output is valid JSON and deterministic, so
  // saving an unchanged file twice gives identical text and small, readable git diffs.
  function inline(v) {
    if (isPrimitive(v)) return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(inline).join(", ") + "]";
    const keys = Object.keys(v);
    if (!keys.length) return "{}";
    return "{ " + keys.map((k) => JSON.stringify(k) + ": " + inline(v[k])).join(", ") + " }";
  }

  function fmt(v, ind, col, force) {
    const one = inline(v);
    if (!force && col + one.length <= WIDTH) return one;
    const next = ind + "  ";
    if (Array.isArray(v)) {
      if (v.every(isPrimitive)) {              // wrap long lists of words/numbers like prose
        const lines = [];
        let line = "";
        for (const item of v.map(inline)) {
          if (line && next.length + line.length + item.length + 2 > WIDTH) { lines.push(line); line = ""; }
          line += (line ? ", " : "") + item;
        }
        if (line) lines.push(line);
        return "[\n" + lines.map((l) => next + l).join(",\n") + "\n" + ind + "]";
      }
      return "[\n" + v.map((item) => next + fmt(item, next, next.length)).join(",\n") + "\n" + ind + "]";
    }
    const keys = Object.keys(v);
    return "{\n" + keys.map((k) => {
      const prefix = JSON.stringify(k) + ": ";
      return next + prefix + fmt(v[k], next, next.length + prefix.length);
    }).join(",\n") + "\n" + ind + "}";
  }

  // The top level of a file always breaks across lines when it has more than one key.
  function format(value, col = 0) { return fmt(value, "", col, isObj(value) && Object.keys(value).length > 1); }

  const detectEol = (text) => (/\r\n/.test(text) ? "\r\n" : "\n");
  const withEol = (text, eol) => (eol === "\r\n" ? text.replace(/\r?\n/g, "\r\n") : text);

  // ---- files -----------------------------------------------------------------------------
  function parseDataFile(text, global, opts = {}) {
    const eol = detectEol(text);
    const normal = text.replace(/\r\n/g, "\n");
    const m = new RegExp("^window\\." + global + "\\s*=", "m").exec(normal);
    if (!m) throw new Error(`Could not find "window.${global} =" in the file.`);
    const header = normal.slice(0, m.index).replace(/\s+$/, "");
    const body = normal.slice(m.index + m[0].length).trim().replace(/;\s*$/, "");
    try {
      return { header, data: JSON.parse(body), lossy: false, eol };
    } catch (e) {
      if (!opts.allowEval) throw new Error(`The data is not strict JSON (${e.message}).`);
      // Own repo file, opened on purpose: accept JavaScript object syntax, but flag that comments
      // inside the object are lost on save.
      const data = new Function('"use strict"; return (' + body + "\n);")();
      return { header, data, lossy: true, eol };
    }
  }

  function serializeDataFile({ header, global, data, eol = "\n" }) {
    const head = header ? header.replace(/\s+$/, "") + "\n" : "";
    const prefix = `window.${global} = `;
    return withEol(head + prefix + format(data, prefix.length) + ";\n", eol);
  }

  function parseJsonFile(text) {
    return { data: JSON.parse(text.replace(/^\uFEFF/, "")), eol: detectEol(text) };
  }
  const serializeJsonFile = ({ data, eol = "\n" }) => withEol(JSON.stringify(data, null, 2) + "\n", eol);

  // ---- small helpers ---------------------------------------------------------------------
  function getPath(obj, path) {
    return String(path).split(".").reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const keys = String(path).split(".");
    const last = keys.pop();
    let node = obj;
    for (const k of keys) { if (!isObj(node[k])) node[k] = {}; node = node[k]; }
    node[last] = value;
  }
  function deletePath(obj, path) {
    const keys = String(path).split(".");
    const last = keys.pop();
    const node = keys.length ? getPath(obj, keys.join(".")) : obj;
    if (isObj(node)) delete node[last];
  }
  const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

  function uniqueId(existing, base) {
    const taken = new Set(existing);
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base}_${n}`)) return `${base}_${n}`;
  }

  // Move item i by `by` places inside arr; returns the new index (unchanged at the edges).
  function move(arr, i, by) {
    const j = i + by;
    if (j < 0 || j >= arr.length) return i;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return j;
  }

  // Chance of at least one interruption on a journey, given per-check chance in percent.
  function journeyChance(chancePercent, minutes, minutesPerCheck) {
    const checks = Math.ceil(minutes / minutesPerCheck);
    return 1 - Math.pow(1 - chancePercent / 100, checks);
  }

  const api = {
    format, inline, detectEol, parseDataFile, serializeDataFile, parseJsonFile, serializeJsonFile,
    getPath, setPath, deletePath, clone, uniqueId, move, journeyChance, isObj
  };
  root.EditorCore = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
