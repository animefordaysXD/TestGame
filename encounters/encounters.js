/* Encounters module v0.1 — hostility-driven enemies and loot.
   The module owns the `encounters` slice and communicates only through events.
   On location:visited it clears the previous encounter spawns with
   character:clearTemp { source }, rolls the location's hostility band, then fires one
   character:spawn per enemy with { source, locationId, hostility, level, relation }.
   character:spawned maps the new NPC id back to the encounter so combat:ended can award
   loot when that enemy loses to the main character. Higher hostility raises the spawn
   chance, enemy count and enemy level, lowers enemy relation and rolls stronger loot.
   Content and tuning live in encounters/data.js. See MODULES.md. */
(function (global) {
  "use strict";
  const D = global.EncounterData;

  if (!D || !D.spawn || !Array.isArray(D.spawn.bands) || !D.spawn.bands.length)
    throw new Error("encounters/data.js must define EncounterData.spawn.bands");
  if (!D.loot || !Array.isArray(D.loot.rarityBands) || !D.loot.rarityBands.length)
    throw new Error("encounters/data.js must define EncounterData.loot.rarityBands");

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const number = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const rounded = (value, fallback) => Math.round(number(value, fallback));
  const chancePercent = (value) => clamp(number(value, 0), 0, 100);

  function bandFor(bands, key, hostility) {
    const value = clamp(rounded(hostility, 50), 1, 100);
    return bands.find((band) => value <= number(band[key], 100)) || bands[bands.length - 1];
  }

  function pick(rng, list) {
    return list[Math.floor(rng.next() * list.length)];
  }

  function weightedPick(rng, list) {
    const total = list.reduce((sum, item) => sum + Math.max(0, number(item.weight, 1)), 0);
    if (total <= 0) return list[0] || null;
    let roll = rng.next() * total;
    for (const item of list) {
      roll -= Math.max(0, number(item.weight, 1));
      if (roll < 0) return item;
    }
    return list[list.length - 1];
  }

  function createEncountersModule() {
    let engine = null, bound = false;
    const S = () => engine.state.modules.encounters;   // never cache: load() replaces state
    const source = typeof D.spawn.clearSource === "string" && D.spawn.clearSource
      ? D.spawn.clearSource : "encounter";
    const maxPerVisit = Math.max(1, rounded(D.spawn.maxPerVisit, 4));

    const normalize = () => {
      const s = S();
      if (!s.enemies || typeof s.enemies !== "object") s.enemies = {};
      if (!s.lastVisit || typeof s.lastVisit !== "object") s.lastVisit = null;
      if (!s.lastLoot || typeof s.lastLoot !== "object") s.lastLoot = null;
      return s;
    };

    const mod = {
      name: "encounters", depends: [],

      init(eng) {
        engine = eng;
        engine.slice("encounters", { enemies: {}, lastVisit: null, lastLoot: null });
        normalize();
        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        engine.on("event:location:visited", (e) => mod.onVisit(e.data || {}, e.depth + 1));
        engine.on("event:character:spawned", (e) => mod.onSpawned(e.data || {}));
        engine.on("event:combat:ended", (e) => mod.onCombatEnded(e.data || {}, e.depth + 1));
        engine.on("event:character:tempCleared", (e) => mod.onTempCleared(e.data || {}));
      },

      onLoad(eng) {
        engine = eng;
        engine.slice("encounters", { enemies: {}, lastVisit: null, lastLoot: null });
        normalize();
      },

      spawnBandFor(hostility) {
        return bandFor(D.spawn.bands, "maxHostility", hostility);
      },

      // Enemy relation is always hostile by design; higher hostility pushes it lower.
      relationFor(hostility) {
        const value = clamp(
          Math.round(number(D.relations && D.relations.base, -31) + number(D.relations && D.relations.perHostility, -0.69) * clamp(rounded(hostility, 50), 1, 100)),
          -100, 100
        );
        return { value, type: (D.relations && D.relations.type) || "bandit" };
      },

      enemyLevelFor(locationLevel, hostility) {
        const base = Math.max(1, rounded(locationLevel, 1));
        const perLevel = Math.max(1, number(D.levels && D.levels.hostilityPerLevel, 25));
        const bonus = Math.max(0, Math.floor((clamp(rounded(hostility, 50), 1, 100) - 50) / perLevel));
        return clamp(base + bonus, 1, 100);
      },

      dropChanceFor(hostility) {
        const loot = D.loot;
        const chance = number(loot.dropChancePercent, 50)
          + number(loot.chancePerHostility, 0.5) * (clamp(rounded(hostility, 50), 1, 100) - 50);
        return clamp(chance, 0, chancePercent(loot.maxDropChancePercent === undefined ? 100 : loot.maxDropChancePercent));
      },

      lootBandFor(hostility) {
        return bandFor(D.loot.rarityBands, "maxHostility", hostility);
      },

      rarityFor(hostility) {
        const band = mod.lootBandFor(hostility);
        const list = Array.isArray(band.rarities) && band.rarities.length ? band.rarities : ["common"];
        return pick(engine.rng, list);
      },

      kindFor() {
        const list = Array.isArray(D.loot.kindWeights) && D.loot.kindWeights.length
          ? D.loot.kindWeights : [{ kind: "armor", weight: 1 }];
        const picked = weightedPick(engine.rng, list);
        return picked ? picked.kind : "armor";
      },

      onVisit(data, depth = 0) {
        if (!data || !data.id) return null;
        const s = normalize();

        // Old encounter enemies leave before the new area is rolled.
        engine.fire({ type: "character:clearTemp", data: { source } }, depth);

        const hostility = clamp(rounded(data.hostility, 50), 1, 100);
        const level = Math.max(1, rounded(data.level, 1));
        const band = mod.spawnBandFor(hostility);
        const chance = chancePercent(band.chancePercent);
        const roll = engine.rng.next();
        const triggered = roll < chance / 100;
        let count = 0;

        if (triggered) {
          const lo = Math.max(1, rounded(band.minCount, 1));
          const hi = Math.max(lo, rounded(band.maxCount, lo));
          count = clamp(lo + Math.floor(engine.rng.next() * (hi - lo + 1)), 1, maxPerVisit);
          const relation = mod.relationFor(hostility);
          const enemyLevel = mod.enemyLevelFor(level, hostility);
          for (let i = 0; i < count; i++) {
            engine.fire({
              type: "character:spawn",
              text: `A hostile ${relation.type} appears in ${data.name || "the area"}.`,
              data: {
                source, locationId: data.id, locationName: data.name || "",
                hostility, level: enemyLevel, relation
              }
            }, depth);
          }
        }

        s.lastVisit = {
          locationId: data.id, locationName: data.name || "",
          hostility, level, band: band.key, chancePercent: chance,
          roll: Math.round(roll * 1000) / 1000, triggered, count
        };
        return s.lastVisit;
      },

      onSpawned(data) {
        if (!data || data.source !== source || !data.id) return null;
        const s = normalize();
        const relation = data.relation && typeof data.relation === "object" ? data.relation : {};
        s.enemies[data.id] = {
          id: data.id,
          name: data.name || data.id,
          locationId: data.locationId || "",
          hostility: clamp(rounded(data.hostility, 50), 1, 100),
          level: Math.max(1, rounded(data.level, 1)),
          relation: clamp(rounded(relation.value, -31), -100, 100),
          relationType: typeof relation.type === "string" ? relation.type : source,
          spawnedAtTick: engine.now.tick
        };
        return s.enemies[data.id];
      },

      onCombatEnded(data, depth = 0) {
        if (!data || data.winnerId !== "main" || !data.loserId) return null;
        const s = normalize();
        const enemy = s.enemies[data.loserId];
        if (!enemy) return null;
        delete s.enemies[data.loserId];

        const chance = mod.dropChanceFor(enemy.hostility);
        const roll = engine.rng.next();
        const record = {
          enemyId: enemy.id, enemyName: enemy.name, locationId: enemy.locationId,
          hostility: enemy.hostility, level: enemy.level,
          dropChancePercent: Math.round(chance * 10) / 10,
          roll: Math.round(roll * 1000) / 1000,
          awarded: roll < chance / 100, kind: null, rarity: null
        };

        if (record.awarded) {
          record.kind = mod.kindFor();
          record.rarity = mod.rarityFor(enemy.hostility);
          s.lastLoot = record;
          engine.fire({
            type: "equipment:add",
            text: `${enemy.name} drops a ${record.rarity} ${record.kind}.`,
            data: { kind: record.kind, rarity: record.rarity, source: "loot", enemyId: enemy.id }
          }, depth);
        } else {
          s.lastLoot = record;
        }
        return record;
      },

      onTempCleared(data) {
        const s = normalize();
        const ids = Array.isArray(data && data.ids) ? data.ids : [];
        for (const id of ids) delete s.enemies[id];
      },

      enemiesFor(locationId) {
        const s = normalize();
        return Object.values(s.enemies).filter((enemy) => !locationId || enemy.locationId === locationId);
      },

      lastVisit() {
        return normalize().lastVisit;
      },

      lastLoot() {
        return normalize().lastLoot;
      }
    };

    return mod;
  }

  global.createEncountersModule = createEncountersModule;
})(typeof window !== "undefined" ? window : globalThis);
