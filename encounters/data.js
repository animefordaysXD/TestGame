/* Encounter content and tuning. This is data, not logic.
   Spawn bands are checked from the top down: the first band whose maxHostility is at or
   above the location's hostility sets the chance and enemy count. Relations fall as
   hostility rises, so dangerous places produce enemies that like the player less.
   Loot rarity bands do the same for gear: higher hostility rolls stronger ranks.
   Hostility 50 is the neutral point. Edited by editor.html. Keep the object below strict
   JSON (quoted keys, no comments, no trailing commas); put notes in this header instead. */
window.EncounterData = {
  "spawn": {
    "clearSource": "encounter",
    "maxPerVisit": 4,
    "bands": [
      { "key": "safe", "maxHostility": 24, "chancePercent": 5, "minCount": 1, "maxCount": 1 },
      { "key": "calm", "maxHostility": 39, "chancePercent": 15, "minCount": 1, "maxCount": 1 },
      { "key": "unsettled", "maxHostility": 54, "chancePercent": 30, "minCount": 1, "maxCount": 2 },
      { "key": "dangerous", "maxHostility": 74, "chancePercent": 50, "minCount": 1, "maxCount": 3 },
      { "key": "deadly", "maxHostility": 100, "chancePercent": 75, "minCount": 2, "maxCount": 4 }
    ]
  },
  "relations": {
    "type": "bandit",
    "base": -31,
    "perHostility": -0.69
  },
  "levels": { "hostilityPerLevel": 25 },
  "loot": {
    "dropChancePercent": 50,
    "chancePerHostility": 0.5,
    "maxDropChancePercent": 90,
    "kindWeights": [
      { "kind": "armor", "weight": 3 },
      { "kind": "weapon", "weight": 2 }
    ],
    "rarityBands": [
      { "key": "poor", "maxHostility": 29, "rarities": ["common"] },
      { "key": "common", "maxHostility": 49, "rarities": ["common", "uncommon"] },
      { "key": "unsettled", "maxHostility": 69, "rarities": ["uncommon", "rare"] },
      { "key": "dangerous", "maxHostility": 84, "rarities": ["rare", "legendary"] },
      { "key": "deadly", "maxHostility": 100, "rarities": ["legendary", "unique"] }
    ]
  }
};
