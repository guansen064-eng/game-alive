(function exposeAliveDirector(root, factory) {
  const director = factory();
  if (typeof module === "object" && module.exports) module.exports = director;
  root.AliveDirector = director;
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  "use strict";

  const finalBossSeconds = 600;
  const phases = Object.freeze([
    Object.freeze({ id: "contact", startsAt: 0, name: "接触", numeral: "I" }),
    Object.freeze({ id: "swarm", startsAt: 120, name: "围猎", numeral: "II" }),
    Object.freeze({ id: "siege", startsAt: 240, name: "重压", numeral: "III" }),
    Object.freeze({ id: "rupture", startsAt: 360, name: "裂变", numeral: "IV" }),
    Object.freeze({ id: "collapse", startsAt: 480, name: "坍缩", numeral: "V" }),
  ]);

  const events = Object.freeze([
    Object.freeze({ id: "runnerRush", startsAt: 90, duration: 20, name: "疾行猎群", description: "高速单位正在集中涌入", spawnRate: 1.32, runnerBias: 0.52 }),
    Object.freeze({ id: "heavyLine", startsAt: 210, duration: 24, name: "重装列阵", description: "高耐久单位突破边界", spawnRate: 1.12, bruteBias: 0.42 }),
    Object.freeze({ id: "crystalStorm", startsAt: 330, duration: 22, name: "晶体风暴", description: "经验晶体的感应范围大幅提升", spawnRate: 1, pickupMultiplier: 3 }),
    Object.freeze({ id: "mutation", startsAt: 450, duration: 30, name: "异变过载", description: "精英出现率与敌潮密度上升", spawnRate: 1.24, eliteMultiplier: 2.4 }),
    Object.freeze({ id: "lastStand", startsAt: 570, duration: 30, name: "最终防线", description: "裂隙主脑完全体即将降临", spawnRate: 1.38, eliteMultiplier: 1.7 }),
  ]);

  function phaseAt(timeSeconds) {
    let current = phases[0];
    for (const phase of phases) {
      if (timeSeconds >= phase.startsAt) current = phase;
      else break;
    }
    return current;
  }

  function eventAt(timeSeconds) {
    return events.find((event) => timeSeconds >= event.startsAt && timeSeconds < event.startsAt + event.duration) || null;
  }

  function baseArchetypeChances(timeSeconds) {
    const phase = phaseAt(timeSeconds);
    const index = phases.indexOf(phase);
    return {
      runner: Math.min(0.28, index * 0.055),
      brute: Math.min(0.2, Math.max(0, index - 1) * 0.055),
    };
  }

  return Object.freeze({ finalBossSeconds, phases, events, phaseAt, eventAt, baseArchetypeChances });
});
