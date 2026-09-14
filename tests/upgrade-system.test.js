"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const upgradeSystem = require("../upgrade-system.js");

test("刚选择的强化不会在下一次升级中立即重复", () => {
  const available = [
    { id: "chain", weapon: true },
    { id: "damage", offensive: true },
    { id: "speed" },
    { id: "health" },
  ];
  const choices = upgradeSystem.selectChoices({
    available,
    level: 3,
    lastUpgradeId: "chain",
    random: () => 0.99,
  });
  assert.equal(choices.some((upgrade) => upgrade.id === "chain"), false);
});

test("八级前的三个选项中至少有两个输出向强化", () => {
  const available = [
    { id: "chain", weapon: true, offensive: true },
    { id: "damage", offensive: true },
    { id: "speed" },
    { id: "health" },
    { id: "magnet" },
  ];
  const choices = upgradeSystem.selectChoices({ available, level: 5, random: () => 0.4 });
  assert.ok(choices.filter((upgrade) => upgrade.weapon || upgrade.offensive).length >= 2);
});
