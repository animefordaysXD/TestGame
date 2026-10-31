/* Equipment module v0.2 — armor items for the main character, worn on body parts.
   Owns the `equipment` slice. Other modules never touch it: the UI fires
   equipment:add / equipment:equip / equipment:unequip requests, and this module
   announces equipment:added / equipment:equipped / equipment:unequipped.
   Every item targets one or more parts from characters/bodyData.js. An item cannot
   share a part with another worn item; equipping it removes the conflicting items.
   The mainCharacter module listens to the equipped/unequipped events and writes its
   own `stats.armor` from the announced total. Actions can award an item through a
   resolved outcome (`equipmentKey`) without calling this module directly. Content
   lives in equipment/data.js. See ENGINE_SPEC.md. */
(function (global) {
  "use strict";
  const D = global.EquipmentData;

  if (!D || !Array.isArray(D.items) || !D.items.length)
    throw new Error("equipment/data.js must define EquipmentData.items with at least one item");

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const BODY = global.CharacterBodyData;
  const BODY_PARTS = BODY && Array.isArray(BODY.parts) ? BODY.parts.map((part) => part.key) : [];
  const PART_LABELS = new Map(
    BODY && Array.isArray(BODY.parts) ? BODY.parts.map((part) => [part.key, part.label || part.key]) : []
  );

  const rawParts = (value) => (Array.isArray(value) ? value : []).filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim());
  const cleanParts = (value) => {
    const seen = new Set();
    const out = [];
    for (const part of rawParts(value)) {
      if (seen.has(part)) continue;
      if (BODY_PARTS.length && !BODY_PARTS.includes(part)) continue;
      seen.add(part);
      out.push(part);
    }
    return out;
  };

  // The catalogue is the single definition of what each key covers. Items saved in an
  // older slice may still carry `slot`; their definition supplies the body parts.
  const CATALOG = new Map(D.items.map((item) => [item.key, item]));
  for (const item of CATALOG.values()) {
    item.parts = cleanParts(item.parts);
    if (!item.parts.length)
      throw new Error(`equipment/data.js item "${item.key}" must target at least one body part`);
  }

  const MAX_ARMOR = Math.max(1, Math.round(Number(D.maxArmor) || 100));
  const AUTO_EQUIP = D.autoEquip !== false;
  const isObj = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

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
    const parts = cleanParts(raw.parts);
    return {
      id: typeof raw.id === "string" ? raw.id.trim() : "",
      key,
      name: (typeof raw.name === "string" && raw.name.trim()) || definition.name,
      parts: parts.length ? parts : definition.parts.slice(),
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

    const equippedIds = (s = S()) => [...new Set(Object.values(s.equippedByPart || {}))];

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

      // Migrate v0.1: one `equippedId` and items with `slot: "body"`.
      const legacyId = typeof s.equippedId === "string" ? s.equippedId : null;
      delete s.equippedId;
      if (!isObj(s.equippedByPart)) s.equippedByPart = {};

      // Keep only assignments that still point at a real item covering that part.
      for (const [part, id] of Object.entries(s.equippedByPart)) {
        const item = s.items[id];
        if (!BODY_PARTS.includes(part) && BODY_PARTS.length) delete s.equippedByPart[part];
        else if (!item || !item.parts.includes(part)) delete s.equippedByPart[part];
      }

      // Rebuild from items flagged equipped plus the legacy single id. Parts are
      // assigned in catalogue order; a conflicting item simply stays in the inventory.
      const wanted = new Set();
      if (legacyId && s.items[legacyId]) wanted.add(legacyId);
      for (const item of Object.values(s.items)) if (item.equipped) wanted.add(item.id);
      for (const id of [...wanted].sort()) {
        const item = s.items[id];
        for (const part of item.parts) if (!s.equippedByPart[part]) s.equippedByPart[part] = id;
      }

      const worn = new Set(equippedIds(s));
      for (const item of Object.values(s.items)) item.equipped = worn.has(item.id);
      return s;
    };

    const totalArmor = () => {
      const s = S(), worn = equippedIds(s);
      let total = 0;
      for (const id of worn) if (s.items[id]) total += s.items[id].armor;
      return clamp(total, 0, MAX_ARMOR);
    };

    const partsOf = (id, s = S()) => {
      const item = s.items[id];
      if (!item) return [];
      return item.parts.filter((part) => s.equippedByPart[part] === id);
    };

    const emitEquipped = (item, replacedItemIds, depth) => {
      const names = replacedItemIds.map((id) => (S().items[id] || {}).name).filter(Boolean);
      engine.fire({
        type: "equipment:equipped",
        text: `${item.name} is equipped${names.length ? `, replacing ${names.join(", ")}` : ""} (armor ${totalArmor()}).`,
        data: {
          itemId: item.id, key: item.key, name: item.name, parts: item.parts.slice(),
          armor: item.armor, totalArmor: totalArmor(), replacedItemIds: replacedItemIds.slice()
        }
      }, depth);
    };

    const mod = {
      name: "equipment", depends: [], parts: BODY_PARTS.slice(),

      init(eng) {
        engine = eng;
        engine.slice("equipment", { nextId: 1, items: {}, equippedByPart: {} });
        normalize();

        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        engine.on("event:equipment:add", (e) => mod.add(e.depth + 1, e.data || {}));
        engine.on("event:equipment:equip", (e) => mod.equip(e.data && e.data.itemId, e.depth + 1));
        engine.on("event:equipment:unequip", (e) => mod.unequip(e.data && e.data.itemId, e.depth + 1));
        engine.on("event:action:resolved", (e) => {
          const data = e.data || {};
          if (data.equipmentKey) mod.add(e.depth + 1, { key: data.equipmentKey, source: data.actionId });
        });
      },

      onLoad(eng) {
        engine = eng;
        engine.slice("equipment", { nextId: 1, items: {}, equippedByPart: {} });
        normalize();
      },

      totalArmor,

      armorFor(characterId) {
        // Only the main character wears equipment in v0.2.
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
          parts: definition.parts.slice(),
          armor: clamp(Math.round(Number(definition.armor) || 0), 0, MAX_ARMOR),
          equipped: false,
          acquiredAtTick: now.tick,
          acquiredAt: now.text
        };

        s.items[item.id] = item;
        const free = item.parts.every((part) => !s.equippedByPart[part]);
        const autoEquipped = AUTO_EQUIP && free;
        if (autoEquipped) {
          item.equipped = true;
          for (const part of item.parts) s.equippedByPart[part] = item.id;
        }

        engine.fire({
          type: "equipment:added",
          text: `${item.name} (armor ${item.armor}, ${item.parts.length} part${item.parts.length === 1 ? "" : "s"}) is added to the inventory${autoEquipped ? " and equipped" : ""}.`,
          data: {
            itemId: item.id, key: item.key, name: item.name, parts: item.parts.slice(),
            armor: item.armor, equipped: item.equipped, source: data.source || "inventory"
          }
        }, depth);

        if (autoEquipped) emitEquipped(item, [], depth);
        return item;
      },

      equip(itemId, depth = 0) {
        const s = S();
        const id = typeof itemId === "string" ? itemId.trim() : "";
        const item = s.items[id];
        if (!item) return null;
        if (item.parts.every((part) => s.equippedByPart[part] === id)) return item;

        // Every part of the new item becomes exclusive to it. Any item wearing one of
        // those parts is removed whole, because items equip as one piece.
        const replaced = new Set();
        for (const part of item.parts) {
          const occupant = s.equippedByPart[part];
          if (occupant && occupant !== id) replaced.add(occupant);
        }
        for (const occupiedId of replaced) {
          const occupied = s.items[occupiedId];
          if (!occupied) continue;
          for (const part of occupied.parts) if (s.equippedByPart[part] === occupiedId) delete s.equippedByPart[part];
          occupied.equipped = false;
        }
        for (const part of item.parts) s.equippedByPart[part] = item.id;
        item.equipped = true;
        emitEquipped(item, [...replaced], depth);
        return item;
      },

      // Unequip one item when itemId is given, otherwise every worn item.
      unequip(itemId, depth = 0) {
        const s = S();
        const requested = typeof itemId === "string" ? itemId.trim() : "";
        const targets = requested
          ? [s.items[requested]].filter(Boolean)
          : equippedIds(s).map((id) => s.items[id]).filter(Boolean);
        const removed = targets.filter((item) => item.parts.some((part) => s.equippedByPart[part] === item.id));
        if (!removed.length) return null;

        for (const item of removed) {
          for (const part of item.parts) if (s.equippedByPart[part] === item.id) delete s.equippedByPart[part];
          item.equipped = false;
        }

        const total = totalArmor();
        const parts = [...new Set(removed.flatMap((item) => item.parts))];
        const single = removed.length === 1 ? removed[0] : null;
        engine.fire({
          type: "equipment:unequipped",
          text: `${single ? single.name : `${removed.length} items`} ${removed.length === 1 ? "is" : "are"} removed. Armor is now ${total}.`,
          data: {
            itemId: single ? single.id : null,
            itemIds: removed.map((item) => item.id),
            items: removed.map((item) => ({ id: item.id, key: item.key, name: item.name, parts: item.parts.slice(), armor: item.armor })),
            key: single ? single.key : null,
            name: single ? single.name : `${removed.length} items`,
            parts,
            armor: removed.reduce((sum, item) => sum + item.armor, 0),
            totalArmor: total
          }
        }, depth);
        return single || removed;
      },

      // Exposed for the UI: which item covers each part, in body order.
      coverage() {
        const s = S();
        return BODY_PARTS.map((part) => ({
          part, label: PART_LABELS.get(part) || part,
          itemId: s.equippedByPart[part] || null
        }));
      }
    };

    return mod;
  }

  global.createEquipmentModule = createEquipmentModule;
})(window);
