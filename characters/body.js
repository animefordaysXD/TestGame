/* Shared body helper — creates and normalises the humanoid body every character owns.
   No state, no events and no DOM; the characters and mainCharacter modules both use it.
   The part definitions live in characters/bodyData.js. See ENGINE_SPEC.md. */
(function (root) {
  "use strict";
  const D = root.CharacterBodyData;
  if (!D || !Array.isArray(D.parts) || !D.parts.length)
    throw new Error("characters/bodyData.js must define CharacterBodyData.parts");

  const DEFAULT_STATUS = typeof D.defaultStatus === "string" && D.defaultStatus ? D.defaultStatus : "intact";
  const isObj = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const copy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

  const makePart = (def, saved) => {
    const part = {
      key: def.key,
      label: def.label,
      kind: def.kind,
      side: def.side,
      parent: def.parent ?? null,
      vital: !!def.vital,
      status: DEFAULT_STATUS
    };
    if (isObj(saved)) {
      if (typeof saved.status === "string" && saved.status.trim()) part.status = saved.status.trim();
      for (const key of Object.keys(saved)) if (!(key in part)) part[key] = copy(saved[key]);
    }
    return part;
  };

  // Build the full body from the data file. Saved parts keep their status and any
  // unknown fields; missing parts are restored, so old saves gain a complete body.
  function normalise(body) {
    const source = isObj(body) && isObj(body.parts) ? body.parts : (isObj(body) ? body : {});
    const parts = {};
    for (const def of D.parts) parts[def.key] = makePart(def, source[def.key]);
    for (const key of Object.keys(source)) {
      if (!parts[key] && isObj(source[key])) parts[key] = copy(source[key]);
    }
    return { parts };
  }

  const create = () => normalise(null);

  root.CharacterBody = { create, normalise, parts: D.parts, defaultStatus: DEFAULT_STATUS };
})(window);
