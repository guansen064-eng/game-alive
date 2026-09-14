(() => {
  "use strict";

  let context = null;
  let master = null;
  let enabled = readPreference();
  const lastPlayed = new Map();

  function readPreference() {
    try {
      return localStorage.getItem("alive-sound") !== "off";
    } catch {
      return true;
    }
  }

  function savePreference() {
    try {
      localStorage.setItem("alive-sound", enabled ? "on" : "off");
    } catch {
      // Storage can be unavailable in private browsing; sound still works.
    }
  }

  function unlock() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
    }
    if (context.state === "suspended") context.resume();
    return true;
  }

  function tone(frequency, duration, options = {}) {
    if (!enabled || !unlock()) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime + (options.delay || 0);
    const volume = options.volume ?? 0.16;
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function canPlay(name, interval) {
    const now = performance.now();
    if (now - (lastPlayed.get(name) || 0) < interval) return false;
    lastPlayed.set(name, now);
    return true;
  }

  function play(name) {
    if (!enabled) return;
    switch (name) {
      case "start":
        tone(180, 0.12, { type: "sine", endFrequency: 360, volume: 0.18 });
        tone(360, 0.2, { type: "triangle", endFrequency: 620, volume: 0.12, delay: 0.08 });
        break;
      case "shoot":
        if (canPlay(name, 55)) tone(520, 0.055, { type: "square", endFrequency: 230, volume: 0.055 });
        break;
      case "hit":
        if (canPlay(name, 35)) tone(125, 0.045, { type: "square", endFrequency: 70, volume: 0.045 });
        break;
      case "critical":
        if (canPlay(name, 85)) tone(760, 0.11, { type: "triangle", endFrequency: 1120, volume: 0.1 });
        break;
      case "kill":
        if (canPlay(name, 70)) tone(210, 0.08, { type: "sawtooth", endFrequency: 95, volume: 0.055 });
        break;
      case "pickup":
        if (canPlay(name, 65)) tone(690, 0.07, { type: "sine", endFrequency: 930, volume: 0.055 });
        break;
      case "hurt":
        tone(92, 0.2, { type: "sawtooth", endFrequency: 48, volume: 0.16 });
        break;
      case "levelup":
        [440, 660, 880].forEach((frequency, index) => tone(frequency, 0.22, { type: "triangle", volume: 0.11, delay: index * 0.09 }));
        break;
      case "chain":
        tone(980, 0.12, { type: "square", endFrequency: 420, volume: 0.075 });
        break;
      case "nova":
        tone(110, 0.35, { type: "sine", endFrequency: 45, volume: 0.15 });
        break;
      case "boss":
        tone(72, 0.65, { type: "sawtooth", endFrequency: 46, volume: 0.16 });
        tone(58, 0.65, { type: "square", endFrequency: 42, volume: 0.08, delay: 0.22 });
        break;
      case "bossKill":
        [180, 280, 420, 680].forEach((frequency, index) => tone(frequency, 0.32, { type: "triangle", volume: 0.12, delay: index * 0.08 }));
        break;
    }
  }

  function toggle() {
    enabled = !enabled;
    savePreference();
    if (enabled) {
      unlock();
      tone(520, 0.09, { type: "sine", endFrequency: 780, volume: 0.1 });
    }
    return enabled;
  }

  window.AliveAudio = {
    unlock,
    play,
    toggle,
    isEnabled: () => enabled,
  };
})();
