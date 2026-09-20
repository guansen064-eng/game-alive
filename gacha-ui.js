(() => {
  "use strict";

  const ui = {
    dialog: document.querySelector("#supply-opening"),
    preference: document.querySelector("#skip-supply-animation"),
    title: document.querySelector("#supply-opening-title"),
    status: document.querySelector("#supply-opening-status"),
    rewards: document.querySelector("#supply-rewards"),
    skip: document.querySelector("#supply-skip"),
    close: document.querySelector("#supply-close"),
    done: document.querySelector("#supply-done"),
    again: document.querySelector("#supply-again"),
    actions: document.querySelector("#supply-result-actions"),
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const timers = new Set();
  const qualities = { 基础: "common", 稀有: "rare", 史诗: "epic", 传说: "legendary" };
  const icons = { pulse: "•", orbit: "◉", chain: "ϟ", nova: "◎", drone: "◆", frost: "❄", void: "✦", prism: "⟡" };
  let drawCount = 1;
  let pool = [];
  let results = [];
  let returnFocus = null;

  try { ui.preference.checked = localStorage.getItem("alive-gacha-skip") === "true"; } catch {}
  ui.preference.addEventListener("change", () => {
    try { localStorage.setItem("alive-gacha-skip", String(ui.preference.checked)); } catch {}
  });

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers.clear();
  }

  function after(delay, callback) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (ui.dialog.open) callback();
    }, delay);
    timers.add(timer);
  }

  function sound(name) {
    if (!document.hidden) window.AliveAudio?.play(name);
  }

  function renderRewards() {
    ui.rewards.replaceChildren();
    ui.rewards.classList.toggle("single", results.length === 1);
    results.forEach((weapon, index) => {
      const card = document.createElement("article");
      card.className = "supply-reward";
      card.dataset.quality = qualities[weapon.rarity] || "common";
      card.dataset.weaponId = weapon.id;
      card.style.setProperty("--reveal-delay", `${index * 80}ms`);
      const beam = document.createElement("div");
      beam.className = "reward-beam";
      beam.setAttribute("aria-hidden", "true");
      const number = document.createElement("small");
      number.className = "reward-number";
      number.textContent = `${String(index + 1).padStart(2, "0")} / CORE`;
      const art = document.createElement("div");
      art.className = "reward-art";
      art.setAttribute("aria-hidden", "true");
      art.textContent = icons[weapon.id] || "✦";
      const rarity = document.createElement("span");
      rarity.className = "reward-rarity";
      rarity.textContent = weapon.rarity;
      const name = document.createElement("h3");
      name.textContent = weapon.name;
      const role = document.createElement("p");
      role.textContent = weapon.role;
      card.append(beam, number, art, rarity, name, role);
      ui.rewards.append(card);
    });
  }

  function finish(instant = false, silent = false) {
    if (!ui.dialog.open || ui.dialog.dataset.phase === "results") return;
    clearTimers();
    ui.dialog.classList.toggle("is-instant", instant);
    ui.dialog.dataset.phase = "results";
    ui.rewards.hidden = false;
    ui.skip.hidden = true;
    ui.actions.hidden = false;
    ui.title.textContent = `${drawCount === 10 ? "十连" : "单次"}补给 · 核心已揭晓`;
    const best = results.reduce((highest, weapon) => Math.max(highest, ["基础", "稀有", "史诗", "传说"].indexOf(weapon.rarity)), 0);
    ui.status.textContent = `${results.length} 件演示武器 · 最高品质：${["基础", "稀有", "史诗", "传说"][best]}`;
    if (!silent) sound("levelup");
    ui.done.focus();
  }

  function start() {
    clearTimers();
    // Generate once before animation: skipping cannot reroll or change the outcome.
    results = Array.from({ length: drawCount }, () => ({ ...pool[Math.floor(Math.random() * pool.length)] }));
    renderRewards();
    ui.dialog.classList.remove("is-instant");
    ui.dialog.dataset.phase = "landing";
    ui.title.textContent = "轨道补给已抵达";
    ui.status.textContent = "补给舱正在着陆…";
    ui.rewards.hidden = true;
    ui.skip.hidden = false;
    ui.actions.hidden = true;
    ui.again.textContent = `再演示${drawCount === 10 ? "十连" : "一次"}`;
    window.AliveAudio?.unlock();
    if (ui.preference.checked || reducedMotion.matches || document.hidden) {
      finish(true, document.hidden);
      return;
    }
    ui.skip.focus();
    after(420, () => sound("nova"));
    after(850, () => {
      ui.dialog.dataset.phase = "charging";
      ui.status.textContent = "核心蓄能中 · 正在解除封锁";
      sound("start");
    });
    after(1900, () => {
      ui.dialog.dataset.phase = "opening";
      ui.status.textContent = "封锁解除 · 检测到武器信号";
      sound("bossKill");
    });
    after(2600, () => {
      ui.dialog.dataset.phase = "revealing";
      ui.rewards.hidden = false;
      ui.status.textContent = "正在解析武器核心…";
    });
    after(3250 + drawCount * 80, () => finish(false, true));
  }

  function open(count, weapons, trigger) {
    if (ui.dialog.open || ![1, 10].includes(count) || !weapons?.length) return;
    drawCount = count;
    pool = weapons;
    returnFocus = trigger || document.activeElement;
    ui.dialog.showModal();
    start();
  }

  function close() {
    clearTimers();
    ui.dialog.close();
  }

  ui.skip.addEventListener("click", () => finish(true));
  ui.close.addEventListener("click", close);
  ui.done.addEventListener("click", close);
  ui.again.addEventListener("click", () => {
    if (ui.dialog.dataset.phase === "results") start();
  });
  ui.dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (ui.dialog.dataset.phase === "results") close();
    else finish(true);
  });
  ui.dialog.addEventListener("close", () => {
    if (ui.dialog.open) return;
    clearTimers();
    ui.dialog.dataset.phase = "idle";
    returnFocus?.focus();
  });
  // Keep Space/Enter/Escape away from the game's global movement/menu handlers.
  ui.dialog.addEventListener("keydown", (event) => event.stopPropagation());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && ui.dialog.open) finish(true, true);
  });
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches && ui.dialog.open) finish(true, true);
  });
  window.AliveGacha = Object.freeze({ open });
})();
