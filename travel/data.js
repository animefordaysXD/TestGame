/* Travel content and tuning. This is data, not logic.
   Travel advances in `minutesPerCheck` (default 5) chunks. After each chunk the travel
   module rolls once: `chancePercent` is the chance of an interruption per check, and
   `chanceByBiome` can override it for the destination biome. When a check succeeds, one
   enabled event is picked by `weight`, travel pauses, and the mainCharacter module
   applies its `effects`. The player resumes with the Continue travel button.

   Event shape:
     { id, name, text, weight, enabled, effects: [{ stat, delta }] }
   Stat keys come from characters/statsData.js. Armor is ignored (equipment owns it).
   Positive events pause travel too; set `enabled: false` to keep a template without
   rolling it. */
window.TravelData = {
  minutesPerCheck: 5,
  chancePercent: 8,

  // Optional per-biome override for the chance of an interruption per check.
  chanceByBiome: {
    grassland: 6, forest: 7, hills: 7, coast: 7,
    desert: 9, mountains: 10, swamp: 9, tundra: 10, jungle: 10, wasteland: 10
  },

  events: [
    {
      id: "rough_ground", name: "Rough ground", weight: 3, enabled: true,
      text: "The trail turns to broken stone and you lose your footing more than once.",
      effects: [{ stat: "stamina", delta: -5 }]
    },
    {
      id: "cold_rain", name: "Cold rain", weight: 2, enabled: true,
      text: "A cold rain settles in. By the time it passes you are soaked and shivering.",
      effects: [{ stat: "stamina", delta: -4 }, { stat: "hp", delta: -2 }]
    },
    {
      id: "game_trail", name: "A game trail", weight: 2, enabled: true,
      text: "You find a clean game trail that cuts a long bend out of the road.",
      effects: [{ stat: "stamina", delta: 4 }]
    },
    {
      id: "wayside_shrine", name: "A wayside shrine", weight: 1, enabled: true,
      text: "A small shrine stands beside the road. You leave an offering and steady yourself.",
      effects: [{ stat: "mana", delta: 5 }]
    },
    {
      id: "turned_ankle", name: "A turned ankle", weight: 1, enabled: true,
      text: "A loose stone rolls under your boot. You hobble on, bruised.",
      effects: [{ stat: "hp", delta: -4 }]
    },
    {
      id: "friendly_trader", name: "A friendly trader", weight: 2, enabled: true,
      text: "A trader heading the other way shares water and news before moving on.",
      effects: [{ stat: "stamina", delta: 5 }, { stat: "mana", delta: 2 }]
    }
  ]
};
