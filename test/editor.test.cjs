/* Node tests for the content editor's core and schemas. Run: node test/editor.test.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const C = require("../editor/core.js");
const S = require("../editor/schemas.js");
const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ----- formatter -----
{
  const value = {
    short: [1, 2], nested: { a: "x", b: [{ stat: "hp", delta: -5 }] }, empty: {}, list: [],
    words: Array.from({ length: 40 }, (_, i) => "Word" + i), flag: true, none: null, big: { k: "x".repeat(60), m: "y".repeat(60) }
  };
  const text = C.format(value);
  assert.deepEqual(JSON.parse(text), value, "format output is valid JSON with the same data");
  assert.equal(C.format(JSON.parse(text)), text, "format is stable");
  assert.ok(text.split("\n").every((l) => l.length <= 110), "lines stay near the width limit");
  assert.equal(C.inline({ a: [1, { b: 2 }] }), '{ "a": [1, { "b": 2 }] }');
}

// ----- data files -----
{
  const text = "/* header\n   line two */\nwindow.Demo = {\n  \"a\": 1,\n  \"list\": [1, 2]\n};\n";
  const p = C.parseDataFile(text, "Demo");
  assert.equal(p.header, "/* header\n   line two */");
  assert.deepEqual(p.data, { a: 1, list: [1, 2] });
  assert.equal(p.lossy, false);
  assert.equal(C.serializeDataFile({ header: p.header, global: "Demo", data: p.data }), text, "an already canonical file round-trips exactly");

  // CRLF files stay CRLF.
  const crlf = text.replace(/\n/g, "\r\n");
  const pc = C.parseDataFile(crlf, "Demo");
  assert.equal(pc.eol, "\r\n");
  assert.equal(C.serializeDataFile({ header: pc.header, global: "Demo", data: pc.data, eol: pc.eol }), crlf);

  // JavaScript syntax is only accepted on request, and is flagged lossy.
  const js = "window.Demo = {\n  a: 1, // comment\n  list: [1, 2,],\n};\n";
  assert.throws(() => C.parseDataFile(js, "Demo"), /not strict JSON/);
  const loose = C.parseDataFile(js, "Demo", { allowEval: true });
  assert.deepEqual(loose.data, { a: 1, list: [1, 2] });
  assert.equal(loose.lossy, true);
  assert.throws(() => C.parseDataFile("var x = 1;", "Demo"), /Could not find/);

  const j = C.parseJsonFile('\uFEFF{"a":1}');
  assert.deepEqual(j.data, { a: 1 });
  assert.equal(C.serializeJsonFile({ data: { a: 1 } }), '{\n  "a": 1\n}\n');
}

// ----- helpers -----
{
  const o = { a: { b: 1 } };
  assert.equal(C.getPath(o, "a.b"), 1);
  assert.equal(C.getPath(o, "a.x.y"), undefined);
  C.setPath(o, "c.d.e", 5);
  assert.equal(o.c.d.e, 5);
  C.deletePath(o, "c.d.e");
  assert.equal(C.getPath(o, "c.d.e"), undefined);
  assert.equal(C.uniqueId(["a", "a_2"], "a"), "a_3");
  assert.equal(C.uniqueId(["a"], "b"), "b");
  const arr = [1, 2, 3];
  assert.equal(C.move(arr, 0, 1), 1);
  assert.deepEqual(arr, [2, 1, 3]);
  assert.equal(C.move(arr, 0, -1), 0, "moving past the start does nothing");
  assert.ok(Math.abs(C.journeyChance(8, 60, 5) - (1 - Math.pow(0.92, 12))) < 1e-12);
}

