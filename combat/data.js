/* Combat content and tuning. This is data, not logic. Edit these values to change the
   basic formulas. The combat module reads CombatData.actions and the attack/defend blocks. */
window.CombatData = {
  actions: [
    { id: "attack", name: "Attack", description: "Deal damage based on your Personal Combat skill." },
    { id: "defend", name: "Defend", description: "Brace. Incoming damage is reduced by armor x 2 (armor comes from equipment)." }
  ],

  // Attack damage = max(minDamage, round(attacker[stat] * multiplier)).
  attack: { stat: "personalCombat", multiplier: 1, minDamage: 1 },

  // Defend: incoming damage = max(0, damage - armor * armorMultiplier).
  // Armor is written by the equipment module; without equipment it is 0.
  defend: { armorMultiplier: 2 },

  // The enemy currently always attacks. This field is the hook for a future AI.
  enemyAction: "attack",

  logLimit: 24
};
