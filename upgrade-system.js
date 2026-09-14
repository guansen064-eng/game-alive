(function exposeAliveUpgrades(root, factory) {
  const upgrades = factory();
  if (typeof module === "object" && module.exports) module.exports = upgrades;
  root.AliveUpgrades = upgrades;
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  "use strict";

  function shuffled(items, random = Math.random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function selectChoices({ available, evolutions = [], level, lastUpgradeId = null, random = Math.random }) {
    const withoutImmediateRepeat = available.filter((upgrade) => upgrade.id !== lastUpgradeId);
    const eligible = withoutImmediateRepeat.length ? withoutImmediateRepeat : available;

    if (evolutions.length) {
      const evolution = shuffled(evolutions, random)[0];
      return shuffled([evolution, ...shuffled(eligible, random).slice(0, 2)], random);
    }

    if (level <= 8) {
      const weapons = eligible.filter((upgrade) => upgrade.weapon);
      const offensiveSupports = eligible.filter((upgrade) => !upgrade.weapon && upgrade.offensive);
      const selected = [];
      if (weapons.length) selected.push(shuffled(weapons, random)[0]);
      if (offensiveSupports.length) selected.push(shuffled(offensiveSupports, random)[0]);
      const selectedIds = new Set(selected.map((upgrade) => upgrade.id));
      selected.push(...shuffled(eligible.filter((upgrade) => !selectedIds.has(upgrade.id)), random).slice(0, 3 - selected.length));
      return shuffled(selected, random);
    }
    return shuffled(eligible, random).slice(0, 3);
  }

  return Object.freeze({ shuffled, selectChoices });
});
