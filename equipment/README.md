# Equipment

The `equipment` module owns armor and weapons for the main character. It is v0.4.
Armor targets the ten body parts from `characters/bodyData.js`; weapons use one dedicated
weapon slot. Items also carry a weapon or armor type. NPCs do not equip yet.

## Files

- `equipment/data.js` — the catalogue, the five rarity ranks and the weapon/armor type
  lists. Every item has `kind` (`"armor"` or `"weapon"`), `rarity` and a type: armor has
  `armorType`, weapons have `weaponType`. Armor also has `parts` and `armor`; weapons have
  `damage`, `strength` and `armorPiercing`. Also `maxArmor` and the `autoEquip` flag.
  Edit this file to add or tune equipment.
- `equipment/equipment.js` — inventory, per-part armor and weapon-slot equip/unequip,
  type/rarity/kind filtered finds, item destruction and event emission.
- `test/equipment.test.cjs` — Node tests, including overlap replacement, summed armor,
  weapon slots, type filters, destruction, save migration and a real combat check.

## State slice

```js
equipment: {
  nextId: 1,
  items: {                       // item id -> item
    "eq_0001": {
      id: "eq_0001",
      key: "leather_cuirass",
      name: "Leather Cuirass",
      kind: "armor",
      rarity: "uncommon",
      armorType: "leather",
      parts: ["torso"],
      armor: 3,
      equipped: true,
      acquiredAtTick: 0,
      acquiredAt: "1000-01-01 06:00"
    },
    "eq_0002": {
      id: "eq_0002",
      key: "tempered_longsword",
      name: "Tempered Longsword",
      kind: "weapon",
      rarity: "uncommon",
      weaponType: "sword",
      parts: [],
      damage: 6,
      strength: 6,
      armorPiercing: 16,
      equipped: true,
      acquiredAtTick: 0,
      acquiredAt: "1000-01-01 06:00"
    }
  },
  equippedByPart: {              // body part key -> armor item id
    torso: "eq_0001"
  },
  equippedWeaponId: "eq_0002"    // one weapon slot, or null
}
```

Armor items target one or more body parts. An armor item is worn as one piece, so two
worn armor items may not share a part. Equipping an armor item replaces every item that
overlaps one of its parts; the replaced items stay in the inventory. Parts with no item
are uncovered.

`equipped` is a convenience flag: it is true when an armor item covers at least one worn
part, or when the item is the equipped weapon. `equippedByPart` is the source of truth for
armor, and `equippedWeaponId` is the source of truth for the weapon.

## Types

`equipment/data.js` lists the type keys, so content can add a new family without changing
module code:

| weapons (`weaponType`) | armor (`armorType`) |
|---|---|
| `sword`, `spear`, `axe`, `mace` | `cloth`, `leather`, `mail`, `plate`, `scale` |

Every item must use a type from the matching list. A missing or unknown type falls back to
the catalogue definition and then to the first defined type when a save is loaded. Types are
descriptive today: combat still uses the numeric stats, not the family.

## Rarity

`equipment/data.js` lists `rarities` weakest first:

| key | label | rank |
|---|---|---|
| `common` | Common | 1 |
| `uncommon` | Uncommon | 2 |
| `rare` | Rare | 3 |
| `legendary` | Legendary | 4 |
| `unique` | Unique | 5 |

Each rank defines stat bands (`armor`, `damage`, `strength`, `armorPiercing`) that are
strictly stronger than the previous rank. The content editor checks item values against
their rank's bands. A missing or unknown rarity falls back to `common` when a save is
loaded.

## Armor and weapons

Total armor is the sum of the armor values of all distinct worn armor items, clamped to
`maxArmor`. A newly acquired item auto-equips when its slot is free: every part it covers
is free for armor, or the weapon slot is empty for a weapon. Otherwise it stays in the
inventory.

A weapon contributes `damage` and `armorPiercing` to combat only while the wielder's
Strength meets `strength`. Combat builds the snapshot from `equippedWeapon()`; this module
never reads a character's stats.

## Events

| type | direction | data |
|---|---|---|
| `equipment:add` | request (UI, test, future events) | `{ key?, kind?, rarity?, weaponType?, armorType? }` — omit the key to pick randomly with `engine.rng`, optionally filtered |
| `equipment:equip` | request (UI) | `{ itemId }` |
| `equipment:unequip` | request (UI) | `{ itemId? }` — omit the id to clear every worn item and the weapon |
| `equipment:remove` | request (UI, future events/mobs) | `{ itemId }` — destroys the item; a worn item is unequipped first |
| `equipment:added` | module | `{ itemId, key, name, kind, rarity, weaponType?, armorType?, parts, armor?, damage?, strength?, armorPiercing?, equipped, source }` |
| `equipment:equipped` | module | `{ itemId, key, name, kind, rarity, weaponType?, armorType?, parts, ...stats, totalArmor, replacedItemIds }` |
| `equipment:unequipped` | module | `{ itemId, itemIds, items, key, name, kind, rarity, weaponType?, armorType?, parts, armor, totalArmor }` |
| `equipment:removed` | module | `{ itemId, key, name, kind, rarity, weaponType?, armorType?, wasEquipped, totalArmor }` |

For a multi-item unequip, `itemId` and `key` are null, `name` is `"<n> items"`, and
`items` lists what was removed. The module also listens to `action:resolved`: when an
outcome names an `equipmentKey`, the item is added (and auto-equipped when its slot is
free) without the actions module calling it.

## Armor bridge

The module never writes another module's slice. The `mainCharacter` module listens to
`equipment:equipped` / `equipment:unequipped`, clamps the announced `totalArmor` to
0-100, writes `character.stats.armor` and emits `mainCharacter:armorChanged`.
Weapon equip/unequip events carry the unchanged `totalArmor`, so they do not change the
armor stat.

Combat reads that armor stat. Every hit loses `effectiveArmor * armorMultiplier`, where
`effectiveArmor` is the armor left after the attacker's weapon piercing and
`armorMultiplier` is 1 normally or 2 while defending. See `combat/README.md`.

## Save migration

v0.4 loads older saves. The v0.1 single `equippedId` is removed and its item is assigned
to every part it covers; legacy items that only have `slot: "body"` take their
definition's `parts` from `equipment/data.js`. Missing types take the catalogue definition.
Conflicting flagged items are assigned in id order, and the rest stay in the inventory. A
missing `equippedWeaponId` becomes `null`; a flagged weapon fills it when the slot is free.

## UI

The **Equipment** panel shows total armor, covered parts, the weapon slot, every inventory
item's type, rarity and stats, and per-item **Equip** / **Unequip** / **Destroy** buttons.
**Find armor** and **Find weapon** add a random item of that kind (they need a saved main
character). **Unequip all** clears the loadout. A weapon above the character's Strength
cannot be equipped from the UI.

## Limitations

- Main character only; NPCs keep armor 0 and carry no weapon.
- No jewellery, shields, two-handed rules or item durability.
- Items are atomic: an overlapping item is removed whole rather than partially.
- Armor is mirrored into the main character present when the item is equipped. Save the
  main character first (the UI disables finds until you do).
- Location events cannot change armor; only equipment does.
- Rarity and type only affect grouping, labels and find filters today; stats still drive
  combat. Events, loot tables and mobs can already request a filtered random item or
  destroy one, but no content uses those hooks yet.
