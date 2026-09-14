"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const director = require("../director.js");

test("十分钟流程划分为五个连续阶段", () => {
  assert.equal(director.phaseAt(0).id, "contact");
  assert.equal(director.phaseAt(119.9).id, "contact");
  assert.equal(director.phaseAt(120).id, "swarm");
  assert.equal(director.phaseAt(599).id, "collapse");
  assert.equal(director.finalBossSeconds, 600);
});

test("特殊事件仅在自己的时间窗内生效", () => {
  assert.equal(director.eventAt(89.9), null);
  assert.equal(director.eventAt(90).id, "runnerRush");
  assert.equal(director.eventAt(109.9).id, "runnerRush");
  assert.equal(director.eventAt(110), null);
});

test("后期逐步开放疾行体和重装体", () => {
  assert.deepEqual(director.baseArchetypeChances(0), { runner: 0, brute: 0 });
  assert.ok(director.baseArchetypeChances(480).runner > 0);
  assert.ok(director.baseArchetypeChances(480).brute > 0);
});
