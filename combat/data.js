/* Combat content and tuning. This is data, not logic. Edit these values to change the
   basic formulas. The combat module reads CombatData.actions and the attack/defend blocks.

   Attack damage = max(minDamage, round(personalCombat * multiplier) + weapon.damage).
   A weapon only contributes when the attacker's Strength meets weapon.strength.
   Armor reduces every incoming hit: effectiveArmor = armor * (1 - armorPiercing / 100),
   then the hit loses round(effectiveArmor * armorMultiplier). armorMultiplier is 1 for a
   normal hit and defend.armorMultiplier (2) while the defender braces with Defend. */
window.CombatData = {
  actions: [
    { id: "attack", name: "Attack", description: "Deal damage based on Personal Combat plus your weapon." },
    { id: "defend", name: "Defend", description: "Brace. Incoming damage is reduced by armor x 2; armor piercing still applies." }
  ],

  // Attack damage = max(minDamage, round(attacker[stat] * multiplier) + weaponDamage).
  attack: { stat: "personalCombat", multiplier: 1, minDamage: 1 },

  // Every hit loses round(effectiveArmor * armorMultiplier) damage.
  // Defending raises armorMultiplier; a normal hit uses 1.
  defend: { armorMultiplier: 2 },

  // The enemy currently always attacks. This field is the hook for a future AI.
  enemyAction: "attack",

  logLimit: 24
};
