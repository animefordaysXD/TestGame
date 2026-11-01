/* Editor schemas v0.1 — what each content type looks like. No DOM; tested in Node.
   To add a content type: add its file to FILES, add a section (or sections) to SECTIONS, add a
   check to VALIDATORS and, if useful, a preview. The page (editor.html) needs no changes.
   See editor/README.md. */
(function (root) {
  "use strict";
  const C = (typeof module === "object" && module.exports) ? require("./core.js") : root.EditorCore;

  const BIOMES = ["forest", "grassland", "hills", "coast", "desert", "mountains", "swamp", "tundra", "jungle", "wasteland"];
  const KEY_RE = /^[a-z0-9_]+$/;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---- files the editor can change, and read-only reference files ---------------------------
  const FILES = [
    { id: "travel", path: "travel/data.js", format: "js", global: "TravelData" },
    { id: "equipment", path: "equipment/data.js", format: "js", global: "EquipmentData" },
    { id: "actions", path: "actions/data.js", format: "js", global: "LocationActionsData" },
    { id: "characters", path: "characters/data.js", format: "js", global: "CharacterData" },
    ...BIOMES.map((b) => ({ id: "biome:" + b, path: `locations/events/${b}/events.json`, format: "json" }))
  ];
  const REFS = [
    { id: "stats", path: "characters/statsData.js", global: "CharacterStatsData" },
    { id: "body", path: "characters/bodyData.js", global: "CharacterBodyData" },
    { id: "locations", path: "locations/data.js", global: "LocationData" },
    { id: "combat", path: "combat/data.js", global: "CombatData" }
  ];

  // ---- reusable field lists ---------------------------------------------------------------
  const effectsField = (label, help) => ({ key: "effects", label, type: "effects", help });
  const biomeEventFields = [
    { key: "id", label: "Id", type: "text", mono: true, help: "Unique inside this biome. Lowercase letters, digits and underscores." },
    { key: "name", label: "Name", type: "text" },
    { key: "enabled", label: "Enabled", type: "bool", defaultTrue: true, help: "Switch off to keep a template without rolling it." },
    { key: "chancePercent", label: "Chance per visit (%)", type: "number", min: 0, max: 100, step: 1 },
    { key: "text", label: "Text", type: "textarea", rows: 3, help: "Shown in the log when the event happens." },
    effectsField("Effects", "Stat changes applied to the main character.")
  ];
  const travelEventFields = [
    { key: "id", label: "Id", type: "text", mono: true },
    { key: "name", label: "Name", type: "text" },
    { key: "enabled", label: "Enabled", type: "bool", defaultTrue: true },
    { key: "weight", label: "Weight", type: "number", min: 0, step: 1, help: "Higher is picked more often when a journey is interrupted." },
    { key: "text", label: "Text", type: "textarea", rows: 3 },
    effectsField("Effects")
  ];
  const itemFields = [
    { key: "key", label: "Key", type: "text", mono: true, help: "Used by actions to hand this item out (equipmentKey)." },
    { key: "name", label: "Name", type: "text" },
    { key: "kind", label: "Kind", type: "select", source: "kinds", help: "Armor covers body parts; a weapon fills the one weapon slot." },
    { key: "rarity", label: "Rarity", type: "select", source: "rarities", help: "Common, Uncommon, Rare, Legendary or Unique. Stats should stay inside this rank's band." },
    { key: "weaponType", label: "Weapon type", type: "select", source: "weaponTypes", help: "Weapon only. Sword, spear, axe or mace." },
    { key: "armorType", label: "Armor type", type: "select", source: "armorTypes", help: "Armor only. Cloth, leather, mail, plate or scale." },
    { key: "parts", label: "Body parts (armor)", type: "multiselect", source: "bodyParts", help: "Armor only. The item covers these parts and replaces any item already on one of them." },
    { key: "armor", label: "Armor (armor)", type: "number", min: 0, step: 1, help: "Armor only. Added to total armor; every hit is reduced by it and Defend doubles it." },
    { key: "damage", label: "Damage (weapon)", type: "number", min: 0, step: 1, help: "Weapon only. Added to the wielder's attack damage." },
    { key: "strength", label: "Strength requirement (weapon)", type: "number", min: 1, max: 20, step: 1, help: "Weapon only. Below this Strength the weapon is too heavy and adds nothing." },
    { key: "armorPiercing", label: "Armor piercing % (weapon)", type: "number", min: 0, max: 100, step: 1, help: "Weapon only. Ignores this share of the target's armor." },
    { key: "weight", label: "Find weight", type: "number", min: 0, step: 1, help: "How often a random find picks it, relative to the others." },
    { key: "description", label: "Description", type: "textarea", rows: 2 }
  ];
  const outcomeFields = [
    { key: "id", label: "Id", type: "text", mono: true },
    { key: "name", label: "Name", type: "text" },
    { key: "weight", label: "Weight", type: "number", min: 0, step: 1, help: "Chance relative to the other outcomes." },
    { key: "text", label: "Text", type: "textarea", rows: 2 },
    effectsField("Effects"),
    { key: "equipmentKey", label: "Awards item", type: "select", source: "equipmentKeys", allowEmpty: true, omitIfEmpty: true }
  ];
  const actionFields = [
    { key: "id", label: "Id", type: "text", mono: true },
    { key: "name", label: "Name", type: "text" },
    { key: "description", label: "Description", type: "textarea", rows: 2 },
    { key: "timeMinutes", label: "Time (minutes)", type: "number", min: 0, step: 5 },
    { key: "costs", label: "Costs", type: "effects", help: "A negative change spends that stat." },
    { key: "requiresDestination", label: "Needs a destination (travel-like)", type: "bool", omitIfEmpty: true },
    { key: "travelText", label: "Travel text", type: "text", omitIfEmpty: true },
    {
      key: "outcomes", label: "Outcomes", type: "list", itemFields: outcomeFields, itemTitle: "name",
      // Outcome ids are checked across the whole actions file, so start from every existing id.
      newItem: (ctx, siblings) => ({
        id: C.uniqueId([...ctx.outcomeIds, ...siblings.map((o) => o.id)], "new_outcome"),
        name: "New outcome", weight: 1, text: "", effects: []
      })
    }
  ];

  const pct = (n) => (Math.round(n * 10) / 10) + "%";
  const signed = (n) => (n > 0 ? "+" : "−") + Math.abs(n);
  const partNames = (parts, ctx) => (Array.isArray(parts) ? parts : []).map((key) => {
    const def = (ctx.bodyParts || []).find((part) => part.key === key);
    return def ? def.label : key;
  });

  function chipsFor(effects, ctx) {
    return (Array.isArray(effects) ? effects : []).map((e) => {
      const def = ctx.statDefs.find((d) => d.key === e.stat);
      const delta = Number(e.delta);
      return { text: `${def ? def.short : e.stat} ${Number.isFinite(delta) ? signed(delta) : "?"}`, tone: delta > 0 ? "pos" : delta < 0 ? "neg" : "flat" };
    });
  }
  const weightShare = (items, item) => {
    const w = (x) => (x.enabled === false ? 0 : Math.max(0, Number(x.weight) || 0));
    const total = items.reduce((s, x) => s + w(x), 0);
    return total > 0 ? w(item) / total : 0;
  };

  // ---- sections: what the sidebar lists and what the form edits ------------------------------
  // kind "list": a list of entries (left) with a form (right).  kind "form": a single form.
  const biomeSections = BIOMES.map((b) => ({
    id: "biome:" + b, group: "Biome events", title: cap(b), file: "biome:" + b, kind: "list", at: ["events"],
    fields: biomeEventFields, label: (e) => e.name || e.id || "(unnamed)", sub: (e) => `${e.chancePercent}%`, off: (e) => e.enabled === false,
    newItem: (ctx, list) => ({ id: C.uniqueId(list.map((e) => e.id), `${b}_new_event`), name: "New event", enabled: true, chancePercent: 10, text: "", effects: [] }),
    preview(e, ctx) {
      const p = Number(e.chancePercent);
      return {
        log: e.text, chips: chipsFor(e.effects, ctx),
        notes: [e.enabled === false ? "Disabled: this event never rolls." : (p > 0 ? `Rolls on every visit to a ${b} location: about one visit in ${Math.round(100 / p)}.` : "A chance of 0% never happens.")]
      };
    }
  }));

  const SECTIONS = [
    ...biomeSections,
    {
      id: "travel-events", group: "Travel", title: "Travel events", file: "travel", kind: "list", at: ["events"],
      fields: travelEventFields, label: (e) => e.name || e.id || "(unnamed)", sub: (e) => `weight ${e.weight}`, off: (e) => e.enabled === false,
      newItem: (ctx, list) => ({ id: C.uniqueId(list.map((e) => e.id), "new_travel_event"), name: "New travel event", weight: 1, enabled: true, text: "", effects: [] }),
      preview(e, ctx, data) {
        const t = data.travel, share = weightShare(t.events, e);
        const notes = [e.enabled === false ? "Disabled: never picked." : `Picked ${pct(share * 100)} of the time when a journey is interrupted.`];
        const p = Number(t.chancePercent), mpc = Number(t.minutesPerCheck);
        if (p >= 0 && mpc > 0) notes.push(`A 60 minute journey is interrupted ${pct(C.journeyChance(p, 60, mpc) * 100)} of the time at the default chance.`);
        return { log: e.text, chips: chipsFor(e.effects, ctx), notes };
      }
    },
    {
      id: "travel-tuning", group: "Travel", title: "Travel tuning", file: "travel", kind: "form", at: [],
      fields: [
        { key: "minutesPerCheck", label: "Minutes per check", type: "number", min: 1, step: 1, help: "Travel rolls once per chunk of this many minutes." },
        { key: "chancePercent", label: "Interruption chance per check (%)", type: "number", min: 0, max: 100, step: 1 },
        { key: "chanceByBiome", label: "Chance by destination biome (%)", type: "map", keySource: "biomes", min: 0, max: 100, help: "Overrides the default for that biome." }
      ],
      preview(_, ctx, data) {
        const t = data.travel, mpc = Number(t.minutesPerCheck), notes = [];
        for (const m of [30, 60, 240]) notes.push(`${m} minute journey: interrupted ${pct(C.journeyChance(Number(t.chancePercent), m, mpc) * 100)} of the time at the default chance.`);
        return { notes };
      }
    },
    {
      id: "equipment-items", group: "Items", title: "Equipment", file: "equipment", kind: "list", at: ["items"],
      fields: itemFields, label: (i) => i.name || i.key || "(unnamed)",
      sub: (i) => `${i.kind === "weapon" ? "weapon" : "armor"} · ${(i.kind === "weapon" ? i.weaponType : i.armorType) || "untyped"} · ${i.rarity || "common"}`,
      newItem: (ctx, list) => ({
        key: C.uniqueId(list.map((i) => i.key), "new_item"), name: "New item",
        kind: "armor", rarity: (ctx.rarities[0] || "common"),
        armorType: (ctx.armorTypes[0] || "cloth"),
        parts: [(ctx.bodyParts[0] && ctx.bodyParts[0].key) || "torso"], armor: 1,
        damage: 0, strength: 1, armorPiercing: 0, weight: 1, description: ""
      }),
      preview(i, ctx, data) {
        const weapon = i.kind === "weapon";
        const rarity = (ctx.rarityDefs || []).find((r) => r.key === i.rarity);
        const typeKey = weapon ? i.weaponType : i.armorType;
        const typeDefs = (weapon ? ctx.weaponTypeDefs : ctx.armorTypeDefs) || [];
        const typeDef = typeDefs.find((t) => t.key === typeKey);
        const typeName = typeDef ? (typeDef.label || typeDef.key) : (typeKey || "untyped");
        const band = (range) => Array.isArray(range) && range.length === 2 ? `${range[0]}-${range[1]}` : "?";
        const notes = [];
        if (rarity) {
          notes.push(`${rarity.label || rarity.key} band: armor ${band(rarity.armor)}, damage ${band(rarity.damage)}, Strength ${band(rarity.strength)}, piercing ${band(rarity.armorPiercing)}.`);
        } else if (i.rarity) {
          notes.push(`Unknown rarity "${i.rarity}".`);
        }
        if (!typeKey) notes.push(`No ${weapon ? "weapon" : "armor"} type: it falls back to ${typeDefs[0] ? (typeDefs[0].label || typeDefs[0].key) : "none"}.`);
        else if (!typeDef) notes.push(`Unknown ${weapon ? "weapon" : "armor"} type "${typeKey}".`);
        const chips = [{ text: `${weapon ? "Weapon" : "Armor"} · ${typeName} · ${i.rarity || "common"}`, tone: "flat" }];

        if (weapon) {
          const damage = Number(i.damage), strength = Number(i.strength), piercing = Number(i.armorPiercing);
          chips.push({ text: `Damage ${i.damage || 0}`, tone: "pos" }, { text: `Str ${i.strength || 0}`, tone: "flat" }, { text: `Pierce ${i.armorPiercing || 0}%`, tone: "neg" });
          if (Number.isFinite(damage)) notes.push(`Adds ${damage} damage to a wielder who meets Strength ${strength}.`);
          if (Number.isFinite(piercing)) notes.push(`Ignores ${piercing}% of the target's armor${Number.isFinite(strength) ? `, but only at Strength ${strength} or above` : ""}.`);
        } else {
          const armor = Number(i.armor);
          const parts = partNames(i.parts, ctx);
          chips.push({ text: `Armor ${i.armor}`, tone: "pos" }, ...parts.map((p) => ({ text: p, tone: "flat" })));
          if (parts.length) notes.push(`Covers ${parts.join(", ")}.`);
          else notes.push("Covers no body part, so it can never be equipped.");
          if (Number.isFinite(armor)) notes.push(`Every hit loses ${armor}; Defend blocks ${armor * ctx.armorMultiplier} (armor ${armor} times ${ctx.armorMultiplier}).`);
        }

        const total = data.equipment.items
          .filter((x) => (x.kind === "weapon") === weapon)
          .reduce((s, x) => s + Math.max(0, Number(x.weight) || 0), 0);
        if (total > 0) notes.push(`A random ${weapon ? "weapon" : "armor"} find picks it ${pct((Math.max(0, Number(i.weight) || 0) / total) * 100)} of the time.`);
        return { log: i.description, chips, notes };
      }
    },
    {
      id: "equipment-settings", group: "Items", title: "Equipment settings", file: "equipment", kind: "form", at: [],
      fields: [
        { key: "maxArmor", label: "Armor cap", type: "number", min: 1, step: 1, help: "Total armor from all worn items is clamped to this value." },
        { key: "autoEquip", label: "Equip new items automatically when their slot is free", type: "bool" }
      ],
      preview(_, ctx, data) {
        const items = data.equipment.items || [];
        const armor = items.filter((item) => item.kind !== "weapon");
        const weapons = items.filter((item) => item.kind === "weapon");
        const covered = new Set(armor.flatMap((item) => Array.isArray(item.parts) ? item.parts : []));
        const rarities = (data.equipment.rarities || []).map((r) => r.label || r.key);
        const weaponTypes = (data.equipment.weaponTypes || []).map((t) => t.label || t.key);
        const armorTypes = (data.equipment.armorTypes || []).map((t) => t.label || t.key);
        return { notes: [
          `${armor.length} armor items cover ${covered.size} of ${ctx.bodyParts.length} body parts; ${weapons.length} weapons fill the one weapon slot.`,
          rarities.length ? `Rarity ranks: ${rarities.join(", ")}.` : "No rarity ranks defined: every item falls back to common.",
          weaponTypes.length ? `Weapon types: ${weaponTypes.join(", ")}.` : "No weapon types defined: weapons fall back to untyped.",
          armorTypes.length ? `Armor types: ${armorTypes.join(", ")}.` : "No armor types defined: armor falls back to untyped.",
          `A find is filtered by kind, rarity or type and picked by weight; the armour cap is ${data.equipment.maxArmor}.`,
          data.equipment.autoEquip === false ? "New items stay in the inventory until equipped." : "New items equip automatically when their slot is free."
        ] };
      }
    },
    {
      id: "actions-default", group: "Actions", title: "Area actions", file: "actions", kind: "list", at: ["default"],
      fields: actionFields, label: (a) => a.name || a.id || "(unnamed)", sub: (a) => `${a.timeMinutes} min`,
      newItem: (ctx, list) => ({ id: C.uniqueId(list.map((a) => a.id), "new_action"), name: "New action", description: "", timeMinutes: 30, costs: [], outcomes: [] }),
      preview: actionPreview
    },
    {
      id: "character-names", group: "Characters", title: "Names", file: "characters", kind: "form", at: [],
      fields: [
        { key: "firstNames.male", label: "Male first names", type: "lines", help: "One per line." },
        { key: "firstNames.female", label: "Female first names", type: "lines", help: "One per line." },
        { key: "surnames", label: "Surnames", type: "lines", help: "One per line." }
      ],
      preview(_, ctx, data) {
        const d = data.characters, m = d.firstNames.male.length, f = d.firstNames.female.length, s = d.surnames.length;
        return { notes: [`${(m + f) * s} possible full names (${m} male, ${f} female, ${s} surnames).`] };
      }
    },
    {
      id: "character-traits", group: "Characters", title: "Traits and ages", file: "characters", kind: "form", at: [],
      fields: [
        { key: "traits", label: "Traits", type: "lines", help: "One per line. Each NPC gets five." },
        { key: "opposites", label: "Opposite pairs", type: "pairs", source: "traits", help: "Two traits in a pair never appear on the same NPC." },
        { key: "ageRange", label: "Age range", type: "range", min: 0, max: 120 }
      ],
      preview(_, ctx, data) {
        const d = data.characters;
        return { notes: [`${d.traits.length} traits, ${d.opposites.length} opposite pairs. Each NPC draws 5.`] };
      }
    }
  ];

  function actionPreview(a, ctx) {
    const outs = Array.isArray(a.outcomes) ? a.outcomes : [];
    const total = outs.reduce((s, o) => s + Math.max(0, o.weight === undefined ? 1 : Number(o.weight) || 0), 0);
    const notes = [`Takes ${a.timeMinutes} minutes.`];
    for (const o of outs) {
      const w = Math.max(0, o.weight === undefined ? 1 : Number(o.weight) || 0);
      notes.push(`${o.name || o.id}: ${total > 0 ? pct((w / total) * 100) : "never"}${o.equipmentKey ? ` (awards ${o.equipmentKey})` : ""}`);
    }
    if (!outs.length) notes.push(a.requiresDestination ? "Travel-like: the destination decides what happens." : "No outcomes: nothing happens when it resolves.");
    return { log: a.description, chips: chipsFor(a.costs, ctx), notes };
  }

  // Sections that depend on the data: one extra list per existing biome override of the actions.
  function sectionsFor(data) {
    const extra = [];
    const biomes = data && data.actions && data.actions.biomes;
    if (biomes && typeof biomes === "object") {
      for (const key of Object.keys(biomes)) {
        extra.push({
          id: "actions-biome:" + key, group: "Actions", title: `Override: ${cap(key)}`, file: "actions", kind: "list", at: ["biomes", key],
          fields: actionFields, label: (a) => a.name || a.id || "(unnamed)", sub: (a) => `${a.timeMinutes} min`,
          newItem: (ctx, list) => ({ id: C.uniqueId(list.map((a) => a.id), `${key}_new_action`), name: "New action", description: "", timeMinutes: 30, costs: [], outcomes: [] }),
          preview: actionPreview
        });
      }
    }
    const at = SECTIONS.findIndex((s) => s.id === "actions-default") + 1;
    return [...SECTIONS.slice(0, at), ...extra, ...SECTIONS.slice(at)];
  }

  // ---- context: reference data the forms and checks need ------------------------------------
  // Every outcome id in the actions file: the checks require them to be unique across actions.
  function outcomeIds(data) {
    const ids = [];
    const actions = data && data.actions;
    if (!actions) return ids;
    const add = (list) => {
      if (!Array.isArray(list)) return;
      for (const a of list)
        if (a && Array.isArray(a.outcomes))
          for (const o of a.outcomes) if (o && typeof o.id === "string") ids.push(o.id);
    };
    add(actions.default);
    for (const list of Object.values(actions.biomes || {})) add(list);
    return ids;
  }

  // Give a duplicated action's outcomes fresh ids. The checks require uniqueness across the file.
  function duplicateOutcomeIds(copy, data) {
    if (!copy || !Array.isArray(copy.outcomes)) return copy;
    const taken = new Set(outcomeIds(data));
    for (const o of copy.outcomes) {
      if (!o || typeof o.id !== "string") continue;
      o.id = C.uniqueId([...taken], o.id + "_copy");
      taken.add(o.id);
    }
    return copy;
  }

  function buildContext(data, refs) {
    const statDefs = (refs.stats && refs.stats.stats) || [];
    const equipment = data.equipment || {};
    const bodyParts = (refs.body && Array.isArray(refs.body.parts) ? refs.body.parts : [])
      .map((part) => ({ key: part.key, label: part.label || part.key }));
    const rarityDefs = Array.isArray(equipment.rarities) ? equipment.rarities : [];
    const weaponTypeDefs = Array.isArray(equipment.weaponTypes) ? equipment.weaponTypes : [];
    const armorTypeDefs = Array.isArray(equipment.armorTypes) ? equipment.armorTypes : [];
    return {
      statDefs,
      statKeys: statDefs.filter((d) => d.kind !== "equipment").map((d) => d.key),
      equipmentStatKeys: statDefs.filter((d) => d.kind === "equipment").map((d) => d.key),
      biomes: (refs.locations && refs.locations.biomes ? refs.locations.biomes.map((b) => b.key) : BIOMES),
      bodyParts,
      bodyPartKeys: bodyParts.map((part) => part.key),
      equipmentKeys: Array.isArray(equipment.items) ? equipment.items.map((i) => i.key) : [],
      kinds: ["armor", "weapon"],
      rarityDefs,
      rarities: rarityDefs.map((r) => r.key),
      weaponTypeDefs,
      weaponTypes: weaponTypeDefs.map((t) => t.key),
      armorTypeDefs,
      armorTypes: armorTypeDefs.map((t) => t.key),
      traits: data.characters && Array.isArray(data.characters.traits) ? data.characters.traits : [],
      outcomeIds: outcomeIds(data),
      armorMultiplier: (refs.combat && refs.combat.defend && refs.combat.defend.armorMultiplier) || 2
    };
  }

  function optionsFor(source, ctx) {
    if (source === "stats") return ctx.statDefs.filter((d) => d.kind !== "equipment").map((d) => ({ value: d.key, label: d.label }));
    if (source === "bodyParts") return (ctx.bodyParts || []).map((part) => ({ value: part.key, label: part.label }));
    if (source === "kinds") return (ctx.kinds || []).map((kind) => ({ value: kind, label: cap(kind) }));
    if (source === "rarities") return (ctx.rarityDefs || []).map((r) => ({ value: r.key, label: r.label || r.key }));
    if (source === "weaponTypes") return (ctx.weaponTypeDefs || []).map((t) => ({ value: t.key, label: t.label || t.key }));
    if (source === "armorTypes") return (ctx.armorTypeDefs || []).map((t) => ({ value: t.key, label: t.label || t.key }));
    const list = { equipmentKeys: ctx.equipmentKeys, biomes: ctx.biomes, traits: ctx.traits }[source] || [];
    return list.map((v) => ({ value: v, label: v }));
  }

  // ---- checks -----------------------------------------------------------------------------
  // Each returns [{ level: "error"|"warn", message, section?, index?, field? }].
  function makeReporter(out, section) {
    return (level, message, index, field) => out.push({ level, message, section, index: index === undefined ? null : index, field: field || null });
  }

  function checkEffects(list, label, ctx, report, index) {
    if (!Array.isArray(list)) return report("error", `${label} must be a list.`, index, "effects");
    list.forEach((e, i) => {
      const where = `${label} #${i + 1}`;
      if (!e || typeof e !== "object") return report("error", `${where} is not an effect.`, index);
      if (ctx.statKeys.length && !ctx.statKeys.includes(e.stat)) {
        if (ctx.equipmentStatKeys.includes(e.stat)) report("warn", `${where}: ${e.stat} comes from equipment and is ignored here.`, index);
        else report("error", `${where}: unknown stat "${e.stat}".`, index);
      }
      if (!Number.isInteger(e.delta)) report("error", `${where}: the change must be a whole number.`, index);
      else if (e.delta === 0) report("warn", `${where}: a change of 0 does nothing.`, index);
    });
  }

  function checkIds(list, idKey, report, noun) {
    const seen = new Map();
    list.forEach((item, i) => {
      const id = item && item[idKey];
      if (typeof id !== "string" || !id) return report("error", `${noun} #${i + 1} has no ${idKey}.`, i, idKey);
      if (!KEY_RE.test(id)) report("warn", `"${id}" should use lowercase letters, digits and underscores.`, i, idKey);
      if (seen.has(id)) report("error", `"${id}" is used twice (#${seen.get(id) + 1} and #${i + 1}).`, i, idKey);
      else seen.set(id, i);
    });
  }

  function num(v) { return typeof v === "number" && Number.isFinite(v); }

  const VALIDATORS = {
    biome(file, d, ctx, out) {
      const key = file.id.slice(6), report = makeReporter(out, file.id);
      if (!d || !Array.isArray(d.events)) return report("error", "The file needs an \"events\" list.");
      if (d.biome !== key) report("warn", `The file says biome "${d.biome}" but lives in the ${key} folder.`);
      checkIds(d.events, "id", report, "Event");
      d.events.forEach((e, i) => {
        if (!e.name) report("warn", "Give the event a name.", i, "name");
        if (!num(e.chancePercent)) report("error", "Chance must be a number.", i, "chancePercent");
        else if (e.chancePercent < 0 || e.chancePercent > 100) report("error", "Chance must be between 0 and 100.", i, "chancePercent");
        if (e.chance !== undefined && e.chancePercent !== undefined) report("warn", "Has both chance and chancePercent; chancePercent wins.", i);
        if (!e.text) report("warn", "The event has no text.", i, "text");
        if (e.enabled !== undefined && typeof e.enabled !== "boolean") report("error", "Enabled must be on or off.", i, "enabled");
        checkEffects(e.effects, "Effect", ctx, report, i);
      });
    },
    travel(file, d, ctx, out) {
      const report = makeReporter(out, "travel-events"), tune = makeReporter(out, "travel-tuning");
      if (!Number.isInteger(d.minutesPerCheck) || d.minutesPerCheck < 1) tune("error", "Minutes per check must be a whole number of at least 1.", null, "minutesPerCheck");
      if (!num(d.chancePercent) || d.chancePercent < 0 || d.chancePercent > 100) tune("error", "Interruption chance must be between 0 and 100.", null, "chancePercent");
      if (d.chanceByBiome && typeof d.chanceByBiome === "object") {
        for (const [k, v] of Object.entries(d.chanceByBiome)) {
          if (!ctx.biomes.includes(k)) tune("warn", `"${k}" is not a known biome.`, null, "chanceByBiome");
          if (!num(v) || v < 0 || v > 100) tune("error", `The chance for ${k} must be between 0 and 100.`, null, "chanceByBiome");
        }
      }
      if (!Array.isArray(d.events)) return report("error", "The file needs an \"events\" list.");
      checkIds(d.events, "id", report, "Event");
      d.events.forEach((e, i) => {
        if (!e.name) report("warn", "Give the event a name.", i, "name");
        if (!e.text) report("warn", "The event has no text.", i, "text");
        if (!num(e.weight) || e.weight < 0) report("error", "Weight must be a number, 0 or more.", i, "weight");
        checkEffects(e.effects, "Effect", ctx, report, i);
      });
      if (!d.events.some((e) => e.enabled !== false && num(e.weight) && e.weight > 0)) report("warn", "No enabled event with weight above 0: journeys can never be interrupted.");
    },
    equipment(file, d, ctx, out) {
      const report = makeReporter(out, "equipment-items"), set = makeReporter(out, "equipment-settings");
      if (!Number.isInteger(d.maxArmor) || d.maxArmor < 1) set("error", "Armor cap must be a whole number of at least 1.", null, "maxArmor");
      if (typeof d.autoEquip !== "boolean") set("error", "Auto-equip must be on or off.", null, "autoEquip");
      if (!Array.isArray(d.rarities) || !d.rarities.length) report("warn", "No rarity ranks defined; every item falls back to common.", null, "rarities");
      const rarityByKey = new Map((Array.isArray(d.rarities) ? d.rarities : []).map((r) => [r && r.key, r]));
      const checkTypeDefs = (list, field, label) => {
        if (!Array.isArray(list) || !list.length) {
          report("warn", `No ${label.toLowerCase()}s defined; the first one is assumed.`, null, field);
          return new Map();
        }
        checkIds(list, "key", report, label);
        list.forEach((t, i) => {
          if (!t || typeof t.label !== "string" || !t.label.trim()) report("warn", `${label} #${i + 1} has no label.`, null, field);
        });
        return new Map(list.map((t) => [t && t.key, t]));
      };
      const weaponTypeByKey = checkTypeDefs(d.weaponTypes, "weaponTypes", "Weapon type");
      const armorTypeByKey = checkTypeDefs(d.armorTypes, "armorTypes", "Armor type");
      if (Array.isArray(d.rarities)) {
        checkIds(d.rarities, "key", report, "Rarity");
        d.rarities.forEach((r, i) => {
          if (!r || typeof r.label !== "string" || !r.label.trim()) report("warn", `Rarity #${i + 1} has no label.`, null, "rarities");
          for (const field of ["armor", "damage", "strength", "armorPiercing"]) {
            const range = r && r[field];
            if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isInteger) || range[0] > range[1])
              report("error", `Rarity "${r && r.key}" needs a ${field} range of two whole numbers, low to high.`, null, "rarities");
          }
        });
      }
      if (!Array.isArray(d.items)) return report("error", "The file needs an \"items\" list.");
      checkIds(d.items, "key", report, "Item");
      d.items.forEach((it, i) => {
        if (!it.name) report("warn", "Give the item a name.", i, "name");
        if (!it.kind) report("warn", "Missing kind; the item is treated as armor.", i, "kind");
        else if (it.kind !== "armor" && it.kind !== "weapon") report("error", "Kind must be \"armor\" or \"weapon\".", i, "kind");
        if (!it.rarity) report("warn", "Give the item a rarity; common is assumed.", i, "rarity");
        else if (rarityByKey.size && !rarityByKey.has(it.rarity)) report("error", `Unknown rarity "${it.rarity}".`, i, "rarity");
        const rarity = rarityByKey.get(it.rarity);
        const band = (value, range, label, field) => {
          if (!Array.isArray(range) || range.length !== 2 || !num(value)) return;
          if (value < range[0] || value > range[1])
            report("warn", `${label} ${value} is outside the ${it.rarity} band (${range[0]}-${range[1]}).`, i, field);
        };

        if (it.kind === "weapon") {
          if (!it.weaponType) report("warn", "Give the weapon a weaponType; the first type is assumed.", i, "weaponType");
          else if (weaponTypeByKey.size && !weaponTypeByKey.has(it.weaponType)) report("error", `Unknown weaponType "${it.weaponType}".`, i, "weaponType");
          if (it.armorType) report("error", "Weapons use weaponType; armorType is ignored.", i, "armorType");
          if (Array.isArray(it.parts) && it.parts.length) report("warn", "Weapons ignore body parts; they fill the weapon slot.", i, "parts");
          if (!Number.isInteger(it.damage) || it.damage < 1) report("error", "Weapon damage must be a whole number of at least 1.", i, "damage");
          if (!Number.isInteger(it.strength) || it.strength < 1 || it.strength > 20) report("error", "Strength requirement must be a whole number from 1 to 20.", i, "strength");
          if (!num(it.armorPiercing) || it.armorPiercing < 0 || it.armorPiercing > 100) report("error", "Armor piercing must be between 0 and 100.", i, "armorPiercing");
          if (it.armor) report("warn", "Weapons do not add armor; armor is ignored.", i, "armor");
          if (rarity) {
            band(it.damage, rarity.damage, "Damage", "damage");
            band(it.strength, rarity.strength, "Strength requirement", "strength");
            band(it.armorPiercing, rarity.armorPiercing, "Armor piercing", "armorPiercing");
          }
        } else {
          if (!it.armorType) report("warn", "Give the armor an armorType; the first type is assumed.", i, "armorType");
          else if (armorTypeByKey.size && !armorTypeByKey.has(it.armorType)) report("error", `Unknown armorType "${it.armorType}".`, i, "armorType");
          if (it.weaponType) report("error", "Armor uses armorType; weaponType is ignored.", i, "weaponType");
          if (it.damage || it.armorPiercing) report("warn", "Armor does not use damage or armor piercing; they are ignored.", i, "damage");
          if (!Array.isArray(it.parts) || !it.parts.length) {
            report("error", "Target at least one body part.", i, "parts");
          } else {
            const seen = new Set();
            for (const part of it.parts) {
              if (ctx.bodyPartKeys.length && !ctx.bodyPartKeys.includes(part)) report("error", `Body part "${part}" is not in characters/bodyData.js.`, i, "parts");
              else if (seen.has(part)) report("warn", `Body part "${part}" is listed twice.`, i, "parts");
              else seen.add(part);
            }
          }
          if (!Number.isInteger(it.armor) || it.armor < 0) report("error", "Armor must be a whole number, 0 or more.", i, "armor");
          else if (Number.isInteger(d.maxArmor) && it.armor > d.maxArmor) report("error", `Armor is above the cap of ${d.maxArmor}.`, i, "armor");
          if (rarity) band(it.armor, rarity.armor, "Armor", "armor");
        }
        if (!num(it.weight) || it.weight < 0) report("error", "Find weight must be a number, 0 or more.", i, "weight");
      });
    },
    actions(file, d, ctx, out) {
      const lists = [["actions-default", d.default, "default"]];
      for (const [k, v] of Object.entries(d.biomes || {})) lists.push(["actions-biome:" + k, v, k]);
      const outcomeIds = new Map();
      for (const [section, list, name] of lists) {
        const report = makeReporter(out, section);
        if (!Array.isArray(list)) { report("error", `The ${name} list is missing.`); continue; }
        if (list.length < 5) report("warn", `Only ${list.length} actions; the actions module expects at least five.`);
        checkIds(list, "id", report, "Action");
        list.forEach((a, i) => {
          if (!a.name) report("warn", "Give the action a name.", i, "name");
          if (!Number.isInteger(a.timeMinutes) || a.timeMinutes < 0) report("error", "Time must be a whole number of minutes, 0 or more.", i, "timeMinutes");
          checkEffects(a.costs, "Cost", ctx, report, i);
          const outs = Array.isArray(a.outcomes) ? a.outcomes : [];
          if (!Array.isArray(a.outcomes)) report("error", "Outcomes must be a list.", i, "outcomes");
          if (!outs.length && !a.requiresDestination) report("warn", "No outcomes: nothing happens when it resolves.", i, "outcomes");
          outs.forEach((o, j) => {
            const where = `Outcome #${j + 1}`;
            if (!o.id) report("error", `${where} has no id.`, i, "outcomes");
            else if (outcomeIds.has(o.id)) report("error", `Outcome id "${o.id}" is used twice (also in ${outcomeIds.get(o.id)}).`, i, "outcomes");
            else outcomeIds.set(o.id, a.name || a.id);
            if (o.weight !== undefined && (!num(o.weight) || o.weight < 0)) report("error", `${where}: weight must be a number, 0 or more.`, i, "outcomes");
            if (o.equipmentKey && ctx.equipmentKeys.length && !ctx.equipmentKeys.includes(o.equipmentKey)) report("error", `${where}: there is no item "${o.equipmentKey}".`, i, "outcomes");
            checkEffects(o.effects, `${where} effect`, ctx, report, i);
          });
        });
      }
    },
    characters(file, d, ctx, out) {
      const names = makeReporter(out, "character-names"), traits = makeReporter(out, "character-traits");
      const strings = (list, label, report, field) => {
        if (!Array.isArray(list) || !list.length || list.some((s) => typeof s !== "string" || !s.trim())) return report("error", `${label} needs at least one name.`, null, field);
        const dup = list.filter((s, i) => list.indexOf(s) !== i);
        if (dup.length) report("warn", `${label} repeats: ${[...new Set(dup)].join(", ")}.`, null, field);
      };
      const fn = d.firstNames || {};
      strings(fn.male, "Male first names", names, "firstNames.male");
      strings(fn.female, "Female first names", names, "firstNames.female");
      strings(d.surnames, "Surnames", names, "surnames");
      strings(d.traits, "Traits", traits, "traits");
      if (Array.isArray(d.traits) && d.traits.length < 5) traits("error", "Each NPC draws five traits, so there must be at least five.", null, "traits");
      if (!Array.isArray(d.ageRange) || d.ageRange.length !== 2 || !d.ageRange.every(Number.isInteger) || d.ageRange[0] < 0 || d.ageRange[0] >= d.ageRange[1])
        traits("error", "Age range needs two whole numbers, the first smaller than the second.", null, "ageRange");
      if (!Array.isArray(d.opposites)) return traits("error", "Opposite pairs must be a list.", null, "opposites");
      d.opposites.forEach((p, i) => {
        if (!Array.isArray(p) || p.length !== 2) return traits("error", `Pair #${i + 1} needs two traits.`, null, "opposites");
        if (p[0] === p[1]) traits("error", `Pair #${i + 1} uses ${p[0]} twice.`, null, "opposites");
        for (const t of p) if (Array.isArray(d.traits) && !d.traits.includes(t)) traits("error", `Pair #${i + 1}: "${t}" is not in the trait list.`, null, "opposites");
      });
    }
  };

  // Check every loaded file. `data` maps file id -> parsed data (null/undefined when not loaded).
  function validateAll(data, refs) {
    const ctx = buildContext(data, refs || {});
    const out = [];
    for (const file of FILES) {
      const d = data[file.id];
      if (d === undefined || d === null) continue;
      const kind = file.id.startsWith("biome:") ? "biome" : file.id;
      try { VALIDATORS[kind](file, d, ctx, out); }
      catch (e) { out.push({ level: "error", message: `Could not check ${file.path}: ${e.message}`, section: null, index: null, field: null }); }
    }
    return out;
  }

  const api = { BIOMES, FILES, REFS, SECTIONS, sectionsFor, buildContext, optionsFor, validateAll, chipsFor, weightShare, outcomeIds, duplicateOutcomeIds };
  root.EditorSchemas = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
