/* Equipment module v0.4 — armor and weapons for the main character.
   Owns the `equipment` slice. Other modules never touch it: the UI fires
   equipment:add / equipment:equip / equipment:unequip / equipment:remove requests,
   and this module announces equipment:added / equipment:equipped /
   equipment:unequipped / equipment:removed.
   Armor items target one or more parts from characters/bodyData.js. An armor item cannot
   share a part with another worn item; equipping it removes the conflicting items.
   Weapons occupy one dedicated slot, so one weapon is carried at a time. A weapon has
   base `damage`, a `strength` requirement and `armorPiercing` (0-100). Combat reads the
   equipped weapon from the snapshot the UI builds; this module does not read stats.
   Every item carries a `rarity` from equipment/data.js plus a `weaponType` (sword, spear,
   axe, mace) or `armorType` (cloth, leather, mail, plate, scale). A random add can be
   filtered by rarity, kind or type, and `equipment:remove` destroys an item, ready for
   future events/mobs.
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

  const RARITY_DEFS = Array.isArray(D.rarities) ? D.rarities : [];
  const RARITY_KEYS = RARITY_DEFS.map((rarity) => rarity.key);
  const RARITY_BY_KEY = new Map(RARITY_DEFS.map((rarity) => [rarity.key, rarity]));
  const DEFAULT_RARITY = RARITY_KEYS[0] || "common";
  const KINDS = ["armor", "weapon"];

  // Type definitions are data too: the catalogue and the editor share these lists.
  const typeSet = (defs) => {
    const list = (Array.isArray(defs) ? defs : []).filter((def) => def && typeof def.key === "string");
    return { keys: list.map((def) => def.key), byKey: new Map(list.map((def) => [def.key, def])) };
  };
  const WEAPON_TYPES = typeSet(D.weaponTypes);
  const ARMOR_TYPES = typeSet(D.armorTypes);
  const DEFAULT_WEAPON_TYPE = WEAPON_TYPES.keys[0] || null;
  const DEFAULT_ARMOR_TYPE = ARMOR_TYPES.keys[0] || null;

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
  const cleanKind = (value, fallback) => (KINDS.includes(value) ? value : fallback);
  const cleanRarity = (value, fallback) =>
    RARITY_BY_KEY.has(value) ? value : (RARITY_BY_KEY.has(fallback) ? fallback : DEFAULT_RARITY);
  const cleanType = (set, value, fallback, defaultKey) =>
    set.byKey.has(value) ? value : (set.byKey.has(fallback) ? fallback : defaultKey);
  const int = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  };

  // The catalogue is the single definition of what each key covers. Items saved in an
  // older slice may still carry `slot`; their definition supplies the body parts.
  const CATALOG = new Map(D.items.map((item) => [item.key, item]));
  for (const item of CATALOG.values()) {
    item.kind = cleanKind(item.kind, "armor");
    item.rarity = cleanRarity(item.rarity, DEFAULT_RARITY);
    if (item.kind === "weapon") {
      item.weaponType = cleanType(WEAPON_TYPES, item.weaponType, null, DEFAULT_WEAPON_TYPE);
      delete item.armorType;
      item.parts = [];
      item.damage = Math.max(0, int(item.damage, 0));
      item.strength = clamp(int(item.strength, 1), 1, 20);
      item.armorPiercing = clamp(int(item.armorPiercing, 0), 0, 100);
      if (!item.damage)
        throw new Error(`equipment/data.js weapon "${item.key}" must have damage above 0`);
    } else {
      item.armorType = cleanType(ARMOR_TYPES, item.armorType, null, DEFAULT_ARMOR_TYPE);
      delete item.weaponType;
      item.parts = cleanParts(item.parts);
      if (!item.parts.length)
        throw new Error(`equipment/data.js item "${item.key}" must target at least one body part`);
    }
  }

  const MAX_ARMOR = Math.max(1, Math.round(Number(D.maxArmor) || 100));
  const AUTO_EQUIP = D.autoEquip !== false;
  const isObj = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

  function weightedPick(rng, items) {
    if (!items.length) return null;
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
    const item = {
      id: typeof raw.id === "string" ? raw.id.trim() : "",
      key,
      name: (typeof raw.name === "string" && raw.name.trim()) || definition.name,
      kind: definition.kind,
      rarity: cleanRarity(raw.rarity, definition.rarity),
      equipped: raw.equipped === true,
      acquiredAtTick: Number.isFinite(Number(raw.acquiredAtTick)) ? Number(raw.acquiredAtTick) : 0,
      acquiredAt: typeof raw.acquiredAt === "string" ? raw.acquiredAt : ""
    };

    if (definition.kind === "weapon") {
      item.weaponType = cleanType(WEAPON_TYPES, raw.weaponType, definition.weaponType, DEFAULT_WEAPON_TYPE);
      item.parts = [];
      item.damage = Math.max(0, int(raw.damage ?? definition.damage, 0));
      item.strength = clamp(int(raw.strength ?? definition.strength, 1), 1, 20);
      item.armorPiercing = clamp(int(raw.armorPiercing ?? definition.armorPiercing, 0), 0, 100);
    } else {
      item.armorType = cleanType(ARMOR_TYPES, raw.armorType, definition.armorType, DEFAULT_ARMOR_TYPE);
      const parts = cleanParts(raw.parts);
      item.parts = parts.length ? parts : definition.parts.slice();
      item.armor = clamp(int(raw.armor ?? definition.armor, 0), 0, MAX_ARMOR);
    }
    return item;
  }

  function createEquipmentModule() {
    let engine = null, bound = false;

    // Never cache the slice object: load() replaces the whole state.
    const S = () => engine.state.modules.equipment;

    const isWorn = (item, s = S()) => {
      if (!item) return false;
      if (item.kind === "weapon") return s.equippedWeaponId === item.id;
      return item.parts.some((part) => s.equippedByPart[part] === item.id);
    };

    const wornArmorIds = (s = S()) => [...new Set(Object.values(s.equippedByPart || {}))];
    const equippedItems = (s = S()) => {
      const items = wornArmorIds(s).map((id) => s.items[id]).filter(Boolean);
      const weapon = s.equippedWeaponId ? s.items[s.equippedWeaponId] : null;
      if (weapon && weapon.kind === "weapon") items.push(weapon);
      return items;
    };

    const normalize = () => {
      const s = S();
      if (!s.items || typeof s.items !== "object" || Array.isArray(s.items)) s.items = {};
      if (!Number.isFinite(Number(s.nextId)) || Number(s.nextId) < 1) s.nextId = 1;
      if (typeof s.equippedWeaponId !== "string" || !s.equippedWeaponId) s.equippedWeaponId = null;

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

      // Keep only assignments that still point at a real armor item covering that part.
      for (const [part, id] of Object.entries(s.equippedByPart)) {
        const item = s.items[id];
        if (!BODY_PARTS.includes(part) && BODY_PARTS.length) delete s.equippedByPart[part];
        else if (!item || item.kind !== "armor" || !item.parts.includes(part)) delete s.equippedByPart[part];
      }

      // Rebuild armor from items flagged equipped plus the legacy single id. Parts are
      // assigned in catalogue order; a conflicting item simply stays in the inventory.
      const wantedArmor = new Set();
      if (legacyId && s.items[legacyId] && s.items[legacyId].kind === "armor") wantedArmor.add(legacyId);
      for (const item of Object.values(s.items)) if (item.kind === "armor" && item.equipped) wantedArmor.add(item.id);
      for (const id of [...wantedArmor].sort()) {
        const item = s.items[id];
        for (const part of item.parts) if (!s.equippedByPart[part]) s.equippedByPart[part] = id;
      }

      // Weapons have one slot. Keep a valid assignment, otherwise take the first flagged one.
      if (s.equippedWeaponId && (!s.items[s.equippedWeaponId] || s.items[s.equippedWeaponId].kind !== "weapon"))
        s.equippedWeaponId = null;
      if (!s.equippedWeaponId) {
        const wantedWeapon = Object.values(s.items)
          .filter((item) => item.kind === "weapon" && item.equipped)
          .map((item) => item.id)
          .sort()[0];
        s.equippedWeaponId = wantedWeapon || null;
      }

      for (const item of Object.values(s.items)) item.equipped = isWorn(item, s);
      return s;
    };

    const totalArmor = () => {
      const s = S(), worn = wornArmorIds(s);
      let total = 0;
      for (const id of worn) if (s.items[id] && s.items[id].kind === "armor") total += s.items[id].armor;
      return clamp(total, 0, MAX_ARMOR);
    };

    const equippedWeapon = (s = S()) => {
      const item = s.equippedWeaponId ? s.items[s.equippedWeaponId] : null;
      return item && item.kind === "weapon" ? item : null;
    };

    const partsOf = (id, s = S()) => {
      const item = s.items[id];
      if (!item || item.kind !== "armor") return [];
      return item.parts.filter((part) => s.equippedByPart[part] === id);
    };

    const itemStats = (item) => item.kind === "weapon"
      ? { damage: item.damage, strength: item.strength, armorPiercing: item.armorPiercing }
      : { armor: item.armor };

    const itemTypes = (item) => item.kind === "weapon"
      ? { weaponType: item.weaponType }
      : { armorType: item.armorType };

    const statText = (item) => item.kind === "weapon"
      ? `damage ${item.damage}, Strength ${item.strength}, ${item.armorPiercing}% armor piercing`
      : `armor ${item.armor}`;

    const emitEquipped = (item, replacedItemIds, depth) => {
      const names = replacedItemIds.map((id) => (S().items[id] || {}).name).filter(Boolean);
      engine.fire({
        type: "equipment:equipped",
        text: `${item.name} is equipped${names.length ? `, replacing ${names.join(", ")}` : ""} (${statText(item)}).`,
        data: {
          itemId: item.id, key: item.key, name: item.name, kind: item.kind, rarity: item.rarity,
          ...itemTypes(item), parts: item.parts.slice(), ...itemStats(item),
          totalArmor: totalArmor(), replacedItemIds: replacedItemIds.slice()
        }
      }, depth);
    };

    const mod = {
      name: "equipment", depends: [], parts: BODY_PARTS.slice(), kinds: KINDS.slice(), rarities: RARITY_KEYS.slice(),
      weaponTypes: WEAPON_TYPES.keys.slice(), armorTypes: ARMOR_TYPES.keys.slice(),

      init(eng) {
        engine = eng;
        engine.slice("equipment", { nextId: 1, items: {}, equippedByPart: {}, equippedWeaponId: null });
        normalize();

        if (bound) return;   // init runs again on reset: subscribe only once
        bound = true;
        engine.on("event:equipment:add", (e) => mod.add(e.depth + 1, e.data || {}));
        engine.on("event:equipment:equip", (e) => mod.equip(e.data && e.data.itemId, e.depth + 1));
        engine.on("event:equipment:unequip", (e) => mod.unequip(e.data && e.data.itemId, e.depth + 1));
        engine.on("event:equipment:remove", (e) => mod.remove(e.data && e.data.itemId, e.depth + 1));
        engine.on("event:action:resolved", (e) => {
          const data = e.data || {};
          if (data.equipmentKey) mod.add(e.depth + 1, { key: data.equipmentKey, source: data.actionId });
        });
      },

      onLoad(eng) {
        engine = eng;
        engine.slice("equipment", { nextId: 1, items: {}, equippedByPart: {}, equippedWeaponId: null });
        normalize();
      },

      totalArmor,
      equippedWeapon,

      armorFor(characterId) {
        // Only the main character wears equipment in v0.3.
        return characterId === "main" ? totalArmor() : 0;
      },

      weaponFor(characterId) {
        return characterId === "main" ? equippedWeapon() : null;
      },

      rarityFor(key) {
        return RARITY_BY_KEY.get(key) || null;
      },

      weaponTypeFor(key) {
        return WEAPON_TYPES.byKey.get(key) || null;
      },

      armorTypeFor(key) {
        return ARMOR_TYPES.byKey.get(key) || null;
      },

      // Add one catalogue item. Without a key the module picks with engine.rng.
      // Optional `rarity`, `kind`, `weaponType` and `armorType` filters narrow that pick.
      add(depth = 0, data = {}) {
        const s = S();
        const requestedKey = typeof data.key === "string" ? data.key.trim() : "";
        const kind = KINDS.includes(data.kind) ? data.kind : null;
        const rarity = RARITY_BY_KEY.has(data.rarity) ? data.rarity : null;
        const weaponType = WEAPON_TYPES.byKey.has(data.weaponType) ? data.weaponType : null;
        const armorType = ARMOR_TYPES.byKey.has(data.armorType) ? data.armorType : null;

        let definition;
        if (requestedKey) {
          definition = CATALOG.get(requestedKey);
        } else {
          let pool = [...CATALOG.values()];
          if (kind) pool = pool.filter((item) => item.kind === kind);
          if (rarity) pool = pool.filter((item) => item.rarity === rarity);
          if (weaponType) pool = pool.filter((item) => item.kind === "weapon" && item.weaponType === weaponType);
          if (armorType) pool = pool.filter((item) => item.kind === "armor" && item.armorType === armorType);
          definition = weightedPick(engine.rng, pool);
        }
        if (!definition) return null;

        const now = engine.now, item = {
          id: "eq_" + String(s.nextId++).padStart(4, "0"),
          key: definition.key,
          name: definition.name,
          kind: definition.kind,
          rarity: definition.rarity,
          parts: definition.kind === "armor" ? definition.parts.slice() : [],
          equipped: false,
          acquiredAtTick: now.tick,
          acquiredAt: now.text
        };
        if (definition.kind === "weapon") {
          item.weaponType = definition.weaponType;
          item.damage = definition.damage;
          item.strength = definition.strength;
          item.armorPiercing = definition.armorPiercing;
        } else {
          item.armorType = definition.armorType;
          item.armor = clamp(int(definition.armor, 0), 0, MAX_ARMOR);
        }

        s.items[item.id] = item;
        const free = definition.kind === "weapon"
          ? !s.equippedWeaponId
          : item.parts.every((part) => !s.equippedByPart[part]);
        const autoEquipped = AUTO_EQUIP && free;
        if (autoEquipped) {
          item.equipped = true;
          if (item.kind === "weapon") s.equippedWeaponId = item.id;
          else for (const part of item.parts) s.equippedByPart[part] = item.id;
        }

        engine.fire({
          type: "equipment:added",
          text: `${item.name} (${statText(item)}) is added to the inventory${autoEquipped ? " and equipped" : ""}.`,
          data: {
            itemId: item.id, key: item.key, name: item.name, kind: item.kind, rarity: item.rarity,
            ...itemTypes(item), parts: item.parts.slice(), ...itemStats(item),
            equipped: item.equipped, source: data.source || "inventory"
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
        if (isWorn(item, s)) return item;

        if (item.kind === "weapon") {
          const previous = equippedWeapon(s);
          s.equippedWeaponId = item.id;
          item.equipped = true;
          if (previous) previous.equipped = false;
          emitEquipped(item, previous ? [previous.id] : [], depth);
          return item;
        }

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
          : equippedItems(s);
        const removed = targets.filter((item) => isWorn(item, s));
        if (!removed.length) return null;

        for (const item of removed) {
          if (item.kind === "weapon") {
            if (s.equippedWeaponId === item.id) s.equippedWeaponId = null;
          } else {
            for (const part of item.parts) if (s.equippedByPart[part] === item.id) delete s.equippedByPart[part];
          }
          item.equipped = false;
        }

        const total = totalArmor();
        const armorItems = removed.filter((item) => item.kind === "armor");
        const parts = [...new Set(armorItems.flatMap((item) => item.parts))];
        const single = removed.length === 1 ? removed[0] : null;
        engine.fire({
          type: "equipment:unequipped",
          text: `${single ? single.name : `${removed.length} items`} ${removed.length === 1 ? "is" : "are"} removed. Armor is now ${total}.`,
          data: {
            itemId: single ? single.id : null,
            itemIds: removed.map((item) => item.id),
            items: removed.map((item) => ({
              id: item.id, key: item.key, name: item.name, kind: item.kind, rarity: item.rarity,
              ...itemTypes(item), parts: item.parts.slice(), ...itemStats(item)
            })),
            key: single ? single.key : null,
            name: single ? single.name : `${removed.length} items`,
            kind: single ? single.kind : null,
            rarity: single ? single.rarity : null,
            weaponType: single && single.kind === "weapon" ? single.weaponType : null,
            armorType: single && single.kind === "armor" ? single.armorType : null,
            parts,
            armor: armorItems.reduce((sum, item) => sum + item.armor, 0),
            damage: single && single.kind === "weapon" ? single.damage : 0,
            strength: single && single.kind === "weapon" ? single.strength : 0,
            armorPiercing: single && single.kind === "weapon" ? single.armorPiercing : 0,
            totalArmor: total
          }
        }, depth);
        return single || removed;
      },

      // Destroy an item. A worn item is unequipped first so the armor bridge updates.
      remove(itemId, depth = 0) {
        const s = S();
        const id = typeof itemId === "string" ? itemId.trim() : "";
        const item = s.items[id];
        if (!item) return null;

        const wasEquipped = isWorn(item, s);
        if (wasEquipped) mod.unequip(id, depth);
        delete s.items[id];

        engine.fire({
          type: "equipment:removed",
          text: `${item.name} is destroyed.`,
          data: {
            itemId: id, key: item.key, name: item.name, kind: item.kind, rarity: item.rarity,
            ...itemTypes(item), wasEquipped, totalArmor: totalArmor()
          }
        }, depth + (wasEquipped ? 2 : 1));
        return item;
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
