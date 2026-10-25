/* Equipment module v0.1 — armor items for the main character.
   Owns the `equipment` slice. Other modules never touch it: the UI fires
   equipment:add / equipment:equip / equipment:unequip requests, and this module
   announces equipment:added / equipment:equipped / equipment:unequipped.
   The mainCharacter module listens to the equipped/unequipped events and writes
   its own `stats.armor`; actions can award an item through a resolved outcome
   (`equipmentKey`) without calling this module directly. Content lives in
   equipment/data.js. See ENGINE_SPEC.md. */
(function (global) {
  "use strict";
  const D = global.EquipmentData;

  if (!D || !Array.isArray(D.items) || !D.items.length)
    throw new Error("equipment/data.js must define EquipmentData.items with at least one item");

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const CATALOG = new Map(D.items.map((item) => [item.key, item]));
  const MAX_ARMOR = Math.max(1, Math.round(Number(D.maxArmor) || 100));
  const AUTO_EQUIP = D.autoEquip !== false;

  function weightedPick(rng, items) {
    const total = items.reduce((sum, item) => sum + (Number(item.weight) || 1), 0);
    let roll = rng.next() * total;
    for (const item of items) {
      roll -= Number(item.weight) || 1;
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  }

  function cleanItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const key = typeof raw.key === "string" ? raw.key.trim() : "";
    if (!key || !CATALOG.has(key)) return null;

    const definition = CATALOG.get(key);
    return {
      id: typeof raw.id === "string" ? raw.id.trim() : "",
      key,
      name: (typeof raw.name === "string" && raw.name.trim()) || definition.name,
      slot: (typeof raw.slot === "string" && raw.slot.trim()) || definition.slot || "body",
      armor: clamp(Math.round(Number(raw.armor ?? definition.armor) || 0), 0, MAX_ARMOR),
      equipped: raw.equipped === true,
      acquiredAtTick: Number.isFinite(Number(raw.acquiredAtTick)) ? Number(raw.acquiredAtTick) : 0,
      acquiredAt: typeof raw.acquiredAt === "string" ? raw.acquiredAt : ""
    };
  }

  function createEquipmentModule() {
    let engine = null, bound = false;

    // Never cache the slice object: load() replaces the whole state.
    const S = () => engine.state.modules.equipment;

    const normalize = () => {
      const s = S();
      if (!s.items || typeof s.items !== "object" || Array.isArray(s.items)) s.items = {};
      if (!Number.isFinite(Number(s.nextId)) || Number(s.nextId) < 1) s.nextId = 1;

      let maxId = 0;
      for (const [id, raw] of Object.entries(s.items)) {
        const item = cleanItem({ ...raw, id });
        if (!item) { delete s.items[id]; continue; }
        s.items[id] = item;
        const match = /^eq_(\d+)$/.exec(id);
        if (match) maxId = Math.max(maxId, Number(match[1]));
      }
      s.nextId = Math.max(Number(s.nextId) || 1, maxId + 1);

      let equippedId = typeof s.equippedId === "string" ? s.equippedId : null;
      if (equippedId && !s.items[equippedId]) equippedId = null;
      if (!equippedId) {
        const first = Object.values(s.items).find((item) => item.equipped);
        equippedId = first ? first.id : null;
      }
      s.equippedId = equippedId;
      for (const item of Object.values(s.items)) item.equipped = item.id === equippedId;

      return s;
    };

    const totalArmor = () => {
      const s = S();
      const item = s.equippedId ? s.items[s.equippedId] : null;
      return item ? item.armor : 0;
    };

    const emitEquipped = (item, previousItemId, depth) => {
      engine.fire({
        type: "equipment:equipped",
        text: `${item.name} is equipped (armor ${item.armor}).`,
        data: {
          itemId: item.id, key: item.key, name: item.name, slot: item.slot,
          armor: item.armor, totalArmor: item.armor, previousItemId: previousItemId || null
        }
      }, depth);
    };

    const mod = {
      name: "equipment", depends: [], slots: Array.isArray(D.slots) ? D.slots.slice() : ["body"],

      init(eng) {
        engine = eng;
        engine.slice("equipment", { nextId: 1, items: {}, equippedId: null });
        normalize();

        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        engine.on("event:equipment:add", (e) => mod.add(e.depth + 1, e.data || {}));
        engine.on("event:equipment:equip", (e) => mod.equip(e.data && e.data.itemId, e.depth + 1));
        engine.on("event:equipment:unequip", (e) => mod.unequip(e.depth + 1));
        engine.on("event:action:resolved", (e) => {
          const data = e.data || {};
          if (data.equipmentKey) mod.add(e.depth + 1, { key: data.equipmentKey, source: data.actionId });
        });
      },

      onLoad(eng) {
        engine = eng;
        engine.slice("equipment", { nextId: 1, items: {}, equippedId: null });
        normalize();
      },

      totalArmor,

      armorFor(characterId) {
        // Only the main character wears equipment in v0.1.
        return characterId === "main" ? totalArmor() : 0;
      },

      // Add one catalogue item. Without a key the module picks with engine.rng.
      add(depth = 0, data = {}) {
        const s = S();
        const requestedKey = typeof data.key === "string" ? data.key.trim() : "";
        const definition = requestedKey ? CATALOG.get(requestedKey) : weightedPick(engine.rng, D.items);
        if (!definition) return null;

        const now = engine.now, item = {
          id: "eq_" + String(s.nextId++).padStart(4, "0"),
          key: definition.key,
          name: definition.name,
          slot: definition.slot || "body",
          armor: clamp(Math.round(Number(definition.armor) || 0), 0, MAX_ARMOR),
          equipped: false,
          acquiredAtTick: now.tick,
          acquiredAt: now.text
        };

        s.items[item.id] = item;
        const autoEquipped = AUTO_EQUIP && !s.equippedId;
        if (autoEquipped) {
          item.equipped = true;
          s.equippedId = item.id;
        }

        engine.fire({
          type: "equipment:added",
          text: `${item.name} (armor ${item.armor}) is added to the inventory${autoEquipped ? " and equipped" : ""}.`,
          data: {
            itemId: item.id, key: item.key, name: item.name, slot: item.slot,
            armor: item.armor, equipped: item.equipped, source: data.source || "inventory"
          }
        }, depth);

        if (autoEquipped) emitEquipped(item, null, depth);
        return item;
      },

      equip(itemId, depth = 0) {
        const s = S();
        const id = typeof itemId === "string" ? itemId.trim() : "";
        const item = s.items[id];
        if (!item) return null;
        if (s.equippedId === id) return item;

        const previousItemId = s.equippedId;
        if (previousItemId && s.items[previousItemId]) s.items[previousItemId].equipped = false;
        item.equipped = true;
        s.equippedId = item.id;
        emitEquipped(item, previousItemId, depth);
        return item;
      },

      unequip(depth = 0) {
        const s = S();
        const item = s.equippedId ? s.items[s.equippedId] : null;
        if (!item) return null;

        item.equipped = false;
        s.equippedId = null;
        engine.fire({
          type: "equipment:unequipped",
          text: `${item.name} is removed. Armor is now 0.`,
          data: {
            itemId: item.id, key: item.key, name: item.name,
            armor: item.armor, totalArmor: 0
          }
        }, depth);
        return item;
      }
    };

    return mod;
  }

  global.createEquipmentModule = createEquipmentModule;
})(window);
