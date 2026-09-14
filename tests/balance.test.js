"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const balance = require("../balance.js");

test("前五级能在约 30 个普通敌人内完成", () => {
  const normalKills = balance.totalXpToReachLevel(5) / balance.config.xp.normalGemValue;
  assert.ok(normalKills <= 30, `当前需要约 ${normalKills.toFixed(1)} 次普通击杀`);
});

test("玩家能在约 30 次普通击杀内升到六级", () => {
  const normalKills = balance.totalXpToReachLevel(6) / balance.config.xp.normalGemValue;
  assert.ok(normalKills <= 30, `当前需要约 ${normalKills.toFixed(1)} 次普通击杀`);
});

test("45 秒时基础火力不会被普通敌潮以两倍以上压垮", () => {
  const pressure = balance.baselinePressureAt(45);
  assert.ok(pressure <= 1.15, `当前压力系数为 ${pressure.toFixed(2)}`);
});

test("首个 Boss 给玩家至少一分钟成型时间", () => {
  assert.ok(balance.config.boss.firstSpawnSeconds >= 60);
});

test("首个 Boss 的基础理论击杀时间不超过 35 秒", () => {
  const killSeconds = balance.baselineBossKillSeconds();
  assert.ok(killSeconds <= 35, `当前约需 ${killSeconds.toFixed(1)} 秒`);
});

test("基础拾取半径足以持续回收击杀经验", () => {
  assert.ok(balance.config.player.pickupRadius >= 150);
});

test("十分钟时的常态刷新量不超过浏览器友好的每秒十二只", () => {
  const spawnRate = balance.enemiesPerSecondAt(600);
  assert.ok(spawnRate <= 12, `当前每秒约刷新 ${spawnRate.toFixed(1)} 只`);
});
