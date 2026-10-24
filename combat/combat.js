/* Combat module v0.1 — turn-based duels between the main character and one NPC.
   The UI sends combatant snapshots in combat:start and an action in combat:action.
   This module owns the combat slice and emits combat:started / combat:damage /
   combat:defended / combat:ended. The mainCharacter and characters modules apply
   combat:damage to their own slices, so the real characters keep the resulting HP.
   See ENGINE_SPEC.md. */
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
  const ARMOR_MULTIPLIER = Number(DEFEND.armorMultiplier) || 2;
  const LOG_LIMIT = Math.max(1, Math.round(Number(D.logLimit) || 20));

  const defaults = () => ({
    active: false,
    round: 0,
    turn: null,             // "player" while waiting for the player, otherwise null
    player: null,           // combat snapshot: { id, name, hp, hpMax, personalCombat, armor }
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

  function cleanCombatant(raw, fallbackName) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "").trim();
    if (!id) return null;

    const hpMax = Math.max(1, Math.round(Number(raw.hpMax) || 1));
    const hpRaw = Number(raw.hp);
    const hp = Number.isFinite(hpRaw) ? clamp(Math.round(hpRaw), 0, hpMax) : hpMax;
    if (hp <= 0) return null;

    const personalCombat = Math.max(1, Math.round(Number(raw.personalCombat) || 1));
    const armor = Math.max(0, Math.round(Number(raw.armor) || 0));
    return { id, name: String(raw.name || fallbackName || id), hp, hpMax, personalCombat, armor };
  }

  function attackDamage(attacker) {
    const stat = Number(attacker[ATTACK_STAT]);
    return Math.max(MIN_DAMAGE, Math.round((Number.isFinite(stat) ? stat : 1) * ATTACK_MULTIPLIER));
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

    const enemyTurn = (depth) => {
      const s = S();
      if (!s.active) return;

      // Basic AI: the enemy always attacks. CombatData.enemyAction is the future hook.
      const baseDamage = attackDamage(s.enemy);
      const defended = s.defending;
      const reduction = defended ? Math.min(baseDamage, s.player.armor * ARMOR_MULTIPLIER) : 0;
      const damage = Math.max(0, baseDamage - reduction);

      const before = s.player.hp;
      const after = clamp(before - damage, 0, s.player.hpMax);
      const actual = before - after;
      s.player.hp = after;
      s.defending = false;

      const suffix = reduction ? ` (${reduction} blocked by armor)` : "";
      const line = `${s.enemy.name} attacks ${s.player.name} for ${actual} damage${suffix} (${after}/${s.player.hpMax} HP).`;
      pushLog(s, line);
      engine.fire({
        type: "combat:damage",
        text: line,
        data: {
          action: "attack",
          sourceId: s.enemy.id, sourceName: s.enemy.name,
          targetId: s.player.id, targetName: s.player.name,
          amount: actual, hpBefore: before, hpAfter: after, hpMax: s.player.hpMax,
          defended, armor: s.player.armor, reduction
        }
      }, depth);

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
      const damage = attackDamage(s.player);
      const before = s.enemy.hp;
      const after = clamp(before - damage, 0, s.enemy.hpMax);
      const actual = before - after;
      s.enemy.hp = after;

      const line = `${s.player.name} attacks ${s.enemy.name} for ${actual} damage (${after}/${s.enemy.hpMax} HP).`;
      pushLog(s, line);
      engine.fire({
        type: "combat:damage",
        text: line,
        data: {
          action: "attack",
          sourceId: s.player.id, sourceName: s.player.name,
          targetId: s.enemy.id, targetName: s.enemy.name,
          amount: actual, hpBefore: before, hpAfter: after, hpMax: s.enemy.hpMax,
          defended: false, armor: 0, reduction: 0
        }
      }, depth);

      if (after <= 0) {
        finish("player", depth + 1);
        return;
      }
      enemyTurn(depth + 1);
    };

    const playerDefend = (depth) => {
      const s = S();
      s.defending = true;
      const reduction = s.player.armor * ARMOR_MULTIPLIER;
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
            enemyId: enemy.id, enemyName: enemy.name
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
