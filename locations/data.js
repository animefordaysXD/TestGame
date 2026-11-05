/* Location content tables. Edit freely: this is data, not logic.
   To add a biome, copy an entry: key/name must be unique, weather and nouns are lists.
   hostility is [min, max] within 1-100; 50 is the neutral default, below it is safer and
   above it is more dangerous. levelRange is [min, max] for the level of a generated
   location; it is a framework for later progression. weight controls how often a biome is
   chosen. Edited by editor.html. Keep the object below strict JSON (quoted keys, no
   comments, no trailing commas); put notes in this header instead. */
window.LocationData = {
  "defaultHostility": 50,
  "defaultLevel": 1,
  "biomes": [
    {
      "key": "forest",
      "name": "Forest",
      "weight": 3,
      "hostility": [30, 55],
      "levelRange": [1, 3],
      "weather": ["Clear", "Light rain", "Mist", "Heavy rain", "Thunderstorm", "Cool breeze"],
      "nouns": ["Wood", "Thicket", "Grove", "Glade", "Hollow", "Copse"]
    },
    {
      "key": "grassland",
      "name": "Grassland",
      "weight": 3,
      "hostility": [25, 50],
      "levelRange": [1, 2],
      "weather": ["Clear", "Sunny", "Windy", "Light rain", "Overcast", "Dew"],
      "nouns": ["Plain", "Meadow", "Prairie", "Downs", "Field", "Basin"]
    },
    {
      "key": "hills",
      "name": "Hills",
      "weight": 2,
      "hostility": [35, 60],
      "levelRange": [2, 4],
      "weather": ["Clear", "Windy", "Overcast", "Light rain", "Fog"],
      "nouns": ["Ridge", "Downs", "Rise", "Knoll", "Vale", "Heights"]
    },
    {
      "key": "coast",
      "name": "Coast",
      "weight": 2,
      "hostility": [30, 55],
      "levelRange": [1, 3],
      "weather": ["Clear", "Sea breeze", "Rain", "Storm", "Mist"],
      "nouns": ["Bay", "Shore", "Cove", "Strand", "Cliffs", "Harbor"]
    },
    {
      "key": "desert",
      "name": "Desert",
      "weight": 2,
      "hostility": [45, 70],
      "levelRange": [2, 5],
      "weather": ["Clear", "Scorching heat", "Sandstorm", "Cold night", "Dry wind"],
      "nouns": ["Dunes", "Waste", "Expanse", "Oasis", "Flats", "Mesa"]
    },
    {
      "key": "mountains",
      "name": "Mountains",
      "weight": 2,
      "hostility": [50, 80],
      "levelRange": [3, 6],
      "weather": ["Clear", "Snow", "High wind", "Fog", "Thunderstorm"],
      "nouns": ["Peak", "Crag", "Pass", "Summit", "Range", "Spire"]
    },
    {
      "key": "swamp",
      "name": "Swamp",
      "weight": 2,
      "hostility": [45, 75],
      "levelRange": [3, 6],
      "weather": ["Muggy", "Light rain", "Fog", "Heavy rain", "Stagnant heat"],
      "nouns": ["Marsh", "Fen", "Bog", "Mire", "Quag", "Wetland"]
    },
    {
      "key": "tundra",
      "name": "Tundra",
      "weight": 1,
      "hostility": [50, 85],
      "levelRange": [4, 7],
      "weather": ["Clear", "Snow", "Blizzard", "Freezing fog", "Ice wind"],
      "nouns": ["Tundra", "Frostfield", "Barrens", "Icefield", "Steppe", "Waste"]
    },
    {
      "key": "jungle",
      "name": "Jungle",
      "weight": 1,
      "hostility": [55, 90],
      "levelRange": [5, 8],
      "weather": ["Humid", "Heavy rain", "Thunderstorm", "Dense fog", "Sweltering heat"],
      "nouns": ["Canopy", "Thicket", "Wilds", "Basin", "Grove", "Depths"]
    },
    {
      "key": "wasteland",
      "name": "Wasteland",
      "weight": 1,
      "hostility": [60, 100],
      "levelRange": [7, 10],
      "weather": ["Clear", "Ash wind", "Dust storm", "Acid rain", "Cold night"],
      "nouns": ["Waste", "Ashlands", "Blight", "Barrens", "Ruins", "Scar"]
    }
  ],
  "namePrefixes": ["Ashen", "Black", "Broken", "Crimson", "Dawn", "Dusk", "Elder", "Ember", "Fair", "Frost",
    "Golden", "Grey", "Hollow", "Iron", "Mist", "Moon", "Moss", "Oak", "Pale", "Raven",
    "Red", "Salt", "Shadow", "Silver", "Stone", "Storm", "Thorn", "White", "Wild", "Wind"],
  "nameSuffixes": ["Reach", "Crossing", "Rest", "Watch", "Pass", "Ford", "Vale", "Landing", "Hold", "March"],
  "namePatterns": ["{prefix} {noun}", "The {prefix} {noun}", "{prefix} {suffix}"],
  "travelGraph": {
    "distanceRange": [1, 4],
    "minutesPerDistance": 15,
    "links": [1, 2],
    "legacyDistance": 1
  },
  "hostilityBands": [
    { "key": "peaceful", "max": 20, "label": "Peaceful" },
    { "key": "watchful", "max": 40, "label": "Watchful" },
    { "key": "unsettled", "max": 60, "label": "Unsettled" },
    { "key": "dangerous", "max": 80, "label": "Dangerous" },
    { "key": "deadly", "max": 100, "label": "Deadly" }
  ]
};
