"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../audio.js"), "utf8");

function setup(preferences = {}) {
  const storage = new Map(Object.entries(preferences));
  const timers = new Map();
  const listeners = {};
  const nodes = [];
  let context;
  let nextTimer = 1;
  const parameter = () => ({
    value: 0,
    setValueAtTime(value) { this.value = value; },
    exponentialRampToValueAtTime(value) { this.value = value; },
    setTargetAtTime(value) { this.value = value; },
  });
  const node = (kind) => {
    const value = {
      kind, gain: parameter(), frequency: parameter(), Q: parameter(),
      connect() {},
      disconnect() { this.disconnected = true; },
      start(time) { this.started = time; },
      stop(time) {
        this.stopped = time;
        if (time === undefined) this.onended?.();
      },
    };
    nodes.push(value);
    return value;
  };
  class AudioContext {
    constructor() { context = this; this.state = "running"; this.currentTime = 0; this.sampleRate = 8000; }
    createGain() { return node("gain"); }
    createBiquadFilter() { return node("filter"); }
    createOscillator() { return node("oscillator"); }
    createBufferSource() { return node("noise"); }
    createBuffer(channels, size) { return { getChannelData: () => new Float32Array(size) }; }
    resume() { this.state = "running"; return Promise.resolve(); }
  }
  const document = { hidden: false, addEventListener: (name, callback) => { listeners[name] = callback; } };
  const window = { AudioContext, addEventListener: (name, callback) => { listeners[name] = callback; } };
  vm.runInNewContext(source, {
    window, document, performance: { now: () => 1000 },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    setInterval(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
    clearInterval: (id) => timers.delete(id),
  });
  return {
    audio: window.AliveAudio, timers, nodes, storage, document, listeners,
    get context() { return context; },
    tick(time) { context.currentTime = time; for (const callback of timers.values()) callback(); },
    voices: () => nodes.filter((item) => ["oscillator", "noise"].includes(item.kind)),
  };
}

test("音乐不会在页面加载或仅设置游戏状态时自动创建音频上下文", () => {
  const env = setup();
  env.audio.setMusicState("running");
  assert.equal(env.context, undefined);
  assert.equal(env.timers.size, 0);
  env.audio.unlock();
  assert.equal(env.timers.size, 1);
  assert.ok(env.voices().length > 0);
});

test("重复更新状态和解锁不会叠加循环，暂停会断开所有已排队音符", () => {
  const env = setup();
  env.audio.unlock();
  env.audio.setMusicState("running");
  for (let i = 0; i < 100; i++) { env.audio.setMusicState("running"); env.audio.unlock(); }
  assert.equal(env.timers.size, 1);
  const voices = env.voices();
  env.audio.setMusicState("paused");
  assert.equal(env.timers.size, 0);
  assert.ok(voices.every((voice) => voice.disconnected));
  env.audio.setMusicState("running");
  assert.equal(env.timers.size, 1);
});

test("结算、菜单和重开清理音乐，下一局从相同乐句开始", () => {
  const env = setup();
  env.audio.unlock();
  env.audio.setMusicState("running");
  const opening = env.voices().map((voice) => voice.frequency.value);
  env.tick(4);
  env.audio.setMusicState("gameover");
  assert.equal(env.timers.size, 0);
  env.audio.resetMusic();
  const count = env.voices().length;
  env.audio.setMusicState("running");
  assert.deepEqual(env.voices().slice(count).map((voice) => voice.frequency.value), opening);
  env.audio.setMusicState("menu");
  assert.equal(env.timers.size, 0);
});

test("音乐音量单独持久化，零音量不影响音效总开关", () => {
  const env = setup({ "alive-music-volume": "0.3" });
  assert.equal(env.audio.getMusicVolume(), 0.3);
  env.audio.unlock();
  env.audio.setMusicState("running");
  env.audio.setMusicVolume(0);
  assert.equal(env.timers.size, 0);
  assert.equal(env.audio.isEnabled(), true);
  assert.equal(env.storage.get("alive-music-volume"), "0");
  env.audio.setMusicVolume(0.65);
  assert.equal(env.timers.size, 1);
  assert.equal(env.storage.get("alive-music-volume"), "0.65");
});

test("总开关同时静音音乐与音效，恢复时只启动一个循环", () => {
  const env = setup();
  env.audio.unlock();
  env.audio.setMusicState("running");
  env.audio.toggle();
  assert.equal(env.timers.size, 0);
  assert.equal(env.nodes[0].gain.value, 0);
  const count = env.voices().length;
  env.audio.play("shoot");
  assert.equal(env.voices().length, count);
  env.audio.toggle();
  assert.equal(env.timers.size, 1);
  assert.equal(env.nodes[0].gain.value, 1);
});

test("后台隐藏立即清理音乐，暂停状态下返回页面不会偷跑", () => {
  const env = setup();
  env.audio.unlock();
  env.audio.setMusicState("running");
  env.document.hidden = true;
  env.listeners.visibilitychange();
  assert.equal(env.timers.size, 0);
  env.audio.setMusicState("paused");
  env.document.hidden = false;
  env.listeners.visibilitychange();
  assert.equal(env.timers.size, 0);
  env.audio.setMusicState("running");
  assert.equal(env.timers.size, 1);
  env.listeners.pagehide();
  assert.equal(env.timers.size, 0);
});

test("Boss 节奏更密集，升级界面仅保留旋律与铺底", () => {
  const count = (mode, boss) => {
    const env = setup();
    env.audio.unlock();
    env.audio.setMusicState(mode, boss);
    for (let i = 1; i <= 8; i++) env.tick(i * 0.3);
    return { voices: env.voices().length, noise: env.voices().filter((voice) => voice.kind === "noise").length };
  };
  const normal = count("running", false);
  const boss = count("running", true);
  const calm = count("levelup", true);
  assert.ok(boss.voices > normal.voices);
  assert.ok(calm.voices < normal.voices);
  assert.equal(calm.noise, 0);
});

test("卡顿恢复不补发积压音符，损坏偏好恢复默认音量", () => {
  const env = setup({ "alive-music-volume": "invalid" });
  assert.equal(env.audio.getMusicVolume(), 0.5);
  env.audio.unlock();
  env.audio.setMusicState("running");
  const count = env.voices().length;
  env.tick(60);
  assert.ok(env.voices().length - count < 10);
  env.audio.setMusicVolume(NaN);
  assert.equal(env.audio.getMusicVolume(), 0.5);
});
