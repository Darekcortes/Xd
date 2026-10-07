'use strict';
/* =====================================================================
   ESTADO DEL JUGADOR, GUARDADO Y REGLAS DE PROGRESIÓN
   ===================================================================== */
const Game = (() => {
  const SAVE_KEY = 'reinos-del-caos-save-v1';

  function newState() {
    return {
      version: 1,
      level: 1, xp: 0, points: 0,
      alloc: { hp: 0, dmg: 0, def: 0, spd: 0 },
      coins: 50, gems: 3,
      unlocked: 1,               // etapa más alta desbloqueada
      cleared: {},               // { etapa: veces completada }
      mats: {},                  // { material: cantidad }
      potions: { pocion: 3, pocion_grande: 0 },
      items: { espada_madera: { lvl: 1 }, ropa_viajero: { lvl: 1 } },
      equip: { weapon: 'espada_madera', armor: 'ropa_viajero' },
      skills: {},                // { habilidad: nivel }
      bossKills: {},
      settings: { sound: true, music: true, vibrate: true, helmet: false, landscape: true, classic: false },
      stats: { kills: 0, spins: 0, crafted: 0, deaths: 0, elites: 0, bestCombo: 0, noPotionBoss: 0 },
      login: { last: '', day: 0, total: 0 },          // calendario de 7 días
      achievements: {},                                // { logro: medallas reclamadas (0-3) }
      pets: { owned: {}, active: null },               // { mascota: { lvl, xp } }
      enchants: {},                                    // { arma: encantamiento }
      cosmetics: { owned: [], aura: null, trail: null },
      tower: { best: 0, runs: 0 },
      tickets: 1, ticketShards: 0,   // 🎟️ tickets de ruleta y fragmentos
      streak: 0, bestStreak: 0,      // racha de victorias seguidas
      daily: null,                   // misiones del día
      rank: 0,                       // último rango del caballero celebrado
      username: '',                  // nombre que elige el jugador
      savedAt: 0,                    // momento del último guardado (para elegir la copia más nueva)
    };
  }

  let S = newState();

  /** Aplica datos guardados (del navegador, de la cuenta o de un código) sobre un estado nuevo. */
  function applyData(data) {
    const defaults = newState();
    S = Object.assign(newState(), data);
    // Fusiona sub-objetos para que partidas antiguas reciban campos nuevos
    for (const k of ['alloc', 'potions', 'settings', 'stats', 'equip', 'login', 'pets', 'cosmetics', 'tower']) S[k] = Object.assign({}, defaults[k], data[k] || {});
    if (!Array.isArray(S.cosmetics.owned)) S.cosmetics.owned = [];
    if (!data.items) S.items = defaults.items;
    // Limpia referencias a objetos que ya no existan
    for (const id of Object.keys(S.items)) if (!ITEMS[id]) delete S.items[id];
    if (!S.items[S.equip.weapon]) {
      S.items.espada_madera = S.items.espada_madera || { lvl: 1 };
      S.equip.weapon = 'espada_madera';
    }
    if (!S.items[S.equip.armor]) {
      S.items.ropa_viajero = S.items.ropa_viajero || { lvl: 1 };
      S.equip.armor = 'ropa_viajero';
    }
    S.unlocked = Math.min(Math.max(1, S.unlocked), MAX_STAGE);
    if (data.rank === undefined) S.rank = rankOf(S.level);   // no celebrar rangos ya alcanzados
    S.username = typeof S.username === 'string' ? S.username.slice(0, 16) : '';
    lastPrint = printOf();
    Sfx.setEnabled(S.settings.sound);
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) applyData(JSON.parse(raw));
    } catch (e) { S = newState(); }
    Sfx.setEnabled(S.settings.sound);
    return S;
  }

  /** ¿Es una partida recién empezada (sin progreso que perder)? */
  const isFresh = st => !st || (!(st.cleared && Object.keys(st.cleared).length) && (st.level || 1) <= 1 && !(st.stats && st.stats.kills));

  let saveTimer = null;
  function writeLocal() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* almacenamiento no disponible */ }
  }
  // Huella del último estado guardado: la fecha solo avanza si algo cambió de verdad,
  // así un dispositivo con datos viejos nunca pisa una partida más nueva al cerrarse.
  let lastPrint = '';
  const printOf = () => JSON.stringify(Object.assign({}, S, { savedAt: 0 }));
  function writeSave() {
    const print = printOf();
    if (print !== lastPrint) { lastPrint = print; S.savedAt = Date.now(); }
    writeLocal();
    scheduleCloud();
  }
  /** Guarda el progreso. Agrupa varias llamadas seguidas salvo que now sea true. */
  function save(now) {
    clearTimeout(saveTimer);
    if (now) writeSave(); else saveTimer = setTimeout(writeSave, 150);
  }
  function reset() {
    const name = S.username;
    S = newState();
    S.username = name;         // la cuenta conserva su nombre
    save(true);
  }

  /* ---------- Guardado en la cuenta (Claude) ----------
     Si el juego se abre dentro de Claude con una sesión iniciada, el progreso
     se guarda también en el espacio privado de la cuenta del jugador
     (data/users/<id>/save), que nadie más puede leer. Fuera de Claude
     (archivo descargado) se guarda solo en el navegador. */
  const Cloud = { status: 'local', ref: null, ready: false, timer: null, writing: false, again: false, lastSync: 0, syncedAt: -1 };

  async function connectCloud(onChange) {
    Acc.onChange = onChange;
    if (Acc.session) return resumeAccount(onChange);
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      Cloud.ref = db.doc('data/users/' + uid + '/save');
      Cloud.status = 'connecting'; onChange();
      let snap;
      try { snap = await Cloud.ref.get(); }
      catch (e) { await new Promise(r => setTimeout(r, 800 + Math.random() * 800)); snap = await Cloud.ref.get(); }
      const body = snap.exists ? snap.data() : null;
      let remote = null;
      try { remote = body && body.state ? JSON.parse(body.state) : null; } catch (e) { remote = null; }
      Cloud.ready = true;
      Cloud.status = 'cloud';
      // Se queda la copia más nueva; una partida recién empezada nunca pisa la de la cuenta
      if (remote && (isFresh(S) || (remote.savedAt || 0) > (S.savedAt || 0))) {
        applyData(remote);
        writeLocal();
        Cloud.lastSync = remote.savedAt || Date.now(); Cloud.syncedAt = remote.savedAt || 0;
        onChange(true);
      } else {
        Cloud.syncedAt = remote ? remote.savedAt || 0 : -1;
        onChange(false);
        if (!remote || (S.savedAt || 0) > (remote.savedAt || 0)) cloudWrite();
      }
    } catch (e) {
      Cloud.status = 'local'; Cloud.ready = false; onChange(false);
    }
  }

  function scheduleCloud() {
    if (Acc.session) { scheduleAccount(); return; }
    if (!Cloud.ready) return;
    clearTimeout(Cloud.timer);
    Cloud.timer = setTimeout(cloudWrite, 2500);
  }

  async function cloudWrite() {
    if (Acc.session) return accountWrite();
    if (!Cloud.ready || !Cloud.ref) return;
    if ((S.savedAt || 0) <= Cloud.syncedAt) return;   // nada nuevo que subir
    if (Cloud.writing) { Cloud.again = true; return; }   // una escritura a la vez
    Cloud.writing = true;
    try {
      const at = S.savedAt || Date.now();
      await Cloud.ref.set({ v: 1, savedAt: at, username: S.username || '', state: JSON.stringify(S) });
      Cloud.lastSync = Date.now(); Cloud.syncedAt = Math.max(Cloud.syncedAt, at);
      Cloud.status = 'cloud';
    } catch (e) {
      // invalid_argument = esta cuenta no puede guardar aquí; revoked = acceso retirado
      if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted')) { Cloud.ready = false; Cloud.status = 'denied'; }
      else Cloud.status = 'error';
    }
    Cloud.writing = false;
    if (Cloud.again) { Cloud.again = false; cloudWrite(); }
  }

  /* ---------- Cuenta con usuario y contraseña ----------
     Cada cuenta es un documento accounts/<usuario> en los datos del juego.
     La contraseña nunca se guarda: de ella se derivan (PBKDF2) un
     verificador para comprobarla y una clave AES con la que se cifra la
     partida, así que sin la contraseña nadie puede leer el progreso.
     En este dispositivo se recuerda la sesión (usuario y clave derivada)
     hasta que el jugador cierra sesión.                                */
  const ACC_KEY = 'reinos-del-caos-account';
  const PBKDF2_ITER = 150000;
  const Acc = { session: null, status: 'none', lastSync: 0, syncedAt: 0, timer: null, writing: false, again: false, onChange: null };
  try { const raw = localStorage.getItem(ACC_KEY); if (raw) Acc.session = JSON.parse(raw); } catch (e) { Acc.session = null; }

  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = str => Uint8Array.from(atob(str), ch => ch.charCodeAt(0));
  /** Identificador del documento: minúsculas, sin acentos, solo caracteres válidos. */
  function accountId(name) {
    return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      .replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, '_').replace(/^\.+$/, '_');
  }
  async function accountDb() {
    if (!window.claude || typeof window.claude.use !== 'function') return null;
    try { return await window.claude.use('db'); } catch (e) { return null; }
  }
  const hasCrypto = () => !!(window.crypto && crypto.subtle);
  async function deriveKeys(password, saltB64) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: PBKDF2_ITER }, base, 512);
    return { ver: b64(bits.slice(0, 32)), keyRaw: b64(bits.slice(32)) };
  }
  const aesKey = keyRaw => crypto.subtle.importKey('raw', unb64(keyRaw), 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function seal(keyRaw, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyRaw), new TextEncoder().encode(JSON.stringify(obj)));
    return { iv: b64(iv), data: b64(data) };
  }
  async function unseal(keyRaw, iv, data) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aesKey(keyRaw), unb64(data));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  function rememberSession(sess) {
    Acc.session = sess;
    try { if (sess) localStorage.setItem(ACC_KEY, JSON.stringify(sess)); else localStorage.removeItem(ACC_KEY); } catch (e) { /* sin almacenamiento */ }
  }
  /** Motivo por el que no se pueden usar cuentas aquí (o null si se puede). */
  async function accountsBlocked() {
    if (!hasCrypto()) return 'Este navegador no permite cuentas seguras.';
    const db = await accountDb();
    if (!db) return 'Las cuentas solo funcionan abriendo el juego desde su enlace de Claude con tu sesión iniciada.';
    return null;
  }
  const writeDenied = e => e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted');
  const DENIED_MSG = 'Tu acceso a esta página no permite guardar (pide al dueño acceso de Colaborador).';

  /** Crea una cuenta nueva con el progreso actual. Devuelve null o un mensaje de error. */
  async function createAccount(name, password) {
    const blocked = await accountsBlocked(); if (blocked) return blocked;
    const db = await accountDb(), id = accountId(name);
    if (id.length < 3) return 'Ese nombre no sirve como usuario.';
    const ref = db.doc('accounts/' + id);
    try {
      const snap = await ref.get();
      if (snap.exists) return 'Ese usuario ya existe. Elige otro o inicia sesión.';
      const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
      const { ver, keyRaw } = await deriveKeys(password, salt);
      S.username = name; S.savedAt = Date.now();
      const box = await seal(keyRaw, S);
      await ref.set({ v: 1, name, salt, ver, iv: box.iv, data: box.data, savedAt: S.savedAt, created: Date.now() });
      rememberSession({ id, name, ver, keyRaw });
      Acc.status = 'ok'; Acc.lastSync = Date.now(); Acc.syncedAt = S.savedAt;
      writeLocal();
      return null;
    } catch (e) { return writeDenied(e) ? DENIED_MSG : 'No se pudo crear la cuenta. Revisa tu conexión e inténtalo de nuevo.'; }
  }

  /** Entra en una cuenta y carga su progreso. Devuelve null o un mensaje de error. */
  async function login(name, password) {
    const blocked = await accountsBlocked(); if (blocked) return blocked;
    const db = await accountDb(), id = accountId(name);
    try {
      const snap = await db.doc('accounts/' + id).get();
      if (!snap.exists) return 'No existe ninguna cuenta con ese usuario.';
      const doc = snap.data();
      const { ver, keyRaw } = await deriveKeys(password, doc.salt);
      if (ver !== doc.ver) return 'Contraseña incorrecta.';
      const remote = await unseal(keyRaw, doc.iv, doc.data);
      applyData(remote);
      S.username = doc.name || name;
      rememberSession({ id, name: S.username, ver, keyRaw });
      Acc.status = 'ok'; Acc.lastSync = doc.savedAt || Date.now(); Acc.syncedAt = doc.savedAt || 0;
      S.savedAt = doc.savedAt || 0;
      writeLocal();
      return null;
    } catch (e) { return 'No se pudo entrar. Revisa tu conexión e inténtalo de nuevo.'; }
  }

  /** Al abrir el juego con la sesión recordada: trae el progreso más nuevo de la cuenta. */
  async function resumeAccount(onChange) {
    const sess = Acc.session;
    const db = await accountDb();
    if (!db || !hasCrypto()) { Acc.status = 'offline'; onChange(false); return; }
    Acc.status = 'connecting'; onChange(false);
    try {
      const snap = await db.doc('accounts/' + sess.id).get();
      if (!snap.exists) { Acc.status = 'missing'; onChange(false); return; }
      const doc = snap.data();
      if (doc.ver !== sess.ver) { rememberSession(null); Acc.status = 'expired'; onChange(false); return; }   // cambió la contraseña
      let loaded = false;
      if ((doc.savedAt || 0) > (S.savedAt || 0) || isFresh(S)) {
        applyData(await unseal(sess.keyRaw, doc.iv, doc.data)); writeLocal(); loaded = true;
      }
      S.username = doc.name || sess.name;
      Acc.status = 'ok'; Acc.lastSync = doc.savedAt || 0; Acc.syncedAt = doc.savedAt || 0;
      if (loaded) S.savedAt = doc.savedAt || 0;
      onChange(loaded);
      if (!loaded && (S.savedAt || 0) > (doc.savedAt || 0)) accountWrite();
    } catch (e) { Acc.status = 'error'; Acc.lastError = (e && e.code) || 'error'; onChange(false); }
  }

  function scheduleAccount() {
    if (Acc.status !== 'ok') return;
    clearTimeout(Acc.timer);
    Acc.timer = setTimeout(accountWrite, 1500);
  }
  /** ¿Hay progreso local que todavía no está en la cuenta? */
  const accountPending = () => !!Acc.session && (S.savedAt || 0) > Acc.syncedAt;
  /** Sube la partida cifrada a la cuenta. Si falla, lo reintenta solo (3 s, 6 s, 12 s… hasta 1 min). */
  async function accountWrite(force) {
    const sess = Acc.session;
    if (!sess || Acc.status !== 'ok') return false;
    if (!force && !accountPending()) return true;   // nada nuevo que subir
    if (Acc.writing) { Acc.again = true; return false; }   // una escritura a la vez
    Acc.writing = true; clearTimeout(Acc.retry);
    let ok = false;
    try {
      const db = await accountDb();
      if (!db) throw Object.assign(new Error('sin conexión'), { code: 'unavailable' });
      const box = await seal(sess.keyRaw, S);
      const at = S.savedAt || Date.now();
      await db.doc('accounts/' + sess.id).update({ iv: box.iv, data: box.data, savedAt: at, name: sess.name });
      Acc.lastSync = Date.now(); Acc.syncedAt = Math.max(Acc.syncedAt, at);
      Acc.fails = 0; Acc.lastError = null; ok = true;
      submitScore();
    } catch (e) {
      Acc.lastError = (e && e.code) || 'error';
      if (writeDenied(e) && e.code !== 'invalid_argument') Acc.status = 'denied';
      else {
        // Fallo pasajero (conexión, límite de peticiones…): se reintenta sin perder nada
        Acc.fails = (Acc.fails || 0) + 1;
        const wait = Math.min(60000, 3000 * Math.pow(2, Acc.fails - 1));
        Acc.retry = setTimeout(() => accountWrite(true), wait);
        if (Acc.fails >= 4 && e && e.code === 'invalid_argument') Acc.status = 'denied';
      }
      if (typeof console !== 'undefined') console.warn('No se pudo guardar en la cuenta:', Acc.lastError);
    }
    Acc.writing = false;
    if (Acc.onChange) Acc.onChange(false);
    if (Acc.again) { Acc.again = false; accountWrite(); }
    return ok;
  }
  /** Guardar ahora (botón de Ajustes). */
  async function syncNow() {
    save(true);
    if (!Acc.session) { await cloudWrite(); return Cloud.status === 'cloud'; }
    if (Acc.status !== 'ok') { await resumeAccount(Acc.onChange || (() => {})); if (Acc.status !== 'ok') return false; }
    return accountWrite(true);
  }
  // Vigilante: cada 20 s sube lo pendiente y, si se perdió la conexión, vuelve a conectar
  let resuming = false;
  setInterval(async () => {
    if (!Acc.session || resuming || Acc.writing) return;
    if (Acc.status === 'ok') { if (accountPending()) accountWrite(); else submitScore(); return; }
    if (['offline', 'error', 'connecting'].includes(Acc.status) && Acc.onChange) {
      resuming = true;
      try { await resumeAccount(Acc.onChange); } finally { resuming = false; }
    }
  }, 20000);
  if (typeof window !== 'undefined') window.addEventListener('online', () => { if (Acc.session && Acc.status === 'ok') accountWrite(true); });

  /** Cierra sesión: guarda por última vez y deja el dispositivo con una partida nueva. */
  async function logout() {
    if (Acc.session && Acc.status === 'ok') { clearTimeout(Acc.timer); S.savedAt = Date.now(); await accountWrite(); }
    rememberSession(null);
    Acc.status = 'none'; Acc.syncedAt = 0;
    S = newState(); lastPrint = printOf();
    writeLocal();
  }

  /* ---------- Ranking ----------
     Cada cuenta publica su marca en leaderboard/<usuario> (solo datos de juego). */
  let lastScore = '';
  function scoreEntry() {
    const P = stats();
    return { name: S.username || (Acc.session && Acc.session.name) || 'Guerrero', level: S.level, power: P.power,
             tower: S.tower.best || 0, combo: S.stats.bestCombo || 0,
             bosses: Object.values(S.bossKills).reduce((a, b) => a + b, 0), rank: rankOf(S.level) };
  }
  async function submitScore(force) {
    const sess = Acc.session;
    if (!sess || Acc.status !== 'ok') return;
    const entry = scoreEntry(), print = JSON.stringify(entry);
    if (print === lastScore && !force) return;
    try {
      const db = await accountDb();
      await db.doc('leaderboard/' + sess.id).set(Object.assign(entry, { at: Date.now() }));
      lastScore = print;
    } catch (e) { /* sin permiso o sin conexión: se reintenta en el próximo guardado */ }
  }
  /** Ranking en vivo: avisa cada vez que alguien sube su marca. Devuelve la función para dejar de escuchar. */
  async function watchLeaderboard(field, cb) {
    const db = await accountDb();
    if (!db) { cb(null); return () => {}; }
    const q = db.collection('leaderboard').orderBy(field, 'desc').limit(30);
    const toList = snap => snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    if (typeof q.onSnapshot === 'function') {
      try { return q.onSnapshot(snap => cb(toList(snap)), () => fetchLeaderboard(field).then(cb)); } catch (e) { /* sigue abajo */ }
    }
    fetchLeaderboard(field).then(cb);
    const t = setInterval(() => fetchLeaderboard(field).then(cb), 15000);
    return () => clearInterval(t);
  }
  /** Mi propia marca guardada en el ranking (para mostrar mi puesto aunque no esté entre los 30). */
  async function myScore() {
    const db = await accountDb(), sess = Acc.session;
    if (!db || !sess) return null;
    try { const snap = await db.doc('leaderboard/' + sess.id).get(); return snap.exists ? Object.assign({ id: sess.id }, snap.data()) : null; } catch (e) { return null; }
  }
  /** Los 30 mejores según el campo (power, level, tower, combo). null si no hay conexión. */
  async function fetchLeaderboard(field) {
    const db = await accountDb();
    if (!db) return null;
    try {
      const snap = await db.collection('leaderboard').orderBy(field, 'desc').limit(30).get();
      return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    } catch (e) { return null; }
  }

  /* ---------- Código de guardado (para mover la partida a mano) ---------- */
  function exportCode() {
    const json = JSON.stringify(S);
    return 'RDC1:' + btoa(unescape(encodeURIComponent(json)));
  }
  function importCode(code) {
    const txt = String(code || '').trim();
    if (!txt.startsWith('RDC1:')) return false;
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(txt.slice(5)))));
      if (!data || typeof data !== 'object' || !data.items) return false;
      applyData(data);
      save(true);
      if (Cloud.ready) cloudWrite();
      return true;
    } catch (e) { return false; }
  }

  /* ---------- Estadísticas derivadas ---------- */
  const levelMult = lvl => 1 + ITEM_LEVEL_BONUS * (lvl - 1);

  function itemStats(id, lvl) {
    const it = ITEMS[id], m = levelMult(lvl || (S.items[id] ? S.items[id].lvl : 1));
    if (it.type === 'weapon') return { dmg: Math.round(it.dmg * m), spd: it.spd || 0, crit: it.crit || 0 };
    return { def: Math.round(it.def * m), hp: Math.round(it.hp * m) };
  }

  function stats() {
    const B = BALANCE, L = S.level - 1;
    const w = itemStats(S.equip.weapon), a = itemStats(S.equip.armor);
    const maxHp = Math.round(100 + L * B.levelHp + S.alloc.hp * B.pointHp + a.hp);
    const dmg = Math.round(8 + L * B.levelDmg + S.alloc.dmg * B.pointDmg + w.dmg);
    const def = Math.round(L * B.levelDef + S.alloc.def * B.pointDef + a.def);
    const spd = Math.min(2.6, 1 + S.alloc.spd * B.pointSpd + w.spd);
    const crit = Math.min(0.6, 0.05 + w.crit + (S.enchants[S.equip.weapon] === 'llama' ? 0.08 : 0));
    const skillBonus = Object.values(S.skills).reduce((t, l) => t + l * 0.06, 0);
    const power = Math.round((dmg * spd * (1 + crit) * 3) * (1 + skillBonus) + maxHp * 0.5 + def * 4);
    return { maxHp, dmg, def, spd, crit, power };
  }

  /* ---------- Recursos ---------- */
  const matCount = id => S.mats[id] || 0;
  function addMat(id, qty) { S.mats[id] = matCount(id) + qty; }

  function hasCost(cost, coins = 0, gems = 0) {
    if (S.coins < coins || S.gems < gems) return false;
    for (const k in cost) if (matCount(k) < cost[k]) return false;
    return true;
  }
  function payCost(cost, coins = 0, gems = 0) {
    if (!hasCost(cost, coins, gems)) return false;
    for (const k in cost) S.mats[k] -= cost[k];
    S.coins -= coins; S.gems -= gems;
    save();
    return true;
  }

  /** Da un objeto. Si ya lo tiene, lo mejora un nivel o lo convierte en monedas. */
  function giveItem(id) {
    if (!S.items[id]) { S.items[id] = { lvl: 1 }; return { text: 'nuevo', isNew: true }; }
    const it = S.items[id];
    if (it.lvl < MAX_ITEM_LEVEL) { it.lvl++; return { text: `duplicado → mejorado a nivel ${it.lvl}` }; }
    const coins = itemValue(id) * 2;
    S.coins += coins;
    return { text: `duplicado al máximo → +${coins} 💰` };
  }

  function giveSkill(id) {
    const lvl = S.skills[id] || 0;
    if (lvl === 0) { S.skills[id] = 1; return { text: '¡nueva habilidad!', isNew: true }; }
    if (lvl < MAX_SKILL_LEVEL) { S.skills[id] = lvl + 1; return { text: `subió a nivel ${lvl + 1}` }; }
    S.gems += 5;
    return { text: 'nivel máximo → +5 💎' };
  }

  /** Aplica una recompensa (de ruleta, cofre o jefe). Devuelve un texto descriptivo. */
  function grant(prize) {
    if (prize.bundle) return prize.bundle.map(grant).join(' · ');
    if (prize.mat) { addMat(prize.mat, prize.qty); return `${MATERIALS[prize.mat].icon} ${MATERIALS[prize.mat].name} x${prize.qty}`; }
    if (prize.potion) { S.potions[prize.potion] = (S.potions[prize.potion] || 0) + prize.qty; return `${POTIONS[prize.potion].icon} ${POTIONS[prize.potion].name} x${prize.qty}`; }
    if (prize.gems) { S.gems += prize.gems; return `💎 ${prize.gems} cristales`; }
    if (prize.tickets) { S.tickets += prize.tickets; return `🎟️ ${prize.tickets} ticket${prize.tickets > 1 ? 's' : ''} de ruleta`; }
    if (prize.shards) { const t = addShards(prize.shards); return `🧩 ${prize.shards} fragmento${prize.shards > 1 ? 's' : ''} de ticket${t ? ` (¡+${t} 🎟️!)` : ''}`; }
    if (prize.chest) { return rollChest(Math.max(1, S.unlocked - 1), false).map(grant).join(' · '); }
    if (prize.epicChest) {
      const bossStage = Math.max(STAGES_PER_WORLD, highestWorld() * STAGES_PER_WORLD);
      const t = rollChest(bossStage, true).map(grant).join(' · ');
      return prize.gems ? `${t} · ${grant({ gems: prize.gems })}` : t;
    }
    if (prize.pet) return givePet(prize.pet);
    if (prize.coins) { S.coins += prize.coins; return `💰 ${prize.coins} monedas`; }
    if (prize.item) { const r = giveItem(prize.item); return `${ITEMS[prize.item].icon} ${ITEMS[prize.item].name} (${r.text})`; }
    if (prize.skill) { const r = giveSkill(prize.skill); return `${SKILLS[prize.skill].icon} ${SKILLS[prize.skill].name} (${r.text})`; }
    return '';
  }

  /** Nombre corto e icono de un premio, para mostrar en la ruleta. */
  function prizeLabel(p) {
    if (p.bundle) return { icon: '🎁', name: 'Cofre', full: p.bundle.map(b => prizeLabel(b).full).join(' + ') };
    if (p.mat) return { icon: MATERIALS[p.mat].icon, name: `x${p.qty}`, full: `${MATERIALS[p.mat].name} x${p.qty}` };
    if (p.potion) return { icon: POTIONS[p.potion].icon, name: `x${p.qty}`, full: `${POTIONS[p.potion].name} x${p.qty}` };
    if (p.gems) return { icon: '💎', name: `x${p.gems}`, full: `${p.gems} cristales` };
    if (p.tickets) return { icon: '🎟️', name: `x${p.tickets}`, full: `${p.tickets} ticket${p.tickets > 1 ? 's' : ''}` };
    if (p.coins) return { icon: '💰', name: `x${p.coins}`, full: `${p.coins} monedas` };
    if (p.item) return { icon: ITEMS[p.item].icon, name: ITEMS[p.item].name.split(' ').slice(-1)[0], full: ITEMS[p.item].name };
    if (p.skill) return { icon: SKILLS[p.skill].icon, name: 'Habilidad', full: SKILLS[p.skill].name };
    return { icon: '?', name: '', full: '' };
  }

  /* ---------- Tickets de ruleta ---------- */
  /** Suma fragmentos; cada TICKET_SHARDS forman un ticket. Devuelve los tickets creados. */
  function addShards(n) {
    S.ticketShards += n;
    let made = 0;
    while (S.ticketShards >= TICKET_SHARDS) { S.ticketShards -= TICKET_SHARDS; S.tickets++; made++; }
    return made;
  }

  /* ---------- Racha ---------- */
  const streakBonus = () => Math.min(STREAK.bonusMax, S.streak * STREAK.bonusPer);

  /* ---------- Misiones diarias ---------- */
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  /** Crea las misiones del día (las mismas durante todo el día). */
  function ensureDaily() {
    const day = today();
    if (S.daily && S.daily.day === day) return S.daily;
    const w = highestWorld();
    let seed = [...day].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const pool = MISSIONS.slice();
    const list = [];
    while (list.length < MISSIONS_PER_DAY && pool.length) {
      const m = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      list.push({ id: m.id, goal: m.goal(w), progress: 0, claimed: false, reward: m.reward(w) });
    }
    S.daily = { day, missions: list, bonusClaimed: false };
    save();
    return S.daily;
  }
  /** Avanza las misiones con un evento. Para combo y racha cuenta el máximo. Devuelve las recién completadas. */
  function track(ev, amount) {
    const d = ensureDaily(), done = [];
    for (const m of d.missions) {
      const def = MISSIONS.find(x => x.id === m.id);
      if (!def || def.ev !== ev || m.progress >= m.goal) continue;
      m.progress = (ev === 'combo' || ev === 'streak') ? Math.max(m.progress, amount) : m.progress + amount;
      if (m.progress >= m.goal) { m.progress = m.goal; done.push(m); }
    }
    return done;
  }
  const missionText = m => MISSIONS.find(x => x.id === m.id).text(m.goal);

  /* ---------- Experiencia ---------- */
  function addXp(amount) {
    S.xp += amount;
    let ups = 0;
    while (S.xp >= xpForLevel(S.level)) {
      S.xp -= xpForLevel(S.level);
      S.level++; ups++;
      S.points += BALANCE.pointsPerLevel;
      S.gems += 1;
    }
    return ups;
  }

  /* ---------- Etapas ---------- */
  function completeStage(stage) {
    const first = !S.cleared[stage];
    S.cleared[stage] = (S.cleared[stage] || 0) + 1;
    if (stage === S.unlocked && S.unlocked < MAX_STAGE) S.unlocked++;
    S.streak++;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
    return first;
  }
  const highestWorld = () => worldOfStage(S.unlocked).id;

  /* ---------- Cofre de etapa ---------- */
  function rollChest(stage, isBoss) {
    const info = stageInfo(stage), world = info.world, depth = stageIndexInWorld(stage);
    const rewards = [];
    const roll = Math.random();
    const itemChance = isBoss ? 0.55 : 0.08 + depth * 0.02;
    if (roll < itemChance) {
      // Objetos más raros del mundo tienen menos peso
      const weights = {};
      world.chestItems.forEach((id, i) => { weights[id] = [60, 30, 10][i] || 5; });
      rewards.push({ item: weightedPick(weights) });
    } else if (roll < itemChance + 0.15) {
      rewards.push({ potion: Math.random() < 0.25 + world.id * 0.1 ? 'pocion_grande' : 'pocion', qty: 1 + (isBoss ? 2 : 0) });
    } else if (roll < itemChance + 0.27) {
      rewards.push({ gems: 1 + Math.floor(Math.random() * 2) + (isBoss ? 3 : 0) });
    }
    if (Math.random() < 0.15 + (isBoss ? 0.5 : 0)) rewards.push({ shards: 1 });
    const matRolls = isBoss ? 4 : 2;
    for (let i = 0; i < matRolls; i++) rewards.push({ mat: weightedPick(world.drops), qty: 2 + Math.floor(Math.random() * (3 + depth)) });
    rewards.push({ coins: Math.round(info.coins * (isBoss ? 12 : 3) * (1 + streakBonus())) });
    return rewards;
  }

  /* ---------- Calendario de 7 días ---------- */
  const dayNum = str => { const [y, m, d] = str.split('-').map(Number); return Math.round(new Date(y, m - 1, d).getTime() / 864e5); };
  /** ¿Hay premio hoy? y qué casilla (0-6) toca. */
  function loginStatus() {
    const L = S.login, t = today();
    if (L.last === t) return { claimable: false, day: (L.day + 6) % 7 };
    const gap = L.last ? dayNum(t) - dayNum(L.last) : 99;
    return { claimable: true, day: gap === 1 ? L.day % 7 : 0, reset: gap > 1 && !!L.last };
  }
  function claimLogin() {
    const st = loginStatus();
    if (!st.claimable) return null;
    const def = LOGIN_REWARDS[st.day], w = highestWorld();
    const text = grant(def.prize(w));
    S.login = { last: today(), day: st.day + 1, total: (S.login.total || 0) + 1 };
    save(true);
    return { day: st.day, text };
  }

  /* ---------- Logros ---------- */
  function achState(a) {
    const claimed = S.achievements[a.id] || 0, value = a.value(S) || 0;
    const tier = claimed < 3 ? claimed : 2;
    return { claimed, value, goal: a.goals[tier], claimable: claimed < 3 && value >= a.goals[claimed], done: claimed >= 3, reached: a.goals.filter(g => value >= g).length };
  }
  const achClaimable = () => ACHIEVEMENTS.filter(a => achState(a).claimable).length;
  function claimAchievement(id) {
    const a = ACHIEVEMENTS.find(x => x.id === id), st = a && achState(a);
    if (!st || !st.claimable) return null;
    const medal = st.claimed;
    S.achievements[id] = medal + 1;
    S.gems += a.gems[medal];
    save(true);
    return { medal, gems: a.gems[medal] };
  }

  /* ---------- Mascotas ---------- */
  function givePet(id) {
    const P = PETS[id];
    if (!S.pets.owned[id]) {
      S.pets.owned[id] = { lvl: 1, xp: 0 };
      if (!S.pets.active) S.pets.active = id;
      return `${P.icon} ¡Nueva mascota: ${P.name}!`;
    }
    const o = S.pets.owned[id];
    if (o.lvl < PET_MAX_LEVEL) { o.lvl++; o.xp = 0; return `${P.icon} ${P.name} sube a nivel ${o.lvl}`; }
    S.gems += 5;
    return `${P.icon} ${P.name} ya está al máximo → +5 💎`;
  }
  /** La mascota activa gana experiencia por cada derrota. Devuelve el nuevo nivel si subió. */
  function petGainXp(n) {
    const id = S.pets.active, o = id && S.pets.owned[id];
    if (!o || o.lvl >= PET_MAX_LEVEL) return 0;
    o.xp += n;
    let up = 0;
    while (o.lvl < PET_MAX_LEVEL && o.xp >= petXpFor(o.lvl)) { o.xp -= petXpFor(o.lvl); o.lvl++; up = o.lvl; }
    return up;
  }

  /* ---------- Encantamientos ---------- */
  function enchantWeapon(enchId) {
    const E = ENCHANTS[enchId], wid = S.equip.weapon;
    if (!E || S.enchants[wid] === enchId) return false;
    if (!payCost(E.cost, E.coins, E.gems)) return false;
    S.enchants[wid] = enchId;
    S.stats.crafted++;
    save(true);
    return true;
  }

  /* ---------- Cosméticos ---------- */
  function cosmeticUnlocked(id) {
    const C = COSMETICS[id];
    if (S.cosmetics.owned.includes(id)) return true;
    if (C.ach) { const a = ACHIEVEMENTS.find(x => x.id === C.ach[0]); return (a.value(S) || 0) >= a.goals[C.ach[1]]; }
    return false;
  }
  function buyCosmetic(id) {
    const C = COSMETICS[id];
    if (cosmeticUnlocked(id) || !C.gems || S.gems < C.gems) return false;
    S.gems -= C.gems; S.cosmetics.owned.push(id);
    save(true);
    return true;
  }
  function wearCosmetic(id) {
    const C = COSMETICS[id];
    if (!cosmeticUnlocked(id)) return false;
    if (!S.cosmetics.owned.includes(id)) S.cosmetics.owned.push(id);
    S.cosmetics[C.type] = S.cosmetics[C.type] === id ? null : id;
    save(true);
    return true;
  }

  return {
    get S() { return S; },
    load, save, reset, stats, itemStats, matCount, addMat, hasCost, payCost,
    giveItem, giveSkill, grant, prizeLabel, addXp, completeStage, highestWorld, rollChest,
    addShards, streakBonus, ensureDaily, track, missionText,
    connectCloud, cloudWrite, exportCode, importCode, get cloud() { return Cloud; },
    createAccount, login, logout, accountsBlocked, syncNow, accountPending, get account() { return Acc; },
    rank: () => rankOf(S.level),
    loginStatus, claimLogin, achState, achClaimable, claimAchievement, givePet, petGainXp,
    enchantWeapon, cosmeticUnlocked, buyCosmetic, wearCosmetic, submitScore, fetchLeaderboard, watchLeaderboard, myScore,
  };
})();
