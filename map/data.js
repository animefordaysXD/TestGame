/* Static world map and interior terrain content. Edit freely: this is data, not logic.
   The world map is fixed: every new game loads the same sites, routes and landmark
   interiors, and starts the character at world.start. The procedural generator builds a
   landmark interior the first time it is visited; the same generator can be reused for
   travel terrain later.
   Keep the object below strict JSON (quoted keys, no comments, no trailing commas);
   put notes in this header instead. Edited by editor.html. */
window.MapData = {
  "version": 2,
  "world": {
    "name": "The Greyreach",
    "start": "greywatch_village",
    "locations": [
      {
        "key": "broken_wheel",
        "kind": "tavern",
        "name": "The Broken Wheel",
        "biome": "Landmark",
        "biomeKey": "landmark",
        "weather": "Clear",
        "hostility": 5,
        "level": 1,
        "interior": "tavern"
      },
      {
        "key": "greywatch_castle",
        "kind": "castle",
        "name": "Greywatch Castle",
        "biome": "Landmark",
        "biomeKey": "landmark",
        "weather": "Clear",
        "hostility": 20,
        "level": 2,
        "interior": "castle"
      },
      {
        "key": "abandoned_shack",
        "kind": "shack",
        "name": "Abandoned Shack",
        "biome": "Landmark",
        "biomeKey": "landmark",
        "weather": "Overcast",
        "hostility": 10,
        "level": 1,
        "interior": "shack"
      },
      {
        "key": "greywatch_village",
        "kind": "",
        "name": "Greywatch Village",
        "biome": "Grassland",
        "biomeKey": "grassland",
        "weather": "Clear",
        "hostility": 18,
        "level": 1
      },
      {
        "key": "old_stone_road",
        "kind": "",
        "name": "Old Stone Road",
        "biome": "Grassland",
        "biomeKey": "grassland",
        "weather": "Windy",
        "hostility": 28,
        "level": 1
      },
      {
        "key": "whispering_wood",
        "kind": "",
        "name": "Whispering Wood",
        "biome": "Forest",
        "biomeKey": "forest",
        "weather": "Mist",
        "hostility": 42,
        "level": 2
      },
      {
        "key": "mistfall_bay",
        "kind": "",
        "name": "Mistfall Bay",
        "biome": "Coast",
        "biomeKey": "coast",
        "weather": "Sea breeze",
        "hostility": 46,
        "level": 2
      },
      {
        "key": "ashen_ridge",
        "kind": "",
        "name": "Ashen Ridge",
        "biome": "Hills",
        "biomeKey": "hills",
        "weather": "Overcast",
        "hostility": 56,
        "level": 3
      },
      {
        "key": "blackfen_marsh",
        "kind": "",
        "name": "Blackfen Marsh",
        "biome": "Swamp",
        "biomeKey": "swamp",
        "weather": "Fog",
        "hostility": 66,
        "level": 4
      },
      {
        "key": "dustglass_waste",
        "kind": "",
        "name": "Dustglass Waste",
        "biome": "Desert",
        "biomeKey": "desert",
        "weather": "Dry wind",
        "hostility": 70,
        "level": 4
      },
      {
        "key": "pale_reach",
        "kind": "",
        "name": "The Pale Reach",
        "biome": "Tundra",
        "biomeKey": "tundra",
        "weather": "Snow",
        "hostility": 76,
        "level": 5
      },
      {
        "key": "sunder_peak",
        "kind": "",
        "name": "Sunder Peak",
        "biome": "Mountains",
        "biomeKey": "mountains",
        "weather": "High wind",
        "hostility": 82,
        "level": 6
      }
    ],
    "routes": [
      { "id": "route_broken_wheel_greywatch_village", "from": "broken_wheel", "to": "greywatch_village", "distance": 1 },
      { "id": "route_broken_wheel_old_stone_road", "from": "broken_wheel", "to": "old_stone_road", "distance": 1 },
      { "id": "route_greywatch_castle_greywatch_village", "from": "greywatch_castle", "to": "greywatch_village", "distance": 1 },
      { "id": "route_greywatch_castle_ashen_ridge", "from": "greywatch_castle", "to": "ashen_ridge", "distance": 2 },
      { "id": "route_abandoned_shack_old_stone_road", "from": "abandoned_shack", "to": "old_stone_road", "distance": 2 },
      { "id": "route_old_stone_road_whispering_wood", "from": "old_stone_road", "to": "whispering_wood", "distance": 2 },
      { "id": "route_old_stone_road_mistfall_bay", "from": "old_stone_road", "to": "mistfall_bay", "distance": 3 },
      { "id": "route_whispering_wood_blackfen_marsh", "from": "whispering_wood", "to": "blackfen_marsh", "distance": 3 },
      { "id": "route_mistfall_bay_dustglass_waste", "from": "mistfall_bay", "to": "dustglass_waste", "distance": 4 },
      { "id": "route_ashen_ridge_pale_reach", "from": "ashen_ridge", "to": "pale_reach", "distance": 3 },
      { "id": "route_ashen_ridge_sunder_peak", "from": "ashen_ridge", "to": "sunder_peak", "distance": 3 },
      { "id": "route_blackfen_marsh_dustglass_waste", "from": "blackfen_marsh", "to": "dustglass_waste", "distance": 3 },
      { "id": "route_pale_reach_sunder_peak", "from": "pale_reach", "to": "sunder_peak", "distance": 2 }
    ]
  },
  "terrain": {
    "tiles": {
      "wall": "#",
      "floor": ".",
      "entrance": "<",
      "rubble": "*",
      "water": "~"
    },
    "legend": [
      { "tile": "#", "label": "Wall" },
      { "tile": ".", "label": "Floor" },
      { "tile": "<", "label": "Entrance" },
      { "tile": "*", "label": "Rubble" },
      { "tile": "~", "label": "Water" }
    ],
    "interiors": [
      {
        "key": "tavern",
        "label": "Tavern interior",
        "width": 21,
        "height": 11,
        "roomAttempts": 7,
        "roomWidth": [3, 6],
        "roomHeight": [3, 4],
        "rubbleChance": 0.06,
        "waterChance": 0
      },
      {
        "key": "castle",
        "label": "Castle interior",
        "width": 31,
        "height": 15,
        "roomAttempts": 12,
        "roomWidth": [4, 8],
        "roomHeight": [3, 5],
        "rubbleChance": 0.04,
        "waterChance": 0.02
      },
      {
        "key": "shack",
        "label": "Shack interior",
        "width": 15,
        "height": 9,
        "roomAttempts": 4,
        "roomWidth": [2, 4],
        "roomHeight": [2, 3],
        "rubbleChance": 0.12,
        "waterChance": 0.03
      }
    ]
  }
};