// ----- shipped content must stay editor-safe -----
const loaded = {}, refs = {};
for (const f of S.FILES) {
  const text = read(f.path);
  if (f.format === "js") {
    const parsed = C.parseDataFile(text, f.global);          // strict: throws if someone adds comments or JS syntax
    assert.equal(parsed.lossy, false, `${f.path} must stay strict JSON inside window.${f.global}`);
    assert.ok(parsed.header.includes("Edited by editor.html"), `${f.path} keeps its editor note in the header`);
    loaded[f.id] = parsed.data;
    global.window = global;
    delete require.cache[require.resolve(path.join(ROOT, f.path))];
    require(path.join(ROOT, f.path));
    assert.deepEqual(global[f.global], parsed.data, `${f.path}: the game and the editor read the same data`);
    const again = C.serializeDataFile({ header: parsed.header, global: f.global, data: parsed.data, eol: parsed.eol });
    assert.deepEqual(C.parseDataFile(again, f.global).data, parsed.data, `${f.path} survives a save`);
  } else {
    loaded[f.id] = C.parseJsonFile(text).data;
  }
}
for (const r of S.REFS) refs[r.id] = C.parseDataFile(read(r.path), r.global, { allowEval: true }).data;

assert.deepEqual(S.validateAll(loaded, refs).filter((i) => i.level === "error"), [], "shipped content has no errors");
assert.deepEqual(S.validateAll(loaded, refs).filter((i) => /band/.test(i.message)), [],
  "every shipped item stays inside its rarity band");

// ----- sections cover the files and previews work -----
const ctx = S.buildContext(loaded, refs);
assert.ok(ctx.statKeys.includes("stamina") && !ctx.statKeys.includes("armor"), "armor is not a valid effect target");
assert.equal(ctx.armorMultiplier, 2);
assert.equal(ctx.bodyPartKeys.length, refs.body.parts.length, "the editor knows every body part");
assert.ok(ctx.bodyPartKeys.includes("torso") && ctx.bodyPartKeys.includes("leftHand"));
assert.ok(ctx.equipmentKeys.includes("leather_cuirass"));
assert.ok(ctx.equipmentKeys.includes("iron_shortsword"), "the editor knows weapon keys");
assert.ok(ctx.rarities.includes("unique"));
assert.deepEqual(S.optionsFor("rarities", ctx).find((o) => o.value === "common"),
  { value: "common", label: "Common" }, "rarity options use their labels");
assert.deepEqual(S.optionsFor("kinds", ctx).map((o) => o.value), ["armor", "weapon"]);
assert.deepEqual(S.optionsFor("bodyParts", ctx)[0], { value: "head", label: "Head" }, "body-part options use the canonical labels");
const sections = S.sectionsFor(loaded);
const fileIds = new Set(S.FILES.map((f) => f.id));
assert.equal(new Set(sections.map((s) => s.id)).size, sections.length, "section ids are unique");
for (const s of sections) {
  assert.ok(fileIds.has(s.file), `${s.id} points at a known file`);
  const root = C.getPath({ r: loaded[s.file] }, ["r", ...s.at].join("."));
  assert.ok(s.kind === "form" ? root && typeof root === "object" : Array.isArray(root), `${s.id}: its data path resolves`);
  for (const f of s.fields) assert.ok(["text", "textarea", "number", "bool", "select", "multiselect", "effects", "list", "lines", "pairs", "map", "range"].includes(f.type), `${s.id}.${f.key}: known field type`);
  const items = s.kind === "list" ? root : [root];
  for (const item of items) {
    const p = s.preview ? s.preview(item, ctx, loaded) : { notes: [] };
    assert.ok(Array.isArray(p.notes), `${s.id}: preview returns notes`);
  }
  if (s.kind === "list") {
    const fresh = s.newItem(ctx, root);
    assert.ok(fresh && typeof fresh === "object", `${s.id}: newItem builds an entry`);
    const ids = root.map((x) => x.id || x.key);
    assert.ok(!ids.includes(fresh.id || fresh.key), `${s.id}: a new entry gets an unused id`);
  }
}
{
  const withOverride = C.clone(loaded);
  withOverride.actions.biomes = { tundra: [{ id: "tundra_shelter", name: "Shelter", timeMinutes: 60, costs: [], outcomes: [] }] };
  const extra = S.sectionsFor(withOverride).find((s) => s.id === "actions-biome:tundra");
  assert.ok(extra, "an existing biome override gets its own section");
}

