(() => {
  "use strict";

  let context = null;
  let master = null;
  let effectsBus = null;
  let enabled = readPreference();
  const lastPlayed = new Map();
  const MUSIC_BASE_GAIN = 0.65;
  let musicVolume = readMusicVolume();
  let musicBus = null;
  let noiseBuffer = null;
  let musicMode = "menu";
  let bossMusic = false;
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;
  const musicVoices = new Set();
  const STEP_SECONDS = 60 / 100 / 2;
  // Original 100 BPM D-minor loop: Dm – Bb – F – C, two bars per chord.
  const progression = [
    { bass: 38, chord: [62, 65, 69] },
    { bass: 34, chord: [58, 62, 65] },
    { bass: 41, chord: [60, 65, 69] },
    { bass: 36, chord: [60, 64, 67] },
  ];
  const motif = [0, 2, 1, 2, 0, 1, 2, 1];

  function readMusicVolume() {
    try {
      const saved = localStorage.getItem("alive-music-volume");
      const value = saved === null ? 0.5 : Number(saved);
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
    } catch {
      return 0.5;
    }
  }

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
      master.gain.value = enabled ? 1 : 0;
      master.connect(context.destination);
      effectsBus = context.createGain();
      effectsBus.gain.value = 0.16;
      effectsBus.connect(master);
      musicBus = context.createGain();
      musicBus.gain.value = musicVolume * MUSIC_BASE_GAIN;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 2800;
      filter.Q.value = 0.5;
      musicBus.connect(filter);
      filter.connect(master);
      noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.15), context.sampleRate);
      const noise = noiseBuffer.getChannelData(0);
      for (let index = 0; index < noise.length; index++) noise[index] = Math.random() * 2 - 1;
    }
    if (context.state === "suspended") context.resume().then(syncMusic).catch(() => {});
    syncMusic();
    return true;
  }

  function musicNote(midi, start, duration, volume, type = "triangle", attack = 0.015, endFrequency = null) {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    scheduleVoice(oscillator, start, duration, volume, attack);
  }

  function scheduleVoice(source, start, duration, volume, attack) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + attack);
    // Long pads hold their body before release instead of fading almost immediately.
    if (attack >= 0.1) {
      gain.gain.setValueAtTime(volume * 0.85, start + duration * 0.7);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(gain);
    gain.connect(musicBus);
    const voice = { source, gain };
    musicVoices.add(voice);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      musicVoices.delete(voice);
    };
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function percussion(start, volume, duration) {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    scheduleVoice(source, start, duration, volume, 0.004);
  }

  function scheduleMusicStep(step, start) {
    const harmony = progression[Math.floor(step / 16) % progression.length];
    const beat = step % 8;
    const calm = musicMode === "levelup";
    if (beat === 0) {
      harmony.chord.forEach((note) => musicNote(note - 12, start, 2.7, 0.085, "sine", 0.35));
    }
    if (step % 2 === 0 || (bossMusic && !calm)) {
      const note = harmony.chord[motif[step % motif.length]] + (step % 16 >= 8 ? 12 : 0);
      musicNote(note, start, 0.42, calm ? 0.055 : 0.11);
    }
    if (calm) return;
    if ([0, 3, 4, 6].includes(beat)) musicNote(harmony.bass, start, 0.24, 0.3);
    if (step % (bossMusic ? 2 : 4) === 0) musicNote(43, start, 0.2, 0.45, "sine", 0.005, 38);
    if (step % 4 === 2) percussion(start, 0.075, 0.12);
    if (step % 2 === 1) percussion(start, bossMusic ? 0.04 : 0.025, 0.04);
    if (bossMusic && beat === 7) musicNote(harmony.chord[2] + 12, start, 0.25, 0.13, "sine");
  }

  function scheduleMusic() {
    if (!canRunMusic()) {
      stopMusic();
      return;
    }
    // Use the audio clock; after a stalled tab, skip the backlog instead of bursting notes.
    if (nextNoteTime < context.currentTime) nextNoteTime = context.currentTime + 0.02;
    while (nextNoteTime < context.currentTime + 0.12) {
      scheduleMusicStep(musicStep, nextNoteTime);
      musicStep = (musicStep + 1) % 64;
      nextNoteTime += STEP_SECONDS;
    }
  }

  function canRunMusic() {
    return context?.state === "running" && enabled && musicVolume > 0 && !document.hidden
      && (musicMode === "running" || musicMode === "levelup");
  }

  function stopMusic() {
    if (musicTimer !== null) clearInterval(musicTimer);
    musicTimer = null;
    for (const { source, gain } of musicVoices) {
      // Disconnect queued and playing notes so rapid pause/resume cannot overlap loops.
      source.stop();
      source.disconnect();
      gain.disconnect();
    }
    musicVoices.clear();
  }

  function syncMusic() {
    if (!canRunMusic()) {
      if (musicTimer !== null || musicVoices.size) stopMusic();
      return;
    }
    if (musicTimer !== null) return;
    nextNoteTime = context.currentTime + 0.04;
    scheduleMusic();
    musicTimer = setInterval(scheduleMusic, 25);
  }

  function setMusicState(mode, boss = false) {
    if (musicMode === mode && bossMusic === boss) return;
    musicMode = mode;
    bossMusic = boss;
    syncMusic();
  }

  function resetMusic() {
    stopMusic();
    musicStep = 0;
    musicMode = "menu";
    bossMusic = false;
  }

  function setMusicVolume(value) {
    if (!Number.isFinite(value)) return;
    musicVolume = Math.max(0, Math.min(1, value));
    try { localStorage.setItem("alive-music-volume", String(musicVolume)); } catch {}
    if (musicBus) musicBus.gain.setTargetAtTime(musicVolume * MUSIC_BASE_GAIN, context.currentTime, 0.05);
    syncMusic();
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
    gain.connect(effectsBus);
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
    if (master) master.gain.setTargetAtTime(enabled ? 1 : 0, context.currentTime, 0.02);
    syncMusic();
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
    setMusicState,
    resetMusic,
    setMusicVolume,
    getMusicVolume: () => musicVolume,
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopMusic();
    else syncMusic();
  });
  window.addEventListener("pagehide", stopMusic);
})();
