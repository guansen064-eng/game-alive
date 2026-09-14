(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const audio = window.AliveAudio || { unlock() {}, play() {}, toggle() { return false; }, isEnabled() { return false; } };
  const balance = window.AliveBalance;
  const balanceConfig = balance.config;
  const weaponSystem = window.AliveWeapons;
  const director = window.AliveDirector;
  const upgradeSystem = window.AliveUpgrades;
  const ui = {
    startOverlay: document.querySelector("#start-overlay"),
    startButton: document.querySelector("#start-button"),
    bestRecord: document.querySelector("#best-record"),
    healthText: document.querySelector("#health-text"),
    healthFill: document.querySelector("#health-fill"),
    timer: document.querySelector("#timer"),
    threat: document.querySelector("#threat"),
    kills: document.querySelector("#kills"),
    level: document.querySelector("#level"),
    xpFill: document.querySelector("#xp-fill"),
    overdriveMeter: document.querySelector("#overdrive-meter"),
    overdriveText: document.querySelector("#overdrive-text"),
    overdriveFill: document.querySelector("#overdrive-fill"),
    bossStatus: document.querySelector("#boss-status"),
    bossFill: document.querySelector("#boss-fill"),
    bossName: document.querySelector("#boss-name"),
    bossWarning: document.querySelector("#boss-warning"),
    eventBanner: document.querySelector("#event-banner"),
    eventName: document.querySelector("#event-name"),
    eventDescription: document.querySelector("#event-description"),
    comboDisplay: document.querySelector("#combo-display"),
    comboCount: document.querySelector("#combo-count"),
    weaponRack: document.querySelector("#weapon-rack"),
    soundButton: document.querySelector("#sound-button"),
    pauseButton: document.querySelector("#pause-button"),
    pauseBadge: document.querySelector("#pause-badge"),
    upgradeOverlay: document.querySelector("#upgrade-overlay"),
    upgradeTitle: document.querySelector("#upgrade-title"),
    upgradeOptions: document.querySelector("#upgrade-options"),
    gameOverOverlay: document.querySelector("#game-over-overlay"),
    gameOverTitle: document.querySelector("#game-over-title"),
    result: document.querySelector("#result"),
    restartButton: document.querySelector("#restart-button"),
    menuButton: document.querySelector("#menu-button"),
    joystick: document.querySelector("#joystick"),
    joystickKnob: document.querySelector("#joystick-knob"),
  };

  const WORLD = { width: 2400, height: 1600 };
  const TAU = Math.PI * 2;
  const keys = new Set();
  const enemies = [];
  const projectiles = [];
  const gems = [];
  const particles = [];
  const floaters = [];
  const lightningEffects = [];
  const shockwaves = [];
  const ambientDots = Array.from({ length: 90 }, (_, index) => ({
    x: 45 + ((index * 277) % (WORLD.width - 90)),
    y: 45 + ((index * 163) % (WORLD.height - 90)),
    size: 1 + (index % 3) * 0.65,
  }));

  let viewport = { width: window.innerWidth, height: window.innerHeight, dpr: 1 };
  let player;
  let nextEnemyId = 1;
  let lastFrame = performance.now();
  let shake = 0;
  let joystickPointer = null;
  const joystickInput = { x: 0, y: 0 };
  let currentEvent = null;

  const state = {
    mode: "menu",
    time: 0,
    spawnCooldown: 0.2,
    attackCooldown: 0.2,
    kills: 0,
    level: 1,
    xp: 0,
    xpNext: balanceConfig.xp.firstRequirement,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    nextBossTime: balanceConfig.boss.firstSpawnSeconds,
    bossesDefeated: 0,
    warningTimer: 0,
    eventBannerTimer: 0,
    finalBossSpawned: false,
    overdriveCharge: 0,
    overdriveTimer: 0,
    victory: false,
    lastUpgradeId: null,
  };
  let bestTime = loadBestTime();

  const upgrades = [
    { id: "damage", icon: "+", title: "过载增幅", description: "所有武器伤害 +18%", offensive: true },
    { id: "fireRate", icon: "»", title: "快速充能", description: "所有武器冷却缩短 15%", offensive: true },
    { id: "speed", icon: "↗", title: "轻量靴", description: "移动速度 +25" },
    { id: "health", icon: "♥", title: "生命扩容", description: "最大生命 +20，并回复 20" },
    { id: "multishot", icon: "⁙", title: "分裂核心", description: "每次额外发射 1 枚弹丸", offensive: true },
    { id: "bulletSpeed", icon: "→", title: "磁轨加速", description: "弹丸速度 +100" },
    { id: "magnet", icon: "◇", title: "收集磁场", description: "拾取范围 +50" },
    { id: "armor", icon: "▣", title: "合金外壳", description: "受到的伤害 -1" },
    { id: "pierce", icon: "⊕", title: "相位穿透", description: "弹丸穿透 +1", offensive: true },
    { id: "heal", icon: "+", title: "紧急修复", description: "立即回复 40 点生命" },
    { id: "critical", icon: "!", title: "临界校准", description: "暴击率 +10%", offensive: true },
    { id: "knockback", icon: "↠", title: "动能增幅", description: "弹丸击退效果 +35%" },
    { id: "pulse", icon: "•", title: "脉冲炮", description: "强化基础弹幕", weapon: true, offensive: true },
    { id: "orbit", icon: "◉", title: "轨道刃", description: "增加刀刃并提升切割伤害", weapon: true, offensive: true },
    { id: "chain", icon: "ϟ", title: "链式闪电", description: "增加跳跃目标并缩短冷却", weapon: true, offensive: true },
    { id: "nova", icon: "◎", title: "震荡核心", description: "扩大范围并提升冲击伤害", weapon: true, offensive: true },
    { id: "drone", icon: "◆", title: "哨戒无人机", description: "提升无人机火力与射速", weapon: true, offensive: true },
  ];

  function currentLoadout() {
    return weaponSystem.sanitizeLoadout(window.ALIVE_LOADOUT);
  }

  function createPlayer() {
    const weaponProgress = weaponSystem.createProgress(currentLoadout());
    return {
      x: WORLD.width / 2,
      y: WORLD.height / 2,
      radius: 17,
      speed: 250,
      maxHealth: 100,
      health: 100,
      armor: 0,
      pickupRadius: balanceConfig.player.pickupRadius,
      damage: balanceConfig.player.damage,
      damageMultiplier: 1,
      cooldownMultiplier: 1,
      attackInterval: balanceConfig.player.attackInterval,
      bulletSpeed: 620,
      bulletCount: 1,
      pierce: 1,
      criticalChance: balanceConfig.player.criticalChance,
      criticalMultiplier: balanceConfig.player.criticalMultiplier,
      knockback: 105,
      weaponProgress,
      supportLevels: {},
      pulseLevel: weaponProgress.pulse.level,
      orbitBlades: weaponProgress.orbit.level,
      orbitDamage: 11 + weaponProgress.orbit.level * 4,
      orbitAngle: 0,
      chainLevel: weaponProgress.chain.level,
      chainCooldown: 0,
      novaLevel: weaponProgress.nova.level,
      novaCooldown: 0,
      droneLevel: weaponProgress.drone.level,
      droneCooldown: 0,
      hurtCooldown: 0,
      facingX: 1,
      facingY: 0,
    };
  }

  function resetGame(mode = "running") {
    enemies.length = 0;
    projectiles.length = 0;
    gems.length = 0;
    particles.length = 0;
    floaters.length = 0;
    lightningEffects.length = 0;
    shockwaves.length = 0;
    player = createPlayer();
    nextEnemyId = 1;
    state.mode = mode;
    state.time = 0;
    state.spawnCooldown = 0.2;
    state.attackCooldown = 0.2;
    state.kills = 0;
    state.level = 1;
    state.xp = 0;
    state.xpNext = balanceConfig.xp.firstRequirement;
    state.combo = 0;
    state.comboTimer = 0;
    state.maxCombo = 0;
    state.nextBossTime = balanceConfig.boss.firstSpawnSeconds;
    state.bossesDefeated = 0;
    state.warningTimer = 0;
    state.eventBannerTimer = 0;
    state.finalBossSpawned = false;
    state.overdriveCharge = 0;
    state.overdriveTimer = 0;
    state.victory = false;
    state.lastUpgradeId = null;
    currentEvent = null;
    shake = 0;
    lastFrame = performance.now();
    document.body.classList.toggle("is-menu", mode === "menu");
    ui.startOverlay.hidden = mode !== "menu";
    ui.gameOverOverlay.hidden = true;
    ui.gameOverOverlay.classList.remove("victory-overlay");
    ui.upgradeOverlay.hidden = true;
    ui.pauseBadge.hidden = true;
    ui.bossStatus.hidden = true;
    ui.bossWarning.hidden = true;
    ui.eventBanner.hidden = true;
    ui.comboDisplay.hidden = true;
    ui.pauseButton.textContent = "Ⅱ";
    ui.gameOverTitle.textContent = "信号中断";
    ui.restartButton.innerHTML = "重新出发 <kbd>Enter</kbd>";
    updateSoundButton();
    updateWeaponRack();
    renderBestRecord();
    updateHud();
    if (mode === "menu") ui.startButton.focus();
    else canvas.focus();
  }

  function loadBestTime() {
    try {
      return Number(localStorage.getItem("alive-best-time")) || 0;
    } catch {
      return 0;
    }
  }

  function saveBestTime(value) {
    try {
      localStorage.setItem("alive-best-time", String(value));
    } catch {
      // Some privacy modes disable local storage; the game remains fully playable.
    }
  }

  function formatTime(value) {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value) % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function renderBestRecord() {
    ui.bestRecord.textContent = bestTime > 0 ? formatTime(bestTime) : "尚未建立";
  }

  function resize() {
    viewport.width = window.innerWidth;
    viewport.height = window.innerHeight;
    viewport.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(viewport.width * viewport.dpr);
    canvas.height = Math.round(viewport.height * viewport.dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function normalized(dx, dy) {
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  }

  function movementInput() {
    let x = 0;
    let y = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
    x += joystickInput.x;
    y += joystickInput.y;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  function spawnEnemy() {
    if (enemies.length >= 450) return;
    const threat = state.time / balanceConfig.enemy.threatSeconds;
    const eliteMultiplier = currentEvent?.eliteMultiplier || 1;
    const eliteChance = state.time < 45 ? 0 : Math.min(0.24, (0.035 + state.time / 1800) * eliteMultiplier);
    const elite = Math.random() < eliteChance;
    const archetypeChances = director.baseArchetypeChances(state.time);
    const runnerChance = Math.max(archetypeChances.runner, currentEvent?.runnerBias || 0);
    const bruteChance = Math.max(archetypeChances.brute, currentEvent?.bruteBias || 0);
    const archetypeRoll = Math.random();
    const archetype = archetypeRoll < runnerChance ? "runner" : archetypeRoll < runnerChance + bruteChance ? "brute" : "hunter";
    const angle = Math.random() * TAU;
    const spawnDistance = Math.max(viewport.width, viewport.height) * 0.62 + random(100, 230);
    let x = player.x + Math.cos(angle) * spawnDistance;
    let y = player.y + Math.sin(angle) * spawnDistance;
    x = clamp(x, 38, WORLD.width - 38);
    y = clamp(y, 38, WORLD.height - 38);
    if (Math.hypot(x - player.x, y - player.y) < 400) {
      const direction = normalized(x - player.x, y - player.y);
      x = clamp(player.x + direction.x * 400, 38, WORLD.width - 38);
      y = clamp(player.y + direction.y * 400, 38, WORLD.height - 38);
    }

    let maxHealth = balanceConfig.enemy.healthBase + threat * balanceConfig.enemy.healthPerThreat;
    let speed = balanceConfig.enemy.speedBase
      + Math.min(balanceConfig.enemy.speedCapBonus, threat * balanceConfig.enemy.speedPerThreat)
      + random(-8, 10);
    let damage = balanceConfig.enemy.damageBase + threat * balanceConfig.enemy.damagePerThreat;
    let radius = 18;
    let name = "追猎体";
    if (archetype === "runner") {
      maxHealth *= 0.68;
      speed *= 1.48;
      damage *= 0.82;
      radius = 14;
      name = "疾行体";
    } else if (archetype === "brute") {
      maxHealth *= 2.35;
      speed *= 0.64;
      damage *= 1.45;
      radius = 26;
      name = "重装体";
    }
    if (elite) {
      maxHealth *= 3.4;
      speed *= 0.88;
      damage *= 1.65;
      radius *= 1.38;
      name = `强化${name}`;
    }
    enemies.push({
      id: nextEnemyId++, x, y, radius, speed, damage, elite, archetype,
      boss: false, name,
      health: maxHealth, maxHealth, attackCooldown: 0, orbitCooldown: 0,
      vx: 0, vy: 0, phase: Math.random() * TAU, dead: false,
    });
  }

  function spawnBoss() {
    const finalBoss = state.time >= director.finalBossSeconds;
    const angle = Math.random() * TAU;
    const distance = Math.max(viewport.width, viewport.height) * 0.62 + 210;
    const x = clamp(player.x + Math.cos(angle) * distance, 58, WORLD.width - 58);
    const y = clamp(player.y + Math.sin(angle) * distance, 58, WORLD.height - 58);
    let maxHealth = balanceConfig.boss.healthBase
      + state.time * balanceConfig.boss.healthPerSecond
      + state.bossesDefeated * balanceConfig.boss.healthPerDefeat;
    if (finalBoss) maxHealth *= 1.45;
    enemies.push({
      id: nextEnemyId++, x, y, radius: finalBoss ? 58 : 48, speed: 54 + state.bossesDefeated * 3,
      damage: 19 + state.bossesDefeated * 3, elite: false, boss: true, finalBoss,
      name: finalBoss ? "裂隙主脑 · 完全体" : "裂隙主脑",
      health: maxHealth, maxHealth, attackCooldown: 0, orbitCooldown: 0,
      vx: 0, vy: 0, phase: 0, dead: false,
    });
    if (finalBoss) {
      state.finalBossSpawned = true;
      state.nextBossTime = Infinity;
    } else {
      state.nextBossTime = Math.max(
        state.nextBossTime + balanceConfig.boss.spawnIntervalSeconds,
        state.time + 45,
      );
    }
    state.warningTimer = 3.2;
    ui.bossWarning.hidden = false;
    ui.bossWarning.querySelector("strong").textContent = finalBoss ? "最终目标已降临 · 击破即可完成协议" : "高能生命信号正在接近";
    audio.play("boss");
    shake = 12;
  }

  function nearestEnemy() {
    let target = null;
    let nearestDistance = Infinity;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const distance = distanceSquared(player, enemy);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        target = enemy;
      }
    }
    return target;
  }

  function fireWeapon() {
    if (player.pulseLevel <= 0) return;
    const target = nearestEnemy();
    if (!target) return;
    const direction = normalized(target.x - player.x, target.y - player.y);
    player.facingX = direction.x;
    player.facingY = direction.y;
    const baseAngle = Math.atan2(direction.y, direction.x);
    const spread = 9 * Math.PI / 180;
    const evolved = player.weaponProgress.pulse.evolved;
    const projectileCount = player.bulletCount + (evolved ? 2 : 0);
    const pulseDamage = player.damage + (player.pulseLevel - 1) * 4 + (evolved ? 6 : 0);
    for (let index = 0; index < projectileCount; index++) {
      const offset = (index - (projectileCount - 1) * 0.5) * spread;
      const angle = baseAngle + offset;
      projectiles.push({
        x: player.x + direction.x * 24,
        y: player.y + direction.y * 24,
        previousX: player.x,
        previousY: player.y,
        dx: Math.cos(angle),
        dy: Math.sin(angle),
        speed: player.bulletSpeed,
        damage: pulseDamage,
        life: 1.8,
        hitsLeft: player.pierce + (evolved ? 2 : 0),
        hitIds: new Set(),
        color: evolved ? "#ffe77d" : "#9af5ff",
      });
    }
    burst(player.x + direction.x * 20, player.y + direction.y * 20, "#7cefff", 3, 70);
    audio.play("shoot");
  }

  function damagePlayer(amount) {
    if (player.hurtCooldown > 0) return;
    const damage = Math.max(1, amount - player.armor);
    player.health -= damage;
    player.hurtCooldown = 0.18;
    shake = Math.min(13, shake + 7);
    addFloater(player.x, player.y - 28, `-${Math.ceil(damage)}`, "#ff6a86");
    burst(player.x, player.y, "#ff5678", 10, 145);
    audio.play("hurt");
    if (player.health <= 0) endGame();
  }

  function applyDamage(enemy, baseDamage, directionX = 0, directionY = 0, knockbackScale = 1) {
    if (enemy.dead) return;
    const critical = Math.random() < player.criticalChance;
    const overdriveMultiplier = state.overdriveTimer > 0 ? 1.25 : 1;
    const damage = baseDamage * player.damageMultiplier * (critical ? player.criticalMultiplier : 1) * overdriveMultiplier;
    enemy.health -= damage;
    const resistance = enemy.boss ? 0.22 : enemy.elite ? 0.55 : 1;
    enemy.vx += directionX * player.knockback * knockbackScale * resistance;
    enemy.vy += directionY * player.knockback * knockbackScale * resistance;
    addFloater(enemy.x, enemy.y - enemy.radius, `${critical ? "暴击 " : ""}${Math.round(damage)}`, critical ? "#ffe477" : "#bff7ff");
    burst(enemy.x, enemy.y, critical ? "#ffe477" : "#77eaff", critical ? 7 : 4, critical ? 125 : 80);
    audio.play(critical ? "critical" : "hit");
    if (enemy.health <= 0) killEnemy(enemy);
  }

  function killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = 2.4;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    chargeOverdrive(enemy);
    if (enemy.boss) {
      state.bossesDefeated += 1;
      gems.push({ x: enemy.x, y: enemy.y, value: balanceConfig.xp.bossGemValue, spin: Math.random() * TAU });
      shockwaves.push({ x: enemy.x, y: enemy.y, radius: 10, maxRadius: 260, life: 0.8, maxLife: 0.8, color: "#e08aff" });
      burst(enemy.x, enemy.y, "#d779ff", 42, 280);
      audio.play("bossKill");
      shake = 18;
      if (enemy.finalBoss) {
        endGame(true);
        return;
      }
    } else {
      gems.push({
        x: enemy.x,
        y: enemy.y,
        value: enemy.elite ? balanceConfig.xp.eliteGemValue : balanceConfig.xp.normalGemValue,
        spin: Math.random() * TAU,
      });
      burst(enemy.x, enemy.y, enemy.elite ? "#c876ff" : "#ff5678", enemy.elite ? 18 : 9, enemy.elite ? 190 : 125);
      audio.play("kill");
    }
  }

  function chargeOverdrive(enemy) {
    if (state.overdriveTimer > 0) {
      state.overdriveTimer = Math.min(9, state.overdriveTimer + (enemy.elite || enemy.boss ? 0.35 : 0.1));
      return;
    }
    const gain = enemy.boss ? 34 : enemy.elite ? 20 : enemy.archetype === "brute" ? 12 : 8;
    state.overdriveCharge = Math.min(100, state.overdriveCharge + gain);
    if (state.overdriveCharge < 100) return;
    state.overdriveTimer = 7.5;
    addFloater(player.x, player.y - 58, "超载启动", "#ffe477");
    shockwaves.push({ x: player.x, y: player.y, radius: 20, maxRadius: 190, life: 0.55, maxLife: 0.55, color: "#ffe477" });
    burst(player.x, player.y, "#ffe477", 22, 190);
    shake = Math.max(shake, 11);
    audio.play("levelup");
  }

  function updateRunDirector(delta) {
    const nextEvent = director.eventAt(state.time);
    if (nextEvent?.id !== currentEvent?.id) {
      currentEvent = nextEvent;
      if (currentEvent) {
        ui.eventName.textContent = currentEvent.name;
        ui.eventDescription.textContent = currentEvent.description;
        ui.eventBanner.hidden = false;
        state.eventBannerTimer = 3.4;
        audio.play("boss");
      }
    }
    state.eventBannerTimer = Math.max(0, state.eventBannerTimer - delta);
    if (state.eventBannerTimer <= 0) ui.eventBanner.hidden = true;

    if (state.overdriveTimer > 0) {
      state.overdriveTimer = Math.max(0, state.overdriveTimer - delta);
      if (state.overdriveTimer <= 0) state.overdriveCharge = 0;
    }
  }

  function gainXp(value) {
    state.xp += value;
    if (state.xp >= state.xpNext && state.mode === "running") startLevelUp();
  }

  function startLevelUp() {
    state.xp -= state.xpNext;
    state.level += 1;
    state.xpNext = balance.xpRequirementForLevel(state.level);
    state.mode = "levelup";
    audio.play("levelup");
    const available = upgrades.filter(isUpgradeAvailable);
    const evolutionChoices = weaponSystem.evolutionCandidates(player.weaponProgress, player.supportLevels).map((id) => {
      const weapon = weaponSystem.definitions[id];
      return {
        id: `evolve:${id}`,
        icon: "✦",
        title: weapon.evolution.name,
        description: `${weapon.name}完成进化 · ${weapon.evolution.description}`,
        evolution: true,
      };
    });
    const choices = upgradeSystem.selectChoices({
      available,
      evolutions: evolutionChoices,
      level: state.level,
      lastUpgradeId: state.lastUpgradeId,
    });
    if (evolutionChoices.length) {
      ui.upgradeTitle.textContent = `等级 ${state.level} · 武器进化可用`;
    } else {
      ui.upgradeTitle.textContent = `等级 ${state.level} · 选择一项强化`;
    }
    ui.upgradeOptions.replaceChildren();
    choices.forEach((upgrade, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `upgrade-option${upgrade.evolution ? " evolution" : ""}`;
      const description = upgrade.weapon
        ? `${upgrade.description} · LV.${player.weaponProgress[upgrade.id].level} → LV.${player.weaponProgress[upgrade.id].level + 1}`
        : upgrade.description;
      const title = upgrade.weapon ? `${upgrade.title}强化` : upgrade.title;
      button.innerHTML = `
        <span class="upgrade-icon">${upgrade.icon}</span>
        <span class="upgrade-copy"><strong>${title}</strong><small>${description}</small></span>
        <span class="upgrade-key">0${index + 1}</span>`;
      button.addEventListener("click", () => chooseUpgrade(upgrade.id));
      ui.upgradeOptions.append(button);
    });
    ui.upgradeOverlay.hidden = false;
    ui.upgradeOptions.querySelector("button")?.focus();
    updateHud();
  }

  function isUpgradeAvailable(upgrade) {
    if (upgrade.weapon) return weaponSystem.canLevel(upgrade.id, player.weaponProgress);
    switch (upgrade.id) {
      case "fireRate": return player.cooldownMultiplier > 0.46;
      case "multishot": return player.pulseLevel > 0 && player.bulletCount < 7;
      case "bulletSpeed":
      case "pierce": return player.pulseLevel > 0;
      case "critical": return player.criticalChance < 0.5;
      default: return true;
    }
  }

  function chooseUpgrade(id) {
    state.lastUpgradeId = id;
    if (id.startsWith("evolve:")) {
      evolveWeapon(id.slice(7));
      finishUpgradeChoice();
      return;
    }
    const selectedUpgrade = upgrades.find((upgrade) => upgrade.id === id);
    if (selectedUpgrade && !selectedUpgrade.weapon && id !== "heal") {
      player.supportLevels[id] = (player.supportLevels[id] || 0) + 1;
    }
    switch (id) {
      case "damage": player.damageMultiplier *= 1.18; break;
      case "fireRate": player.cooldownMultiplier = Math.max(0.42, player.cooldownMultiplier * 0.85); break;
      case "speed": player.speed += 25; break;
      case "health": player.maxHealth += 20; player.health = Math.min(player.maxHealth, player.health + 20); break;
      case "multishot": player.bulletCount = Math.min(7, player.bulletCount + 1); break;
      case "bulletSpeed": player.bulletSpeed += 100; break;
      case "magnet": player.pickupRadius += 50; break;
      case "armor": player.armor += 1; break;
      case "pierce": player.pierce += 1; break;
      case "heal": player.health = Math.min(player.maxHealth, player.health + 40); break;
      case "critical": player.criticalChance = Math.min(0.5, player.criticalChance + 0.1); break;
      case "knockback": player.knockback *= 1.35; break;
      case "pulse": player.weaponProgress.pulse.level += 1; player.pulseLevel = player.weaponProgress.pulse.level; break;
      case "orbit": player.weaponProgress.orbit.level += 1; player.orbitBlades = player.weaponProgress.orbit.level; player.orbitDamage += 4; break;
      case "chain": player.weaponProgress.chain.level += 1; player.chainLevel = player.weaponProgress.chain.level; player.chainCooldown = 0.2; break;
      case "nova": player.weaponProgress.nova.level += 1; player.novaLevel = player.weaponProgress.nova.level; player.novaCooldown = 0.3; break;
      case "drone": player.weaponProgress.drone.level += 1; player.droneLevel = player.weaponProgress.drone.level; player.droneCooldown = 0.15; break;
    }
    finishUpgradeChoice();
  }

  function evolveWeapon(id) {
    const progress = player.weaponProgress[id];
    if (!progress || !weaponSystem.canEvolve(id, player.weaponProgress, player.supportLevels)) return;
    progress.evolved = true;
    if (id === "pulse") player.damage += 6;
    if (id === "orbit") player.orbitDamage += 12;
    if (id === "chain") player.chainCooldown = 0;
    if (id === "nova") player.novaCooldown = 0;
    if (id === "drone") player.droneCooldown = 0;
    const weapon = weaponSystem.definitions[id];
    addFloater(player.x, player.y - 46, weapon.evolution.name, "#ffe477");
    shockwaves.push({ x: player.x, y: player.y, radius: 18, maxRadius: 220, life: 0.75, maxLife: 0.75, color: "#ffe477" });
    burst(player.x, player.y, "#ffe477", 28, 230);
    shake = 14;
    audio.play("levelup");
  }

  function finishUpgradeChoice() {
    updateWeaponRack();
    ui.upgradeOverlay.hidden = true;
    state.mode = "running";
    canvas.focus();
    if (state.xp >= state.xpNext) startLevelUp();
  }

  function update(delta) {
    state.time += delta;
    updateRunDirector(delta);
    state.spawnCooldown -= delta;
    state.attackCooldown -= delta;
    state.warningTimer = Math.max(0, state.warningTimer - delta);
    if (state.warningTimer <= 0) ui.bossWarning.hidden = true;
    state.comboTimer = Math.max(0, state.comboTimer - delta);
    if (state.comboTimer <= 0) state.combo = 0;
    player.hurtCooldown = Math.max(0, player.hurtCooldown - delta);
    const cooldownDelta = delta * (state.overdriveTimer > 0 ? 1.45 : 1);
    player.chainCooldown = Math.max(0, player.chainCooldown - cooldownDelta);
    player.novaCooldown = Math.max(0, player.novaCooldown - cooldownDelta);
    player.droneCooldown = Math.max(0, player.droneCooldown - cooldownDelta);
    player.orbitAngle += delta * (1.8 + player.orbitBlades * 0.08);

    if (state.time >= state.nextBossTime && !enemies.some((enemy) => enemy.boss && !enemy.dead)) spawnBoss();

    const move = movementInput();
    if (move.x || move.y) {
      player.facingX = move.x;
      player.facingY = move.y;
    }
    const moveSpeed = player.speed * (state.overdriveTimer > 0 ? 1.12 : 1);
    player.x = clamp(player.x + move.x * moveSpeed * delta, 28, WORLD.width - 28);
    player.y = clamp(player.y + move.y * moveSpeed * delta, 28, WORLD.height - 28);

    if (state.spawnCooldown <= 0) {
      const count = 1 + Math.floor(state.time / balanceConfig.enemy.spawnCountStepSeconds);
      for (let index = 0; index < count; index++) spawnEnemy();
      state.spawnCooldown = Math.max(
        balanceConfig.enemy.minimumSpawnCooldown,
        balanceConfig.enemy.spawnBaseCooldown - state.time * balanceConfig.enemy.spawnCooldownDecay,
      ) / (currentEvent?.spawnRate || 1);
    }

    for (let index = enemies.length - 1; index >= 0; index--) {
      const enemy = enemies[index];
      if (enemy.dead) {
        enemies.splice(index, 1);
        continue;
      }
      enemy.phase += delta * 4;
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
      enemy.orbitCooldown = Math.max(0, enemy.orbitCooldown - delta);
      const direction = normalized(player.x - enemy.x, player.y - enemy.y);
      enemy.x += (direction.x * enemy.speed + enemy.vx) * delta;
      enemy.y += (direction.y * enemy.speed + enemy.vy) * delta;
      enemy.vx *= Math.pow(0.025, delta);
      enemy.vy *= Math.pow(0.025, delta);
      enemy.x = clamp(enemy.x, enemy.radius, WORLD.width - enemy.radius);
      enemy.y = clamp(enemy.y, enemy.radius, WORLD.height - enemy.radius);
      if (distanceSquared(player, enemy) < Math.pow(player.radius + enemy.radius, 2) && enemy.attackCooldown <= 0) {
        enemy.attackCooldown = 0.72;
        damagePlayer(enemy.damage);
        if (state.mode !== "running") return;
      }
    }

    updateSpecialWeapons();

    for (let index = projectiles.length - 1; index >= 0; index--) {
      const bullet = projectiles[index];
      bullet.previousX = bullet.x;
      bullet.previousY = bullet.y;
      bullet.x += bullet.dx * bullet.speed * delta;
      bullet.y += bullet.dy * bullet.speed * delta;
      bullet.life -= delta;
      let expired = bullet.life <= 0;
      if (!expired) {
        for (const enemy of enemies) {
          if (enemy.dead || bullet.hitIds.has(enemy.id)) continue;
          if (distanceSquared(bullet, enemy) <= Math.pow(enemy.radius + 8, 2)) {
            bullet.hitIds.add(enemy.id);
            applyDamage(enemy, bullet.damage, bullet.dx, bullet.dy, 1);
            bullet.hitsLeft -= 1;
            if (bullet.hitsLeft <= 0) {
              expired = true;
              break;
            }
          }
        }
      }
      if (expired) projectiles.splice(index, 1);
    }

    if (player.pulseLevel > 0 && state.attackCooldown <= 0 && enemies.length) {
      fireWeapon();
      const levelRateBonus = Math.max(0.72, 1 - (player.pulseLevel - 1) * 0.055);
      const overdriveRate = state.overdriveTimer > 0 ? 0.62 : 1;
      state.attackCooldown = player.attackInterval * player.cooldownMultiplier * levelRateBonus * overdriveRate;
    }

    for (let index = gems.length - 1; index >= 0; index--) {
      const gem = gems[index];
      gem.spin += delta * 2.8;
      const distance = Math.hypot(player.x - gem.x, player.y - gem.y);
      const pickupRadius = player.pickupRadius * (currentEvent?.pickupMultiplier || 1);
      if (distance < pickupRadius) {
        const direction = normalized(player.x - gem.x, player.y - gem.y);
        const pull = 280 + (1 - distance / pickupRadius) * 540;
        gem.x += direction.x * pull * delta;
        gem.y += direction.y * pull * delta;
      }
      if (Math.hypot(player.x - gem.x, player.y - gem.y) < 23) {
        gainXp(gem.value);
        audio.play("pickup");
        gems.splice(index, 1);
        if (state.mode !== "running") break;
      }
    }

    updateEffects(delta);
    shake = Math.max(0, shake - delta * 24);
  }

  function updateSpecialWeapons() {
    if (player.orbitBlades > 0) {
      const orbitRadius = 66 + player.orbitBlades * 4 + (player.weaponProgress.orbit.evolved ? 18 : 0);
      for (let blade = 0; blade < player.orbitBlades; blade++) {
        const angle = player.orbitAngle + blade / player.orbitBlades * TAU;
        const bladeX = player.x + Math.cos(angle) * orbitRadius;
        const bladeY = player.y + Math.sin(angle) * orbitRadius;
        for (const enemy of enemies) {
          if (enemy.dead || enemy.orbitCooldown > 0) continue;
          const dx = enemy.x - bladeX;
          const dy = enemy.y - bladeY;
          if (dx * dx + dy * dy <= Math.pow(enemy.radius + 12, 2)) {
            const direction = normalized(dx, dy);
            enemy.orbitCooldown = player.weaponProgress.orbit.evolved ? 0.24 : 0.42;
            const damage = player.orbitDamage * (player.weaponProgress.orbit.evolved ? 1.8 : 1);
            applyDamage(enemy, damage, direction.x, direction.y, 0.7);
          }
        }
      }
    }

    if (player.chainLevel > 0 && player.chainCooldown <= 0) fireChainLightning();
    if (player.novaLevel > 0 && player.novaCooldown <= 0) fireNova();
    if (player.droneLevel > 0 && player.droneCooldown <= 0) fireDrones();
  }

  function fireChainLightning() {
    const living = enemies.filter((enemy) => !enemy.dead);
    if (!living.length) return;
    const targets = [];
    let origin = player;
    const evolved = player.weaponProgress.chain.evolved;
    const maximumTargets = 2 + player.chainLevel + (evolved ? 4 : 0);
    for (let index = 0; index < maximumTargets; index++) {
      let nearest = null;
      let nearestDistance = index === 0 ? 500 * 500 : 280 * 280;
      for (const enemy of living) {
        if (targets.includes(enemy)) continue;
        const distance = distanceSquared(origin, enemy);
        if (distance < nearestDistance) {
          nearest = enemy;
          nearestDistance = distance;
        }
      }
      if (!nearest) break;
      targets.push(nearest);
      origin = nearest;
    }
    if (!targets.length) return;

    const points = [{ x: player.x, y: player.y }];
    let previous = player;
    for (const target of targets) {
      points.push({ x: target.x, y: target.y });
      const direction = normalized(target.x - previous.x, target.y - previous.y);
      applyDamage(target, (8 + player.chainLevel * 5) * (evolved ? 1.45 : 1), direction.x, direction.y, 0.3);
      previous = target;
    }
    lightningEffects.push({ points, life: 0.16, maxLife: 0.16 });
    player.chainCooldown = (evolved ? Math.max(0.48, 1.35 - player.chainLevel * 0.12) : Math.max(0.8, 2.7 - player.chainLevel * 0.3)) * player.cooldownMultiplier;
    audio.play("chain");
  }

  function fireNova() {
    const evolved = player.weaponProgress.nova.evolved;
    const radius = 175 + player.novaLevel * 18 + (evolved ? 95 : 0);
    const damage = (11 + player.novaLevel * 8) * (evolved ? 1.7 : 1);
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (distance <= radius + enemy.radius) {
        const direction = normalized(enemy.x - player.x, enemy.y - player.y);
        applyDamage(enemy, damage, direction.x, direction.y, 1.5);
      }
    }
    shockwaves.push({ x: player.x, y: player.y, radius: 12, maxRadius: radius, life: 0.5, maxLife: 0.5, color: "#68e8ff" });
    if (evolved) shockwaves.push({ x: player.x, y: player.y, radius: 30, maxRadius: radius * 0.76, life: 0.72, maxLife: 0.72, color: "#ffe477" });
    player.novaCooldown = (evolved ? Math.max(1.45, 3.8 - player.novaLevel * 0.38) : Math.max(2.1, 6.2 - player.novaLevel * 0.65)) * player.cooldownMultiplier;
    shake = Math.min(10, shake + 4);
    audio.play("nova");
  }

  function fireDrones() {
    const evolved = player.weaponProgress.drone.evolved;
    const droneCount = evolved ? 3 : 1 + Math.floor((player.droneLevel - 1) / 3);
    const living = enemies.filter((enemy) => !enemy.dead).sort((a, b) => distanceSquared(player, a) - distanceSquared(player, b));
    if (!living.length) return;
    for (let index = 0; index < droneCount; index++) {
      const angle = player.orbitAngle * 0.62 + index / droneCount * TAU;
      const originX = player.x + Math.cos(angle) * 43;
      const originY = player.y + Math.sin(angle) * 43;
      const target = living[index % Math.min(living.length, droneCount)];
      const direction = normalized(target.x - originX, target.y - originY);
      projectiles.push({
        x: originX,
        y: originY,
        previousX: originX,
        previousY: originY,
        dx: direction.x,
        dy: direction.y,
        speed: 720,
        damage: (6 + player.droneLevel * 4) * (evolved ? 1.35 : 1),
        life: 1.6,
        hitsLeft: evolved ? 2 : 1,
        hitIds: new Set(),
        color: evolved ? "#ffe477" : "#68f0ad",
      });
    }
    player.droneCooldown = (evolved ? 0.36 : Math.max(0.62, 1.18 - player.droneLevel * 0.1)) * player.cooldownMultiplier;
    audio.play("shoot");
  }

  function updateEffects(delta) {
    for (let index = particles.length - 1; index >= 0; index--) {
      const particle = particles[index];
      particle.x += particle.dx * delta;
      particle.y += particle.dy * delta;
      particle.dx *= Math.pow(0.04, delta);
      particle.dy *= Math.pow(0.04, delta);
      particle.life -= delta;
      if (particle.life <= 0) particles.splice(index, 1);
    }
    for (let index = floaters.length - 1; index >= 0; index--) {
      const floater = floaters[index];
      floater.y -= 35 * delta;
      floater.life -= delta;
      if (floater.life <= 0) floaters.splice(index, 1);
    }
    for (let index = lightningEffects.length - 1; index >= 0; index--) {
      lightningEffects[index].life -= delta;
      if (lightningEffects[index].life <= 0) lightningEffects.splice(index, 1);
    }
    for (let index = shockwaves.length - 1; index >= 0; index--) {
      const wave = shockwaves[index];
      wave.life -= delta;
      wave.radius += (wave.maxRadius - wave.radius) * Math.min(1, delta * 11);
      if (wave.life <= 0) shockwaves.splice(index, 1);
    }
  }

  function burst(x, y, color, count, speed) {
    if (particles.length > 600) return;
    for (let index = 0; index < count; index++) {
      const angle = Math.random() * TAU;
      const velocity = random(speed * 0.35, speed);
      particles.push({
        x, y, color,
        dx: Math.cos(angle) * velocity,
        dy: Math.sin(angle) * velocity,
        radius: random(1.5, 3.8),
        life: random(0.2, 0.48),
        maxLife: 0.48,
      });
    }
  }

  function addFloater(x, y, text, color) {
    if (floaters.length > 80) return;
    floaters.push({ x, y, text, color, life: 0.65, maxLife: 0.65 });
  }

  function cameraPosition() {
    return {
      x: clamp(player.x - viewport.width / 2, 0, Math.max(0, WORLD.width - viewport.width)),
      y: clamp(player.y - viewport.height / 2, 0, Math.max(0, WORLD.height - viewport.height)),
    };
  }

  function draw() {
    const dpr = viewport.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    const camera = cameraPosition();
    const shakeX = shake ? random(-shake, shake) : 0;
    const shakeY = shake ? random(-shake, shake) : 0;
    ctx.save();
    ctx.translate(-camera.x + shakeX, -camera.y + shakeY);
    drawWorld(camera);
    for (const wave of shockwaves) drawShockwave(wave);
    for (const gem of gems) drawGem(gem);
    for (const particle of particles) drawParticle(particle);
    for (const enemy of enemies) if (!enemy.dead) drawEnemy(enemy);
    for (const projectile of projectiles) drawProjectile(projectile);
    for (const lightning of lightningEffects) drawLightning(lightning);
    drawOrbitBlades();
    drawDrones();
    drawPlayer();
    for (const floater of floaters) drawFloater(floater);
    ctx.restore();

    const vignette = ctx.createRadialGradient(
      viewport.width / 2, viewport.height / 2, Math.min(viewport.width, viewport.height) * 0.22,
      viewport.width / 2, viewport.height / 2, Math.max(viewport.width, viewport.height) * 0.74,
    );
    vignette.addColorStop(0, "rgba(2, 8, 17, 0)");
    vignette.addColorStop(1, "rgba(1, 5, 12, 0.52)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
  }

  function drawWorld(camera) {
    ctx.fillStyle = "#081625";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    const grid = 80;
    const startX = Math.floor(camera.x / grid) * grid;
    const startY = Math.floor(camera.y / grid) * grid;
    ctx.beginPath();
    for (let x = startX; x <= camera.x + viewport.width + grid; x += grid) {
      ctx.moveTo(x, Math.max(0, camera.y - grid));
      ctx.lineTo(x, Math.min(WORLD.height, camera.y + viewport.height + grid));
    }
    for (let y = startY; y <= camera.y + viewport.height + grid; y += grid) {
      ctx.moveTo(Math.max(0, camera.x - grid), y);
      ctx.lineTo(Math.min(WORLD.width, camera.x + viewport.width + grid), y);
    }
    ctx.strokeStyle = "rgba(75, 163, 201, 0.10)";
    ctx.lineWidth = 1;
    ctx.stroke();

    for (const dot of ambientDots) {
      if (dot.x < camera.x - 10 || dot.x > camera.x + viewport.width + 10 || dot.y < camera.y - 10 || dot.y > camera.y + viewport.height + 10) continue;
      ctx.fillStyle = "rgba(79, 201, 237, 0.18)";
      ctx.fillRect(dot.x, dot.y, dot.size, dot.size);
    }

    ctx.strokeStyle = "rgba(70, 174, 217, 0.6)";
    ctx.lineWidth = 5;
    ctx.strokeRect(2.5, 2.5, WORLD.width - 5, WORLD.height - 5);
  }

  function drawPlayer() {
    const flash = player.hurtCooldown > 0 && Math.floor(player.hurtCooldown * 40) % 2 === 0;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = "rgba(0, 0, 0, 0.27)";
    ctx.beginPath();
    ctx.ellipse(2, 13, 22, 10, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 24;
    ctx.shadowColor = "rgba(76, 210, 255, 0.52)";
    ctx.fillStyle = "#17334d";
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, TAU);
    ctx.fill();
    ctx.fillStyle = flash ? "#ffffff" : "#55d6ff";
    ctx.beginPath();
    ctx.arc(0, -1, 15, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 13;
    ctx.shadowColor = "#d8fbff";
    ctx.fillStyle = "#eafcff";
    ctx.beginPath();
    ctx.arc(0, -1, 6, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ffdc72";
    ctx.fillStyle = "#ffdc72";
    ctx.beginPath();
    ctx.arc(player.facingX * 20, player.facingY * 20, 4.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(enemy) {
    if (enemy.boss) {
      drawBoss(enemy);
      return;
    }
    const wobble = Math.sin(enemy.phase) * 0.08;
    const archetypeColors = {
      hunter: ["#f65575", "#72263b"],
      runner: ["#ff9e56", "#7b3d25"],
      brute: ["#ef6f9d", "#69283f"],
    };
    const palette = archetypeColors[enemy.archetype] || archetypeColors.hunter;
    const color = enemy.elite ? "#ba69f4" : palette[0];
    const dark = enemy.elite ? "#54256e" : palette[1];
    const direction = normalized(player.x - enemy.x, player.y - enemy.y);
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(wobble);
    ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
    ctx.beginPath();
    ctx.ellipse(2, enemy.radius * 0.55, enemy.radius, enemy.radius * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = enemy.elite ? 24 : 10;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -2, enemy.radius - 4, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    const eyeOffset = enemy.radius * 0.32;
    const eyeY = -enemy.radius * 0.16;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-eyeOffset, eyeY, enemy.radius * 0.15, 0, TAU);
    ctx.arc(eyeOffset, eyeY, enemy.radius * 0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#25142d";
    ctx.beginPath();
    ctx.arc(-eyeOffset + direction.x * 2, eyeY + direction.y * 2, enemy.radius * 0.07, 0, TAU);
    ctx.arc(eyeOffset + direction.x * 2, eyeY + direction.y * 2, enemy.radius * 0.07, 0, TAU);
    ctx.fill();
    if (enemy.health < enemy.maxHealth) {
      const width = enemy.radius * 2;
      ctx.fillStyle = "rgba(22, 14, 30, 0.88)";
      ctx.fillRect(-width / 2, -enemy.radius - 11, width, 4);
      ctx.fillStyle = "#73f99c";
      ctx.fillRect(-width / 2, -enemy.radius - 11, width * Math.max(0, enemy.health / enemy.maxHealth), 4);
    }
    ctx.restore();
  }

  function drawBoss(enemy) {
    const pulse = 1 + Math.sin(enemy.phase * 0.7) * 0.035;
    const direction = normalized(player.x - enemy.x, player.y - enemy.y);
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.scale(pulse, pulse);
    ctx.rotate(enemy.phase * 0.08);
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.beginPath();
    ctx.ellipse(4, 32, 57, 27, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 34;
    ctx.shadowColor = "rgba(206, 103, 255, 0.62)";
    ctx.fillStyle = "#4b225f";
    ctx.beginPath();
    for (let point = 0; point < 12; point++) {
      const angle = point / 12 * TAU;
      const radius = point % 2 ? 43 : 57;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (point === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-enemy.phase * 0.16);
    ctx.fillStyle = "#c25ff0";
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ffe9ff";
    ctx.fillStyle = "#f6dcff";
    ctx.beginPath();
    ctx.ellipse(direction.x * 8, direction.y * 8, 13, 9, Math.atan2(direction.y, direction.x), 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#32103e";
    ctx.beginPath();
    ctx.arc(direction.x * 12, direction.y * 12, 5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawOrbitBlades() {
    if (player.orbitBlades <= 0) return;
    const orbitRadius = 66 + player.orbitBlades * 4 + (player.weaponProgress.orbit.evolved ? 18 : 0);
    ctx.save();
    ctx.strokeStyle = "rgba(100, 233, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, orbitRadius, 0, TAU);
    ctx.stroke();
    for (let blade = 0; blade < player.orbitBlades; blade++) {
      const angle = player.orbitAngle + blade / player.orbitBlades * TAU;
      const x = player.x + Math.cos(angle) * orbitRadius;
      const y = player.y + Math.sin(angle) * orbitRadius;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#6feeff";
      ctx.fillStyle = "#a8f6ff";
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 10);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawDrones() {
    if (player.droneLevel <= 0) return;
    const evolved = player.weaponProgress.drone.evolved;
    const droneCount = evolved ? 3 : 1 + Math.floor((player.droneLevel - 1) / 3);
    for (let index = 0; index < droneCount; index++) {
      const angle = player.orbitAngle * 0.62 + index / droneCount * TAU;
      const x = player.x + Math.cos(angle) * 43;
      const y = player.y + Math.sin(angle) * 43;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.shadowBlur = evolved ? 20 : 12;
      ctx.shadowColor = evolved ? "#ffe477" : "#68f0ad";
      ctx.fillStyle = evolved ? "#ffe9a0" : "#9bffd0";
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(8, 5);
      ctx.lineTo(0, 2);
      ctx.lineTo(-8, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawLightning(effect) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, effect.life / effect.maxLife);
    ctx.lineCap = "round";
    for (let index = 1; index < effect.points.length; index++) {
      const start = effect.points[index - 1];
      const end = effect.points[index];
      const segments = 6;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let segment = 1; segment < segments; segment++) {
        const ratio = segment / segments;
        ctx.lineTo(
          start.x + (end.x - start.x) * ratio + random(-10, 10),
          start.y + (end.y - start.y) * ratio + random(-10, 10),
        );
      }
      ctx.lineTo(end.x, end.y);
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#bcf8ff";
      ctx.strokeStyle = "#d9fcff";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShockwave(wave) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, wave.life / wave.maxLife);
    ctx.strokeStyle = wave.color;
    ctx.lineWidth = 5 * wave.life / wave.maxLife + 1;
    ctx.shadowBlur = 18;
    ctx.shadowColor = wave.color;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawProjectile(bullet) {
    const color = bullet.color || "#9af5ff";
    ctx.save();
    ctx.strokeStyle = "rgba(75, 212, 255, 0.22)";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bullet.previousX, bullet.previousY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
    ctx.shadowBlur = 16;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 4.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawGem(gem) {
    const size = gem.value >= 5 ? 11 : 8;
    ctx.save();
    ctx.translate(gem.x, gem.y);
    ctx.rotate(gem.spin);
    ctx.shadowBlur = 15;
    ctx.shadowColor = gem.value >= 5 ? "#ffd76d" : "#56efaa";
    ctx.fillStyle = gem.value >= 5 ? "#ffd76d" : "#56efaa";
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.75, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.75, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawParticle(particle) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawFloater(floater) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
    ctx.fillStyle = floater.color;
    ctx.font = "700 13px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(floater.text, floater.x, floater.y);
    ctx.restore();
  }

  function updateHud() {
    const healthRatio = Math.max(0, player.health / player.maxHealth);
    ui.healthText.textContent = `${Math.ceil(Math.max(0, player.health))} / ${Math.round(player.maxHealth)}`;
    ui.healthFill.style.setProperty("--bar-fill", healthRatio);
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time) % 60;
    ui.timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    const phase = director.phaseAt(state.time);
    ui.threat.textContent = `阶段 ${phase.numeral} · ${phase.name} · 威胁 ${1 + Math.floor(state.time / 30)}`;
    ui.kills.textContent = state.kills;
    ui.level.textContent = `LV.${state.level}`;
    ui.xpFill.style.setProperty("--bar-fill", Math.min(1, state.xp / state.xpNext));
    const overdriveActive = state.overdriveTimer > 0;
    ui.overdriveMeter.classList.toggle("active", overdriveActive);
    ui.overdriveText.textContent = overdriveActive
      ? `超载运行 ${state.overdriveTimer.toFixed(1)}s`
      : `超载充能 ${Math.round(state.overdriveCharge)}%`;
    ui.overdriveFill.style.setProperty("--bar-fill", overdriveActive ? 1 : state.overdriveCharge / 100);
    const boss = enemies.find((enemy) => enemy.boss && !enemy.dead);
    ui.bossStatus.hidden = !boss || state.mode === "menu";
    if (boss) {
      ui.bossName.textContent = boss.name;
      ui.bossFill.style.setProperty("--bar-fill", Math.max(0, boss.health / boss.maxHealth));
    }
    ui.comboDisplay.hidden = state.combo < 3 || state.mode !== "running";
    ui.comboCount.textContent = `×${state.combo}`;
  }

  function updateWeaponRack() {
    for (const item of ui.weaponRack.querySelectorAll("[data-weapon]")) {
      const id = item.dataset.weapon;
      const progress = player.weaponProgress[id];
      const weapon = weaponSystem.definitions[id];
      const active = progress?.level > 0;
      item.hidden = !active;
      item.classList.toggle("active", active);
      item.classList.toggle("evolved", Boolean(progress?.evolved));
      if (!active) continue;
      const name = progress.evolved ? weapon.evolution.name : weapon.shortName;
      item.innerHTML = `<i>${weapon.icon}</i>${name}<b>LV.${progress.level}</b>`;
      item.title = progress.evolved ? `${weapon.name}已进化为${weapon.evolution.name}` : `${weapon.name} LV.${progress.level}`;
    }
  }

  function updateSoundButton() {
    const enabled = audio.isEnabled();
    ui.soundButton.classList.toggle("muted", !enabled);
    ui.soundButton.textContent = enabled ? "♪" : "×";
    ui.soundButton.setAttribute("aria-label", enabled ? "关闭音效" : "开启音效");
  }

  function togglePause() {
    if (state.mode === "running") {
      state.mode = "paused";
      ui.pauseBadge.hidden = false;
      ui.pauseButton.textContent = "▶";
    } else if (state.mode === "paused") {
      state.mode = "running";
      ui.pauseBadge.hidden = true;
      ui.pauseButton.textContent = "Ⅱ";
      lastFrame = performance.now();
      canvas.focus();
    }
  }

  function endGame(victory = false) {
    state.mode = "gameover";
    state.victory = victory;
    if (state.time > bestTime) {
      bestTime = state.time;
      saveBestTime(bestTime);
    }
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time) % 60;
    ui.gameOverTitle.textContent = victory ? "生存协议完成" : "信号中断";
    ui.gameOverOverlay.classList.toggle("victory-overlay", victory);
    ui.restartButton.innerHTML = `${victory ? "再次执行" : "重新出发"} <kbd>Enter</kbd>`;
    ui.result.innerHTML = `
      <div><strong>${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}</strong><span>${victory ? "完成时间" : "坚持时间"}</span></div>
      <div><strong>${state.kills}</strong><span>消灭敌人</span></div>
      <div><strong>LV.${state.level}</strong><span>最终等级</span></div>
      <div><strong>×${state.maxCombo}</strong><span>最高连杀</span></div>`;
    ui.gameOverOverlay.hidden = false;
    ui.restartButton.focus();
  }

  function frame(now) {
    const delta = Math.min(0.033, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (state.mode === "running") update(delta);
    else updateEffects(delta);
    draw();
    updateHud();
    requestAnimationFrame(frame);
  }

  function updateJoystick(event) {
    const rect = ui.joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maximum = rect.width * 0.34;
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > maximum) {
      dx = dx / distance * maximum;
      dy = dy / distance * maximum;
    }
    joystickInput.x = dx / maximum;
    joystickInput.y = dy / maximum;
    ui.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  function releaseJoystick() {
    joystickPointer = null;
    joystickInput.x = 0;
    joystickInput.y = 0;
    ui.joystickKnob.style.transform = "translate(-50%, -50%)";
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    if (!event.repeat && state.mode === "menu" && !document.body.classList.contains("menu-surface-open") && !document.body.classList.contains("auth-open") && (event.code === "Enter" || event.code === "Space")) {
      event.preventDefault();
      audio.unlock();
      audio.play("start");
      resetGame();
      return;
    }
    if (!event.repeat && event.code === "Escape" && ["running", "paused", "levelup"].includes(state.mode)) {
      event.preventDefault();
      keys.clear();
      releaseJoystick();
      resetGame("menu");
      return;
    }
    if (!event.repeat && event.code === "KeyP") togglePause();
    if (!event.repeat && state.mode === "levelup" && ["Digit1", "Digit2", "Digit3"].includes(event.code)) {
      const index = Number(event.code.at(-1)) - 1;
      ui.upgradeOptions.children[index]?.click();
    }
    if (!event.repeat && state.mode === "gameover" && event.code === "Enter") {
      event.preventDefault();
      audio.play("start");
      resetGame();
      return;
    }
    keys.add(event.code);
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => {
    keys.clear();
    releaseJoystick();
    if (state.mode === "running") togglePause();
  });
  ui.startButton.addEventListener("click", () => {
    audio.unlock();
    audio.play("start");
    resetGame();
  });
  ui.pauseButton.addEventListener("click", togglePause);
  ui.soundButton.addEventListener("click", () => {
    audio.toggle();
    updateSoundButton();
  });
  ui.restartButton.addEventListener("click", () => {
    audio.play("start");
    resetGame();
  });
  ui.menuButton.addEventListener("click", () => resetGame("menu"));
  ui.joystick.addEventListener("pointerdown", (event) => {
    joystickPointer = event.pointerId;
    ui.joystick.setPointerCapture(event.pointerId);
    updateJoystick(event);
  });
  ui.joystick.addEventListener("pointermove", (event) => {
    if (event.pointerId === joystickPointer) updateJoystick(event);
  });
  ui.joystick.addEventListener("pointerup", (event) => {
    if (event.pointerId === joystickPointer) releaseJoystick();
  });
  ui.joystick.addEventListener("pointercancel", releaseJoystick);

  resize();
  resetGame("menu");
  requestAnimationFrame(frame);
})();
