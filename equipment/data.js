/* Armor catalogue for the equipment module. This is data, not logic.
   Items are armor pieces; `armor` is the value written into the wearer's
   `stats.armor`, and combat's Defend action reduces incoming damage by
   armor x CombatData.defend.armorMultiplier. Keep the numbers small: a value of
   3 already blocks 6 damage. `weight` only affects the random "Find armor" pick.
   Actions can award an item by referencing its `key` from actions/data.js. */
window.EquipmentData = {
  slots: ["body"],

  items: [
    {
      key: "traveler_cloak", name: "Traveler's Cloak", slot: "body", armor: 1, weight: 5,
      description: "A weather-stained cloak. Barely armor, but better than nothing."
    },
    {
      key: "scavenged_leather", name: "Scavenged Leather", slot: "body", armor: 1, weight: 3,
      description: "Strips of hardened leather lashed together."
    },
    {
      key: "padded_gambeson", name: "Padded Gambeson", slot: "body", armor: 2, weight: 4,
      description: "Quilted cloth that takes the sting out of a blow."
    },
    {
      key: "leather_cuirass", name: "Leather Cuirass", slot: "body", armor: 3, weight: 3,
      description: "Boiled leather shaped to the chest and shoulders."
    },
    {
      key: "chain_shirt", name: "Chain Shirt", slot: "body", armor: 4, weight: 2,
      description: "Heavy mail. Slow to don, but it turns a blade."
    },
    {
      key: "iron_plate", name: "Iron Plate", slot: "body", armor: 5, weight: 1,
      description: "A full breastplate. Expensive, loud, and effective."
    }
  ],

  maxArmor: 100,

  // A newly acquired item is equipped automatically when nothing is worn.
  autoEquip: true
};
