'use strict';
/* =====================================================================
   INTERFAZ — pantallas, ventanas, ruleta, forja, inventario, personaje
   Los botones usan data-act="acción" y se gestionan en un solo lugar
   (ACTIONS) para que añadir pantallas o botones sea sencillo.
   ===================================================================== */
const UI = (() => {
  const $ = id => document.getElementById(id);
  const fmt = n => Math.floor(n).toLocaleString('es');
  /** Números cortos para la barra superior (12,3k · 1,2M). */
  const fmtShort = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1).replace('.', ',') + 'k' : fmt(n);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = () => Game.S;
  let current = 'menu';
  const view = { forgeTab: 'craft', invTab: 'weapon', wheel: null, spinning: false, wheelRot: 0 };

  const WORLD_BG = {
    bosque: 'linear-gradient(160deg, #3f8f5a, #1b4a2e 60%, #10261a)',
    desierto: 'linear-gradient(160deg, #e0a245, #a5611f 60%, #4a2a0c)',
    hielo: 'linear-gradient(160deg, #7fb2ea, #2e5aa3 60%, #13244a)',
    volcan: 'linear-gradient(160deg, #b2321a, #5c120a 60%, #1a0606)',
    oscuro: 'linear-gradient(160deg, #6d28d9, #3b0764 60%, #0b0616)',
  };
  const worldBg = w => WORLD_BG[w.theme] || WORLD_BG.bosque;
  const rc = r => RARITIES[r].color;
  const stars = lvl => '★'.repeat(Math.min(lvl, MAX_ITEM_LEVEL)) + '☆'.repeat(Math.max(0, MAX_ITEM_LEVEL - lvl)) + (lvl > MAX_ITEM_LEVEL ? ` <span class="asc-stars">${'✦'.repeat(lvl - MAX_ITEM_LEVEL)}</span>` : '');

  /* ---------- Navegación ---------- */
  function show(id) {
    if (current === 'battle' && id !== 'battle') { Battle.stop(); $('rotate-hint').hidden = true; pausedByHint = false; }
    if (id !== 'trophies') stopRanking();
    current = id;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id));
    $('topbar').hidden = id === 'battle';
    if (RENDER[id]) RENDER[id]();
    refreshTop();
    window.scrollTo(0, 0);
  }
  const head = title => `<div class="screen-head"><button class="back" data-act="go" data-to="menu" aria-label="Volver al menú">←</button><h2>${title}</h2></div>`;

  function refreshTop() {
    const s = S(), P = Game.stats();
    $('t-hp').textContent = fmtShort(P.maxHp);
    $('t-coins').textContent = fmtShort(s.coins);
    $('t-gems').textContent = fmtShort(s.gems);
    $('t-tickets').textContent = fmtShort(s.tickets);
    $('t-level').textContent = s.level;
    $('t-xp').style.width = Math.min(100, s.xp / xpForLevel(s.level) * 100) + '%';
  }

  /* ---------- Avisos y modales ---------- */
  function toast(text, bad) {
    const d = document.createElement('div');
    d.className = 'toast' + (bad ? ' bad' : '');
    d.textContent = text;
    $('toasts').appendChild(d);
    setTimeout(() => d.remove(), 2800);
  }
  let modalOnClose = null;
  function openModal(html, onClose) {
    $('modal-card').innerHTML = html;
    $('modal').hidden = false;
    modalOnClose = onClose || null;
  }
  function closeModal() {
    $('modal').hidden = true;
    $('modal-card').innerHTML = '';
    const cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
  }
  function confetti(n = 60, colors = ['#fde047', '#f472b6', '#60a5fa', '#4ade80', '#fb923c']) {
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
      c.style.animationDelay = Math.random() * 0.5 + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 3800);
    }
  }
  function vibrate(ms) {
    if (!S().settings.vibrate) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no disponible */ }
  }
  /** Progreso de la dificultad elegida ({ cleared, unlocked }) y su ficha. */
  const PG = () => Game.prog();
  const DIF = () => DIFFICULTIES[S().diff || 0];
  /** Icono dibujado de un objeto, poción o material (sin emojis repetidos). */
  const ico = id => `<span class="gi-wrap">${Icons.html(id)}</span>`;
  const costPills = (cost, coins, gems) => {
    let h = '';
    for (const k in cost) {
      const have = Game.matCount(k), ok = have >= cost[k];
      h += `<span class="pill ${ok ? 'ok' : 'no'}">${ico(k)} ${fmt(have)}/${cost[k]}</span>`;
    }
    if (coins) h += `<span class="pill ${S().coins >= coins ? 'ok' : 'no'}">💰 ${fmt(coins)}</span>`;
    if (gems) h += `<span class="pill ${S().gems >= gems ? 'ok' : 'no'}">💎 ${gems}</span>`;
    return h;
  };

  /* =================================================================
     PANTALLAS
     ================================================================= */
  const RENDER = {};

  /* ---------- Menú principal ---------- */
  RENDER.menu = () => {
    const s = S(), pg = PG(), stage = pg.unlocked, info = stageInfo(stage), P = Game.stats(), w = info.world, D = DIF();
    const allDone = pg.cleared[MAX_STAGE];
    document.body.dataset.diff = D.id;
    const wheelReady = Object.keys(WHEELS).some(id => { const wh = WHEELS[id]; return Game.wheelOpen(id) && (wh.gemOnly ? s.gems >= wh.gemCost || (wh.matCost && Game.hasCost(wh.matCost)) : Game.hasCost(wh.cost) || s.gems >= wh.gemCost); });
    const craftReady = RECIPES.some(r => r.item && !s.items[r.item] && r.world <= Game.highestWorld() && Game.hasCost(r.cost, r.coins));
    const daily = Game.ensureDaily();
    const claimable = daily.missions.filter(m => m.progress >= m.goal && !m.claimed).length + (allMissionsClaimable(daily) ? 1 : 0);
    const first = (w.id - 1) * STAGES_PER_WORLD + 1;
    let pips = '';
    for (let st = first; st < first + STAGES_PER_WORLD; st++) {
      const cls = pg.cleared[st] ? 'done' : st === stage ? 'current' : 'locked';
      pips += `<span class="pip ${cls} ${isBossStage(st) ? 'boss' : ''}">${isBossStage(st) ? '👹' : st}</span>`;
    }
    const dock = (to, ico, label, badge) =>
      `<button class="dock-btn" data-act="go" data-to="${to}"><span class="medal">${ico}</span><span class="lbl">${label}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
    $('scr-menu').innerHTML = `
      <canvas id="menu-scene" aria-hidden="true"></canvas>
      <div class="menu-ui">
        <div class="menu-head">
          <button class="power-chip" data-act="name" aria-label="Tu nombre de usuario">${s.username ? `<span class="uname">${esc(s.username)}</span>` : ''}<span class="rank-tag" style="color:${RANKS[Game.rank()].color}">${RANKS[Game.rank()].name}</span> 💥 <b>${fmt(P.power)}</b>${cloudIcon()}</button>
          <div class="head-btns">
            <button class="icon-btn" data-act="fullscreen" aria-label="Pantalla completa">⛶</button>
            <button class="icon-btn" data-act="go" data-to="shop" aria-label="Mercader viajero">🏪${Game.shopToday().seen ? '' : '<span class="badge">!</span>'}</button>
            <button class="icon-btn" data-act="go" data-to="trophies" aria-label="Logros y ranking">🏆${Game.achClaimable() ? `<span class="badge">${Game.achClaimable()}</span>` : ''}</button>
            <button class="icon-btn" data-act="go" data-to="missions" aria-label="Misiones diarias">📜${claimable + (Game.loginStatus().claimable ? 1 : 0) ? `<span class="badge">${claimable + (Game.loginStatus().claimable ? 1 : 0)}</span>` : ''}</button>
            <button class="icon-btn" data-act="go" data-to="settings" aria-label="Ajustes">⚙️</button>
          </div>
        </div>
        <div class="logo" aria-label="Reinos del Caos">
          <div class="logo-crest">${EMBLEM}</div>
          <div class="logo-txt"><span class="logo-a">Reinos</span><span class="logo-b">— del —</span><span class="logo-c">Caos</span></div>
        </div>
        <div class="menu-space"></div>
        <div class="goals">${nextGoals().map(g => `<button class="goal ${g.ready ? 'ready' : ''}" data-act="go" data-to="${g.to}">${g.text}</button>`).join('')}</div>
        <div class="world-strip">
          <div class="world-name">${w.icon} Mundo ${w.id} · ${w.name}${s.streak ? ` <span class="streak-chip">🔥 x${s.streak}</span>` : ''}</div>
          <div class="pips">${pips}</div>
        </div>
        ${Game.maxDiff() ? `<div class="diff-pick">${DIFFICULTIES.map(d => `<button class="diff-chip ${d.id === D.id ? 'on' : ''}" style="--dc:${d.color}" data-act="diff" data-d="${d.id}" ${Game.diffUnlocked(d.id) ? '' : 'disabled'}>${Game.diffUnlocked(d.id) ? d.icon : '🔒'} ${d.name}</button>`).join('')}</div>` : ''}
        <button class="btn btn-play ${D.id ? 'diff-' + D.id : ''}" data-act="play">
          <span class="play-main"><span class="pm-sw">⚔️</span> JUGAR</span>
          <small>${D.id ? D.icon + ' ' + D.name + ' · ' : ''}${allDone ? 'Reinos conquistados · repetir etapa ' + stage : `Etapa ${stage} · ${esc(info.name)}${info.boss ? ' · ¡JEFE!' : ''}`}</small>
        </button>
        <nav class="dock">
          ${dock('wheel', '🎰', 'Ruleta', s.tickets ? s.tickets : wheelReady ? '!' : '')}
          ${dock('forge', '🔨', 'Forja', craftReady ? '!' : '')}
          ${dock('inv', '🎒', 'Mochila')}
          ${dock('map', '🗺️', 'Mapa')}
          ${dock('char', '👤', 'Héroe', s.points || '')}
          ${dock('tower', '🏰', 'Torre', s.cleared[TOWER.unlockStage] && !s.tower.runs ? '!' : '')}
        </nav>
      </div>`;
    animateMenuScene(w);
  };

  /** Escena animada del menú: paisaje del mundo, jefe al fondo y el caballero. */
  let menuRaf = 0;
  function animateMenuScene(world) {
    cancelAnimationFrame(menuRaf);
    const cv = $('menu-scene');
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, HY = 0, bg = null, feet = 0, scale = 3, knightX = 0;
    const sizeUp = () => {
      const r = cv.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      cv.width = W * dpr; cv.height = H * dpr;
      if (W > H * 1.15) {
        // Horizontal: el caballero ocupa la mitad izquierda y los botones la derecha
        knightX = W * 0.27; feet = H - 24;
        scale = Math.max(1.6, Math.min(3.6, (H - 90) / 66));
      } else {
        const ui = document.querySelector('.world-strip');
        const bottomUi = ui ? H - (ui.getBoundingClientRect().top - r.top) : 240;
        feet = H - bottomUi - 6;
        const logo = document.querySelector('.logo');
        const top = logo ? logo.getBoundingClientRect().bottom - r.top : 140;
        scale = Math.max(1.6, Math.min(3.4, (feet - top) / 66));
        knightX = W / 2;
      }
      HY = Math.round(feet - 26 * scale);
      bg = Sprites.background(world.theme, W, H, HY, dpr);
    };
    sizeUp();
    const boss = ENEMIES[world.boss];
    const fake = { def: boss, x: 0, y: 0, size: boss.size, face: -1, walk: 0, flash: 0, windup: 0, windupMax: 1, recover: 0, seed: 1, frozen: 0, state: 'move' };
    const motes = Array.from({ length: 34 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.5, ph: Math.random() * 6 }));
    const theme = Sprites.THEMES[world.theme];
    const moteCol = { leaf: '#bef264', snow: '#ffffff', sand: '#fde68a', ember: '#fb923c', mote: '#d8b4fe' }[theme.particle] || '#ffffff';
    const s = S(), t0 = performance.now();
    let lastW = W, lastH = H;
    (function frame(t) {
      if (!document.body.contains(cv) || current !== 'menu') return;
      const r = cv.getBoundingClientRect();
      if (Math.round(r.width) !== lastW || Math.round(r.height) !== lastH) { sizeUp(); lastW = W; lastH = H; }
      const time = (t - t0) / 1000, c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.drawImage(bg, 0, 0, W, H);
      // Jefe del mundo, enorme y en penumbra al fondo
      c.save();
      c.globalAlpha = 0.32;
      fake.x = (W > H * 1.15 ? W * 0.5 : W * 0.8) + Math.sin(time * 0.4) * 6; fake.y = HY + 8; fake.size = boss.size * Math.min(1.8, scale * 0.55);
      fake.walk = time * 2;
      Sprites.enemy(c, fake, time);
      c.restore();
      const fog = c.createLinearGradient(0, HY - 120, 0, HY + 30);
      fog.addColorStop(0, 'rgba(15,12,29,0)'); fog.addColorStop(1, 'rgba(15,12,29,.35)');
      c.fillStyle = fog; c.fillRect(0, HY - 120, W, 150);
      // Luz bajo el héroe
      const glow = c.createRadialGradient(knightX, feet, 4, knightX, feet, 60 * scale);
      glow.addColorStop(0, 'rgba(232,181,74,.35)'); glow.addColorStop(1, 'rgba(232,181,74,0)');
      c.fillStyle = glow; c.fillRect(0, feet - 60 * scale, W, 120 * scale);
      Sprites.knight(c, knightX - 6 * scale, feet, scale, { face: 1, walk: 0, swing: -1, heavy: false, time,
        weaponColor: ITEMS[s.equip.weapon].color, armorColor: ITEMS[s.equip.armor].color, flash: false, helmet: s.settings.helmet, rank: Game.rank() });
      // Partículas del ambiente
      for (const m of motes) {
        m.ph += 0.016;
        const x = ((m.x + Math.sin(m.ph * 0.5) * 0.02 + (theme.particle === 'sand' ? time * 0.05 : 0)) % 1) * W;
        const y = ((m.y + (theme.particle === 'ember' ? -time * 0.03 : time * 0.02) * m.s) % 1 + 1) % 1 * H;
        c.globalAlpha = 0.35 + Math.sin(m.ph * 2) * 0.25;
        c.fillStyle = moteCol;
        c.beginPath(); c.arc(x, y, m.s * 1.4, 0, Math.PI * 2); c.fill();
        // halo suave alrededor de cada luz
        c.globalAlpha *= 0.25; c.beginPath(); c.arc(x, y, m.s * 4, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
      // Rayos de luz que bajan del cielo
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x0 = W * (0.08 + i * 0.13) + Math.sin(time * 0.3 + i) * 12, a = 0.05 + 0.03 * Math.sin(time * 0.7 + i * 2);
        const g = c.createLinearGradient(0, 0, 0, H * 0.8);
        g.addColorStop(0, `rgba(255,240,200,${a})`); g.addColorStop(1, 'rgba(255,240,200,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + 40, 0); c.lineTo(x0 + 140, H * 0.8); c.lineTo(x0 + 60, H * 0.8); c.fill();
      }
      c.restore();
      // Viñeta
      const vg = c.createRadialGradient(knightX, H * 0.55, Math.min(W, H) * 0.25, knightX, H * 0.55, Math.max(W, H) * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,3,15,.55)');
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
      menuRaf = requestAnimationFrame(frame);
    })(t0);
  }

  /* ---------- Portada (pantalla de título) ---------- */
  const EMBLEM = `<svg class="emblem" viewBox="0 0 100 112" aria-hidden="true">
    <defs><linearGradient id="emg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d6"/><stop offset=".5" stop-color="#e8b54a"/><stop offset="1" stop-color="#7a4b0c"/></linearGradient>
    <linearGradient id="emf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c1d95"/><stop offset="1" stop-color="#1e0b3a"/></linearGradient></defs>
    <path d="M50 12 L88 24 L84 66 Q78 92 50 106 Q22 92 16 66 L12 24 Z" fill="url(#emf)" stroke="url(#emg)" stroke-width="5"/>
    <g stroke="url(#emg)" stroke-width="5" stroke-linecap="round"><line x1="30" y1="34" x2="70" y2="84"/><line x1="70" y1="34" x2="30" y2="84"/></g>
    <g fill="url(#emg)"><rect x="22" y="72" width="16" height="5" rx="2" transform="rotate(-50 30 74)"/><rect x="62" y="72" width="16" height="5" rx="2" transform="rotate(50 70 74)"/>
    <path d="M30 14 L36 2 L43 11 L50 0 L57 11 L64 2 L70 14 Z"/></g>
    <circle cx="50" cy="59" r="6" fill="#f43f5e" stroke="url(#emg)" stroke-width="2"/></svg>`;
  /** Muestra la portada; se resuelve cuando el jugador toca para empezar. */
  function title() {
    return new Promise(resolve => {
      const s = S();
      const el = document.createElement('div');
      el.id = 'title'; el.className = 'title-screen';
      el.innerHTML = `<canvas id="title-cv" aria-hidden="true"></canvas>
        <div class="title-ui">
          <div class="t-crest">${EMBLEM}</div>
          <h1 class="t-logo" aria-label="Reinos del Caos"><span class="tl-a">Reinos</span><span class="tl-b">— del —</span><span class="tl-c">Caos</span></h1>
          <div class="t-sub">Forja tu leyenda · derrota al Caos</div>
          <button class="t-tap" id="t-tap">TOCA PARA EMPEZAR</button>
          ${s.stats.kills || s.username ? `<div class="t-save">🛡️ ${s.username ? esc(s.username) + ' · ' : ''}Nivel ${s.level} · ${RANKS[Game.rank()].name}</div>` : ''}
        </div>`;
      document.body.appendChild(el);
      const stopScene = titleScene($('title-cv'));
      let gone = false;
      const go = () => {
        if (gone) return; gone = true;
        try { Sfx.unlock && Sfx.unlock(); Music.unlock && Music.unlock(); } catch (e) { /* sin audio */ }
        Sfx.play('legendary'); vibrate(30);
        el.classList.add('leaving');
        setTimeout(() => { stopScene(); el.remove(); resolve(); }, 650);
      };
      el.addEventListener('pointerup', go);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(); });
      setTimeout(() => { const b = $('t-tap'); if (b) b.focus({ preventScroll: true }); }, 50);
    });
  }
  /** Escena nocturna: luna, castillo en la montaña, dragón que cruza, niebla, brasas y el caballero en el risco. */
  function titleScene(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let raf = 0, W = 0, H = 0, layers = null;
    const rnd = (i => () => { i = (i * 16807) % 2147483647; return (i - 1) / 2147483646; })(7);
    const stars = Array.from({ length: 140 }, () => ({ x: rnd(), y: rnd() * 0.6, r: 0.4 + rnd() * 1.3, p: rnd() * 6 }));
    const embers = [];
    const ridge = (seed, n, amp) => { const r = (i => () => { i = (i * 48271) % 2147483647; return i / 2147483647; })(seed); const pts = []; let v = 0.5; for (let i = 0; i <= n; i++) { v = Math.min(1, Math.max(0, v + (r() - 0.5) * 0.5)); pts.push(v * amp); } return pts; };
    const far = ridge(11, 18, 1), mid = ridge(23, 12, 1);
    const s = S(), t0 = performance.now();
    let flash = 0, nextBolt = 3 + Math.random() * 4, bolt = null;
    function size() {
      const r = cv.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      layers = null;
    }
    function drawRidge(c, pts, base, amp, color, shift) {
      c.fillStyle = color; c.beginPath(); c.moveTo(-20, H);
      const step = (W + 80) / (pts.length - 1);
      pts.forEach((v, i) => c.lineTo(-40 + i * step + shift, base - v * amp));
      c.lineTo(W + 40, H); c.closePath(); c.fill();
    }
    function castle(c, x, y, k, time) {
      c.fillStyle = '#140b26';
      const tw = (cx, w, h) => { c.fillRect(cx - w / 2, y - h, w, h); c.beginPath(); c.moveTo(cx - w * 0.65, y - h); c.lineTo(cx, y - h - w * 1.3); c.lineTo(cx + w * 0.65, y - h); c.fill(); };
      c.fillRect(x - 46 * k, y - 26 * k, 92 * k, 26 * k);
      for (let i = -46; i <= 40; i += 10) c.fillRect(x + i * k, y - 30 * k, 5 * k, 4 * k);
      tw(x, 18 * k, 62 * k); tw(x - 34 * k, 13 * k, 42 * k); tw(x + 34 * k, 13 * k, 46 * k); tw(x - 55 * k, 9 * k, 30 * k); tw(x + 56 * k, 9 * k, 34 * k);
      // Ventanas encendidas que titilan
      const wins = [[0, 44], [0, 30], [-34, 30], [34, 32], [-12, 14], [12, 14], [-55, 20], [56, 22]];
      wins.forEach(([dx, dy], i) => {
        const a = 0.55 + 0.45 * Math.sin(time * (1.3 + i * 0.37) + i);
        c.fillStyle = `rgba(253,186,116,${a})`; c.fillRect(x + dx * k - 1.6 * k, y - dy * k - 3 * k, 3.2 * k, 5 * k);
      });
      // Bandera
      c.strokeStyle = '#140b26'; c.lineWidth = 1.5 * k; c.beginPath(); c.moveTo(x, y - 85 * k); c.lineTo(x, y - 100 * k); c.stroke();
      c.fillStyle = '#be123c'; c.beginPath(); c.moveTo(x, y - 100 * k);
      c.quadraticCurveTo(x + 7 * k, y - 99 * k + Math.sin(time * 4) * 2 * k, x + 13 * k, y - 97 * k); c.lineTo(x, y - 93 * k); c.fill();
    }
    function dragon(c, x, y, k, flap) {
      c.save(); c.translate(x, y); c.scale(k, k); c.fillStyle = '#0c0618';
      c.beginPath(); c.ellipse(0, 0, 22, 5, 0, 0, Math.PI * 2); c.fill();                    // cuerpo
      c.beginPath(); c.moveTo(20, -2); c.quadraticCurveTo(30, -8, 36, -6); c.lineTo(38, -3); c.lineTo(30, -2); c.fill();   // cabeza
      c.beginPath(); c.moveTo(-20, 0); c.quadraticCurveTo(-38, 4, -50, -4); c.quadraticCurveTo(-38, 0, -20, 3); c.fill();  // cola
      const w = Math.sin(flap) * 26;
      c.beginPath(); c.moveTo(-6, -2); c.quadraticCurveTo(-4, -18 - w * 0.5, 4, -30 - w); c.lineTo(10, -18 - w * 0.5); c.lineTo(14, -24 - w * 0.6); c.quadraticCurveTo(12, -8, 8, -2); c.fill();
      c.restore();
    }
    size();
    const onResize = () => size();
    window.addEventListener('resize', onResize);
    let last = t0;
    (function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const time = (t - t0) / 1000, c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const land = W > H, horizon = H * (land ? 0.62 : 0.58);
      // Cielo de crepúsculo
      const sky = c.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#05030f'); sky.addColorStop(0.45, '#1b0f3d'); sky.addColorStop(0.8, '#4a1a4f'); sky.addColorStop(1, '#8a2f3c');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      for (const st of stars) { c.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(time * 1.2 + st.p)); c.fillStyle = '#fff'; c.fillRect(st.x * W, st.y * horizon, st.r, st.r); }
      c.globalAlpha = 1;
      // Luna con halo
      const mx = W * (land ? 0.74 : 0.7), my = H * (land ? 0.2 : 0.16), mr = Math.min(W, H) * 0.09;
      const halo = c.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4.5);
      halo.addColorStop(0, 'rgba(254,226,226,.35)'); halo.addColorStop(1, 'rgba(254,226,226,0)');
      c.fillStyle = halo; c.fillRect(0, 0, W, H);
      const moon = c.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
      moon.addColorStop(0, '#fff7ed'); moon.addColorStop(1, '#fecaca');
      c.fillStyle = moon; c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(190,120,120,.25)';
      [[-0.3, 0.1, 0.22], [0.25, -0.2, 0.15], [0.1, 0.35, 0.12]].forEach(([a, b, r]) => { c.beginPath(); c.arc(mx + a * mr, my + b * mr, r * mr, 0, Math.PI * 2); c.fill(); });
      // Nubes que pasan delante de la luna
      for (let i = 0; i < 4; i++) {
        const cx = ((time * (6 + i * 3) + i * 230) % (W + 400)) - 200, cy = H * (0.12 + i * 0.07);
        const g = c.createRadialGradient(cx, cy, 2, cx, cy, 120);
        g.addColorStop(0, 'rgba(60,30,80,.55)'); g.addColorStop(1, 'rgba(60,30,80,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, 160, 22, 0, 0, Math.PI * 2); c.fill();
      }
      // Dragón cruzando el cielo
      const dp = (time % 22) / 22;
      if (dp < 0.6) { const q = dp / 0.6; dragon(c, W * (1.15 - q * 1.35), H * (0.3 - Math.sin(q * Math.PI) * 0.12), Math.min(W, H) / 380, time * 6); }
      // Rayo de vez en cuando
      nextBolt -= dt;
      if (nextBolt <= 0) {
        nextBolt = 5 + Math.random() * 6; flash = 0.5;
        const pts = []; let x = W * (0.3 + Math.random() * 0.5), y = 0;
        while (y < horizon * 0.8) { pts.push([x, y]); x += (Math.random() - 0.5) * 50; y += 20 + Math.random() * 25; }
        bolt = { pts, t: 0.35 };
      }
      if (bolt && (bolt.t -= dt) > 0) {
        c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(216,180,254,${bolt.t / 0.35})`; c.lineWidth = 2.5; c.shadowColor = '#c4b5fd'; c.shadowBlur = 14;
        c.beginPath(); bolt.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.restore();
      }
      // Montañas lejanas con el castillo del Caos
      drawRidge(c, far, horizon, H * 0.2, '#2a1745', Math.sin(time * 0.05) * 6);
      const peakI = far.indexOf(Math.max(...far.slice(4, 15))), step = (W + 80) / (far.length - 1);
      castle(c, -40 + peakI * step + Math.sin(time * 0.05) * 6, horizon - far[peakI] * H * 0.2 + 2, Math.min(W, H) / 420, time);
      drawRidge(c, mid, horizon + H * 0.1, H * 0.16, '#170c2b', Math.sin(time * 0.08) * 12);
      // Niebla
      for (let i = 0; i < 3; i++) {
        const y = horizon + H * (0.04 + i * 0.07), off = (time * (10 + i * 6)) % W;
        const g = c.createLinearGradient(0, y - 20, 0, y + 20);
        g.addColorStop(0, 'rgba(120,80,160,0)'); g.addColorStop(0.5, `rgba(120,80,160,${0.16 - i * 0.03})`); g.addColorStop(1, 'rgba(120,80,160,0)');
        c.fillStyle = g; c.save(); c.translate(-off, 0); c.fillRect(0, y - 20, W * 2, 40); c.restore();
      }
      // Risco del héroe
      const kx = land ? W * 0.2 : W * 0.5, cliffY = land ? H * 0.86 : H * 0.94;
      c.fillStyle = '#0a0614'; c.beginPath(); c.moveTo(-10, H);
      c.lineTo(-10, cliffY + 6); c.quadraticCurveTo(kx - 60, cliffY - 8, kx, cliffY); c.quadraticCurveTo(kx + 70, cliffY + 2, kx + 120, cliffY + 30);
      c.lineTo(kx + 170, H); c.closePath(); c.fill();
      if (!land) { c.fillRect(-10, cliffY + 20, W + 20, H); }
      c.strokeStyle = 'rgba(244,114,182,.35)'; c.lineWidth = 1.5; c.beginPath();
      c.moveTo(-10, cliffY + 6); c.quadraticCurveTo(kx - 60, cliffY - 8, kx, cliffY); c.quadraticCurveTo(kx + 70, cliffY + 2, kx + 120, cliffY + 30); c.stroke();
      const rim = c.createRadialGradient(kx, cliffY - 40, 5, kx, cliffY - 40, 140);
      rim.addColorStop(0, 'rgba(244,63,94,.18)'); rim.addColorStop(1, 'rgba(244,63,94,0)');
      c.fillStyle = rim; c.fillRect(kx - 160, cliffY - 200, 320, 260);
      const ks = Math.max(1.4, Math.min(4, (land ? H * 0.5 : H * 0.3) / 64));
      Sprites.knight(c, kx, cliffY + 2, ks, { face: 1, walk: 0, swing: -1, heavy: false, time, flash: false,
        weaponColor: ITEMS[s.equip.weapon].color, armorColor: ITEMS[s.equip.armor].color, helmet: s.settings.helmet, rank: Game.rank() });
      // Brasas
      if (embers.length < 60 && Math.random() < dt * 30) embers.push({ x: Math.random() * W, y: H + 5, vx: 10 + Math.random() * 20, vy: -(30 + Math.random() * 60), life: 4, r: 0.8 + Math.random() * 1.8 });
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        e.x += (e.vx + Math.sin(time * 2 + e.y * 0.03) * 15) * dt; e.y += e.vy * dt; e.life -= dt;
        c.globalAlpha = Math.min(1, e.life / 2); c.fillStyle = '#fb923c';
        c.beginPath(); c.arc(e.x, e.y, e.r, 0, Math.PI * 2); c.fill();
      }
      for (let i = embers.length - 1; i >= 0; i--) if (embers[i].life <= 0 || embers[i].y < -10) embers.splice(i, 1);
      c.restore();
      // Destello del rayo y viñeta
      if (flash > 0) { flash -= dt; c.fillStyle = `rgba(221,214,254,${flash * 0.35})`; c.fillRect(0, 0, W, H); }
      const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
    })(t0);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }

  /* ---------- Cuenta: nombre de usuario y guardado ---------- */
  function cloudIcon() {
    const A = Game.account;
    if (A.session) {
      if (A.status === 'ok' && A.lastError) return '<span class="cloud-ico" title="Reintentando guardar en tu cuenta">⚠️</span>';
      if (A.status === 'ok') return Game.accountPending() || A.writing ? '<span class="cloud-ico saving" title="Guardando en tu cuenta">⏳</span>' : '<span class="cloud-ico" title="Guardado en tu cuenta">☁️</span>';
      return A.status === 'connecting' ? '<span class="cloud-ico" title="Conectando con tu cuenta">⏳</span>' : '<span class="cloud-ico" title="Sin conexión con la cuenta">⚠️</span>';
    }
    const st = Game.cloud.status;
    return st === 'cloud' ? '<span class="cloud-ico" title="Guardado en tu cuenta">☁️</span>' : st === 'connecting' ? '<span class="cloud-ico" title="Conectando con tu cuenta">⏳</span>' : '';
  }
  function accountText() {
    const A = Game.account, when = t => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    if (A.status === 'ok' && A.lastError) return `⚠️ No se pudo guardar en la cuenta (${A.lastError}); se reintenta solo cada pocos segundos. Tu progreso está a salvo en este dispositivo${A.lastSync ? ` · último guardado en la cuenta ${when(A.lastSync)}` : ''}.`;
    if (A.status === 'ok') return `🔐 Sesión iniciada. Tu progreso se guarda solo en tu cuenta después de cada combate y cada pocos segundos${A.lastSync ? ` · último guardado ${when(A.lastSync)}` : ''}. Entra con tu usuario y contraseña en cualquier dispositivo para seguir jugando.`;
    if (A.status === 'connecting') return '⏳ Conectando con tu cuenta…';
    if (A.status === 'denied') return '⚠️ Tu acceso a esta página no permite guardar (pide al dueño acceso de Colaborador). Se guarda en este dispositivo.';
    if (A.status === 'offline') return '📱 Ahora no hay conexión con el servidor de cuentas. Tu progreso se guarda en este dispositivo y se subirá solo a tu cuenta al recuperar la conexión.';
    if (A.status === 'missing') return '⚠️ Esta cuenta ya no existe. Cierra sesión y crea una nueva.';
    if (A.status === 'expired') return '🔑 La contraseña de la cuenta cambió. Vuelve a iniciar sesión.';
    return '⚠️ No se pudo guardar en la cuenta ahora mismo; se reintentará. Mientras tanto está guardado en este dispositivo.';
  }
  function cloudText() {
    if (Game.account.session) return accountText();
    const c = Game.cloud;
    if (c.status === 'cloud') return `☁️ Tu progreso se guarda en tu cuenta de Claude${c.lastSync ? ` · último guardado ${new Date(c.lastSync).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : ''}. Si cambias de teléfono o borras el navegador, lo recuperas al abrir el juego aquí con tu cuenta.`;
    if (c.status === 'connecting') return '⏳ Conectando con tu cuenta…';
    if (c.status === 'denied' || Game.online === false) return '🎮 Juegas como invitado: tu progreso se guarda automáticamente en este navegador. Para pasarlo a otro dispositivo usa el código de guardado.';
    if (c.status === 'error') return '⚠️ No se pudo guardar en la cuenta ahora mismo; se reintentará. Mientras tanto está guardado en este dispositivo.';
    return '📱 Se guarda solo en este dispositivo. Para guardarlo en tu cuenta, abre el juego en Claude con tu sesión iniciada, o usa el código de guardado.';
  }
  const NAME_RE = /^[\p{L}\p{N}_ .-]{3,16}$/u;
  function askUsername(force) {
    const s = S();
    if (s.username && !force) return;
    openModal(`
      <h2>${s.username ? '✏️ Cambiar nombre' : '⚔️ ¡Bienvenido a Reinos del Caos!'}</h2>
      <p class="sub">${s.username ? 'Tu nombre aparece en el menú.' : '¿Cómo te llamas, guerrero? Tu progreso se guarda solo en este navegador.'}</p>
      <form id="name-form" class="name-form">
        <input id="name-input" maxlength="16" autocomplete="nickname" placeholder="Tu nombre (3-16 letras)" value="${esc(s.username || '')}">
        <div class="hint" id="name-err"></div>
        <div class="modal-actions">
          <button class="btn" type="submit">${s.username ? '✅ Guardar nombre' : '⚔️ ¡A jugar!'}</button>
          ${s.username ? '<button class="btn ghost" type="button" data-act="close">Cancelar</button>' : '<button class="btn ghost" type="button" data-act="guest-skip">Jugar sin nombre</button>'}
        </div>
      </form>`);
    const input = $('name-input');
    setTimeout(() => input && input.focus(), 50);
    $('name-form').addEventListener('submit', e => {
      e.preventDefault();
      const v = input.value.trim().replace(/\s+/g, ' ');
      if (!NAME_RE.test(v)) { $('name-err').textContent = 'Usa de 3 a 16 letras, números, espacios, puntos o guiones.'; return; }
      S().username = v;
      Game.save(true);
      closeModal();
      toast(`👋 ¡Bienvenido, ${v}!`);
      if (RENDER[current]) RENDER[current]();
    });
  }
  /* ---------- Cuenta con usuario y contraseña ---------- */
  /** Bienvenida: entrar, crear cuenta o jugar sin cuenta. */
  async function askAccount() {
    if (Game.account.session) return;
    if (await Game.canSaveOnline() === false) { askUsername(); return; }   // invitado: directo a jugar
    if (!$('modal').hidden) return;
    openModal(`
      <h2>⚔️ Reinos del Caos</h2>
      <p class="sub">Crea una cuenta con usuario y contraseña para guardar tu progreso y recuperarlo en cualquier dispositivo.</p>
      <div class="modal-actions">
        <button class="btn" data-act="acc-create">🆕 Crear cuenta</button>
        <button class="btn ghost" data-act="acc-login">🔑 Ya tengo cuenta</button>
        <button class="btn ghost" data-act="acc-guest">Jugar sin cuenta</button>
      </div>`);
  }
  function accountForm(mode) {
    const create = mode === 'create';
    openModal(`
      <h2>${create ? '🆕 Crear cuenta' : '🔑 Iniciar sesión'}</h2>
      <p class="sub">${create ? 'Tu progreso actual se guardará en la cuenta nueva.' : 'Se cargará el progreso guardado en tu cuenta.'}</p>
      <form id="acc-form" class="name-form" autocomplete="on">
        <input id="acc-user" maxlength="16" autocomplete="username" placeholder="Usuario (3-16 letras)" value="${esc(create ? (S().username || '') : '')}">
        <input id="acc-pass" type="password" maxlength="64" autocomplete="${create ? 'new-password' : 'current-password'}" placeholder="Contraseña (mínimo 6)">
        ${create ? '<input id="acc-pass2" type="password" maxlength="64" autocomplete="new-password" placeholder="Repite la contraseña">' : ''}
        <div class="hint" id="acc-err"></div>
        <div class="modal-actions">
          <button class="btn" type="submit" id="acc-go">${create ? '✅ Crear cuenta' : '✅ Entrar'}</button>
          <button class="btn ghost" type="button" data-act="${create ? 'acc-login' : 'acc-create'}">${create ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}</button>
          <button class="btn ghost" type="button" data-act="close">Cancelar</button>
        </div>
      </form>`);
    const user = $('acc-user'), pass = $('acc-pass'), err = $('acc-err'), go = $('acc-go');
    setTimeout(() => (user.value ? pass : user).focus(), 50);
    $('acc-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = user.value.trim().replace(/\s+/g, ' ');
      if (!NAME_RE.test(name)) { err.textContent = 'El usuario debe tener de 3 a 16 letras, números, espacios, puntos o guiones.'; return; }
      if (pass.value.length < 6) { err.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
      if (create && pass.value !== $('acc-pass2').value) { err.textContent = 'Las contraseñas no coinciden.'; return; }
      go.disabled = true; err.textContent = create ? 'Creando cuenta…' : 'Entrando…';
      const fail = create ? await Game.createAccount(name, pass.value) : await Game.login(name, pass.value);
      go.disabled = false;
      if (fail) { err.textContent = fail; return; }
      closeModal();
      toast(create ? `🔐 ¡Cuenta creada! Bienvenido, ${S().username}` : `🔐 ¡Hola de nuevo, ${S().username}! Progreso cargado`);
      Sfx.setEnabled(S().settings.sound);
      const gift = Game.claimGifts();
      if (gift) { setTimeout(() => toast(gift), 900); Sfx.play('legendary'); confetti(80, ['#7dd3fc', '#fde047', '#fff']); Game.cloudWrite(); }
      refreshTop();
      show('menu');
    });
  }
  function confirmLogout() {
    openModal(`
      <h2>🚪 Cerrar sesión</h2>
      <p class="sub">Tu progreso queda guardado en la cuenta <b>${esc(Game.account.session.name)}</b>. En este dispositivo empezará una partida nueva hasta que vuelvas a entrar.</p>
      <div class="modal-actions">
        <button class="btn danger" data-act="acc-logout-ok">Cerrar sesión</button>
        <button class="btn ghost" data-act="close">Cancelar</button>
      </div>`);
  }

  /** Se llama cuando cambia el estado de la cuenta (o llega una partida guardada en ella). */
  function onCloud(loaded) {
    if (loaded) toast('☁️ Progreso recuperado de tu cuenta');
    const gift = Game.claimGifts();
    if (gift) { toast(gift); Sfx.play('legendary'); confetti(80, ['#7dd3fc', '#fde047', '#fff']); Game.cloudWrite(); if (current !== 'battle' && $('modal').hidden && RENDER[current]) RENDER[current](); }
    // Tras cada guardado solo se actualiza el icono (sin redibujar la pantalla entera)
    if (!loaded && current !== 'settings') {
      document.querySelectorAll('.cloud-ico').forEach(el => { el.outerHTML = cloudIcon() || '<span class="cloud-ico"></span>'; });
    } else if (current !== 'battle' && $('modal').hidden && RENDER[current]) RENDER[current]();
    refreshTop();
  }
  function saveCodeModal() {
    openModal(`
      <h2>💾 Código de guardado</h2>
      <p class="sub">Copia este código para pasar tu partida a otro dispositivo o al juego descargado. Pega uno para cargar esa partida (reemplaza la actual).</p>
      <textarea id="code-box" class="code-box" rows="4" readonly>${Game.exportCode()}</textarea>
      <div class="modal-actions">
        <button class="btn" data-act="code-copy">📋 Copiar mi código</button>
        <textarea id="code-in" class="code-box" rows="3" placeholder="Pega aquí un código RDC1:…"></textarea>
        <button class="btn ghost" data-act="code-load">📥 Cargar código pegado</button>
        <button class="btn ghost" data-act="close">Cerrar</button>
      </div>`);
  }

  /* ---------- Metas cercanas ("me falta poco para...") ---------- */
  function nextGoals() {
    const s = S(), out = [];
    const d = Game.ensureDaily();
    const claim = d.missions.find(m => m.progress >= m.goal && !m.claimed);
    if (claim) out.push({ text: '📜 ¡Misión lista!', to: 'missions', ready: true });
    if (s.points) out.push({ text: `👤 ${s.points} puntos`, to: 'char', ready: true });
    if (s.tickets) out.push({ text: `🎟️ ${s.tickets} tirada${s.tickets > 1 ? 's' : ''}`, to: 'wheel', ready: true });
    if (SKILL_ORDER.some(id => s.skills[id] && s.skills[id] < MAX_SKILL_LEVEL && s.coins >= SKILL_UPGRADE(s.skills[id]).coins && s.gems >= SKILL_UPGRADE(s.skills[id]).gems)) out.push({ text: '✨ Mejora una habilidad', to: 'char', ready: true });
    // Forja: la receta más cercana
    const hw = Game.highestWorld();
    let best = null;
    for (const r of RECIPES) {
      if (!r.item || s.items[r.item] || r.world > hw) continue;
      let miss = 0, missMat = null;
      for (const k in r.cost) { const m = Math.max(0, r.cost[k] - Game.matCount(k)); if (m > 0 && (!missMat || m > miss)) { missMat = k; } miss += m; }
      const coinMiss = Math.max(0, r.coins - s.coins);
      const score = miss + coinMiss / 20;
      if (!best || score < best.score) best = { r, score, miss, missMat, coinMiss };
    }
    if (best) {
      if (best.score === 0) out.push({ text: `🔨 ¡Forja lista!`, to: 'forge', ready: true });
      else if (best.missMat) out.push({ text: `🔨 Faltan ${best.r.cost[best.missMat] - Game.matCount(best.missMat)} ${ico(best.missMat)}`, to: 'forge' });
    }
    const pct = Math.floor(s.xp / xpForLevel(s.level) * 100);
    out.push({ text: `⭐ Nivel ${s.level + 1}: ${pct}%`, to: 'char' });
    const idx = stageIndexInWorld(PG().unlocked);
    const toBoss = STAGES_PER_WORLD - 1 - idx;
    if (!PG().cleared[MAX_STAGE]) out.push({ text: toBoss ? `👹 Jefe en ${toBoss}` : '👹 ¡Jefe!', to: 'map' });
    out.push({ text: `🧩 ${s.ticketShards}/${TICKET_SHARDS} → 🎟️`, to: 'wheel' });
    const pend = d.missions.filter(m => m.progress < m.goal).sort((a, b) => b.progress / b.goal - a.progress / a.goal)[0];
    if (pend) out.push({ text: `📜 ${fmt(pend.progress)}/${fmt(pend.goal)}`, to: 'missions' });
    return out.slice(0, 3);
  }

  const allMissionsClaimable = d => d.missions.every(m => m.claimed) && !d.bonusClaimed;
  const rewardText = rw => [rw.coins ? `💰 ${fmt(rw.coins)}` : '', rw.gems ? `💎 ${rw.gems}` : '', rw.tickets ? `🎟️ ${rw.tickets}` : '', rw.chest ? '🎁 Cofre' : ''].filter(Boolean).join(' + ');

  /* ---------- Misiones diarias ---------- */
  RENDER.missions = () => {
    const d = Game.ensureDaily();
    const now = new Date(), end = new Date(now); end.setHours(24, 0, 0, 0);
    const hrs = Math.floor((end - now) / 3600000), mins = Math.floor((end - now) / 60000) % 60;
    const cards = d.missions.map((m, i) => {
      const ok = m.progress >= m.goal;
      return `<div class="card mission-card ${m.claimed ? 'claimed' : ok ? 'ready' : ''}">
        <div class="m-top"><b>${esc(Game.missionText(m))}</b><span class="m-rew">${rewardText(m.reward)}</span></div>
        <div class="bar thin"><i style="width:${Math.min(100, m.progress / m.goal * 100)}%"></i></div>
        <div class="m-bottom"><span>${fmt(m.progress)} / ${fmt(m.goal)}</span>
          ${m.claimed ? '<span class="m-done">✅ Reclamada</span>' : `<button class="btn small" data-act="claim" data-i="${i}" ${ok ? '' : 'disabled'}>${ok ? '🎁 Reclamar' : 'En progreso'}</button>`}</div>
      </div>`;
    }).join('');
    const allDone = d.missions.every(m => m.claimed);
    $('scr-missions').innerHTML = `${head('📜 Misiones diarias')}
      <div class="card mission-card cal-card ${Game.loginStatus().claimable ? 'ready' : 'claimed'}">
        <div class="m-top"><b>📅 Premio diario · día ${Game.loginStatus().day + 1} de 7</b><span class="m-rew">${LOGIN_REWARDS[Game.loginStatus().day].icon} ${LOGIN_REWARDS[Game.loginStatus().day].label(Game.highestWorld())}</span></div>
        <div class="m-bottom"><span>Días seguidos: ${Game.loginStatus().claimable ? Game.loginStatus().day : Game.loginStatus().day + 1}/7</span><button class="btn small" data-act="login-open">${Game.loginStatus().claimable ? '🎁 Reclamar' : '📅 Ver calendario'}</button></div>
      </div>
      <p class="hint">Se renuevan cada día · faltan ${hrs} h ${mins} min</p>
      <div class="mission-list">${cards}</div>
      <div class="card mission-card bonus ${d.bonusClaimed ? 'claimed' : allDone ? 'ready' : ''}">
        <div class="m-top"><b>🏆 Completa las ${d.missions.length} misiones</b><span class="m-rew">🎁 Cofre + 🎟️ 1</span></div>
        <div class="m-bottom"><span>${d.missions.filter(m => m.claimed).length} / ${d.missions.length}</span>
          ${d.bonusClaimed ? '<span class="m-done">✅ Reclamada</span>' : `<button class="btn small" data-act="claim" data-i="bonus" ${allDone ? '' : 'disabled'}>🎁 Reclamar</button>`}</div>
      </div>`;
  };

  function claimMission(i) {
    const d = Game.ensureDaily();
    let text;
    if (i === 'bonus') {
      if (d.bonusClaimed || !d.missions.every(m => m.claimed)) return;
      d.bonusClaimed = true;
      text = [Game.grant({ chest: true }), Game.grant({ tickets: 1 })].join(' · ');
    } else {
      const m = d.missions[+i];
      if (!m || m.claimed || m.progress < m.goal) return;
      m.claimed = true;
      text = Object.entries(m.reward).map(([k, v]) => Game.grant({ [k]: v })).join(' · ');
    }
    Game.save();
    Sfx.play('legendary'); confetti(40); vibrate(60);
    toast(`🎁 ${text}`);
    RENDER.missions(); refreshTop();
  }

  /* ---------- Mapa ---------- */
  RENDER.map = () => {
    const s = S(), pg = PG(), D = DIF();
    let html = head(`🗺️ Mapa${D.id ? ` · <span style="color:${D.color}">${D.icon} ${D.name}</span>` : ''}`);
    if (Game.maxDiff()) html += `<div class="diff-pick map">${DIFFICULTIES.map(d => `<button class="diff-chip ${d.id === D.id ? 'on' : ''}" style="--dc:${d.color}" data-act="diff" data-d="${d.id}" ${Game.diffUnlocked(d.id) ? '' : 'disabled'}>${Game.diffUnlocked(d.id) ? d.icon : '🔒'} ${d.name}</button>`).join('')}</div>`;
    for (const w of WORLDS) {
      const first = (w.id - 1) * STAGES_PER_WORLD + 1, last = first + STAGES_PER_WORLD - 1;
      const locked = first > pg.unlocked;
      const done = Array.from({ length: STAGES_PER_WORLD }, (_, i) => pg.cleared[first + i]).filter(Boolean).length;
      let route = w.id === 1 ? '<span class="start" aria-hidden="true">🏁</span><span class="arrow">→</span>' : '';
      for (let st = first; st <= last; st++) {
        const boss = isBossStage(st);
        const cls = pg.cleared[st] ? 'done' : st === pg.unlocked ? 'current' : st > pg.unlocked ? 'locked' : '';
        const label = boss ? '👹' : st > pg.unlocked ? '🔒' : st;
        route += `<button class="node ${cls} ${boss ? 'boss' : ''}" data-act="stage" data-stage="${st}" aria-label="Etapa ${st}${boss ? ' (jefe)' : ''}">${label}</button>`;
        if (st < last) route += '<span class="arrow">→</span>';
      }
      html += `
        <div class="world ${locked ? 'locked' : ''} ${D.id ? 'diff-' + D.id : ''}" style="--wbg:${worldBg(w)}">
          <div class="world-head"><span class="wico">${w.icon}</span>
            <div><h3>Mundo ${w.id} — ${w.name}</h3><small>Etapas ${first}-${last} · ${done}/${STAGES_PER_WORLD} completadas · Jefe: ${ENEMIES[w.boss].name}</small></div>
          </div>
          <div class="route">${route}</div>
        </div>`;
    }
    const nextD = DIFFICULTIES[Game.maxDiff() + 1];
    html += nextD ? `<div class="soon">${nextD.icon} Termina el ${DIFFICULTIES[nextD.id - 1].name} para abrir la dificultad <b style="color:${nextD.color}">${nextD.name}</b><br><small>Enemigos mucho más duros, élites con poderes y mejor botín.</small></div>`
      : `<div class="soon">🔥 Has abierto todas las dificultades.<br><small>En Infierno los jefes pueden soltar objetos Divinos.</small></div>`;
    $('scr-map').innerHTML = html;
    const cur = $('scr-map').querySelector('.node.current');
    if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
  };

  function openStage(stage) {
    const s = S(), pg = PG(), D = DIF();
    if (stage > pg.unlocked) { toast(`🔒 Completa la etapa ${stage - 1} para desbloquearla`, true); return; }
    const info = applyDiff(stageInfo(stage), D), P = Game.stats(), rec = info.power;
    const powerOk = P.power >= rec * 0.85;
    const foes = (info.boss ? [info.world.boss] : []).concat(info.world.enemies);
    const drops = Object.keys(D.id ? DIFF_DROPS[D.id] : info.world.drops).map(id => `<span title="${MATERIALS[id].name}">${ico(id)}</span>`).join('');
    openModal(`
      <h2>${info.boss ? '👹 ' : ''}Etapa ${stage}${D.id ? ` <span style="color:${D.color}">· ${D.icon} ${D.name}</span>` : ''}</h2>
      <p class="sub">${esc(info.name)} · ${info.world.icon} ${info.world.name}</p>
      <div class="info-rows">
        <div class="foe-row">${foes.map(id => `<figure class="foe ${ENEMIES[id].boss ? 'boss' : ''}"><canvas data-foe="${id}" width="160" height="150"></canvas><figcaption>${ENEMIES[id].name}</figcaption></figure>`).join('')}</div>
        ${info.boss ? `<div class="info-row"><span>Jefe</span><b style="color:#fca5a5">👹 ${ENEMIES[info.world.boss].name}</b></div>` : `<div class="info-row"><span>Enemigos</span><b>${info.enemyCount} en oleadas</b></div>`}
        <div class="info-row"><span>Poder recomendado</span><b style="color:${powerOk ? '#86efac' : '#fca5a5'}">💥 ${fmt(rec)}</b></div>
        ${D.id ? `<div class="info-row"><span>Dificultad</span><b style="color:${D.color}">${D.icon} Élites con ${D.affixes} poder${D.affixes > 1 ? 'es' : ''} · botín ×${D.loot}</b></div>` : ''}
        <div class="info-row"><span>Tu poder</span><b>💥 ${fmt(P.power)}</b></div>
        <div class="info-row"><span>Materiales</span><span class="icons">${drops}${info.boss ? ico(info.world.bossDrop) : ''}</span></div>
        <div class="info-row"><span>Completada</span><b>${pg.cleared[stage] ? `✅ ${pg.cleared[stage]} ${pg.cleared[stage] === 1 ? 'vez' : 'veces'}` : `No · primera vez: +${(info.boss ? 5 : 1) * (1 + D.id * 2)} 💎`}</b></div>
      </div>
      ${!powerOk ? '<p class="hint" style="text-align:center;margin-top:10px">⚠️ Tu poder es bajo. Mejora tu equipo en la forja o prueba suerte en la ruleta.</p>' : ''}
      <div class="modal-actions">
        <button class="btn" data-act="enter" data-stage="${stage}">⚔️ Entrar</button>
        <button class="btn ghost" data-act="close">Cancelar</button>
      </div>`);
    drawFoes();
  }

  /** Retratos de los enemigos dibujados con los mismos gráficos del combate. */
  function drawFoes() {
    document.querySelectorAll('canvas[data-foe]').forEach(cv => {
      const def = ENEMIES[cv.dataset.foe], c = cv.getContext('2d');
      const wide = def.sprite.shape === 'dragon' ? 0.55 : def.sprite.shape === 'wolf' ? 0.85 : 1;
      const e = { def, x: 80, y: 138, size: 100 * wide, face: -1, walk: 0.6, flash: 0, windup: 0, windupMax: 1, recover: 0, seed: 2, frozen: 0, state: 'move' };
      // El arte ilustrado se ajusta para que se vea entero en el recuadro
      const fit = Sprites.artFit(def, 148, 128);
      if (fit) { e.size = fit.size; e.x = 80 + fit.dx; e.y = 140 - fit.dy; }
      c.clearRect(0, 0, cv.width, cv.height);
      Sprites.enemy(c, e, 0.4);
    });
  }

  /* ---------- Combate ---------- */
  function enterStage(stage) {
    closeModal();
    if (S().settings.landscape) goLandscape();
    show('battle');
    Battle.start(stage, onBattleEnd);
    checkOrientation();
  }

  /* ---------- Modo horizontal ---------- */
  let portraitOk = false, pausedByHint = false;
  const canFullscreen = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  /** Explica cómo jugar a pantalla completa cuando el navegador no lo permite (p. ej. dentro de otra app). */
  function fullscreenHelp() {
    openModal(`
      <h2>⛶ Pantalla completa</h2>
      <p class="sub">Aquí el navegador no deja poner el juego en pantalla completa (estás viéndolo dentro de otra app).</p>
      <div class="info-rows">
        <div class="info-row"><span>1.</span><b>Descarga el archivo <i>reinos-del-caos.html</i></b></div>
        <div class="info-row"><span>2.</span><b>Ábrelo con Chrome (o tu navegador)</b></div>
        <div class="info-row"><span>3.</span><b>Toca ⛶ o JUGAR: se pondrá en pantalla completa y horizontal</b></div>
      </div>
      <p class="hint" style="margin-top:10px">Truco: en Chrome, menú ⋮ → «Añadir a pantalla de inicio» para abrirlo como una app.</p>
      <div class="modal-actions"><button class="btn" data-act="close">Entendido</button></div>`);
  }
  function toggleFullscreen() {
    if (!canFullscreen()) { fullscreenHelp(); return; }
    if (isFullscreen()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    goLandscape();
  }

  /** Pide pantalla completa en horizontal (solo funciona tras un toque y si el navegador lo permite). */
  function goLandscape() {
    try {
      const el = document.documentElement;
      if (isFullscreen()) return;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      const p = req ? req.call(el, { navigationUI: 'hide' }) : null;
      const lock = () => { try { const r = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (r && r.catch) r.catch(() => {}); } catch (e) {} };
      if (p && p.then) p.then(lock).catch(() => {}); else lock();
    } catch (e) { /* no disponible */ }
  }
  const isPortrait = () => window.innerHeight > window.innerWidth;
  /** En combate, si el teléfono está vertical, pausa y pide girarlo. */
  function checkOrientation() {
    const hint = $('rotate-hint');
    const want = current === 'battle' && Battle.active && S().settings.landscape && !portraitOk && isPortrait() && matchMedia('(pointer: coarse)').matches;
    if (want && hint.hidden) {
      hint.hidden = false;
      if (!Battle.paused) { Battle.pause(); pausedByHint = true; }
    } else if (!want && !hint.hidden) {
      hint.hidden = true;
      if (pausedByHint && $('modal').hidden) Battle.resume();
      pausedByHint = false;
    }
  }

  function onBattleEnd(r) {
    const s = S();
    const k = r.victory ? 1 : 0.5;
    const skillsBefore = Object.assign({}, s.skills), itemsBefore = new Set(Object.keys(s.items));
    const bonus = r.victory ? Game.streakBonus() : 0;   // la racha mejora oro y experiencia
    const mats = {};
    let rareCount = 0;
    for (const id in r.loot.mats) {
      const q = Math.floor(r.loot.mats[id] * k);
      if (q > 0) { Game.addMat(id, q); mats[id] = q; if (RARITY_ORDER.indexOf(MATERIALS[id].rarity) >= 2) rareCount += q; }
    }
    const coins = Math.floor(r.loot.coins * k * (1 + bonus));
    s.coins += coins;
    // Premios de combo y élites (se conservan aunque pierdas)
    s.tickets += r.loot.tickets; s.gems += r.loot.gems;
    const extra = { tickets: r.loot.tickets, gems: r.loot.gems, shards: r.loot.shards };
    let made = Game.addShards(r.loot.shards);
    let xp = Math.floor(r.loot.xp * k * (1 + bonus));
    let first = false, gems = 0;
    const gifts = [];          // recompensas destacadas { icon, text }
    if (r.victory) {
      const info = stageInfo(r.stage);
      xp += Math.round(info.xp * (r.boss ? 10 : 4) * (1 + bonus));
      const dId = r.diff || 0, wasMax = Game.maxDiff();
      first = Game.completeStage(r.stage);
      gems = (first ? (r.boss ? 5 : 1) : (r.boss ? 2 : 0)) * (1 + dId * 2);
      if (Game.maxDiff() > wasMax) {
        const nd = DIFFICULTIES[Game.maxDiff()];
        gifts.push({ icon: nd.icon, text: `¡Dificultad ${nd.name} desbloqueada! Elígela en el menú` });
      }
      if (r.boss && dId) {
        // Botín especial de Pesadilla e Infierno
        gifts.push({ icon: '🌟', text: Game.grant({ mat: 'fragmento_legendario', qty: dId === 2 ? 4 + Math.floor(Math.random() * 3) : 2 }) });
        if (dId === 2) {
          const finalFirst = first && r.stage === MAX_STAGE;
          if (finalFirst || Math.random() < 0.08) {
            const div = !s.items.espada_divina ? 'espada_divina' : !s.items.armadura_divina ? 'armadura_divina' : (Math.random() < 0.5 ? 'espada_divina' : 'armadura_divina');
            gifts.push({ icon: '🌟', text: 'DIVINO: ' + Game.grant({ item: div }) });
          }
        }
      }
      s.gems += gems;
      extra.shards += 1;
      made += Game.addShards(1);
      if (first && !dId) {
        // Objetos y habilidades nuevos ya se muestran en su propia tarjeta
        for (const p of (FIRST_CLEAR[r.stage] || [])) { const t = Game.grant(p); if (!p.item && !p.skill) gifts.push({ icon: '🎁', text: t }); }
      }
      if (r.boss) {
        const w = worldOfStage(r.stage);
        const firstBoss = !s.bossKills[w.boss];
        s.bossKills[w.boss] = (s.bossKills[w.boss] || 0) + 1;
        gifts.push({ icon: '🎟️', text: Game.grant({ tickets: 1 }) + ' (jefe)' });
        // Mascota del jefe: segura la primera vez, después a veces (la sube de nivel)
        const petId = PET_ORDER.find(id => PETS[id].from === w.boss);
        if (petId && (firstBoss || !s.pets.owned[petId] || Math.random() < 0.2)) gifts.push({ icon: '🐾', text: Game.grant({ pet: petId }) });
        if (r.potionsUsed === 0) s.stats.noPotionBoss = (s.stats.noPotionBoss || 0) + 1;
        if (firstBoss) {
          if (w.bossSkill) gifts.push({ icon: '✨', text: Game.grant({ skill: w.bossSkill }) });
          else {
            const owned = SKILL_ORDER.filter(id => s.skills[id]);
            owned.forEach(id => Game.giveSkill(id));
            gifts.push({ icon: '⬆️', text: owned.length ? 'Todas tus habilidades suben de nivel' : Game.grant({ gems: 10 }) });
          }
        }
      }
      if (STREAK.ticketAt.includes(s.streak)) gifts.push({ icon: '🔥', text: `Racha x${s.streak}: ` + Game.grant({ tickets: 1 }) });
    } else {
      s.stats.deaths++;
    }
    const lostStreak = !r.victory && s.streak > 0 ? s.streak : 0;
    if (!r.victory) s.streak = 0;
    // Misiones diarias
    const done = [
      ...Game.track('kill', r.kills || 0), ...Game.track('coins', coins), ...Game.track('rare', rareCount),
      ...Game.track('combo', r.maxCombo || 0), ...Game.track('elite', r.elites || 0),
      ...(r.victory ? [...Game.track('stage', 1), ...Game.track('streak', s.streak)] : []),
    ];
    s.stats.elites += r.elites || 0;
    s.stats.bestCombo = Math.max(s.stats.bestCombo, r.maxCombo || 0);
    const petUp = Game.petGainXp(r.kills || 0);
    if (petUp) gifts.push({ icon: '🐾', text: `${PETS[s.pets.active].name} subió a nivel ${petUp}` });
    const ups = Game.addXp(xp);
    const rankNow = Game.rank(), rankUp = rankNow > s.rank ? rankNow : null;
    s.rank = Math.max(s.rank, rankNow);
    const newSkills = SKILL_ORDER.filter(id => !skillsBefore[id] && s.skills[id]);
    const newItems = Object.keys(s.items).filter(id => !itemsBefore.has(id));
    Game.save(true); Game.cloudWrite();   // al terminar cada combate se sube enseguida a la cuenta
    if (ups) Sfx.play('levelup');
    showResults({ r, mats, coins, xp, first, gems, gifts, extra, made, ups, rankUp, newSkills, newItems, done, bonus, lostStreak });
  }

  function lootChips(mats, coins, extra) {
    let h = coins ? `<span class="loot" style="--rc:#fde047">💰 ${fmt(coins)}</span>` : '';
    if (extra) {
      if (extra.tickets) h += `<span class="loot" style="--rc:#f472b6">🎟️ ${extra.tickets}</span>`;
      if (extra.gems) h += `<span class="loot" style="--rc:var(--gem)">💎 ${extra.gems}</span>`;
      if (extra.shards) h += `<span class="loot" style="--rc:#c4b5fd">🧩 ${extra.shards}</span>`;
    }
    Object.keys(mats).sort((a, b) => RARITY_ORDER.indexOf(MATERIALS[b].rarity) - RARITY_ORDER.indexOf(MATERIALS[a].rarity)).forEach((id, i) => {
      h += `<span class="loot" style="--rc:${rc(MATERIALS[id].rarity)};animation-delay:${i * 0.05}s" title="${MATERIALS[id].name}">${ico(id)} ${mats[id]}</span>`;
    });
    return h || '<span class="hint">Nada esta vez</span>';
  }

  /** ¿Es este objeto mejor que el que lleva equipado? */
  function isUpgrade(id) {
    const it = ITEMS[id], cur = S().equip[it.type];
    if (cur === id) return false;
    const a = Game.itemStats(id), b = Game.itemStats(cur);
    return it.type === 'weapon' ? a.dmg > b.dmg : a.def + a.hp / 5 > b.def + b.hp / 5;
  }
  const equipCard = id => {
    const it = ITEMS[id], st = Game.itemStats(id);
    return `<div class="unlock-card item" style="--rc:${rc(it.rarity)}">
      <div class="u-icon">${ico(id)}</div>
      <div class="u-body"><div class="u-kicker">¡Nuevo equipo!</div><div class="u-name">${it.name}</div>
        <div class="u-desc">${RARITIES[it.rarity].icon} ${RARITIES[it.rarity].name} · ${it.type === 'weapon' ? `⚔️ ${st.dmg}` : `🛡️ ${st.def} · ❤️ +${st.hp}`}</div></div>
      ${isUpgrade(id) ? `<button class="btn small" data-act="equip-keep" data-id="${id}">Equipar</button>` : ''}
    </div>`;
  };

  function showResults(o) {
    const { r } = o, s = S();
    const next = r.stage + 1;
    let title;
    if (r.abandoned) title = '<div class="reward-title lose">🏳️ Etapa abandonada</div><p class="sub">Conservas la mitad del botín</p>';
    else if (!r.victory) title = '<div class="reward-title lose">💀 Has caído</div><p class="sub">Conservas la mitad del botín. ¡Mejora tu equipo y vuelve!</p>';
    else if (r.boss) title = `<div class="reward-title boss">🏆 ¡JEFE DERROTADO!</div><p class="sub">${ENEMIES[worldOfStage(r.stage).boss].name} ha caído</p>`;
    else title = `<div class="reward-title">¡Etapa ${r.stage} completada!</div><p class="sub">${esc(stageInfo(r.stage).name)}</p>`;
    const streakLine = r.victory
      ? `<div class="streak-badge">🔥 Racha x${s.streak}${o.bonus ? ` · +${Math.round(o.bonus * 100)}% oro y XP` : ''}</div>`
      : (o.lostStreak ? `<div class="streak-badge lost">💔 Perdiste tu racha x${o.lostStreak}</div>` : '');
    const special = r.victory && r.specialDrop ? `<div class="levelup">✨ Material especial: ${ico(r.specialDrop)} ${MATERIALS[r.specialDrop].name}</div>` : '';
    const skillCards = o.newSkills.map(id => `
      <div class="unlock-card skill">
        <div class="u-icon spin">${SKILLS[id].icon}</div>
        <div class="u-body"><div class="u-kicker">¡Nueva habilidad!</div><div class="u-name">${SKILLS[id].name}</div><div class="u-desc">${SKILLS[id].desc} Úsala con el botón ${SKILLS[id].icon} en combate.</div></div>
      </div>`).join('');
    const rankCard = o.rankUp != null ? `
      <div class="unlock-card rank" style="--rc:${RANKS[o.rankUp].color}">
        <canvas id="rank-cv" width="120" height="150" aria-hidden="true"></canvas>
        <div class="u-body"><div class="u-kicker">¡Ascenso!</div><div class="u-name">${RANKS[o.rankUp].name}</div><div class="u-desc">Tu caballero luce más poderoso.</div></div>
      </div>` : '';
    const missionsDone = (o.done.length ? `<div class="levelup mission">📜 Misión completada: ${o.done.map(m => esc(Game.missionText(m))).join(' · ')} — reclámala en Misiones</div>` : '')
      + (Game.achClaimable() ? '<div class="levelup mission">🏅 ¡Tienes logros por reclamar en 🏆 Logros!</div>' : '');
    const nextShard = TICKET_SHARDS - s.ticketShards;
    openModal(`
      ${title}
      ${streakLine}
      ${skillCards}${rankCard}${o.newItems.map(equipCard).join('')}
      ${o.ups ? `<div class="levelup">⭐ ¡Subiste a nivel ${s.level}! +${o.ups * BALANCE.pointsPerLevel} puntos de estadística · +${o.ups} 💎</div>` : ''}
      ${missionsDone}
      <div class="info-rows">
        <div class="info-row"><span>Experiencia</span><b>⭐ +${fmt(o.xp)} XP</b></div>
        ${r.maxCombo >= 3 ? `<div class="info-row"><span>Combo máximo</span><b style="color:var(--gold)">🔥 x${r.maxCombo}</b></div>` : ''}
        ${r.elites ? `<div class="info-row"><span>Élites derrotados</span><b style="color:#facc15">⭐ ${r.elites}</b></div>` : ''}
        ${o.gems ? `<div class="info-row"><span>${o.first ? 'Primera victoria' : 'Victoria contra jefe'}</span><b style="color:var(--gem)">💎 +${o.gems}</b></div>` : ''}
        <div class="info-row"><span>Tickets de ruleta</span><b>🎟️ ${s.tickets}${o.made ? ` <small class="up">(+${o.made})</small>` : ''} · 🧩 ${s.ticketShards}/${TICKET_SHARDS}</b></div>
      </div>
      <div class="loot-grid">${lootChips(o.mats, o.coins, o.extra)}</div>
      ${o.gifts.length ? `<div class="gift-list">${o.gifts.map(g => `<div class="gift">${g.icon} ${esc(g.text)}</div>`).join('')}</div>` : ''}
      ${special}
      ${r.victory ? `
        <div class="chest-wrap">
          <button class="chest ${r.boss ? 'gold' : ''}" id="chest" data-act="chest" data-stage="${r.stage}" data-boss="${r.boss ? 1 : 0}" aria-label="Abrir cofre">${r.boss ? '👑' : '🧰'}</button>
          <div class="chest-hint" id="chest-hint">Toca el ${r.boss ? 'cofre real' : 'cofre'} para abrirlo</div>
          <div class="loot-grid" id="chest-loot"></div>
        </div>` : '<p class="hint" style="text-align:center">Consejo: fabrica o mejora tu equipo en la 🔨 Forja, sube estadísticas en 👤 Héroe o gira la 🎰 Ruleta.</p>'}
      ${r.victory && nextShard < TICKET_SHARDS ? `<p class="hint" style="text-align:center;margin:6px 0 0">🎟️ ${nextShard === 1 ? '¡Una etapa más' : `${nextShard} etapas más`} y consigues otra tirada!</p>` : ''}
      <div class="modal-actions" id="result-actions" ${r.victory ? 'hidden' : ''}>
        ${r.victory && next <= MAX_STAGE && next <= PG().unlocked ? `<button class="btn" data-act="enter" data-stage="${next}">▶ Etapa ${next}${isBossStage(next) ? ' · ¡JEFE!' : ''}</button>` : ''}
        ${!r.victory ? `<button class="btn" data-act="enter" data-stage="${r.stage}">🔁 Reintentar</button>` : `<button class="btn ghost" data-act="enter" data-stage="${r.stage}">🔁 Repetir etapa</button>`}
        <button class="btn ghost" data-act="go" data-to="wheel">🎰 Ruleta${s.tickets ? ` (${s.tickets} 🎟️)` : ''}</button>
        <button class="btn ghost" data-act="go" data-to="${r.victory ? 'map' : 'forge'}">${r.victory ? '🗺️ Mapa' : '🔨 Forja'}</button>
        <button class="btn ghost" data-act="go" data-to="menu">🏠 Menú</button>
      </div>`);
    if (o.rankUp != null) animateKnight('rank-cv', 'battle', 52, 140, 2.1);
    if (o.newSkills.length || o.rankUp != null) { confetti(70); Sfx.play('legendary'); }
    else if (r.victory && r.boss) confetti(80);
  }

  function openChest(btn) {
    if (btn.classList.contains('opening') || btn.classList.contains('open')) return;
    const stage = +btn.dataset.stage, boss = btn.dataset.boss === '1';
    btn.classList.add('opening');
    Sfx.play('chest');
    setTimeout(() => {
      const rewards = Game.rollChest(stage, boss);
      let html = '', best = 0;
      rewards.forEach((p, i) => {
        const isNew = p.item && !S().items[p.item];
        const text = Game.grant(p);
        if (isNew) $('chest-loot').insertAdjacentHTML('afterend', equipCard(p.item));
        const rar = p.item ? ITEMS[p.item].rarity : p.mat ? MATERIALS[p.mat].rarity : p.potion ? POTIONS[p.potion].rarity : p.gems ? 'raro' : 'comun';
        best = Math.max(best, RARITY_ORDER.indexOf(rar));
        html += `<span class="loot" style="--rc:${rc(rar)};animation-delay:${i * 0.12}s">${esc(text)}</span>`;
      });
      Game.save();
      refreshTop();
      btn.classList.remove('opening');
      btn.classList.add('open');
      btn.textContent = '✨';
      $('chest-hint').textContent = best >= 2 ? '¡Buen botín!' : '¡Cofre abierto!';
      $('chest-loot').innerHTML = html;
      $('result-actions').hidden = false;
      if (best >= 3) { Sfx.play('legendary'); confetti(40); } else Sfx.play('coin');
    }, 650);
  }

  function openPause() {
    Battle.pause();
    openModal(`
      <h2>⏸ Pausa</h2>
      <p class="sub">Si abandonas conservas la mitad del botín recogido.</p>
      <div class="modal-actions">
        <button class="btn" data-act="resume">▶ Continuar</button>
        <button class="btn danger" data-act="abandon">🏳️ Abandonar etapa</button>
      </div>`, () => { if (Battle.active && Battle.paused) Battle.resume(); });
  }

  /* ---------- Ruleta ---------- */
  const unlockedWheels = () => Object.keys(WHEELS).filter(id => Game.wheelOpen(id));
  /** Qué hay que hacer para abrir una ruleta. */
  const wheelLock = w => (w.req ? `Termina todos los mundos en ${DIFFICULTIES[w.req - 1].name}` : `Se desbloquea en el mundo ${w.world}`);

  RENDER.wheel = () => {
    const ids = unlockedWheels();
    if (!view.wheel || !ids.includes(view.wheel)) view.wheel = ids.filter(id => !WHEELS[id].gemOnly).pop();
    const w = WHEELS[view.wheel];
    const tabs = Object.keys(WHEELS).map(id => {
      const ok = ids.includes(id), W_ = WHEELS[id];
      return `<button class="tab ${id === view.wheel ? 'active' : ''}" data-act="wheel-sel" data-id="${id}" ${ok ? '' : 'disabled'} title="${ok ? W_.name : wheelLock(W_)}">${ok ? W_.icon : '🔒'} ${W_.name.replace('Ruleta ', '')}</button>`;
    }).join('');
    const odds = RARITY_ORDER.filter(r => w.odds[r] != null).map(r => {
      const prizes = w.prizes.filter(p => p.r === r).map(p => Game.prizeLabel(p).full).join(', ');
      return `<div class="odd-row" style="--rc:${rc(r)}"><b>${RARITIES[r].icon} ${RARITIES[r].name}</b><span class="prz">${esc(prizes)}</span><span class="pct">${w.odds[r]}%</span></div>`;
    }).join('');
    $('scr-wheel').innerHTML = `
      ${head('🎰 Ruleta')}
      <div class="tabs">${tabs}</div>
      <div class="wheel-area ${w.gemOnly ? 'diamond' : ''}">
        <h3 style="color:var(--gold)">${w.icon} ${w.name}</h3>
        <div class="wheel-box" style="--wglow:${w.rim}88">
          <div class="wheel-glow"></div>
          <div class="wheel-pointer"></div>
          <canvas id="wheel-cv" width="640" height="640"></canvas>
          <div class="wheel-hub">${w.icon}</div>
        </div>
        ${w.gemOnly ? diamondBox(w) : `<div class="ticket-box">
          <div><b>🎟️ ${S().tickets}</b> tickets · 🧩 ${S().ticketShards}/${TICKET_SHARDS}</div>
          <div class="bar thin"><i style="width:${S().ticketShards / TICKET_SHARDS * 100}%"></i></div>
        </div>
        <button class="btn wide ${S().tickets ? 'glow' : ''}" data-act="spin" data-mode="ticket" ${S().tickets ? '' : 'disabled'}>🎟️ Girar con 1 ticket</button>
        <div class="cost-row">${costPills(w.cost)}</div>
        <div class="spin-row">
          <button class="btn ghost" data-act="spin" data-mode="mats" ${Game.hasCost(w.cost) ? '' : 'disabled'}>🎰 Girar con materiales</button>
          <button class="btn ghost" data-act="spin" data-mode="gems" ${S().gems >= w.gemCost ? '' : 'disabled'}>Girar con 💎 ${w.gemCost}</button>
        </div>
        <p class="hint" style="text-align:center;margin:0">Consigue 🎟️ completando etapas (cada ${TICKET_SHARDS} 🧩 = 1 🎟️), venciendo jefes y élites, con combos, rachas y misiones. Si sale un objeto que ya tienes, sube un nivel.</p>`}
        <div class="odds">${odds}</div>
      </div>`;
    drawWheel(w);
    $('wheel-cv').style.transform = `rotate(${view.wheelRot}deg)`;
  };

  /** Panel de las ruletas especiales: precio, seguro de suerte y botones. */
  const SPECIAL_TEXT = {
    diamante: 'Sin premios básicos: el <b>Fénix</b>, las <b>Alas del Fénix</b>, objetos <b>míticos</b> y <b>divinos</b>, y montones de tickets, gemas y fragmentos legendarios.',
    pesadilla: 'Premios de Pesadilla: el <b>Dragoncito</b>, el <b>Velo de Pesadilla</b>, la <b>Estela de almas</b> y objetos <b>divinos</b>. También gira con <b>Almas de pesadilla</b>, que caen en esa dificultad.',
    infierno: 'Lo mejor del juego: el <b>Diablillo</b>, la <b>Corona Infernal</b>, la <b>Estela infernal</b> y el <b>Tesoro Divino</b> (las dos piezas divinas + 150 💎). También gira con <b>Brasas infernales</b>.',
  };
  function diamondBox(w) {
    const s = S(), id = view.wheel, n = (s.wheelPity && s.wheelPity[id]) || 0, left = Math.max(1, w.pity - n), can = s.gems >= w.gemCost;
    const mc = w.matCost, canM = mc && Game.hasCost(mc);
    return `<div class="diamond-box ${id}">
      <div class="db-row"><span>💎 Tienes <b>${fmt(s.gems)}</b></span><span>Cada tirada: <b>${w.gemCost} 💎</b>${mc ? ` o ${costPills(mc)}` : ''}</span></div>
      <div class="db-pity"><span>⭐ Premio <b style="color:#fb923c">Legendario</b> o mejor seguro en <b>${left}</b> tirada${left > 1 ? 's' : ''}</span>
        <div class="bar thin"><i style="width:${n / w.pity * 100}%"></i></div></div>
      <div class="spin-row">
        <button class="btn wide diamond-btn ${can ? 'glow' : ''}" data-act="spin" data-mode="gems" ${can ? '' : 'disabled'}>💎 Girar por ${w.gemCost}</button>
        ${mc ? `<button class="btn wide ghost" data-act="spin" data-mode="mats" ${canM ? '' : 'disabled'}>${Object.keys(mc).map(k => ico(k)).join('')} Girar con ${Object.values(mc)[0]}</button>` : ''}
      </div>
      <p class="hint" style="text-align:center;margin:0">${SPECIAL_TEXT[id] || ''}</p>
    </div>`;
  }

  function drawWheel(w) {
    const cv = $('wheel-cv'), c = cv.getContext('2d'), R = 320, n = w.prizes.length, seg = Math.PI * 2 / n;
    c.clearRect(0, 0, 640, 640);
    c.save(); c.translate(R, R);
    c.fillStyle = w.rim; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
    w.prizes.forEach((p, i) => {
      const a0 = -Math.PI / 2 + i * seg, a1 = a0 + seg;
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R - 16, a0, a1); c.closePath();
      const g = c.createRadialGradient(0, 0, 40, 0, 0, R);
      g.addColorStop(0, i % 2 ? w.wood : shadeHex(w.wood, -18));
      g.addColorStop(1, RARITIES[p.r].color);
      c.fillStyle = g; c.fill();
      c.strokeStyle = '#00000088'; c.lineWidth = 3; c.stroke();
      const lab = Game.prizeLabel(p);
      c.save();
      c.rotate(a0 + seg / 2);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '56px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      const im = lab.id && Icons.image(lab.id);
      c.save(); c.translate(R * 0.6, 0); c.rotate(Math.PI / 2);
      if (lab.pet === 'fenix') Sprites.phoenix(c, -4, 34, 46, 0.6, 1);
      else if (lab.pet) {
        const e = { def: { sprite: { art: PETS[lab.pet].art } }, x: 0, y: 34, size: 60, face: -1, walk: 0, flash: 0, windup: 0, windupMax: 1, recover: 0, seed: 1, frozen: 0, state: 'move' };
        const fit = Sprites.artFit(e.def, 92, 80);
        if (fit) { e.size = fit.size; e.x = fit.dx; e.y = 36 - fit.dy; }
        Sprites.enemy(c, e, 0.5);
      }
      else if (lab.cosmetic) {
        const s_ = S(), C = COSMETICS[lab.cosmetic];
        if (C.type === 'trail') for (let i = 0; i < 9; i++) { const pt = Sprites.trailPart(lab.cosmetic, -14 - i * 7, 40, 1, 1.6); pt.life = pt.max * (1 - i / 10); Sprites.drawPart(c, pt); }
        Sprites.knight(c, 0, 42, 1.25, { face: 1, walk: 0, swing: -1, heavy: false, time: 0.8, aura: C.type === 'aura' ? lab.cosmetic : '', flash: false,
          weaponColor: ITEMS[s_.equip.weapon].color, armorColor: ITEMS[s_.equip.armor].color, helmet: s_.settings.helmet, rank: Game.rank() });
      }
      else if (im && im.complete && im.naturalWidth) c.drawImage(im, -40, -40, 80, 80);
      else {
        c.fillText(lab.icon, 0, 0);
        if (im) im.onload = () => { if (current === 'wheel' && $('wheel-cv')) drawWheel(w); };
      }
      c.restore();
      c.font = '800 24px "Alegreya Sans", system-ui, sans-serif';
      c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 5;
      c.save(); c.translate(R * 0.83, 0); c.rotate(Math.PI / 2);
      c.strokeText(lab.name, 0, 0); c.fillText(lab.name, 0, 0); c.restore();
      c.restore();
    });
    // Remaches dorados
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * seg / 2;
      c.fillStyle = '#fde68a'; c.beginPath(); c.arc(Math.cos(a) * (R - 8), Math.sin(a) * (R - 8), 5, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  function shadeHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, v + amt));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function spin(mode) {
    if (view.spinning) return;
    const w = WHEELS[view.wheel];
    let paid;
    if (mode === 'ticket') { paid = S().tickets > 0; if (paid) { S().tickets--; Game.save(); } }
    else paid = mode === 'gems' ? Game.payCost({}, 0, w.gemCost) : Game.payCost(w.gemOnly ? w.matCost || { _: 1 } : w.cost);
    if (!paid) { toast('No tienes suficientes recursos para girar', true); return; }
    view.spinning = true;
    S().stats.spins++;
    refreshTop();
    document.querySelectorAll('[data-act="spin"], [data-act="wheel-sel"], #scr-wheel .back').forEach(b => { b.disabled = true; });
    // Elige rareza según probabilidades y luego un premio de esa rareza
    let rar = weightedPick(w.odds);
    if (w.pity) {
      // Seguro de suerte: tras varias tiradas sin premio especial, toca uno seguro
      const P = S().wheelPity = S().wheelPity || {}, top = ['legendario', 'mitico', 'divino'];
      P[view.wheel] = (P[view.wheel] || 0) + 1;
      if (P[view.wheel] >= w.pity) { const o = {}; for (const r of top) if (w.odds[r]) o[r] = w.odds[r]; rar = weightedPick(o); }
      if (top.includes(rar)) P[view.wheel] = 0;
      Game.save();
    }
    const options = w.prizes.map((p, i) => i).filter(i => w.prizes[i].r === rar);
    const idx = options[Math.floor(Math.random() * options.length)];
    const n = w.prizes.length, segDeg = 360 / n;
    const start = view.wheelRot;
    const jitter = (Math.random() - 0.5) * segDeg * 0.7;
    const want = -(idx + 0.5) * segDeg + jitter;
    const delta = ((want - start) % 360 + 360) % 360;
    const end = start + 360 * 5 + delta;
    const dur = 2700, t0 = performance.now(), cv = $('wheel-cv');
    let lastSeg = Math.floor(start / segDeg);
    (function frame(t) {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      const rot = start + (end - start) * e;
      cv.style.transform = `rotate(${rot}deg)`;
      const sg = Math.floor(rot / segDeg);
      if (sg !== lastSeg) { lastSeg = sg; Sfx.play('tick'); }
      if (k < 1) return requestAnimationFrame(frame);
      view.wheelRot = rot % 360;
      view.spinning = false;
      revealPrize(w.prizes[idx]);
    })(t0);
  }

  function revealPrize(p) {
    const text = Game.grant(p);
    Game.save();
    const lab = Game.prizeLabel(p), r = RARITIES[p.r], ri = RARITY_ORDER.indexOf(p.r);
    const shout = ['Común', 'Poco común', '¡Raro!', '¡ÉPICO!', '🎉 ¡LEGENDARIO!', '🔥 ¡¡MÍTICO!!', '🌟 ¡¡¡DIVINO!!!'][ri];
    let name = lab.full;
    if (p.item) name = ITEMS[p.item].name;
    openModal(`
      <div class="prize-reveal ${ri >= 4 ? 'legend' : ri >= 3 ? 'epic' : ''}" style="--rc:${r.color}">
        <div class="prize-rarity">${shout}</div>
        <div class="prize-icon">${lab.pet || lab.cosmetic ? '<canvas id="prize-cv" width="240" height="220"></canvas>' : lab.id ? ico(lab.id) : lab.icon}</div>
        <div class="prize-name">${esc(name)}</div>
        <div class="prize-detail">${esc(text)}</div>
      </div>
      <div class="modal-actions">
        <button class="btn" data-act="close">¡Genial!</button>
      </div>`, () => RENDER.wheel());
    if (lab.pet || lab.cosmetic) animatePrize(lab);
    if (ri >= 4) { Sfx.play('legendary'); confetti(110, [r.color, '#fde047', '#ffffff']); vibrate(120); }
    else if (ri >= 3) { Sfx.play('legendary'); confetti(50, [r.color, '#ffffff']); }
    else Sfx.play('chest');
    refreshTop();
  }

  /** Torre: elegir 1 de 3 mejoras al superar un piso. */
  function blessingPick(opts, list, pick) {
    const counts = {};
    for (const o of list) counts[o.id] = (counts[o.id] || 0) + 1;
    const cards = opts.map((o, i) => {
      const B = BLESSINGS[o.id], T = BLESS_TIERS[o.tier];
      return `<button class="bless-card t${o.tier}" style="--tc:${T.color}" data-bless="${i}">
        <span class="bl-tier">${T.name}</span><span class="bl-ico">${B.icon}</span>
        <b class="bl-name">${B.name}</b><span class="bl-desc">${B.desc(B.vals[o.tier])}</span>
        ${counts[o.id] ? `<span class="bl-have">Ya tienes x${counts[o.id]} · se suma</span>` : ''}</button>`;
    }).join('');
    const mine = Object.keys(counts).map(id => `<span class="pill">${BLESSINGS[id].icon} x${counts[id]}</span>`).join('');
    let chosen = false;
    openModal(`<div class="bless-wrap"><h2>✨ Elige una mejora</h2><p class="sub">Dura toda esta escalada de la Torre</p>
      <div class="bless-row">${cards}</div>${mine ? `<div class="bless-mine">${mine}</div>` : ''}</div>`, () => { if (!chosen) { chosen = true; pick(0); } });
    document.querySelectorAll('[data-bless]').forEach(b => b.addEventListener('click', () => {
      if (chosen) return; chosen = true;
      b.classList.add('picked'); Sfx.play('click');
      setTimeout(() => { closeModal(); pick(+b.dataset.bless); }, 260);
    }));
  }

  /** Animación del premio especial (Fénix o Alas del Fénix) al salir en la ruleta. */
  function animatePrize(lab) {
    const cv = $('prize-cv');
    if (!cv) return;
    if (lab.cosmetic) {
      const C = COSMETICS[lab.cosmetic], w_ = S().cosmetics;
      animateKnight('prize-cv', 'wheel', 120, 210, 2.5, () => ({ aura: C.type === 'aura' ? lab.cosmetic : w_.aura, trail: C.type === 'trail' ? lab.cosmetic : null }));
      return;
    }
    const c = cv.getContext('2d'), t0 = performance.now(), s = S();
    const P = PETS[lab.pet], e = P.custom ? null : { def: { sprite: { art: P.art } }, x: 120, y: 200, size: 120, face: 1, walk: 0, flash: 0, windup: 0, windupMax: 1, recover: 0, seed: 1, frozen: 0, state: 'move' };
    if (e) { const fit = Sprites.artFit(e.def, 220, 180); if (fit) { e.size = fit.size; e.x = 120 + fit.dx; e.y = 205 - fit.dy; } }
    (function frame(t) {
      if (!document.body.contains(cv)) return;
      const time = (t - t0) / 1000;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      if (e) { e.walk = time * 8; Sprites.enemy(c, e, time); }
      else if (lab.pet) Sprites.phoenix(c, 120, 190, 92, time, 1);
      else Sprites.knight(c, 120, 210, 2.5, { face: 1, walk: 0, swing: -1, heavy: false, time, aura: lab.cosmetic, flash: false,
        weaponColor: ITEMS[s.equip.weapon].color, armorColor: ITEMS[s.equip.armor].color, helmet: s.settings.helmet, rank: Game.rank() });
      requestAnimationFrame(frame);
    })(t0);
  }

  /* ---------- Forja ---------- */
  RENDER.forge = () => {
    const s = S(), hw = Game.highestWorld();
    let body = '';
    if (view.forgeTab === 'craft') {
      // Elige la receta seleccionada (o la primera que se pueda fabricar)
      const avail = i => { const r = RECIPES[i]; return r.world <= hw && !(r.item && s.items[r.item]); };
      if (view.forgeSel === undefined || !RECIPES[view.forgeSel] || RECIPES[view.forgeSel].world > hw) {
        const ready = RECIPES.findIndex((r, i) => avail(i) && Game.hasCost(r.cost, r.coins));
        view.forgeSel = ready >= 0 ? ready : Math.max(0, RECIPES.findIndex((r, i) => avail(i)));
      }
      const tiles = RECIPES.map((rec, i) => {
        const locked = rec.world > hw, d = rec.potion ? POTIONS[rec.potion] : ITEMS[rec.item];
        const owned = rec.item && s.items[rec.item], ready = !locked && !owned && Game.hasCost(rec.cost, rec.coins);
        const tag = locked ? '<span class="ft-tag lock">🔒</span>' : owned ? '<span class="ft-tag own">✓</span>' : ready ? '<span class="ft-tag go">!</span>' : rec.potion ? `<span class="ft-tag qty">${s.potions[rec.potion] || 0}</span>` : '';
        return `<button class="ftile ${view.forgeSel === i ? 'sel' : ''} ${locked ? 'locked' : ''} ${owned ? 'owned' : ''} ${ready ? 'ready' : ''}" style="--rc:${rc(d.rarity)}" data-act="forge-sel" data-i="${i}" aria-label="${esc(d.name)}"><span class="ft-ico">${ico(rec.potion || rec.item)}</span>${tag}</button>`;
      }).join('');
      body = `<div class="forge-wrap">${forgeStage('craft', view.forgeSel)}<div class="forge-side"><div class="fside-title">📜 Recetas</div><div class="forge-grid">${tiles}</div></div></div>`;
    } else if (view.forgeTab === 'enchant') {
      const wid = s.equip.weapon, w = ITEMS[wid], curE = s.enchants[wid];
      const cards = ENCHANT_ORDER.map(id => {
        const E = ENCHANTS[id], has = curE === id, owned = Game.enchantOwned(id);
        let act;
        if (has) act = '<div class="item-meta">✅ Tu arma ya tiene este encantamiento</div><button class="btn small ghost" data-act="enchant-off">✖️ Quitar</button>';
        else if (owned) act = `<div class="item-meta">💾 Ya lo compraste para esta arma: cambiar es gratis</div>
          <button class="btn small" data-act="enchant" data-id="${id}">🔄 ${curE ? 'Cambiar a este (gratis)' : 'Ponerlo (gratis)'}</button>`;
        else act = `<div class="stat-line">${costPills(E.cost, E.coins, E.gems)}</div>
          <button class="btn small" data-act="enchant" data-id="${id}" ${Game.hasCost(E.cost, E.coins, E.gems) ? '' : 'disabled'}>🪄 ${curE ? 'Comprar y cambiar' : 'Encantar'}</button>
          ${Game.hasCost(E.cost, E.coins, E.gems) ? '' : '<div class="item-meta">🔒 Te faltan materiales, monedas o gemas</div>'}`;
        return `<div class="card item-card" style="--rc:${E.color}">
          <div class="item-head"><div class="item-icon">${E.icon}</div><div><div class="item-name">${E.name}${has ? ' <small style="color:var(--heal)">(activo)</small>' : ''}</div><div class="item-meta">${E.desc}</div></div></div>
          ${act}
        </div>`;
      }).join('');
      body = `<div class="card enchant-now" style="--rc:${rc(w.rarity)}"><div class="item-head"><div class="item-icon">${ico(wid)}</div><div><div class="item-name">${w.name}</div>
        <div class="item-meta">${curE ? `Encantamiento: ${ENCHANTS[curE].icon} ${ENCHANTS[curE].name}` : 'Sin encantamiento'}</div></div></div></div>
        <p class="hint">Cada arma lleva un encantamiento a la vez. Los que compras para un arma se quedan guardados: puedes cambiar entre ellos gratis cuando quieras.</p>
        <div class="cards">${cards}</div>`;
    } else {
      const ids = Object.keys(s.items).sort((a, b) => (ITEMS[a].type > ITEMS[b].type ? -1 : ITEMS[a].type < ITEMS[b].type ? 1 : 0) || RARITY_ORDER.indexOf(ITEMS[b].rarity) - RARITY_ORDER.indexOf(ITEMS[a].rarity));
      if (!view.upSel || !s.items[view.upSel]) view.upSel = s.equip.weapon;
      const tiles = ids.map(id => {
        const it = ITEMS[id], lvl = s.items[id].lvl, eq = s.equip.weapon === id || s.equip.armor === id;
        const max = lvl >= Game.itemMaxLevel(), c = max ? null : upgradeCost(id), ready = c && Game.hasCost(c.cost, c.coins);
        return `<button class="ftile ${view.upSel === id ? 'sel' : ''} ${ready ? 'ready' : ''}" style="--rc:${rc(it.rarity)}" data-act="up-sel" data-id="${id}" aria-label="${esc(it.name)}">
          <span class="ft-ico">${ico(id)}</span>${eq ? '<span class="ft-tag eq">E</span>' : ready ? '<span class="ft-tag go">!</span>' : ''}<span class="ft-stars">${'★'.repeat(Math.min(lvl, MAX_ITEM_LEVEL))}${lvl > MAX_ITEM_LEVEL ? `<i class="asc-stars">${'✦'.repeat(lvl - MAX_ITEM_LEVEL)}</i>` : ''}</span></button>`;
      }).join('');
      body = `<div class="forge-wrap">${forgeStage('upgrade', view.upSel)}<div class="forge-side"><div class="fside-title">🎒 Tus objetos</div><div class="forge-grid">${tiles}</div></div></div>`;
    }
    $('scr-forge').innerHTML = `<div class="forge-top">${head('🔨 Forja')}
      <div class="tabs forge-tabs">
        <button class="tab ${view.forgeTab === 'craft' ? 'active' : ''}" data-act="forge-tab" data-tab="craft">🔨 Fabricar</button>
        <button class="tab ${view.forgeTab === 'upgrade' ? 'active' : ''}" data-act="forge-tab" data-tab="upgrade">⬆️ Mejorar</button>
        <button class="tab ${view.forgeTab === 'enchant' ? 'active' : ''}" data-act="forge-tab" data-tab="enchant">🪄 Encantar</button>
      </div></div>${body}`;
    if (view.forgeTab !== 'enchant') startForgeScene();
  };

  /* ---------- Yunque: panel del objeto seleccionado ---------- */
  const STAT_MAX = {};
  function statMax(type, key) {
    const k = type + key;
    if (STAT_MAX[k] === undefined) STAT_MAX[k] = Math.max(1, ...Object.keys(ITEMS).filter(id => ITEMS[id].type === type).map(id => Game.itemStats(id, MAX_ITEM_LEVEL)[key] || 0));
    return STAT_MAX[k];
  }
  /** Barra de estadística: valor actual y, si mejora, el tramo que se gana. */
  function statBar(icon, label, cur, nxt, max, fmtV = v => v) {
    // Escala de raíz: los objetos de los primeros mundos también llenan algo de barra
    const pct = v => Math.min(100, Math.sqrt(Math.max(0, v) / max) * 100);
    const a = pct(cur), b = nxt !== undefined ? pct(nxt) : a;
    return `<div class="sbar"><span class="sb-lbl">${icon} ${label}</span><div class="sb-track"><i class="sb-cur" style="width:${a}%"></i>${b > a ? `<i class="sb-gain" style="left:${a}%;width:${b - a}%"></i>` : ''}</div>
      <span class="sb-val">${fmtV(cur)}${nxt !== undefined && nxt !== cur ? ` <em>→ ${fmtV(nxt)}</em>` : ''}</span></div>`;
  }
  function itemBars(id, lvl, nextLvl) {
    const it = ITEMS[id], a = Game.itemStats(id, lvl), b = nextLvl ? Game.itemStats(id, nextLvl) : null;
    if (it.type === 'weapon') return statBar('⚔️', 'Daño', a.dmg, b ? b.dmg : undefined, statMax('weapon', 'dmg'))
      + (a.spd ? statBar('⚡', 'Velocidad', a.spd, undefined, statMax('weapon', 'spd'), v => '+' + v) : '')
      + (a.crit ? statBar('🎯', 'Crítico', a.crit, undefined, statMax('weapon', 'crit'), v => '+' + Math.round(v * 100) + '%') : '');
    return statBar('🛡️', 'Defensa', a.def, b ? b.def : undefined, statMax('armor', 'def')) + statBar('❤️', 'Vida', a.hp, b ? b.hp : undefined, statMax('armor', 'hp'), v => '+' + v);
  }
  /** Ranuras de materiales: icono, lo que tienes y lo que hace falta. */
  function matSlots(cost, coins) {
    let h = '';
    for (const k in cost) {
      const have = Game.matCount(k), ok = have >= cost[k];
      h += `<div class="mslot ${ok ? 'ok' : 'no'}" title="${esc(MATERIALS[k].name)}"><span class="ms-ico">${ico(k)}</span><span class="ms-n">${fmtShort(have)}/${cost[k]}</span></div>`;
    }
    if (coins) h += `<div class="mslot ${S().coins >= coins ? 'ok' : 'no'}" title="Monedas"><span class="ms-ico">💰</span><span class="ms-n">${fmtShort(coins)}</span></div>`;
    return `<div class="mslots">${h}</div>`;
  }
  function forgeStage(mode, sel) {
    const s = S(), hw = Game.highestWorld();
    let d, rar, sub, bars = '', foot = '', lvl = 0, iconId;
    if (mode === 'craft') {
      const rec = RECIPES[sel];
      if (!rec) return '<div class="forge-stage"><p class="hint">No hay recetas.</p></div>';
      d = rec.potion ? POTIONS[rec.potion] : ITEMS[rec.item]; rar = d.rarity; iconId = rec.potion || rec.item;
      const locked = rec.world > hw, owned = rec.item && s.items[rec.item];
      sub = rec.potion ? `Cura ${Math.round(d.heal * 100)}% de la vida · tienes ${s.potions[rec.potion] || 0}` : `${RARITIES[rar].name} · ${d.type === 'weapon' ? 'Arma' : 'Armadura'}`;
      if (!rec.potion) bars = itemBars(rec.item, 1);
      if (locked) foot = `<div class="fs-note">🔒 Se desbloquea en el mundo ${rec.world} (${WORLDS[rec.world - 1].name})</div>`;
      else if (owned) foot = `<div class="fs-note">✅ Ya la tienes · súbele el nivel en «Mejorar»</div><button class="btn btn-forge ghost" data-act="up-open" data-id="${rec.item}">⬆️ Ir a mejorar</button>`;
      else {
        const can = Game.hasCost(rec.cost, rec.coins);
        foot = matSlots(rec.cost, rec.coins) + `<button class="btn btn-forge ${can ? 'glow' : ''}" data-act="craft" data-i="${sel}" ${can ? '' : 'aria-disabled="true"'}>${rec.potion ? '⚗️ PREPARAR' : '🔨 FORJAR'}</button>`;
      }
    } else {
      const id = sel; d = ITEMS[id]; rar = d.rarity; lvl = s.items[id].lvl; iconId = id;
      const eq = s.equip.weapon === id || s.equip.armor === id;
      sub = `${RARITIES[rar].name} · ${d.type === 'weapon' ? 'Arma' : 'Armadura'}${eq ? ' · <b class="eq-tag">Equipado</b>' : ''}`;
      const maxL = Game.itemMaxLevel();
      if (lvl >= maxL) {
        bars = itemBars(id, lvl);
        foot = maxL > MAX_ITEM_LEVEL ? '<div class="fs-note max">✦ ¡Ascensión completa! Nivel 10</div>' : '<div class="fs-note max">⭐ Nivel 5 · <small>Termina todos los mundos del Normal para <b>ascender</b> hasta nivel 10</small></div>';
      }
      else {
        const c = upgradeCost(id), can = Game.hasCost(c.cost, c.coins);
        bars = itemBars(id, lvl, lvl + 1);
        const asc = lvl >= MAX_ITEM_LEVEL;
        foot = (asc ? '<div class="fs-note asc">✦ Ascensión: cada nivel +15% más allá del máximo normal</div>' : '') + matSlots(c.cost, c.coins)
          + `<button class="btn btn-forge ${asc ? 'asc' : ''} ${can ? 'glow' : ''}" data-act="upgrade" data-id="${id}" ${can ? '' : 'aria-disabled="true"'}>${asc ? '✦ ASCENDER' : '⬆️ MEJORAR'} · Nv ${lvl} → ${lvl + 1}</button>`;
      }
    }
    const nStars = mode === 'upgrade' ? Game.itemMaxLevel() : 0;
    const stars = mode === 'upgrade' ? `<div class="fs-stars ${nStars > MAX_ITEM_LEVEL ? 'ten' : ''}" id="fs-stars">${Array.from({ length: nStars }, (_, i) => `<span class="${i < lvl ? 'on' : ''} ${i >= MAX_ITEM_LEVEL ? 'asc' : ''}">${i >= MAX_ITEM_LEVEL ? '✦' : '★'}</span>`).join('')}</div>` : '';
    return `<div class="forge-stage" style="--rc:${rc(rar)}">
      <div class="fs-anvil"><canvas id="forge-cv" aria-hidden="true"></canvas><div class="fs-item" id="fs-item"><span>${ico(iconId)}</span></div>${stars}</div>
      <div class="fs-info">
        <div class="fs-name">${esc(d.name)}</div>
        <div class="fs-rar"><span class="rar-gem">${RARITIES[rar].icon}</span> ${sub}</div>
        <div class="fs-bars">${bars}</div>
        ${foot}
      </div></div>`;
  }

  /** Fragua animada: fuego, brasas, yunque y el martillo que golpea al forjar. */
  let forgeRaf = 0;
  const FORGE = { hits: [], sparks: [], shake: 0 };
  function startForgeScene() {
    cancelAnimationFrame(forgeRaf);
    const cv = $('forge-cv');
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), embers = [];
    const t0 = performance.now();
    let last = t0;
    (function frame(t) {
      if (!document.body.contains(cv)) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const time = (t - t0) / 1000;
      const r = cv.getBoundingClientRect(), W = Math.max(1, r.width), H = Math.max(1, r.height);
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sh = FORGE.shake > 0 ? (FORGE.shake -= dt, (Math.random() - 0.5) * 6 * FORGE.shake / 0.2) : 0;
      c.clearRect(0, 0, W, H);
      c.save(); c.translate(sh, 0);
      // Pared de piedra en penumbra
      const bg = c.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#120c1c'); bg.addColorStop(1, '#2a1410');
      c.fillStyle = bg; c.fillRect(-10, 0, W + 20, H);
      c.strokeStyle = 'rgba(255,255,255,.04)'; c.lineWidth = 1;
      for (let y = 10, row = 0; y < H * 0.7; y += 18, row++) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
        for (let x = (row % 2) * 22; x < W; x += 44) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 18); c.stroke(); }
      }
      // Resplandor del fuego de la fragua
      const flick = 0.85 + Math.sin(time * 9) * 0.08 + Math.sin(time * 23) * 0.05;
      const gl = c.createRadialGradient(W / 2, H * 0.92, 4, W / 2, H * 0.92, Math.max(W, H) * 0.75);
      gl.addColorStop(0, `rgba(251,146,60,${0.55 * flick})`); gl.addColorStop(0.4, `rgba(220,38,38,${0.22 * flick})`); gl.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gl; c.fillRect(-10, 0, W + 20, H);
      // Llamas detrás del yunque
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 11; i++) {
        const x = W * (0.12 + i * 0.076), h = H * (0.2 + 0.12 * Math.sin(time * 7 + i * 1.7) + 0.08 * Math.sin(time * 13 + i));
        const g = c.createLinearGradient(0, H, 0, H - h);
        g.addColorStop(0, 'rgba(253,186,116,.55)'); g.addColorStop(0.5, 'rgba(249,115,22,.35)'); g.addColorStop(1, 'rgba(220,38,38,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(x - 14, H); c.quadraticCurveTo(x - 10, H - h * 0.5, x + Math.sin(time * 5 + i) * 6, H - h); c.quadraticCurveTo(x + 10, H - h * 0.5, x + 14, H); c.fill();
      }
      c.restore();
      // Yunque
      const ax = W / 2, ay = H * 0.8, aw = Math.min(W * 0.62, H * 1.1);
      c.fillStyle = '#0b0a10';
      c.beginPath();
      c.moveTo(ax - aw * 0.5, ay - aw * 0.1);                  // cuerno
      c.quadraticCurveTo(ax - aw * 0.36, ay - aw * 0.02, ax - aw * 0.26, ay);
      c.lineTo(ax - aw * 0.14, ay); c.lineTo(ax - aw * 0.1, ay + aw * 0.12); c.lineTo(ax - aw * 0.26, ay + aw * 0.2);
      c.lineTo(ax + aw * 0.28, ay + aw * 0.2); c.lineTo(ax + aw * 0.14, ay + aw * 0.12); c.lineTo(ax + aw * 0.18, ay);
      c.lineTo(ax + aw * 0.42, ay); c.lineTo(ax + aw * 0.42, ay - aw * 0.12); c.closePath(); c.fill();
      const top = c.createLinearGradient(0, ay - aw * 0.13, 0, ay - aw * 0.08);
      top.addColorStop(0, `rgba(253,186,116,${0.7 * flick})`); top.addColorStop(1, 'rgba(253,186,116,0)');
      c.fillStyle = top; c.fillRect(ax - aw * 0.3, ay - aw * 0.12, aw * 0.72, aw * 0.05);
      c.strokeStyle = 'rgba(253,186,116,.35)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(ax - aw * 0.5, ay - aw * 0.1); c.lineTo(ax + aw * 0.42, ay - aw * 0.12); c.stroke();
      // Martillo: sube y baja en cada golpe
      let hammerA = null;
      for (const h of FORGE.hits) {
        const k = (t - h) / 1000;
        if (k >= 0 && k < 0.34) hammerA = k < 0.22 ? -1.1 + (k / 0.22) * 1.25 : 0.15 - ((k - 0.22) / 0.12) * 0.5;
      }
      if (hammerA !== null) {
        c.save(); c.translate(ax + aw * 0.55, ay - aw * 0.05); c.rotate(-hammerA - 0.15);
        c.fillStyle = '#6b4423'; c.fillRect(-aw * 0.5, -3, aw * 0.5, 6);
        c.fillStyle = '#4b5563'; c.fillRect(-aw * 0.6, -aw * 0.09, aw * 0.14, aw * 0.18);
        c.fillStyle = '#9ca3af'; c.fillRect(-aw * 0.6, -aw * 0.09, aw * 0.14, aw * 0.04);
        c.restore();
      }
      // Brasas que suben
      if (embers.length < 40 && Math.random() < dt * 20) embers.push({ x: W * (0.2 + Math.random() * 0.6), y: H, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 50, life: 1.5 + Math.random(), max: 2.5 });
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        e.x += (e.vx + Math.sin(time * 3 + e.y * 0.05) * 10) * dt; e.y += e.vy * dt; e.life -= dt;
        c.globalAlpha = Math.max(0, e.life / e.max); c.fillStyle = '#fdba74';
        c.beginPath(); c.arc(e.x, e.y, 1.3, 0, Math.PI * 2); c.fill();
      }
      for (let i = embers.length - 1; i >= 0; i--) if (embers[i].life <= 0) embers.splice(i, 1);
      // Chispas de los martillazos
      for (const p of FORGE.sparks) {
        p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        c.globalAlpha = Math.max(0, p.life / 0.6); c.strokeStyle = p.c; c.lineWidth = 2;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); c.stroke();
      }
      FORGE.sparks = FORGE.sparks.filter(p => p.life > 0);
      c.restore();
      c.restore();
      forgeRaf = requestAnimationFrame(frame);
    })(t0);
  }
  /** Tres martillazos con chispas y luego `done()`. */
  function forgeHammer(done) {
    const cv = $('forge-cv'), item = $('fs-item');
    if (!cv) { done(); return; }
    const now = performance.now();
    const r = cv.getBoundingClientRect(), W = r.width, H = r.height;
    FORGE.hits = [now, now + 380, now + 760];
    document.querySelectorAll('.btn-forge').forEach(b => b.disabled = true);
    [0, 380, 760].forEach((dl, n) => setTimeout(() => {
      const k = 220;
      setTimeout(() => {
        Sfx.play(n === 2 ? 'forge' : 'hit'); vibrate(n === 2 ? 50 : 20);
        FORGE.shake = 0.2;
        const cols = ['#fde68a', '#fb923c', '#fff7ed', '#facc15'];
        for (let i = 0; i < (n === 2 ? 36 : 18); i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = 120 + Math.random() * 260;
          FORGE.sparks.push({ x: W / 2 + (Math.random() - 0.5) * 20, y: H * 0.68, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6, c: cols[i % 4] });
        }
        if (item) { item.classList.remove('hit'); void item.offsetWidth; item.classList.add('hit'); }
      }, k);
    }, dl));
    setTimeout(done, 760 + 220 + 380);
  }


  function upgradeCost(id) {
    const it = ITEMS[id], lvl = S().items[id].lvl, ri = RARITY_ORDER.indexOf(it.rarity);
    if (lvl >= MAX_ITEM_LEVEL) {
      // Ascensión (6-10): mucho oro y materiales de alto nivel
      const cost = { fragmento_legendario: 2 * (lvl - 4) };
      if (lvl >= 6) cost.alma_pesadilla = 3 * (lvl - 5);
      if (lvl >= 8) cost.brasa_infernal = 3 * (lvl - 7);
      return { cost, coins: Math.round(itemValue(id) * 6 * Math.pow(lvl - 3, 2)) };
    }
    const qty = Math.round((4 + ri * 2) * lvl);
    return { cost: { [it.upg]: qty }, coins: Math.round(itemValue(id) * 0.6 * lvl) };
  }

  function craft(i) {
    const rec = RECIPES[i];
    if (!rec || rec.world > Game.highestWorld()) return;
    if (rec.item && S().items[rec.item]) return;
    if (!Game.hasCost(rec.cost, rec.coins)) { toast('Te faltan materiales', true); shakeForgeBtn(); return; }
    forgeHammer(() => finishCraft(rec));
  }
  function finishCraft(rec) {
    if (!Game.payCost(rec.cost, rec.coins)) { RENDER.forge(); return; }
    if (rec.potion) {
      S().potions[rec.potion] = (S().potions[rec.potion] || 0) + 1;
      toast(`${POTIONS[rec.potion].icon} ${POTIONS[rec.potion].name} preparada`);
    } else {
      Game.giveItem(rec.item);
      S().stats.crafted++;
      const it = ITEMS[rec.item];
      openModal(`
        <div class="prize-reveal ${RARITY_ORDER.indexOf(it.rarity) >= 3 ? 'epic' : ''}" style="--rc:${rc(it.rarity)}">
          <div class="prize-rarity">🔨 ¡Forjado!</div>
          <div class="prize-icon">${ico(rec.item)}</div>
          <div class="prize-name">${it.name}</div>
          <div class="prize-detail">${RARITIES[it.rarity].icon} ${RARITIES[it.rarity].name}</div>
        </div>
        <div class="modal-actions">
          <button class="btn" data-act="equip" data-id="${rec.item}">Equipar ahora</button>
          <button class="btn ghost" data-act="close">Cerrar</button>
        </div>`, () => RENDER.forge());
    }
    Game.save();
    RENDER.forge(); refreshTop();
  }

  function upgrade(id) {
    const s = S();
    if (!s.items[id] || s.items[id].lvl >= Game.itemMaxLevel()) return;
    const c = upgradeCost(id);
    if (!Game.hasCost(c.cost, c.coins)) { toast('Te faltan materiales o monedas', true); shakeForgeBtn(); return; }
    forgeHammer(() => {
      if (!Game.payCost(c.cost, c.coins)) { RENDER.forge(); return; }
      s.items[id].lvl++;
      Game.save();
      Sfx.play('legendary');
      RENDER.forge(); refreshTop();
      const star = document.querySelectorAll('#fs-stars span')[s.items[id].lvl - 1];
      if (star) star.classList.add('pop');
      const item = $('fs-item'); if (item) item.classList.add('levelup');
      confetti(26, [rc(ITEMS[id].rarity), '#fde68a', '#fff']);
      toast(`⬆️ ${ITEMS[id].name} ahora es nivel ${s.items[id].lvl}`);
    });
  }
  function shakeForgeBtn() {
    const b = document.querySelector('.btn-forge'); if (!b) return;
    b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
    document.querySelectorAll('.mslot.no').forEach(m => { m.classList.remove('nope'); void m.offsetWidth; m.classList.add('nope'); });
  }

  /* ---------- Inventario ---------- */
  RENDER.inv = () => {
    const s = S(), t = view.invTab;
    const tab = (id, label) => `<button class="tab ${t === id ? 'active' : ''}" data-act="inv-tab" data-tab="${id}">${label}</button>`;
    let body = '';
    if (t === 'weapon' || t === 'armor') {
      const ids = Object.keys(s.items).filter(id => ITEMS[id].type === t).sort((a, b) => RARITY_ORDER.indexOf(ITEMS[b].rarity) - RARITY_ORDER.indexOf(ITEMS[a].rarity));
      body = `<div class="cards">${ids.map(id => {
        const it = ITEMS[id], lvl = s.items[id].lvl, st = Game.itemStats(id, lvl);
        const eq = s.equip[t] === id;
        const stats = t === 'weapon'
          ? `<span class="pill">⚔️ ${st.dmg}</span>${st.spd ? `<span class="pill">⚡ +${st.spd}</span>` : ''}${st.crit ? `<span class="pill">🎯 +${Math.round(st.crit * 100)}%</span>` : ''}`
          : `<span class="pill">🛡️ ${st.def}</span><span class="pill">❤️ +${st.hp}</span>`;
        return `<div class="card item-card" style="--rc:${rc(it.rarity)}">
          <div class="item-head"><div class="item-icon">${ico(id)}</div><div><div class="item-name">${it.name}</div><div class="stars">${stars(lvl)}</div><div class="item-meta">${RARITIES[it.rarity].icon} ${RARITIES[it.rarity].name}</div></div></div>
          <div class="stat-line">${stats}</div>
          <button class="btn small ${eq ? 'ghost' : ''}" data-act="equip" data-id="${id}" ${eq ? 'disabled' : ''}>${eq ? '✅ Equipado' : 'Equipar'}</button>
        </div>`;
      }).join('')}</div>`;
    } else if (t === 'mats' || t === 'special') {
      const ids = Object.keys(MATERIALS).filter(id => !!MATERIALS[id].special === (t === 'special') && Game.matCount(id) > 0)
        .sort((a, b) => RARITY_ORDER.indexOf(MATERIALS[a].rarity) - RARITY_ORDER.indexOf(MATERIALS[b].rarity));
      const extra = t === 'special' ? `<div class="mat" style="--rc:var(--gem)"><span class="mi">💎</span><span class="mq">${fmt(s.gems)}</span><span class="mn">Cristales</span></div>` : '';
      body = ids.length || extra
        ? `<div class="mat-grid">${extra}${ids.map(id => `<div class="mat" style="--rc:${rc(MATERIALS[id].rarity)}"><span class="mi">${ico(id)}</span><span class="mq">${fmt(Game.matCount(id))}</span><span class="mn">${MATERIALS[id].name}</span></div>`).join('')}</div>`
        : '<div class="empty">Aún no tienes materiales. ¡Derrota enemigos para conseguirlos!</div>';
      if (t === 'special') body += '<p class="hint" style="margin-top:12px">Los materiales especiales los sueltan los jefes y sirven para forjar equipo poderoso.</p>';
    } else if (t === 'potions') {
      body = `<div class="cards">${Object.keys(POTIONS).map(id => {
        const pd = POTIONS[id];
        return `<div class="card item-card" style="--rc:${rc(pd.rarity)}">
          <div class="item-head"><div class="item-icon">${ico(id)}</div><div><div class="item-name">${pd.name} x${s.potions[id] || 0}</div><div class="item-meta">Cura ${Math.round(pd.heal * 100)}% de tu vida en combate (botón 🧪)</div></div></div>
          <button class="btn small" data-act="buy-potion" data-id="${id}" ${s.coins >= pd.price ? '' : 'disabled'}>Comprar por 💰 ${pd.price}</button>
        </div>`;
      }).join('')}</div>`;
    }
    $('scr-inv').innerHTML = `${head('🎒 Inventario')}
      <div class="tabs">${tab('weapon', '🗡️ Armas')}${tab('armor', '🛡️ Armaduras')}${tab('mats', '🪵 Materiales')}${tab('potions', '🧪 Pociones')}${tab('special', '✨ Especiales')}</div>
      ${body}`;
  };

  function equip(id) {
    const s = S(), it = ITEMS[id];
    if (!it || !s.items[id]) return;
    s.equip[it.type] = id;
    Game.save();
    Sfx.play('click');
    toast(`Equipaste ${it.name}`);
    if ($('modal').hidden === false) closeModal();
    if (RENDER[current]) RENDER[current]();
    refreshTop();
  }

  /* ---------- Personaje ---------- */
  RENDER.char = () => {
    const s = S(), P = Game.stats(), B = BALANCE;
    const w = ITEMS[s.equip.weapon], a = ITEMS[s.equip.armor];
    const row = (ico, lbl, val) => `<div class="stat-row"><span>${ico}</span><span class="lbl">${lbl}</span><b>${val}</b></div>`;
    const skills = SKILL_ORDER.map(id => {
      const sk = SKILLS[id], lvl = s.skills[id] || 0;
      const how = WORLDS.find(wd => wd.bossSkill === id);
      const firstStage = Object.keys(FIRST_CLEAR).find(st => FIRST_CLEAR[st].some(p => p.skill === id));
      const unlockText = firstStage ? `Se desbloquea al completar la etapa ${firstStage}.` : `Se desbloquea al vencer a ${how ? ENEMIES[how.boss].name : 'un jefe'} o en la ruleta.`;
      const dmgAt = l => (sk.mult * (1 + 0.2 * (l - 1))).toFixed(1);
      const cdAt = l => (sk.cd * (1 - 0.05 * (l - 1))).toFixed(1);
      let up = '';
      if (lvl && lvl < MAX_SKILL_LEVEL) {
        const c = SKILL_UPGRADE(lvl), can = s.coins >= c.coins && s.gems >= c.gems;
        up = `<div class="stat-line"><span class="pill up">💥 x${dmgAt(lvl)} → x${dmgAt(lvl + 1)}</span><span class="pill up">⏱️ ${cdAt(lvl)} → ${cdAt(lvl + 1)} s</span></div>
          <div class="stat-line">${costPills({}, c.coins, c.gems)}</div>
          <button class="btn small" data-act="skill-up" data-id="${id}" ${can ? '' : 'disabled'}>⬆️ Mejorar a nivel ${lvl + 1}</button>`;
      } else if (lvl) up = '<div class="item-meta">⭐ Nivel máximo</div>';
      return `<div class="card skill-card ${lvl ? '' : 'locked'}" id="skill-${id}">
        <div class="big">${lvl ? sk.icon : '🔒'}</div>
        <div class="skill-body"><b>${sk.name}</b> ${lvl ? `<span class="stars">${'★'.repeat(lvl)}${'☆'.repeat(MAX_SKILL_LEVEL - lvl)}</span>` : ''}
        <p>${sk.desc}</p>
        <p>${lvl ? `Recarga ${cdAt(lvl)} s · daño x${dmgAt(lvl)}` : unlockText}</p>${up}</div>
      </div>`;
    }).join('');
    $('scr-char').innerHTML = `${head('👤 Personaje')}
      <div class="char-top">
        <canvas id="char-cv" width="300" height="400" aria-label="Tu guerrero"></canvas>
        <div class="stat-rows">
          ${row('🛡️', 'Rango', `<span style="color:${RANKS[Game.rank()].color}">${RANKS[Game.rank()].name}</span>${RANKS[Game.rank() + 1] ? ` <small style="color:var(--muted)">→ ${RANKS[Game.rank() + 1].name} nv ${RANKS[Game.rank() + 1].level}</small>` : ''}`)}
          ${row('⭐', 'Nivel', `${s.level} <small style="color:var(--muted)">(${fmt(s.xp)}/${fmt(xpForLevel(s.level))})</small>`)}
          ${row('❤️', 'Vida', fmt(P.maxHp))}
          ${row('⚔️', 'Daño', fmt(P.dmg))}
          ${row('🛡️', 'Defensa', fmt(P.def))}
          ${row('⚡', 'Velocidad', (P.spd * BALANCE.attackRate).toFixed(2) + ' golpes/s')}
          ${row('🎯', 'Crítico', Math.round(P.crit * 100) + '%')}
          <div class="stat-row power"><span>💥</span><span class="lbl">Poder total</span><b>${fmt(P.power)}</b></div>
        </div>
      </div>
      <h3 class="section-title">Puntos de estadística: ${s.points}</h3>
      <p class="hint">Ganas ${B.pointsPerLevel} puntos cada vez que subes de nivel.</p>
      <div class="alloc">
        <button class="btn ghost" data-act="alloc" data-stat="hp" ${s.points ? '' : 'disabled'}>❤️ +${B.pointHp} Vida<small>asignados: ${s.alloc.hp}</small></button>
        <button class="btn ghost" data-act="alloc" data-stat="dmg" ${s.points ? '' : 'disabled'}>⚔️ +${B.pointDmg} Daño<small>asignados: ${s.alloc.dmg}</small></button>
        <button class="btn ghost" data-act="alloc" data-stat="def" ${s.points ? '' : 'disabled'}>🛡️ +${B.pointDef} Defensa<small>asignados: ${s.alloc.def}</small></button>
        <button class="btn ghost" data-act="alloc" data-stat="spd" ${s.points && P.spd < 2.6 ? '' : 'disabled'}>⚡ +${Math.round(B.pointSpd * 100)}% Velocidad<small>asignados: ${s.alloc.spd}</small></button>
      </div>
      <h3 class="section-title">Equipo</h3>
      <div class="cards">
        <div class="card item-card" style="--rc:${rc(w.rarity)}"><div class="item-head"><div class="item-icon">${ico(s.equip.weapon)}</div><div><div class="item-name">${w.name}</div><div class="stars">${stars(s.items[s.equip.weapon].lvl)}</div></div></div></div>
        <div class="card item-card" style="--rc:${rc(a.rarity)}"><div class="item-head"><div class="item-icon">${ico(s.equip.armor)}</div><div><div class="item-name">${a.name}</div><div class="stars">${stars(s.items[s.equip.armor].lvl)}</div></div></div></div>
      </div>
      <button class="btn ghost wide" style="margin-top:10px" data-act="go" data-to="inv">🎒 Cambiar equipo</button>
      <div class="acc-btns"><button class="btn ghost" data-act="pets-open" data-tab="pets">🐾 Mascotas${s.pets.active ? ` · ${PETS[s.pets.active].icon}` : ''}</button><button class="btn ghost" data-act="pets-open" data-tab="style">🎨 Apariencia</button><button class="btn ghost" data-act="forge-open" data-tab="enchant">🪄 Encantar</button></div>
      <h3 class="section-title">Habilidades</h3>
      <div class="cards">${skills}</div>`;
    animateKnight('char-cv', 'char', 100, 380, 4.4);
  };

  /** Anima al caballero en reposo dentro de un canvas mientras su pantalla esté visible. */
  const knightAnims = {};
  /** Caballero animado en un lienzo. `look()` (opcional) devuelve { aura, trail } para la vista previa de apariencia. */
  function animateKnight(canvasId, screen, x, y, scale, look) {
    cancelAnimationFrame(knightAnims[canvasId]);
    const cv = $(canvasId);
    if (!cv) return;
    const c = cv.getContext('2d'), s = S(), t0 = performance.now();
    const parts = [];
    let last = t0, walk = 0, spawn = 0;
    (function frame(t) {
      if (!document.body.contains(cv) || current !== screen) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const L = look ? look() : null, trail = L && L.trail;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cv.width, cv.height);
      // Con estela, el caballero "camina" en su sitio y las partículas se quedan atrás
      if (trail) {
        walk += dt * 11;
        if ((spawn -= dt) <= 0 && parts.length < 160) { spawn = 0.035; parts.push(Sprites.trailPart(trail, x - 4 * scale, y, 1, scale * 0.8)); }
      } else walk = 0;
      for (const p of parts) { p.vy += p.grav * dt; p.x += (p.vx - 38 * scale) * dt; p.y += p.vy * dt; p.life -= dt; }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      for (const p of parts) Sprites.drawPart(c, p);
      const o = { face: 1, walk, swing: -1, heavy: false, time: (t - t0) / 1000,
        weaponColor: ITEMS[s.equip.weapon].color, armorColor: ITEMS[s.equip.armor].color, flash: false, helmet: s.settings.helmet, rank: Game.rank() };
      if (L) o.aura = L.aura || '';
      Sprites.knight(c, x, y, scale, o);
      knightAnims[canvasId] = requestAnimationFrame(frame);
    })(t0);
  }

  /* ---------- Calendario de 7 días ---------- */
  function loginModal(auto) {
    const st = Game.loginStatus();
    if (auto && !st.claimable) return false;
    const w = Game.highestWorld();
    const cells = LOGIN_REWARDS.map((r, i) => {
      const cls = i < st.day ? 'got' : i === st.day && st.claimable ? 'today' : '';
      return `<div class="cal-day ${cls} ${i === 6 ? 'big' : ''}"><small>Día ${i + 1}</small><span class="cal-ico">${i < st.day ? '✅' : r.icon}</span><span class="cal-lbl">${r.label(w)}</span></div>`;
    }).join('');
    openModal(`
      <h2>📅 Premio diario</h2>
      <p class="sub">${st.claimable ? (st.reset ? 'Faltaste un día y el calendario volvió a empezar. ¡Entra cada día para llegar al cofre épico!' : 'Entra cada día: el día 7 te espera un cofre épico.') : 'Ya reclamaste el premio de hoy. ¡Vuelve mañana!'}</p>
      <div class="calendar">${cells}</div>
      <div class="modal-actions">
        ${st.claimable ? '<button class="btn" data-act="login-claim">🎁 Reclamar día ' + (st.day + 1) + '</button>' : ''}
        <button class="btn ghost" data-act="close">${st.claimable ? 'Más tarde' : 'Cerrar'}</button>
      </div>`);
    return true;
  }

  /* ---------- Logros y ranking ---------- */
  RENDER.trophies = () => {
    const tab = view.trophyTab || 'ach';
    let body = '';
    if (tab === 'ach') {
      body = ACHIEVEMENTS.map(a => {
        const st = Game.achState(a);
        const medals = MEDALS.map((m, i) => `<span class="medal-ico ${i < st.claimed ? 'got' : i < st.reached ? 'ready' : ''}" title="${m.name}">${m.icon}</span>`).join('');
        const pct = Math.min(100, st.value / st.goal * 100);
        return `<div class="card ach ${st.done ? 'done' : ''}">
          <div class="ach-ico">${a.icon}</div>
          <div class="ach-body"><div class="ach-top"><b>${a.name}</b><span class="medals">${medals}</span></div>
            <div class="item-meta">${st.done ? '¡Completado!' : a.text(st.goal)}</div>
            ${st.done ? '' : `<div class="bar small"><i style="width:${pct}%"></i></div><div class="item-meta">${fmt(Math.min(st.value, st.goal))} / ${fmt(st.goal)}</div>`}
          </div>
          ${st.claimable ? `<button class="btn small" data-act="ach-claim" data-id="${a.id}">${MEDALS[st.claimed].icon} +${a.gems[st.claimed]} 💎</button>` : ''}
        </div>`;
      }).join('');
    } else {
      const field = view.rankField || 'power';
      const fields = { power: '💥 Poder', level: '⭐ Nivel', tower: '🏰 Torre', combo: '🔥 Combo' };
      body = `<div class="tabs small">${Object.keys(fields).map(f => `<button class="tab ${f === field ? 'active' : ''}" data-act="rank-field" data-f="${f}">${fields[f]}</button>`).join('')}</div>
        <div id="rank-list" class="rank-list"><p class="hint">Cargando ranking…</p></div>
        <p class="hint">${Game.account.session ? `Apareces como <b>${esc(Game.account.session.name)}</b>. Tu marca se actualiza al guardar.` : Game.online === false ? 'Como invitado puedes ver el ranking, pero solo aparecen los jugadores con cuenta.' : 'Para aparecer en el ranking crea una cuenta con usuario y contraseña (en ⚙️ Ajustes).'}</p>`;
    }
    $('scr-trophies').innerHTML = `${head('🏆 Logros')}
      <div class="tabs">
        <button class="tab ${tab === 'ach' ? 'active' : ''}" data-act="trophy-tab" data-tab="ach">🏅 Logros${Game.achClaimable() ? ` <span class="badge-inline">${Game.achClaimable()}</span>` : ''}</button>
        <button class="tab ${tab === 'rank' ? 'active' : ''}" data-act="trophy-tab" data-tab="rank">🏆 Ranking</button>
      </div>
      <div class="cards ach-list">${body}</div>`;
    if (tab === 'rank') loadRanking(view.rankField || 'power'); else stopRanking();
  };
  let rankUnsub = null, rankReq = 0;
  function stopRanking() { if (rankUnsub) { try { rankUnsub(); } catch (e) {} rankUnsub = null; } }
  async function loadRanking(field) {
    stopRanking();
    const req = ++rankReq;
    await Game.submitScore(true);               // primero sube tu marca actual
    if (req !== rankReq) return;
    const mine = await Game.myScore();
    const unsub = await Game.watchLeaderboard(field, list => {
      if (req !== rankReq || current !== 'trophies') return;
      renderRanking(field, list, mine);
    });
    if (req !== rankReq) { try { unsub(); } catch (e) {} return; }
    rankUnsub = unsub;
  }
  function renderRanking(field, list, mine) {
    const box = $('rank-list');
    if (!box) return;
    if (!list) { box.innerHTML = '<p class="hint">El ranking solo está disponible abriendo el juego desde su enlace de Claude con tu sesión iniciada.</p>'; return; }
    const me = Game.account.session && Game.account.session.id;
    // Tu fila siempre muestra tus datos actuales
    if (me) {
      const cur = Object.assign({ id: me }, mine || {}, { name: S().username, level: S().level, power: Game.stats().power, tower: S().tower.best, combo: S().stats.bestCombo, rank: Game.rank(),
        bosses: Object.values(S().bossKills).reduce((a, b) => a + b, 0), look: Game.lookEntry() });
      list = list.filter(r => r.id !== me).concat([cur]);
    }
    const key = field;
    list.sort((a, b) => (b[key] || 0) - (a[key] || 0));
    if (!list.length) { box.innerHTML = '<p class="hint">Todavía no hay nadie en el ranking. ¡Sé el primero!</p>'; return; }
    const val = r => field === 'power' ? `💥 ${fmt(r.power || 0)}` : field === 'level' ? `⭐ Nv ${r.level || 1}` : field === 'tower' ? `🏰 Piso ${r.tower || 0}` : `🔥 x${r.combo || 0}`;
    view.rankList = list;
    const row = (r, i) => `<div class="rank-row clickable ${r.id === me ? 'me' : ''}" data-act="rank-profile" data-i="${i}">
      <span class="pos">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
      <span class="who"><b>${r.look && r.look.diff ? DIFFICULTIES[r.look.diff].icon + ' ' : ''}${esc(String(r.name || 'Guerrero').slice(0, 16))}${r.id === me ? ' (tú)' : ''}</b><small style="color:${(RANKS[r.rank] || RANKS[0]).color}">${(RANKS[r.rank] || RANKS[0]).name}</small></span>
      <span class="val">${val(r)}</span></div>`;
    const top = list.slice(0, 30), myIdx = list.findIndex(r => r.id === me);
    box.innerHTML = top.map(row).join('') + (myIdx >= 30 ? `<div class="rank-sep">…</div>${row(list[myIdx], myIdx)}` : '')
      + `<p class="hint rank-time">🔄 Se actualiza solo · ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>`;
  }

  /** Perfil básico de otro jugador (lo que publica en la clasificación). */
  function rankProfile(i) {
    const list = view.rankList || [], r = list[+i];
    if (!r) return;
    const R = RANKS[r.rank] || RANKS[0], me = Game.account.session && r.id === Game.account.session.id;
    const L = (typeof r.look === 'string' ? (() => { try { return JSON.parse(r.look); } catch (e) { return null; } })() : r.look) || null;
    const name = esc(String(r.name || 'Guerrero').slice(0, 16));
    const pos = list.slice().sort((a, b) => (b.power || 0) - (a.power || 0)).indexOf(r) + 1;
    const when = r.updated_at ? new Date(r.updated_at) : null;
    const ago = when && !isNaN(when) ? (() => {
      const m = Math.max(0, Math.round((Date.now() - when) / 60000));
      return m < 2 ? 'ahora mismo' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`;
    })() : '';
    const D = L ? DIFFICULTIES[L.diff || 0] : null;
    const prog = D ? `<div class="prof-prog" style="--dc:${D.color}">${D.icon} <b>${D.name}</b> · ${L.done ? '¡Todos los mundos completados!' : `Mundo ${L.world || 1} · ${(WORLDS[(L.world || 1) - 1] || WORLDS[0]).name}`}</div>` : '';
    const pet = L && L.pet && PETS[L.pet], aura = L && L.aura && COSMETICS[L.aura], trail = L && L.trail && COSMETICS[L.trail];
    const tags = L ? [aura ? `<span class="pill">${aura.icon} ${aura.name}</span>` : '', trail ? `<span class="pill">${trail.icon} ${trail.name}</span>` : '',
      pet ? `<span class="pill">${pet.icon} ${pet.name} · Nv ${L.petLvl || 1}</span>` : '',
      L.weapon && ITEMS[L.weapon] ? `<span class="pill">${ico(L.weapon)} ${ITEMS[L.weapon].name}</span>` : ''].join('') : '';
    openModal(`<div class="profile-card">
      <canvas id="prof-cv" width="360" height="300" aria-label="Caballero de ${name}"></canvas>
      <h2 style="margin:4px 0 0">${name}${me ? ' (tú)' : ''}</h2>
      <div style="color:${R.color};font-weight:800">${R.icon || '🛡️'} ${R.name}</div>
      ${prog}
      ${tags ? `<div class="prof-tags">${tags}</div>` : (L ? '' : '<p class="hint" style="margin:4px 0">Este jugador aún no ha actualizado el juego: no se ve su aura ni su mascota.</p>')}
      <div class="profile-stats">
        <div><b>⭐ ${r.level || 1}</b><small>Nivel</small></div>
        <div><b>💥 ${fmt(r.power || 0)}</b><small>Poder${pos ? ` · #${pos}` : ''}</small></div>
        <div><b>🏰 ${r.tower || 0}</b><small>Récord en la Torre</small></div>
        <div><b>🔥 x${r.combo || 0}</b><small>Mejor combo</small></div>
        <div><b>👑 ${r.bosses || 0}</b><small>Jefes vencidos</small></div>
      </div>
      ${ago ? `<p class="hint">Jugó por última vez ${ago}</p>` : ''}
      <div class="modal-actions"><button class="btn ghost" data-act="close">Cerrar</button></div></div>`);
    // Su caballero con su aura, su estela y su mascota
    const cv = $('prof-cv');
    if (!cv) return;
    const c = cv.getContext('2d'), t0 = performance.now(), parts = [];
    const w = L && ITEMS[L.weapon], a = L && ITEMS[L.armor];
    const pe = pet && !pet.custom ? { def: { sprite: { art: pet.art } }, x: 285, y: 280, size: 70, face: -1, walk: 0, flash: 0, windup: 0, windupMax: 1, recover: 0, seed: 1, frozen: 0, state: 'move' } : null;
    if (pe) { const fit = Sprites.artFit(pe.def, 120, 110); if (fit) { pe.size = fit.size; pe.x = 290 + fit.dx; pe.y = 285 - fit.dy; } }
    let last = t0, spawn = 0;
    (function frame(t) {
      if (!document.body.contains(cv)) return;
      const time = (t - t0) / 1000, dt = Math.min(0.05, (t - last) / 1000); last = t;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      if (trail) {
        if ((spawn -= dt) <= 0 && parts.length < 120) { spawn = 0.05; parts.push(Sprites.trailPart(L.trail, 120, 285, 1, 2.6)); }
        for (const p of parts) { p.vy += p.grav * dt; p.x += (p.vx - 90) * dt; p.y += p.vy * dt; p.life -= dt; }
        for (let k = parts.length - 1; k >= 0; k--) if (parts[k].life <= 0) parts.splice(k, 1);
        for (const p of parts) Sprites.drawPart(c, p);
      }
      Sprites.knight(c, 130, 285, 3.4, { face: 1, walk: 0, swing: -1, heavy: false, time, flash: false, aura: aura ? L.aura : '',
        weaponColor: w ? w.color : '#cbd5e1', armorColor: a ? a.color : undefined, helmet: true, rank: r.rank || 0, plain: !me });
      if (pet && pet.custom === 'fenix') Sprites.phoenix(c, 285, 270, 70, time, -1);
      else if (pe) { pe.walk = 0; Sprites.enemy(c, pe, time); }
      requestAnimationFrame(frame);
    })(t0);
  }

  /* ---------- Mercader viajero ---------- */
  function shopIcon(g) {
    if (g.mat) return ico(g.mat);
    if (g.potion) return ico(g.potion);
    return g.tickets ? '🎟️' : g.gems ? '💎' : g.shards ? '🧩' : g.epicChest ? '🎁' : '📦';
  }
  function shopName(def) {
    const g = def.give;
    if (def.name) return def.name;
    if (g.mat) return `${MATERIALS[g.mat].name} x${g.qty}`;
    if (g.potion) return `${POTIONS[g.potion].name} x${g.qty}`;
    if (g.tickets) return `${g.tickets} ticket${g.tickets > 1 ? 's' : ''} de ruleta`;
    if (g.gems) return `${g.gems} diamantes`;
    if (g.shards) return `${g.shards} fragmentos de ticket`;
    return '';
  }
  RENDER.shop = () => {
    const s = S(), sh = Game.shopToday();
    sh.seen = true;
    const mid = new Date(); mid.setHours(24, 0, 0, 0);
    const mins = Math.max(0, Math.round((mid - Date.now()) / 60000));
    const cards = sh.offers.map((of, i) => {
      const def = SHOP_POOL.find(o => o.id === of.id);
      if (!def) return '';
      const rar = def.give.mat ? MATERIALS[def.give.mat].rarity : def.special ? 'legendario' : def.give.gems ? 'mitico' : 'raro';
      const can = of.stock > 0 && s.coins >= of.price;
      return `<div class="shop-card ${of.stock <= 0 ? 'sold' : ''} ${of.deal ? 'deal' : ''} ${def.special ? 'special' : ''}" style="--rc:${rc(rar)}">
        ${of.deal ? '<span class="shop-deal">-30% HOY</span>' : ''}
        <div class="shop-ico">${shopIcon(def.give)}</div>
        <div class="shop-name">${esc(shopName(def))}</div>
        <div class="shop-stock">${of.stock > 0 ? `Quedan ${of.stock}` : 'Agotado'}</div>
        <button class="btn small ${can ? '' : 'ghost'}" data-act="shop-buy" data-i="${i}" ${can ? '' : 'disabled'}>💰 ${fmt(of.price)}</button>
      </div>`;
    }).join('');
    $('scr-shop').innerHTML = `${head('🏪 Mercader viajero')}
      <div class="shop-top">
        <div class="shop-merchant">🧙‍♂️<div class="shop-say">«¡Bienvenido, guerrero! Traigo tesoros de tierras lejanas. Mañana tendré otras cosas…»</div></div>
        <div class="shop-info"><span>💰 Tienes <b>${fmt(s.coins)}</b></span><span>⏳ Nuevas ofertas en ${Math.floor(mins / 60)} h ${mins % 60} min</span>
          <button class="btn small ghost" data-act="shop-refresh" ${s.coins >= Game.shopRefreshCost() ? '' : 'disabled'}>🔄 Renovar ofertas · 💰 ${fmt(Game.shopRefreshCost())}</button></div>
      </div>
      <div class="shop-grid">${cards}</div>
      <p class="hint" style="text-align:center">Al abrir dificultades nuevas el mercader trae materiales de Pesadilla e Infierno, y los precios suben un poco.</p>`;
  };

  /* ---------- Mascotas y apariencia ---------- */
  RENDER.pets = () => {
    const s = S(), tab = view.petTab || 'pets';
    let body;
    if (tab === 'pets') {
      body = PET_ORDER.map(id => {
        const P = PETS[id], o = s.pets.owned[id], active = s.pets.active === id;
        const lvlBar = o ? (o.lvl >= PET_MAX_LEVEL ? '<div class="item-meta">⭐ Nivel máximo</div>' : `<div class="bar small"><i style="width:${Math.min(100, o.xp / petXpFor(o.lvl) * 100)}%"></i></div><div class="item-meta">${o.xp}/${petXpFor(o.lvl)} derrotas para nivel ${o.lvl + 1}</div>`) : '';
        return `<div class="card pet-card ${o ? '' : 'locked'} ${active ? 'active' : ''}">
          <canvas data-pet="${id}" width="120" height="100" ${o ? '' : 'class="dim"'}></canvas>
          <div class="pet-body"><b>${o ? P.icon + ' ' + P.name : '🔒 ' + P.name}</b>${o ? ` <span class="pill">Nv ${o.lvl}</span>` : ''}
            <div class="item-meta">${P.desc}</div>
            ${o ? `<div class="item-meta">⚔️ ${Math.round(P.dmg * petMult(o.lvl) * 100)}% de tu daño · ${P.kind === 'melee' ? 'cuerpo a cuerpo' : 'a distancia'}</div>${lvlBar}
              <button class="btn small ${active ? 'ghost' : ''}" data-act="pet-use" data-id="${id}">${active ? '✅ Te acompaña' : '🐾 Llevar'}</button>`
              : P.wheel ? wheelHow(P.wheel) : `<div class="item-meta">Se consigue al vencer a ${ENEMIES[P.from].name}.</div>`}
          </div></div>`;
      }).join('');
      body = `<p class="hint">Tu mascota te sigue en combate y ataca sola. Gana experiencia con cada enemigo derrotado mientras te acompaña.</p><div class="cards">${body}</div>`;
    } else {
      const cards = COSMETIC_ORDER.map(id => {
        const C = COSMETICS[id], unlocked = Game.cosmeticUnlocked(id), worn = s.cosmetics[C.type] === id;
        let how = '';
        if (!unlocked) {
          if (C.gems) how = `<button class="btn small" data-act="cos-buy" data-id="${id}" ${s.gems >= C.gems ? '' : 'disabled'}>💎 ${C.gems} Comprar</button>`;
          else if (C.wheel) how = wheelHow(C.wheel);
          else { const a = ACHIEVEMENTS.find(x => x.id === C.ach[0]); how = `<div class="item-meta">🔒 Logro «${a.name}» ${MEDALS[C.ach[1]].icon}: ${a.text(a.goals[C.ach[1]])}</div>`; }
        } else how = `<button class="btn small ${worn ? 'ghost' : ''}" data-act="cos-wear" data-id="${id}">${worn ? '✅ Puesto (quitar)' : '✨ Ponerse'}</button>`;
        const viewing = view.previewCos === id;
        return `<div class="card item-card ${unlocked ? '' : 'locked'} ${viewing ? 'previewing' : ''}" style="--rc:${C.color}">
          <div class="item-head"><div class="item-icon">${C.icon}</div><div><div class="item-name">${C.name}</div><div class="item-meta">${C.type === 'aura' ? 'Aura alrededor del caballero' : 'Estela al moverte en combate'}</div></div></div>
          <div class="cos-btns"><button class="btn small ghost" data-act="cos-try" data-id="${id}">${viewing ? '👁️ Viendo' : '👁️ Probar'}</button>${how}</div></div>`;
      }).join('');
      const P = view.previewCos && COSMETICS[view.previewCos];
      const label = P ? `👁️ Probando: <b>${P.icon} ${P.name}</b>${Game.cosmeticUnlocked(view.previewCos) ? '' : ' <span class="pill">🔒 sin comprar</span>'}` : 'Así te ves ahora · toca «👁️ Probar» para verlo antes de comprar';
      body = `<div class="style-preview"><canvas id="style-cv" width="240" height="300" aria-label="Vista previa"></canvas><div class="style-label">${label}</div></div>
        <p class="hint">Solo cambian el aspecto: no dan poder.</p><div class="cards">${cards}</div>`;
    }
    $('scr-pets').innerHTML = `${head('🐾 Compañeros')}
      <div class="tabs">
        <button class="tab ${tab === 'pets' ? 'active' : ''}" data-act="pet-tab" data-tab="pets">🐾 Mascotas</button>
        <button class="tab ${tab === 'style' ? 'active' : ''}" data-act="pet-tab" data-tab="style">🎨 Apariencia</button>
      </div>${body}`;
    drawPets();
    if (tab === 'style') animateKnight('style-cv', 'pets', 120, 285, 3.4, () => {
      const P = view.previewCos && COSMETICS[view.previewCos], w = S().cosmetics;
      return { aura: P && P.type === 'aura' ? view.previewCos : w.aura, trail: P && P.type === 'trail' ? view.previewCos : w.trail };
    });
  };
  function drawPets() {
    // El Fénix se anima (vuela y aletea)
    cancelAnimationFrame(petsRaf);
    const fen = document.querySelector('canvas[data-pet="fenix"]');
    if (fen) {
      const c = fen.getContext('2d'), t0 = performance.now(), dim = fen.classList.contains('dim');
      (function frame(t) {
        if (!document.body.contains(fen)) return;
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, fen.width, fen.height);
        Sprites.phoenix(c, 62, 96, 44, (t - t0) / 1000, -1, dim ? 0.6 : 1);
        petsRaf = requestAnimationFrame(frame);
      })(t0);
    }
    document.querySelectorAll('canvas[data-pet]').forEach(cv => {
      if (cv.dataset.pet === 'fenix') return;
      const P = PETS[cv.dataset.pet], c = cv.getContext('2d');
      const e = { def: { sprite: { art: P.art } }, x: 60, y: 90, size: 60, face: -1, walk: 0, flash: 0, windup: 0, windupMax: 1, recover: 0, seed: 1, frozen: 0, state: 'move' };
      const fit = Sprites.artFit(e.def, 110, 82);
      if (fit) { e.size = fit.size; e.x = 60 + fit.dx; e.y = 92 - fit.dy; }
      c.clearRect(0, 0, cv.width, cv.height);
      Sprites.enemy(c, e, 0.5);
    });
  }

  let petsRaf = 0;
  /** «Solo en la Ruleta X» con botón para ir (o qué hace falta para abrirla). */
  function wheelHow(id) {
    const w = WHEELS[id], open = Game.wheelOpen(id);
    return `<div class="item-meta">${w.icon} Solo en la <b>${w.name}</b>${open ? '' : ` · 🔒 ${wheelLock(w)}`}</div>`
      + (open ? `<button class="btn small ghost" data-act="go-wheel" data-id="${id}">${w.icon} Ir a la ruleta</button>` : '');
  }

  /* ---------- Torre del Caos ---------- */
  RENDER.tower = () => {
    const s = S(), open = s.cleared[TOWER.unlockStage];
    $('scr-tower').innerHTML = `${head('🏰 Torre del Caos')}
      <div class="card tower-card">
        <div class="tower-art">🏰</div>
        <p>Oleadas sin fin que se vuelven cada vez más duras. Cada piso es una oleada; cada ${TOWER.milestone} pisos aparece un jefe, recuperas un 25% de vida y ganas 🎟️ y 💎.</p>
        <div class="info-rows">
          <div class="info-row"><span>Tu récord</span><b>🏆 Piso ${s.tower.best}</b></div>
          <div class="info-row"><span>Intentos</span><b>${s.tower.runs}</b></div>
          <div class="info-row"><span>Botín</span><b>Te quedas con todo lo que recojas</b></div>
        </div>
        ${open ? '<button class="btn btn-play" data-act="tower-go"><span class="play-main">⚔️ SUBIR A LA TORRE</span></button>' : `<p class="hint">🔒 Se desbloquea al vencer al primer jefe (etapa ${TOWER.unlockStage}).</p>`}
      </div>`;
  };
  function onTowerEnd(r) {
    const s = S(), floor = r.tower ? r.tower.floor : 1;
    const mats = {};
    for (const id in r.loot.mats) { const q = r.loot.mats[id]; if (q > 0) { Game.addMat(id, q); mats[id] = q; } }
    const coins = r.loot.coins; s.coins += coins;
    s.tickets += r.loot.tickets; s.gems += r.loot.gems;
    const made = Game.addShards(r.loot.shards);
    const xp = r.loot.xp;
    const record = floor > s.tower.best;
    s.tower.best = Math.max(s.tower.best, floor); s.tower.runs++;
    s.stats.elites += r.elites || 0;
    s.stats.bestCombo = Math.max(s.stats.bestCombo, r.maxCombo || 0);
    const petUp = Game.petGainXp(r.kills || 0);
    const ups = Game.addXp(xp);
    Game.track('kill', r.kills || 0); Game.track('combo', r.maxCombo || 0); Game.track('elite', r.elites || 0); Game.track('coins', coins);
    Game.save(true); Game.cloudWrite();
    if (ups) Sfx.play('levelup');
    openModal(`
      <div class="reward-title ${record ? 'boss' : ''}">${record ? '🏆 ¡Nuevo récord!' : '🏰 Fin de la escalada'}</div>
      <p class="sub">Llegaste al piso <b>${floor}</b> · récord: piso ${s.tower.best}</p>
      ${ups ? `<div class="levelup">⭐ ¡Subiste a nivel ${s.level}!</div>` : ''}
      ${petUp ? `<div class="levelup">🐾 ${PETS[s.pets.active].name} subió a nivel ${petUp}</div>` : ''}
      ${Game.achClaimable() ? '<div class="levelup mission">🏅 ¡Tienes logros por reclamar!</div>' : ''}
      <div class="info-rows">
        <div class="info-row"><span>Experiencia</span><b>⭐ +${fmt(xp)} XP</b></div>
        <div class="info-row"><span>Enemigos</span><b>☠️ ${r.kills}</b></div>
        ${r.maxCombo >= 3 ? `<div class="info-row"><span>Combo máximo</span><b>🔥 x${r.maxCombo}</b></div>` : ''}
      </div>
      <div class="loot-grid">${lootChips(mats, coins, { tickets: r.loot.tickets, gems: r.loot.gems, shards: r.loot.shards })}</div>
      ${made ? `<p class="hint" style="text-align:center">🧩 ¡Fragmentos completaron ${made} 🎟️!</p>` : ''}
      <div class="modal-actions">
        <button class="btn" data-act="tower-go">🔁 Volver a subir</button>
        <button class="btn ghost" data-act="go" data-to="trophies">🏆 Ranking y logros</button>
        <button class="btn ghost" data-act="go" data-to="menu">🏠 Menú</button>
      </div>`);
    if (record) confetti(70);
  }
  function startTower() {
    closeModal();
    show('battle');
    goLandscape();
    Battle.start('tower', onTowerEnd);
    checkOrientation();
  }

  /* ---------- Ajustes ---------- */
  RENDER.settings = () => {
    const s = S();
    $('scr-settings').innerHTML = `${head('⚙️ Ajustes')}
      <div class="card setting"><div><b>🔊 Sonido</b><div class="item-meta">Efectos de sonido del juego</div></div><button class="switch ${s.settings.sound ? 'on' : ''}" data-act="toggle" data-key="sound" aria-label="Sonido"></button></div>
      <div class="card setting"><div><b>🎵 Música</b><div class="item-meta">Música de fondo de cada mundo y de los jefes</div></div><button class="switch ${s.settings.music ? 'on' : ''}" data-act="toggle" data-key="music" aria-label="Música"></button></div>
      <div class="card account">
        ${Game.account.session
          ? `<div class="setting" style="padding:0;margin:0"><div><b>🔐 ${esc(Game.account.session.name)}</b><div class="item-meta">Cuenta con contraseña</div></div><button class="btn small ghost" data-act="acc-logout">🚪 Cerrar sesión</button></div>`
          : `<div class="setting" style="padding:0;margin:0"><div><b>👤 ${s.username ? esc(s.username) : 'Sin cuenta'}</b><div class="item-meta">Jugando sin cuenta</div></div><button class="btn small ghost" data-act="name">✏️ Nombre</button></div>
             ${Game.online === false ? '' : '<div class="acc-btns"><button class="btn small" data-act="acc-create">🆕 Crear cuenta</button><button class="btn small ghost" data-act="acc-login">🔑 Iniciar sesión</button></div>'}`}
        <p class="hint" style="margin:10px 0 8px">${cloudText()}</p>
        <div class="acc-btns"><button class="btn small" data-act="save-now">☁️ Guardar ahora</button><button class="btn small ghost" data-act="save-code">💾 Código de guardado</button></div>
        <div class="gift-row"><input id="gift-code" class="gift-input" placeholder="🎁 Código de regalo" autocomplete="off" autocapitalize="characters" maxlength="24"><button class="btn small" data-act="gift-redeem">Canjear</button></div>
      </div>
      <div class="card setting"><div><b>⛶ Pantalla completa</b><div class="item-meta">${canFullscreen() ? 'Activa o desactiva la pantalla completa' : 'No disponible aquí: abre el archivo descargado en Chrome'}</div></div><button class="btn small ghost" data-act="fullscreen">${isFullscreen() ? 'Salir' : 'Activar'}</button></div>
      <div class="card setting"><div><b>📱 Horizontal y pantalla completa</b><div class="item-meta">Pantalla completa al tocar y pide girar el teléfono al combatir</div></div><button class="switch ${s.settings.landscape ? 'on' : ''}" data-act="toggle" data-key="landscape" aria-label="Combate en horizontal"></button></div>
      <div class="card setting"><div><b>🎨 Gráficos clásicos</b><div class="item-meta">Usa los dibujos sencillos en lugar del arte ilustrado</div></div><button class="switch ${s.settings.classic ? 'on' : ''}" data-act="toggle" data-key="classic" aria-label="Gráficos clásicos"></button></div>
      <div class="card setting"><div><b>⛑️ Casco</b><div class="item-meta">Muestra el yelmo del caballero (gráficos clásicos)</div></div><button class="switch ${s.settings.helmet ? 'on' : ''}" data-act="toggle" data-key="helmet" aria-label="Casco"></button></div>
      <div class="card setting"><div><b>📳 Vibración</b><div class="item-meta">Vibra al recibir daño (si tu teléfono lo permite)</div></div><button class="switch ${s.settings.vibrate ? 'on' : ''}" data-act="toggle" data-key="vibrate" aria-label="Vibración"></button></div>
      <div class="card" style="margin-bottom:10px">
        <b>💾 Guardado</b>
        <p class="hint" style="margin:4px 0 0">Tu progreso se guarda automáticamente en este navegador.</p>
        <div class="stat-line" style="margin-top:8px"><span class="pill">☠️ ${fmt(s.stats.kills)} enemigos</span><span class="pill">🎰 ${fmt(s.stats.spins)} giros</span><span class="pill">🔨 ${fmt(s.stats.crafted)} forjados</span><span class="pill">💀 ${fmt(s.stats.deaths)} derrotas</span></div>
      </div>
      <div class="card">
        <b>🎮 Controles</b>
        <p class="hint" style="margin:4px 0 0">Celular: arrastra el joystick para moverte en cualquier dirección, mantén ⚔️ para atacar, 💨 para rodar (eres invulnerable mientras ruedas), 🔥❄️⚡ habilidades y 🧪 poción. Cada tercer golpe seguido es un golpe fuerte. Derrota enemigos seguidos para subir el combo (x5, x10, x15, x20 y x30 dan premios y más daño). Golpear los proyectiles los devuelve. Sal de las zonas rojas antes de que exploten y rompe cajas y vasijas: esconden oro y corazones.</p>
        <p class="hint" style="margin:6px 0 0">Teclado: WASD o flechas, Espacio/J atacar, Shift/K rodar, 1-2-3 habilidades, Q poción, Esc pausa.</p>
      </div>
      <button class="btn danger wide" style="margin-top:16px" data-act="reset">🗑️ Reiniciar progreso</button>`;
  };

  function askReset() {
    openModal(`
      <h2>⚠️ ¿Reiniciar progreso?</h2>
      <p class="sub">Se borrará todo: nivel, etapas, materiales, equipo y habilidades. No se puede deshacer.</p>
      <div class="modal-actions">
        <button class="btn danger" data-act="reset-confirm">Sí, borrar todo</button>
        <button class="btn ghost" data-act="close">Cancelar</button>
      </div>`);
  }

  /* =================================================================
     ACCIONES (delegación de eventos)
     ================================================================= */
  const ACTIONS = {
    go: d => { closeModal(); show(d.to); },
    play: () => openStage(PG().unlocked),
    diff: d => {
      const id = +d.d;
      if (!Game.setDiff(id)) { toast('🔒 Termina la dificultad anterior para abrirla', true); return; }
      const D = DIFFICULTIES[id];
      document.body.dataset.diff = id;
      toast(`${D.icon} Dificultad: ${D.name}`);
      Sfx.play(id ? 'roar' : 'click');
      RENDER[current] && RENDER[current]();
    },
    stage: d => openStage(+d.stage),
    enter: d => enterStage(+d.stage),
    close: () => closeModal(),
    pause: () => openPause(),
    resume: () => closeModal(),
    abandon: () => { $('modal').hidden = true; modalOnClose = null; Battle.abandon(); },
    chest: (d, el) => openChest(el),
    'wheel-sel': d => { if (!view.spinning) { view.wheel = d.id; RENDER.wheel(); } },
    spin: d => spin(d.mode),
    'forge-tab': d => { view.forgeTab = d.tab; RENDER.forge(); },
    'forge-open': d => { view.forgeTab = d.tab; show('forge'); },
    'enchant-off': () => { if (Game.removeEnchant()) { toast('Encantamiento quitado (puedes volver a ponerlo gratis)'); RENDER.forge(); } },
    enchant: d => {
      if (!Game.enchantWeapon(d.id)) return;
      Sfx.play('forge'); confetti(30, [ENCHANTS[d.id].color, '#fff']);
      toast(`🪄 ${ITEMS[S().equip.weapon].name}: ${ENCHANTS[d.id].name}`);
      RENDER.forge(); refreshTop();
    },
    'trophy-tab': d => { view.trophyTab = d.tab; RENDER.trophies(); },
    'rank-field': d => { view.rankField = d.f; RENDER.trophies(); },
    'ach-claim': d => {
      const r = Game.claimAchievement(d.id);
      if (!r) return;
      Sfx.play('legendary'); confetti(40, [MEDALS[r.medal].color, '#fff']);
      toast(`${MEDALS[r.medal].icon} ¡Medalla de ${MEDALS[r.medal].name.toLowerCase()}! +${r.gems} 💎`);
      RENDER.trophies(); refreshTop();
    },
    'pet-tab': d => { view.petTab = d.tab; view.previewCos = null; RENDER.pets(); },
    'rank-profile': d => rankProfile(d.i),
    'shop-buy': d => {
      const t = Game.shopBuy(+d.i);
      if (!t) { toast('No te alcanza el oro', true); return; }
      Sfx.play('coin'); toast(`🛒 ${t}`); RENDER.shop(); refreshTop();
    },
    'shop-refresh': () => { if (Game.shopRefresh()) { Sfx.play('chest'); RENDER.shop(); refreshTop(); } },
    'gift-redeem': () => {
      const inp = $('gift-code'), r = Game.redeemCode(inp ? inp.value : '');
      if (r.error) { toast(r.error, true); return; }
      toast(r.text); Sfx.play('legendary'); confetti(80, ['#7dd3fc', '#fde047', '#fff']);
      Game.cloudWrite(); refreshTop(); RENDER.settings();
    },
    'go-wheel': d => { view.wheel = d.id; show('wheel'); },
    'cos-try': d => { view.previewCos = view.previewCos === d.id ? null : d.id; RENDER.pets(); const cv = $('style-cv'); if (cv) cv.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
    'pets-open': d => { view.petTab = d.tab; show('pets'); },
    'pet-use': d => { S().pets.active = d.id; Game.save(); toast(`🐾 ${PETS[d.id].name} te acompaña`); RENDER.pets(); },
    'cos-buy': d => { if (Game.buyCosmetic(d.id)) { Sfx.play('chest'); Game.wearCosmetic(d.id); toast(`✨ ${COSMETICS[d.id].name}`); RENDER.pets(); refreshTop(); } },
    'cos-wear': d => { Game.wearCosmetic(d.id); RENDER.pets(); },
    'tower-go': () => startTower(),
    'save-now': async (d, el) => {
      if (el) { el.disabled = true; el.textContent = '⏳ Guardando…'; }
      const ok = await Game.syncNow();
      toast(ok ? '☁️ Progreso guardado en tu cuenta' : (Game.account.session || Game.cloud.ready ? '⚠️ No se pudo guardar ahora; se reintentará solo' : '💾 Guardado en este dispositivo'), !ok && (Game.account.session || Game.cloud.ready));
      if (current === 'settings') RENDER.settings();
    },
    'login-open': () => loginModal(false),
    'login-claim': () => {
      const r = Game.claimLogin();
      if (!r) return;
      closeModal();
      Sfx.play(r.day === 6 ? 'legendary' : 'chest');
      if (r.day === 6) confetti(80);
      toast(`📅 Día ${r.day + 1}: ${r.text}`);
      refreshTop();
      if (RENDER[current]) RENDER[current]();
    },
    craft: d => craft(+d.i),
    upgrade: d => upgrade(d.id),
    'forge-sel': d => { view.forgeSel = +d.i; RENDER.forge(); },
    'up-sel': d => { view.upSel = d.id; RENDER.forge(); },
    'up-open': d => { view.upSel = d.id; view.forgeTab = 'upgrade'; RENDER.forge(); },
    'inv-tab': d => { view.invTab = d.tab; RENDER.inv(); },
    equip: d => equip(d.id),
    'equip-keep': (d, el) => {
      const it = ITEMS[d.id];
      if (!it || !S().items[d.id]) return;
      S().equip[it.type] = d.id; Game.save();
      el.textContent = '✅ Equipado'; el.disabled = true;
      Sfx.play('forge'); toast(`Equipaste ${it.name}`);
    },
    claim: d => claimMission(d.i),
    'portrait-ok': () => { portraitOk = true; checkOrientation(); },
    fullscreen: () => toggleFullscreen(),
    name: () => (Game.account.session ? show('settings') : askAccount()),
    'acc-create': () => accountForm('create'),
    'acc-login': () => accountForm('login'),
    'acc-guest': () => { closeModal(); askUsername(); },
    'guest-skip': () => { S().username = 'Guerrero'; Game.save(true); closeModal(); if (RENDER[current]) RENDER[current](); },
    'acc-logout': () => confirmLogout(),
    'acc-logout-ok': async () => { closeModal(); await Game.logout(); toast('🚪 Sesión cerrada'); refreshTop(); show('menu'); setTimeout(askAccount, 300); },
    'save-code': () => saveCodeModal(),
    'code-copy': () => {
      const box = $('code-box');
      const done = () => toast('📋 Código copiado');
      try { navigator.clipboard.writeText(box.value).then(done, () => { box.select(); toast('Selecciona y copia el código'); }); }
      catch (e) { box.select(); toast('Selecciona y copia el código'); }
    },
    'code-load': () => {
      if (Game.importCode($('code-in').value)) { closeModal(); toast('✅ Partida cargada'); show('menu'); }
      else toast('Ese código no es válido', true);
    },
    'skill-up': d => {
      const s = S(), lvl = s.skills[d.id] || 0;
      if (!lvl || lvl >= MAX_SKILL_LEVEL) return;
      const c = SKILL_UPGRADE(lvl);
      if (!Game.payCost({}, c.coins, c.gems)) { toast('Te faltan monedas o gemas', true); return; }
      s.skills[d.id] = lvl + 1;
      Game.save(); Sfx.play('legendary'); vibrate(50); confetti(30, ['#7dd3fc', '#fde047', '#ffffff']);
      toast(`${SKILLS[d.id].icon} ${SKILLS[d.id].name} sube a nivel ${lvl + 1}`);
      RENDER.char(); refreshTop();
      const card = $('skill-' + d.id); if (card) card.classList.add('forge-flash');
    },
    'buy-potion': d => {
      const pd = POTIONS[d.id];
      if (S().coins < pd.price) return;
      S().coins -= pd.price; S().potions[d.id] = (S().potions[d.id] || 0) + 1;
      Game.save(); Sfx.play('coin'); toast(`${pd.icon} Compraste ${pd.name}`); RENDER.inv(); refreshTop();
    },
    alloc: d => {
      const s = S();
      if (!s.points) return;
      s.points--; s.alloc[d.stat]++;
      Game.save(); Sfx.play('levelup'); RENDER.char(); refreshTop();
    },
    toggle: d => {
      const s = S();
      s.settings[d.key] = !s.settings[d.key];
      if (d.key === 'sound') Sfx.setEnabled(s.settings.sound);
      if (d.key === 'music') Music.setEnabled(s.settings.music);
      Game.save(); RENDER.settings();
      if (d.key === 'sound' && s.settings.sound) Sfx.play('click');
      if (d.key === 'vibrate') vibrate(60);
    },
    reset: () => askReset(),
    'reset-confirm': () => { Game.reset(); Sfx.setEnabled(true); closeModal(); toast('Progreso reiniciado'); show('menu'); },
  };

  function bindEvents() {
    document.addEventListener('click', e => {
      Sfx.unlock();
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const fn = ACTIONS[el.dataset.act];
      if (!fn) return;
      if (!['spin', 'chest', 'craft', 'upgrade', 'alloc'].includes(el.dataset.act)) Sfx.play('click');
      fn(el.dataset, el);
    });
    $('modal').addEventListener('click', e => {
      // Tocar fuera de la ventana la cierra (salvo resultados de combate y ruleta)
      if (e.target === $('modal') && $('modal-card').querySelector('[data-act="close"], [data-act="resume"]') && !view.spinning) closeModal();
    });

    // Controles táctiles de combate (mantener pulsado)
    document.querySelectorAll('[data-hold]').forEach(btn => {
      const key = btn.dataset.hold;
      const on = e => { e.preventDefault(); Sfx.unlock(); Battle.setInput(key, true); btn.classList.add('pressed'); try { btn.setPointerCapture(e.pointerId); } catch (err) {} };
      const off = () => { Battle.setInput(key, false); btn.classList.remove('pressed'); };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('lostpointercapture', off);
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });
    document.querySelectorAll('[data-skill]').forEach(btn => {
      btn.addEventListener('pointerdown', e => { e.preventDefault(); Sfx.unlock(); Battle.castSkill(btn.dataset.skill); });
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });
    $('b-potion').addEventListener('pointerdown', e => { e.preventDefault(); Battle.usePotion(); });
    $('b-dodge').addEventListener('pointerdown', e => { e.preventDefault(); Battle.dodge(); });
    $('b-ult').addEventListener('pointerdown', e => { e.preventDefault(); Sfx.unlock(); Battle.ultimate(); });
    $('scr-battle').addEventListener('touchmove', e => e.preventDefault(), { passive: false });

    // Joystick virtual: aparece donde tocas dentro de la zona izquierda
    const zone = $('stick-zone'), base = $('stick-base'), knob = $('stick-knob');
    let stickId = null, cx = 0, cy = 0;
    const resetStick = () => {
      stickId = null;
      zone.classList.remove('active');
      base.style.left = '50%'; base.style.top = '50%';
      knob.style.transform = 'translate(-50%, -50%)';
      Battle.setStick(0, 0, false);
    };
    const moveStick = e => {
      const R = base.offsetWidth * 0.4;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      Battle.setStick(dx / R, dy / R, true);
    };
    zone.addEventListener('pointerdown', e => {
      e.preventDefault(); Sfx.unlock();
      if (stickId !== null) return;
      stickId = e.pointerId;
      try { zone.setPointerCapture(e.pointerId); } catch (err) {}
      const r = zone.getBoundingClientRect(), half = base.offsetWidth / 2;
      cx = Math.max(r.left + half, Math.min(r.right - half, e.clientX));
      cy = Math.max(r.top + half, Math.min(r.bottom - half, e.clientY));
      base.style.left = (cx - r.left) + 'px'; base.style.top = (cy - r.top) + 'px';
      zone.classList.add('active');
      moveStick(e);
    });
    zone.addEventListener('pointermove', e => { if (e.pointerId === stickId) moveStick(e); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, e => { if (e.pointerId === stickId) resetStick(); });

    // Teclado (computadora)
    const KEYS = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
                   ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ' ': 'attack', j: 'attack', J: 'attack' };
    window.addEventListener('keydown', e => {
      if (current !== 'battle' || !$('modal').hidden) return;
      if (KEYS[e.key]) { e.preventDefault(); Battle.setInput(KEYS[e.key], true); }
      else if (e.key === 'Shift' || e.key === 'k' || e.key === 'K') Battle.dodge();
      else if (e.key === 'u' || e.key === 'U' || e.key === 'q' || e.key === 'Q') Battle.ultimate();
      else if (e.key === '1') Battle.castSkill('fuego');
      else if (e.key === '2') Battle.castSkill('hielo');
      else if (e.key === '3') Battle.castSkill('rayo');
      else if (e.key === 'q' || e.key === 'Q') Battle.usePotion();
      else if (e.key === 'Escape' || e.key === 'p') openPause();
    });
    window.addEventListener('keyup', e => { if (KEYS[e.key]) Battle.setInput(KEYS[e.key], false); });
    window.addEventListener('blur', () => { ['left', 'right', 'up', 'down', 'attack'].forEach(k => Battle.setInput(k, false)); resetStick(); });
    // Pantalla completa automática al primer toque (si el navegador lo permite)
    document.addEventListener('pointerdown', function first() {
      document.removeEventListener('pointerdown', first, true);
      Music.unlock();
      if (S().settings.landscape && canFullscreen() && matchMedia('(pointer: coarse)').matches) goLandscape();
    }, true);
    window.addEventListener('resize', checkOrientation);
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', checkOrientation);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && current === 'battle' && Battle.active && !Battle.paused && $('modal').hidden) openPause();
    });
  }

  return { title, EMBLEM, blessingPick, show, toast, vibrate, refreshTop, bindEvents, askUsername, askAccount, onCloud, loginModal, redrawArt: drawFoes, get current() { return current; } };
})();
