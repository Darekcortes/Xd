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
    /** Contexto de audio compartido con la música (se crea al primer toque). */
    context() { init(); return ac; },
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

/* =====================================================================
   MÚSICA — melodías generadas en vivo, una por mundo y otra para jefes
   Cada tema define tonalidad, tempo, acordes y patrones de 16 pasos
   para bajo, arpegio, colchón y batería.
   ===================================================================== */
const Music = (() => {
  let enabled = true, current = null, want = 'menu', out = null, timer = 0, step = 0, nextT = 0, bar = 0;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  // Acordes: [nota raíz MIDI, 'm' menor | 'M' mayor]
  const THEMES = {
    menu:     { bpm: 76,  chords: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']], arp: 'triangle', bass: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], arpP: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], kick: [], snare: [], hat: [], vol: 0.9 },
    bosque:   { bpm: 92,  chords: [[50, 'm'], [48, 'M'], [55, 'M'], [50, 'm']], arp: 'triangle', bass: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0], arpP: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0], kick: [0, 8], snare: [], hat: [4, 12], vol: 0.85 },
    desierto: { bpm: 98,  chords: [[52, 'M'], [53, 'M'], [52, 'M'], [50, 'm']], arp: 'square',   bass: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,1,0], arpP: [1,1,0,1, 1,0,1,1, 0,1,1,0, 1,1,0,1], kick: [0, 6, 10], snare: [], hat: [2, 4, 8, 12, 14], vol: 0.7 },
    hielo:    { bpm: 70,  chords: [[57, 'm'], [52, 'm'], [53, 'M'], [55, 'M']], arp: 'sine',     bass: [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], arpP: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0], kick: [], snare: [], hat: [], vol: 1, bell: true },
    volcan:   { bpm: 118, chords: [[52, 'm'], [48, 'M'], [50, 'M'], [47, 'M']], arp: 'sawtooth', bass: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1], arpP: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,0], kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], vol: 0.65 },
    oscuro:   { bpm: 84,  chords: [[59, 'm'], [55, 'M'], [54, 'M'], [59, 'm']], arp: 'square',   bass: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0], arpP: [1,0,0,0, 1,0,0,1, 0,0,1,0, 0,1,0,0], kick: [0, 10], snare: [8], hat: [], vol: 0.75, organ: true },
    boss:     { bpm: 140, chords: [[48, 'm'], [44, 'M'], [46, 'M'], [43, 'M']], arp: 'sawtooth', bass: [1,1,0,1, 1,0,1,1, 1,1,0,1, 1,0,1,1], arpP: [1,0,1,0, 1,1,0,1, 1,0,1,0, 1,1,0,1], kick: [0, 4, 8, 10, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], vol: 0.6 },
  };
  const ac = () => Sfx.context();

  function voice(t, freq, dur, type, vol, opts = {}) {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.detune) o.detune.value = opts.detune;
    let node = o;
    if (opts.lp) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; o.connect(f); node = f; }
    node.connect(g); g.connect(out);
    const atk = opts.atk || 0.008;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function hit(t, kind) {
    const a = ac();
    if (kind === 'kick') {
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
      return;
    }
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf;
    f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const v = kind === 'hat' ? 0.08 : 0.22, d = kind === 'hat' ? 0.04 : 0.14;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + d + 0.02);
  }
  const triad = ([root, q]) => [root, root + (q === 'm' ? 3 : 4), root + 7];

  function schedule() {
    const a = ac(), T = THEMES[current];
    if (!a || !T) return;
    const sp = 60 / T.bpm / 4;
    while (nextT < a.currentTime + 0.25) {
      const ch = T.chords[bar % T.chords.length], tones = triad(ch), t = nextT, i = step;
      if (T.bass[i]) voice(t, midi(ch[0] - 24), sp * 1.8, 'triangle', 0.32 * T.vol, { lp: 600 });
      if (T.arpP[i]) {
        const n = tones[(i + bar) % 3] + 12 * (1 + ((i >> 2) % 2));
        voice(t, midi(n), sp * (T.bell ? 6 : 1.6), T.arp, (T.bell ? 0.13 : 0.07) * T.vol, { lp: T.arp === 'sawtooth' ? 2200 : 3500 });
        if (T.bell) voice(t, midi(n + 12), sp * 4, 'sine', 0.04 * T.vol);
      }
      if (i === 0) for (const n of tones) voice(t, midi(n + 12), sp * 16, T.organ ? 'square' : 'sine', (T.organ ? 0.025 : 0.035) * T.vol, { atk: 0.3, lp: T.organ ? 900 : 2000, detune: 6 });
      if (T.kick.includes(i)) hit(t, 'kick');
      if (T.snare.includes(i)) hit(t, 'snare');
      if (T.hat.includes(i)) hit(t, 'hat');
      nextT += sp; step = (step + 1) % 16; if (!step) bar++;
    }
  }

  function startTheme(name) {
    const a = ac();
    if (!a) return;
    stopNow(0.4);
    out = a.createGain(); out.gain.value = 0.0001; out.connect(a.destination);
    out.gain.linearRampToValueAtTime(0.16, a.currentTime + 0.8);
    current = name; step = 0; bar = 0; nextT = a.currentTime + 0.1;
    timer = setInterval(schedule, 60);
    schedule();
  }
  function stopNow(fade) {
    clearInterval(timer); timer = 0;
    if (out) { const a = ac(), g = out; try { g.gain.cancelScheduledValues(a.currentTime); g.gain.setValueAtTime(g.gain.value, a.currentTime); g.gain.linearRampToValueAtTime(0.0001, a.currentTime + (fade || 0.2)); setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 800); } catch (e) {} }
    out = null; current = null;
  }

  return {
    /** Cambia al tema indicado (menu, bosque, desierto, hielo, volcan, oscuro, boss). */
    play(name) {
      want = THEMES[name] ? name : 'menu';
      if (!enabled || want === current) return;
      try { startTheme(want); } catch (e) { /* audio no disponible */ }
    },
    setEnabled(v) { enabled = v; if (!v) stopNow(0.3); else { const w = want; current = null; this.play(w); } },
    /** Tras el primer toque del jugador (los navegadores bloquean el audio antes). */
    unlock() { const a = ac(); if (enabled && a && a.state === 'suspended') a.resume(); if (enabled && !current) this.play(want); },
  };
})();
