/* Character content tables. Edit freely: this is data, not logic.
   firstNames/surnames: generated NPC names.
   ageRange: [min, max] for generated NPCs.
   traits: the 30-trait pool. Each NPC gets five, never both sides of an opposite pair.
   opposites: traits that can't appear on the same character.
   behaviorAxes: the future AI foundation: 0 is the low end, 100 the high end. No current
   rule reads them. Future dialogue, NPC events and combat AI should read character.behavior,
   not infer intent from the name or traits.
   personalities: 30 named archetypes. A generated NPC stores { id, name } in personality,
   copies the five traits, and copies the behavior values into character.behavior. Change the
   numbers here to tune future AI; the character module only clamps and stores them.
   Edited by editor.html. Keep the object below strict JSON (quoted keys, no comments, no
   trailing commas); put notes in this header instead. */
window.CharacterData = {
  "firstNames": {
    "male": [
      "Aldric", "Berren", "Cael", "Doran", "Edmund", "Fenn", "Garrick", "Hale", "Ivor", "Joren",
      "Kellan", "Lorcan", "Marek", "Nolan", "Osric"
    ],
    "female": [
      "Alara", "Brenna", "Cora", "Dalia", "Elspeth", "Fiora", "Gwen", "Helene", "Isolde", "Jenna",
      "Kestrel", "Lyra", "Maren", "Nessa", "Orla"
    ]
  },
  "surnames": [
    "Ashford", "Blackwood", "Carrow", "Dunmere", "Eastwick", "Fairwind", "Grayson", "Hollis",
    "Ironside", "Kerrigan", "Langley", "Marsh", "Northcott", "Oakheart", "Pryce"
  ],
  "ageRange": [16, 75],
  "traits": [
    "Brave", "Cowardly", "Honest", "Deceitful", "Curious", "Stubborn", "Generous", "Greedy",
    "Patient", "Hot-tempered", "Loyal", "Ambitious", "Lazy", "Cheerful", "Gloomy", "Cautious",
    "Reckless", "Charming", "Shy", "Proud", "Humble", "Suspicious", "Trusting", "Clever",
    "Forgetful", "Kind", "Cruel", "Devout", "Superstitious", "Witty"
  ],
  "opposites": [
    ["Brave", "Cowardly"],
    ["Honest", "Deceitful"],
    ["Generous", "Greedy"],
    ["Patient", "Hot-tempered"],
    ["Cheerful", "Gloomy"],
    ["Cautious", "Reckless"],
    ["Shy", "Charming"],
    ["Proud", "Humble"],
    ["Suspicious", "Trusting"],
    ["Kind", "Cruel"]
  ],
  "behaviorAxes": [
    { "key": "aggression", "label": "Aggression", "low": "peaceful", "high": "hostile" },
    { "key": "caution", "label": "Caution", "low": "bold", "high": "careful" },
    { "key": "sociability", "label": "Sociability", "low": "solitary", "high": "outgoing" },
    { "key": "honesty", "label": "Honesty", "low": "deceitful", "high": "truthful" },
    { "key": "generosity", "label": "Generosity", "low": "greedy", "high": "giving" },
    { "key": "loyalty", "label": "Loyalty", "low": "self-serving", "high": "loyal" },
    { "key": "curiosity", "label": "Curiosity", "low": "incurious", "high": "curious" },
    { "key": "ambition", "label": "Ambition", "low": "content", "high": "driven" }
  ],
  "personalities": [
    {
      "id": "gallant_knight",
      "name": "Gallant Knight",
      "traits": ["Brave", "Loyal", "Proud", "Honest", "Patient"],
      "behavior": {
        "aggression": 65,
        "caution": 40,
        "sociability": 65,
        "honesty": 85,
        "generosity": 60,
        "loyalty": 85,
        "curiosity": 40,
        "ambition": 55
      }
    },
    {
      "id": "cunning_courtier",
      "name": "Cunning Courtier",
      "traits": ["Deceitful", "Clever", "Charming", "Ambitious", "Patient"],
      "behavior": {
        "aggression": 40,
        "caution": 70,
        "sociability": 80,
        "honesty": 30,
        "generosity": 45,
        "loyalty": 55,
        "curiosity": 60,
        "ambition": 85
      }
    },
    {
      "id": "greedy_merchant",
      "name": "Greedy Merchant",
      "traits": ["Greedy", "Clever", "Suspicious", "Stubborn", "Ambitious"],
      "behavior": {
        "aggression": 35,
        "caution": 65,
        "sociability": 70,
        "honesty": 55,
        "generosity": 15,
        "loyalty": 50,
        "curiosity": 55,
        "ambition": 80
      }
    },
    {
      "id": "devout_pilgrim",
      "name": "Devout Pilgrim",
      "traits": ["Devout", "Humble", "Patient", "Kind", "Superstitious"],
      "behavior": {
        "aggression": 20,
        "caution": 60,
        "sociability": 45,
        "honesty": 90,
        "generosity": 70,
        "loyalty": 65,
        "curiosity": 35,
        "ambition": 25
      }
    },
    {
      "id": "reckless_sellsword",
      "name": "Reckless Sellsword",
      "traits": ["Reckless", "Brave", "Hot-tempered", "Greedy", "Loyal"],
      "behavior": {
        "aggression": 85,
        "caution": 15,
        "sociability": 60,
        "honesty": 50,
        "generosity": 40,
        "loyalty": 60,
        "curiosity": 45,
        "ambition": 45
      }
    },
    {
      "id": "cautious_scholar",
      "name": "Cautious Scholar",
      "traits": ["Cautious", "Clever", "Curious", "Patient", "Shy"],
      "behavior": {
        "aggression": 15,
        "caution": 80,
        "sociability": 35,
        "honesty": 80,
        "generosity": 50,
        "loyalty": 60,
        "curiosity": 90,
        "ambition": 55
      }
    },
    {
      "id": "cheerful_innkeeper",
      "name": "Cheerful Innkeeper",
      "traits": ["Cheerful", "Charming", "Generous", "Trusting", "Witty"],
      "behavior": {
        "aggression": 20,
        "caution": 45,
        "sociability": 90,
        "honesty": 80,
        "generosity": 85,
        "loyalty": 70,
        "curiosity": 50,
        "ambition": 35
      }
    },
    {
      "id": "gloomy_hermit",
      "name": "Gloomy Hermit",
      "traits": ["Gloomy", "Shy", "Suspicious", "Stubborn", "Devout"],
      "behavior": {
        "aggression": 25,
        "caution": 75,
        "sociability": 15,
        "honesty": 70,
        "generosity": 40,
        "loyalty": 45,
        "curiosity": 45,
        "ambition": 20
      }
    },
    {
      "id": "ambitious_upstart",
      "name": "Ambitious Upstart",
      "traits": ["Ambitious", "Proud", "Clever", "Deceitful", "Charming"],
      "behavior": {
        "aggression": 55,
        "caution": 55,
        "sociability": 75,
        "honesty": 35,
        "generosity": 45,
        "loyalty": 40,
        "curiosity": 65,
        "ambition": 95
      }
    },
    {
      "id": "loyal_retainer",
      "name": "Loyal Retainer",
      "traits": ["Loyal", "Patient", "Humble", "Honest", "Brave"],
      "behavior": {
        "aggression": 55,
        "caution": 55,
        "sociability": 50,
        "honesty": 90,
        "generosity": 65,
        "loyalty": 95,
        "curiosity": 30,
        "ambition": 30
      }
    },
    {
      "id": "cruel_tyrant",
      "name": "Cruel Tyrant",
      "traits": ["Cruel", "Proud", "Ambitious", "Suspicious", "Hot-tempered"],
      "behavior": {
        "aggression": 90,
        "caution": 45,
        "sociability": 55,
        "honesty": 25,
        "generosity": 15,
        "loyalty": 30,
        "curiosity": 40,
        "ambition": 90
      }
    },
    {
      "id": "kind_healer",
      "name": "Kind Healer",
      "traits": ["Kind", "Patient", "Humble", "Devout", "Generous"],
      "behavior": {
        "aggression": 10,
        "caution": 55,
        "sociability": 65,
        "honesty": 90,
        "generosity": 85,
        "loyalty": 70,
        "curiosity": 50,
        "ambition": 30
      }
    },
    {
      "id": "honest_farmer",
      "name": "Honest Farmer",
      "traits": ["Honest", "Trusting", "Patient", "Stubborn", "Kind"],
      "behavior": {
        "aggression": 30,
        "caution": 60,
        "sociability": 55,
        "honesty": 95,
        "generosity": 70,
        "loyalty": 80,
        "curiosity": 35,
        "ambition": 25
      }
    },
    {
      "id": "deceitful_spy",
      "name": "Deceitful Spy",
      "traits": ["Deceitful", "Clever", "Suspicious", "Patient", "Cowardly"],
      "behavior": {
        "aggression": 50,
        "caution": 85,
        "sociability": 60,
        "honesty": 10,
        "generosity": 30,
        "loyalty": 45,
        "curiosity": 75,
        "ambition": 65
      }
    },
    {
      "id": "proud_duelist",
      "name": "Proud Duelist",
      "traits": ["Proud", "Brave", "Hot-tempered", "Stubborn", "Charming"],
      "behavior": {
        "aggression": 80,
        "caution": 25,
        "sociability": 65,
        "honesty": 55,
        "generosity": 35,
        "loyalty": 50,
        "curiosity": 40,
        "ambition": 70
      }
    },
    {
      "id": "humble_monk",
      "name": "Humble Monk",
      "traits": ["Humble", "Devout", "Patient", "Kind", "Shy"],
      "behavior": {
        "aggression": 10,
        "caution": 70,
        "sociability": 30,
        "honesty": 90,
        "generosity": 75,
        "loyalty": 70,
        "curiosity": 40,
        "ambition": 20
      }
    },
    {
      "id": "suspicious_watchman",
      "name": "Suspicious Watchman",
      "traits": ["Suspicious", "Cautious", "Loyal", "Stubborn", "Proud"],
      "behavior": {
        "aggression": 45,
        "caution": 75,
        "sociability": 35,
        "honesty": 65,
        "generosity": 35,
        "loyalty": 80,
        "curiosity": 45,
        "ambition": 40
      }
    },
    {
      "id": "trusting_youth",
      "name": "Trusting Youth",
      "traits": ["Trusting", "Cheerful", "Curious", "Brave", "Forgetful"],
      "behavior": {
        "aggression": 45,
        "caution": 25,
        "sociability": 80,
        "honesty": 85,
        "generosity": 70,
        "loyalty": 60,
        "curiosity": 85,
        "ambition": 45
      }
    },
    {
      "id": "patient_hunter",
      "name": "Patient Hunter",
      "traits": ["Patient", "Cautious", "Curious", "Stubborn", "Brave"],
      "behavior": {
        "aggression": 35,
        "caution": 80,
        "sociability": 25,
        "honesty": 75,
        "generosity": 50,
        "loyalty": 65,
        "curiosity": 70,
        "ambition": 40
      }
    },
    {
      "id": "hot_tempered_brigand",
      "name": "Hot-tempered Brigand",
      "traits": ["Hot-tempered", "Reckless", "Greedy", "Cruel", "Proud"],
      "behavior": {
        "aggression": 95,
        "caution": 20,
        "sociability": 55,
        "honesty": 30,
        "generosity": 25,
        "loyalty": 35,
        "curiosity": 40,
        "ambition": 55
      }
    },
    {
      "id": "shy_scribe",
      "name": "Shy Scribe",
      "traits": ["Shy", "Clever", "Curious", "Patient", "Humble"],
      "behavior": {
        "aggression": 10,
        "caution": 65,
        "sociability": 20,
        "honesty": 85,
        "generosity": 55,
        "loyalty": 60,
        "curiosity": 80,
        "ambition": 50
      }
    },
    {
      "id": "charming_rogue",
      "name": "Charming Rogue",
      "traits": ["Charming", "Deceitful", "Reckless", "Witty", "Greedy"],
      "behavior": {
        "aggression": 55,
        "caution": 50,
        "sociability": 85,
        "honesty": 20,
        "generosity": 35,
        "loyalty": 40,
        "curiosity": 65,
        "ambition": 70
      }
    },
    {
      "id": "curious_explorer",
      "name": "Curious Explorer",
      "traits": ["Curious", "Brave", "Reckless", "Cheerful", "Forgetful"],
      "behavior": {
        "aggression": 60,
        "caution": 35,
        "sociability": 75,
        "honesty": 70,
        "generosity": 55,
        "loyalty": 60,
        "curiosity": 95,
        "ambition": 55
      }
    },
    {
      "id": "stubborn_smith",
      "name": "Stubborn Smith",
      "traits": ["Stubborn", "Proud", "Patient", "Loyal", "Honest"],
      "behavior": {
        "aggression": 60,
        "caution": 50,
        "sociability": 45,
        "honesty": 80,
        "generosity": 60,
        "loyalty": 85,
        "curiosity": 35,
        "ambition": 65
      }
    },
    {
      "id": "generous_patron",
      "name": "Generous Patron",
      "traits": ["Generous", "Charming", "Proud", "Kind", "Trusting"],
      "behavior": {
        "aggression": 25,
        "caution": 45,
        "sociability": 80,
        "honesty": 85,
        "generosity": 95,
        "loyalty": 70,
        "curiosity": 45,
        "ambition": 50
      }
    },
    {
      "id": "lazy_drunkard",
      "name": "Lazy Drunkard",
      "traits": ["Lazy", "Gloomy", "Witty", "Greedy", "Trusting"],
      "behavior": {
        "aggression": 20,
        "caution": 45,
        "sociability": 70,
        "honesty": 50,
        "generosity": 55,
        "loyalty": 35,
        "curiosity": 30,
        "ambition": 15
      }
    },
    {
      "id": "witty_bard",
      "name": "Witty Bard",
      "traits": ["Witty", "Charming", "Curious", "Cheerful", "Ambitious"],
      "behavior": {
        "aggression": 30,
        "caution": 40,
        "sociability": 95,
        "honesty": 65,
        "generosity": 60,
        "loyalty": 50,
        "curiosity": 75,
        "ambition": 65
      }
    },
    {
      "id": "superstitious_fisher",
      "name": "Superstitious Fisher",
      "traits": ["Superstitious", "Cautious", "Trusting", "Patient", "Gloomy"],
      "behavior": {
        "aggression": 25,
        "caution": 70,
        "sociability": 40,
        "honesty": 65,
        "generosity": 55,
        "loyalty": 65,
        "curiosity": 50,
        "ambition": 25
      }
    },
    {
      "id": "forgetful_elder",
      "name": "Forgetful Elder",
      "traits": ["Forgetful", "Kind", "Patient", "Humble", "Superstitious"],
      "behavior": {
        "aggression": 15,
        "caution": 65,
        "sociability": 50,
        "honesty": 80,
        "generosity": 65,
        "loyalty": 70,
        "curiosity": 40,
        "ambition": 25
      }
    },
    {
      "id": "brave_scout",
      "name": "Brave Scout",
      "traits": ["Brave", "Curious", "Cautious", "Loyal", "Cheerful"],
      "behavior": {
        "aggression": 60,
        "caution": 55,
        "sociability": 60,
        "honesty": 80,
        "generosity": 55,
        "loyalty": 80,
        "curiosity": 85,
        "ambition": 50
      }
    }
  ],
  "relations": {
    "min": -100,
    "max": 100,
    "default": 0,
    "defaultType": "neutral",
    "bands": [
      { "key": "hostile", "label": "Hostile", "min": -100, "max": -31 },
      { "key": "unfriendly", "label": "Unfriendly", "min": -30, "max": 0 },
      { "key": "ambivalent", "label": "Ambivalent", "min": 1, "max": 20 },
      { "key": "accepting", "label": "Accepting", "min": 21, "max": 40 },
      { "key": "friendly", "label": "Friendly", "min": 41, "max": 60 },
      { "key": "devoted", "label": "Devoted", "min": 61, "max": 100, "typeSpecific": true }
    ],
    "types": [
      { "key": "neutral", "label": "Neutral", "highLabel": "Friendly" },
      { "key": "ally", "label": "Ally", "highLabel": "Loving" },
      { "key": "guardian", "label": "Guardian", "highLabel": "Protective" },
      { "key": "merchant", "label": "Merchant", "highLabel": "Trusted" },
      { "key": "bandit", "label": "Bandit", "highLabel": "Devoted" },
      { "key": "beast", "label": "Beast", "highLabel": "Bonded" }
    ]
  },
  "levels": { "min": 1, "max": 100, "default": 1 }
};
