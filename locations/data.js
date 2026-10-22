/* Location content tables. Edit freely: this is data, not logic.
   To add a biome, copy an entry: key/name must be unique, weather and nouns are lists,
   hostility is [min, max] within 1-100. weight controls how often it is chosen. */
window.LocationData = {
  biomes: [
    {
      key: "forest", name: "Forest", weight: 3, hostility: [10, 55],
      weather: ["Clear", "Light rain", "Mist", "Heavy rain", "Thunderstorm", "Cool breeze"],
      nouns: ["Wood", "Thicket", "Grove", "Glade", "Hollow", "Copse"]
    },
    {
      key: "grassland", name: "Grassland", weight: 3, hostility: [5, 45],
      weather: ["Clear", "Sunny", "Windy", "Light rain", "Overcast", "Dew"],
      nouns: ["Plain", "Meadow", "Prairie", "Downs", "Field", "Basin"]
    },
    {
      key: "hills", name: "Hills", weight: 2, hostility: [15, 60],
      weather: ["Clear", "Windy", "Overcast", "Light rain", "Fog"],
      nouns: ["Ridge", "Downs", "Rise", "Knoll", "Vale", "Heights"]
    },
    {
      key: "coast", name: "Coast", weight: 2, hostility: [10, 55],
      weather: ["Clear", "Sea breeze", "Rain", "Storm", "Mist"],
      nouns: ["Bay", "Shore", "Cove", "Strand", "Cliffs", "Harbor"]
    },
    {
      key: "desert", name: "Desert", weight: 2, hostility: [25, 75],
      weather: ["Clear", "Scorching heat", "Sandstorm", "Cold night", "Dry wind"],
      nouns: ["Dunes", "Waste", "Expanse", "Oasis", "Flats", "Mesa"]
    },
    {
      key: "mountains", name: "Mountains", weight: 2, hostility: [30, 85],
      weather: ["Clear", "Snow", "High wind", "Fog", "Thunderstorm"],
      nouns: ["Peak", "Crag", "Pass", "Summit", "Range", "Spire"]
    },
    {
      key: "swamp", name: "Swamp", weight: 2, hostility: [35, 80],
      weather: ["Muggy", "Light rain", "Fog", "Heavy rain", "Stagnant heat"],
      nouns: ["Marsh", "Fen", "Bog", "Mire", "Quag", "Wetland"]
    },
    {
      key: "tundra", name: "Tundra", weight: 1, hostility: [40, 90],
      weather: ["Clear", "Snow", "Blizzard", "Freezing fog", "Ice wind"],
      nouns: ["Tundra", "Frostfield", "Barrens", "Icefield", "Steppe", "Waste"]
    },
    {
      key: "jungle", name: "Jungle", weight: 1, hostility: [45, 95],
      weather: ["Humid", "Heavy rain", "Thunderstorm", "Dense fog", "Sweltering heat"],
      nouns: ["Canopy", "Thicket", "Wilds", "Basin", "Grove", "Depths"]
    },
    {
      key: "wasteland", name: "Wasteland", weight: 1, hostility: [60, 100],
      weather: ["Clear", "Ash wind", "Dust storm", "Acid rain", "Cold night"],
      nouns: ["Waste", "Ashlands", "Blight", "Barrens", "Ruins", "Scar"]
    }
  ],

  // Names are built from patterns: {prefix} {noun} {suffix}. Add words here, no code changes.
  namePrefixes: ["Ashen", "Black", "Broken", "Crimson", "Dawn", "Dusk", "Elder", "Ember", "Fair", "Frost",
                 "Golden", "Grey", "Hollow", "Iron", "Mist", "Moon", "Moss", "Oak", "Pale", "Raven",
                 "Red", "Salt", "Shadow", "Silver", "Stone", "Storm", "Thorn", "White", "Wild", "Wind"],
  nameSuffixes: ["Reach", "Crossing", "Rest", "Watch", "Pass", "Ford", "Vale", "Landing", "Hold", "March"],
  namePatterns: ["{prefix} {noun}", "The {prefix} {noun}", "{prefix} {suffix}"],

  // Labels only; the stored value is always an integer from 1 to 100.
  hostilityBands: [
    { max: 20, label: "Peaceful" },
    { max: 40, label: "Watchful" },
    { max: 60, label: "Unsettled" },
    { max: 80, label: "Dangerous" },
    { max: 100, label: "Deadly" }
  ]
};
