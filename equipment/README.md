# Equipment

The `equipment` module owns armor items for the main character. It is v0.2 and targets
the ten body parts from `characters/bodyData.js`; NPCs do not equip yet.

## Files

- `equipment/data.js` — the armor catalogue (`key`, `name`, `parts`, `armor`, `weight`),
  `maxArmor` and the `autoEquip` flag. Edit this file to add or tune armor.
- `equipment/equipment.js` — inventory, per-part equip/unequip flow and event emission.
- `test/equipment.test.cjs` — Node tests, including overlap replacement, summed armor,
  save migration and a real combat/Defend check.

## State slice

```js
equipment: {
  nextId: 1,
  items: {                       // item id -> item
    "eq_0001": {
      id: "eq_0001",
      key: "leather_cuirass",
      name: "Leather Cuirass",
      parts: ["torso"],
      armor: 3,
      equipped: true,
      acquiredAtTick: 0,
      acquiredAt: "1000-01-01 06:00"
    }
  },
  equippedByPart: {              // body part key -> item id
    torso: "eq_0001"
  }
}
```

Every item targets one or more body parts. An item is worn as one piece, so two worn
items may not share a part. Equipping an item replaces every item that overlaps one of
its parts; the replaced items stay in the inventory. Parts with no item are uncovered.

`equipped` is a convenience flag: it is true when at least one part maps to that item.
`equippedByPart` is the source of truth for what is worn.

## Armor

Total armor is the sum of the armor values of all distinct worn items, clamped to
`maxArmor`. The first item acquired is equipped automatically when every part it covers
is free (`autoEquip`); otherwise it stays in the inventory. A later free item can join
the current loadout.

## Events

| type | direction | data |
|---|---|---|
| `equipment:add` | request (UI, test) | `{ key? }` — omit the key to pick randomly with `engine.rng` |
| `equipment:equip` | request (UI) | `{ itemId }` |
| `equipment:unequip` | request (UI) | `{ itemId? }` — omit the id to clear every worn item |
| `equipment:added` | module | `{ itemId, key, name, parts, armor, equipped, source }` |
| `equipment:equipped` | module | `{ itemId, key, name, parts, armor, totalArmor, replacedItemIds }` |
| `equipment:unequipped` | module | `{ itemId, itemIds, items, key, name, parts, armor, totalArmor }` |

For a multi-item unequip, `itemId` and `key` are null, `name` is `"<n> items"`, and
`items` lists what was removed. The module also listens to `action:resolved`: when an
outcome names an `equipmentKey`, the item is added (and auto-equipped when its parts are
free) without the actions module calling it.

## Armor bridge

The module never writes another module's slice. The `mainCharacter` module listens to
`equipment:equipped` / `equipment:unequipped`, clamps the announced `totalArmor` to
0-100, writes `character.stats.armor` and emits `mainCharacter:armorChanged`.

Combat's Defend action reads that stat:

```text
incoming damage = max(0, damage - armor * CombatData.defend.armorMultiplier)
```

With the default multiplier of 2, 3 armor blocks 6 damage. Keep catalogue values small.

## Save migration

v0.2 still loads a v0.1 save. The old single `equippedId` is removed and its item is
assigned to every part it covers; legacy items that only have `slot: "body"` take their
definition's `parts` from `equipment/data.js`. Conflicting flagged items are assigned in
id order, and the rest stay in the inventory.

## UI

The **Equipment** panel shows total armor, covered parts, every inventory item's body
parts and per-item **Equip** / **Unequip** buttons. **Find armor** adds a random catalogue
item (it needs a saved main character). **Unequip all** clears the loadout.

## Limitations

- Main character only; NPCs keep armor 0.
- Armor only; no weapons, jewellery or item durability.
- Items are atomic: an overlapping item is removed whole rather than partially.
- Armor is mirrored into the main character present when the item is equipped. Save the
  main character first (the UI disables **Find armor** until you do).
- Location events cannot change armor; only equipment does.
