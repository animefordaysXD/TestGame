/* Game content: the opening journal and framing text. This is data, not logic.
   Objective types:
     visit   - complete after visiting the `site` key or any site with `siteKind`
     action  - complete after any area action resolves
     victory - complete after the main character wins a fight
   Labels and hints support {start}, {tavern} and {site}. Keep the object below strict JSON
   (quoted keys, no comments, no trailing commas); put notes in this header instead. */
window.GameData = {
  "title": "The Greyreach",
  "tagline": "A cold road, an old tavern, and a world that does not wait.",
  "opening": "You arrive with what you carry and no one waiting for you. Find your feet, learn the road, and survive what the Greyreach sends.",
  "completeText": "The journal is clear for now. The road, the tavern and the wilds remain.",
  "siteText": {
    "broken_wheel": "Warm light spills from the tavern door. Inside, voices rise and fall over the smell of old ale and wet wool.",
    "greywatch_castle": "Grey stone rises above the village. The gate is open, but the guards watch every stranger who passes.",
    "abandoned_shack": "The shack leans into the wind. Its door hangs open, and something small moves in the dark beyond it.",
    "greywatch_village": "Greywatch Village is a huddle of timber, smoke and muddy lanes. Farmers, carters and a few hard-eyed strangers share the road.",
    "old_stone_road": "The old stone road runs out of the village and into the hills. Weeds split the paving, and the wind carries no sound of company.",
    "whispering_wood": "The trees close over the path. Somewhere ahead, branches shift without wind.",
    "mistfall_bay": "Salt hangs in the air. Below the cliff, the sea worries at black rocks and the mist swallows the horizon.",
    "ashen_ridge": "The ridge is bare and grey. Old fire scars mark the stones, and the wind cuts across the heights.",
    "blackfen_marsh": "Black water lies between the reeds. The ground gives under every step, and the fog does not move.",
    "dustglass_waste": "Heat shimmers over cracked earth. The waste stretches away in every direction, bright and empty.",
    "pale_reach": "Snow covers the tundra in a thin, hard skin. The world is very quiet here.",
    "sunder_peak": "The mountain road climbs into cold air. Far below, the Greyreach looks small enough to hold in one hand."
  },
  "fallbackText": "The road is quiet for now. It will not stay that way.",
  "objectives": [
    {
      "key": "arrive",
      "label": "Reach {start}",
      "hint": "The village is where your story starts.",
      "type": "visit",
      "site": "{start}"
    },
    {
      "key": "look",
      "label": "Take an action in the village",
      "hint": "Choose Scout, Scavenge, Rest or Hunt in the Actions panel.",
      "type": "action"
    },
    {
      "key": "road",
      "label": "Follow the old road",
      "hint": "Travel to {site} and see what waits there.",
      "type": "visit",
      "site": "old_stone_road"
    },
    {
      "key": "fight",
      "label": "Defeat a hostile",
      "hint": "Look around dangerous places until something hostile finds you, then win the fight.",
      "type": "victory",
      "after": "road"
    },
    {
      "key": "tavern",
      "label": "Return to {tavern}",
      "hint": "End the first road at the tavern.",
      "type": "visit",
      "siteKind": "tavern",
      "after": "fight"
    }
  ]
};
