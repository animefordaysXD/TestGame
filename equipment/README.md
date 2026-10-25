# Equipment

The `equipment` module owns armor items for the main character. It is v0.1 and has one
body slot; NPCs do not equip yet.

## Files

- `equipment/data.js` — the armor catalogue (`key`, `name`, `slot`, `armor`, `weight`),
  `maxArmor` and the `autoEquip` flag. Edit this file to add or tune armor.
- `equipment/equipment.js` — inventory, equip/unequip flow and event emission.
- `test/equipment.test.cjs` — Node tests, including a real combat/Defend check.

## State slice

```js
equipment: {
  nextId: 1,
  items: {                       // item id -> item
    "eq_0001": {
      id: "eq_0001",
      key: "leather_cuirass",
      name: "Leather Cuirass",
      slot: "body",
      armor: 3,
      equipped: true,
      acquiredAtTick: 0,
      acquiredAt: "1000-01-01 06:00"
    }
  },
  equippedId: "eq_0001"          // one body item, or null
}
```

The first item acquired is equipped automatically when nothing is worn (`autoEquip`).
Only one item can be equipped; equipping another item swaps it.

## Events

| type | direction | data |
|---|---|---|
| `equipment:add` | request (UI, test) | `{ key? }` — omit the key to pick randomly with `engine.rng` |
| `equipment:equip` | request (UI) | `{ itemId }` |
| `equipment:unequip` | request (UI) | none |
| `equipment:added` | module | `{ itemId, key, name, slot, armor, equipped, source }` |
| `equipment:equipped` | module | `{ itemId, key, name, slot, armor, totalArmor, previousItemId }` |
| `equipment:unequipped` | module | `{ itemId, key, name, armor, totalArmor: 0 }` |

The module also listens to `action:resolved`: when an outcome names an `equipmentKey`,
the item is added (and auto-equipped if free) without the actions module calling it.

## Armor bridge

The module never writes another module's slice. The `mainCharacter` module listens to
`equipment:equipped` / `equipment:unequipped`, clamps the announced `totalArmor` to
0-100, writes `character.stats.armor` and emits `mainCharacter:armorChanged`.

Combat's Defend action reads that stat:

```text
incoming damage = max(0, damage - armor * CombatData.defend.armorMultiplier)
```

With the default multiplier of 2, 3 armor blocks 6 damage. Keep catalogue values small.

## UI

The **Equipment** panel shows the inventory, the equipped item and the current armor.
**Find armor** adds a random catalogue item (it needs a saved main character). Each item
has **Equip** or **Unequip**.

## Limitations

- Main character only; NPCs keep armor 0.
- One body slot; no weapons, jewellery or item durability.
- Armor is mirrored into the main character present when the item is equipped. Save the
  main character first (the UI disables **Find armor** until you do).
- Location events cannot change armor; only equipment does.
