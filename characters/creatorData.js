/* Character creator content: backgrounds, origins and focuses.
   This is data, not logic. The creator module adds the chosen entries' stat changes
   together, then grants their equipment keys through equipment:add.
   `resourceStartPercent` sets how full HP/Stamina/Mana start, leaving room for both
   positive and negative starting changes. `maxStartingItems` caps the granted kit.
   Keep the object below strict JSON (quoted keys, no comments, no trailing commas);
   put notes in this header instead. Edited by editor.html. */
window.CharacterCreatorData = {
  "settings": {
    "resourceStartPercent": 80,
    "maxStartingItems": 6
  },
  "backgrounds": [
    {
      "key": "soldier",
      "name": "Soldier",
      "description": "You served in a lord's levy and learned to hold a line.",
      "stats": [
        { "stat": "strength", "delta": 2 },
        { "stat": "personalCombat", "delta": 2 },
        { "stat": "war", "delta": 1 },
        { "stat": "stamina", "delta": -5 }
      ],
      "equipment": ["chain_shirt", "iron_shortsword"]
    },
    {
      "key": "hunter",
      "name": "Hunter",
      "description": "You know the quiet paths and how to read a trail.",
      "stats": [
        { "stat": "stamina", "delta": 6 },
        { "stat": "personalCombat", "delta": 1 },
        { "stat": "intelligence", "delta": 1 },
        { "stat": "moneyManagement", "delta": -1 }
      ],
      "equipment": ["leather_cuirass", "ashwood_spear"]
    },
    {
      "key": "scholar",
      "name": "Scholar",
      "description": "You studied old books until the world outside became a question.",
      "stats": [
        { "stat": "intelligence", "delta": 3 },
        { "stat": "mana", "delta": 5 },
        { "stat": "diplomacy", "delta": 1 },
        { "stat": "strength", "delta": -2 },
        { "stat": "stamina", "delta": -4 }
      ],
      "equipment": ["traveler_cloak", "wooden_club"]
    },
    {
      "key": "thief",
      "name": "Thief",
      "description": "You learned which doors are watched and which windows are not.",
      "stats": [
        { "stat": "intrigue", "delta": 2 },
        { "stat": "personalCombat", "delta": 1 },
        { "stat": "stamina", "delta": 3 },
        { "stat": "diplomacy", "delta": -1 }
      ],
      "equipment": ["scavenged_leather", "iron_shortsword"]
    },
    {
      "key": "merchant",
      "name": "Merchant",
      "description": "You can price a horse, a favour and a silence.",
      "stats": [
        { "stat": "moneyManagement", "delta": 3 },
        { "stat": "diplomacy", "delta": 2 },
        { "stat": "war", "delta": -1 },
        { "stat": "stamina", "delta": -3 }
      ],
      "equipment": ["padded_gambeson", "wooden_club"]
    },
    {
      "key": "outlander",
      "name": "Outlander",
      "description": "You grew up beyond the roads, where a bad day is a long walk home.",
      "stats": [
        { "stat": "stamina", "delta": 4 },
        { "stat": "strength", "delta": 1 },
        { "stat": "war", "delta": 1 },
        { "stat": "intelligence", "delta": -1 }
      ],
      "equipment": ["scavenged_leather", "woodcutter_axe"]
    }
  ],
  "origins": [
    {
      "key": "village",
      "name": "Village",
      "description": "A small place where everyone knew your name and your business.",
      "stats": [
        { "stat": "stamina", "delta": 3 },
        { "stat": "diplomacy", "delta": 1 }
      ],
      "equipment": ["traveler_boots"]
    },
    {
      "key": "city",
      "name": "City",
      "description": "Crowded streets taught you to read people quickly.",
      "stats": [
        { "stat": "intelligence", "delta": 1 },
        { "stat": "moneyManagement", "delta": 1 }
      ],
      "equipment": ["work_gloves"]
    },
    {
      "key": "frontier",
      "name": "Frontier",
      "description": "The edge of settled land, where help was always a day away.",
      "stats": [
        { "stat": "stamina", "delta": 2 },
        { "stat": "strength", "delta": 1 }
      ],
      "equipment": ["leather_cap"]
    },
    {
      "key": "court",
      "name": "Court",
      "description": "You grew up among careful smiles and carefully kept secrets.",
      "stats": [
        { "stat": "diplomacy", "delta": 2 },
        { "stat": "intrigue", "delta": 1 }
      ],
      "equipment": []
    }
  ],
  "focuses": [
    {
      "key": "blade",
      "name": "Blade",
      "description": "You spend your free hours drilling with a weapon.",
      "stats": [
        { "stat": "personalCombat", "delta": 2 },
        { "stat": "strength", "delta": 1 }
      ],
      "equipment": []
    },
    {
      "key": "lore",
      "name": "Lore",
      "description": "You collect fragments of old knowledge wherever you find them.",
      "stats": [
        { "stat": "intelligence", "delta": 2 },
        { "stat": "mana", "delta": 4 }
      ],
      "equipment": []
    },
    {
      "key": "trade",
      "name": "Trade",
      "description": "You know what things cost and how to make a deal stick.",
      "stats": [
        { "stat": "moneyManagement", "delta": 2 },
        { "stat": "diplomacy", "delta": 1 }
      ],
      "equipment": []
    },
    {
      "key": "wild",
      "name": "Wild",
      "description": "You are most at ease with mud on your boots and a long road ahead.",
      "stats": [
        { "stat": "stamina", "delta": 3 },
        { "stat": "strength", "delta": 1 }
      ],
      "equipment": ["leather_greaves"]
    }
  ]
};
