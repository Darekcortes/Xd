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
   MÚSICA — temas compuestos que se tocan en vivo, uno por mundo y otro
   para jefes. Cada tema tiene escala, acordes y dos melodías (A y B) que
   se alternan en una canción de 16 compases: entrada, melodía, armonía,
   puente y vuelta con redoble. Lleva eco y reverberación.
   ===================================================================== */
const Music = (() => {
  let enabled = true, current = null, want = 'menu', out = null, wet = null, echo = null, timer = 0, step = 0, nextT = 0, bar = 0, intensity = 0;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const SC = {
    menor: [0, 2, 3, 5, 7, 8, 10], dorico: [0, 2, 3, 5, 7, 9, 10], frigio: [0, 1, 4, 5, 7, 8, 10],
    armonica: [0, 2, 3, 5, 7, 8, 11],
  };
  /* Melodías en corcheas (8 por compás, 4 compases): número = grado de la escala,
     _ = mantiene la nota, . = silencio */
  const THEMES = {
    menu: { bpm: 80, root: 57, scale: 'menor', lead: 'flauta', arp: 'arpa', pad: 'cuerdas', drums: 'suave',
      chA: [0, 5, 2, 6], chB: [3, 0, 5, 4],
      A: '4 _ _ 3 2 _ 0 _  2 _ 3 _ 4 _ 5 _  4 _ _ 2 4 _ 7 _  6 _ _ 5 4 _ _ _',
      B: '7 _ 6 _ 5 _ 4 _  2 _ _ _ 4 _ 5 _  5 _ 4 _ 2 _ 0 _  1 _ 2 _ 4 _ _ _',
      bass: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0], arpP: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], vol: 0.9 },
    bosque: { bpm: 100, root: 50, scale: 'dorico', lead: 'flauta', arp: 'pulso', pad: 'cuerdas', drums: 'aventura',
      chA: [0, 6, 3, 0], chB: [2, 3, 6, 4],
      A: '0 2 4 _ 4 5 4 2  3 _ 2 _ 1 _ -1 _  0 2 4 _ 7 _ 6 4  5 _ 4 _ 2 _ _ _',
      B: '7 _ 7 8 9 _ 7 _  8 _ 7 6 5 _ _ _  6 _ 6 7 8 _ 6 _  4 _ _ _ . . 4 5',
      bass: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0], arpP: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0], vol: 0.85 },
    desierto: { bpm: 104, root: 52, scale: 'frigio', lead: 'laud', arp: 'pulso', pad: 'dron', drums: 'tambor',
      chA: [0, 1, 0, 6], chB: [3, 1, 0, 0],
      A: '0 1 2 _ 1 0 _ _  3 2 1 2 1 0 _ _  4 _ 5 4 3 2 1 2  1 _ 0 _ _ _ . .',
      B: '7 _ 8 7 6 5 4 _  5 6 5 4 3 _ _ _  4 5 4 3 2 1 2 3  1 _ 0 _ _ _ _ _',
      bass: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,1,0], arpP: [1,1,0,1, 1,0,1,1, 0,1,1,0, 1,1,0,1], vol: 0.75 },
    hielo: { bpm: 72, root: 54, scale: 'menor', lead: 'campana', arp: 'cristal', pad: 'coro', drums: 'suave',
      chA: [0, 5, 3, 4], chB: [2, 6, 5, 4],
      A: '4 _ _ _ 7 _ _ _  6 _ 5 _ 4 _ _ _  2 _ _ _ 4 _ 3 _  2 _ _ _ _ _ _ _',
      B: '9 _ _ _ 8 _ 7 _  6 _ _ _ 4 _ _ _  5 _ 6 _ 7 _ 8 _  7 _ _ _ _ _ _ _',
      bass: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], arpP: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0], vol: 1 },
    volcan: { bpm: 128, root: 52, scale: 'armonica', lead: 'metal', arp: 'sierra', pad: 'cuerdas', drums: 'rock',
      chA: [0, 5, 3, 4], chB: [0, 3, 5, 4],
      A: '0 0 3 _ 4 _ 3 2  0 _ _ 2 3 _ 2 0  -1 _ 0 2 3 _ 4 _  6 _ 5 _ 4 _ _ _',
      B: '7 _ 6 _ 5 _ 4 _  5 _ 4 _ 3 _ 2 _  3 _ 2 _ 0 _ 2 3  4 _ _ _ 6 _ 7 _',
      bass: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1], arpP: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,0], vol: 0.7 },
    oscuro: { bpm: 88, root: 59, scale: 'armonica', lead: 'organo', arp: 'cristal', pad: 'coro', drums: 'marcha',
      chA: [0, 5, 3, 4], chB: [3, 0, 5, 4],
      A: '0 _ _ 2 3 _ _ _  2 _ 0 _ -1 _ _ _  0 _ _ 2 3 _ 5 _  4 _ _ _ _ _ _ _',
      B: '7 _ _ 6 5 _ _ _  3 _ 4 _ 5 _ _ _  4 _ 3 _ 2 _ 0 _  -1 _ _ _ _ _ _ _',
      bass: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0], arpP: [1,0,0,0, 1,0,0,1, 0,0,1,0, 0,1,0,0], vol: 0.8 },
    boss: { bpm: 150, root: 48, scale: 'armonica', lead: 'metal', arp: 'sierra', pad: 'coro', drums: 'jefe',
      chA: [0, 5, 3, 4], chB: [5, 1, 4, 4],
      A: '0 _ 0 2 3 _ 2 0  5 _ 4 _ 3 _ 2 _  3 _ 3 4 5 _ 4 3  6 _ _ 4 6 _ 7 _',
      B: '7 _ 7 6 5 _ 3 _  4 _ 4 3 1 _ _ _  2 _ 3 _ 4 _ 5 _  6 _ 7 _ 6 _ 4 _',
      bass: [1,1,0,1, 1,0,1,1, 1,1,0,1, 1,0,1,1], arpP: [1,0,1,0, 1,1,0,1, 1,0,1,0, 1,1,0,1], vol: 0.65 },
  };
  // Baterías: pasos de 16 por compás
  const DRUMS = {
    suave:    { kick: [0], snare: [], hat: [], shaker: [4, 12] },
    aventura: { kick: [0, 8, 10], snare: [4, 12], hat: [2, 6, 10, 14], shaker: [] },
    tambor:   { kick: [0, 3, 8, 11], snare: [], hat: [], tom: [6, 14], shaker: [2, 4, 10, 12] },
    rock:     { kick: [0, 3, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [14] },
    marcha:   { kick: [0, 8], snare: [12], hat: [], tom: [14], shaker: [] },
    jefe:     { kick: [0, 2, 6, 8, 10, 14], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [6, 14], tom: [], taiko: [0, 8] },
  };
  const parsed = {};
  function mel(str) {
    if (parsed[str]) return parsed[str];
    const tk = str.trim().split(/\s+/);
    const notes = [];
    tk.forEach((t, i) => {
      if (t === '_' || t === '.') return;
      let len = 1;
      while (tk[i + len] === '_') len++;
      notes[i] = { d: +t, len };
    });
    return (parsed[str] = notes);
  }
  const ac = () => Sfx.context();
  const deg = (T, d) => { const sc = SC[T.scale], n = sc.length; return T.root + sc[((d % n) + n) % n] + 12 * Math.floor(d / n); };
  const chordOf = (T, d) => [deg(T, d), deg(T, d + 2), deg(T, d + 4)];

  function voice(t, freq, dur, type, vol, opts = {}) {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.detune) o.detune.value = opts.detune;
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(freq * opts.slide, t + dur * 0.5);
    let node = o;
    if (opts.lp) {
      const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(opts.lp, t); f.Q.value = opts.q || 0.7;
      if (opts.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, opts.lp * opts.sweep), t + dur);
      o.connect(f); node = f;
    }
    if (opts.vib) {   // vibrato que entra poco a poco
      const l = a.createOscillator(), lg = a.createGain();
      l.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(opts.vib, t + Math.min(0.35, dur * 0.6));
      l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + dur + 0.05);
    }
    if (opts.pan && a.createStereoPanner) { const pn = a.createStereoPanner(); pn.pan.value = opts.pan; node.connect(pn); node = pn; }
    node.connect(g); g.connect(out);
    if (opts.verb && wet) g.connect(wet);
    if (opts.echo && echo) g.connect(echo);
    const atk = opts.atk || 0.008, rel = opts.rel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    if (rel) { g.gain.setValueAtTime(vol, t + Math.max(atk, dur - rel)); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // Instrumentos hechos con osciladores
  const INSTR = {
    flauta:  (t, f, d, v) => { voice(t, f, d, 'sine', v, { atk: 0.05, rel: 0.12, vib: 14, verb: 1, echo: 1 }); voice(t, f * 2, d, 'triangle', v * 0.18, { atk: 0.06, rel: 0.12, verb: 1 }); },
    laud:    (t, f, d, v) => { voice(t, f, Math.min(d, 0.5) + 0.25, 'sawtooth', v * 0.55, { lp: 2600, sweep: 0.25, verb: 1, echo: 1 }); voice(t, f * 1.003, 0.3, 'triangle', v * 0.5, { verb: 1 }); },
    campana: (t, f, d, v) => { voice(t, f, d + 1.2, 'sine', v, { verb: 1, echo: 1 }); voice(t, f * 2.76, 0.6, 'sine', v * 0.22, { verb: 1 }); voice(t, f * 4.07, 0.3, 'sine', v * 0.1); },
    metal:   (t, f, d, v) => { voice(t, f, d, 'sawtooth', v * 0.5, { lp: 2400, q: 3, sweep: 0.6, rel: 0.06, vib: 10, verb: 1, echo: 1 }); voice(t, f * 1.006, d, 'square', v * 0.25, { lp: 1800, rel: 0.06, pan: 0.3 }); voice(t, f / 2, d, 'sawtooth', v * 0.18, { lp: 900, rel: 0.06, pan: -0.3 }); },
    organo:  (t, f, d, v) => { for (const [m, k] of [[1, 1], [2, 0.5], [3, 0.25], [4, 0.2]]) voice(t, f * m, d, 'sine', v * k * 0.7, { atk: 0.03, rel: 0.1, vib: m === 1 ? 8 : 0, verb: 1, echo: m === 1 ? 1 : 0 }); },
  };
  const ARP = {
    arpa:    (t, f, sp, v) => voice(t, f, sp * 5, 'triangle', v, { verb: 1, pan: -0.25 }),
    pulso:   (t, f, sp, v) => voice(t, f, sp * 1.5, 'square', v * 0.6, { lp: 2200, sweep: 0.4, pan: -0.2 }),
    cristal: (t, f, sp, v) => { voice(t, f * 2, sp * 6, 'sine', v * 1.3, { verb: 1, echo: 1, pan: 0.35 }); },
    sierra:  (t, f, sp, v) => voice(t, f, sp * 1.4, 'sawtooth', v * 0.7, { lp: 1600, q: 4, sweep: 0.3, pan: -0.2 }),
  };
  let noiseBuf = null;
  function noise(t, type, freq, v, d, pan) {
    const a = ac();
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; }
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    let node = f;
    if (pan && a.createStereoPanner) { const pn = a.createStereoPanner(); pn.pan.value = pan; f.connect(pn); node = pn; }
    src.connect(f); node.connect(g); g.connect(out); if (wet) g.connect(wet);
    src.start(t); src.stop(t + d + 0.02);
  }
  function drum(t, kind, acc = 1) {
    const a = ac();
    if (kind === 'kick' || kind === 'taiko' || kind === 'tom') {
      const o = a.createOscillator(), g = a.createGain();
      const [f0, f1, d, v] = kind === 'kick' ? [140, 42, 0.2, 0.55] : kind === 'taiko' ? [95, 48, 0.45, 0.6] : [210, 90, 0.25, 0.35];
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d * 0.7);
      g.gain.setValueAtTime(v * acc, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g); g.connect(out); if (kind !== 'kick' && wet) g.connect(wet); o.start(t); o.stop(t + d + 0.02);
      if (kind === 'taiko') noise(t, 'lowpass', 400, 0.25 * acc, 0.12);
      return;
    }
    if (kind === 'snare') { noise(t, 'bandpass', 1900, 0.24 * acc, 0.16); voice(t, 185, 0.09, 'triangle', 0.16 * acc); return; }
    if (kind === 'hat') { noise(t, 'highpass', 8000, 0.07 * acc, 0.035, 0.3); return; }
    if (kind === 'open') { noise(t, 'highpass', 7000, 0.07 * acc, 0.22, 0.3); return; }
    if (kind === 'shaker') noise(t, 'highpass', 5000, 0.05 * acc, 0.07, -0.3);
  }

  const INTRO = 2;   // compases de entrada sin melodía
  function schedule() {
    const a = ac(), T = THEMES[current];
    if (!a || !T) return;
    const sp = 60 / (T.bpm * (1 + intensity * 0.05)) / 4, D = DRUMS[T.drums];
    while (nextT < a.currentTime + 0.3) {
      const t = nextT, i = step;
      const pb = bar - INTRO, sec = pb < 0 ? -1 : Math.floor(pb / 4) % 4, inBar = ((pb % 4) + 4) % 4;
      const useB = sec === 2;
      const chord = chordOf(T, (useB ? T.chB : T.chA)[inBar]);
      // Bajo: raíz con saltos a la quinta y octava
      if (T.bass[i]) {
        const n = chord[0] - 24 + (i % 8 === 6 ? 7 : i === 14 ? 12 : 0);
        voice(t, midi(n), sp * 1.8, 'triangle', 0.34 * T.vol, { lp: 700 });
        if (T.drums === 'rock' || T.drums === 'jefe') voice(t, midi(n), sp * 1.2, 'sawtooth', 0.08 * T.vol, { lp: 500, sweep: 0.5 });
      }
      // Arpegio (sube y baja por el acorde)
      if (T.arpP[i] && sec !== 3 || (sec === 3 && T.arpP[i] && inBar < 3)) {
        const order = [0, 1, 2, 1], o = 12 * (1 + ((i >> 3) % 2));
        ARP[T.arp](t, midi(chord[order[(i + bar) % 4]] + o), sp, 0.07 * T.vol);
      }
      // Colchón del acorde al empezar cada compás
      if (i === 0) {
        const len = sp * 16;
        for (const [k, n] of chord.entries()) {
          if (T.pad === 'coro') { voice(t, midi(n + 12), len, 'sine', 0.03 * T.vol, { atk: 0.5, rel: 0.4, vib: 12, verb: 1 }); voice(t, midi(n + 12), len, 'triangle', 0.012 * T.vol, { atk: 0.6, rel: 0.4, detune: 9, verb: 1 }); }
          else if (T.pad === 'dron') { if (k === 0) { voice(t, midi(n - 12), len, 'sawtooth', 0.025 * T.vol, { atk: 0.3, rel: 0.3, lp: 500, verb: 1 }); voice(t, midi(n - 5), len, 'sawtooth', 0.018 * T.vol, { atk: 0.3, rel: 0.3, lp: 500 }); } }
          else voice(t, midi(n + 12), len, 'sawtooth', 0.018 * T.vol, { atk: 0.4, rel: 0.35, lp: 1300, detune: k % 2 ? 7 : -7, pan: (k - 1) * 0.4, verb: 1 });
        }
      }
      // Melodía (en corcheas): A, A con armonía, B y A a la octava
      if (sec >= 0 && i % 2 === 0) {
        const m = mel(useB ? T.B : T.A)[inBar * 8 + i / 2];
        if (m) {
          const n = deg(T, m.d) + 12 + (sec === 3 ? 12 : 0) - (T.lead === 'metal' ? 12 : 0), dur = m.len * sp * 2;
          INSTR[T.lead](t, midi(n), dur, 0.11 * T.vol);
          if (sec === 1) INSTR[T.lead](t, midi(deg(T, m.d + 2) + 12 - (T.lead === 'metal' ? 12 : 0)), dur, 0.05 * T.vol);
          if (sec === 3 && T.lead !== 'campana') voice(t, midi(n - 12), dur, 'triangle', 0.035 * T.vol, { atk: 0.03, rel: 0.1, verb: 1 });
        }
      }
      // Batería (en la entrada solo bombo) y redoble al final de la canción
      if (sec === 3 && inBar === 3 && i >= 8) {
        if (i % 2 === 0 || i >= 12) drum(t, i < 12 ? 'tom' : 'snare', 0.5 + (i - 8) / 14);
      } else {
        const lite = sec < 0;
        if (D.kick.includes(i)) drum(t, 'kick');
        if (!lite) {
          if (D.snare.includes(i)) drum(t, 'snare');
          if (D.hat.includes(i) || (intensity > 0 && D.hat.length && i % 2)) drum(t, 'hat', i % 4 === 0 ? 1 : 0.7);
          if (D.open && D.open.includes(i)) drum(t, 'open');
          if (D.tom && D.tom.includes(i)) drum(t, 'tom');
          if (D.taiko && D.taiko.includes(i)) drum(t, 'taiko');
          if (D.shaker && D.shaker.includes(i)) drum(t, 'shaker');
          if (intensity > 1 && (i === 6 || i === 14)) drum(t, 'taiko', 0.7);
        }
      }
      if (i === 0 && pb >= 0 && pb % 16 === 0) noise(t, 'highpass', 3000, 0.08 * T.vol, 1.2);   // platillo al empezar la canción
      nextT += sp; step = (step + 1) % 16; if (!step) bar++;
    }
  }

  function makeVerb(a) {
    const len = a.sampleRate * 2.4, buf = a.createBuffer(2, len, a.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const cv = a.createConvolver(); cv.buffer = buf; return cv;
  }
  function startTheme(name) {
    const a = ac();
    if (!a) return;
    stopNow(0.4);
    const T = THEMES[name];
    out = a.createGain(); out.gain.value = 0.0001; out.connect(a.destination);
    out.gain.linearRampToValueAtTime(T.drums === 'jefe' ? 0.1 : 0.125, a.currentTime + 0.8);
    // Reverberación y eco
    try {
      wet = a.createGain(); wet.gain.value = 0.32; const cv = makeVerb(a); wet.connect(cv); cv.connect(out);
      echo = a.createGain(); echo.gain.value = 0.28;
      const dl = a.createDelay(1.5), fb = a.createGain(), lp = a.createBiquadFilter();
      dl.delayTime.value = (60 / T.bpm) * 0.75; fb.gain.value = 0.32; lp.type = 'lowpass'; lp.frequency.value = 2200;
      echo.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(out);
    } catch (e) { wet = echo = null; }
    current = name; step = 0; bar = 0; nextT = a.currentTime + 0.1;
    timer = setInterval(schedule, 60);
    schedule();
  }
  function stopNow(fade) {
    clearInterval(timer); timer = 0;
    if (out) { const a = ac(), g = out; try { g.gain.cancelScheduledValues(a.currentTime); g.gain.setValueAtTime(g.gain.value, a.currentTime); g.gain.linearRampToValueAtTime(0.0001, a.currentTime + (fade || 0.2)); setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 800); } catch (e) {} }
    out = null; wet = null; echo = null; current = null;
  }

  return {
    /** Cambia al tema indicado (menu, bosque, desierto, hielo, volcan, oscuro, boss). */
    play(name) {
      want = THEMES[name] ? name : 'menu';
      if (!enabled || want === current) return;
      try { startTheme(want); } catch (e) { /* audio no disponible */ }
    },
    /** Más tensión en Pesadilla (1) e Infierno (2): más rápido y más percusión. */
    setIntensity(v) { intensity = v || 0; },
    setEnabled(v) { enabled = v; if (!v) stopNow(0.3); else { const w = want; current = null; this.play(w); } },
    /** Tras el primer toque del jugador (los navegadores bloquean el audio antes). */
    unlock() { const a = ac(); if (enabled && a && a.state === 'suspended') a.resume(); if (enabled && !current) this.play(want); },
  };
})();