// ----- action outcome ids stay unique when adding or duplicating -----
{
  assert.ok(ctx.outcomeIds.includes("scout_landmarks"), "context lists every outcome id");
  const actions = sections.find((s) => s.id === "actions-default");
  const outcomesField = actions.fields.find((f) => f.key === "outcomes");
  const fresh = outcomesField.newItem(ctx, []);
  assert.ok(!ctx.outcomeIds.includes(fresh.id), "a new outcome id is free across the whole file");

  const withNew = C.clone(loaded);
  withNew.actions.default[0].outcomes.push({ id: "new_outcome", name: "Clash", weight: 1, text: "", effects: [] });
  const ctx2 = S.buildContext(withNew, refs);
  assert.notEqual(outcomesField.newItem(ctx2, []).id, "new_outcome", "a new outcome avoids every existing id");

  const copy = C.clone(withNew.actions.default[1]);
  S.duplicateOutcomeIds(copy, withNew);
  const all = S.outcomeIds(withNew);
  assert.equal(new Set(copy.outcomes.map((o) => o.id)).size, copy.outcomes.length, "duplicated outcomes get distinct ids");
  for (const o of copy.outcomes) assert.ok(!all.includes(o.id), `duplicated outcome id ${o.id} is free`);
  assert.equal(S.duplicateOutcomeIds({ id: "x" }, withNew).id, "x", "an action without outcomes is unchanged");
}

// ----- preview maths -----
{
  const travel = sections.find((s) => s.id === "travel-events");
  const ev = loaded.travel.events[0];
  const p = travel.preview(ev, ctx, loaded);
  assert.ok(p.notes.some((n) => /interrupted 63\.2% of the time/.test(n)), "60 minute journey at 8% per 5 minute check is 63.2%");
  const totalW = loaded.travel.events.filter((e) => e.enabled !== false).reduce((s, e) => s + e.weight, 0);
  assert.ok(p.notes[0].includes(`${Math.round((ev.weight / totalW) * 1000) / 10}%`), "event share follows its weight");
  const action = sections.find((s) => s.id === "actions-default");
  const scout = loaded.actions.default.find((a) => a.id === "scout");
  assert.ok(action.preview(scout, ctx, loaded).notes.some((n) => n.startsWith("Nothing new: 42.9%")), "outcome odds follow weights");
  const armor = sections.find((s) => s.id === "equipment-items");
  const armorPreview = armor.preview(loaded.equipment.items.find((i) => i.armor > 0), ctx, loaded);
  assert.ok(armorPreview.notes.some((n) => n.includes("Covers")), "armor preview lists the body parts it covers");
  assert.ok(armorPreview.notes.some((n) => n.includes("Defend blocks")), "armor preview explains Defend");
  assert.ok(armorPreview.chips.some((c) => c.text === "Torso" || c.text === "Head"), "armor preview chips name covered parts");
  const weaponPreview = armor.preview(loaded.equipment.items.find((i) => i.kind === "weapon"), ctx, loaded);
  assert.ok(weaponPreview.notes.some((n) => n.includes("Strength")), "weapon preview shows the Strength requirement");
  assert.ok(weaponPreview.chips.some((c) => /^Pierce \d+%$/.test(c.text)), "weapon preview chips armor piercing");
}

