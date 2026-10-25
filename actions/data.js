/* Area action content. This is data, not logic; edits here change behaviour without
   touching actions.js.
   The default list must contain at least five actions. Optional per-biome overrides
   can be added under biomes using the biomeKey; each override should contain five.
   Action shape:
     { id, name, description, timeMinutes, costs[], outcomes[], requiresDestination? }
   - costs/outcome effects use the shared { stat, delta } shape from
     characters/statsData.js; the mainCharacter module applies them.
   - one outcome is picked per choice, weighted by `weight` (default 1) with engine.rng.
   - an outcome may name an equipment catalogue key in `equipmentKey`; the equipment
     module adds that item through action:resolved.
   - requiresDestination marks Travel-like actions. The UI supplies a destination and
     then visits it through the locations module. */
window.LocationActionsData = {
  default: [
    {
      id: "scout", name: "Scout",
      description: "Survey the area for landmarks and danger.",
      timeMinutes: 30,
      costs: [{ stat: "stamina", delta: -5 }],
      outcomes: [
        {
          id: "scout_landmarks", name: "Useful landmarks", weight: 2,
          text: "You map the ground and commit the landmarks to memory.",
          effects: [{ stat: "intelligence", delta: 1 }]
        },
        {
          id: "scout_tracks", name: "Tracks in the ground", weight: 2,
          text: "Old tracks reveal who has passed this way.",
          effects: [{ stat: "intrigue", delta: 1 }]
        },
        {
          id: "scout_nothing", name: "Nothing new", weight: 3,
          text: "The area holds no surprises today.",
          effects: []
        }
      ]
    },
    {
      id: "scavenge", name: "Scavenge",
      description: "Search for supplies, tracks, or useful details.",
      timeMinutes: 30,
      costs: [{ stat: "stamina", delta: -5 }],
      outcomes: [
        {
          id: "scavenge_waterskin", name: "A waterskin", weight: 2,
          text: "You find a mostly full waterskin in the brush.",
          effects: [{ stat: "stamina", delta: 5 }]
        },
        {
          id: "scavenge_armor", name: "Usable armor", weight: 1,
          text: "You strip a bundle of hardened leather from a wreck.",
          effects: [],
          equipmentKey: "scavenged_leather"
        },
        {
          id: "scavenge_nothing", name: "Nothing useful", weight: 3,
          text: "You turn over the same stones and find nothing worth carrying.",
          effects: []
        }
      ]
    },
    {
      id: "rest", name: "Rest",
      description: "Catch your breath and recover.",
      timeMinutes: 60,
      costs: [],
      outcomes: [
        {
          id: "rest_deep", name: "A deep rest", weight: 1,
          text: "You find a quiet corner and recover properly.",
          effects: [{ stat: "stamina", delta: 20 }, { stat: "hp", delta: 5 }]
        },
        {
          id: "rest_light", name: "A short rest", weight: 2,
          text: "You sit for a while and recover some strength.",
          effects: [{ stat: "stamina", delta: 10 }]
        }
      ]
    },
    {
      id: "hunt", name: "Hunt",
      description: "Look for game or other food.",
      timeMinutes: 60,
      costs: [{ stat: "stamina", delta: -10 }],
      outcomes: [
        {
          id: "hunt_game", name: "Game", weight: 2,
          text: "You bring down small game and make a meal of it.",
          effects: [{ stat: "hp", delta: 5 }]
        },
        {
          id: "hunt_nothing", name: "No game", weight: 2,
          text: "The animals keep their distance and you return empty-handed.",
          effects: []
        },
        {
          id: "hunt_injured", name: "A bad fall", weight: 1,
          text: "You slip on broken ground and come back bruised.",
          effects: [{ stat: "hp", delta: -8 }]
        }
      ]
    },
    {
      id: "travel", name: "Travel",
      description: "Leave this area and choose another location.",
      timeMinutes: 30,
      costs: [{ stat: "stamina", delta: -5 }],
      outcomes: [],
      requiresDestination: true,
      travelText: "You break camp and set out for another location."
    }
  ],

  // Optional per-biome overrides. Example:
  // tundra: [
  //   { id: "tundra_shelter", name: "Build shelter", description: "...", timeMinutes: 60,
  //     costs: [{ stat: "stamina", delta: -10 }],
  //     outcomes: [{ id: "shelter_ok", name: "Shelter", text: "...", weight: 1, effects: [] }] },
  //   { id: "tundra_firewood", name: "Gather firewood", description: "..." },
  //   { id: "tundra_tracks", name: "Read the tracks", description: "..." },
  //   { id: "tundra_rest", name: "Warm up", description: "..." },
  //   { id: "tundra_leave", name: "Move on", description: "..." }
  // ]
  biomes: {}
};
