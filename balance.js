(function exposeAliveBalance(root, factory) {
  const balance = factory();
  if (typeof module === "object" && module.exports) module.exports = balance;
  root.AliveBalance = balance;
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  "use strict";

  const config = Object.freeze({
    player: Object.freeze({
      damage: 12,
      attackInterval: 0.55,
      criticalChance: 0.1,
      criticalMultiplier: 2,
      pickupRadius: 160,
    }),
    xp: Object.freeze({
      firstRequirement: 6,
      formulaBase: 4,
      curveExponent: 1.22,
      curveScale: 3.1,
      normalGemValue: 3,
      eliteGemValue: 12,
      bossGemValue: 60,
    }),
    enemy: Object.freeze({
      threatSeconds: 60,
      healthBase: 14,
      healthPerThreat: 6,
      speedBase: 66,
      speedCapBonus: 54,
      speedPerThreat: 4.2,
      damageBase: 6,
      damagePerThreat: 1.25,
      spawnBaseCooldown: 0.96,
      spawnCooldownDecay: 0.0009,
      minimumSpawnCooldown: 0.5,
      spawnCountStepSeconds: 150,
    }),
    boss: Object.freeze({
      firstSpawnSeconds: 60,
      spawnIntervalSeconds: 90,
      healthBase: 420,
      healthPerSecond: 4.5,
      healthPerDefeat: 430,
    }),
  });

  function xpRequirementForLevel(level) {
    if (level <= 1) return config.xp.firstRequirement;
    return Math.round(config.xp.formulaBase + Math.pow(level, config.xp.curveExponent) * config.xp.curveScale);
  }

  function totalXpToReachLevel(targetLevel) {
    let total = 0;
    for (let level = 1; level < targetLevel; level++) {
      total += xpRequirementForLevel(level);
    }
    return total;
  }

  function enemyStatsAt(timeSeconds) {
    const threat = timeSeconds / config.enemy.threatSeconds;
    return {
      health: config.enemy.healthBase + threat * config.enemy.healthPerThreat,
      speed: config.enemy.speedBase + Math.min(config.enemy.speedCapBonus, threat * config.enemy.speedPerThreat),
      damage: config.enemy.damageBase + threat * config.enemy.damagePerThreat,
    };
  }

  function enemiesPerSecondAt(timeSeconds) {
    const count = 1 + Math.floor(timeSeconds / config.enemy.spawnCountStepSeconds);
    const cooldown = Math.max(
      config.enemy.minimumSpawnCooldown,
      config.enemy.spawnBaseCooldown - timeSeconds * config.enemy.spawnCooldownDecay,
    );
    return count / cooldown;
  }

  function baselinePressureAt(timeSeconds) {
    const averageDamage = config.player.damage
      * (1 + config.player.criticalChance * (config.player.criticalMultiplier - 1));
    const shotsPerSecond = 1 / config.player.attackInterval;
    const durabilityInShots = enemyStatsAt(timeSeconds).health / averageDamage;
    return durabilityInShots * enemiesPerSecondAt(timeSeconds) / shotsPerSecond;
  }

  function firstBossHealth() {
    return config.boss.healthBase + config.boss.firstSpawnSeconds * config.boss.healthPerSecond;
  }

  function baselineBossKillSeconds() {
    const damagePerSecond = config.player.damage
      * (1 + config.player.criticalChance * (config.player.criticalMultiplier - 1))
      / config.player.attackInterval;
    return firstBossHealth() / damagePerSecond;
  }

  return Object.freeze({
    config,
    xpRequirementForLevel,
    totalXpToReachLevel,
    enemyStatsAt,
    enemiesPerSecondAt,
    baselinePressureAt,
    firstBossHealth,
    baselineBossKillSeconds,
  });
});
