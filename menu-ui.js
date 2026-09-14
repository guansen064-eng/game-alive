(() => {
  "use strict";

  const API_BASE = "/alive/api";
  const guestWeaponIds = new Set(["pulse", "orbit", "chain", "nova", "drone"]);
  const weapons = [
    { id: "pulse", name: "脉冲炮", rarity: "基础", tone: "cyan", damage: "12", rate: "0.55s", role: "主武器", unlocked: true, description: "高频发射能量弹，自动锁定距离最近的目标。升至 5 级并获得相位穿透，可进化为「相位洪流」。" },
    { id: "orbit", name: "轨道刃", rarity: "稀有", tone: "violet", damage: "15", rate: "持续", role: "近身范围", unlocked: true, description: "围绕玩家高速旋转并连续切割敌人。升至 5 级并获得合金外壳，可进化为「裂界星环」。" },
    { id: "chain", name: "链式闪电", rarity: "稀有", tone: "blue", damage: "13", rate: "2.4s", role: "群体清场", unlocked: true, description: "在多个邻近目标之间跳跃。升至 5 级并获得临界校准，可进化为「雷暴矩阵」。" },
    { id: "nova", name: "震荡核心", rarity: "史诗", tone: "gold", damage: "19", rate: "5.5s", role: "范围爆发", unlocked: true, description: "周期性释放大范围冲击波。升至 5 级并获得生命扩容，可进化为「坍缩脉冲」。" },
    { id: "drone", name: "哨戒无人机", rarity: "稀有", tone: "green", damage: "10", rate: "1.08s", role: "独立索敌", unlocked: true, description: "自主选择远处目标并点射。升至 5 级并获得快速充能，可进化为「蜂群协议」。" },
    { id: "frost", name: "零度射线", rarity: "史诗", tone: "ice", damage: "6", rate: "持续", role: "减速控制", unlocked: false, description: "持续冻结前方敌群，降低其移动速度并叠加易伤。" },
    { id: "void", name: "引力奇点", rarity: "传说", tone: "red", damage: "28", rate: "8.0s", role: "聚怪爆发", unlocked: false, description: "生成短暂奇点，将附近敌人吸入中心后引发一次坍缩爆炸。" },
    { id: "prism", name: "棱镜光矛", rarity: "传说", tone: "rose", damage: "42", rate: "3.2s", role: "直线贯穿", unlocked: false, description: "蓄力后发射贯穿战场的高能光束，对同一直线上的所有敌人造成伤害。" },
  ];

  const ui = {
    arsenal: document.querySelector("#arsenal-overlay"),
    gacha: document.querySelector("#gacha-overlay"),
    openArsenal: document.querySelector("#open-arsenal"),
    openGacha: document.querySelector("#open-gacha"),
    grid: document.querySelector("#weapon-grid"),
    count: document.querySelector("#weapon-count"),
    detailArt: document.querySelector("#detail-art"),
    detailRarity: document.querySelector("#detail-rarity"),
    detailName: document.querySelector("#detail-name"),
    detailDescription: document.querySelector("#detail-description"),
    detailDamage: document.querySelector("#detail-damage"),
    detailRate: document.querySelector("#detail-rate"),
    detailRole: document.querySelector("#detail-role"),
    equip: document.querySelector("#equip-weapon"),
    slots: document.querySelector("#loadout-slots"),
    saveLoadout: document.querySelector("#save-loadout-button"),
    gachaCrystal: document.querySelector("#gacha-crystal"),
    toast: document.querySelector("#menu-toast"),
  };

  let selectedId = "pulse";
  let lastTrigger = null;
  let toastTimer = null;
  let loadout = loadSavedLoadout();
  let currentUser = null;

  async function api(path, options = {}) {
    const init = {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    };
    if (options.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, init);
    } catch {
      throw new Error("无法连接数据服务器。");
    }
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || "数据同步失败，请稍后再试。");
    return data;
  }

  function loadSavedLoadout() {
    try {
      const value = JSON.parse(localStorage.getItem("alive-ui-loadout"));
      if (Array.isArray(value) && value.length === 4) return value.map((id) => weapons.some((weapon) => weapon.id === id && weapon.unlocked) ? id : null);
    } catch {
      // Fall through to the preview default.
    }
    return ["pulse", "orbit", null, null];
  }

  function saveLoadout() {
    try {
      localStorage.setItem("alive-ui-loadout", JSON.stringify(loadout));
    } catch {
      // The preview still works when storage is unavailable.
    }
    window.ALIVE_LOADOUT = [...loadout];
  }

  function applyGuestState() {
    for (const weapon of weapons) weapon.unlocked = guestWeaponIds.has(weapon.id);
    loadout = loadSavedLoadout();
    ui.gachaCrystal.textContent = "1,280";
    saveLoadout();
    renderAll();
  }

  async function loadProfile() {
    try {
      const profile = await api("/player/profile");
      const owned = new Set(profile.weapons.map((weapon) => weapon.code));
      for (const weapon of weapons) weapon.unlocked = owned.has(weapon.id);
      loadout = Array.isArray(profile.loadout) && profile.loadout.length === 4
        ? profile.loadout.map((id) => id && owned.has(id) ? id : null)
        : ["pulse", null, null, null];
      ui.gachaCrystal.textContent = new Intl.NumberFormat("zh-CN").format(profile.wallet.crystal);
      saveLoadout();
      renderAll();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function persistLoadout() {
    if (!currentUser) {
      saveLoadout();
      showToast("游客编队已保存在当前浏览器。");
      closeSurfaces();
      return;
    }

    ui.saveLoadout.disabled = true;
    ui.saveLoadout.textContent = "正在保存…";
    try {
      const data = await api("/player/loadout", { method: "PUT", body: { weaponCodes: loadout } });
      loadout = data.loadout;
      saveLoadout();
      showToast("出战编队已同步到账号。");
      closeSurfaces();
    } catch (error) {
      showToast(error.message);
    } finally {
      ui.saveLoadout.disabled = false;
      ui.saveLoadout.textContent = "保存编队";
    }
  }

  function getWeapon(id) {
    return weapons.find((weapon) => weapon.id === id);
  }

  function renderWeapons() {
    ui.grid.replaceChildren();
    for (const weapon of weapons) {
      const button = document.createElement("button");
      const equipped = loadout.includes(weapon.id);
      button.type = "button";
      button.className = `weapon-card${weapon.id === selectedId ? " selected" : ""}${weapon.unlocked ? "" : " locked"}${equipped ? " equipped" : ""}`;
      button.dataset.weaponId = weapon.id;
      button.setAttribute("aria-pressed", String(weapon.id === selectedId));
      button.innerHTML = `
        <span class="weapon-card-art" data-tone="${weapon.tone}"><i></i></span>
        <span class="weapon-card-copy"><strong>${weapon.name}</strong><small>${weapon.unlocked ? weapon.rarity : "尚未获取"}</small></span>
        <b>${equipped ? "出战" : weapon.unlocked ? "" : "锁定"}</b>`;
      button.addEventListener("click", () => {
        selectedId = weapon.id;
        renderWeapons();
        renderDetail();
      });
      ui.grid.append(button);
    }
  }

  function renderDetail() {
    const weapon = getWeapon(selectedId);
    const equipped = loadout.includes(weapon.id);
    const full = loadout.every(Boolean);
    ui.detailArt.dataset.tone = weapon.tone;
    ui.detailArt.classList.toggle("locked", !weapon.unlocked);
    ui.detailRarity.textContent = weapon.unlocked ? weapon.rarity : "尚未获取";
    ui.detailName.textContent = weapon.name;
    ui.detailDescription.textContent = weapon.description;
    ui.detailDamage.textContent = weapon.damage;
    ui.detailRate.textContent = weapon.rate;
    ui.detailRole.textContent = weapon.role;
    ui.equip.disabled = !weapon.unlocked || (!equipped && full);
    ui.equip.textContent = !weapon.unlocked ? "通过补给获取" : equipped ? "移出出战编队" : full ? "出战编队已满" : "加入出战编队";
  }

  function renderLoadout() {
    ui.slots.replaceChildren();
    loadout.forEach((weaponId, index) => {
      const weapon = getWeapon(weaponId);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `loadout-slot${weapon ? " filled" : ""}`;
      button.setAttribute("aria-label", weapon ? `移除${weapon.name}` : `空武器槽位 ${index + 1}`);
      button.innerHTML = weapon
        ? `<span data-tone="${weapon.tone}"><i></i></span><strong>${weapon.name}</strong><small>点击移除</small>`
        : `<b>+</b><strong>空槽位</strong><small>槽位 ${index + 1}</small>`;
      if (weapon) button.addEventListener("click", () => {
        loadout[index] = null;
        saveLoadout();
        renderAll();
      });
      ui.slots.append(button);
    });
  }

  function renderAll() {
    renderWeapons();
    renderDetail();
    renderLoadout();
    ui.count.textContent = `${weapons.filter((weapon) => weapon.unlocked).length} / ${weapons.length}`;
  }

  function toggleEquip() {
    const weapon = getWeapon(selectedId);
    if (!weapon.unlocked) return;
    const existingIndex = loadout.indexOf(weapon.id);
    if (existingIndex >= 0) {
      loadout[existingIndex] = null;
    } else {
      const emptyIndex = loadout.indexOf(null);
      if (emptyIndex < 0) return;
      loadout[emptyIndex] = weapon.id;
    }
    saveLoadout();
    renderAll();
  }

  function openSurface(surface, trigger) {
    lastTrigger = trigger;
    ui.arsenal.hidden = surface !== ui.arsenal;
    ui.gacha.hidden = surface !== ui.gacha;
    document.body.classList.add("menu-surface-open");
    if (surface === ui.arsenal) renderAll();
    surface.querySelector(".surface-back")?.focus();
  }

  function closeSurfaces() {
    ui.arsenal.hidden = true;
    ui.gacha.hidden = true;
    document.body.classList.remove("menu-surface-open");
    lastTrigger?.focus();
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    ui.toast.textContent = message;
    ui.toast.hidden = false;
    toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 2800);
  }

  ui.openArsenal.addEventListener("click", () => openSurface(ui.arsenal, ui.openArsenal));
  ui.openGacha.addEventListener("click", () => openSurface(ui.gacha, ui.openGacha));
  document.querySelectorAll("[data-close-surface]").forEach((button) => button.addEventListener("click", closeSurfaces));
  ui.saveLoadout.addEventListener("click", persistLoadout);
  document.querySelectorAll("[data-draw]").forEach((button) => button.addEventListener("click", () => showToast("抽取 UI 已完成，武器掉落与晶核消耗将在下一阶段接入。")));
  document.querySelector("[data-odds]").addEventListener("click", () => showToast("概率展示示例：稀有 8% · 史诗 2% · 限定 0.8%，最终数值尚未确定。"));
  ui.equip.addEventListener("click", toggleEquip);
  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape" && document.body.classList.contains("menu-surface-open")) {
      event.preventDefault();
      closeSurfaces();
    }
  });
  window.addEventListener("alive:auth-changed", (event) => {
    currentUser = event.detail.user;
    if (currentUser) loadProfile();
    else applyGuestState();
  });

  saveLoadout();
  renderAll();
})();
