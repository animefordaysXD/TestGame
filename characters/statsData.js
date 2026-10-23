/* Shared base-stat content for every character (main character and NPCs).
   This is data, not logic. Both the characters and mainCharacter modules read it.
   kind: "resource" stats have a paired <key>Max field and start full; "skill" stats
   use the definition max directly. NPCs roll npcRange; npcBell makes rolls cluster
   around the middle of the range. List order is the UI order. */
window.CharacterStatsData = {
  stats: [
    { key: "hp",              label: "HP",              short: "HP",     kind: "resource", min: 0, max: 100, start: 100, npcRange: [70, 100] },
    { key: "stamina",         label: "Stamina",         short: "Sta",    kind: "resource", min: 0, max: 100, start: 100, npcRange: [70, 100] },
    { key: "mana",            label: "Mana",            short: "Mana",   kind: "resource", min: 0, max: 50,  start: 50,  npcRange: [20, 50] },
    { key: "war",             label: "War",             short: "War",    kind: "skill",    min: 1, max: 20,  start: 10,  npcRange: [1, 20], npcBell: true },
    { key: "diplomacy",       label: "Diplomacy",       short: "Dip",    kind: "skill",    min: 1, max: 20,  start: 10,  npcRange: [1, 20], npcBell: true },
    { key: "personalCombat",  label: "Personal Combat", short: "Combat", kind: "skill",    min: 1, max: 20,  start: 10,  npcRange: [1, 20], npcBell: true },
    { key: "moneyManagement", label: "Money Management", short: "Money", kind: "skill",    min: 1, max: 20,  start: 10,  npcRange: [1, 20], npcBell: true },
    { key: "intrigue",        label: "Intrigue",        short: "Intr",   kind: "skill",    min: 1, max: 20,  start: 10,  npcRange: [1, 20], npcBell: true },
    { key: "intelligence",    label: "Intelligence",    short: "Int",    kind: "skill",    min: 1, max: 20,  start: 10,  npcRange: [1, 20], npcBell: true }
  ]
};
