/* Area action content. Edit freely: this is data, not logic.
   The default list must contain at least five actions. Optional per-biome overrides
   can be added under biomes using the biomeKey; each override should contain five.
   Actions are placeholders for now: choosing one only logs an event. */
window.LocationActionsData = {
  default: [
    {
      id: "scout", name: "Scout",
      description: "Survey the area for landmarks and danger."
    },
    {
      id: "scavenge", name: "Scavenge",
      description: "Search for supplies, tracks, or useful details."
    },
    {
      id: "rest", name: "Rest",
      description: "Catch your breath and recover."
    },
    {
      id: "hunt", name: "Hunt",
      description: "Look for game or other food."
    },
    {
      id: "travel", name: "Travel",
      description: "Leave this area and choose another location."
    }
  ],

  // Optional per-biome overrides. Example:
  // tundra: [
  //   { id: "tundra_shelter", name: "Build shelter", description: "..." },
  //   { id: "tundra_firewood", name: "Gather firewood", description: "..." },
  //   { id: "tundra_tracks", name: "Read the tracks", description: "..." },
  //   { id: "tundra_rest", name: "Warm up", description: "..." },
  //   { id: "tundra_leave", name: "Move on", description: "..." }
  // ]
  biomes: {}
};
