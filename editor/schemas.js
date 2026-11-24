/* Editor schemas v0.3 — what each content type looks like. No DOM; tested in Node.
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
    { id: "creator", path: "characters/creatorData.js", format: "js", global: "CharacterCreatorData" },
    { id: "locations", path: "locations/data.js", format: "js", global: "LocationData" },
    { id: "map", path: "map/data.js", format: "js", global: "MapData" },
    { id: "encounters", path: "encounters/data.js", format: "js", global: "EncounterData" },
    ...BIOMES.map((b) => ({ id: "biome:" + b, path: `locations/events/${b}/events.json`, format: "json" }))
  ];
  const REFS = [
    { id: "stats", path: "characters/statsData.js", global: "CharacterStatsData" },
    { id: "body", path: "characters/bodyData.js", global: "CharacterBodyData" },
    { id: "combat", path: "combat/data.js", global: "CombatData" }
  ];

  // ---- reusable field lists ---------------------------------------------------------------
  const effectsField = (label, help) => ({ key: "effects", label, type: "effects", help });
  const biomeEventFields = [
    { key: "id", label: "Id", type: "text", mono: true, help: "Unique inside this biome. Lowercase letters, digits and underscores." },
    { key: "name", label: "Name", type: "text" },
    { key: "enabled", label: "Enabled", type: "bool", defaultTrue: true, help: "Switch off to keep a template without rolling it." },
    { key: "chancePercent", label: "Chance per visit (%)", type: "number", min: 0, max: 100, step: 1 },
    { key: "hostilityModifier", label: "Hostility modifier", type: "number", min: -1, max: 1, step: 0.1, help: "Positive makes a bad event more likely as hostility rises; negative does the reverse. 50 is neutral." },
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
  const creatorOptionFields = [
    { key: "key", label: "Key", type: "text", mono: true, help: "Stable id used by the creator module." },
    { key: "name", label: "Name", type: "text" },
    { key: "description", label: "Description", type: "textarea", rows: 2, help: "Shown beside the choice in the character creator." },
    effectsField("Starting stat changes", "Added to the base stats at creation. Resources start partly full, so positive and negative changes both matter."),
    { key: "equipment", label: "Starting equipment", type: "multiselect", source: "equipmentKeys", help: "Granted through equipment:add and auto-equipped when the slot is free." }
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

  const biomeFields = [
    { key: "key", label: "Key", type: "text", mono: true, help: "Unique biome key, used by events and travel overrides." },
    { key: "name", label: "Name", type: "text" },
    { key: "weight", label: "Spawn weight", type: "number", min: 0, step: 1, help: "Higher is picked more often when charting a location." },
    { key: "hostility", label: "Hostility range", type: "range", min: 1, max: 100, help: "50 is neutral; above 50 is more dangerous and below is safer." },
    { key: "levelRange", label: "Level range", type: "range", min: 1, max: 100, help: "Locations in this biome roll a level in this range." },
    { key: "weather", label: "Weather", type: "lines", help: "One per line." },
    { key: "nouns", label: "Name nouns", type: "lines", help: "One per line; used to build location names." }
  ];
  const hostilityBandFields = [
    { key: "key", label: "Key", type: "text", mono: true },
    { key: "label", label: "Label", type: "text" },
    { key: "max", label: "Up to hostility", type: "number", min: 1, max: 100, step: 1 }
  ];
  const relationBandFields = [
    { key: "key", label: "Key", type: "text", mono: true },
    { key: "label", label: "Label", type: "text" },
    { key: "min", label: "From", type: "number", min: -100, max: 100, step: 1 },
    { key: "max", label: "To", type: "number", min: -100, max: 100, step: 1 },
    { key: "typeSpecific", label: "Use the relation type's high label", type: "bool", omitIfEmpty: true }
  ];
  const relationTypeFields = [
    { key: "key", label: "Key", type: "text", mono: true },
    { key: "label", label: "Label", type: "text" },
    { key: "highLabel", label: "61+ label", type: "text", help: "Shown at the top of the relation scale, e.g. Loving or Protective." }
  ];
  const spawnBandFields = [
    { key: "key", label: "Key", type: "text", mono: true },
    { key: "maxHostility", label: "Up to hostility", type: "number", min: 1, max: 100, step: 1 },
    { key: "chancePercent", label: "Spawn chance (%)", type: "number", min: 0, max: 100, step: 1 },
    { key: "minCount", label: "Min enemies", type: "number", min: 1, step: 1 },
    { key: "maxCount", label: "Max enemies", type: "number", min: 1, step: 1 }
  ];
  const lootBandFields = [
    { key: "key", label: "Key", type: "text", mono: true },
    { key: "maxHostility", label: "Up to hostility", type: "number", min: 1, max: 100, step: 1 },
    { key: "rarities", label: "Allowed rarities", type: "multiselect", source: "rarities", help: "One of these is picked for a drop in this hostility band." }
  ];
  const mapSiteFields = [
    { key: "key", label: "Key", type: "text", mono: true, help: "Stable content id; routes and the map state refer to it." },
    { key: "kind", label: "Kind", type: "text", help: "Landmark id such as tavern, castle or shack. Leave blank for a wild site." },
    { key: "name", label: "Name", type: "text" },
    { key: "biome", label: "Biome label", type: "text" },
    { key: "biomeKey", label: "Biome key", type: "text", mono: true, help: "Uses the location event file for this key. Landmarks use landmark." },
    { key: "weather", label: "Weather", type: "text" },
    { key: "hostility", label: "Hostility", type: "number", min: 1, max: 100, step: 1 },
    { key: "level", label: "Level", type: "number", min: 1, max: 100, step: 1 },
    { key: "interior", label: "Interior preset", type: "select", source: "interiors", allowEmpty: true, omitIfEmpty: true, help: "Generates procedural terrain on the first visit. Wild sites leave it blank." }
  ];
  const mapRouteFields = [
    { key: "id", label: "Id", type: "text", mono: true },
    { key: "from", label: "From", type: "select", source: "mapSites" },
    { key: "to", label: "To", type: "select", source: "mapSites" },
    { key: "distance", label: "Distance", type: "number", min: 1, max: 100, step: 1, help: "Abstract leagues; the locations module turns it into travel minutes." }
  ];
  const mapInteriorFields = [
    { key: "key", label: "Key", type: "text", mono: true },
    { key: "label", label: "Label", type: "text" },
    { key: "width", label: "Grid width", type: "number", min: 9, max: 61, step: 1 },
    { key: "height", label: "Grid height", type: "number", min: 7, max: 41, step: 1 },
    { key: "roomAttempts", label: "Room attempts", type: "number", min: 1, max: 40, step: 1 },
    { key: "roomWidth", label: "Room width range", type: "range", min: 2, max: 59 },
    { key: "roomHeight", label: "Room height range", type: "range", min: 2, max: 39 },
    { key: "rubbleChance", label: "Rubble chance", type: "number", min: 0, max: 1, step: 0.01 },
    { key: "waterChance", label: "Water chance", type: "number", min: 0, max: 1, step: 0.01 }
  ];

  const pct = (n) => (Math.round(n * 10) / 10) + "%";
  const signed = (n) => (n > 0 ? "+" : "−") + Math.abs(n);
  const labelForHostility = (value, data) => {
    for (const band of (data && data.hostilityBands) || []) if (Number(value) <= Number(band.max)) return band.label || band.key;
    return String(value);
  };
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
      const modifier = Number(e.hostilityModifier) || 0;
      const at = (hostility) => Math.round(Math.max(0, Math.min(1, (p / 100) * Math.max(0, 1 + modifier * ((hostility - 50) / 50)))) * 1000) / 10;
      return {
        log: e.text, chips: chipsFor(e.effects, ctx),
        notes: [
          e.enabled === false ? "Disabled: this event never rolls." : (p > 0 ? `Rolls on every visit to a ${b} location: about one visit in ${Math.round(100 / p)}.` : "A chance of 0% never happens."),
          modifier === 0
            ? "Hostility does not change this chance."
            : `Chance ${at(0)}% at hostility 0, ${at(50)}% at 50, ${at(100)}% at 100 (modifier ${modifier > 0 ? "+" : ""}${modifier}).`
        ]
      };
    }
  }));

  const SECTIONS = [
    ...biomeSections,
    {
      id: "locations-biomes", group: "Locations", title: "Biomes", file: "locations", kind: "list", at: ["biomes"],
      fields: biomeFields, label: (b) => b.name || b.key || "(unnamed)",
      sub: (b) => `${b.weight ?? 1} weight · hostility ${(b.hostility || []).join("–")} · level ${(b.levelRange || []).join("–")}`,
      newItem: (ctx, list) => ({
        key: C.uniqueId(list.map((b) => b.key), "new_biome"), name: "New biome", weight: 1,
        hostility: [50, 50], levelRange: [1, 1], weather: ["Clear"], nouns: ["Place"]
      }),
      preview(b, ctx) {
        const h = Array.isArray(b.hostility) ? b.hostility : [50, 50];
        const lv = Array.isArray(b.levelRange) ? b.levelRange : [1, 1];
        const weather = Array.isArray(b.weather) ? b.weather.length : 0;
        const nouns = Array.isArray(b.nouns) ? b.nouns.length : 0;
        return { notes: [
          `Hostility ${h[0]}–${h[1]}: ${h[0] >= 50 ? "dangerous" : "mixed"} ground.`,
          `Locations roll level ${lv[0]}–${lv[1]}.`,
          `${weather} weather states and ${nouns} name nouns.`,
          "Higher hostility raises encounter chance and count and lowers enemy relations."
        ] };
      }
    },
    {
      id: "locations-settings", group: "Locations", title: "Hostility and levels", file: "locations", kind: "form", at: [],
      fields: [
        { key: "defaultHostility", label: "Default hostility", type: "number", min: 1, max: 100, step: 1, help: "Used when a location arrives without a value. 50 is neutral." },
        { key: "defaultLevel", label: "Default level", type: "number", min: 1, max: 100, step: 1 }
      ],
      preview(_, ctx, data) {
        const h = Number(data.locations.defaultHostility) || 50;
        const deadliest = (data.locations.biomes || []).reduce((max, b) => Math.max(max, Number((b.hostility || [0, 0])[1]) || 0), 0);
        return { notes: [
          `New locations without a value start at hostility ${h} and level ${data.locations.defaultLevel ?? 1}.`,
          `The highest biome hostility is ${deadliest}/100 (${labelForHostility(deadliest, data.locations)}).`,
          "Hostility is a label and encounter lever; nothing forces combat yet."
        ] };
      }
    },
    {
      id: "locations-bands", group: "Locations", title: "Hostility bands", file: "locations", kind: "list", at: ["hostilityBands"],
      fields: hostilityBandFields, label: (b) => b.label || b.key || "(unnamed)", sub: (b) => `up to ${b.max}/100`,
      newItem: (ctx, list) => ({ key: C.uniqueId(list.map((b) => b.key), "new_band"), label: "New band", max: 100 }),
      preview(b) {
        return { notes: [`Values from the previous band's max + 1 up to ${b.max} display as ${b.label}.`] };
      }
    },
    {
      id: "locations-graph", group: "Locations", title: "Travel graph", file: "locations", kind: "form", at: ["travelGraph"],
      fields: [
        { key: "distanceRange", label: "Route distance range", type: "range", min: 1, max: 100, help: "Abstract league distance for a new route." },
        { key: "minutesPerDistance", label: "Minutes per distance", type: "number", min: 1, step: 1 },
        { key: "links", label: "Links per new location", type: "range", min: 1, max: 50 },
        { key: "legacyDistance", label: "Legacy link distance", type: "number", min: 1, step: 1, help: "Used when repairing old saves without routes." }
      ],
      preview(_, ctx, data) {
        const g = data.locations.travelGraph || {};
        return { notes: [`A route of distance 1 takes ${g.minutesPerDistance ?? 15} minutes; distance ${(g.distanceRange || [1, 4])[1]} takes ${(Number(g.minutesPerDistance) || 15) * Number((g.distanceRange || [1, 4])[1])} minutes.`] };
      }
    },
    {
      id: "map-world", group: "Map", title: "World settings", file: "map", kind: "form", at: ["world"],
      fields: [
        { key: "name", label: "World name", type: "text", help: "Display name only; the map's sites and routes live below." },
        { key: "start", label: "Starting site", type: "select", source: "mapSites", help: "The town a newly created character enters. It must be one of the sites below." }
      ],
      preview(_, ctx, data) {
        const world = data.map.world || {};
        const sites = Array.isArray(world.locations) ? world.locations : [];
        const routes = Array.isArray(world.routes) ? world.routes : [];
        const landmarks = sites.filter((site) => site.kind);
        return { notes: [
          `${world.name || "Unnamed world"} has ${sites.length} static sites and ${routes.length} authored routes.`,
          `New characters start at ${world.start || "the first site"}.`,
          `${landmarks.length} landmark${landmarks.length === 1 ? "" : "s"} generate procedural interiors.`,
          "Loading the map is idempotent: it never charts a second copy."
        ] };
      }
    },
    {
      id: "map-sites", group: "Map", title: "Static sites", file: "map", kind: "list", at: ["world", "locations"],
      fields: mapSiteFields, label: (site) => site.name || site.key || "(unnamed)",
      sub: (site) => `${site.kind || "wilds"} · ${site.biome || "?"} · hostility ${site.hostility ?? "?"}${site.interior ? ` · interior ${site.interior}` : ""}`,
      newItem: (ctx, list) => ({
        key: C.uniqueId(list.map((site) => site.key), "new_site"), kind: "", name: "New site",
        biome: "Grassland", biomeKey: "grassland", weather: "Clear", hostility: 50, level: 1
      }),
      preview(site, ctx, data) {
        const routes = ((data.map.world && data.map.world.routes) || []).filter((route) => route.from === site.key || route.to === site.key);
        const interior = ((data.map.terrain && data.map.terrain.interiors) || []).find((preset) => preset.key === site.interior);
        const notes = [
          `${site.kind ? `Landmark kind ${site.kind}` : "Wild site"} in ${site.biome || "unknown terrain"} (event key ${site.biomeKey || "none"}).`,
          `${routes.length} authored route${routes.length === 1 ? "" : "s"}; the static map never adds random links.`,
          interior ? `First visit generates a ${interior.width}×${interior.height} ${interior.label || interior.key}.` : "No interior: visiting only rolls biome events and encounters."
        ];
        return { chips: [{ text: `Hostility ${site.hostility ?? "?"}`, tone: Number(site.hostility) >= 50 ? "neg" : "flat" }, { text: `Level ${site.level ?? 1}`, tone: "flat" }], notes };
      }
    },
    {
      id: "map-routes", group: "Map", title: "Authored routes", file: "map", kind: "list", at: ["world", "routes"],
      fields: mapRouteFields, label: (route) => route.id || `${route.from}–${route.to}`,
      sub: (route) => `${route.from} ↔ ${route.to} · ${route.distance} league${route.distance === 1 ? "" : "s"}`,
      newItem: (ctx, list) => {
        const sites = (ctx.mapSiteKeys || []);
        return {
          id: C.uniqueId(list.map((route) => route.id), "new_route"),
          from: sites[0] || "", to: sites[1] || sites[0] || "", distance: 1
        };
      },
      preview(route) {
        const distance = Number(route.distance) || 0;
        return { notes: [
          `A journey from ${route.from || "?"} to ${route.to || "?"} takes ${distance * 15} minutes at the default 15 minutes per league.`,
          "Routes are stored on both endpoints with the same distance."
        ] };
      }
    },
    {
      id: "map-interiors", group: "Map", title: "Interior presets", file: "map", kind: "list", at: ["terrain", "interiors"],
      fields: mapInteriorFields, label: (preset) => preset.label || preset.key || "(unnamed)",
      sub: (preset) => `${preset.width}×${preset.height} · ${preset.roomAttempts} attempts · rooms ${(preset.roomWidth || []).join("–")}×${(preset.roomHeight || []).join("–")}`,
      newItem: (ctx, list) => ({
        key: C.uniqueId(list.map((preset) => preset.key), "new_interior"), label: "New interior",
        width: 21, height: 11, roomAttempts: 7, roomWidth: [3, 6], roomHeight: [3, 4],
        rubbleChance: 0.05, waterChance: 0
      }),
      preview(preset) {
        return { notes: [
          `${preset.width}×${preset.height} grid with up to ${preset.roomAttempts} room attempts.`,
          `Rooms ${(preset.roomWidth || []).join("–")} wide and ${(preset.roomHeight || []).join("–")} tall.`,
          `Rubble ${Math.round((Number(preset.rubbleChance) || 0) * 100)}%, water ${Math.round((Number(preset.waterChance) || 0) * 100)}% of room floor tiles.`,
          "Layouts are generated once per landmark and stored in the save."
        ] };
      }
    },
    {
      id: "map-tiles", group: "Map", title: "Terrain tiles", file: "map", kind: "form", at: ["terrain", "tiles"],
      fields: [
        { key: "wall", label: "Wall tile", type: "text", mono: true },
        { key: "floor", label: "Floor tile", type: "text", mono: true },
        { key: "entrance", label: "Entrance tile", type: "text", mono: true },
        { key: "rubble", label: "Rubble tile", type: "text", mono: true },
        { key: "water", label: "Water tile", type: "text", mono: true }
      ],
      preview(_, ctx, data) {
        const tiles = (data.map.terrain && data.map.terrain.tiles) || {};
        return { notes: [`Rendered map characters: wall ${tiles.wall || "#"}, floor ${tiles.floor || "."}, entrance ${tiles.entrance || "<"}, rubble ${tiles.rubble || "*"}, water ${tiles.water || "~"}.`] };
      }
    },
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
    },
    {
      id: "character-relations", group: "Characters", title: "Relation settings", file: "characters", kind: "form", at: ["relations"],
      fields: [
        { key: "min", label: "Minimum", type: "number", min: -100, max: 100, step: 1 },
        { key: "max", label: "Maximum", type: "number", min: -100, max: 100, step: 1 },
        { key: "default", label: "Default value", type: "number", min: -100, max: 100, step: 1 },
        { key: "defaultType", label: "Default type", type: "select", source: "relationTypes" }
      ],
      preview(_, ctx, data) {
        const r = data.characters.relations || {};
        return { notes: [
          `Relations run ${r.min ?? -100} to ${r.max ?? 100}; a new NPC starts at ${r.default ?? 0}.`,
          `${(r.bands || []).length} bands and ${(r.types || []).length} types shape the label.`
        ] };
      }
    },
    {
      id: "character-relation-bands", group: "Characters", title: "Relation bands", file: "characters", kind: "list", at: ["relations", "bands"],
      fields: relationBandFields, label: (b) => b.label || b.key || "(unnamed)", sub: (b) => `${b.min} to ${b.max}${b.typeSpecific ? " · type label" : ""}`,
      newItem: (ctx, list) => ({ key: C.uniqueId(list.map((b) => b.key), "new_band"), label: "New band", min: 0, max: 0 }),
      preview(b) {
        return { notes: [
          `Values ${b.min} to ${b.max} are labelled ${b.label || b.key}.`,
          b.typeSpecific ? "The relation type's high label replaces this label." : "No type-specific replacement."
        ] };
      }
    },
    {
      id: "character-relation-types", group: "Characters", title: "Relation types", file: "characters", kind: "list", at: ["relations", "types"],
      fields: relationTypeFields, label: (t) => t.label || t.key || "(unnamed)", sub: (t) => `61+ → ${t.highLabel || t.label || "?"}`,
      newItem: (ctx, list) => ({ key: C.uniqueId(list.map((t) => t.key), "new_type"), label: "New type", highLabel: "Friendly" }),
      preview(t) {
        return { notes: [`At relation 61 or above, a ${t.label || t.key} displays as ${t.highLabel || t.label || "?"}.`] };
      }
    },
    {
      id: "character-levels", group: "Characters", title: "Level bounds", file: "characters", kind: "form", at: ["levels"],
      fields: [
        { key: "min", label: "Minimum level", type: "number", min: 1, step: 1 },
        { key: "max", label: "Maximum level", type: "number", min: 1, step: 1 },
        { key: "default", label: "Default level", type: "number", min: 1, step: 1 }
      ],
      preview(_, ctx, data) {
        const l = data.characters.levels || {};
        return { notes: [`NPC levels are clamped to ${l.min ?? 1}–${l.max ?? 100}; new NPCs start at ${l.default ?? 1}.`, "Full leveling comes later; encounters set enemy levels for now."] };
      }
    },
    {
      id: "creator-settings", group: "Characters", title: "Character creation", file: "creator", kind: "form", at: ["settings"],
      fields: [
        { key: "resourceStartPercent", label: "Starting resources (%)", type: "number", min: 0, max: 100, step: 1, help: "HP, Stamina and Mana start at this share of their maximum." },
        { key: "maxStartingItems", label: "Maximum starting items", type: "number", min: 1, step: 1, help: "Caps the combined equipment from background, origin and focus." }
      ],
      preview(_, ctx, data) {
        const s = (data.creator && data.creator.settings) || {};
        const backgrounds = (data.creator && data.creator.backgrounds) || [];
        const origins = (data.creator && data.creator.origins) || [];
        const focuses = (data.creator && data.creator.focuses) || [];
        return { notes: [
          `${backgrounds.length} backgrounds, ${origins.length} origins and ${focuses.length} focuses.`,
          `Resources start at ${s.resourceStartPercent ?? 80}% of maximum; at most ${s.maxStartingItems ?? 6} items are granted.`,
          "The first main-character save uses the chosen build; later saves keep the existing stats."
        ] };
      }
    },
    {
      id: "creator-backgrounds", group: "Characters", title: "Backgrounds", file: "creator", kind: "list", at: ["backgrounds"],
      fields: creatorOptionFields, label: (entry) => entry.name || entry.key || "(unnamed)",
      sub: (entry) => `${(entry.stats || []).length} stat change${(entry.stats || []).length === 1 ? "" : "s"} · ${(entry.equipment || []).length} item${(entry.equipment || []).length === 1 ? "" : "s"}`,
      newItem: (ctx, list) => ({ key: C.uniqueId(list.map((entry) => entry.key), "new_background"), name: "New background", description: "", stats: [], equipment: [] }),
      preview(entry, ctx) {
        return { chips: chipsFor(entry.stats, ctx), notes: [
          entry.description || "No description.",
          entry.equipment && entry.equipment.length ? `Starts with: ${entry.equipment.join(", ")}.` : "No starting equipment."
        ] };
      }
    },
    {
      id: "creator-origins", group: "Characters", title: "Origins", file: "creator", kind: "list", at: ["origins"],
      fields: creatorOptionFields, label: (entry) => entry.name || entry.key || "(unnamed)",
      sub: (entry) => `${(entry.stats || []).length} stat change${(entry.stats || []).length === 1 ? "" : "s"} · ${(entry.equipment || []).length} item${(entry.equipment || []).length === 1 ? "" : "s"}`,
      newItem: (ctx, list) => ({ key: C.uniqueId(list.map((entry) => entry.key), "new_origin"), name: "New origin", description: "", stats: [], equipment: [] }),
      preview(entry, ctx) {
        return { chips: chipsFor(entry.stats, ctx), notes: [
          entry.description || "No description.",
          entry.equipment && entry.equipment.length ? `Starts with: ${entry.equipment.join(", ")}.` : "No starting equipment."
        ] };
      }
    },
    {
      id: "creator-focuses", group: "Characters", title: "Focuses", file: "creator", kind: "list", at: ["focuses"],
      fields: creatorOptionFields, label: (entry) => entry.name || entry.key || "(unnamed)",
      sub: (entry) => `${(entry.stats || []).length} stat change${(entry.stats || []).length === 1 ? "" : "s"} · ${(entry.equipment || []).length} item${(entry.equipment || []).length === 1 ? "" : "s"}`,
      newItem: (ctx, list) => ({ key: C.uniqueId(list.map((entry) => entry.key), "new_focus"), name: "New focus", description: "", stats: [], equipment: [] }),
      preview(entry, ctx) {
        return { chips: chipsFor(entry.stats, ctx), notes: [
          entry.description || "No description.",
          entry.equipment && entry.equipment.length ? `Starts with: ${entry.equipment.join(", ")}.` : "No starting equipment."
        ] };
      }
    },
    {
      id: "encounters-spawn", group: "Encounters", title: "Spawn settings", file: "encounters", kind: "form", at: ["spawn"],
      fields: [
        { key: "clearSource", label: "Spawn source tag", type: "text", mono: true, help: "Encounter NPCs carry this source so leaving an area can clear only them." },
        { key: "maxPerVisit", label: "Maximum enemies per visit", type: "number", min: 1, step: 1 }
      ],
      preview(_, ctx, data) {
        const s = data.encounters.spawn || {};
        return { notes: [`At most ${s.maxPerVisit ?? 4} enemies spawn per visit.`, `Their source tag is "${s.clearSource || "encounter"}"; a new visit clears only that tag.`] };
      }
    },
    {
      id: "encounters-spawn-bands", group: "Encounters", title: "Spawn bands", file: "encounters", kind: "list", at: ["spawn", "bands"],
      fields: spawnBandFields, label: (b) => b.key || "(unnamed)",
      sub: (b) => `${b.chancePercent}% · ${b.minCount}–${b.maxCount} enemies up to hostility ${b.maxHostility}`,
      newItem: (ctx, list) => ({ key: C.uniqueId(list.map((b) => b.key), "new_spawn_band"), maxHostility: 100, chancePercent: 25, minCount: 1, maxCount: 1 }),
      preview(b) {
        const p = Number(b.chancePercent) || 0;
        return { notes: [
          `At hostility up to ${b.maxHostility}, a visit spawns ${b.minCount}–${b.maxCount} enemies ${p}% of the time.`,
          p > 0 ? `About one visit in ${Math.round(100 / p)} triggers a fight.` : "A chance of 0 never spawns."
        ] };
      }
    },
    {
      id: "encounters-relations", group: "Encounters", title: "Enemy relations", file: "encounters", kind: "form", at: ["relations"],
      fields: [
        { key: "type", label: "Relation type", type: "select", source: "relationTypes" },
        { key: "base", label: "Base relation at hostility 0", type: "number", min: -100, max: 100, step: 1 },
        { key: "perHostility", label: "Change per hostility point", type: "number", min: -2, max: 2, step: 0.01, help: "Negative makes enemies like the player less in dangerous places." }
      ],
      preview(_, ctx, data) {
        const r = data.encounters.relations || {};
        const at = (h) => Math.max(-100, Math.min(100, Math.round((r.base ?? -31) + (r.perHostility ?? -0.69) * h)));
        const type = (data.characters.relations.types || []).find((t) => t.key === r.type);
        return { notes: [
          `Enemy relation at hostility 50: ${at(50)}; at 100: ${at(100)}.`,
          `All encounter enemies use the ${type ? type.label : r.type || "bandit"} relation type.`
        ] };
      }
    },
    {
      id: "encounters-levels", group: "Encounters", title: "Enemy levels", file: "encounters", kind: "form", at: ["levels"],
      fields: [
        { key: "hostilityPerLevel", label: "Hostility per +1 level", type: "number", min: 1, step: 1, help: "Above hostility 50, each block of this many points adds one enemy level." }
      ],
      preview(_, ctx, data) {
        const step = Number((data.encounters.levels || {}).hostilityPerLevel) || 25;
        return { notes: [`A level 1 location spawns level 1 enemies at hostility 50 and level 3 at hostility 100 (every ${step} points adds one).`] };
      }
    },
    {
      id: "encounters-loot", group: "Encounters", title: "Loot settings", file: "encounters", kind: "form", at: ["loot"],
      fields: [
        { key: "dropChancePercent", label: "Drop chance at hostility 50 (%)", type: "number", min: 0, max: 100, step: 1 },
        { key: "chancePerHostility", label: "Chance change per hostility", type: "number", min: -2, max: 2, step: 0.1 },
        { key: "maxDropChancePercent", label: "Drop chance cap (%)", type: "number", min: 0, max: 100, step: 1 }
      ],
      preview(_, ctx, data) {
        const l = data.encounters.loot || {};
        const at = (h) => Math.max(0, Math.min(Number(l.maxDropChancePercent) || 100, (Number(l.dropChancePercent) || 0) + (Number(l.chancePerHostility) || 0) * (h - 50)));
        return { notes: [
          `Drop chance: ${at(0)}% at hostility 0, ${at(50)}% at 50, ${at(100)}% at 100.`,
          `Kind weights: ${(l.kindWeights || []).map((k) => `${k.kind} ${k.weight}`).join(", ") || "none"}.`
        ] };
      }
    },
    {
      id: "encounters-loot-bands", group: "Encounters", title: "Loot rarity bands", file: "encounters", kind: "list", at: ["loot", "rarityBands"],
      fields: lootBandFields, label: (b) => b.key || "(unnamed)", sub: (b) => `${(b.rarities || []).join(", ")} up to hostility ${b.maxHostility}`,
      newItem: (ctx, list) => ({ key: C.uniqueId(list.map((b) => b.key), "new_loot_band"), maxHostility: 100, rarities: [ctx.rarities[0] || "common"] }),
      preview(b) {
        return { notes: [`At this band, a drop is one of: ${(b.rarities || []).join(", ") || "none"}.`] };
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
    const locations = data.locations || refs.locations || {};
    const relationDefs = (data.characters && data.characters.relations) || {};
    const bodyParts = (refs.body && Array.isArray(refs.body.parts) ? refs.body.parts : [])
      .map((part) => ({ key: part.key, label: part.label || part.key }));
    const rarityDefs = Array.isArray(equipment.rarities) ? equipment.rarities : [];
    const weaponTypeDefs = Array.isArray(equipment.weaponTypes) ? equipment.weaponTypes : [];
    const armorTypeDefs = Array.isArray(equipment.armorTypes) ? equipment.armorTypes : [];
    const relationTypeDefs = Array.isArray(relationDefs.types) ? relationDefs.types : [];
    const map = data.map || {};
    const mapSites = Array.isArray(map.world && map.world.locations) ? map.world.locations : [];
    const mapInteriors = Array.isArray(map.terrain && map.terrain.interiors) ? map.terrain.interiors : [];
    return {
      statDefs,
      statKeys: statDefs.filter((d) => d.kind !== "equipment").map((d) => d.key),
      equipmentStatKeys: statDefs.filter((d) => d.kind === "equipment").map((d) => d.key),
      biomes: (locations.biomes ? locations.biomes.map((b) => b.key) : BIOMES),
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
      relationTypeDefs,
      relationTypes: relationTypeDefs.map((t) => t.key),
      mapSiteKeys: mapSites.map((site) => site && site.key).filter(Boolean),
      mapInteriorKeys: mapInteriors.map((preset) => preset && preset.key).filter(Boolean),
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
    if (source === "relationTypes") return (ctx.relationTypeDefs || []).map((t) => ({ value: t.key, label: t.label || t.key }));
    if (source === "mapSites") return (ctx.mapSiteKeys || []).map((key) => ({ value: key, label: key }));
    if (source === "interiors") return (ctx.mapInteriorKeys || []).map((key) => ({ value: key, label: key }));
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
        if (e.hostilityModifier !== undefined) {
          if (!num(e.hostilityModifier)) report("error", "Hostility modifier must be a number.", i, "hostilityModifier");
          else if (e.hostilityModifier < -1 || e.hostilityModifier > 1) report("warn", "Keep the hostility modifier between -1 and 1.", i, "hostilityModifier");
        }
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
    locations(file, d, ctx, out) {
      const biomes = makeReporter(out, "locations-biomes");
      const settings = makeReporter(out, "locations-settings");
      const bands = makeReporter(out, "locations-bands");
      const graph = makeReporter(out, "locations-graph");
      const range = (value, lo, hi, label, report, index, field) => {
        if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isInteger) || value[0] > value[1])
          return report("error", `${label} needs two whole numbers, low to high.`, index, field);
        if (value[0] < lo || value[1] > hi)
          report("error", `${label} must stay between ${lo} and ${hi}.`, index, field);
      };

      if (!Number.isInteger(d.defaultHostility) || d.defaultHostility < 1 || d.defaultHostility > 100)
        settings("error", "Default hostility must be a whole number from 1 to 100.", null, "defaultHostility");
      if (!Number.isInteger(d.defaultLevel) || d.defaultLevel < 1)
        settings("error", "Default level must be a whole number of at least 1.", null, "defaultLevel");

      if (!Array.isArray(d.biomes) || !d.biomes.length) biomes("error", "The file needs a non-empty \"biomes\" list.", null, "biomes");
      else {
        checkIds(d.biomes, "key", biomes, "Biome");
        d.biomes.forEach((b, i) => {
          if (!b.name) biomes("warn", "Give the biome a name.", i, "name");
          if (!num(b.weight) || b.weight < 0) biomes("error", "Spawn weight must be a number, 0 or more.", i, "weight");
          range(b.hostility, 1, 100, "Hostility range", biomes, i, "hostility");
          range(b.levelRange, 1, 100, "Level range", biomes, i, "levelRange");
          for (const field of ["weather", "nouns"]) {
            if (!Array.isArray(b[field]) || !b[field].length || b[field].some((s) => typeof s !== "string" || !s.trim()))
              biomes("error", `${cap(field)} needs at least one non-empty line.`, i, field);
          }
        });
      }

      if (!Array.isArray(d.hostilityBands) || !d.hostilityBands.length) bands("error", "The file needs a non-empty \"hostilityBands\" list.", null, "hostilityBands");
      else {
        checkIds(d.hostilityBands, "key", bands, "Hostility band");
        let previous = 0;
        d.hostilityBands.forEach((b, i) => {
          if (!b.label) bands("warn", "Give the band a label.", i, "label");
          if (!Number.isInteger(b.max) || b.max < 1 || b.max > 100) bands("error", "The band maximum must be a whole number from 1 to 100.", i, "max");
          else if (b.max <= previous) bands("warn", "Band maxima should climb from low to high.", i, "max");
          else previous = b.max;
        });
        if (previous < 100) bands("warn", "The last band should reach hostility 100.", null, "hostilityBands");
      }

      const g = d.travelGraph;
      if (!g || typeof g !== "object") graph("error", "The file needs a travelGraph object.", null, "travelGraph");
      else {
        range(g.distanceRange, 1, 100, "Route distance range", graph, null, "distanceRange");
        range(g.links, 1, 50, "Link range", graph, null, "links");
        if (!Number.isInteger(g.minutesPerDistance) || g.minutesPerDistance < 1)
          graph("error", "Minutes per distance must be a whole number of at least 1.", null, "minutesPerDistance");
        if (!Number.isInteger(g.legacyDistance) || g.legacyDistance < 1)
          graph("error", "Legacy distance must be a whole number of at least 1.", null, "legacyDistance");
      }
    },
    map(file, d, ctx, out) {
      const world = makeReporter(out, "map-world");
      const sites = makeReporter(out, "map-sites");
      const routes = makeReporter(out, "map-routes");
      const interiors = makeReporter(out, "map-interiors");
      const tiles = makeReporter(out, "map-tiles");
      const worldData = d.world;
      const terrain = d.terrain;

      if (!worldData || typeof worldData !== "object") world("error", "The file needs a world object.", null, "world");
      else {
        if (typeof worldData.name !== "string" || !worldData.name.trim()) world("warn", "Give the world a name.", null, "name");

        if (!Array.isArray(worldData.locations) || !worldData.locations.length) {
          sites("error", "The world needs a non-empty locations list.", null, "locations");
        } else {
          checkIds(worldData.locations, "key", sites, "Site");
          const siteKeys = new Set(worldData.locations.map((site) => site && site.key).filter(Boolean));
          if (typeof worldData.start !== "string" || !siteKeys.has(worldData.start))
            world("error", "Starting site must be one of the map sites.", null, "start");
          worldData.locations.forEach((site, i) => {
            if (!site || typeof site !== "object") return sites("error", `Site #${i + 1} is not an object.`, i);
            if (typeof site.name !== "string" || !site.name.trim()) sites("warn", "Give the site a name.", i, "name");
            if (typeof site.biome !== "string" || !site.biome.trim()) sites("warn", "Give the site a biome label.", i, "biome");
            if (typeof site.biomeKey !== "string" || !site.biomeKey.trim()) sites("warn", "Give the site a biome key.", i, "biomeKey");
            if (typeof site.weather !== "string" || !site.weather.trim()) sites("warn", "Give the site weather.", i, "weather");
            if (!Number.isInteger(site.hostility) || site.hostility < 1 || site.hostility > 100)
              sites("error", "Hostility must be a whole number from 1 to 100.", i, "hostility");
            if (!Number.isInteger(site.level) || site.level < 1)
              sites("error", "Level must be a whole number of at least 1.", i, "level");
            if (site.interior && !ctx.mapInteriorKeys.includes(site.interior))
              sites("error", `Unknown interior preset "${site.interior}".`, i, "interior");
          });

          if (!Array.isArray(worldData.routes)) routes("error", "The world needs a routes list.", null, "routes");
          else {
            checkIds(worldData.routes, "id", routes, "Route");
            const seen = new Set();
            worldData.routes.forEach((route, i) => {
              if (!route || typeof route !== "object") return routes("error", `Route #${i + 1} is not an object.`, i);
              if (!siteKeys.has(route.from)) routes("error", `Route from "${route.from}" is not a site.`, i, "from");
              if (!siteKeys.has(route.to)) routes("error", `Route to "${route.to}" is not a site.`, i, "to");
              if (route.from === route.to) routes("error", "A route must join two different sites.", i, "to");
              if (!Number.isInteger(route.distance) || route.distance < 1)
                routes("error", "Route distance must be a whole number of at least 1.", i, "distance");
              const pair = [route.from, route.to].sort().join("|");
              if (seen.has(pair)) routes("warn", "This pair of sites already has a route.", i);
              else seen.add(pair);
            });
          }
        }
      }

      if (!terrain || typeof terrain !== "object") {
        interiors("error", "The file needs a terrain object.", null, "terrain");
      } else {
        if (!Array.isArray(terrain.interiors) || !terrain.interiors.length)
          interiors("error", "Terrain needs a non-empty interiors list.", null, "interiors");
        else {
          checkIds(terrain.interiors, "key", interiors, "Interior");
          terrain.interiors.forEach((preset, i) => {
            if (!preset || typeof preset !== "object") return interiors("error", `Interior #${i + 1} is not an object.`, i);
            if (typeof preset.label !== "string" || !preset.label.trim()) interiors("warn", "Give the interior a label.", i, "label");
            const width = preset.width, height = preset.height;
            if (!Number.isInteger(width) || width < 9 || width > 61)
              interiors("error", "Width must be a whole number from 9 to 61.", i, "width");
            if (!Number.isInteger(height) || height < 7 || height > 41)
              interiors("error", "Height must be a whole number from 7 to 41.", i, "height");
            if (!Number.isInteger(preset.roomAttempts) || preset.roomAttempts < 1 || preset.roomAttempts > 40)
              interiors("error", "Room attempts must be a whole number from 1 to 40.", i, "roomAttempts");
            const badRange = (value, max, field, label) => {
              if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isInteger) || value[0] < 2 || value[1] > max || value[0] > value[1]) {
                interiors("error", `${label} needs two whole numbers from 2 to ${max}, low to high.`, i, field);
                return true;
              }
              return false;
            };
            if (Number.isInteger(width)) badRange(preset.roomWidth, width - 2, "roomWidth", "Room width range");
            if (Number.isInteger(height)) badRange(preset.roomHeight, height - 2, "roomHeight", "Room height range");
            for (const field of ["rubbleChance", "waterChance"]) {
              if (!num(preset[field]) || preset[field] < 0 || preset[field] > 1)
                interiors("error", `${cap(field)} must be between 0 and 1.`, i, field);
            }
          });
        }

        const tileSet = terrain.tiles;
        if (!tileSet || typeof tileSet !== "object") tiles("error", "Terrain needs a tiles object.", null, "tiles");
        else {
          const seen = new Map();
          for (const key of ["wall", "floor", "entrance", "rubble", "water"]) {
            const value = tileSet[key];
            if (typeof value !== "string" || value.length !== 1)
              tiles("error", `The ${key} tile must be exactly one character.`, null, key);
            else if (seen.has(value))
              tiles("warn", `The ${key} tile repeats the ${seen.get(value)} tile.`, null, key);
            else seen.set(value, key);
          }
        }
      }
    },
    creator(file, d, ctx, out) {
      const settings = makeReporter(out, "creator-settings");
      const s = d.settings && typeof d.settings === "object" ? d.settings : null;
      if (!s) settings("error", "The file needs a settings object.", null, "settings");
      else {
        if (!Number.isInteger(s.resourceStartPercent) || s.resourceStartPercent < 0 || s.resourceStartPercent > 100)
          settings("error", "Starting resources must be a whole number from 0 to 100.", null, "resourceStartPercent");
        if (!Number.isInteger(s.maxStartingItems) || s.maxStartingItems < 1)
          settings("error", "Maximum starting items must be a whole number of at least 1.", null, "maxStartingItems");
      }

      for (const [field, noun] of [["backgrounds", "Background"], ["origins", "Origin"], ["focuses", "Focus"]]) {
        const report = makeReporter(out, `creator-${field}`);
        const list = d[field];
        if (!Array.isArray(list) || !list.length) {
          report("error", `The file needs at least one ${noun.toLowerCase()}.`, null, field);
          continue;
        }
        checkIds(list, "key", report, noun);
        list.forEach((entry, i) => {
          if (!entry || typeof entry !== "object") return report("error", `${noun} #${i + 1} is not an object.`, i);
          if (typeof entry.name !== "string" || !entry.name.trim()) report("warn", `Give the ${noun.toLowerCase()} a name.`, i, "name");
          if (typeof entry.description !== "string" || !entry.description.trim())
            report("warn", `Give the ${noun.toLowerCase()} a description.`, i, "description");
          checkEffects(entry.stats, "Starting stat change", ctx, report, i);
          if (!Array.isArray(entry.equipment)) {
            report("error", "Starting equipment must be a list.", i, "equipment");
          } else {
            const seen = new Set();
            for (const key of entry.equipment) {
              if (typeof key !== "string" || !key.trim()) report("error", "Equipment keys must be non-empty strings.", i, "equipment");
              else if (!ctx.equipmentKeys.includes(key)) report("error", `Unknown equipment key "${key}".`, i, "equipment");
              else if (seen.has(key)) report("warn", `Equipment "${key}" is listed twice.`, i, "equipment");
              else seen.add(key);
            }
            if (s && Number.isInteger(s.maxStartingItems) && entry.equipment.length > s.maxStartingItems)
              report("warn", `This ${noun.toLowerCase()} grants more than the ${s.maxStartingItems}-item cap.`, i, "equipment");
          }
          const changes = Array.isArray(entry.stats) ? entry.stats.length : 0;
          const items = Array.isArray(entry.equipment) ? entry.equipment.length : 0;
          if (!changes && !items) report("warn", `This ${noun.toLowerCase()} changes nothing.`, i);
        });
      }
    },
    encounters(file, d, ctx, out) {
      const spawn = makeReporter(out, "encounters-spawn");
      const spawnBands = makeReporter(out, "encounters-spawn-bands");
      const relations = makeReporter(out, "encounters-relations");
      const levels = makeReporter(out, "encounters-levels");
      const loot = makeReporter(out, "encounters-loot");
      const lootBands = makeReporter(out, "encounters-loot-bands");

      const s = d.spawn;
      if (!s || typeof s !== "object") spawn("error", "The file needs a spawn object.", null, "spawn");
      else {
        if (!Number.isInteger(s.maxPerVisit) || s.maxPerVisit < 1) spawn("error", "Maximum enemies per visit must be a whole number of at least 1.", null, "maxPerVisit");
        if (s.clearSource !== undefined && (typeof s.clearSource !== "string" || !s.clearSource.trim()))
          spawn("error", "The spawn source tag must be a non-empty string.", null, "clearSource");
        if (!Array.isArray(s.bands) || !s.bands.length) spawnBands("error", "Spawn bands must be a non-empty list.", null, "bands");
        else {
          checkIds(s.bands, "key", spawnBands, "Spawn band");
          s.bands.forEach((b, i) => {
            if (!Number.isInteger(b.maxHostility) || b.maxHostility < 1 || b.maxHostility > 100)
              spawnBands("error", "Max hostility must be a whole number from 1 to 100.", i, "maxHostility");
            if (!num(b.chancePercent) || b.chancePercent < 0 || b.chancePercent > 100)
              spawnBands("error", "Spawn chance must be between 0 and 100.", i, "chancePercent");
            if (!Number.isInteger(b.minCount) || b.minCount < 1) spawnBands("error", "Minimum enemies must be a whole number of at least 1.", i, "minCount");
            if (!Number.isInteger(b.maxCount) || b.maxCount < 1) spawnBands("error", "Maximum enemies must be a whole number of at least 1.", i, "maxCount");
            else if (Number.isInteger(b.minCount) && b.maxCount < b.minCount) spawnBands("error", "Maximum enemies cannot be below the minimum.", i, "maxCount");
          });
        }
      }

      const r = d.relations || {};
      if (ctx.relationTypes.length && !ctx.relationTypes.includes(r.type)) relations("warn", `Unknown relation type "${r.type}".`, null, "type");
      if (!num(r.base) || r.base < -100 || r.base > 100) relations("error", "Base relation must be between -100 and 100.", null, "base");
      if (!num(r.perHostility)) relations("error", "Change per hostility must be a number.", null, "perHostility");
      else if (r.perHostility > 0) relations("warn", "A positive change makes enemies friendlier in dangerous places.", null, "perHostility");

      const lv = d.levels || {};
      if (!num(lv.hostilityPerLevel) || lv.hostilityPerLevel < 1) levels("error", "Hostility per level must be a number of at least 1.", null, "hostilityPerLevel");

      const l = d.loot || {};
      if (!num(l.dropChancePercent) || l.dropChancePercent < 0 || l.dropChancePercent > 100) loot("error", "Drop chance must be between 0 and 100.", null, "dropChancePercent");
      if (!num(l.chancePerHostility)) loot("error", "Chance change per hostility must be a number.", null, "chancePerHostility");
      if (!num(l.maxDropChancePercent) || l.maxDropChancePercent < 0 || l.maxDropChancePercent > 100) loot("error", "Drop chance cap must be between 0 and 100.", null, "maxDropChancePercent");
      if (!Array.isArray(l.kindWeights) || !l.kindWeights.length) loot("warn", "No loot kind weights; armor is assumed.", null, "kindWeights");
      else l.kindWeights.forEach((k, i) => {
        if (k.kind !== "armor" && k.kind !== "weapon") loot("error", `Loot kind #${i + 1} must be armor or weapon.`, null, "kindWeights");
        if (!num(k.weight) || k.weight < 0) loot("error", `Loot kind #${i + 1} needs a weight of 0 or more.`, null, "kindWeights");
      });
      if (!Array.isArray(l.rarityBands) || !l.rarityBands.length) lootBands("error", "Loot rarity bands must be a non-empty list.", null, "rarityBands");
      else {
        checkIds(l.rarityBands, "key", lootBands, "Loot band");
        l.rarityBands.forEach((b, i) => {
          if (!Number.isInteger(b.maxHostility) || b.maxHostility < 1 || b.maxHostility > 100)
            lootBands("error", "Max hostility must be a whole number from 1 to 100.", i, "maxHostility");
          if (!Array.isArray(b.rarities) || !b.rarities.length) lootBands("error", "Pick at least one rarity.", i, "rarities");
          else for (const rarity of b.rarities)
            if (ctx.rarities.length && !ctx.rarities.includes(rarity)) lootBands("error", `Unknown rarity "${rarity}".`, i, "rarities");
        });
      }
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

      const relations = makeReporter(out, "character-relations");
      const bands = makeReporter(out, "character-relation-bands");
      const types = makeReporter(out, "character-relation-types");
      const levels = makeReporter(out, "character-levels");
      const r = d.relations;
      if (!r || typeof r !== "object") relations("error", "The file needs a relations object.", null, "relations");
      else {
        if (!Number.isInteger(r.min) || !Number.isInteger(r.max) || r.min >= r.max)
          relations("error", "Relation minimum and maximum must be whole numbers, minimum lower than maximum.", null, "min");
        if (!Number.isInteger(r.default)) relations("error", "Default relation must be a whole number.", null, "default");
        if (!Array.isArray(r.bands) || !r.bands.length) bands("error", "Relation bands must be a non-empty list.", null, "bands");
        else {
          checkIds(r.bands, "key", bands, "Relation band");
          r.bands.forEach((b, i) => {
            if (!b.label) bands("warn", "Give the band a label.", i, "label");
            if (!Number.isInteger(b.min) || !Number.isInteger(b.max) || b.min > b.max)
              bands("error", "A relation band needs whole-number bounds, low to high.", i, "min");
            if (b.min < -100 || b.max > 100) bands("error", "Relation bounds must stay between -100 and 100.", i, "min");
          });
        }
        if (!Array.isArray(r.types) || !r.types.length) types("error", "Relation types must be a non-empty list.", null, "types");
        else {
          checkIds(r.types, "key", types, "Relation type");
          r.types.forEach((t, i) => {
            if (!t.label) types("warn", "Give the relation type a label.", i, "label");
            if (!t.highLabel) types("warn", "Give the relation type a high label.", i, "highLabel");
          });
        }
        if (r.defaultType && !ctx.relationTypes.includes(r.defaultType)) relations("error", `Unknown default relation type "${r.defaultType}".`, null, "defaultType");
      }

      if (!d.levels || typeof d.levels !== "object") levels("error", "The file needs a levels object.", null, "levels");
      else {
        if (!Number.isInteger(d.levels.min) || d.levels.min < 1) levels("error", "Minimum level must be a whole number of at least 1.", null, "min");
        if (!Number.isInteger(d.levels.max) || d.levels.max < 1) levels("error", "Maximum level must be a whole number of at least 1.", null, "max");
        if (Number.isInteger(d.levels.min) && Number.isInteger(d.levels.max) && d.levels.min > d.levels.max)
          levels("error", "Minimum level cannot exceed the maximum.", null, "min");
        if (!Number.isInteger(d.levels.default)) levels("error", "Default level must be a whole number.", null, "default");
      }
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
