# Combat module

Basic turn-based duels between the main character and one NPC. The module is v0.1 and
owns the `combat` state slice. It never reads another module's slice: the UI sends
combatant snapshots when the fight starts, and the mainCharacter/characters modules apply
the resulting `combat:damage` events to the real characters.

## Files

- `combat/data.js` — action names, attack/defend tuning, enemy-action hook, log limit.
- `combat/combat.js` — turn flow and event emission.
- `test/combat.test.cjs` — Node tests.

## Flow

1. The UI fires `combat:start` with `{ player, enemy }` snapshots.
2. Combat sets round 1 and gives the player the first turn.
3. The player chooses **Attack** or **Defend** with `combat:action`.
4. Attack deals damage based on the attacker's Personal Combat. If the enemy survives, it
   attacks back immediately. Defend braces for that counterattack.
5. Damage is emitted as `combat:damage`; the target modules lower the real character's HP.
6. At 0 HP the fight ends with `combat:ended`. A lethal player hit skips the counterattack.

The enemy currently always attacks. `CombatData.enemyAction` is reserved for a future AI.

## Formulas

```text
attack damage = max(minDamage, round(attacker.personalCombat * multiplier))
defend damage = max(0, incoming damage - armor * armorMultiplier)
```

Defaults are `multiplier: 1`, `minDamage: 1`, `armorMultiplier: 2`. Armor is 0 for every
character until equipment exists, so Defend currently blocks nothing; the formula and
event data are already in place for equipment. This formula is provisional and may change.

## State slice

```js
combat: {
  active: false,
  round: 0,
  turn: null,             // "player" while waiting for input
  player: null,           // { id, name, hp, hpMax, personalCombat, armor }
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
| `combat:started` | module | `{ playerId, playerName, enemyId, enemyName }` |
| `combat:damage` | module | `{ action, sourceId, sourceName, targetId, targetName, amount, hpBefore, hpAfter, hpMax, defended, armor, reduction }` |
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
- Armor cannot be equipped or changed by location events. It stays 0 until an equipment
  module writes it.
- Defend is mostly a placeholder until armor is non-zero.
