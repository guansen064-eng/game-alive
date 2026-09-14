"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const weapons = require("../weapons.js");

test("出战编队去重、过滤未知武器并限制为四个", () => {
  assert.deepEqual(
    weapons.sanitizeLoadout(["pulse", "pulse", "unknown", "orbit", "chain", "nova", "drone"]),
    ["pulse", "orbit", "chain", "nova"],
  );
});

test("空编队至少保留一把基础武器", () => {
  assert.deepEqual(weapons.sanitizeLoadout([]), ["pulse"]);
});

test("只有出战武器会以一级进入局内", () => {
  const progress = weapons.createProgress(["orbit", "drone"]);
  assert.equal(progress.orbit.level, 1);
  assert.equal(progress.drone.level, 1);
  assert.equal(progress.pulse.level, 0);
});

test("满级武器仍需对应辅助强化才能进化", () => {
  const progress = weapons.createProgress(["pulse"]);
  progress.pulse.level = 5;
  assert.equal(weapons.canEvolve("pulse", progress, {}), false);
  assert.equal(weapons.canEvolve("pulse", progress, { pierce: 1 }), true);
  progress.pulse.evolved = true;
  assert.equal(weapons.canEvolve("pulse", progress, { pierce: 1 }), false);
});
