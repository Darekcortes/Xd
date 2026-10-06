'use strict';
/* =====================================================================
   COMBATE — arena en vista 3/4 con movimiento libre (estilo beat'em up)
   El jugador se mueve en dos ejes (x, y del suelo), esquiva rodando,
   encadena combos y rompe objetos. Los enemigos tienen IA distinta
   (cuerpo a cuerpo, a distancia, embestida, golpe en área) y los jefes
   marcan zonas en el suelo que hay que esquivar moviéndose.
   ===================================================================== */
const Battle = (() => {
  // Tamaño lógico: ancho ~ píxeles del celular, alto adaptado a la pantalla.
  // HY es el horizonte; el suelo jugable va de fieldTop() a fieldBot().
  let W = 400, H = 480, HY = 130;
  const fieldTop = () => HY + 28, fieldBot = () => H - 14;
  const PLAYER_SPEED = 150, DODGE_SPEED = 430, REACH = 56, DEPTH = 22;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  // Distancia en el suelo (el eje y cuenta doble por la perspectiva)
  const gdist = (ax, ay, bx, by) => Math.hypot(ax - bx, (ay - by) * 1.8);

  let cv, ctx, dpr = 1, bg = null;
  let st = null, raf = 0, lastT = 0, onEnd = null, paused = false, hudT = 0;
  const keys = { left: false, right: false, up: false, down: false, attack: false };
  const stick = { x: 0, y: 0, active: false };
  const $ = id => document.getElementById(id);
  let H_ = {};

  /* ---------- Inicialización y tamaño ---------- */
  function init() {
    cv = $('arena');
    ctx = cv.getContext('2d');
    H_ = {
      hpFill: $('b-hp-fill'), hpText: $('b-hp-text'), stage: $('b-stage'), prog: $('b-progress'),
      coins: $('b-coins'), mats: $('b-mats'), bossBar: $('b-boss'), bossName: $('b-boss-name'),
      bossFill: $('b-boss-fill'), potion: $('b-potion-count'), dodge: $('b-dodge'),
    };
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const inner = cv.parentElement, box = inner.parentElement.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) {
      const aspect = box.width / box.height;
      W = Math.round(clamp(box.width * 0.86, 320, 520));
      H = Math.round(W / aspect);
      if (H < 300) { H = 300; W = Math.round(H * aspect); }
      H = Math.min(H, Math.round(W * 1.45));
    }
    HY = Math.round(clamp(H * 0.27, 80, 170));
    cv.width = W * dpr; cv.height = H * dpr;
    inner.style.aspectRatio = `${W} / ${H}`;
    if (st) {
      bg = Sprites.background(st.world.theme, W, H, HY, dpr);
      st.p.x = clamp(st.p.x, 16, W - 16);
      st.p.y = clamp(st.p.y, fieldTop(), fieldBot());
    }
  }

  /* ---------- Inicio de etapa ---------- */
  function start(stage, cb) {
    const info = stageInfo(stage);
    const P = Game.stats();
    onEnd = cb;
    resize();
    // Reparte los enemigos en oleadas
    const pool = info.world.enemies;
    const pick = () => pool[Math.floor(Math.random() * pool.length)];
    const waves = [];
    if (info.boss) {
      waves.push(Array.from({ length: 4 }, pick));
      waves.push([info.world.boss]);
    } else {
      const nWaves = stage >= 3 ? 3 : 2;
      const total = info.enemyCount;
      for (let w = 0; w < nWaves; w++) {
        const n = Math.round(total / nWaves) + (w === nWaves - 1 ? total - Math.round(total / nWaves) * nWaves : 0);
        waves.push(Array.from({ length: Math.max(1, n) }, pick));
      }
    }
    const total = waves.reduce((t, w) => t + w.length, 0);
    st = {
      info, world: info.world, stage, time: 0,
      p: { x: W * 0.3, y: (fieldTop() + fieldBot()) / 2, hp: P.maxHp, maxHp: P.maxHp, dmg: P.dmg, def: P.def,
           spd: P.spd, crit: P.crit, face: 1, atkT: 0, swing: -1, heavy: false, walk: 0, flash: 0, invuln: 0,
           chain: 0, chainT: 0, dodgeT: 0, dodgeCd: 0, dx: 1, dy: 0, ghostT: 0 },
      enemies: [], projs: [], zones: [], parts: [], floats: [], drops: [], bolts: [], rings: [], ambient: [],
      props: [], ghosts: [], lines: [],
      waves, waveIdx: -1, queue: [], waveT: 0.6, total, killed: 0, spawnT: 0,
      maxAlive: info.boss ? 3 : info.maxAlive + (stage > 4 ? 1 : 0),
      loot: { mats: {}, coins: 0, xp: 0, tickets: 0, gems: 0, shards: 0 }, cds: {}, potionT: 0,
      tips: stage === 1 && !Game.S.cleared[1] ? TUTORIAL.slice() : [], tipT: 1.2,
      combo: 0, comboT: 0, maxCombo: 0, comboPop: 0, elites: 0, kills: 0, comboMsgs: [],
      shake: 0, hurtFlash: 0, whiteFlash: 0, slowT: 0, hitStop: 0,
      ended: false, endT: 0, victory: false, boss: null, bossDefeated: false, specialDrop: null, banner: null,
    };
    bg = Sprites.background(info.world.theme, W, H, HY, dpr);
    for (let i = 0; i < 30; i++) st.ambient.push(newAmbient(true));
    spawnProps();
    showBanner(`Etapa ${stage}`, info.name, '#fde68a');
    resetInput();
    paused = false;
    cancelAnimationFrame(raf);
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
    updateHud(true);
  }

  function stop() { cancelAnimationFrame(raf); raf = 0; st = null; }
  function resetInput() { keys.left = keys.right = keys.up = keys.down = keys.attack = false; stick.x = stick.y = 0; stick.active = false; }

  const PROP_STYLE = {
    bosque: { kind: 'crate', color: '#a16207' }, desierto: { kind: 'pot', color: '#c2410c' },
    hielo: { kind: 'crate', color: '#7dd3fc' }, volcan: { kind: 'barrel', color: '#7c2d12' }, oscuro: { kind: 'pot', color: '#6b21a8' },
  };
  function spawnProps() {
    const style = PROP_STYLE[st.world.theme] || PROP_STYLE.bosque;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      st.props.push(Object.assign({ x: rand(W * 0.45, W - 30), y: rand(fieldTop() + 10, fieldBot() - 6), flash: 0, dead: false }, style));
    }
  }

  // Consejos que aparecen la primera vez que se juega la etapa 1
  const TUTORIAL = [
    { t: 1.2, text: '👈 Arrastra el joystick para moverte' },
    { t: 5.5, text: '⚔️ Mantén pulsado el botón dorado para atacar' },
    { t: 10, text: '💨 Rueda para esquivar: no recibes daño mientras ruedas' },
    { t: 15, text: '🔥 Derrota enemigos seguidos para subir el COMBO' },
    { t: 20, text: '📦 Rompe cajas: esconden oro y corazones' },
  ];

  /* ---------- Bucle principal ---------- */
  function loop(t) {
    raf = requestAnimationFrame(loop);
    let dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (!st || paused) return;
    if (st.hitStop > 0) { st.hitStop -= dt; draw(); return; }   // congelación breve al golpear
    if (st.slowT > 0) { st.slowT -= dt; dt *= 0.35; }
    update(dt);
    if (!st) return;          // la etapa terminó durante este frame
    draw();
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.06; updateHud(); }
  }

  function update(dt) {
    st.time += dt;
    if (st.tips.length && st.time >= st.tips[0].t && !st.ended) showBanner('', st.tips.shift().text, '#ffffff', 3.6);
    updatePlayer(dt);
    updateWaves(dt);
    for (const e of st.enemies) updateEnemy(e, dt);
    separateEnemies();
    st.enemies = st.enemies.filter(e => !(e.dead && e.deathT <= 0));
    updateProjectiles(dt);
    updateZones(dt);
    updateDrops(dt);
    updateFx(dt);
    for (const k in st.cds) st.cds[k] -= dt;
    st.potionT -= dt;
    st.comboT -= dt;
    st.pickT = (st.pickT || 0) - dt;
    if (st.comboT <= 0 && st.combo) st.combo = 0;

    if (!st.ended) {
      if (st.p.hp <= 0) {
        st.ended = true; st.victory = false; st.endT = 1.8;
        showBanner('HAS CAÍDO', 'Conservas la mitad del botín', '#f87171');
        Sfx.play('lose');
      } else if (st.waveIdx >= st.waves.length - 1 && !st.queue.length && st.enemies.every(e => e.dead)) {
        st.ended = true; st.victory = true; st.endT = st.info.boss ? 2.4 : 1.5;
        if (!st.info.boss) showBanner('¡ETAPA COMPLETADA!', '', '#86efac');
        Sfx.play('win');
      }
    } else {
      st.endT -= dt;
      if (st.endT <= 0.6) collectAllDrops();
      if (st.endT <= 0) finish();
    }
  }

  /* ---------- Jugador ---------- */
  function moveInput() {
    let x = 0, y = 0;
    if (stick.active) { x = stick.x; y = stick.y; }
    else { x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0); y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0); }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, m: Math.min(1, m) };
  }

  function updatePlayer(dt) {
    const p = st.p;
    p.atkT -= dt; p.flash -= dt; p.invuln -= dt; p.chainT -= dt; p.dodgeCd -= dt;
    if (p.swing >= 0) { p.swing += dt / (p.swingDur || 0.22); if (p.swing >= 1) p.swing = -1; }
    if (st.ended || p.hp <= 0) { p.walk = 0; return; }
    const mv = moveInput();
    if (p.dodgeT > 0) {
      p.dodgeT -= dt;
      p.x += p.dx * DODGE_SPEED * dt; p.y += p.dy * DODGE_SPEED * 0.75 * dt;
      p.ghostT -= dt;
      if (p.ghostT <= 0) { p.ghostT = 0.035; st.ghosts.push({ x: p.x, y: p.y, face: p.face, t: 0.25 }); }
      p.walk += dt * 20;
    } else if (mv.m > 0.08) {
      p.x += mv.x * PLAYER_SPEED * dt; p.y += mv.y * PLAYER_SPEED * 0.8 * dt;
      if (Math.abs(mv.x) > 0.2 && p.swing < 0) p.face = Math.sign(mv.x);
      p.walk += dt * 13 * mv.m;
      p.dx = mv.x / (mv.m || 1); p.dy = mv.y / (mv.m || 1);
    } else p.walk = 0;
    p.x = clamp(p.x, 16, W - 16);
    p.y = clamp(p.y, fieldTop(), fieldBot());
    if (keys.attack && p.atkT <= 0) attack();
  }

  function nearestEnemy(x, y, maxDist) {
    let best = null, bd = maxDist;
    for (const e of st.enemies) {
      if (e.dead) continue;
      const d = gdist(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // Combo de tres golpes: tajo descendente → estocada → golpe vertical fuerte
  const COMBO = [
    { style: 'slash',  dur: 0.2,  mult: 1,   reach: 0,  depth: 0,  knock: 5,  extra: 0 },
    { style: 'thrust', dur: 0.2,  mult: 1.1, reach: 16, depth: -6, knock: 8,  extra: 0 },
    { style: 'smash',  dur: 0.3,  mult: 1.9, reach: 8,  depth: 10, knock: 30, extra: 0.12 },
  ];

  function attack() {
    const p = st.p;
    p.chain = p.chainT > 0 ? (p.chain % 3) + 1 : 1;
    const mv = COMBO[p.chain - 1];
    p.atkT = 1 / (p.spd * BALANCE.attackRate) + mv.extra;
    p.chainT = p.atkT + 0.45;
    p.swingDur = mv.dur;
    const heavy = mv.style === 'smash';
    const near = nearestEnemy(p.x, p.y, 150);
    if (near) {
      p.face = Math.sign(near.x - p.x) || p.face;
      // Se acerca un poco a la profundidad del enemigo para no fallar por poco
      p.y += clamp(near.y - p.y, -8, 8);
    }
    p.x = clamp(p.x + p.face * (mv.style === 'thrust' ? 9 : heavy ? 7 : 4), 16, W - 16);
    p.swing = 0; p.heavy = heavy; p.style = mv.style;
    Sfx.play('swing');
    const reach = REACH + mv.reach;
    let hit = 0;
    for (const e of st.enemies) {
      if (e.dead || (e.z || 0) > 25) continue;
      const dx = (e.x - p.x) * p.face;
      if (dx > -16 && dx < reach + e.size * 0.35 && Math.abs(e.y - p.y) < DEPTH + mv.depth + e.size * 0.18) {
        damageEnemy(e, p.dmg * BALANCE.hitDamage * mv.mult, { knock: mv.knock, canCrit: true, combo: true });
        hit++;
      }
    }
    if (heavy) {
      // El golpe fuerte sacude el suelo
      st.rings.push({ x: p.x + p.face * 30, y: p.y, r: 6, max: 46, t: 0.3, life: 0.3, color: '#e0f2fe' });
      burst(p.x + p.face * 34, p.y - 2, '#d6d3d1', 10, 90, -60);
    }
    for (const pr of st.props) {
      if (pr.dead) continue;
      const dx = (pr.x - p.x) * p.face;
      if (dx > -12 && dx < reach + 8 && Math.abs(pr.y - p.y) < DEPTH + 6) breakProp(pr);
    }
    // Los golpes desvían proyectiles enemigos
    for (const pr of st.projs) {
      if (!pr.hostile) continue;
      const dx = (pr.x - p.x) * p.face;
      if (dx > -12 && dx < reach + 14 && Math.abs(pr.y - p.y) < DEPTH + 10) {
        pr.hostile = false; pr.vx = -pr.vx * 1.4; pr.vy = -pr.vy * 1.4; pr.dmg = p.dmg * 1.5; pr.life = 2;
        addFloat(pr.x, pr.y - 30, '¡BLOQUEO!', '#93c5fd', 13);
        Sfx.play('deflect');
      }
    }
    if (hit) st.hitStop = heavy ? 0.07 : 0.03;
    if (heavy) st.shake = Math.max(st.shake, hit ? 6 : 3);
  }

  function dodge() {
    if (!st || st.ended || paused) return;
    const p = st.p;
    if (p.dodgeCd > 0 || p.hp <= 0 || p.dodgeT > 0) return;
    const mv = moveInput();
    if (mv.m > 0.2) { p.dx = mv.x / mv.m; p.dy = mv.y / mv.m; } else { p.dx = p.face; p.dy = 0; }
    if (Math.abs(p.dx) > 0.2) p.face = Math.sign(p.dx);
    p.dodgeT = 0.2; p.dodgeCd = 0.75; p.invuln = Math.max(p.invuln, 0.32);
    Sfx.play('swing');
    burst(p.x, p.y - 4, '#d6d3d1', 8, 60, -20);
  }

  function hurtPlayer(amount, fromBoss) {
    const p = st.p;
    if (p.invuln > 0 || st.ended || p.hp <= 0) return false;
    // Ningún golpe quita demasiada vida de una vez (los de jefe aún menos)
    const cap = p.maxHp * (fromBoss ? BALANCE.bossHitCap : BALANCE.hitCap);
    const dmg = Math.max(1, Math.round(Math.min(cap, amount * rand(0.9, 1.1) * 100 / (100 + p.def))));
    p.hp = Math.max(0, p.hp - dmg);
    p.flash = 0.18; p.invuln = 0.45;
    burst(p.x + p.face * 6, p.y - 32, '#ef4444', 10, 130);
    addFloat(p.x, p.y - 64, `-${dmg}`, '#f87171', 17);
    st.shake = Math.max(st.shake, 6);
    st.hurtFlash = 0.3;
    Sfx.play('hurt');
    UI.vibrate(35);
    return true;
  }

  /* ---------- Habilidades ---------- */
  const skillLevel = id => Game.S.skills[id] || 0;
  const skillMult = id => SKILLS[id].mult * (1 + 0.2 * (skillLevel(id) - 1));
  const skillCd = id => SKILLS[id].cd * (1 - 0.05 * (skillLevel(id) - 1));

  function castSkill(id) {
    if (!st || st.ended || paused || st.p.hp <= 0 || !skillLevel(id) || (st.cds[id] || 0) > 0) return;
    const p = st.p;
    st.cds[id] = skillCd(id);
    const near = nearestEnemy(p.x, p.y, 400);
    p.swing = 0; p.heavy = true; p.style = 'smash'; p.swingDur = 0.3;
    if (id === 'fuego') {
      let vx = p.face, vy = 0;
      if (near) { const d = Math.hypot(near.x - p.x, near.y - p.y) || 1; vx = (near.x - p.x) / d; vy = (near.y - p.y) / d; p.face = Math.sign(vx) || p.face; }
      st.projs.push({ x: p.x + p.face * 18, y: p.y, vx: vx * 340, vy: vy * 340, hostile: false, kind: 'bigfire',
                      dmg: p.dmg * skillMult('fuego'), life: 1.3, explode: SKILLS.fuego.radius, burn: SKILLS.fuego.burn });
      Sfx.play('fire');
    } else if (id === 'hielo') {
      st.rings.push({ x: p.x, y: p.y, r: 10, max: 190, t: 0.6, life: 0.6, color: '#bae6fd' });
      const freeze = SKILLS.hielo.freeze + 0.3 * (skillLevel('hielo') - 1);
      for (const e of st.enemies) {
        if (e.dead || gdist(e.x, e.y, p.x, p.y) > 200) continue;
        // Los enemigos de hielo resisten: menos daño y solo se ralentizan
        const resist = e.def.resist === 'hielo';
        damageEnemy(e, p.dmg * skillMult('hielo') * (resist ? 0.5 : 1), { color: '#bae6fd' });
        if (e.dead) continue;
        if (resist) { e.slowT = 3 + 0.3 * (skillLevel('hielo') - 1); addFloat(e.x, e.y - e.size - 22, 'Ralentizado', '#bae6fd', 12); }
        else e.frozen = e.boss ? 1.4 : freeze;
        burst(e.x, e.y - e.size / 2, '#e0f2fe', 10, 120);
      }
      Sfx.play('ice');
    } else if (id === 'rayo') {
      const targets = st.enemies.filter(e => !e.dead).sort((a, b) => gdist(a.x, a.y, p.x, p.y) - gdist(b.x, b.y, p.x, p.y)).slice(0, SKILLS.rayo.targets);
      for (const e of targets) {
        st.bolts.push({ x: e.x, y: e.y - e.size * 0.5, t: 0.35 });
        damageEnemy(e, p.dmg * skillMult('rayo'), { color: '#fde047' });
      }
      if (!targets.length) st.bolts.push({ x: p.x + p.face * 80, y: p.y, t: 0.35 });
      st.whiteFlash = 0.18; st.shake = Math.max(st.shake, 6);
      Sfx.play('thunder');
    }
  }

  function heal(amount, color = '#4ade80') {
    const p = st.p;
    const real = Math.min(p.maxHp - p.hp, Math.round(amount));
    p.hp += real;
    addFloat(p.x, p.y - 64, `+${real}`, color, 17);
    burst(p.x, p.y - 26, '#86efac', 14, 90, -60);
  }

  function usePotion() {
    if (!st || st.ended || paused || st.potionT > 0 || st.p.hp <= 0) return;
    const p = st.p, S = Game.S;
    const missing = 1 - p.hp / p.maxHp;
    if (missing < 0.03) { addFloat(p.x, p.y - 64, 'Vida llena', '#d1fae5', 13); return; }
    let id = null;
    if (S.potions.pocion_grande > 0 && (missing > 0.5 || !S.potions.pocion)) id = 'pocion_grande';
    else if (S.potions.pocion > 0) id = 'pocion';
    if (!id) { addFloat(p.x, p.y - 64, 'Sin pociones', '#fca5a5', 13); return; }
    S.potions[id]--;
    heal(p.maxHp * POTIONS[id].heal);
    st.potionT = 1.5;
    Sfx.play('potion');
    Game.save();
  }

  /* ---------- Oleadas ---------- */
  function updateWaves(dt) {
    if (st.ended) return;
    const alive = st.enemies.filter(e => !e.dead).length;
    if (!st.queue.length && alive === 0 && st.waveIdx < st.waves.length - 1) {
      st.waveT -= dt;
      if (st.waveT <= 0) {
        st.waveIdx++;
        st.queue = st.waves[st.waveIdx].slice();
        st.spawnT = 0.3; st.waveT = 1.3;
        const isBoss = ENEMIES[st.queue[0]].boss;
        if (!isBoss && st.waves.length > 1 && st.waveIdx > 0) showBanner(`Oleada ${st.waveIdx + 1}/${st.waves.filter(w => !ENEMIES[w[0]].boss).length}`, '', '#fde68a', 1.2);
      }
      return;
    }
    if (!st.queue.length) return;
    st.spawnT -= dt;
    if (st.spawnT > 0) return;
    const next = st.queue[0];
    if (ENEMIES[next].boss) {
      st.queue.shift();
      const b = makeEnemy(next, 1);
      b.x = W + 60; b.y = (fieldTop() + fieldBot()) / 2;
      st.boss = b;
      st.enemies.push(b);
      showBanner(`⚠️ ${b.def.name.toUpperCase()}`, '¡Ha aparecido el jefe!', '#fca5a5', 2.2);
      Sfx.play('roar');
      st.shake = 9;
    } else if (alive < st.maxAlive) {
      st.queue.shift();
      st.enemies.push(makeEnemy(next, Math.random() < 0.65 ? 1 : -1));
      st.spawnT = rand(0.5, 1.1);
    }
  }

  function makeEnemy(id, side, opts = {}) {
    const d = ENEMIES[id], I = st.info;
    const elite = !d.boss && !opts.mini && Math.random() < I.eliteChance;
    const B = BALANCE, dmgMult = I.dmgMult * (d.boss ? B.bossDmg : 1);
    let hp = Math.round(I.hp * d.hp * (elite ? 2.2 : 1) * (opts.mini ? 0.35 : 1) * (d.boss ? B.bossHp : 1));
    const size = d.size * (elite ? 1.2 : 1) * (opts.mini ? 0.6 : 1);
    return {
      id, def: d, boss: !!d.boss, elite, mini: !!opts.mini,
      x: opts.x != null ? opts.x : (side > 0 ? W + 30 : -30),
      y: opts.y != null ? opts.y : rand(fieldTop() + 8, fieldBot() - 4),
      z: 0, kx: 0, ky: 0,
      hp, maxHp: hp, atk: I.atk * d.atk * dmgMult * (elite ? 1.2 : 1), speed: d.speed * rand(0.9, 1.1) * (opts.mini ? 1.3 : 1),
      range: d.range, size, face: side > 0 ? -1 : 1, walk: Math.random() * 6, seed: Math.random() * 10,
      atkT: rand(0.6, 1.3), windup: 0, windupMax: 1, recover: 0, flash: 0, frozen: 0, burn: 0, burnTick: 0,
      state: 'move', stateT: 0, specialCd: rand(2, 4), dashHit: false, tx: 0, ty: 0,
      dead: false, deathT: 0, specialT: d.specialCd ? d.specialCd * 0.6 : 0, atkIdx: 0, enraged: false, action: null,
      strafe: Math.random() < 0.5 ? -1 : 1,
    };
  }

  /* ---------- IA de enemigos ---------- */
  function updateEnemy(e, dt) {
    if (e.dead) { e.deathT -= dt; return; }
    e.flash -= dt;
    // Empuje por golpes
    if (e.kx || e.ky) {
      e.x += e.kx * dt; e.y += e.ky * dt;
      e.kx *= Math.pow(0.0005, dt); e.ky *= Math.pow(0.0005, dt);
      if (Math.abs(e.kx) < 5) e.kx = 0; if (Math.abs(e.ky) < 5) e.ky = 0;
    }
    if (e.burn > 0) {
      e.burn -= dt; e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.5;
        damageEnemy(e, st.p.dmg * 0.12 * skillMult('fuego'), { color: '#fb923c', silent: true });
        burst(e.x, e.y - e.size * 0.6, '#fb923c', 4, 40, -60);
        if (e.dead) return;
      }
    }
    let slow = 1;
    if (e.frozen > 0) { e.frozen -= dt; if (!e.boss) return; slow = 0.4; }
    if (e.slowT > 0) { e.slowT -= dt; slow *= 0.5; if (Math.random() < dt * 6) st.parts.push({ x: e.x + rand(-10, 10), y: e.y - rand(5, e.size), vx: 0, vy: -10, life: 0.5, max: 0.5, color: '#bae6fd', size: 2, grav: 0 }); }
    const p = st.p;
    const dx = p.x - e.x, dy = p.y - e.y;
    const onScreen = e.x > 6 && e.x < W - 6;
    if (e.boss && updateBoss(e, dt * slow)) { clampEnemy(e); return; }
    if (e.recover > 0) { e.recover -= dt; return; }
    e.atkT -= dt * slow;
    e.specialCd -= dt * slow;

    // Embestida (lobos y jefes)
    if (e.state === 'aim') {
      e.stateT -= dt * slow;
      e.face = Math.sign(e.tx - e.x) || e.face;
      if (e.stateT <= 0) { e.state = 'dash'; e.stateT = 0.5; e.dashHit = false; }
      return;
    }
    if (e.state === 'dash') {
      e.stateT -= dt;
      const ddx = e.tx - e.x, ddy = e.ty - e.y, d = Math.hypot(ddx, ddy);
      const sp = 400 * slow;
      if (d > 4) { e.x += ddx / d * sp * dt; e.y += ddy / d * sp * dt; }
      e.walk += dt * 22;
      if (st.parts.length < 400) st.parts.push({ x: e.x - e.face * e.size * 0.3, y: e.y - 3, vx: -e.face * 40, vy: -20, life: 0.3, max: 0.3, color: '#d6d3d1', size: 3, grav: 0 });
      if (!e.dashHit && gdist(e.x, e.y, p.x, p.y) < e.size * 0.45 + 10) { if (hurtPlayer(e.atk * 1.3, e.boss)) e.dashHit = true; }
      if (e.stateT <= 0 || d < 6) { e.state = 'move'; e.recover = 0.6; e.specialCd = rand(2.8, 4.2); }
      clampEnemy(e);
      return;
    }
    // Golpe en área (gólems)
    if (e.state === 'slam') {
      e.stateT -= dt * slow;
      e.windup = Math.max(0.01, e.stateT); e.windupMax = 0.9;
      if (e.stateT <= 0) { e.state = 'move'; e.windup = 0; e.recover = 0.5; e.specialCd = rand(4, 5.5); }
      return;
    }

    if (e.windup > 0) {
      e.windup -= dt * slow;
      if (e.windup <= 0) {
        if (e.def.ai === 'ranged') shoot(e, e.def.proj, Math.atan2(dy, dx));
        else if (Math.abs(dx) <= e.range + 18 && Math.abs(dy) < DEPTH + 6) hurtPlayer(e.atk, e.boss);
        e.recover = 0.3; e.atkT = e.def.atkCd * rand(0.9, 1.15);
      }
      return;
    }

    const dist = gdist(e.x, e.y, p.x, p.y);
    const ai = e.def.ai;
    // Habilidades especiales según tipo
    if (ai === 'charger' && e.specialCd <= 0 && onScreen && dist > 70 && dist < 240 && p.hp > 0) {
      e.state = 'aim'; e.stateT = 0.55;
      const ext = 40;
      const d = Math.hypot(dx, dy) || 1;
      e.tx = clamp(p.x + dx / d * ext, 10, W - 10); e.ty = clamp(p.y + dy / d * ext * 0.5, fieldTop(), fieldBot());
      st.lines.push({ e, t: 0.55 });
      Sfx.play('warn');
      return;
    }
    if (ai === 'tank' && e.specialCd <= 0 && dist < 80 && p.hp > 0) {
      e.state = 'slam'; e.stateT = 0.9;
      addZone(e.x, e.y, 62, 0.9, e.atk * 1.4, 'slam', false);
      Sfx.play('warn');
      return;
    }

    if (ai === 'ranged') {
      e.face = Math.sign(dx) || e.face;
      let mx = 0, my = 0;
      if (dist < 110) { mx = -Math.sign(dx); my = -Math.sign(dy) * 0.5; }
      else if (dist > e.range) { mx = Math.sign(dx); my = Math.sign(dy) * 0.6; }
      else { my = e.strafe * 0.6; if (Math.random() < dt * 0.5) e.strafe *= -1; }
      e.x += mx * e.speed * slow * dt; e.y += my * e.speed * 0.7 * slow * dt;
      if (mx || my) e.walk += dt * 10;
      if (dist <= e.range && onScreen && e.atkT <= 0 && p.hp > 0) { e.windupMax = 0.6; e.windup = 0.6; }
      clampEnemy(e, true);
      return;
    }

    // Cuerpo a cuerpo: se coloca a un lado del jugador, a la misma profundidad
    const side = e.x < p.x ? -1 : 1;
    const tx = p.x + side * (e.range * 0.8 + 6), ty = p.y;
    const mx = tx - e.x, my = ty - e.y, md = Math.hypot(mx, my);
    const wobble = e.def.float ? Math.sin(st.time * 3 + e.seed) * 20 : 0;
    if (md > 4) {
      const sp = e.speed * slow;
      e.x += mx / md * sp * dt;
      e.y += (my / md * sp * 0.75 + wobble * 0.3) * dt;
      e.walk += dt * 10;
    }
    e.face = Math.sign(dx) || e.face;
    if (Math.abs(dx) <= e.range + 10 && Math.abs(dy) < DEPTH - 4 && onScreen && e.atkT <= 0 && p.hp > 0) {
      e.windupMax = e.boss ? 0.5 : 0.42; e.windup = e.windupMax;
    }
    clampEnemy(e);
  }

  /** Margen para que el jefe entero quepa en pantalla (el dragón es muy ancho). */
  const bossMargin = e => e.size * (e.def.sprite.shape === 'dragon' ? 0.85 : 0.45);

  function clampEnemy(e, strict) {
    e.y = clamp(e.y, fieldTop(), fieldBot());
    if (e.boss) {
      // Una vez dentro, el jefe no sale de la pantalla
      const m = bossMargin(e);
      if (e.x < W - m) e.inside = true;
      if (e.inside) { e.x = clamp(e.x, m, W - m); return; }
    }
    e.x = strict && e.x > 0 && e.x < W ? clamp(e.x, 12, W - 12) : clamp(e.x, -60, W + 60);
  }

  function separateEnemies() {
    const list = st.enemies.filter(e => !e.dead && !e.boss && e.state !== 'dash');
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dy = (b.y - a.y) * 1.8, d = Math.hypot(dx, dy) || 0.01;
        const min = (a.size + b.size) * 0.34;
        if (d < min) {
          const push = (min - d) / 2;
          a.x -= dx / d * push; b.x += dx / d * push;
          a.y -= dy / d * push * 0.5; b.y += dy / d * push * 0.5;
        }
      }
  }

  function shoot(e, kind, ang, speed) {
    const sp = speed || (kind === 'arrow' ? 230 : 175);
    st.projs.push({
      x: e.x + Math.cos(ang) * e.size * 0.35, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.8,
      hostile: true, kind: kind || 'darkorb', dmg: e.atk * (e.boss ? 0.7 : 1), life: 3.2, h: e.size * 0.55, boss: e.boss,
    });
  }

  /* ---------- Jefes ---------- */
  function updateBoss(e, dt) {
    if (!e.enraged && e.hp < e.maxHp * 0.5) {
      e.enraged = true; e.speed *= 1.25;
      showBanner('¡FURIA!', `${e.def.name} se enfurece`, '#f87171');
      Sfx.play('roar'); st.shake = 8;
    }
    if (e.action) { runAction(e, dt); return true; }
    if (e.state === 'dash' || e.state === 'aim') return false;
    e.specialT -= dt;
    if (e.specialT <= 0 && e.x > 30 && e.x < W - 30 && e.windup <= 0) {
      const list = e.def.attacks;
      startAction(e, list[e.atkIdx++ % list.length]);
      e.specialT = e.def.specialCd * (e.enraged ? 0.7 : 1);
      return true;
    }
    return false;
  }

  function addZone(x, y, r, delay, dmg, fx, fall) {
    st.zones.push({ x: clamp(x, 10, W - 10), y: clamp(y, fieldTop(), fieldBot()), r, t: delay, total: delay, dmg, fx, fall, boom: 0 });
  }

  function startAction(e, type) {
    const p = st.p;
    const zonesBefore = st.zones.length;
    const [kind, arg] = type.split(':');
    e.action = { kind, arg, t: 0, fx: e.x, fy: e.y, tx: p.x, ty: p.y, shots: 0 };
    e.face = Math.sign(p.x - e.x) || e.face;
    Sfx.play('warn');
    const fx = e.def.zoneFx;
    switch (kind) {
      case 'leap': e.action.tx = clamp(p.x, bossMargin(e), W - bossMargin(e)); addZone(e.action.tx, p.y, 62, 1.1, e.atk * 1.4, 'slam', false); break;
      case 'slam': addZone(e.x, e.y, e.size * 0.55 + 55, 0.95, e.atk * 1.3, 'slam', false); break;
      case 'zones': {
        const n = e.enraged ? 6 : 4;
        addZone(p.x, p.y, 42, 1.2, e.atk * 1.2, fx, fx !== 'ice');
        for (let i = 1; i < n; i++) addZone(rand(30, W - 30), rand(fieldTop(), fieldBot()), 42, 1.2 + i * 0.16, e.atk * 1.2, fx, fx !== 'ice');
        break;
      }
      case 'lob': {
        const n = e.enraged ? 6 : 4;
        addZone(p.x, p.y, 36, 1.0, e.atk * 1.1, fx, true);
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; addZone(p.x + Math.cos(a) * 70, p.y + Math.sin(a) * 40, 34, 1.15 + i * 0.08, e.atk * 1.1, fx, true); }
        break;
      }
      case 'breath': {
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        for (let i = 0; i < 5; i++) addZone(e.x + Math.cos(ang) * (60 + i * 48), e.y + Math.sin(ang) * (30 + i * 26), 40, 0.8 + i * 0.1, e.atk * 1.5, 'fire', false);
        break;
      }
      case 'charge': {
        e.tx = clamp(p.x + Math.sign(p.x - e.x) * 60, bossMargin(e), W - bossMargin(e)); e.ty = p.y;
        e.state = 'aim'; e.stateT = 0.75; e.action = null;
        st.lines.push({ e, t: 0.75 });
        break;
      }
      case 'summon': showBanner('', '¡Invoca refuerzos!', '#fca5a5', 1.2); break;
    }
    for (let i = zonesBefore; i < st.zones.length; i++) st.zones[i].boss = true;
  }

  function runAction(e, dt) {
    const a = e.action;
    a.t += dt;
    if (a.kind === 'leap') {
      if (a.t >= 0.55 && a.t < 1.1) {
        const k = (a.t - 0.55) / 0.55;
        e.x = a.fx + (a.tx - a.fx) * k; e.y = a.fy + (a.ty - a.fy) * k;
        e.z = Math.sin(k * Math.PI) * 90;
      } else if (a.t >= 1.1) { e.z = 0; if (a.t > 1.45) e.action = null; }
    } else if (a.kind === 'slam') {
      e.windup = a.t < 0.95 ? 0.4 : 0; e.windupMax = 0.5;
      if (a.t > 1.3) { e.action = null; e.windup = 0; }
    } else if (a.kind === 'zones' || a.kind === 'lob') {
      if (a.t > 0.8) e.action = null;
    } else if (a.kind === 'volley') {
      const n = e.enraged ? 7 : 5;
      if (a.t > 0.45 && !a.shots) {
        a.shots = 1;
        const base = Math.atan2(st.p.y - e.y, st.p.x - e.x);
        for (let i = 0; i < n; i++) shoot(e, e.def.proj, base + (i - (n - 1) / 2) * 0.22, 170);
        Sfx.play('fire');
      }
      if (a.t > 1.0) e.action = null;
    } else if (a.kind === 'spin') {
      if (a.t > 0.5 && a.shots < 2 && a.t > 0.5 + a.shots * 0.5) {
        const n = 10, off = a.shots * 0.31;
        for (let i = 0; i < n; i++) shoot(e, e.def.proj, off + i / n * Math.PI * 2, 140);
        a.shots++;
        Sfx.play('fire');
      }
      if (a.t > 1.6) e.action = null;
    } else if (a.kind === 'breath') {
      e.breath = a.t > 0.6 && a.t < 1.5;
      if (e.breath) {
        const ang = Math.atan2(a.ty - e.y, a.tx - e.x);
        for (let i = 0; i < 3; i++) st.parts.push({ x: e.x + e.face * e.size * 0.5, y: e.y - e.size * 0.75, vx: Math.cos(ang) * rand(200, 330), vy: Math.sin(ang) * rand(120, 200) + rand(-30, 30), life: 0.7, max: 0.7, color: ['#f97316', '#fde047', '#ef4444'][i], size: rand(4, 8), grav: 120 });
      }
      if (a.t > 1.6) { e.action = null; e.breath = false; }
    } else if (a.kind === 'summon') {
      if (!a.done && a.t > 0.5) {
        a.done = true;
        if (st.enemies.filter(x => !x.dead).length < 6) { st.enemies.push(makeEnemy(a.arg, 1)); st.enemies.push(makeEnemy(a.arg, -1)); }
      }
      if (a.t > 0.9) e.action = null;
    } else e.action = null;
  }

  function updateZones(dt) {
    const p = st.p;
    for (const z of st.zones) {
      if (z.t > 0) {
        z.t -= dt;
        if (z.t <= 0) {
          z.boom = 0.45;
          const nx = (p.x - z.x) / z.r, ny = (p.y - z.y) / (z.r * 0.5);
          if (nx * nx + ny * ny < 1.15) hurtPlayer(z.dmg, z.boss);
          const col = FX_COLORS[z.fx] || '#fde68a';
          burst(z.x, z.y - 4, col, 16, 150, -120);
          Sfx.play(z.fx === 'ice' ? 'ice' : 'boom');
          st.shake = Math.max(st.shake, 4);
        }
      } else z.boom -= dt;
    }
    st.zones = st.zones.filter(z => z.t > 0 || z.boom > 0);
    for (const l of st.lines) l.t -= dt;
    st.lines = st.lines.filter(l => l.t > 0 && !l.e.dead);
  }
  const FX_COLORS = { slam: '#d6b98c', claw: '#e5e7eb', poison: '#84cc16', ice: '#bae6fd', meteor: '#f97316', fire: '#f97316', dark: '#a855f7' };

  /* ---------- Daño a enemigos y muerte ---------- */
  function damageEnemy(e, base, o = {}) {
    if (e.dead) return;
    const comboBonus = 1 + Math.min(COMBO_DMG_MAX, st.combo * COMBO_DMG_PER);
    let dmg = base * rand(0.9, 1.1) * comboBonus, crit = false;
    if (o.canCrit && Math.random() < st.p.crit) { dmg *= 2; crit = true; }
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.flash = 0.12;
    if (o.knock && !e.boss && !e.action) {
      const d = Math.hypot(e.x - st.p.x, e.y - st.p.y) || 1;
      e.kx = (e.x - st.p.x) / d * o.knock * 8; e.ky = (e.y - st.p.y) / d * o.knock * 3;
      if (e.windup > 0 && o.knock > 20) e.windup = 0;   // los golpes fuertes interrumpen
    }
    addFloat(e.x + rand(-8, 8), e.y - e.size - 6 - (e.z || 0), crit ? `${dmg}!` : `${dmg}`, crit ? '#fde047' : (o.color || '#ffffff'), crit ? 22 : 15);
    burst(e.x, e.y - e.size * 0.5 - (e.z || 0), crit ? '#fde047' : (o.color || '#ffffff'), crit ? 14 : 7, 150);
    if (!o.silent) Sfx.play(crit ? 'crit' : 'hit');
    if (crit) { st.shake = Math.max(st.shake, 4); st.hitStop = Math.max(st.hitStop, 0.06); }
    if (e.hp <= 0) killEnemy(e);
  }

  function rollMaterial(rare) {
    const depth = stageIndexInWorld(st.stage);
    const w = {};
    for (const id in st.world.drops) {
      const rIdx = RARITY_ORDER.indexOf(MATERIALS[id].rarity);
      w[id] = st.world.drops[id] * (1 + depth * 0.15 * rIdx) * (rare ? 1 + rIdx * 1.5 : 1);
    }
    return weightedPick(w);
  }

  /* ---------- Combo de derrotas ---------- */
  function addCombo() {
    st.combo++;
    st.comboT = COMBO_WINDOW;
    st.comboPop = 0.18;
    st.maxCombo = Math.max(st.maxCombo, st.combo);
    const r = COMBO_REWARDS[st.combo];
    if (!r) return;
    const p = st.p;
    if (r.coins) st.loot.coins += Math.round(st.info.coins * r.coins);
    if (r.mats) for (let i = 0; i < r.mats; i++) { const m = rollMaterial(true); st.loot.mats[m] = (st.loot.mats[m] || 0) + 1; }
    if (r.shards) st.loot.shards += r.shards;
    if (r.tickets) st.loot.tickets += r.tickets;
    if (r.gems) st.loot.gems += r.gems;
    showBanner('', `🔥 ¡COMBO x${st.combo}! + ${r.label}`, '#fde047', 1.4);
    burst(p.x, p.y - 40, '#fde047', 18, 160, -80);
    Sfx.play(st.combo >= 20 ? 'legendary' : 'levelup');
  }

  function killEnemy(e) {
    e.dead = true; e.deathT = 0.45; e.hp = 0; e.action = null; e.z = 0; e.state = 'move';
    if (!e.mini) st.killed++;
    st.kills++;
    Game.S.stats.kills++;
    addCombo();
    const mult = e.boss ? 6 : e.elite ? 3 : e.mini ? 0.3 : 1;
    st.loot.xp += Math.round(st.info.xp * e.def.hp * mult);
    burst(e.x, e.y - e.size * 0.5, '#ffffff', 18, 170);
    const coins = Math.max(1, Math.round(st.info.coins * rand(0.7, 1.3) * (e.boss ? 12 : e.elite ? 4 : e.mini ? 0.3 : 1)));
    spawnDrop(e.x, e.y, { coins });
    const n = e.boss ? 10 : e.elite ? 4 : e.mini ? (Math.random() < 0.3 ? 1 : 0) : (Math.random() < 0.7 ? 1 : 2);
    for (let i = 0; i < n; i++) spawnDrop(e.x, e.y, { mat: rollMaterial(), qty: e.boss ? 2 : 1 });
    if (!e.boss && Math.random() < (e.elite ? 0.6 : 0.07)) spawnDrop(e.x, e.y, { heart: true });
    if (e.elite) {
      st.elites++;
      // Los élites siempre sueltan algo bueno
      spawnDrop(e.x, e.y, { mat: rollMaterial(true), qty: 2 });
      if (Math.random() < 0.25) { st.loot.shards++; addFloat(e.x, e.y - e.size - 40, '+1 🧩 fragmento', '#c4b5fd', 13); }
      if (Math.random() < 0.25) { st.loot.gems++; addFloat(e.x, e.y - e.size - 54, '+1 💎', '#7dd3fc', 13); }
      showBanner('', '⭐ ¡Élite derrotado!', '#facc15', 1.1);
      burst(e.x, e.y - e.size * 0.5, '#facc15', 22, 190);
      Sfx.play('legendary');
    }
    // Los slimes se dividen en dos pequeños
    if (e.def.split && !e.mini) {
      for (const s of [-1, 1]) st.enemies.push(makeEnemy(e.id, 1, { mini: true, x: e.x + s * 12, y: clamp(e.y + s * 8, fieldTop(), fieldBot()) }));
    }
    if (e.boss) {
      const first = !Game.S.bossKills[st.world.boss];
      if (first || Math.random() < 0.35) {
        spawnDrop(e.x, e.y, { mat: st.world.bossDrop, qty: 1 });
        st.specialDrop = st.world.bossDrop;
      }
      st.bossDefeated = true;
      st.slowT = 1.4; st.shake = 12; st.whiteFlash = 0.3;
      showBanner('🏆 ¡JEFE DERROTADO!', '', '#fde047', 2.2);
      Sfx.play('boom');
      for (const o of st.enemies) if (!o.dead && o !== e) { o.dead = true; o.deathT = 0.45; burst(o.x, o.y - 20, '#fff', 8, 100); }
      st.queue = [];
    }
  }

  function breakProp(pr) {
    pr.dead = true;
    burst(pr.x, pr.y - 10, pr.color || '#a16207', 16, 140);
    Sfx.play('hit');
    const r = Math.random();
    if (r < 0.45) spawnDrop(pr.x, pr.y, { coins: Math.max(1, Math.round(st.info.coins * rand(1, 2))) });
    else if (r < 0.75) spawnDrop(pr.x, pr.y, { heart: true });
    else spawnDrop(pr.x, pr.y, { mat: rollMaterial(), qty: 1 });
  }

  /* ---------- Botín ---------- */
  function spawnDrop(x, y, what) {
    const color = what.coins ? '#fde047' : what.heart ? '#ef4444' : RARITIES[MATERIALS[what.mat].rarity].color;
    st.drops.push(Object.assign({ x, y, z: 12, vx: rand(-70, 70), vy: rand(-30, 30), vz: rand(150, 230), t: 0, color }, what));
  }

  function collectDrop(d) {
    d.done = true;
    const p = st.p;
    // Los textos de recogida se apilan para no taparse
    st.pickStack = st.pickT > 0 ? (st.pickStack || 0) + 1 : 0;
    st.pickT = 0.35;
    const fy = p.y - 70 - (st.pickStack % 4) * 13;
    if (d.coins) {
      st.loot.coins += d.coins;
      addFloat(p.x, fy, `+${d.coins} oro`, '#fde047', 13);
      Sfx.play('coin');
    } else if (d.heart) {
      heal(p.maxHp * 0.12);
      Sfx.play('potion');
    } else {
      st.loot.mats[d.mat] = (st.loot.mats[d.mat] || 0) + d.qty;
      addFloat(p.x, fy, `+${d.qty} ${MATERIALS[d.mat].name}`, d.color, 13);
      Sfx.play('pickup');
    }
    burst(p.x, p.y - 30, d.color, 6, 70);
  }
  function collectAllDrops() { for (const d of st.drops) if (!d.done && !d.heart) collectDrop(d); st.drops = []; }

  function updateDrops(dt) {
    const p = st.p;
    for (const d of st.drops) {
      d.t += dt;
      if (d.z > 0 || d.vz > 0) {
        d.vz -= 700 * dt; d.z += d.vz * dt;
        if (d.z <= 0) { d.z = 0; d.vz = Math.abs(d.vz) > 60 ? -d.vz * 0.35 : 0; }
      }
      d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= Math.pow(0.05, dt); d.vy *= Math.pow(0.05, dt);
      d.y = clamp(d.y, fieldTop(), fieldBot()); d.x = clamp(d.x, 8, W - 8);
      const dist = gdist(d.x, d.y, p.x, p.y);
      // Monedas y materiales vuelan solos al jugador; los corazones hay que recogerlos
      const magnet = d.heart ? 34 : (d.t > 0.7 ? 9999 : 40);
      if (dist < magnet && p.hp > 0) {
        const k = Math.min(1, dt * (8 + d.t * 6));
        d.x += (p.x - d.x) * k; d.y += (p.y - d.y) * k;
        if (dist < 12) collectDrop(d);
      }
      if (d.heart && d.t > 12) d.done = true;
    }
    st.drops = st.drops.filter(d => !d.done);
  }

  /* ---------- Proyectiles ---------- */
  function updateProjectiles(dt) {
    const p = st.p;
    for (const pr of st.projs) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if ((pr.kind === 'bigfire' || pr.kind === 'fireball') && st.parts.length < 450) st.parts.push({ x: pr.x, y: pr.y - (pr.h || 24), vx: rand(-20, 20), vy: rand(-40, 0), life: 0.3, max: 0.3, color: '#fb923c', size: rand(2, 5), grav: 0 });
      if (pr.hostile) {
        if (gdist(pr.x, pr.y, p.x, p.y) < 14) { if (hurtPlayer(pr.dmg, pr.boss)) { pr.life = 0; burst(pr.x, pr.y - 24, '#fca5a5', 6, 80); } }
      } else {
        for (const e of st.enemies) {
          if (e.dead) continue;
          if (Math.abs(pr.x - e.x) < e.size * 0.45 && Math.abs(pr.y - e.y) < DEPTH) {
            if (pr.explode) explode(pr); else damageEnemy(e, pr.dmg, { color: '#93c5fd' });
            pr.life = 0;
            break;
          }
        }
        if (pr.life <= 0 && pr.explode && !pr.exploded) explode(pr);
      }
      if (pr.x < -40 || pr.x > W + 40 || pr.y < fieldTop() - 20 || pr.y > H + 10) pr.life = 0;
    }
    st.projs = st.projs.filter(pr => pr.life > 0);
  }

  function explode(pr) {
    pr.exploded = true;
    st.rings.push({ x: pr.x, y: pr.y, r: 8, max: pr.explode, t: 0.35, life: 0.35, color: '#fb923c' });
    burst(pr.x, pr.y - 20, '#f97316', 26, 200);
    burst(pr.x, pr.y - 20, '#fde047', 12, 140);
    st.shake = Math.max(st.shake, 7);
    Sfx.play('boom');
    for (const e of st.enemies) {
      if (e.dead || gdist(e.x, e.y, pr.x, pr.y) > pr.explode + e.size * 0.3) continue;
      const resist = e.def.resist === 'fuego';
      damageEnemy(e, pr.dmg * (resist ? 0.5 : 1), { color: '#fdba74', knock: 20 });
      if (!e.dead && !resist) e.burn = pr.burn;
      if (resist && !e.dead) addFloat(e.x, e.y - e.size - 22, 'Resiste', '#fdba74', 12);
    }
    for (const prop of st.props) if (!prop.dead && gdist(prop.x, prop.y, pr.x, pr.y) < pr.explode) breakProp(prop);
  }

  /* ---------- Efectos ---------- */
  function burst(x, y, color, n, speed, vyBias = -40) {
    for (let i = 0; i < n && st.parts.length < 500; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(0.3, 1) * speed;
      st.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + vyBias, life: rand(0.3, 0.6), max: 0.6, color, size: rand(2, 4.5), grav: 400 });
    }
  }
  function addFloat(x, y, text, color, size) {
    const half = Math.min(W / 2 - 4, text.length * size * 0.3);
    st.floats.push({ x: clamp(x, half + 4, W - half - 4), y, text, color, size, t: 0, life: 0.9 });
  }
  function showBanner(text, sub, color, life = 1.8) { st.banner = { text, sub, color, t: 0, life }; }

  function newAmbient(initial) {
    const kind = Sprites.THEMES[st.world.theme].particle;
    const a = { kind, x: Math.random() * W, y: initial ? Math.random() * H : -10, s: rand(1, 3), ph: Math.random() * 6 };
    if (kind === 'ember') a.y = initial ? Math.random() * H : H + 5;
    if (kind === 'sand') a.x = initial ? Math.random() * W : -10;
    return a;
  }

  function updateFx(dt) {
    for (const pt of st.parts) { pt.vy += pt.grav * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
    st.parts = st.parts.filter(pt => pt.life > 0);
    for (const f of st.floats) { f.t += dt; f.y -= 34 * dt; }
    st.floats = st.floats.filter(f => f.t < f.life);
    for (const b of st.bolts) b.t -= dt;
    st.bolts = st.bolts.filter(b => b.t > 0);
    for (const r of st.rings) { r.t -= dt; r.r = r.max * (1 - r.t / r.life); }
    st.rings = st.rings.filter(r => r.t > 0);
    for (const g of st.ghosts) g.t -= dt;
    st.ghosts = st.ghosts.filter(g => g.t > 0);
    for (const pr of st.props) pr.flash -= dt;
    st.props = st.props.filter(pr => !pr.dead);
    if (st.banner) { st.banner.t += dt; if (st.banner.t > st.banner.life) st.banner = null; }
    st.shake = Math.max(0, st.shake - dt * 22);
    st.hurtFlash -= dt; st.whiteFlash -= dt; st.comboPop -= dt;
    for (const a of st.ambient) {
      a.ph += dt;
      if (a.kind === 'leaf') { a.y += 22 * dt * a.s * 0.6; a.x += Math.sin(a.ph * 2) * 20 * dt; }
      else if (a.kind === 'snow') { a.y += 30 * dt * a.s * 0.5; a.x += Math.sin(a.ph) * 12 * dt; }
      else if (a.kind === 'sand') { a.x += 140 * dt * a.s * 0.5; a.y += Math.sin(a.ph * 3) * 10 * dt; }
      else if (a.kind === 'ember') { a.y -= 34 * dt * a.s * 0.5; a.x += Math.sin(a.ph * 2) * 14 * dt; }
      else { a.x += Math.sin(a.ph) * 10 * dt; a.y += Math.cos(a.ph * 0.7) * 8 * dt; }
      if (a.y > H + 10 || a.y < -20 || a.x > W + 20 || a.x < -20) Object.assign(a, newAmbient(false));
    }
  }

  /* ---------- Dibujo ---------- */
  const AMBIENT_COLORS = { leaf: ['#84cc16', '#facc15', '#65a30d'], snow: ['#ffffff'], sand: ['#fde68a', '#fcd34d'], ember: ['#fb923c', '#fde047', '#ef4444'], mote: ['#c084fc', '#a855f7', '#e9d5ff'] };
  const PROJ_COLORS = { fireball: '#f97316', bigfire: '#f97316', darkorb: '#a855f7', poison: '#84cc16', ice: '#7dd3fc' };

  function draw() {
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.save();
    if (st.shake > 0) c.translate(rand(-1, 1) * st.shake, rand(-1, 1) * st.shake);
    c.drawImage(bg, -8, -8, W + 16, H + 16);
    if (st.world.theme === 'volcan') { c.fillStyle = `rgba(249,115,22,${0.05 + Math.sin(st.time * 2) * 0.04})`; c.fillRect(0, 0, W, H); }

    drawZones(c);
    // Líneas de aviso de embestida
    for (const l of st.lines) {
      const e = l.e;
      const a = 0.5 + Math.sin(st.time * 20) * 0.25, ang = Math.atan2(e.ty - e.y, e.tx - e.x);
      c.strokeStyle = `rgba(239,68,68,${a})`; c.lineWidth = Math.max(8, e.size * 0.3); c.lineCap = 'round';
      c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.tx, e.ty); c.stroke();
      c.fillStyle = `rgba(254,202,202,${a})`;
      c.save(); c.translate(e.tx, e.ty); c.rotate(ang);
      c.beginPath(); c.moveTo(10, 0); c.lineTo(-8, -9); c.lineTo(-8, 9); c.closePath(); c.fill();
      c.restore();
    }

    // Todo lo que está sobre el suelo se ordena por profundidad (y)
    const items = [];
    for (const pr of st.props) items.push({ y: pr.y, f: () => Sprites.prop(c, pr, st.time) });
    for (const d of st.drops) items.push({ y: d.y, f: () => drawDrop(c, d) });
    for (const e of st.enemies) items.push({ y: e.y, f: () => drawEnemy(c, e) });
    for (const pr of st.projs) items.push({ y: pr.y, f: () => drawProjectile(c, pr) });
    for (const g of st.ghosts) items.push({ y: g.y - 0.1, f: () => drawKnight(c, g.x, g.y, g.face, Math.max(0, g.t / 0.25) * 0.35) });
    items.push({ y: st.p.y, f: () => drawPlayer(c) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.f();

    // Rayos
    for (const b of st.bolts) {
      c.strokeStyle = '#fef9c3'; c.lineWidth = 3; c.shadowColor = '#fde047'; c.shadowBlur = 14;
      c.beginPath(); c.moveTo(b.x + rand(-20, 20), 0);
      for (let i = 1; i <= 8; i++) c.lineTo(b.x + (i < 8 ? rand(-14, 14) : 0), b.y * i / 8);
      c.stroke(); c.shadowBlur = 0;
    }
    for (const r of st.rings) {
      c.strokeStyle = r.color; c.globalAlpha = Math.max(0, r.t / r.life); c.lineWidth = 5;
      c.beginPath(); c.ellipse(r.x, r.y, r.r, r.r * 0.5, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
    }
    for (const pt of st.parts) {
      c.globalAlpha = Math.max(0, pt.life / pt.max);
      c.fillStyle = pt.color;
      c.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    c.globalAlpha = 1;
    for (const a of st.ambient) {
      const cols = AMBIENT_COLORS[a.kind];
      c.fillStyle = cols[Math.floor(a.ph * 10 + a.s) % cols.length];
      c.globalAlpha = a.kind === 'mote' ? 0.4 + Math.sin(a.ph * 3) * 0.3 : 0.75;
      if (a.kind === 'leaf') { c.save(); c.translate(a.x, a.y); c.rotate(a.ph); c.fillRect(-3, -1.5, 6, 3); c.restore(); }
      else { c.beginPath(); c.arc(a.x, a.y, a.s * (a.kind === 'sand' ? 0.6 : 1), 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1;
    // Números flotantes
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const f of st.floats) {
      const k = f.t / f.life, sc = f.t < 0.12 ? 1 + (0.12 - f.t) * 4 : 1;
      c.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      c.font = `900 ${Math.round(f.size * sc)}px system-ui, sans-serif`;
      c.lineWidth = 3.5; c.strokeStyle = '#1a0b00';
      c.strokeText(f.text, f.x, f.y); c.fillStyle = f.color; c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
    c.restore();

    if (st.hurtFlash > 0) {
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.8);
      g.addColorStop(0, 'rgba(220,38,38,0)'); g.addColorStop(1, `rgba(220,38,38,${st.hurtFlash})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    if (st.whiteFlash > 0) { c.fillStyle = `rgba(255,255,255,${st.whiteFlash * 1.5})`; c.fillRect(0, 0, W, H); }
    if (st.p.hp > 0 && st.p.hp < st.p.maxHp * 0.25) {
      c.strokeStyle = `rgba(239,68,68,${0.35 + Math.sin(st.time * 6) * 0.2})`; c.lineWidth = 8; c.strokeRect(0, 0, W, H);
    }
    drawCombo(c);
    drawBanner(c);
  }

  /** Silueta translúcida del caballero (estela al esquivar). */
  function drawKnight(c, x, y, face, alpha) {
    const S = Game.S;
    c.globalAlpha = alpha;
    Sprites.knight(c, x, y, 1.0, { face, walk: 0, swing: -1, heavy: false, time: st.time,
      weaponColor: ITEMS[S.equip.weapon].color, armorColor: ITEMS[S.equip.armor].color, flash: false, helmet: S.settings.helmet, rank: Game.rank() });
    c.globalAlpha = 1;
  }

  function drawPlayer(c) {
    const p = st.p, S = Game.S;
    // Indicador bajo los pies
    c.strokeStyle = 'rgba(96,165,250,.55)'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(p.x, p.y + 1, 18, 6, 0, 0, Math.PI * 2); c.stroke();
    if (p.hp <= 0) { c.save(); c.translate(p.x, p.y); c.rotate(-Math.PI / 2 * p.face); c.translate(-p.x, -p.y); c.globalAlpha = 0.7; }
    // Parpadea (semitransparente) mientras es invulnerable tras recibir daño
    if (p.invuln > 0 && p.dodgeT <= 0 && p.hp > 0 && Math.floor(st.time * 20) % 2 === 0) c.globalAlpha = 0.45;
    Sprites.knight(c, p.x, p.y, 1.0, { face: p.face, walk: p.walk, swing: p.swing, heavy: p.heavy, style: p.style, time: st.time,
      weaponColor: ITEMS[S.equip.weapon].color, armorColor: ITEMS[S.equip.armor].color, flash: p.flash > 0, helmet: S.settings.helmet, rank: Game.rank() });
    c.globalAlpha = 1;
    if (p.hp <= 0) { c.restore(); c.globalAlpha = 1; }
  }

  function drawEnemy(c, e) {
    if (e.dead) {
      c.globalAlpha = Math.max(0, e.deathT / 0.45);
      c.save(); c.translate(e.x, e.y); c.scale(1, Math.max(0.1, e.deathT / 0.45)); c.translate(-e.x, -e.y);
      Sprites.enemy(c, e, st.time);
      c.restore(); c.globalAlpha = 1;
      return;
    }
    if (e.action && e.action.kind === 'leap' && e.action.t < 0.55) {
      c.save(); c.translate(e.x, e.y); c.scale(1.1, 0.85); c.translate(-e.x, -e.y); Sprites.enemy(c, e, st.time); c.restore();
    } else Sprites.enemy(c, e, st.time);
    const z = e.z || 0;
    if (e.windup > 0 || e.state === 'aim' || (e.action && e.action.t < 0.6)) {
      c.font = 'bold 18px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ef4444'; c.strokeStyle = '#000'; c.lineWidth = 3;
      c.strokeText('!', e.x, e.y - e.size - 18 - z); c.fillText('!', e.x, e.y - e.size - 18 - z);
    }
    if (!e.boss && e.hp < e.maxHp) {
      const w = Math.max(24, e.size * 0.8), x = e.x - w / 2, y = e.y - e.size - 8 - z;
      c.fillStyle = '#000a'; c.fillRect(x - 1, y - 1, w + 2, 6);
      c.fillStyle = e.elite ? '#facc15' : '#ef4444'; c.fillRect(x, y, w * e.hp / e.maxHp, 4);
    }
  }

  function drawDrop(c, d) {
    const y = d.y - 8 - d.z;
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath(); c.ellipse(d.x, d.y, 5, 2, 0, 0, Math.PI * 2); c.fill();
    if (d.coins) Sprites.coin(c, d.x, y, st.time + d.x);
    else if (d.heart) Sprites.heart(c, d.x, y + Math.sin(st.time * 4) * 2, st.time);
    else Sprites.gem(c, d.x, y, d.color, st.time);
  }

  function drawZones(c) {
    for (const z of st.zones) {
      if (z.t > 0) {
        const k = 1 - z.t / z.total;
        c.fillStyle = `rgba(239,68,68,${0.14 + 0.12 * k})`;
        c.beginPath(); c.ellipse(z.x, z.y, z.r, z.r * 0.5, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = `rgba(254,202,202,${0.5 + Math.sin(st.time * 18) * 0.3})`; c.lineWidth = 2; c.stroke();
        c.fillStyle = 'rgba(239,68,68,.35)';
        c.beginPath(); c.ellipse(z.x, z.y, z.r * k, z.r * 0.5 * k, 0, 0, Math.PI * 2); c.fill();
        if (z.fall && z.t < 0.6) {
          // Proyectil que cae sobre la zona
          const fk = 1 - z.t / 0.6, col = FX_COLORS[z.fx] || '#f97316';
          const fy = -20 + (z.y + 20) * fk;
          c.fillStyle = col + '66'; c.beginPath(); c.arc(z.x, fy, 11, 0, Math.PI * 2); c.fill();
          c.fillStyle = col; c.beginPath(); c.arc(z.x, fy, 6, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#fff8'; c.beginPath(); c.arc(z.x - 2, fy - 2, 2, 0, Math.PI * 2); c.fill();
        }
      } else {
        const k = z.boom / 0.45, col = FX_COLORS[z.fx] || '#fde68a';
        c.globalAlpha = k;
        if (z.fx === 'ice') {
          c.fillStyle = '#e0f2fe';
          for (let i = -2; i <= 2; i++) { const x = z.x + i * z.r * 0.35, h = (46 - Math.abs(i) * 11) * Math.min(1, (1 - k) * 4 + 0.3); c.beginPath(); c.moveTo(x - 7, z.y + 2); c.lineTo(x, z.y - h); c.lineTo(x + 7, z.y + 2); c.fill(); }
        } else if (z.fx === 'dark') {
          const g = c.createLinearGradient(0, 0, 0, z.y);
          g.addColorStop(0, 'rgba(168,85,247,0)'); g.addColorStop(1, 'rgba(168,85,247,.9)');
          c.fillStyle = g; c.fillRect(z.x - z.r * 0.5, 0, z.r, z.y + 4);
        } else {
          c.fillStyle = col;
          c.beginPath(); c.ellipse(z.x, z.y - 2, z.r * (1.2 - k * 0.3), z.r * 0.55 * (1.2 - k * 0.3), 0, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
      }
    }
  }

  function drawProjectile(c, pr) {
    const h = pr.h || 26;
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath(); c.ellipse(pr.x, pr.y, 6, 2.5, 0, 0, Math.PI * 2); c.fill();
    c.save();
    c.translate(pr.x, pr.y - h);
    if (pr.kind === 'arrow') {
      c.rotate(Math.atan2(pr.vy, pr.vx));
      c.strokeStyle = pr.hostile ? '#78350f' : '#93c5fd'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-12, 0); c.lineTo(8, 0); c.stroke();
      c.fillStyle = '#d4d4d8'; c.beginPath(); c.moveTo(8, -3); c.lineTo(13, 0); c.lineTo(8, 3); c.fill();
    } else {
      const big = pr.kind === 'bigfire';
      const col = pr.hostile || big ? (PROJ_COLORS[pr.kind] || '#a855f7') : '#93c5fd';
      const r = big ? 11 : 6;
      c.fillStyle = col + '66';
      c.beginPath(); c.arc(0, 0, r * 1.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = col;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff88'; c.beginPath(); c.arc(-r * 0.3, -r * 0.3, r * 0.4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function drawCombo(c) {
    if (st.combo < 2) return;
    const pop = st.comboPop > 0 ? 1 + st.comboPop * 2.2 : 1;
    const fade = Math.min(1, st.comboT / 0.4);
    const col = st.combo >= 20 ? '#f43f5e' : st.combo >= 10 ? '#fb923c' : st.combo >= 5 ? '#fde047' : '#fef3c7';
    c.save();
    c.globalAlpha = fade;
    c.translate(W - 16, HY + 20);
    c.save(); c.scale(pop, pop);
    c.textAlign = 'right'; c.textBaseline = 'middle';
    c.font = '900 30px "Cinzel", Georgia, serif';
    c.lineWidth = 5; c.strokeStyle = '#1a0b00';
    c.strokeText(`x${st.combo}`, 0, 0); c.fillStyle = col; c.fillText(`x${st.combo}`, 0, 0);
    c.font = '800 11px system-ui, sans-serif'; c.lineWidth = 3;
    c.strokeText('COMBO', 0, 20); c.fillStyle = '#fff'; c.fillText('COMBO', 0, 20);
    c.restore();
    // Barra del tiempo que queda para mantener el combo
    const w = 58, k = Math.max(0, st.comboT / COMBO_WINDOW);
    c.fillStyle = '#0009'; c.fillRect(-w, 30, w, 5);
    c.fillStyle = col; c.fillRect(-w, 30, w * k, 5);
    // Próximo premio de combo
    const next = Object.keys(COMBO_REWARDS).map(Number).find(n => n > st.combo);
    if (next) {
      c.textAlign = 'right'; c.font = '700 10px system-ui, sans-serif'; c.lineWidth = 3; c.strokeStyle = '#1a0b00';
      c.strokeText(`🎁 x${next}`, 0, 44); c.fillStyle = '#fde68a'; c.fillText(`🎁 x${next}`, 0, 44);
    }
    c.restore();
  }

  function drawBanner(c) {
    const b = st.banner;
    if (!b) return;
    const inK = Math.min(1, b.t / 0.25), outK = Math.min(1, (b.life - b.t) / 0.35);
    c.globalAlpha = Math.min(inK, outK);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const y0 = HY + (H - HY) * 0.28;
    if (b.text) {
      c.font = '900 34px "Cinzel", Georgia, serif';
      const fit = Math.min(1, (W * 0.92) / c.measureText(b.text).width);
      const sc = (0.7 + 0.3 * inK) * fit;
      c.save(); c.translate(W / 2, y0); c.scale(sc, sc);
      c.lineWidth = 6; c.strokeStyle = '#1a0b00'; c.strokeText(b.text, 0, 0);
      c.fillStyle = b.color; c.fillText(b.text, 0, 0);
      c.restore();
    }
    if (b.sub) {
      c.font = '700 15px system-ui, sans-serif';
      const fit = Math.min(1, (W * 0.94) / c.measureText(b.sub).width);
      c.save(); c.translate(W / 2, y0 + (b.text ? 34 : 0)); c.scale(fit, fit);
      c.lineWidth = 4; c.strokeStyle = '#1a0b00'; c.strokeText(b.sub, 0, 0);
      c.fillStyle = b.text ? '#fff' : (b.color || '#fff'); c.fillText(b.sub, 0, 0);
      c.restore();
    }
    c.globalAlpha = 1;
  }

  /* ---------- HUD (DOM) ---------- */
  const lastHud = {};
  function setText(el, key, v) { if (el && lastHud[key] !== v) { lastHud[key] = v; el.textContent = v; } }
  function setWidth(el, key, pct) { const v = Math.round(pct * 1000) / 10; if (el && lastHud[key] !== v) { lastHud[key] = v; el.style.width = v + '%'; } }

  function updateHud(force) {
    if (!st) return;
    if (force) for (const k in lastHud) delete lastHud[k];
    const p = st.p, S = Game.S;
    setWidth(H_.hpFill, 'hp', p.hp / p.maxHp);
    setText(H_.hpText, 'hpt', `${Math.ceil(p.hp)} / ${p.maxHp}`);
    setText(H_.stage, 'stage', `${st.world.icon} Etapa ${st.stage} · ${st.info.name}`);
    const normalWaves = st.waves.filter(w => !ENEMIES[w[0]].boss).length;
    const wave = Math.min(normalWaves, Math.max(1, st.waveIdx + 1));
    setText(H_.prog, 'prog', st.boss ? '👹 JEFE' : `🌊 ${wave}/${normalWaves} · ☠️ ${st.killed}/${st.total - (st.info.boss ? 1 : 0)}`);
    setText(H_.coins, 'coins', `🪙 ${st.loot.coins}`);
    setText(H_.mats, 'mats', `📦 ${Object.values(st.loot.mats).reduce((a, b) => a + b, 0)}`);
    const b = st.boss;
    const showBoss = !!b && !b.dead;
    if (lastHud.boss !== showBoss) { lastHud.boss = showBoss; H_.bossBar.hidden = !showBoss; }
    if (showBoss) {
      setText(H_.bossName, 'bn', `${b.def.name}${b.enraged ? ' (furia)' : ''}`);
      setWidth(H_.bossFill, 'bf', b.hp / b.maxHp);
    }
    setText(H_.potion, 'pot', String((S.potions.pocion || 0) + (S.potions.pocion_grande || 0)));
    const cdBtn = (el, key, cd, max, locked) => {
      if (!el) return;
      const v = locked ? 100 : Math.round(Math.max(0, cd) / max * 100);
      if (lastHud[key] !== v) {
        lastHud[key] = v;
        el.style.setProperty('--cd', v + '%');
        el.classList.toggle('ready', !locked && cd <= 0);
        const t = el.querySelector('.cdtext');
        if (t) t.textContent = locked ? '🔒' : (cd > 0 ? Math.ceil(cd) : '');
      }
    };
    for (const id of SKILL_ORDER) {
      const lvl = skillLevel(id);
      cdBtn(document.querySelector(`[data-skill="${id}"]`), 'sk' + id, st.cds[id] || 0, lvl ? skillCd(id) : 1, !lvl);
    }
    cdBtn(H_.dodge, 'dodge', p.dodgeCd, 0.75, false);
  }

  /* ---------- Fin ---------- */
  function finish() {
    const result = {
      victory: st.victory, abandoned: !!st.abandoned, stage: st.stage, boss: st.info.boss, loot: st.loot,
      specialDrop: st.specialDrop, killed: st.killed, kills: st.kills, maxCombo: st.maxCombo, elites: st.elites,
    };
    stop();
    if (onEnd) onEnd(result);
  }

  function abandon() {
    if (!st) return;
    st.victory = false; st.abandoned = true;
    collectAllDrops();
    finish();
  }

  return {
    init, start, stop, abandon, castSkill, usePotion, dodge,
    setInput(k, v) { keys[k] = v; },
    setStick(x, y, active) { stick.x = x; stick.y = y; stick.active = active; },
    pause() { paused = true; resetInput(); },
    resume() { paused = false; lastT = performance.now(); },
    get active() { return !!st; },
    get paused() { return paused; },
    skillLevel, skillCd,
    /** Solo para pruebas automáticas: estado de la partida en curso. */
    get debugState() { return st; },
  };
})();
