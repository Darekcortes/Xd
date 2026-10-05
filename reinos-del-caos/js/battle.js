'use strict';
/* =====================================================================
   COMBATE — bucle del juego, enemigos, jefes, habilidades y botín
   Coordenadas lógicas fijas (W x H); el canvas se escala a la pantalla.
   ===================================================================== */
const Battle = (() => {
  // Tamaño lógico del escenario: el ancho base es 480 y el alto se adapta a la
  // pantalla (más cielo en celulares verticales). G es la línea del suelo.
  let W = 480, H = 320, G = 262;
  const PLAYER_SPEED = 145, PLAYER_REACH = 54;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  let cv, ctx, dpr = 1, bg = null;
  let st = null, raf = 0, lastT = 0, onEnd = null, paused = false, hudT = 0;
  const input = { left: false, right: false, attack: false };
  const $ = id => document.getElementById(id);
  let H_ = {};

  /* ---------- Inicialización ---------- */
  function init() {
    cv = $('arena');
    ctx = cv.getContext('2d');
    H_ = {
      hpFill: $('b-hp-fill'), hpText: $('b-hp-text'), stage: $('b-stage'), prog: $('b-progress'),
      coins: $('b-coins'), mats: $('b-mats'), bossBar: $('b-boss'), bossName: $('b-boss-name'),
      bossFill: $('b-boss-fill'), potion: $('b-potion-count'),
    };
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const inner = cv.parentElement, box = inner.parentElement.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) {
      // ~1 unidad lógica por píxel en celulares para que los personajes se vean grandes
      const aspect = box.width / box.height;
      W = Math.round(clamp(box.width, 360, 540));
      H = Math.round(W / aspect);
      if (H < 300) { H = 300; W = Math.round(H * aspect); }
      H = Math.min(H, Math.round(W * 1.25));
    }
    G = H - 58;
    cv.width = W * dpr; cv.height = H * dpr;
    // Si el alto quedó limitado, el canvas conserva su proporción dentro del hueco
    inner.style.aspectRatio = `${W} / ${H}`;
    if (st) {
      bg = Sprites.background(st.world.theme, W, H, G, dpr);
      st.p.x = clamp(st.p.x, 18, W - 18);
      for (const e of st.enemies) if (!e.action) e.y = G;
      st.p.y = G;
    }
  }

  /* ---------- Inicio de etapa ---------- */
  function start(stage, cb) {
    const info = stageInfo(stage);
    const P = Game.stats();
    onEnd = cb;
    resize();
    const pool = info.world.enemies;
    const queue = [];
    const n = info.boss ? 5 : info.enemyCount;
    for (let i = 0; i < n; i++) queue.push(pool[Math.floor(Math.random() * pool.length)]);
    if (info.boss) queue.push(info.world.boss);
    st = {
      info, world: info.world, stage, time: 0,
      p: { x: Math.round(W * 0.28), y: G, hp: P.maxHp, maxHp: P.maxHp, dmg: P.dmg, def: P.def, spd: P.spd, crit: P.crit,
           face: 1, atkT: 0, swing: -1, heavy: false, walk: 0, flash: 0, invuln: 0, combo: 0, comboT: 0 },
      enemies: [], projs: [], zones: [], parts: [], floats: [], drops: [], bolts: [], rings: [], ambient: [],
      queue, total: queue.length, killed: 0, spawnT: 0.9, maxAlive: info.boss ? 3 : info.maxAlive,
      loot: { mats: {}, coins: 0, xp: 0 }, cds: {}, potionT: 0,
      shake: 0, hurtFlash: 0, whiteFlash: 0, slowT: 0,
      ended: false, endT: 0, victory: false, boss: null, bossDefeated: false, specialDrop: null, banner: null,
    };
    bg = Sprites.background(info.world.theme, W, H, G, dpr);
    for (let i = 0; i < 28; i++) st.ambient.push(newAmbient(true));
    showBanner(`Etapa ${stage}`, info.name, '#fde68a');
    resetInput();
    paused = false;
    cancelAnimationFrame(raf);
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
    updateHud(true);
  }

  function stop() { cancelAnimationFrame(raf); raf = 0; st = null; }
  function resetInput() { input.left = input.right = input.attack = false; }

  /* ---------- Bucle principal ---------- */
  function loop(t) {
    raf = requestAnimationFrame(loop);
    let dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (!st || paused) return;
    if (st.slowT > 0) { st.slowT -= dt; dt *= 0.35; }
    update(dt);
    if (!st) return;          // la etapa terminó durante este frame
    draw();
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.06; updateHud(); }
  }

  function update(dt) {
    st.time += dt;
    updatePlayer(dt);
    updateSpawns(dt);
    for (const e of st.enemies) updateEnemy(e, dt);
    separateEnemies();
    st.enemies = st.enemies.filter(e => !(e.dead && e.deathT <= 0));
    updateProjectiles(dt);
    updateZones(dt);
    updateDrops(dt);
    updateFx(dt);
    for (const k in st.cds) st.cds[k] -= dt;
    st.potionT -= dt;

    // ¿Fin de la etapa?
    if (!st.ended) {
      if (st.p.hp <= 0) {
        st.ended = true; st.victory = false; st.endT = 1.6;
        showBanner('HAS CAÍDO', 'Conservas la mitad del botín', '#f87171');
        Sfx.play('lose');
      } else if (st.queue.length === 0 && st.enemies.every(e => e.dead)) {
        st.ended = true; st.victory = true; st.endT = st.info.boss ? 2.4 : 1.4;
        if (!st.info.boss) showBanner('¡ETAPA COMPLETADA!', '', '#86efac');
        Sfx.play('win');
      }
    } else {
      st.endT -= dt;
      if (st.endT <= 0.5) collectAllDrops();
      if (st.endT <= 0) finish();
    }
  }

  /* ---------- Jugador ---------- */
  function updatePlayer(dt) {
    const p = st.p;
    const dir = st.ended ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir && p.hp > 0) {
      p.x = clamp(p.x + dir * PLAYER_SPEED * dt, 18, W - 18);
      if (p.swing < 0) p.face = dir;
      p.walk += dt * 13;
    } else p.walk = 0;
    p.atkT -= dt; p.flash -= dt; p.invuln -= dt; p.comboT -= dt;
    if (p.swing >= 0) { p.swing += dt / 0.26; if (p.swing >= 1) p.swing = -1; }
    if (input.attack && p.atkT <= 0 && !st.ended && p.hp > 0) attack();
  }

  function nearestEnemy(x, maxDist) {
    let best = null, bd = maxDist;
    for (const e of st.enemies) {
      if (e.dead) continue;
      const d = Math.abs(e.x - x);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function attack() {
    const p = st.p;
    p.atkT = 1 / p.spd;
    p.combo = p.comboT > 0 ? p.combo + 1 : 1;
    p.comboT = 1 / p.spd + 0.6;
    const heavy = p.combo % 3 === 0;
    const near = nearestEnemy(p.x, 170);
    if (near) p.face = Math.sign(near.x - p.x) || p.face;
    p.swing = 0; p.heavy = heavy;
    Sfx.play('swing');
    const reach = PLAYER_REACH + (heavy ? 16 : 0);
    let hit = false;
    for (const e of st.enemies) {
      if (e.dead) continue;
      const dx = (e.x - p.x) * p.face;
      if (dx > -16 && dx < reach + e.size * 0.4 && e.y > G - 40) {
        damageEnemy(e, p.dmg * (heavy ? 1.6 : 1), { knock: heavy ? 26 : 10, canCrit: true });
        hit = true;
      }
    }
    // Los golpes desvían proyectiles enemigos
    for (const pr of st.projs) {
      if (!pr.hostile) continue;
      const dx = (pr.x - p.x) * p.face;
      if (dx > -12 && dx < reach + 14 && Math.abs(pr.y - (G - 28)) < 40) {
        pr.hostile = false; pr.vx = -pr.vx * 1.3; pr.dmg = p.dmg * 1.5;
        addFloat(pr.x, pr.y - 12, '¡BLOQUEO!', '#93c5fd', 13);
        Sfx.play('deflect');
      }
    }
    if (heavy && hit) st.shake = Math.max(st.shake, 5);
  }

  function hurtPlayer(amount) {
    const p = st.p;
    if (p.invuln > 0 || st.ended || p.hp <= 0) return;
    const dmg = Math.max(1, Math.round(amount * rand(0.9, 1.1) * 100 / (100 + p.def)));
    p.hp = Math.max(0, p.hp - dmg);
    p.flash = 0.18; p.invuln = 0.3;
    burst(p.x + p.face * 6, p.y - 32, '#ef4444', 10, 130);
    addFloat(p.x, p.y - 58, `-${dmg}`, '#f87171', 17);
    st.shake = Math.max(st.shake, 5);
    st.hurtFlash = 0.3;
    Sfx.play('hurt');
    UI.vibrate(35);
  }

  /* ---------- Habilidades ---------- */
  const skillLevel = id => Game.S.skills[id] || 0;
  const skillMult = id => SKILLS[id].mult * (1 + 0.2 * (skillLevel(id) - 1));
  const skillCd = id => SKILLS[id].cd * (1 - 0.05 * (skillLevel(id) - 1));

  function castSkill(id) {
    if (!st || st.ended || paused || st.p.hp <= 0 || !skillLevel(id) || (st.cds[id] || 0) > 0) return;
    const p = st.p;
    st.cds[id] = skillCd(id);
    const near = nearestEnemy(p.x, 400);
    if (near) p.face = Math.sign(near.x - p.x) || p.face;
    p.swing = 0; p.heavy = true;
    if (id === 'fuego') {
      st.projs.push({ x: p.x + p.face * 22, y: G - 30, vx: p.face * 330, vy: 0, hostile: false, kind: 'bigfire',
                      dmg: p.dmg * skillMult('fuego'), life: 1.3, explode: 72, burn: 3 });
      Sfx.play('fire');
    } else if (id === 'hielo') {
      st.rings.push({ x: p.x, y: G - 20, r: 10, max: W, t: 0.6, life: 0.6, color: '#bae6fd' });
      const freeze = SKILLS.hielo.freeze + 0.3 * (skillLevel('hielo') - 1);
      for (const e of st.enemies) {
        if (e.dead) continue;
        damageEnemy(e, p.dmg * skillMult('hielo'), { color: '#bae6fd' });
        e.frozen = e.boss ? 1.4 : freeze;
        burst(e.x, e.y - e.size / 2, '#e0f2fe', 10, 120);
      }
      Sfx.play('ice');
    } else if (id === 'rayo') {
      const targets = st.enemies.filter(e => !e.dead).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x)).slice(0, SKILLS.rayo.targets);
      for (const e of targets) {
        st.bolts.push({ x: e.x, y: e.y - e.size * 0.5, t: 0.35, seed: Math.random() * 100 });
        damageEnemy(e, p.dmg * skillMult('rayo'), { color: '#fde047' });
      }
      if (!targets.length) st.bolts.push({ x: p.x + p.face * 80, y: G, t: 0.35, seed: 1 });
      st.whiteFlash = 0.18; st.shake = Math.max(st.shake, 6);
      Sfx.play('thunder');
    }
  }

  function usePotion() {
    if (!st || st.ended || paused || st.potionT > 0 || st.p.hp <= 0) return;
    const p = st.p, S = Game.S;
    const missing = 1 - p.hp / p.maxHp;
    if (missing < 0.03) { addFloat(p.x, p.y - 60, 'Vida llena', '#d1fae5', 13); return; }
    let id = null;
    if (S.potions.pocion_grande > 0 && (missing > 0.5 || !S.potions.pocion)) id = 'pocion_grande';
    else if (S.potions.pocion > 0) id = 'pocion';
    if (!id) { addFloat(p.x, p.y - 60, 'Sin pociones', '#fca5a5', 13); return; }
    S.potions[id]--;
    const heal = Math.round(p.maxHp * POTIONS[id].heal);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    addFloat(p.x, p.y - 60, `+${heal}`, '#4ade80', 18);
    burst(p.x, p.y - 26, '#86efac', 16, 90, -60);
    st.potionT = 1.5;
    Sfx.play('potion');
    Game.save();
  }

  /* ---------- Aparición de enemigos ---------- */
  function updateSpawns(dt) {
    if (st.ended || !st.queue.length) return;
    st.spawnT -= dt;
    if (st.spawnT > 0) return;
    const alive = st.enemies.filter(e => !e.dead).length;
    const next = st.queue[0];
    if (ENEMIES[next].boss) {
      if (alive > 0) return;
      st.queue.shift();
      const b = makeEnemy(next, 1);
      st.boss = b;
      st.enemies.push(b);
      showBanner(`⚠️ ${b.def.name.toUpperCase()}`, '¡Ha aparecido el jefe!', '#fca5a5');
      Sfx.play('roar');
      st.shake = 8;
    } else if (alive < st.maxAlive) {
      st.queue.shift();
      const side = st.killed === 0 && alive === 0 ? 1 : (Math.random() < 0.72 ? 1 : -1);
      st.enemies.push(makeEnemy(next, side));
      st.spawnT = rand(1.0, 1.9);
    }
  }

  function makeEnemy(id, side) {
    const d = ENEMIES[id], I = st.info;
    const hp = Math.round(I.hp * d.hp);
    return {
      id, def: d, boss: !!d.boss, x: side > 0 ? W + 30 : -30, y: G,
      hp, maxHp: hp, atk: I.atk * d.atk, speed: d.speed * rand(0.9, 1.1), range: d.range, size: d.size,
      face: side > 0 ? -1 : 1, walk: Math.random() * 6, seed: Math.random() * 10,
      atkT: rand(0.5, 1.2), windup: 0, windupMax: 1, recover: 0, flash: 0, frozen: 0, burn: 0, burnTick: 0,
      dead: false, deathT: 0, specialT: d.specialCd ? d.specialCd * 0.6 : 0, atkIdx: 0, enraged: false, action: null,
    };
  }

  /* ---------- IA de enemigos ---------- */
  function updateEnemy(e, dt) {
    if (e.dead) { e.deathT -= dt; return; }
    e.flash -= dt;
    if (e.burn > 0) {
      e.burn -= dt; e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.5;
        damageEnemy(e, st.p.dmg * 0.25 * skillMult('fuego'), { color: '#fb923c', silent: true });
        burst(e.x, e.y - e.size * 0.6, '#fb923c', 4, 40, -60);
        if (e.dead) return;
      }
    }
    let slow = 1;
    if (e.frozen > 0) { e.frozen -= dt; if (!e.boss) return; slow = 0.4; }
    const p = st.p, dx = p.x - e.x, dist = Math.abs(dx);
    if (e.boss && updateBoss(e, dt * slow)) return;
    if (e.recover > 0) { e.recover -= dt; return; }
    e.atkT -= dt * slow;
    if (e.windup > 0) {
      e.windup -= dt * slow;
      if (e.windup <= 0) {
        if (e.def.ai === 'ranged') shoot(e, e.def.proj);
        else if (dist <= e.range + 16) hurtPlayer(e.atk);
        e.recover = 0.3; e.atkT = e.def.atkCd * rand(0.9, 1.15);
      }
      return;
    }
    e.face = Math.sign(dx) || e.face;
    const onScreen = e.x > 8 && e.x < W - 8;
    const ranged = e.def.ai === 'ranged';
    const inRange = ranged ? dist <= e.range && dist >= 70 : dist <= e.range;
    if (inRange && onScreen && p.hp > 0) {
      if (e.atkT <= 0) { e.windupMax = ranged ? 0.6 : (e.boss ? 0.5 : 0.42); e.windup = e.windupMax; }
    } else {
      let dir = Math.sign(dx);
      if (ranged && dist < 70 && onScreen) dir = -dir;
      e.x += dir * e.speed * slow * dt;
      e.walk += dt * 10;
      e.x = ranged && onScreen ? clamp(e.x, 12, W - 12) : clamp(e.x, -40, W + 40);
    }
  }

  function separateEnemies() {
    const list = st.enemies.filter(e => !e.dead && !e.boss);
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j], d = b.x - a.x, min = (a.size + b.size) * 0.32;
        if (Math.abs(d) < min) {
          const push = (min - Math.abs(d)) / 2, s = d >= 0 ? 1 : -1;
          a.x -= push * s; b.x += push * s;
        }
      }
  }

  function shoot(e, kind) {
    st.projs.push({
      x: e.x + e.face * e.size * 0.4, y: e.y - e.size * 0.6, vx: e.face * (kind === 'arrow' ? 230 : 180), vy: 0,
      hostile: true, kind: kind || 'darkorb', dmg: e.atk, life: 3,
    });
  }

  /* ---------- Jefes ---------- */
  function updateBoss(e, dt) {
    if (!e.enraged && e.hp < e.maxHp * 0.5) {
      e.enraged = true; e.speed *= 1.25;
      showBanner('¡FURIA!', `${e.def.name} se enfurece`, '#f87171');
      Sfx.play('roar'); st.shake = 7;
    }
    if (e.action) { runAction(e, dt); return true; }
    e.specialT -= dt;
    if (e.specialT <= 0 && e.x > 20 && e.x < W - 20 && e.windup <= 0) {
      const list = e.def.attacks;
      startAction(e, list[e.atkIdx++ % list.length]);
      e.specialT = e.def.specialCd * (e.enraged ? 0.7 : 1);
      return true;
    }
    return false;
  }

  function addZone(x, r, delay, dmg, fx, fall) {
    st.zones.push({ x: clamp(x, 10, W - 10), r, t: delay, total: delay, dmg, fx, fall, boom: 0 });
  }

  function startAction(e, type) {
    const p = st.p;
    const [kind, arg] = type.split(':');
    e.action = { kind, arg, t: 0, from: e.x, tx: p.x, shots: 0 };
    e.face = Math.sign(p.x - e.x) || e.face;
    Sfx.play('warn');
    if (kind === 'leap') addZone(p.x, 58, 1.1, e.atk * 1.4, 'slam', false);
    if (kind === 'slam') addZone(e.x, e.size * 0.6 + 50, 0.95, e.atk * 1.3, 'slam', false);
    if (kind === 'zones') {
      const n = e.enraged ? 5 : 3;
      addZone(p.x, 40, 1.2, e.atk * 1.2, e.def.zoneFx, e.def.zoneFx !== 'ice');
      for (let i = 1; i < n; i++) addZone(rand(30, W - 30), 40, 1.2 + i * 0.18, e.atk * 1.2, e.def.zoneFx, e.def.zoneFx !== 'ice');
    }
    if (kind === 'lob') {
      const spread = e.enraged ? [-120, -60, 0, 60, 120] : [-70, 0, 70];
      spread.forEach((o, i) => addZone(p.x + o, 34, 1.0 + i * 0.12, e.atk * 1.1, e.def.zoneFx, true));
    }
    if (kind === 'breath') addZone(e.x + e.face * 130, 115, 0.9, e.atk * 1.6, 'fire', false);
    if (kind === 'summon') showBanner('', '¡Invoca refuerzos!', '#fca5a5', 1.2);
  }

  function runAction(e, dt) {
    const a = e.action;
    a.t += dt;
    if (a.kind === 'leap') {
      if (a.t < 0.55) { /* se agacha */ }
      else if (a.t < 1.1) {
        const k = (a.t - 0.55) / 0.55;
        e.x = a.from + (a.tx - a.from) * k;
        e.y = G - Math.sin(k * Math.PI) * 95;
      } else { e.y = G; if (a.t > 1.45) e.action = null; }
    } else if (a.kind === 'slam') {
      e.windup = a.t < 0.95 ? 0.4 : 0; e.windupMax = 0.5;
      if (a.t > 1.3) { e.action = null; e.windup = 0; }
    } else if (a.kind === 'zones' || a.kind === 'lob') {
      if (a.t > 0.8) e.action = null;
    } else if (a.kind === 'volley') {
      const n = e.enraged ? 5 : 3;
      if (a.t > 0.35 + a.shots * 0.28 && a.shots < n) { e.face = Math.sign(st.p.x - e.x) || e.face; shoot(e, e.def.proj); a.shots++; }
      if (a.t > 0.5 + n * 0.28) e.action = null;
    } else if (a.kind === 'breath') {
      if (a.t > 0.9 && a.t < 1.5) {
        for (let i = 0; i < 3; i++) st.parts.push({ x: e.x + e.face * 30, y: e.y - e.size * 0.55, vx: e.face * rand(200, 330), vy: rand(-30, 40), life: 0.6, max: 0.6, color: ['#f97316', '#fde047', '#ef4444'][i], size: rand(4, 8), grav: 0 });
      }
      if (a.t > 1.6) e.action = null;
    } else if (a.kind === 'summon') {
      if (!a.done && a.t > 0.5) {
        a.done = true;
        const alive = st.enemies.filter(x => !x.dead).length;
        if (alive < 6) { st.enemies.push(makeEnemy(a.arg, 1)); st.enemies.push(makeEnemy(a.arg, -1)); }
      }
      if (a.t > 0.9) e.action = null;
    } else e.action = null;
  }

  function updateZones(dt) {
    for (const z of st.zones) {
      if (z.t > 0) {
        z.t -= dt;
        if (z.t <= 0) {
          z.boom = 0.45;
          if (Math.abs(st.p.x - z.x) < z.r + 6) hurtPlayer(z.dmg);
          const col = FX_COLORS[z.fx] || '#fde68a';
          burst(z.x, G - 4, col, 14, 150, -120);
          Sfx.play(z.fx === 'ice' ? 'ice' : 'boom');
          st.shake = Math.max(st.shake, 4);
        }
      } else z.boom -= dt;
    }
    st.zones = st.zones.filter(z => z.t > 0 || z.boom > 0);
  }
  const FX_COLORS = { slam: '#d6b98c', claw: '#e5e7eb', poison: '#84cc16', ice: '#bae6fd', meteor: '#f97316', fire: '#f97316', dark: '#a855f7' };
  const FX_ICON = { poison: '🟢', meteor: '☄️', dark: '🟣', claw: '🪨', slam: '🪨', fire: '🔥' };

  /* ---------- Daño a enemigos y muerte ---------- */
  function damageEnemy(e, base, o = {}) {
    if (e.dead) return;
    let dmg = base * rand(0.9, 1.1), crit = false;
    if (o.canCrit && Math.random() < st.p.crit) { dmg *= 2; crit = true; }
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.flash = 0.12;
    if (!e.boss && o.knock && !e.action) e.x = clamp(e.x + Math.sign(e.x - st.p.x || 1) * o.knock, -40, W + 40);
    addFloat(e.x + rand(-8, 8), e.y - e.size - 6, crit ? `${dmg}!` : `${dmg}`, crit ? '#fde047' : (o.color || '#ffffff'), crit ? 21 : 15);
    burst(e.x, e.y - e.size * 0.5, crit ? '#fde047' : (o.color || '#ffffff'), crit ? 12 : 6, 140);
    if (!o.silent) Sfx.play(crit ? 'crit' : 'hit');
    if (crit) st.shake = Math.max(st.shake, 4);
    if (e.hp <= 0) killEnemy(e);
  }

  function rollMaterial() {
    const depth = stageIndexInWorld(st.stage);
    const w = {};
    for (const id in st.world.drops) {
      const rIdx = RARITY_ORDER.indexOf(MATERIALS[id].rarity);
      w[id] = st.world.drops[id] * (1 + depth * 0.15 * rIdx);
    }
    return weightedPick(w);
  }

  function killEnemy(e) {
    e.dead = true; e.deathT = 0.45; e.hp = 0; e.action = null; e.y = G;
    st.killed++;
    Game.S.stats.kills++;
    st.loot.xp += Math.round(st.info.xp * e.def.hp * (e.boss ? 6 : 1));
    burst(e.x, e.y - e.size * 0.5, '#ffffff', 16, 160);
    const coins = Math.max(1, Math.round(st.info.coins * rand(0.7, 1.3) * (e.boss ? 12 : 1)));
    spawnDrop(e.x, e.y - e.size * 0.5, { coins });
    const n = e.boss ? 10 : (Math.random() < 0.7 ? 1 : 2);
    for (let i = 0; i < n; i++) spawnDrop(e.x, e.y - e.size * 0.5, { mat: rollMaterial(), qty: e.boss ? 2 : 1 });
    if (e.boss) {
      const first = !Game.S.bossKills[st.world.boss];
      if (first || Math.random() < 0.35) {
        spawnDrop(e.x, e.y - e.size * 0.6, { mat: st.world.bossDrop, qty: 1 });
        st.specialDrop = st.world.bossDrop;
      }
      st.bossDefeated = true;
      st.slowT = 1.4; st.shake = 12; st.whiteFlash = 0.3;
      showBanner('🏆 ¡JEFE DERROTADO!', '', '#fde047', 2.2);
      Sfx.play('boom');
      // Los esbirros que queden huyen
      for (const o of st.enemies) if (!o.dead && o !== e) { o.dead = true; o.deathT = 0.45; burst(o.x, o.y - 20, '#fff', 8, 100); }
    }
  }

  /* ---------- Botín ---------- */
  function spawnDrop(x, y, what) {
    const icon = what.coins ? '🪙' : MATERIALS[what.mat].icon;
    const color = what.coins ? '#fde047' : RARITIES[MATERIALS[what.mat].rarity].color;
    st.drops.push(Object.assign({ x, y, vx: rand(-90, 90), vy: rand(-220, -140), t: 0, icon, color }, what));
  }

  function collectDrop(d) {
    d.done = true;
    if (d.coins) {
      st.loot.coins += d.coins;
      addFloat(st.p.x, st.p.y - 66, `+${d.coins} 🪙`, '#fde047', 13);
      Sfx.play('coin');
    } else {
      st.loot.mats[d.mat] = (st.loot.mats[d.mat] || 0) + d.qty;
      addFloat(st.p.x, st.p.y - 66, `+${d.qty} ${d.icon}`, d.color, 14);
      Sfx.play('pickup');
    }
    burst(st.p.x, st.p.y - 30, d.color, 6, 70);
  }
  function collectAllDrops() { for (const d of st.drops) if (!d.done) collectDrop(d); st.drops = []; }

  function updateDrops(dt) {
    const p = st.p;
    for (const d of st.drops) {
      d.t += dt;
      if (d.t < 0.75) {
        d.vy += 600 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.y > G - 6) { d.y = G - 6; d.vy *= -0.4; d.vx *= 0.6; }
      } else {
        const tx = p.x, ty = p.y - 30, k = Math.min(1, dt * (6 + d.t * 10));
        d.x += (tx - d.x) * k; d.y += (ty - d.y) * k;
        if (Math.abs(tx - d.x) < 10 && Math.abs(ty - d.y) < 10) collectDrop(d);
      }
    }
    st.drops = st.drops.filter(d => !d.done);
  }

  /* ---------- Proyectiles ---------- */
  function updateProjectiles(dt) {
    const p = st.p;
    for (const pr of st.projs) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if (pr.kind === 'bigfire' || pr.kind === 'fireball') st.parts.push({ x: pr.x, y: pr.y, vx: rand(-20, 20), vy: rand(-40, 0), life: 0.3, max: 0.3, color: '#fb923c', size: rand(2, 5), grav: 0 });
      if (pr.hostile) {
        if (Math.abs(pr.x - p.x) < 12 && Math.abs(pr.y - (G - 28)) < 30) { hurtPlayer(pr.dmg); pr.life = 0; burst(pr.x, pr.y, '#fca5a5', 6, 80); }
      } else {
        for (const e of st.enemies) {
          if (e.dead) continue;
          if (Math.abs(pr.x - e.x) < e.size * 0.45 && pr.y > e.y - e.size * 1.1 && pr.y < e.y + 4) {
            if (pr.explode) explode(pr);
            else damageEnemy(e, pr.dmg, { color: '#93c5fd' });
            pr.life = 0;
            break;
          }
        }
        if (pr.life <= 0 && pr.explode && !pr.exploded) explode(pr);
      }
      if (pr.x < -40 || pr.x > W + 40) pr.life = 0;
    }
    st.projs = st.projs.filter(pr => pr.life > 0);
  }

  function explode(pr) {
    pr.exploded = true;
    st.rings.push({ x: pr.x, y: pr.y, r: 8, max: pr.explode, t: 0.35, life: 0.35, color: '#fb923c' });
    burst(pr.x, pr.y, '#f97316', 26, 200);
    burst(pr.x, pr.y, '#fde047', 12, 140);
    st.shake = Math.max(st.shake, 7);
    Sfx.play('boom');
    for (const e of st.enemies) {
      if (e.dead || Math.abs(e.x - pr.x) > pr.explode + e.size * 0.3) continue;
      damageEnemy(e, pr.dmg, { color: '#fdba74' });
      if (!e.dead) e.burn = pr.burn;
    }
  }

  /* ---------- Efectos ---------- */
  function burst(x, y, color, n, speed, vyBias = -40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(0.3, 1) * speed;
      st.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + vyBias, life: rand(0.3, 0.6), max: 0.6, color, size: rand(2, 4.5), grav: 400 });
    }
  }
  function addFloat(x, y, text, color, size) { st.floats.push({ x, y, text, color, size, t: 0, life: 0.9 }); }
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
    if (st.parts.length > 500) st.parts.splice(0, st.parts.length - 500);
    for (const f of st.floats) { f.t += dt; f.y -= 34 * dt; }
    st.floats = st.floats.filter(f => f.t < f.life);
    for (const b of st.bolts) b.t -= dt;
    st.bolts = st.bolts.filter(b => b.t > 0);
    for (const r of st.rings) { r.t -= dt; r.r = r.max * (1 - r.t / r.life); }
    st.rings = st.rings.filter(r => r.t > 0);
    if (st.banner) { st.banner.t += dt; if (st.banner.t > st.banner.life) st.banner = null; }
    st.shake = Math.max(0, st.shake - dt * 22);
    st.hurtFlash -= dt; st.whiteFlash -= dt;
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

  function draw() {
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.save();
    if (st.shake > 0) c.translate(rand(-1, 1) * st.shake, rand(-1, 1) * st.shake);
    c.drawImage(bg, -8, -8, W + 16, H + 16);

    // Ambiente
    for (const a of st.ambient) {
      const cols = AMBIENT_COLORS[a.kind];
      c.fillStyle = cols[Math.floor(a.ph * 10 + a.s) % cols.length];
      c.globalAlpha = a.kind === 'mote' ? 0.4 + Math.sin(a.ph * 3) * 0.3 : 0.8;
      if (a.kind === 'leaf') { c.save(); c.translate(a.x, a.y); c.rotate(a.ph); c.fillRect(-3, -1.5, 6, 3); c.restore(); }
      else { c.beginPath(); c.arc(a.x, a.y, a.s * (a.kind === 'sand' ? 0.6 : 1), 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1;
    if (st.world.theme === 'volcan') {
      c.fillStyle = `rgba(249,115,22,${0.06 + Math.sin(st.time * 2) * 0.04})`;
      c.fillRect(0, 0, W, H);
    }

    drawZones(c);

    // Botín en el suelo
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const d of st.drops) {
      c.fillStyle = d.color + '55';
      c.beginPath(); c.arc(d.x, d.y, 9 + Math.sin(d.t * 10) * 1.5, 0, Math.PI * 2); c.fill();
      c.font = '15px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      c.fillStyle = d.color;
      c.fillText(d.icon, d.x, d.y + 1);
    }

    // Enemigos
    for (const e of st.enemies) {
      if (e.dead) {
        c.globalAlpha = Math.max(0, e.deathT / 0.45);
        c.save(); c.translate(e.x, e.y); c.scale(1, Math.max(0.1, e.deathT / 0.45)); c.translate(-e.x, -e.y);
        Sprites.enemy(c, e, st.time);
        c.restore(); c.globalAlpha = 1;
        continue;
      }
      if (e.action && e.action.kind === 'leap' && e.action.t < 0.55) {
        c.save(); c.translate(e.x, e.y); c.scale(1.1, 0.85); c.translate(-e.x, -e.y); Sprites.enemy(c, e, st.time); c.restore();
      } else Sprites.enemy(c, e, st.time);
      // Aviso de ataque
      if (e.windup > 0 || (e.action && e.action.t < 0.6)) {
        c.font = 'bold 16px system-ui, sans-serif'; c.fillStyle = '#ef4444';
        c.strokeStyle = '#000'; c.lineWidth = 3;
        c.strokeText('!', e.x, e.y - e.size - 16); c.fillText('!', e.x, e.y - e.size - 16);
      }
      // Barra de vida de enemigos normales
      if (!e.boss && e.hp < e.maxHp) {
        const w = Math.max(24, e.size * 0.8), x = e.x - w / 2, y = e.y - e.size - 8;
        c.fillStyle = '#000a'; c.fillRect(x - 1, y - 1, w + 2, 6);
        c.fillStyle = '#ef4444'; c.fillRect(x, y, w * e.hp / e.maxHp, 4);
      }
    }

    // Jugador
    const p = st.p;
    const S = Game.S;
    if (p.hp <= 0) {
      c.save(); c.translate(p.x, p.y); c.rotate(-Math.PI / 2 * p.face); c.translate(-p.x, -p.y);
      c.globalAlpha = 0.7;
    }
    if (!(p.invuln > 0 && Math.floor(st.time * 30) % 2 === 0)) {
      Sprites.knight(c, p.x, p.y, 1.02, { face: p.face, walk: p.walk, swing: p.swing, heavy: p.heavy, time: st.time,
        weaponColor: ITEMS[S.equip.weapon].color, armorColor: ITEMS[S.equip.armor].color, flash: p.flash > 0, helmet: S.settings.helmet });
    }
    if (p.hp <= 0) { c.restore(); c.globalAlpha = 1; }

    // Proyectiles
    for (const pr of st.projs) drawProjectile(c, pr);

    // Rayos
    for (const b of st.bolts) {
      c.strokeStyle = '#fef9c3'; c.lineWidth = 3; c.shadowColor = '#fde047'; c.shadowBlur = 14;
      c.beginPath(); c.moveTo(b.x + Math.sin(b.seed) * 20, 0);
      let x = b.x, y = 0;
      for (let i = 1; i <= 8; i++) { y = b.y * i / 8; x = b.x + (i < 8 ? rand(-14, 14) : 0); c.lineTo(x, y); }
      c.stroke(); c.shadowBlur = 0;
    }
    for (const r of st.rings) {
      c.strokeStyle = r.color; c.globalAlpha = Math.max(0, r.t / r.life); c.lineWidth = 5;
      c.beginPath(); c.ellipse(r.x, r.y, r.r, r.r * 0.45, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
    }
    // Partículas
    for (const pt of st.parts) {
      c.globalAlpha = Math.max(0, pt.life / pt.max);
      c.fillStyle = pt.color;
      c.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    c.globalAlpha = 1;
    // Daño flotante
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
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, 'rgba(220,38,38,0)'); g.addColorStop(1, `rgba(220,38,38,${st.hurtFlash})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    if (st.whiteFlash > 0) { c.fillStyle = `rgba(255,255,255,${st.whiteFlash * 1.5})`; c.fillRect(0, 0, W, H); }
    if (st.p.hp > 0 && st.p.hp < st.p.maxHp * 0.25) {
      c.strokeStyle = `rgba(239,68,68,${0.35 + Math.sin(st.time * 6) * 0.2})`; c.lineWidth = 8; c.strokeRect(0, 0, W, H);
    }
    drawBanner(c);
  }

  function drawZones(c) {
    for (const z of st.zones) {
      if (z.t > 0) {
        const k = 1 - z.t / z.total;
        c.fillStyle = `rgba(239,68,68,${0.12 + 0.12 * k})`;
        c.beginPath(); c.ellipse(z.x, G + 4, z.r, z.r * 0.2, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = `rgba(254,202,202,${0.5 + Math.sin(st.time * 18) * 0.3})`; c.lineWidth = 2; c.stroke();
        c.fillStyle = 'rgba(239,68,68,.35)';
        c.beginPath(); c.ellipse(z.x, G + 4, z.r * k, z.r * 0.2 * k, 0, 0, Math.PI * 2); c.fill();
        if (z.fall && z.t < 0.6) {
          const fk = 1 - z.t / 0.6;
          c.font = '24px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(FX_ICON[z.fx] || '☄️', z.x, -20 + (G - 10) * fk);
        }
      } else {
        const k = z.boom / 0.45, col = FX_COLORS[z.fx] || '#fde68a';
        c.globalAlpha = k;
        if (z.fx === 'ice') {
          c.fillStyle = '#e0f2fe';
          for (let i = -2; i <= 2; i++) { const x = z.x + i * z.r * 0.4, h = (50 - Math.abs(i) * 12) * Math.min(1, (1 - k) * 4 + 0.3); c.beginPath(); c.moveTo(x - 7, G + 2); c.lineTo(x, G - h); c.lineTo(x + 7, G + 2); c.fill(); }
        } else if (z.fx === 'dark') {
          const g = c.createLinearGradient(0, 0, 0, G);
          g.addColorStop(0, 'rgba(168,85,247,0)'); g.addColorStop(1, 'rgba(168,85,247,.9)');
          c.fillStyle = g; c.fillRect(z.x - z.r * 0.6, 0, z.r * 1.2, G + 4);
        } else {
          c.fillStyle = col;
          c.beginPath(); c.ellipse(z.x, G - 4, z.r * (1.2 - k * 0.3), z.r * 0.5 * (1.2 - k * 0.3), 0, Math.PI, 0); c.fill();
        }
        c.globalAlpha = 1;
      }
    }
  }

  function drawProjectile(c, pr) {
    c.save();
    c.translate(pr.x, pr.y);
    if (pr.kind === 'arrow') {
      c.scale(Math.sign(pr.vx), 1);
      c.strokeStyle = pr.hostile ? '#78350f' : '#93c5fd'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-12, 0); c.lineTo(8, 0); c.stroke();
      c.fillStyle = '#d4d4d8'; c.beginPath(); c.moveTo(8, -3); c.lineTo(13, 0); c.lineTo(8, 3); c.fill();
    } else {
      const big = pr.kind === 'bigfire';
      const col = { fireball: '#f97316', bigfire: '#f97316', darkorb: '#a855f7', poison: '#84cc16' }[pr.kind] || '#a855f7';
      const r = big ? 11 : 6;
      c.fillStyle = (pr.hostile ? col : (big ? col : '#93c5fd')) + '66';
      c.beginPath(); c.arc(0, 0, r * 1.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = pr.hostile || big ? col : '#93c5fd';
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff8'; c.beginPath(); c.arc(-r * 0.3, -r * 0.3, r * 0.4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function drawBanner(c) {
    const b = st.banner;
    if (!b) return;
    const inK = Math.min(1, b.t / 0.25), outK = Math.min(1, (b.life - b.t) / 0.35);
    const a = Math.min(inK, outK);
    c.globalAlpha = a;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (b.text) {
      c.font = '900 34px "Cinzel", Georgia, serif';
      const fit = Math.min(1, (W * 0.92) / c.measureText(b.text).width);
      const sc = (0.7 + 0.3 * inK) * fit;
      c.save(); c.translate(W / 2, H * 0.33); c.scale(sc, sc);
      c.lineWidth = 6; c.strokeStyle = '#1a0b00'; c.strokeText(b.text, 0, 0);
      c.fillStyle = b.color; c.fillText(b.text, 0, 0);
      c.restore();
    }
    if (b.sub) {
      c.font = '700 15px system-ui, sans-serif';
      c.lineWidth = 4; c.strokeStyle = '#1a0b00'; c.strokeText(b.sub, W / 2, H * 0.33 + (b.text ? 34 : 0));
      c.fillStyle = '#fff'; c.fillText(b.sub, W / 2, H * 0.33 + (b.text ? 34 : 0));
    }
    c.globalAlpha = 1;
  }

  /* ---------- HUD (DOM) ---------- */
  const lastHud = {};
  function setText(el, key, v) { if (lastHud[key] !== v) { lastHud[key] = v; el.textContent = v; } }
  function setWidth(el, key, pct) { const v = Math.round(pct * 1000) / 10; if (lastHud[key] !== v) { lastHud[key] = v; el.style.width = v + '%'; } }

  function updateHud(force) {
    if (!st) return;
    if (force) for (const k in lastHud) delete lastHud[k];
    const p = st.p, S = Game.S;
    setWidth(H_.hpFill, 'hp', p.hp / p.maxHp);
    setText(H_.hpText, 'hpt', `${Math.ceil(p.hp)} / ${p.maxHp}`);
    setText(H_.stage, 'stage', `${st.world.icon} Etapa ${st.stage} · ${st.info.name}`);
    setText(H_.prog, 'prog', st.info.boss ? (st.boss ? '👹 JEFE' : `${Math.min(st.killed, 5)}/5 → 👹`) : `☠️ ${st.killed}/${st.total}`);
    setText(H_.coins, 'coins', `🪙 ${st.loot.coins}`);
    setText(H_.mats, 'mats', `📦 ${Object.values(st.loot.mats).reduce((a, b) => a + b, 0)}`);
    const b = st.boss;
    const showBoss = !!b && !b.dead;
    if (lastHud.boss !== showBoss) { lastHud.boss = showBoss; H_.bossBar.hidden = !showBoss; }
    if (showBoss) {
      setText(H_.bossName, 'bn', `${b.def.name}${b.enraged ? ' 😡' : ''}`);
      setWidth(H_.bossFill, 'bf', b.hp / b.maxHp);
    }
    setText(H_.potion, 'pot', String((S.potions.pocion || 0) + (S.potions.pocion_grande || 0)));
    for (const id of SKILL_ORDER) {
      const el = document.querySelector(`[data-skill="${id}"]`);
      if (!el) continue;
      const lvl = skillLevel(id);
      const cd = Math.max(0, st.cds[id] || 0), max = lvl ? skillCd(id) : 1;
      const v = lvl ? Math.round(cd / max * 100) : 100;
      if (lastHud['sk' + id] !== v) {
        lastHud['sk' + id] = v;
        el.style.setProperty('--cd', v + '%');
        el.classList.toggle('ready', lvl > 0 && cd <= 0);
        el.querySelector('.cdtext').textContent = lvl ? (cd > 0 ? Math.ceil(cd) : '') : '🔒';
      }
    }
  }

  /* ---------- Fin ---------- */
  function finish() {
    const result = {
      victory: st.victory, abandoned: !!st.abandoned, stage: st.stage, boss: st.info.boss, loot: st.loot,
      specialDrop: st.specialDrop, killed: st.killed,
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
    init, start, stop, abandon, castSkill, usePotion,
    setInput(k, v) { input[k] = v; },
    pause() { paused = true; resetInput(); },
    resume() { paused = false; lastT = performance.now(); },
    get active() { return !!st; },
    get paused() { return paused; },
    skillLevel, skillCd,
  };
})();
