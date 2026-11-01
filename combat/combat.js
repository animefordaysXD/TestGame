/* Combat module v0.2 — turn-based duels between the main character and one NPC.
   The UI sends combatant snapshots in combat:start and an action in combat:action.
   This module owns the combat slice and emits combat:started / combat:damage /
   combat:defended / combat:ended. The mainCharacter and characters modules apply
   combat:damage to their own slices, so the real characters keep the resulting HP.

   A snapshot carries personalCombat, strength, armor and an optional equipped weapon
   ({ key, name, damage, strength, armorPiercing, rarity, weaponType? }). A weapon adds
   its damage and its armor piercing only when the attacker's Strength meets
   weapon.strength; otherwise
   it is "too heavy" and contributes nothing. Armor reduces every hit, and Defend doubles
   that reduction. See ENGINE_SPEC.md and combat/README.md. */
(function (global) {
  "use strict";
  const D = global.CombatData;

  if (!D || !Array.isArray(D.actions) || !D.actions.length)
    throw new Error("combat/data.js must define CombatData.actions");

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const ACTIONS = new Map(D.actions.map((action) => [action.id, action]));
  const ATTACK = D.attack || {};
  const DEFEND = D.defend || {};
  const ATTACK_STAT = ATTACK.stat || "personalCombat";
  const ATTACK_MULTIPLIER = Number(ATTACK.multiplier) || 1;
  const MIN_DAMAGE = Math.max(1, Math.round(Number(ATTACK.minDamage) || 1));
  const ARMOR_MULTIPLIER = Math.max(1, Number(DEFEND.armorMultiplier) || 2);
  const DEFAULT_STRENGTH = 10;   // used only when a snapshot omits Strength
  const LOG_LIMIT = Math.max(1, Math.round(Number(D.logLimit) || 20));

  const defaults = () => ({
    active: false,
    round: 0,
    turn: null,             // "player" while waiting for the player, otherwise null
    player: null,           // snapshot: { id, name, hp, hpMax, personalCombat, strength, armor, weapon }
    enemy: null,
    defending: false,       // set by Defend, consumed by the next enemy attack
    winnerId: null,
    winnerName: "",
    loserId: null,
    loserName: "",
    startedAtTick: null,
    startedAt: "",
    endedAtTick: null,
    endedAt: "",
    log: []
  });

  function cleanWeapon(raw) {
    if (!raw || typeof raw !== "object") return null;
    const damage = Math.max(0, Math.round(Number(raw.damage) || 0));
    if (!damage) return null;
    return {
      key: String(raw.key || ""),
      name: String(raw.name || raw.key || "weapon"),
      damage,
      strength: clamp(Math.round(Number(raw.strength) || 1), 1, 20),
      armorPiercing: clamp(Math.round(Number(raw.armorPiercing) || 0), 0, 100),
      rarity: String(raw.rarity || ""),
      ...(raw.weaponType ? { weaponType: String(raw.weaponType) } : {})
    };
  }

  function cleanCombatant(raw, fallbackName) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "").trim();
    if (!id) return null;

    const hpMax = Math.max(1, Math.round(Number(raw.hpMax) || 1));
    const hpRaw = Number(raw.hp);
    const hp = Number.isFinite(hpRaw) ? clamp(Math.round(hpRaw), 0, hpMax) : hpMax;
    if (hp <= 0) return null;

    const personalCombat = Math.max(1, Math.round(Number(raw.personalCombat) || 1));
    const strength = clamp(Math.round(Number(raw.strength) || DEFAULT_STRENGTH), 1, 20);
    const armor = Math.max(0, Math.round(Number(raw.armor) || 0));
    return {
      id, name: String(raw.name || fallbackName || id), hp, hpMax, personalCombat, strength, armor,
      weapon: cleanWeapon(raw.weapon)
    };
  }

  // A weapon only works when its owner is strong enough to swing it.
  const weaponInHand = (combatant) =>
    combatant.weapon && combatant.strength >= combatant.weapon.strength ? combatant.weapon : null;

  function attackDamage(attacker) {
    const stat = Number(attacker[ATTACK_STAT]);
    const weapon = weaponInHand(attacker);
    const personal = Math.round((Number.isFinite(stat) ? stat : 1) * ATTACK_MULTIPLIER);
    return Math.max(MIN_DAMAGE, personal + (weapon ? weapon.damage : 0));
  }

  // Resolve one hit: base damage, the armor remaining after piercing, and the final loss.
  function resolveHit(attacker, defender, defending) {
    const weapon = weaponInHand(attacker);
    const base = attackDamage(attacker);
    const armor = Math.max(0, Math.round(Number(defender.armor) || 0));
    const armorPiercing = weapon ? weapon.armorPiercing : 0;
    const effectiveArmor = Math.max(0, Math.round(armor * (100 - armorPiercing) / 100));
    const armorMultiplier = defending ? ARMOR_MULTIPLIER : 1;
    const reduction = Math.min(base, Math.round(effectiveArmor * armorMultiplier));
    return {
      base,
      amount: Math.max(0, base - reduction),
      reduction,
      armor,
      effectiveArmor,
      armorPiercing,
      armorMultiplier,
      weapon,
      weaponDamage: weapon ? weapon.damage : 0,
      tooHeavy: !!attacker.weapon && !weapon
    };
  }

  function pushLog(state, line) {
    state.log.push(String(line));
    if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
  }

  function createCombatModule() {
    let engine = null, bound = false;
    const S = () => engine.state.modules.combat;   // never cache: load() replaces state

    const finish = (winner, depth) => {
      const s = S();
      const playerWon = winner === "player";
      s.active = false;
      s.turn = null;
      s.defending = false;
      s.winnerId = playerWon ? s.player.id : s.enemy.id;
      s.winnerName = playerWon ? s.player.name : s.enemy.name;
      s.loserId = playerWon ? s.enemy.id : s.player.id;
      s.loserName = playerWon ? s.enemy.name : s.player.name;
      s.endedAtTick = engine.now.tick;
      s.endedAt = engine.now.text;

      const line = `${s.loserName} is defeated. ${s.winnerName} wins after ${s.round} round${s.round === 1 ? "" : "s"}.`;
      pushLog(s, line);
      engine.fire({
        type: "combat:ended",
        text: line,
        data: {
          winnerId: s.winnerId, winnerName: s.winnerName,
          loserId: s.loserId, loserName: s.loserName, rounds: s.round
        }
      }, depth);
    };

    const damageText = (attacker, defender, hit, after, hpMax) => {
      const weapon = hit.weapon ? ` with ${hit.weapon.name}` : "";
      const blocked = hit.reduction ? ` (${hit.reduction} blocked by armor)` : "";
      const heavy = hit.tooHeavy
        ? ` — ${attacker.name}'s ${attacker.weapon.name} is too heavy (Strength ${attacker.strength}/${attacker.weapon.strength})`
        : "";
      return `${attacker.name} attacks ${defender.name}${weapon} for ${hit.amount} damage${blocked} (${after}/${hpMax} HP)${heavy}.`;
    };

    const damageData = (attacker, defender, hit, before, after, defended) => ({
      action: "attack",
      sourceId: attacker.id, sourceName: attacker.name,
      targetId: defender.id, targetName: defender.name,
      amount: hit.amount, base: hit.base, hpBefore: before, hpAfter: after, hpMax: defender.hpMax,
      defended,
      armor: hit.armor, effectiveArmor: hit.effectiveArmor, armorMultiplier: hit.armorMultiplier,
      reduction: hit.reduction, armorPiercing: hit.armorPiercing,
      strength: attacker.strength,
      weapon: hit.weapon ? { ...hit.weapon } : null,
      weaponDamage: hit.weaponDamage, tooHeavy: hit.tooHeavy
    });

    const enemyTurn = (depth) => {
      const s = S();
      if (!s.active) return;

      // Basic AI: the enemy always attacks. CombatData.enemyAction is the future hook.
      const defended = s.defending;
      const hit = resolveHit(s.enemy, s.player, defended);
      const before = s.player.hp;
      const after = clamp(before - hit.amount, 0, s.player.hpMax);
      hit.amount = before - after;   // HP cannot drop below 0, so the event shows the real loss
      s.player.hp = after;
      s.defending = false;

      const line = damageText(s.enemy, s.player, hit, after, s.player.hpMax);
      pushLog(s, line);
      engine.fire({ type: "combat:damage", text: line, data: damageData(s.enemy, s.player, hit, before, after, defended) }, depth);

      if (after <= 0) {
        finish("enemy", depth + 1);
        return;
      }

      s.round += 1;
      s.turn = "player";
    };

    const playerAttack = (depth) => {
      const s = S();
      s.defending = false;
      const hit = resolveHit(s.player, s.enemy, false);
      const before = s.enemy.hp;
      const after = clamp(before - hit.amount, 0, s.enemy.hpMax);
      hit.amount = before - after;
      s.enemy.hp = after;

      const line = damageText(s.player, s.enemy, hit, after, s.enemy.hpMax);
      pushLog(s, line);
      engine.fire({ type: "combat:damage", text: line, data: damageData(s.player, s.enemy, hit, before, after, false) }, depth);

      if (after <= 0) {
        finish("player", depth + 1);
        return;
      }
      enemyTurn(depth + 1);
    };

    const playerDefend = (depth) => {
      const s = S();
      s.defending = true;
      const reduction = Math.round(s.player.armor * ARMOR_MULTIPLIER);
      const line = `${s.player.name} braces for the next attack.`;
      pushLog(s, line);
      engine.fire({
        type: "combat:defended",
        text: line,
        data: {
          id: s.player.id, name: s.player.name,
          armor: s.player.armor, reduction
        }
      }, depth);
      enemyTurn(depth + 1);
    };

    const mod = {
      name: "combat", depends: [],

      init(eng) {
        engine = eng;
        engine.slice("combat", defaults());
        if (bound) return; bound = true;   // init runs again on reset: subscribe only once
        engine.on("event:combat:start", (e) => mod.start(e.data || {}, e.depth + 1));
        engine.on("event:combat:action", (e) => mod.action(e.data || {}, e.depth + 1));
      },

      onLoad(eng) {
        engine = eng;
        engine.slice("combat", defaults());
      },

      // Snapshots come from the UI so this module never reads another module's slice.
      start(data = {}, depth = 0) {
        const s = S();
        if (s.active) return null;

        const player = cleanCombatant(data.player, "Player");
        const enemy = cleanCombatant(data.enemy, "Enemy");
        if (!player || !enemy || player.id === enemy.id) return null;

        const fresh = defaults();
        fresh.active = true;
        fresh.round = 1;
        fresh.turn = "player";
        fresh.player = player;
        fresh.enemy = enemy;
        fresh.startedAtTick = engine.now.tick;
        fresh.startedAt = engine.now.text;
        fresh.log = [`${player.name} faces ${enemy.name}. You move first.`];
        Object.assign(s, fresh);

        engine.fire({
          type: "combat:started",
          text: `${player.name} faces ${enemy.name}. You move first.`,
          data: {
            playerId: player.id, playerName: player.name,
            enemyId: enemy.id, enemyName: enemy.name,
            playerWeapon: player.weapon ? { ...player.weapon } : null,
            enemyWeapon: enemy.weapon ? { ...enemy.weapon } : null
          }
        }, depth);
        return s;
      },

      action(data = {}, depth = 0) {
        const s = S();
        if (!s.active || s.turn !== "player") return null;
        const action = ACTIONS.get(String(data.action || ""));
        if (!action) return null;

        if (action.id === "attack") playerAttack(depth);
        else if (action.id === "defend") playerDefend(depth);
        else return null;
        return s;
      }
    };
    return mod;
  }

  global.createCombatModule = createCombatModule;
})(window);
