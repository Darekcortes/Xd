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
      settings: { sound: true, vibrate: true },
      stats: { kills: 0, spins: 0, crafted: 0, deaths: 0 },
    };
  }

  let S = newState();

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const defaults = newState();
        S = Object.assign(newState(), data);
        // Fusiona sub-objetos para que partidas antiguas reciban campos nuevos
        for (const k of ['alloc', 'potions', 'settings', 'stats', 'equip']) S[k] = Object.assign({}, defaults[k], data[k] || {});
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
      }
    } catch (e) { S = newState(); }
    Sfx.setEnabled(S.settings.sound);
    return S;
  }

  let saveTimer = null;
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* almacenamiento no disponible */ }
  }
  /** Guarda el progreso. Agrupa varias llamadas seguidas salvo que now sea true. */
  function save(now) {
    clearTimeout(saveTimer);
    if (now) writeSave(); else saveTimer = setTimeout(writeSave, 150);
  }
  function reset() {
    S = newState();
    save(true);
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
    const crit = Math.min(0.6, 0.05 + w.crit);
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
    if (p.coins) return { icon: '💰', name: `x${p.coins}`, full: `${p.coins} monedas` };
    if (p.item) return { icon: ITEMS[p.item].icon, name: ITEMS[p.item].name.split(' ').slice(-1)[0], full: ITEMS[p.item].name };
    if (p.skill) return { icon: SKILLS[p.skill].icon, name: 'Habilidad', full: SKILLS[p.skill].name };
    return { icon: '?', name: '', full: '' };
  }

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
    const matRolls = isBoss ? 4 : 2;
    for (let i = 0; i < matRolls; i++) rewards.push({ mat: weightedPick(world.drops), qty: 2 + Math.floor(Math.random() * (3 + depth)) });
    rewards.push({ coins: Math.round(info.coins * (isBoss ? 12 : 3)) });
    return rewards;
  }

  return {
    get S() { return S; },
    load, save, reset, stats, itemStats, matCount, addMat, hasCost, payCost,
    giveItem, giveSkill, grant, prizeLabel, addXp, completeStage, highestWorld, rollChest,
  };
})();
