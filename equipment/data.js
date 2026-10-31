/* Armor catalogue for the equipment module. This is data, not logic.
   Every item targets one or more body parts from characters/bodyData.js; `armor` is
   added together for all worn items and written into the wearer's `stats.armor`.
   Combat's Defend action reduces incoming damage by armor x
   CombatData.defend.armorMultiplier. Keep the numbers small: a value of 3 already
   blocks 6 damage. `weight` only affects the random "Find armor" pick. Actions can
   award an item by referencing its `key` from actions/data.js.
   autoEquip: a newly acquired item is equipped automatically when every part it
   covers is free. A conflicting item stays in the inventory.
   Edited by editor.html. Keep the object below strict JSON (quoted keys, no comments, no
   trailing commas); put notes in this header instead. */
window.EquipmentData = {
  "items": [
    {
      "key": "traveler_cloak",
      "name": "Traveler's Cloak",
      "parts": ["torso", "leftArm", "rightArm"],
      "armor": 1,
      "weight": 5,
      "description": "A weather-stained cloak. Barely armor, but better than nothing."
    },
    {
      "key": "scavenged_leather",
      "name": "Scavenged Leather",
      "parts": ["torso"],
      "armor": 1,
      "weight": 3,
      "description": "Strips of hardened leather lashed together."
    },
    {
      "key": "padded_gambeson",
      "name": "Padded Gambeson",
      "parts": ["torso", "leftArm", "rightArm"],
      "armor": 2,
      "weight": 4,
      "description": "Quilted cloth that takes the sting out of a blow."
    },
    {
      "key": "leather_cuirass",
      "name": "Leather Cuirass",
      "parts": ["torso"],
      "armor": 3,
      "weight": 3,
      "description": "Boiled leather shaped to the chest and shoulders."
    },
    {
      "key": "chain_shirt",
      "name": "Chain Shirt",
      "parts": ["torso", "leftArm", "rightArm"],
      "armor": 4,
      "weight": 2,
      "description": "Heavy mail. Slow to don, but it turns a blade."
    },
    {
      "key": "iron_plate",
      "name": "Iron Plate",
      "parts": ["torso"],
      "armor": 5,
      "weight": 1,
      "description": "A full breastplate. Expensive, loud, and effective."
    },
    {
      "key": "leather_cap",
      "name": "Leather Cap",
      "parts": ["head"],
      "armor": 1,
      "weight": 4,
      "description": "A fitted cap. It will not stop a hammer, but it softens a branch."
    },
    {
      "key": "iron_helm",
      "name": "Iron Helm",
      "parts": ["head"],
      "armor": 2,
      "weight": 2,
      "description": "A dented helmet with a padded lining."
    },
    {
      "key": "leather_bracers",
      "name": "Leather Bracers",
      "parts": ["leftArm", "rightArm"],
      "armor": 1,
      "weight": 3,
      "description": "Wide cuffs that guard the forearms from a grazing blow."
    },
    {
      "key": "leather_greaves",
      "name": "Leather Greaves",
      "parts": ["leftLeg", "rightLeg"],
      "armor": 2,
      "weight": 3,
      "description": "Thick leggings strapped over the shins."
    },
    {
      "key": "traveler_boots",
      "name": "Traveler's Boots",
      "parts": ["leftFoot", "rightFoot"],
      "armor": 1,
      "weight": 4,
      "description": "Scuffed boots with reinforced toes."
    },
    {
      "key": "work_gloves",
      "name": "Work Gloves",
      "parts": ["leftHand", "rightHand"],
      "armor": 1,
      "weight": 3,
      "description": "Stiff leather gloves. Good for rope, thorns and broken glass."
    }
  ],
  "maxArmor": 100,
  "autoEquip": true
};
