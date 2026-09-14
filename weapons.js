(function exposeAliveWeapons(root, factory) {
  const weapons = factory();
  if (typeof module === "object" && module.exports) module.exports = weapons;
  root.AliveWeapons = weapons;
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  "use strict";

  const definitions = Object.freeze({
    pulse: Object.freeze({
      id: "pulse", name: "脉冲炮", shortName: "脉冲炮", icon: "•", maxLevel: 5,
      evolution: Object.freeze({ support: "pierce", name: "相位洪流", description: "弹幕扩展并获得额外穿透，持续撕开整条敌潮。" }),
    }),
    orbit: Object.freeze({
      id: "orbit", name: "轨道刃", shortName: "轨道刃", icon: "◉", maxLevel: 5,
      evolution: Object.freeze({ support: "armor", name: "裂界星环", description: "轨道半径、切割伤害与命中频率全面提升。" }),
    }),
    chain: Object.freeze({
      id: "chain", name: "链式闪电", shortName: "链闪", icon: "ϟ", maxLevel: 5,
      evolution: Object.freeze({ support: "critical", name: "雷暴矩阵", description: "闪电跳跃更多目标，并以更短间隔反复释放。" }),
    }),
    nova: Object.freeze({
      id: "nova", name: "震荡核心", shortName: "冲击波", icon: "◎", maxLevel: 5,
      evolution: Object.freeze({ support: "health", name: "坍缩脉冲", description: "释放巨型双重冲击波，清空近身包围。" }),
    }),
    drone: Object.freeze({
      id: "drone", name: "哨戒无人机", shortName: "无人机", icon: "◆", maxLevel: 5,
      evolution: Object.freeze({ support: "fireRate", name: "蜂群协议", description: "部署三架无人机，以高速齐射覆盖远处目标。" }),
    }),
  });

  const ids = Object.freeze(Object.keys(definitions));

  function sanitizeLoadout(value) {
    const source = Array.isArray(value) ? value : [];
    const unique = [];
    for (const id of source) {
      if (!definitions[id] || unique.includes(id)) continue;
      unique.push(id);
      if (unique.length === 4) break;
    }
    return unique.length ? unique : ["pulse"];
  }

  function createProgress(loadout) {
    const equipped = new Set(sanitizeLoadout(loadout));
    return Object.fromEntries(ids.map((id) => [id, { level: equipped.has(id) ? 1 : 0, evolved: false }]));
  }

  function canLevel(id, progress) {
    const weapon = definitions[id];
    return Boolean(weapon && progress[id]?.level > 0 && progress[id].level < weapon.maxLevel);
  }

  function canEvolve(id, progress, supportLevels) {
    const weapon = definitions[id];
    const weaponProgress = progress[id];
    return Boolean(
      weapon
      && weaponProgress?.level >= weapon.maxLevel
      && !weaponProgress.evolved
      && (supportLevels[weapon.evolution.support] || 0) > 0
    );
  }

  function evolutionCandidates(progress, supportLevels) {
    return ids.filter((id) => canEvolve(id, progress, supportLevels));
  }

  return Object.freeze({ definitions, ids, sanitizeLoadout, createProgress, canLevel, canEvolve, evolutionCandidates });
});
