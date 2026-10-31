/* Equipment catalogue for the equipment module. This is data, not logic.
   Every item has a `kind`:
   - "armor" targets one or more body parts from characters/bodyData.js. Its `armor` is
     added together for all worn armor and written into the wearer's `stats.armor`.
     Combat reduces incoming damage by that armor and Defend doubles the reduction.
   - "weapon" occupies the single weapon slot. It has `damage`, a `strength`
     requirement and `armorPiercing` (0-100). Combat adds `damage` to the owner's
     attack and ignores that percentage of the target's armor. A weapon only works
     when the owner's Strength meets the requirement.
   `rarity` must be one of `rarities` below. The ranges in that block are the stat
   bands for each rank; higher ranks are strictly stronger. The catalogue values must
   stay inside their band (the content editor checks this).
   `weight` only affects the random Find equipment pick. Actions can award an item by
   referencing its `key` from actions/data.js. `autoEquip` puts a newly acquired item
   on when its slot is free; a conflicting item stays in the inventory.
   Rarity-filtered random picks and item destruction are available through
   `equipment:add { rarity? }` and `equipment:remove { itemId }` for future events/mobs.
   Edited by editor.html. Keep the object below strict JSON (quoted keys, no comments, no
   trailing commas); put notes in this header instead. */
window.EquipmentData = {
  "rarities": [
    {
      "key": "common",
      "label": "Common",
      "rank": 1,
      "armor": [1, 2],
      "damage": [2, 4],
      "strength": [3, 5],
      "armorPiercing": [0, 10]
    },
    {
      "key": "uncommon",
      "label": "Uncommon",
      "rank": 2,
      "armor": [3, 4],
      "damage": [5, 7],
      "strength": [5, 7],
      "armorPiercing": [11, 20]
    },
    {
      "key": "rare",
      "label": "Rare",
      "rank": 3,
      "armor": [5, 6],
      "damage": [8, 10],
      "strength": [7, 9],
      "armorPiercing": [21, 30]
    },
    {
      "key": "legendary",
      "label": "Legendary",
      "rank": 4,
      "armor": [7, 8],
      "damage": [11, 14],
      "strength": [9, 11],
      "armorPiercing": [31, 40]
    },
    {
      "key": "unique",
      "label": "Unique",
      "rank": 5,
      "armor": [9, 10],
      "damage": [15, 20],
      "strength": [11, 15],
      "armorPiercing": [41, 50]
    }
  ],
  "items": [
    {
      "key": "traveler_cloak",
      "name": "Traveler's Cloak",
      "kind": "armor",
      "rarity": "common",
      "parts": ["torso", "leftArm", "rightArm"],
      "armor": 1,
      "weight": 5,
      "description": "A weather-stained cloak. Barely armor, but better than nothing."
    },
    {
      "key": "scavenged_leather",
      "name": "Scavenged Leather",
      "kind": "armor",
      "rarity": "common",
      "parts": ["torso"],
      "armor": 1,
      "weight": 3,
      "description": "Strips of hardened leather lashed together."
    },
    {
      "key": "padded_gambeson",
      "name": "Padded Gambeson",
      "kind": "armor",
      "rarity": "common",
      "parts": ["torso", "leftArm", "rightArm"],
      "armor": 2,
      "weight": 4,
      "description": "Quilted cloth that takes the sting out of a blow."
    },
    {
      "key": "leather_cuirass",
      "name": "Leather Cuirass",
      "kind": "armor",
      "rarity": "uncommon",
      "parts": ["torso"],
      "armor": 3,
      "weight": 3,
      "description": "Boiled leather shaped to the chest and shoulders."
    },
    {
      "key": "chain_shirt",
      "name": "Chain Shirt",
      "kind": "armor",
      "rarity": "uncommon",
      "parts": ["torso", "leftArm", "rightArm"],
      "armor": 4,
      "weight": 2,
      "description": "Heavy mail. Slow to don, but it turns a blade."
    },
    {
      "key": "iron_plate",
      "name": "Iron Plate",
      "kind": "armor",
      "rarity": "rare",
      "parts": ["torso"],
      "armor": 5,
      "weight": 1,
      "description": "A full breastplate. Expensive, loud, and effective."
    },
    {
      "key": "leather_cap",
      "name": "Leather Cap",
      "kind": "armor",
      "rarity": "common",
      "parts": ["head"],
      "armor": 1,
      "weight": 4,
      "description": "A fitted cap. It will not stop a hammer, but it softens a branch."
    },
    {
      "key": "iron_helm",
      "name": "Iron Helm",
      "kind": "armor",
      "rarity": "common",
      "parts": ["head"],
      "armor": 2,
      "weight": 2,
      "description": "A dented helmet with a padded lining."
    },
    {
      "key": "leather_bracers",
      "name": "Leather Bracers",
      "kind": "armor",
      "rarity": "common",
      "parts": ["leftArm", "rightArm"],
      "armor": 1,
      "weight": 3,
      "description": "Wide cuffs that guard the forearms from a grazing blow."
    },
    {
      "key": "leather_greaves",
      "name": "Leather Greaves",
      "kind": "armor",
      "rarity": "common",
      "parts": ["leftLeg", "rightLeg"],
      "armor": 2,
      "weight": 3,
      "description": "Thick leggings strapped over the shins."
    },
    {
      "key": "traveler_boots",
      "name": "Traveler's Boots",
      "kind": "armor",
      "rarity": "common",
      "parts": ["leftFoot", "rightFoot"],
      "armor": 1,
      "weight": 4,
      "description": "Scuffed boots with reinforced toes."
    },
    {
      "key": "work_gloves",
      "name": "Work Gloves",
      "kind": "armor",
      "rarity": "common",
      "parts": ["leftHand", "rightHand"],
      "armor": 1,
      "weight": 3,
      "description": "Stiff leather gloves. Good for rope, thorns and broken glass."
    },
    {
      "key": "dwarven_hauberk",
      "name": "Dwarven Hauberk",
      "kind": "armor",
      "rarity": "rare",
      "parts": ["torso", "leftArm", "rightArm"],
      "armor": 6,
      "weight": 1,
      "description": "Close-woven mail from a mountain forge, heavy enough to turn a spear."
    },
    {
      "key": "dragonscale_cuirass",
      "name": "Dragonscale Cuirass",
      "kind": "armor",
      "rarity": "legendary",
      "parts": ["torso"],
      "armor": 8,
      "weight": 0.5,
      "description": "Overlapping scales that shed heat and steel alike."
    },
    {
      "key": "aegis_first_king",
      "name": "Aegis of the First King",
      "kind": "armor",
      "rarity": "unique",
      "parts": ["torso", "leftArm", "rightArm"],
      "armor": 10,
      "weight": 0.2,
      "description": "A relic breastplate. No smith alive can copy the work."
    },
    {
      "key": "iron_shortsword",
      "name": "Iron Shortsword",
      "kind": "weapon",
      "rarity": "common",
      "damage": 3,
      "strength": 4,
      "armorPiercing": 6,
      "weight": 5,
      "description": "A plain soldier's blade. Quick and unremarkable."
    },
    {
      "key": "tempered_longsword",
      "name": "Tempered Longsword",
      "kind": "weapon",
      "rarity": "uncommon",
      "damage": 6,
      "strength": 6,
      "armorPiercing": 16,
      "weight": 3,
      "description": "A well-balanced blade with a hardened edge."
    },
    {
      "key": "knights_broadsword",
      "name": "Knight's Broadsword",
      "kind": "weapon",
      "rarity": "rare",
      "damage": 9,
      "strength": 8,
      "armorPiercing": 26,
      "weight": 1.5,
      "description": "A knight's sidearm, wide enough to split mail rings."
    },
    {
      "key": "dawnblade",
      "name": "Dawnblade",
      "kind": "weapon",
      "rarity": "legendary",
      "damage": 13,
      "strength": 10,
      "armorPiercing": 36,
      "weight": 0.5,
      "description": "Its edge catches the first light and keeps it."
    },
    {
      "key": "kings_oath",
      "name": "King's Oath",
      "kind": "weapon",
      "rarity": "unique",
      "damage": 18,
      "strength": 13,
      "armorPiercing": 46,
      "weight": 0.1,
      "description": "A coronation sword that has never been drawn in anger without cause."
    },
    {
      "key": "ashwood_spear",
      "name": "Ashwood Spear",
      "kind": "weapon",
      "rarity": "common",
      "damage": 3,
      "strength": 5,
      "armorPiercing": 9,
      "weight": 5,
      "description": "A long ash shaft with a simple iron point."
    },
    {
      "key": "boar_spear",
      "name": "Boar Spear",
      "kind": "weapon",
      "rarity": "uncommon",
      "damage": 6,
      "strength": 7,
      "armorPiercing": 20,
      "weight": 3,
      "description": "A broad hunting point with a crossguard to stop a charge."
    },
    {
      "key": "war_pike",
      "name": "War Pike",
      "kind": "weapon",
      "rarity": "rare",
      "damage": 9,
      "strength": 9,
      "armorPiercing": 30,
      "weight": 1.5,
      "description": "A formation weapon with a narrow head made to find gaps."
    },
    {
      "key": "stormlance",
      "name": "Stormlance",
      "kind": "weapon",
      "rarity": "legendary",
      "damage": 12,
      "strength": 11,
      "armorPiercing": 40,
      "weight": 0.5,
      "description": "A lance that hums before a storm. Its point never seems to dull."
    },
    {
      "key": "wyrmpiercer",
      "name": "Wyrmpiercer",
      "kind": "weapon",
      "rarity": "unique",
      "damage": 17,
      "strength": 14,
      "armorPiercing": 50,
      "weight": 0.1,
      "description": "A spear built around a single tooth. It goes through scale like cloth."
    },
    {
      "key": "wooden_club",
      "name": "Wooden Club",
      "kind": "weapon",
      "rarity": "common",
      "damage": 4,
      "strength": 4,
      "armorPiercing": 3,
      "weight": 5,
      "description": "A heavy branch with a knotted head. Crude, but it works."
    },
    {
      "key": "iron_mace",
      "name": "Iron Mace",
      "kind": "weapon",
      "rarity": "uncommon",
      "damage": 7,
      "strength": 7,
      "armorPiercing": 12,
      "weight": 3,
      "description": "A weighted head on a short haft. Armor does not stop the shock."
    },
    {
      "key": "warhammer",
      "name": "Warhammer",
      "kind": "weapon",
      "rarity": "rare",
      "damage": 10,
      "strength": 9,
      "armorPiercing": 22,
      "weight": 1.5,
      "description": "A soldier's hammer with a spike on the reverse."
    },
    {
      "key": "skullbreaker",
      "name": "Skullbreaker",
      "kind": "weapon",
      "rarity": "legendary",
      "damage": 14,
      "strength": 11,
      "armorPiercing": 32,
      "weight": 0.5,
      "description": "A blackened maul that has ended more duels than it has started."
    },
    {
      "key": "worldender",
      "name": "Worldender",
      "kind": "weapon",
      "rarity": "unique",
      "damage": 20,
      "strength": 15,
      "armorPiercing": 42,
      "weight": 0.1,
      "description": "A maul of impossible weight. The stories say it broke a mountain."
    }
  ],
  "maxArmor": 100,
  "autoEquip": true
};
