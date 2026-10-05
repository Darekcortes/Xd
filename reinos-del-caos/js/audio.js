'use strict';
/* =====================================================================
   SONIDO — efectos sintetizados con Web Audio (sin archivos externos)
   ===================================================================== */
const Sfx = (() => {
  let ac = null, master = null, enabled = true;
  const lastPlayed = {};

  function init() {
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.35;
      master.connect(ac.destination);
    } catch (e) { ac = null; }
  }

  function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  let noiseBuf = null;
  function noise(dur, vol = 0.3, freq = 1500, delay = 0) {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ac.currentTime + delay;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf;
    f.type = 'lowpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  const notes = (arr, type, vol, step) => arr.forEach((f, i) => tone(f, step * 1.6, type, vol, 0, i * step));

  const LIB = {
    click:   () => tone(660, 0.04, 'sine', 0.12),
    swing:   () => noise(0.09, 0.12, 3000),
    hit:     () => { noise(0.08, 0.3, 1300); tone(170, 0.08, 'square', 0.12, -70); },
    crit:    () => { noise(0.12, 0.35, 2200); tone(520, 0.12, 'square', 0.14, 300); },
    hurt:    () => { tone(180, 0.2, 'sawtooth', 0.22, -100); noise(0.1, 0.15, 800); },
    pickup:  () => tone(880, 0.07, 'sine', 0.16, 500),
    coin:    () => { tone(1250, 0.05, 'square', 0.08); tone(1680, 0.09, 'square', 0.08, 0, 0.05); },
    fire:    () => { noise(0.45, 0.35, 700); tone(140, 0.35, 'sawtooth', 0.15, -70); },
    ice:     () => { tone(1500, 0.35, 'triangle', 0.14, -1000); tone(2200, 0.25, 'sine', 0.08, -900, 0.05); },
    thunder: () => { noise(0.6, 0.45, 3500); tone(60, 0.5, 'sawtooth', 0.2, -20); },
    boom:    () => { noise(0.4, 0.4, 500); tone(80, 0.35, 'sine', 0.3, -40); },
    potion:  () => notes([520, 660, 880], 'sine', 0.12, 0.06),
    levelup: () => notes([523, 659, 784, 1047], 'square', 0.1, 0.09),
    tick:    () => tone(1100, 0.025, 'square', 0.06),
    win:     () => notes([523, 659, 784, 1047, 784, 1047], 'square', 0.1, 0.11),
    lose:    () => notes([440, 370, 311, 220], 'triangle', 0.15, 0.16),
    roar:    () => { tone(95, 0.8, 'sawtooth', 0.28, -45); noise(0.7, 0.22, 450); },
    warn:    () => tone(320, 0.18, 'triangle', 0.12, 160),
    chest:   () => { noise(0.15, 0.2, 900); notes([660, 880, 1320], 'triangle', 0.12, 0.08); },
    forge:   () => { tone(780, 0.18, 'square', 0.14, -200); noise(0.15, 0.25, 4000); },
    legendary: () => notes([523, 659, 784, 1047, 1319, 1568], 'triangle', 0.13, 0.08),
    deflect: () => tone(1400, 0.08, 'square', 0.1, 600),
  };

  return {
    setEnabled(v) { enabled = v; },
    unlock() { if (!enabled) return; init(); if (ac && ac.state === 'suspended') ac.resume(); },
    play(name) {
      if (!enabled || !LIB[name]) return;
      init();
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume();
      // Evita saturar con el mismo sonido muchas veces por frame
      const now = performance.now();
      if (lastPlayed[name] && now - lastPlayed[name] < 45) return;
      lastPlayed[name] = now;
      try { LIB[name](); } catch (e) { /* audio no disponible */ }
    },
  };
})();