// ----- checks catch mistakes -----
function problems(mutate) {
  const copy = C.clone(loaded);
  mutate(copy);
  return S.validateAll(copy, refs);
}
const has = (list, level, re) => list.some((i) => i.level === level && re.test(i.message));
{
  assert.ok(has(problems((d) => { d["biome:tundra"].events[0].chancePercent = 150; }), "error", /between 0 and 100/));
  assert.ok(has(problems((d) => { d["biome:tundra"].events[0].chancePercent = ""; }), "error", /must be a number/));
  assert.ok(has(problems((d) => { d["biome:tundra"].events.push({ ...d["biome:tundra"].events[0] }); }), "error", /used twice/));
  assert.ok(has(problems((d) => { d["biome:tundra"].events[0].effects = [{ stat: "luck", delta: 1 }]; }), "error", /unknown stat "luck"/));
  assert.ok(has(problems((d) => { d["biome:tundra"].events[0].effects = [{ stat: "armor", delta: 1 }]; }), "warn", /ignored here/));
  assert.ok(has(problems((d) => { d["biome:tundra"].events[0].effects = [{ stat: "hp", delta: 1.5 }]; }), "error", /whole number/));
  assert.ok(has(problems((d) => { d["biome:tundra"].events[0].effects = [{ stat: "hp", delta: 0 }]; }), "warn", /does nothing/));
  assert.ok(has(problems((d) => { d["biome:tundra"].events[0].id = "Bad Id"; }), "warn", /lowercase/));
  assert.ok(has(problems((d) => { d["biome:tundra"].events[0].chance = 0.2; }), "warn", /chancePercent wins/));
  assert.ok(has(problems((d) => { d.travel.minutesPerCheck = 0; }), "error", /at least 1/));
  assert.ok(has(problems((d) => { d.travel.chanceByBiome.moon = 5; }), "warn", /not a known biome/));
  assert.ok(has(problems((d) => { d.travel.events.forEach((e) => { e.enabled = false; }); }), "warn", /never be interrupted/));
  assert.ok(has(problems((d) => { d.equipment.items[0].parts = ["tail"]; }), "error", /Body part "tail" is not in characters\/bodyData.js/));
  assert.ok(has(problems((d) => { d.equipment.items[0].parts = []; }), "error", /Target at least one body part/));
  assert.ok(has(problems((d) => { d.equipment.items[0].parts = ["torso", "torso"]; }), "warn", /listed twice/));
  assert.ok(has(problems((d) => { d.equipment.items[0].armor = 999; }), "error", /above the cap/));
  const weaponAt = (d) => d.equipment.items.find((i) => i.kind === "weapon");
  assert.ok(has(problems((d) => { weaponAt(d).damage = 0; }), "error", /at least 1/), "weapon damage must be positive");
  assert.ok(has(problems((d) => { weaponAt(d).strength = 25; }), "error", /1 to 20/), "weapon Strength stays in range");
  assert.ok(has(problems((d) => { weaponAt(d).armorPiercing = 150; }), "error", /between 0 and 100/), "armor piercing is a percentage");
  assert.ok(has(problems((d) => { weaponAt(d).rarity = "mythic"; }), "error", /Unknown rarity/), "unknown rarities are errors");
  assert.ok(has(problems((d) => { weaponAt(d).damage = 99; }), "warn", /outside the .* band/), "out-of-band stats warn");
  assert.ok(has(problems((d) => { d.actions.default[0].outcomes[0].equipmentKey = "nothing"; }), "error", /no item "nothing"/));
  assert.ok(has(problems((d) => { d.actions.default[1].outcomes[0].id = d.actions.default[0].outcomes[0].id; }), "error", /Outcome id .* used twice/));
  assert.ok(has(problems((d) => { d.actions.default.pop(); }), "warn", /at least five/));
  assert.ok(has(problems((d) => { d.actions.default[0].outcomes[0].weight = -1; }), "error", /weight must be/));
  assert.ok(has(problems((d) => { d.characters.firstNames.male = []; }), "error", /Male first names needs/));
  assert.ok(has(problems((d) => { d.characters.surnames.push(d.characters.surnames[0]); }), "warn", /repeats/));
  assert.ok(has(problems((d) => { d.characters.opposites.push(["Brave", "Nope"]); }), "error", /not in the trait list/));
  assert.ok(has(problems((d) => { d.characters.opposites.push(["Brave", "Brave"]); }), "error", /twice/));
  assert.ok(has(problems((d) => { d.characters.ageRange = [50, 20]; }), "error", /Age range/));
  assert.ok(has(problems((d) => { d.characters.traits = ["A", "B"]; d.characters.opposites = []; }), "error", /at least five/));
  const bad = problems((d) => { d["biome:forest"] = { biome: "forest" }; });
  assert.ok(has(bad, "error", /"events" list/), "a broken file is reported, not thrown");
  // issues point at the entry so the page can show them next to it
  const where = problems((d) => { d["biome:tundra"].events[0].chancePercent = 150; }).find((i) => /between 0 and 100/.test(i.message));
  assert.equal(where.section, "biome:tundra");
  assert.equal(where.index, 0);
  assert.equal(where.field, "chancePercent");
}

console.log("editor test passed");
