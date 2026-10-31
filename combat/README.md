# Combat module

Basic turn-based duels between the main character and one NPC. The module is v0.2 and
owns the `combat` state slice. It never reads another module's slice: the UI sends
combatant snapshots when the fight starts, and the mainCharacter/characters modules apply
the resulting `combat:damage` events to the real characters.

## Files

- `combat/data.js` — action names, attack/defend tuning, enemy-action hook, log limit.
- `combat/combat.js` — turn flow, weapon/armor resolution and event emission.
- `test/combat.test.cjs` — Node tests.

## Flow

1. The UI fires `combat:start` with `{ player, enemy }` snapshots.
2. Combat sets round 1 and gives the player the first turn.
3. The player chooses **Attack** or **Defend** with `combat:action`.
4. Attack deals Personal Combat damage plus the attacker's usable weapon. If the enemy
   survives, it attacks back immediately. Defend braces for that counterattack.
5. Damage is emitted as `combat:damage`; the target modules lower the real character's HP.
6. At 0 HP the fight ends with `combat:ended`. A lethal player hit skips the counterattack.

The enemy currently always attacks. `CombatData.enemyAction` is reserved for a future AI.

## Formulas

```text
weapon usable      = attacker.strength >= attacker.weapon.strength
attack damage      = max(minDamage, round(attacker.personalCombat * multiplier)
                         + (usable weapon ? weapon.damage : 0))
effective armor    = round(target.armor * (100 - weapon.armorPiercing) / 100)
armor reduction    = round(effective armor * armorMultiplier)
final damage       = max(0, attack damage - armor reduction)
```

Defaults are `multiplier: 1`, `minDamage: 1`, `armorMultiplier: 2`. `armorMultiplier` is 1
for a normal hit and 2 while the defender used Defend, so armor reduces every hit and
Defend doubles that reduction. A weapon only adds damage and armor piercing when the
attacker's Strength meets its requirement; otherwise it is too heavy and contributes
nothing. Armor comes from the equipment module (main character only); NPC snapshots carry
their own armor value.

## Snapshots

Each snapshot is `{ id, name, hp, hpMax, personalCombat, strength, armor, weapon }`.
`strength` defaults to 10 when omitted. `weapon` is `null` or
`{ key, name, damage, strength, armorPiercing, rarity }`. The UI builds the player's
weapon from `equipmentModule.weaponFor("main")`.

## State slice

```js
combat: {
  active: false,
  round: 0,
  turn: null,             // "player" while waiting for input
  player: null,           // { id, name, hp, hpMax, personalCombat, strength, armor, weapon }
  enemy: null,
  defending: false,
  winnerId: null, winnerName: "",
  loserId: null, loserName: "",
  startedAtTick: null, startedAt: "",
  endedAtTick: null, endedAt: "",
  log: []                 // capped at CombatData.logLimit
}
```

The combatant objects are snapshots for the duration of the fight. The authoritative
character HP still lives in `mainCharacter.character.stats.hp` and
`characters.named/temp[id].stats.hp`; `combat:damage` keeps them in sync.

## Events

| type | direction | data |
|---|---|---|
| `combat:start` | request | `{ player, enemy }` snapshots |
| `combat:action` | request | `{ action: "attack" \| "defend" }` |
| `combat:started` | module | `{ playerId, playerName, enemyId, enemyName, playerWeapon, enemyWeapon }` |
| `combat:damage` | module | `{ action, sourceId, sourceName, targetId, targetName, amount, base, hpBefore, hpAfter, hpMax, defended, armor, effectiveArmor, armorMultiplier, reduction, armorPiercing, strength, weapon, weaponDamage, tooHeavy }` |
| `combat:defended` | module | `{ id, name, armor, reduction }` |
| `combat:ended` | module | `{ winnerId, winnerName, loserId, loserName, rounds }` |

`combat:damage` updates HP in the target module; it does not emit a second
`mainCharacter:statChanged` line. The UI listens to `combat:damage` to refresh the stat
grid and NPC cards.

## UI

Every Temporary Spawn and Named NPC card has a **Fight** button. The **Combat** panel
shows both HP totals, the round/turn, **Attack** and **Defend** buttons, and the last
eight log lines. Fight buttons are disabled while another combat is active or when the
NPC is at 0 HP.

## Limitations

- Only one opponent, no flee, positioning, initiative, hit chance or damage variance.
- The enemy has no AI yet; it always attacks.
- Only the main character can carry a weapon. NPCs and their snapshots usually have
  `weapon: null`; the enemy weapon code path is ready for future NPC equipment.
- Armor piercing belongs to the attacker's weapon; there is no spell or skill piercing yet.
