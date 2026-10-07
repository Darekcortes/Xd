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
  const stars = lvl => '★'.repeat(lvl) + '☆'.repeat(MAX_ITEM_LEVEL - lvl);

  /* ---------- Navegación ---------- */
  function show(id) {
    if (current === 'battle' && id !== 'battle') { Battle.stop(); $('rotate-hint').hidden = true; pausedByHint = false; }
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
  const costPills = (cost, coins, gems) => {
    let h = '';
    for (const k in cost) {
      const have = Game.matCount(k), ok = have >= cost[k];
      h += `<span class="pill ${ok ? 'ok' : 'no'}">${MATERIALS[k].icon} ${fmt(have)}/${cost[k]}</span>`;
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
    const s = S(), stage = s.unlocked, info = stageInfo(stage), P = Game.stats(), w = info.world;
    const allDone = s.cleared[MAX_STAGE];
    const wheelReady = Object.values(WHEELS).some(wh => wh.world <= Game.highestWorld() && (Game.hasCost(wh.cost) || s.gems >= wh.gemCost));
    const craftReady = RECIPES.some(r => r.item && !s.items[r.item] && r.world <= Game.highestWorld() && Game.hasCost(r.cost, r.coins));
    const daily = Game.ensureDaily();
    const claimable = daily.missions.filter(m => m.progress >= m.goal && !m.claimed).length + (allMissionsClaimable(daily) ? 1 : 0);
    const first = (w.id - 1) * STAGES_PER_WORLD + 1;
    let pips = '';
    for (let st = first; st < first + STAGES_PER_WORLD; st++) {
      const cls = s.cleared[st] ? 'done' : st === stage ? 'current' : 'locked';
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
            <button class="icon-btn" data-act="go" data-to="missions" aria-label="Misiones diarias">📜${claimable ? `<span class="badge">${claimable}</span>` : ''}</button>
            <button class="icon-btn" data-act="go" data-to="settings" aria-label="Ajustes">⚙️</button>
          </div>
        </div>
        <div class="logo" aria-label="Reinos del Caos">
          <span class="logo-a">Reinos</span><span class="logo-b">del</span><span class="logo-c">Caos</span>
        </div>
        <div class="menu-space"></div>
        <div class="goals">${nextGoals().map(g => `<button class="goal ${g.ready ? 'ready' : ''}" data-act="go" data-to="${g.to}">${g.text}</button>`).join('')}</div>
        <div class="world-strip">
          <div class="world-name">${w.icon} Mundo ${w.id} · ${w.name}${s.streak ? ` <span class="streak-chip">🔥 x${s.streak}</span>` : ''}</div>
          <div class="pips">${pips}</div>
        </div>
        <button class="btn btn-play" data-act="play">
          <span class="play-main">⚔️ JUGAR</span>
          <small>${allDone ? 'Reinos conquistados · repetir etapa ' + stage : `Etapa ${stage} · ${esc(info.name)}${info.boss ? ' · ¡JEFE!' : ''}`}</small>
        </button>
        <nav class="dock">
          ${dock('wheel', '🎰', 'Ruleta', s.tickets ? s.tickets : wheelReady ? '!' : '')}
          ${dock('forge', '🔨', 'Forja', craftReady ? '!' : '')}
          ${dock('inv', '🎒', 'Mochila')}
          ${dock('map', '🗺️', 'Mapa')}
          ${dock('char', '👤', 'Héroe', s.points || '')}
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
      }
      c.globalAlpha = 1;
      menuRaf = requestAnimationFrame(frame);
    })(t0);
  }

  /* ---------- Cuenta: nombre de usuario y guardado ---------- */
  function cloudIcon() {
    const st = Game.cloud.status;
    return st === 'cloud' ? '<span class="cloud-ico" title="Guardado en tu cuenta">☁️</span>' : st === 'connecting' ? '<span class="cloud-ico" title="Conectando con tu cuenta">⏳</span>' : '';
  }
  function cloudText() {
    const c = Game.cloud;
    if (c.status === 'cloud') return `☁️ Tu progreso se guarda en tu cuenta de Claude${c.lastSync ? ` · último guardado ${new Date(c.lastSync).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : ''}. Si cambias de teléfono o borras el navegador, lo recuperas al abrir el juego aquí con tu cuenta.`;
    if (c.status === 'connecting') return '⏳ Conectando con tu cuenta…';
    if (c.status === 'denied') return '📱 Tu cuenta no tiene permiso para guardar en este juego (pide acceso de Colaborador al dueño). Se guarda en este dispositivo; usa el código de guardado para no perderlo.';
    if (c.status === 'error') return '⚠️ No se pudo guardar en la cuenta ahora mismo; se reintentará. Mientras tanto está guardado en este dispositivo.';
    return '📱 Se guarda solo en este dispositivo. Para guardarlo en tu cuenta, abre el juego en Claude con tu sesión iniciada, o usa el código de guardado.';
  }
  const NAME_RE = /^[\p{L}\p{N}_ .-]{3,16}$/u;
  function askUsername(force) {
    const s = S();
    if (s.username && !force) return;
    openModal(`
      <h2>${s.username ? '✏️ Cambiar nombre' : '⚔️ ¿Cómo te llamas, guerrero?'}</h2>
      <p class="sub">Tu nombre aparece en el menú y se guarda con tu progreso${Game.cloud.status === 'cloud' ? ' en tu cuenta' : ''}.</p>
      <form id="name-form" class="name-form">
        <input id="name-input" maxlength="16" autocomplete="nickname" placeholder="Tu nombre (3-16 letras)" value="${esc(s.username || '')}">
        <div class="hint" id="name-err"></div>
        <div class="modal-actions">
          <button class="btn" type="submit">✅ Guardar nombre</button>
          ${s.username ? '<button class="btn ghost" type="button" data-act="close">Cancelar</button>' : ''}
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
  /** Se llama cuando cambia el estado de la cuenta (o llega una partida guardada en ella). */
  function onCloud(loaded) {
    if (loaded) toast('☁️ Progreso recuperado de tu cuenta');
    if (current !== 'battle' && $('modal').hidden && RENDER[current]) RENDER[current]();
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
      else if (best.missMat) out.push({ text: `🔨 Faltan ${best.r.cost[best.missMat] - Game.matCount(best.missMat)} ${MATERIALS[best.missMat].icon}`, to: 'forge' });
    }
    const pct = Math.floor(s.xp / xpForLevel(s.level) * 100);
    out.push({ text: `⭐ Nivel ${s.level + 1}: ${pct}%`, to: 'char' });
    const idx = stageIndexInWorld(s.unlocked);
    const toBoss = STAGES_PER_WORLD - 1 - idx;
    if (!s.cleared[MAX_STAGE]) out.push({ text: toBoss ? `👹 Jefe en ${toBoss}` : '👹 ¡Jefe!', to: 'map' });
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
    const s = S();
    let html = head('🗺️ Mapa');
    for (const w of WORLDS) {
      const first = (w.id - 1) * STAGES_PER_WORLD + 1, last = first + STAGES_PER_WORLD - 1;
      const locked = first > s.unlocked;
      const done = Array.from({ length: STAGES_PER_WORLD }, (_, i) => s.cleared[first + i]).filter(Boolean).length;
      let route = w.id === 1 ? '<span class="start" aria-hidden="true">🏁</span><span class="arrow">→</span>' : '';
      for (let st = first; st <= last; st++) {
        const boss = isBossStage(st);
        const cls = s.cleared[st] ? 'done' : st === s.unlocked ? 'current' : st > s.unlocked ? 'locked' : '';
        const label = boss ? '👹' : st > s.unlocked ? '🔒' : st;
        route += `<button class="node ${cls} ${boss ? 'boss' : ''}" data-act="stage" data-stage="${st}" aria-label="Etapa ${st}${boss ? ' (jefe)' : ''}">${label}</button>`;
        if (st < last) route += '<span class="arrow">→</span>';
      }
      html += `
        <div class="world ${locked ? 'locked' : ''}" style="--wbg:${worldBg(w)}">
          <div class="world-head"><span class="wico">${w.icon}</span>
            <div><h3>Mundo ${w.id} — ${w.name}</h3><small>Etapas ${first}-${last} · ${done}/${STAGES_PER_WORLD} completadas · Jefe: ${ENEMIES[w.boss].name}</small></div>
          </div>
          <div class="route">${route}</div>
        </div>`;
    }
    html += `<div class="soon">🚧 Nuevos reinos llegarán pronto…<br><small>Más allá del Trono del Caos aguardan tierras inexploradas.</small></div>`;
    $('scr-map').innerHTML = html;
    const cur = $('scr-map').querySelector('.node.current');
    if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
  };

  function openStage(stage) {
    const s = S();
    if (stage > s.unlocked) { toast(`🔒 Completa la etapa ${stage - 1} para desbloquearla`, true); return; }
    const info = stageInfo(stage), P = Game.stats();
    const powerOk = P.power >= info.power * 0.85;
    const foes = (info.boss ? [info.world.boss] : []).concat(info.world.enemies);
    const drops = Object.keys(info.world.drops).map(id => `<span title="${MATERIALS[id].name}">${MATERIALS[id].icon}</span>`).join('');
    openModal(`
      <h2>${info.boss ? '👹 ' : ''}Etapa ${stage}</h2>
      <p class="sub">${esc(info.name)} · ${info.world.icon} ${info.world.name}</p>
      <div class="info-rows">
        <div class="foe-row">${foes.map(id => `<figure class="foe ${ENEMIES[id].boss ? 'boss' : ''}"><canvas data-foe="${id}" width="160" height="150"></canvas><figcaption>${ENEMIES[id].name}</figcaption></figure>`).join('')}</div>
        ${info.boss ? `<div class="info-row"><span>Jefe</span><b style="color:#fca5a5">👹 ${ENEMIES[info.world.boss].name}</b></div>` : `<div class="info-row"><span>Enemigos</span><b>${info.enemyCount} en oleadas</b></div>`}
        <div class="info-row"><span>Poder recomendado</span><b style="color:${powerOk ? '#86efac' : '#fca5a5'}">💥 ${fmt(info.power)}</b></div>
        <div class="info-row"><span>Tu poder</span><b>💥 ${fmt(P.power)}</b></div>
        <div class="info-row"><span>Materiales</span><span class="icons">${drops}${info.boss ? MATERIALS[info.world.bossDrop].icon : ''}</span></div>
        <div class="info-row"><span>Completada</span><b>${s.cleared[stage] ? `✅ ${s.cleared[stage]} ${s.cleared[stage] === 1 ? 'vez' : 'veces'}` : `No · primera vez: +${info.boss ? 5 : 1} 💎`}</b></div>
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
      first = Game.completeStage(r.stage);
      gems = first ? (r.boss ? 5 : 1) : (r.boss ? 2 : 0);
      s.gems += gems;
      extra.shards += 1;
      made += Game.addShards(1);
      if (first) {
        // Objetos y habilidades nuevos ya se muestran en su propia tarjeta
        for (const p of (FIRST_CLEAR[r.stage] || [])) { const t = Game.grant(p); if (!p.item && !p.skill) gifts.push({ icon: '🎁', text: t }); }
      }
      if (r.boss) {
        const w = worldOfStage(r.stage);
        const firstBoss = !s.bossKills[w.boss];
        s.bossKills[w.boss] = (s.bossKills[w.boss] || 0) + 1;
        gifts.push({ icon: '🎟️', text: Game.grant({ tickets: 1 }) + ' (jefe)' });
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
    const ups = Game.addXp(xp);
    const rankNow = Game.rank(), rankUp = rankNow > s.rank ? rankNow : null;
    s.rank = Math.max(s.rank, rankNow);
    const newSkills = SKILL_ORDER.filter(id => !skillsBefore[id] && s.skills[id]);
    const newItems = Object.keys(s.items).filter(id => !itemsBefore.has(id));
    Game.save();
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
      h += `<span class="loot" style="--rc:${rc(MATERIALS[id].rarity)};animation-delay:${i * 0.05}s" title="${MATERIALS[id].name}">${MATERIALS[id].icon} ${mats[id]}</span>`;
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
      <div class="u-icon">${it.icon}</div>
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
    const special = r.victory && r.specialDrop ? `<div class="levelup">✨ Material especial: ${MATERIALS[r.specialDrop].icon} ${MATERIALS[r.specialDrop].name}</div>` : '';
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
    const missionsDone = o.done.length ? `<div class="levelup mission">📜 Misión completada: ${o.done.map(m => esc(Game.missionText(m))).join(' · ')} — reclámala en Misiones</div>` : '';
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
        ${r.victory && next <= MAX_STAGE && next <= s.unlocked ? `<button class="btn" data-act="enter" data-stage="${next}">▶ Etapa ${next}${isBossStage(next) ? ' · ¡JEFE!' : ''}</button>` : ''}
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
  const unlockedWheels = () => Object.keys(WHEELS).filter(id => WHEELS[id].world <= Game.highestWorld());

  RENDER.wheel = () => {
    const ids = unlockedWheels();
    if (!view.wheel || !ids.includes(view.wheel)) view.wheel = ids[ids.length - 1];
    const w = WHEELS[view.wheel];
    const tabs = Object.keys(WHEELS).map(id => {
      const ok = ids.includes(id), W_ = WHEELS[id];
      return `<button class="tab ${id === view.wheel ? 'active' : ''}" data-act="wheel-sel" data-id="${id}" ${ok ? '' : 'disabled'} title="${ok ? W_.name : 'Se desbloquea en el mundo ' + W_.world}">${ok ? W_.icon : '🔒'} ${W_.name.replace('Ruleta ', '')}</button>`;
    }).join('');
    const odds = RARITY_ORDER.map(r => {
      const prizes = w.prizes.filter(p => p.r === r).map(p => Game.prizeLabel(p).full).join(', ');
      return `<div class="odd-row" style="--rc:${rc(r)}"><b>${RARITIES[r].icon} ${RARITIES[r].name}</b><span class="prz">${esc(prizes)}</span><span class="pct">${w.odds[r]}%</span></div>`;
    }).join('');
    $('scr-wheel').innerHTML = `
      ${head('🎰 Ruleta')}
      <div class="tabs">${tabs}</div>
      <div class="wheel-area">
        <h3 style="color:var(--gold)">${w.icon} ${w.name}</h3>
        <div class="wheel-box" style="--wglow:${w.rim}88">
          <div class="wheel-glow"></div>
          <div class="wheel-pointer"></div>
          <canvas id="wheel-cv" width="640" height="640"></canvas>
          <div class="wheel-hub">${w.icon}</div>
        </div>
        <div class="ticket-box">
          <div><b>🎟️ ${S().tickets}</b> tickets · 🧩 ${S().ticketShards}/${TICKET_SHARDS}</div>
          <div class="bar thin"><i style="width:${S().ticketShards / TICKET_SHARDS * 100}%"></i></div>
        </div>
        <button class="btn wide ${S().tickets ? 'glow' : ''}" data-act="spin" data-mode="ticket" ${S().tickets ? '' : 'disabled'}>🎟️ Girar con 1 ticket</button>
        <div class="cost-row">${costPills(w.cost)}</div>
        <div class="spin-row">
          <button class="btn ghost" data-act="spin" data-mode="mats" ${Game.hasCost(w.cost) ? '' : 'disabled'}>🎰 Girar con materiales</button>
          <button class="btn ghost" data-act="spin" data-mode="gems" ${S().gems >= w.gemCost ? '' : 'disabled'}>Girar con 💎 ${w.gemCost}</button>
        </div>
        <p class="hint" style="text-align:center;margin:0">Consigue 🎟️ completando etapas (cada ${TICKET_SHARDS} 🧩 = 1 🎟️), venciendo jefes y élites, con combos, rachas y misiones. Si sale un objeto que ya tienes, sube un nivel.</p>
        <div class="odds">${odds}</div>
      </div>`;
    drawWheel(w);
    $('wheel-cv').style.transform = `rotate(${view.wheelRot}deg)`;
  };

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
      c.save(); c.translate(R * 0.6, 0); c.rotate(Math.PI / 2); c.fillText(lab.icon, 0, 0); c.restore();
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
    else paid = mode === 'gems' ? Game.payCost({}, 0, w.gemCost) : Game.payCost(w.cost);
    if (!paid) { toast('No tienes suficientes recursos para girar', true); return; }
    view.spinning = true;
    S().stats.spins++;
    refreshTop();
    document.querySelectorAll('[data-act="spin"], [data-act="wheel-sel"], #scr-wheel .back').forEach(b => { b.disabled = true; });
    // Elige rareza según probabilidades y luego un premio de esa rareza
    const rar = weightedPick(w.odds);
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
    const shout = ['Común', 'Poco común', '¡Raro!', '¡ÉPICO!', '🎉 ¡LEGENDARIO!', '🔥 ¡¡MÍTICO!!'][ri];
    let name = lab.full;
    if (p.item) name = `${ITEMS[p.item].icon} ${ITEMS[p.item].name}`;
    openModal(`
      <div class="prize-reveal ${ri >= 4 ? 'legend' : ri >= 3 ? 'epic' : ''}" style="--rc:${r.color}">
        <div class="prize-rarity">${shout}</div>
        <div class="prize-icon">${lab.icon}</div>
        <div class="prize-name">${esc(name)}</div>
        <div class="prize-detail">${esc(text)}</div>
      </div>
      <div class="modal-actions">
        <button class="btn" data-act="close">¡Genial!</button>
      </div>`, () => RENDER.wheel());
    if (ri >= 4) { Sfx.play('legendary'); confetti(110, [r.color, '#fde047', '#ffffff']); vibrate(120); }
    else if (ri >= 3) { Sfx.play('legendary'); confetti(50, [r.color, '#ffffff']); }
    else Sfx.play('chest');
    refreshTop();
  }

  /* ---------- Forja ---------- */
  RENDER.forge = () => {
    const s = S(), hw = Game.highestWorld();
    let body = '';
    if (view.forgeTab === 'craft') {
      const cards = RECIPES.map((rec, i) => {
        const locked = rec.world > hw;
        if (rec.potion) {
          const pd = POTIONS[rec.potion];
          return `<div class="card item-card" style="--rc:${rc(pd.rarity)}">
            <div class="item-head"><div class="item-icon">${pd.icon}</div><div><div class="item-name">${pd.name}</div><div class="item-meta">Cura ${Math.round(pd.heal * 100)}% de la vida · tienes ${s.potions[rec.potion] || 0}</div></div></div>
            ${locked ? `<div class="item-meta">🔒 Se desbloquea en el mundo ${rec.world}</div>` : `<div class="stat-line">${costPills(rec.cost, rec.coins)}</div>
            <button class="btn small" data-act="craft" data-i="${i}" ${Game.hasCost(rec.cost, rec.coins) ? '' : 'disabled'}>⚗️ Preparar</button>`}
          </div>`;
        }
        const it = ITEMS[rec.item], owned = !!s.items[rec.item];
        const st = Game.itemStats(rec.item, 1);
        const statTxt = it.type === 'weapon'
          ? `<span class="pill">⚔️ ${st.dmg}</span>${st.spd ? `<span class="pill">⚡ +${st.spd}</span>` : ''}${st.crit ? `<span class="pill">🎯 +${Math.round(st.crit * 100)}%</span>` : ''}`
          : `<span class="pill">🛡️ ${st.def}</span><span class="pill">❤️ +${st.hp}</span>`;
        return `<div class="card item-card" style="--rc:${rc(it.rarity)}" id="recipe-${i}">
          <div class="item-head"><div class="item-icon">${locked ? '🔒' : it.icon}</div>
            <div><div class="item-name">${it.name}</div><div class="item-meta">${RARITIES[it.rarity].icon} ${RARITIES[it.rarity].name} · ${it.type === 'weapon' ? 'Arma' : 'Armadura'}</div></div></div>
          <div class="stat-line">${statTxt}</div>
          ${locked ? `<div class="item-meta">🔒 Se desbloquea en el mundo ${rec.world} (${WORLDS[rec.world - 1].name})</div>`
            : owned ? `<div class="item-meta">✅ Ya la tienes · mejórala en la pestaña «Mejorar»</div>`
            : `<div class="stat-line">${costPills(rec.cost, rec.coins)}</div>
               <button class="btn small" data-act="craft" data-i="${i}" ${Game.hasCost(rec.cost, rec.coins) ? '' : 'disabled'}>🔨 Fabricar</button>`}
        </div>`;
      }).join('');
      body = `<p class="hint">Fabrica armas y armaduras con los materiales que sueltan los enemigos.</p><div class="cards">${cards}</div>`;
    } else {
      const ids = Object.keys(s.items).sort((a, b) => (ITEMS[a].type > ITEMS[b].type ? -1 : ITEMS[a].type < ITEMS[b].type ? 1 : 0) || RARITY_ORDER.indexOf(ITEMS[b].rarity) - RARITY_ORDER.indexOf(ITEMS[a].rarity));
      const cards = ids.map(id => {
        const it = ITEMS[id], lvl = s.items[id].lvl, cur = Game.itemStats(id, lvl);
        const equipped = s.equip.weapon === id || s.equip.armor === id;
        let action;
        if (lvl >= MAX_ITEM_LEVEL) action = '<div class="item-meta">⭐ Nivel máximo</div>';
        else {
          const nxt = Game.itemStats(id, lvl + 1), c = upgradeCost(id);
          const diff = it.type === 'weapon' ? `<span class="pill up">⚔️ ${cur.dmg} → ${nxt.dmg}</span>` : `<span class="pill up">🛡️ ${cur.def} → ${nxt.def}</span><span class="pill up">❤️ ${cur.hp} → ${nxt.hp}</span>`;
          action = `<div class="stat-line">${diff}</div><div class="stat-line">${costPills(c.cost, c.coins)}</div>
            <button class="btn small" data-act="upgrade" data-id="${id}" ${Game.hasCost(c.cost, c.coins) ? '' : 'disabled'}>⬆️ Mejorar a nivel ${lvl + 1}</button>`;
        }
        return `<div class="card item-card" style="--rc:${rc(it.rarity)}" id="up-${id}">
          <div class="item-head"><div class="item-icon">${it.icon}</div>
            <div><div class="item-name">${it.name}${equipped ? ' <small style="color:var(--heal)">(equipado)</small>' : ''}</div><div class="stars">${stars(lvl)}</div></div></div>
          ${action}
        </div>`;
      }).join('');
      body = `<p class="hint">Cada nivel aumenta un ${Math.round(ITEM_LEVEL_BONUS * 100)}% las estadísticas del objeto (máximo nivel ${MAX_ITEM_LEVEL}).</p><div class="cards">${cards}</div>`;
    }
    $('scr-forge').innerHTML = `${head('🔨 Forja')}
      <div class="tabs">
        <button class="tab ${view.forgeTab === 'craft' ? 'active' : ''}" data-act="forge-tab" data-tab="craft">🔨 Fabricar</button>
        <button class="tab ${view.forgeTab === 'upgrade' ? 'active' : ''}" data-act="forge-tab" data-tab="upgrade">⬆️ Mejorar</button>
      </div>${body}`;
  };

  function upgradeCost(id) {
    const it = ITEMS[id], lvl = S().items[id].lvl, ri = RARITY_ORDER.indexOf(it.rarity);
    const qty = Math.round((4 + ri * 2) * lvl);
    return { cost: { [it.upg]: qty }, coins: Math.round(itemValue(id) * 0.6 * lvl) };
  }

  function craft(i) {
    const rec = RECIPES[i];
    if (!rec || rec.world > Game.highestWorld()) return;
    if (rec.item && S().items[rec.item]) return;
    if (!Game.payCost(rec.cost, rec.coins)) { toast('Te faltan materiales', true); return; }
    Sfx.play('forge'); vibrate(40);
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
          <div class="prize-icon">${it.icon}</div>
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
    if (!s.items[id] || s.items[id].lvl >= MAX_ITEM_LEVEL) return;
    const c = upgradeCost(id);
    if (!Game.payCost(c.cost, c.coins)) { toast('Te faltan materiales o monedas', true); return; }
    s.items[id].lvl++;
    Game.save();
    Sfx.play('forge'); vibrate(40);
    toast(`⬆️ ${ITEMS[id].name} ahora es nivel ${s.items[id].lvl}`);
    RENDER.forge(); refreshTop();
    const card = $('up-' + id);
    if (card) card.classList.add('forge-flash');
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
          <div class="item-head"><div class="item-icon">${it.icon}</div><div><div class="item-name">${it.name}</div><div class="stars">${stars(lvl)}</div><div class="item-meta">${RARITIES[it.rarity].icon} ${RARITIES[it.rarity].name}</div></div></div>
          <div class="stat-line">${stats}</div>
          <button class="btn small ${eq ? 'ghost' : ''}" data-act="equip" data-id="${id}" ${eq ? 'disabled' : ''}>${eq ? '✅ Equipado' : 'Equipar'}</button>
        </div>`;
      }).join('')}</div>`;
    } else if (t === 'mats' || t === 'special') {
      const ids = Object.keys(MATERIALS).filter(id => !!MATERIALS[id].special === (t === 'special') && Game.matCount(id) > 0)
        .sort((a, b) => RARITY_ORDER.indexOf(MATERIALS[a].rarity) - RARITY_ORDER.indexOf(MATERIALS[b].rarity));
      const extra = t === 'special' ? `<div class="mat" style="--rc:var(--gem)"><span class="mi">💎</span><span class="mq">${fmt(s.gems)}</span><span class="mn">Cristales</span></div>` : '';
      body = ids.length || extra
        ? `<div class="mat-grid">${extra}${ids.map(id => `<div class="mat" style="--rc:${rc(MATERIALS[id].rarity)}"><span class="mi">${MATERIALS[id].icon}</span><span class="mq">${fmt(Game.matCount(id))}</span><span class="mn">${MATERIALS[id].name}</span></div>`).join('')}</div>`
        : '<div class="empty">Aún no tienes materiales. ¡Derrota enemigos para conseguirlos!</div>';
      if (t === 'special') body += '<p class="hint" style="margin-top:12px">Los materiales especiales los sueltan los jefes y sirven para forjar equipo poderoso.</p>';
    } else if (t === 'potions') {
      body = `<div class="cards">${Object.keys(POTIONS).map(id => {
        const pd = POTIONS[id];
        return `<div class="card item-card" style="--rc:${rc(pd.rarity)}">
          <div class="item-head"><div class="item-icon">${pd.icon}</div><div><div class="item-name">${pd.name} x${s.potions[id] || 0}</div><div class="item-meta">Cura ${Math.round(pd.heal * 100)}% de tu vida en combate (botón 🧪)</div></div></div>
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
        <div class="card item-card" style="--rc:${rc(w.rarity)}"><div class="item-head"><div class="item-icon">${w.icon}</div><div><div class="item-name">${w.name}</div><div class="stars">${stars(s.items[s.equip.weapon].lvl)}</div></div></div></div>
        <div class="card item-card" style="--rc:${rc(a.rarity)}"><div class="item-head"><div class="item-icon">${a.icon}</div><div><div class="item-name">${a.name}</div><div class="stars">${stars(s.items[s.equip.armor].lvl)}</div></div></div></div>
      </div>
      <button class="btn ghost wide" style="margin-top:10px" data-act="go" data-to="inv">🎒 Cambiar equipo</button>
      <h3 class="section-title">Habilidades</h3>
      <div class="cards">${skills}</div>`;
    animateKnight('char-cv', 'char', 100, 380, 4.4);
  };

  /** Anima al caballero en reposo dentro de un canvas mientras su pantalla esté visible. */
  const knightAnims = {};
  function animateKnight(canvasId, screen, x, y, scale) {
    cancelAnimationFrame(knightAnims[canvasId]);
    const cv = $(canvasId);
    if (!cv) return;
    const c = cv.getContext('2d'), s = S(), t0 = performance.now();
    (function frame(t) {
      if (!document.body.contains(cv) || current !== screen) return;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cv.width, cv.height);
      Sprites.knight(c, x, y, scale, { face: 1, walk: 0, swing: -1, heavy: false, time: (t - t0) / 1000,
        weaponColor: ITEMS[s.equip.weapon].color, armorColor: ITEMS[s.equip.armor].color, flash: false, helmet: s.settings.helmet, rank: Game.rank() });
      knightAnims[canvasId] = requestAnimationFrame(frame);
    })(t0);
  }

  /* ---------- Ajustes ---------- */
  RENDER.settings = () => {
    const s = S();
    $('scr-settings').innerHTML = `${head('⚙️ Ajustes')}
      <div class="card setting"><div><b>🔊 Sonido</b><div class="item-meta">Efectos de sonido del juego</div></div><button class="switch ${s.settings.sound ? 'on' : ''}" data-act="toggle" data-key="sound" aria-label="Sonido"></button></div>
      <div class="card account">
        <div class="setting" style="padding:0;margin:0"><div><b>👤 ${s.username ? esc(s.username) : 'Sin nombre'}</b><div class="item-meta">Tu nombre de usuario</div></div><button class="btn small ghost" data-act="name">✏️ Cambiar</button></div>
        <p class="hint" style="margin:10px 0 8px">${cloudText()}</p>
        <button class="btn small ghost" data-act="save-code">💾 Código de guardado</button>
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
    play: () => openStage(S().unlocked),
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
    craft: d => craft(+d.i),
    upgrade: d => upgrade(d.id),
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
    name: () => askUsername(true),
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
      if (S().settings.landscape && canFullscreen() && matchMedia('(pointer: coarse)').matches) goLandscape();
    }, true);
    window.addEventListener('resize', checkOrientation);
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', checkOrientation);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && current === 'battle' && Battle.active && !Battle.paused && $('modal').hidden) openPause();
    });
  }

  return { show, toast, vibrate, refreshTop, bindEvents, askUsername, onCloud, redrawArt: drawFoes, get current() { return current; } };
})();
