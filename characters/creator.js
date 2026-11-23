/* Character creator module v0.1 — data-driven starting builds. See ENGINE_SPEC.md.
   The UI calls preview()/validate() for the form, then fires creator:create.
   create() adds the chosen background, origin and focus stat changes to the base stats,
   grants their equipment through equipment:add, and asks mainCharacter to store the new
   character through mainCharacter:create. Modules still talk only through events.
   Content lives in characters/creatorData.js; the editor edits it like any other data file. */
(function (global) {
  "use strict";
  const D = global.CharacterCreatorData;
  const MC = global.MainCharacterData;
  const SD = global.CharacterStatsData;

  if (!D || typeof D !== "object")
    throw new Error("characters/creatorData.js must define CharacterCreatorData");
  if (!MC || !Array.isArray(MC.genders) || !MC.genders.length)
    throw new Error("characters/mainCharacterData.js must define MainCharacterData.genders");
  if (!SD || !Array.isArray(SD.stats) || !SD.stats.length)
    throw new Error("characters/statsData.js must define CharacterStatsData.stats");

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const round = (n, fallback = 0) => Number.isFinite(Number(n)) ? Math.round(Number(n)) : fallback;
  const STAT_DEFS = SD.stats;
  const STAT_BY_KEY = new Map(STAT_DEFS.map((def) => [def.key, def]));

  const SETTINGS = D.settings && typeof D.settings === "object" ? D.settings : {};
  const RESOURCE_START = clamp(round(SETTINGS.resourceStartPercent, 80), 0, 100);
  const MAX_ITEMS = Math.max(0, round(SETTINGS.maxStartingItems, 6));

  const optionList = (name) => (Array.isArray(D[name]) ? D[name] : [])
    .filter((entry) => entry && typeof entry.key === "string" && entry.key.trim() && typeof entry.name === "string" && entry.name.trim())
    .map((entry) => ({
      ...entry,
      key: entry.key.trim(),
      name: entry.name.trim(),
      description: typeof entry.description === "string" ? entry.description : "",
      stats: Array.isArray(entry.stats) ? entry.stats : [],
      equipment: Array.isArray(entry.equipment)
        ? entry.equipment.filter((key) => typeof key === "string" && key.trim()).map((key) => key.trim())
        : []
    }));

  const BACKGROUNDS = optionList("backgrounds");
  const ORIGINS = optionList("origins");
  const FOCUSES = optionList("focuses");

  if (!BACKGROUNDS.length) throw new Error("CharacterCreatorData needs at least one background");
  if (!ORIGINS.length) throw new Error("CharacterCreatorData needs at least one origin");
  if (!FOCUSES.length) throw new Error("CharacterCreatorData needs at least one focus");

  const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
  const BACKGROUND_BY_KEY = byKey(BACKGROUNDS);
  const ORIGIN_BY_KEY = byKey(ORIGINS);
  const FOCUS_BY_KEY = byKey(FOCUSES);

  const baseStats = () => {
    const stats = {};
    for (const def of STAT_DEFS) {
      if (def.kind === "equipment") {
        stats[def.key] = clamp(0, def.min, def.max);
        continue;
      }
      const start = def.kind === "resource"
        ? Math.round(def.max * (RESOURCE_START / 100))
        : def.start;
      stats[def.key] = clamp(round(start, def.start), def.min, def.max);
      if (def.kind === "resource") stats[def.key + "Max"] = def.max;
    }
    return stats;
  };

  const applyChanges = (stats, changes) => {
    for (const effect of Array.isArray(changes) ? changes : []) {
      if (!effect || typeof effect.stat !== "string") continue;
      const def = STAT_BY_KEY.get(effect.stat.trim());
      if (!def || def.kind === "equipment") continue;
      const delta = round(effect.delta, 0);
      if (!delta) continue;
      const max = def.kind === "resource" ? stats[def.key + "Max"] : def.max;
      stats[def.key] = clamp((stats[def.key] || 0) + delta, def.min, max);
    }
    return stats;
  };

  const choose = (list, map, value, label) => {
    const key = typeof value === "string" ? value.trim() : "";
    if (!key) return list[0];
    const found = map.get(key);
    if (!found) throw new Error(`Choose a valid ${label}.`);
    return found;
  };

  const planFor = (draft = {}) => {
    const background = choose(BACKGROUNDS, BACKGROUND_BY_KEY, draft.background, "background");
    const origin = choose(ORIGINS, ORIGIN_BY_KEY, draft.origin, "origin");
    const focus = choose(FOCUSES, FOCUS_BY_KEY, draft.focus, "focus");

    const stats = baseStats();
    applyChanges(stats, background.stats);
    applyChanges(stats, origin.stats);
    applyChanges(stats, focus.stats);

    const equipment = [];
    const seen = new Set();
    for (const key of [...background.equipment, ...origin.equipment, ...focus.equipment]) {
      if (seen.has(key)) continue;
      seen.add(key);
      equipment.push(key);
      if (equipment.length >= MAX_ITEMS) break;
    }

    return { background, origin, focus, stats, equipment };
  };

  const cleanProfile = (draft = {}) => {
    const name = String((draft && draft.name) || "").trim().replace(/\s+/g, " ");
    if (!name) throw new Error("Enter a name.");
    if (name.length > MC.nameMaxLength)
      throw new Error(`Name must be ${MC.nameMaxLength} characters or fewer.`);

    const gender = String((draft && draft.gender) || "").trim();
    if (!MC.genders.includes(gender)) throw new Error("Choose a gender.");

    const age = Math.round(Number(draft && draft.age));
    const [min, max] = MC.ageRange;
    if (!Number.isFinite(age) || age < min || age > max)
      throw new Error(`Age must be a whole number from ${min} to ${max}.`);

    const image = draft && typeof draft.image === "string" && draft.image.startsWith("data:image/")
      ? draft.image : null;
    return { name, gender, age, image };
  };

  function createCreatorModule() {
    let engine = null, bound = false;

    const S = () => engine.state.modules.creator;   // never cache: load() replaces the state

    const normalize = () => {
      const s = engine.slice("creator", { lastCreated: null });
      if (!s.lastCreated || typeof s.lastCreated !== "object") s.lastCreated = null;
      return s;
    };

    const copyOption = (option) => ({
      key: option.key, name: option.name, description: option.description,
      stats: option.stats.map((effect) => ({ ...effect })),
      equipment: option.equipment.slice()
    });

    const mod = {
      name: "creator", depends: ["mainCharacter", "equipment"],

      init(eng) {
        engine = eng;
        normalize();
        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        engine.on("event:creator:create", (e) => mod.create(e.depth + 1, e.data && e.data.draft));
      },

      onLoad(eng) {
        engine = eng;
        normalize();
      },

      backgrounds() { return BACKGROUNDS.map(copyOption); },
      origins() { return ORIGINS.map(copyOption); },
      focuses() { return FOCUSES.map(copyOption); },
      settings() { return { resourceStartPercent: RESOURCE_START, maxStartingItems: MAX_ITEMS }; },

      // Stat/equipment preview for the live form. Profile fields are not validated here, so
      // the panel can update while the player is still typing a name.
      preview(draft = {}) {
        const plan = planFor(draft);
        return {
          background: copyOption(plan.background),
          origin: copyOption(plan.origin),
          focus: copyOption(plan.focus),
          stats: { ...plan.stats },
          equipment: plan.equipment.slice()
        };
      },

      // Full validation used before firing creator:create. Returns the event payload.
      validate(draft = {}) {
        const profile = cleanProfile(draft);
        const plan = planFor(draft);
        return {
          ...profile,
          stats: { ...plan.stats },
          equipment: plan.equipment.slice(),
          creator: {
            background: plan.background.key,
            backgroundName: plan.background.name,
            origin: plan.origin.key,
            originName: plan.origin.name,
            focus: plan.focus.key,
            focusName: plan.focus.name,
            equipment: plan.equipment.slice()
          }
        };
      },

      // Queue the character first, then each starting item. mainCharacter saves immediately
      // when its request is handled, so the equipment lands on the new character in order.
      create(depth = 0, draft = {}) {
        const plan = mod.validate(draft);
        const s = normalize();
        s.lastCreated = {
          name: plan.name,
          background: plan.creator.background,
          backgroundName: plan.creator.backgroundName,
          origin: plan.creator.origin,
          originName: plan.creator.originName,
          focus: plan.creator.focus,
          focusName: plan.creator.focusName,
          stats: { ...plan.stats },
          equipment: plan.equipment.slice(),
          createdAtTick: engine.now.tick,
          createdAt: engine.now.text
        };

        engine.fire({
          type: "mainCharacter:create",
          text: `${plan.name} begins as a ${plan.creator.backgroundName} from the ${plan.creator.originName}, with a ${plan.creator.focusName} focus.`,
          data: plan
        }, depth);
        for (const key of plan.equipment) {
          engine.fire({
            type: "equipment:add",
            text: `Starting equipment: ${key}.`,
            data: { key, source: "creator" }
          }, depth);
        }
        engine.fire({
          type: "creator:created",
          text: `${plan.name}'s starting build is ready: ${plan.creator.backgroundName}, ${plan.creator.originName}, ${plan.creator.focusName}${plan.equipment.length ? ` · ${plan.equipment.length} starting item${plan.equipment.length === 1 ? "" : "s"}` : ""}.`,
          data: {
            name: plan.name,
            background: plan.creator.background,
            backgroundName: plan.creator.backgroundName,
            origin: plan.creator.origin,
            originName: plan.creator.originName,
            focus: plan.creator.focus,
            focusName: plan.creator.focusName,
            stats: { ...plan.stats },
            equipment: plan.equipment.slice()
          }
        }, depth + 1);
        return plan;
      },

      status() {
        const s = normalize();
        return { lastCreated: s.lastCreated ? JSON.parse(JSON.stringify(s.lastCreated)) : null };
      }
    };

    return mod;
  }

  global.createCreatorModule = createCreatorModule;
})(window);
