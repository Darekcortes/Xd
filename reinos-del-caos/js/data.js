'use strict';
/* =====================================================================
   REINOS DEL CAOS — DATOS DEL JUEGO
   Todo el contenido del juego vive en este archivo. Para ampliarlo:
   - Nuevo material ........ añade una entrada a MATERIALS.
   - Nueva arma/armadura ... añade una entrada a ITEMS (y úsala en RECIPES,
                             WHEELS o en el cofre de un mundo).
   - Nuevo enemigo ......... añade una entrada a ENEMIES y ponlo en un mundo.
   - Nuevo jefe ............ entrada en ENEMIES con boss:true y sus attacks.
   - Nueva habilidad ....... entrada en SKILLS + su efecto en battle.js
                             (función castSkill).
   - Nueva ruleta .......... entrada en WHEELS y referénciala desde el mundo.
   - Nuevo mundo ........... añade un objeto a WORLDS. Las etapas se generan
                             solas (5 por mundo, la última es el jefe).
   ===================================================================== */

/* ---------- Rarezas ---------- */
const RARITIES = {
  comun:      { name: 'Común',      icon: '⚪', color: '#d4d4d8' },
  pococomun:  { name: 'Poco común', icon: '🟢', color: '#4ade80' },
  raro:       { name: 'Raro',       icon: '🔵', color: '#60a5fa' },
  epico:      { name: 'Épico',      icon: '🟣', color: '#c084fc' },
  legendario: { name: 'Legendario', icon: '🟠', color: '#fb923c' },
  mitico:     { name: 'Mítico',     icon: '🔴', color: '#f43f5e' },
};
const RARITY_ORDER = ['comun', 'pococomun', 'raro', 'epico', 'legendario', 'mitico'];

/* ---------- Materiales ---------- */
const MATERIALS = {
  madera:               { name: 'Madera',               icon: '🪵', rarity: 'comun' },
  piedra:               { name: 'Piedra',               icon: '🪨', rarity: 'comun' },
  hierro:               { name: 'Hierro',               icon: '🔩', rarity: 'comun' },
  cristal:              { name: 'Cristal',              icon: '💠', rarity: 'pococomun' },
  oro:                  { name: 'Oro',                  icon: '🧈', rarity: 'pococomun' },
  esencia:              { name: 'Esencia',              icon: '✨', rarity: 'raro' },
  cristal_hielo:        { name: 'Cristal de hielo',     icon: '🧊', rarity: 'pococomun' },
  esencia_hielo:        { name: 'Esencia de hielo',     icon: '❄️', rarity: 'raro' },
  mineral_volcanico:    { name: 'Mineral volcánico',    icon: '🌋', rarity: 'pococomun' },
  esencia_fuego:        { name: 'Esencia de fuego',     icon: '🔥', rarity: 'raro' },
  cristal_rojo:         { name: 'Cristal rojo',         icon: '♦️', rarity: 'epico' },
  cristal_oscuro:       { name: 'Cristal oscuro',       icon: '🔮', rarity: 'raro' },
  esencia_demoniaca:    { name: 'Esencia demoníaca',    icon: '😈', rarity: 'epico' },
  oro_oscuro:           { name: 'Oro oscuro',           icon: '⚱️', rarity: 'epico' },
  fragmento_legendario: { name: 'Fragmento legendario', icon: '🌟', rarity: 'legendario' },
  // Materiales especiales de jefe
  colmillo_rey:  { name: 'Colmillo del Rey Lobo',  icon: '🦷', rarity: 'epico',      special: true },
  aguijon_reina: { name: 'Aguijón de la Reina',    icon: '🦂', rarity: 'epico',      special: true },
  nucleo_hielo:  { name: 'Núcleo de hielo eterno', icon: '🔷', rarity: 'legendario', special: true },
  escama_dragon: { name: 'Escama de dragón',       icon: '🐲', rarity: 'legendario', special: true },
  alma_maldita:  { name: 'Alma maldita',           icon: '👻', rarity: 'mitico',     special: true },
};

/* ---------- Pociones ---------- */
const POTIONS = {
  pocion:        { name: 'Poción',        icon: '🧪', heal: 0.35, rarity: 'comun', price: 40 },
  pocion_grande: { name: 'Poción grande', icon: '⚗️', heal: 0.75, rarity: 'raro',  price: 160 },
};

/* ---------- Armas y armaduras ----------
   weapon: dmg (daño), spd (ataques/seg extra), crit (prob. crítico extra)
   armor:  def (defensa), hp (vida extra)
   upg:    material que se gasta para mejorarla en la forja            */
const ITEMS = {
  // Armas
  espada_madera:     { type: 'weapon', name: 'Espada de madera',      icon: '🗡️', rarity: 'comun',      dmg: 3,   color: '#b7793a', upg: 'madera' },
  espada_oxidada:    { type: 'weapon', name: 'Espada oxidada',        icon: '🗡️', rarity: 'comun',      dmg: 6,   color: '#a87458', upg: 'hierro' },
  espada_hierro:     { type: 'weapon', name: 'Espada de hierro',      icon: '🗡️', rarity: 'pococomun',  dmg: 11,  color: '#cbd5e1', upg: 'hierro' },
  hoja_rey_lobo:     { type: 'weapon', name: 'Hoja del Rey Lobo',     icon: '🗡️', rarity: 'epico',      dmg: 16,  spd: 0.15, crit: 0.12, color: '#f5f5f4', upg: 'piedra' },
  espada_acero:      { type: 'weapon', name: 'Espada de acero',       icon: '⚔️', rarity: 'raro',       dmg: 22,  color: '#e2e8f0', upg: 'hierro' },
  cimitarra:         { type: 'weapon', name: 'Cimitarra del desierto', icon: '⚔️', rarity: 'raro',      dmg: 30,  spd: 0.1, color: '#facc15', upg: 'oro' },
  espada_hielo:      { type: 'weapon', name: 'Espada de hielo',       icon: '⚔️', rarity: 'epico',      dmg: 48,  color: '#7dd3fc', upg: 'cristal_hielo' },
  espada_fuego:      { type: 'weapon', name: 'Espada de fuego',       icon: '⚔️', rarity: 'epico',      dmg: 88,  color: '#fb923c', upg: 'mineral_volcanico' },
  espada_infernal:   { type: 'weapon', name: 'Espada infernal',       icon: '⚔️', rarity: 'legendario', dmg: 160,  color: '#ef4444', upg: 'cristal_oscuro' },
  espada_inframundo: { type: 'weapon', name: 'Espada del Inframundo', icon: '⚔️', rarity: 'legendario', dmg: 190, crit: 0.1, color: '#a855f7', upg: 'cristal_oscuro' },
  hoja_caos:         { type: 'weapon', name: 'Hoja del Caos',         icon: '⚔️', rarity: 'mitico',     dmg: 290, spd: 0.2, crit: 0.15, color: '#f43f5e', upg: 'fragmento_legendario' },
  // Armaduras
  ropa_viajero:       { type: 'armor', name: 'Ropa de viajero',          icon: '👕', rarity: 'comun',      def: 1,   hp: 0,   color: '#8b6b4a', upg: 'madera' },
  armadura_basica:    { type: 'armor', name: 'Armadura básica',          icon: '🦺', rarity: 'comun',      def: 4,   hp: 15,  color: '#9ca3af', upg: 'piedra' },
  armadura_cuero:     { type: 'armor', name: 'Armadura de cuero',        icon: '🦺', rarity: 'pococomun',  def: 8,   hp: 30,  color: '#a16207', upg: 'hierro' },
  armadura_reforzada: { type: 'armor', name: 'Armadura reforzada',       icon: '🛡️', rarity: 'raro',       def: 16,  hp: 60,  color: '#94a3b8', upg: 'hierro' },
  armadura_escamas:   { type: 'armor', name: 'Armadura de escamas',      icon: '🛡️', rarity: 'epico',      def: 28,  hp: 110, color: '#d97706', upg: 'oro' },
  armadura_congelada: { type: 'armor', name: 'Armadura congelada',       icon: '🛡️', rarity: 'epico',      def: 45,  hp: 180, color: '#60a5fa', upg: 'cristal_hielo' },
  armadura_lava:      { type: 'armor', name: 'Armadura de lava',         icon: '🛡️', rarity: 'epico',      def: 80,  hp: 300, color: '#b91c1c', upg: 'mineral_volcanico' },
  armadura_oscura:    { type: 'armor', name: 'Armadura del Caballero Oscuro', icon: '🛡️', rarity: 'legendario', def: 140, hp: 500, color: '#4c1d95', upg: 'cristal_oscuro' },
  armadura_caos:      { type: 'armor', name: 'Armadura del Caos',        icon: '🛡️', rarity: 'mitico',     def: 210, hp: 760, color: '#9f1239', upg: 'fragmento_legendario' },
};
const MAX_ITEM_LEVEL = 5;
const ITEM_LEVEL_BONUS = 0.15;          // +15% de estadísticas por nivel
const RARITY_VALUE = { comun: 20, pococomun: 60, raro: 150, epico: 350, legendario: 800, mitico: 2000 };

/* ---------- Recetas de la forja ----------
   world: mundo que hay que alcanzar para ver la receta */
const RECIPES = [
  { item: 'espada_oxidada',     world: 1, coins: 20,   cost: { madera: 8, hierro: 5 } },
  { item: 'armadura_basica',    world: 1, coins: 25,   cost: { madera: 10, piedra: 10 } },
  { item: 'espada_hierro',      world: 1, coins: 60,   cost: { hierro: 30, piedra: 10 } },
  { item: 'armadura_cuero',     world: 1, coins: 80,   cost: { madera: 25, hierro: 15 } },
  { item: 'hoja_rey_lobo',      world: 1, coins: 150,  cost: { colmillo_rey: 1, hierro: 25, piedra: 30 } },
  { item: 'espada_acero',       world: 2, coins: 200,  cost: { hierro: 50, cristal: 5 } },
  { item: 'armadura_reforzada', world: 2, coins: 250,  cost: { hierro: 45, oro: 8 } },
  { item: 'cimitarra',          world: 2, coins: 350,  cost: { oro: 15, cristal: 10, esencia: 4 } },
  { item: 'armadura_escamas',   world: 2, coins: 500,  cost: { aguijon_reina: 1, oro: 20, esencia: 8 } },
  { item: 'espada_hielo',       world: 3, coins: 800,  cost: { hierro: 40, cristal_hielo: 25, esencia_hielo: 8 } },
  { item: 'armadura_congelada', world: 3, coins: 900,  cost: { cristal_hielo: 30, esencia_hielo: 10, oro: 15 } },
  { item: 'espada_fuego',       world: 4, coins: 1600, cost: { mineral_volcanico: 30, esencia_fuego: 12, cristal_rojo: 4 } },
  { item: 'armadura_lava',      world: 4, coins: 1800, cost: { mineral_volcanico: 40, cristal_rojo: 6, nucleo_hielo: 1 } },
  { item: 'espada_infernal',    world: 5, coins: 3000, cost: { hierro: 100, cristal_oscuro: 20, esencia_fuego: 5 } },
  { item: 'armadura_oscura',    world: 5, coins: 3500, cost: { cristal_oscuro: 30, oro_oscuro: 8, escama_dragon: 1 } },
  { item: 'hoja_caos',          world: 5, coins: 8000, cost: { alma_maldita: 1, fragmento_legendario: 5, esencia_demoniaca: 10 } },
  { item: 'armadura_caos',      world: 5, coins: 9000, cost: { alma_maldita: 1, fragmento_legendario: 6, oro_oscuro: 15 } },
  // Pociones
  { potion: 'pocion',        world: 1, coins: 10, cost: { madera: 5 } },
  { potion: 'pocion_grande', world: 2, coins: 50, cost: { esencia: 2, cristal: 2 } },
];

/* ---------- Habilidades ----------
   cd: segundos de recarga · mult: multiplicador del daño del jugador
   El efecto de cada una está en battle.js → castSkill()            */
const SKILLS = {
  fuego: { name: 'Ataque de fuego',  icon: '🔥', cd: 9,  mult: 1.8, radius: 52, burn: 2.5, desc: 'Lanza una bola de fuego que explota y quema a los enemigos cercanos.' },
  hielo: { name: 'Ataque de hielo',  icon: '❄️', cd: 12, mult: 1.6, freeze: 2.5, desc: 'Onda helada que daña y congela a los enemigos cercanos. A los de hielo solo los ralentiza.' },
  rayo:  { name: 'Ataque eléctrico', icon: '⚡', cd: 10, mult: 2.4, targets: 5, desc: 'Rayos que caen sobre los 5 enemigos más cercanos.' },
};
const SKILL_ORDER = ['fuego', 'hielo', 'rayo'];
const MAX_SKILL_LEVEL = 5;
/** Coste de mejorar una habilidad del nivel lvl al siguiente. Cada nivel: +20 % daño, -5 % recarga. */
const SKILL_UPGRADE = lvl => ({ coins: 150 * lvl * lvl, gems: 2 * lvl });

/* ---------- Enemigos ----------
   hp/atk: multiplicadores sobre la base de la etapa
   speed: px/s · range: alcance · size: tamaño
   ai: melee | ranged (dispara a distancia) | charger (embiste) |
       tank (golpe en área) · split: se divide al morir · float: flota
   sprite: { art (cuadro de assets/sprites.webp, opcional), shape: slime|wolf|scorpion|ghost|dragon|golem|flame|humanoid, ... }
   icon: emoji solo para listas de menús            */
const ENEMIES = {
  // Bosque
  slime:   { icon: '🟢', name: 'Slime',   hp: 0.8, atk: 0.7, speed: 34, range: 20, size: 26, ai: 'melee',   atkCd: 1.5, split: true, sprite: { art: 'slime', shape: 'slime', color: '#4ade80' } },
  lobo:    { icon: '🐺', name: 'Lobo',    hp: 0.9, atk: 1.0, speed: 62, range: 24, size: 36, ai: 'charger', atkCd: 1.1, sprite: { art: 'wolf', shape: 'wolf', color: '#78716c', eye: '#fde047' } },
  bandido: { icon: '🥷', name: 'Bandido', hp: 1.1, atk: 1.1, speed: 48, range: 26, size: 40, ai: 'melee',   atkCd: 1.2, sprite: { art: 'hood', shape: 'humanoid', body: '#7c2d12', skin: '#e0b48a', head: 'hood', hood: '#3f3f46', mask: '#991b1b', weapon: 'dagger' } },
  // Desierto
  escorpion:        { icon: '🦂', name: 'Escorpión',            hp: 1.0, atk: 1.1, speed: 50, range: 26, size: 36, ai: 'melee',  atkCd: 1.1, sprite: { art: 'scorpion', shape: 'scorpion', color: '#b45309', sting: '#84cc16' } },
  momia:            { icon: '🧟', name: 'Momia',                hp: 1.6, atk: 0.9, speed: 26, range: 24, size: 42, ai: 'melee',  atkCd: 1.4, sprite: { art: 'mummy', shape: 'humanoid', body: '#d6cfb4', skin: '#d6cfb4', head: 'wrap', eye: '#facc15' } },
  bandido_desierto: { icon: '🏹', name: 'Arquero del desierto', hp: 0.9, atk: 1.2, speed: 42, range: 170, size: 40, ai: 'ranged', atkCd: 2.0, proj: 'arrow', sprite: { art: 'archer', shape: 'humanoid', body: '#c2410c', skin: '#c08457', head: 'turban', hood: '#fde68a', weapon: 'bow' } },
  // Hielo
  lobo_hielo:         { icon: '🐺', name: 'Lobo de hielo',      hp: 1.0, atk: 1.1, speed: 66, range: 24, size: 38, ai: 'charger', atkCd: 1.0, resist: 'hielo', sprite: { art: 'icewolf', shape: 'wolf', color: '#cbd5e1', eye: '#38bdf8', aura: '#7dd3fc' } },
  golem_hielo:        { icon: '🗿', name: 'Gólem de hielo',     hp: 2.2, atk: 1.3, speed: 22, range: 30, size: 46, ai: 'tank',    atkCd: 1.8, resist: 'hielo', sprite: { art: 'icegolem', shape: 'golem', color: '#93c5fd', glow: '#e0f2fe' } },
  guerrero_congelado: { icon: '🥶', name: 'Guerrero congelado', hp: 1.3, atk: 1.2, speed: 40, range: 28, size: 42, ai: 'melee',   atkCd: 1.2, resist: 'hielo', sprite: { art: 'iceknight', shape: 'humanoid', body: '#3b82f6', skin: '#bfdbfe', head: 'helmet', weapon: 'sword', eye: '#e0f2fe', icicles: true } },
  // Volcán
  demonio:        { icon: '👹', name: 'Demonio',           hp: 1.2, atk: 1.3, speed: 50, range: 26, size: 40, ai: 'melee',  atkCd: 1.1, resist: 'fuego', sprite: { art: 'demon', shape: 'humanoid', body: '#450a0a', skin: '#dc2626', head: 'horns', weapon: 'claw', wings: true, tail: true, eye: '#fde047' } },
  criatura_fuego: { icon: '🔥', name: 'Criatura de fuego', hp: 0.9, atk: 1.2, speed: 50, range: 150, size: 32, ai: 'ranged', atkCd: 2.2, proj: 'fireball', resist: 'fuego', sprite: { art: 'flame', shape: 'flame', color: '#f97316' } },
  golem_lava:     { icon: '🪨', name: 'Gólem de lava',     hp: 2.3, atk: 1.4, speed: 22, range: 30, size: 48, ai: 'tank',   atkCd: 1.8, resist: 'fuego', sprite: { art: 'lavagolem', shape: 'golem', color: '#57190f', glow: '#fb923c' } },
  // Reino Oscuro
  caballero_oscuro: { icon: '🛡️', name: 'Caballero oscuro', hp: 1.6, atk: 1.3, speed: 40, range: 28, size: 44, ai: 'melee',  atkCd: 1.2, sprite: { art: 'darkknight', shape: 'humanoid', body: '#1f2937', skin: '#374151', head: 'helmet', weapon: 'sword', eye: '#ef4444', cape: '#450a0a', spikes: true } },
  mago_oscuro:      { icon: '🧙', name: 'Mago oscuro',      hp: 0.9, atk: 1.5, speed: 38, range: 180, size: 42, ai: 'ranged', atkCd: 2.1, proj: 'darkorb', sprite: { art: 'wizard', shape: 'humanoid', body: '#4c1d95', skin: '#a78bfa', head: 'wizard', hood: '#2e1065', weapon: 'staff', eye: '#f0abfc' } },
  criatura_maldita: { icon: '👻', name: 'Criatura maldita', hp: 1.0, atk: 1.2, speed: 58, range: 24, size: 38, ai: 'melee',  atkCd: 1.0, float: true, sprite: { art: 'ghost', shape: 'ghost', color: '#9333ea', eye: '#f0abfc' } },

  /* ----- Jefes -----
     attacks: leap (salto con impacto), slam (onda alrededor),
     zones (zonas del suelo que explotan), lob (anillo de impactos
     alrededor del jugador), volley (abanico de proyectiles),
     breath (línea de fuego), charge (embestida), spin (anillo de
     proyectiles) y summon:<id> (invoca esbirros)                   */
  rey_lobo: {
    icon: '🐺', name: 'Rey Lobo', boss: true, hp: 18, atk: 1.6, speed: 60, range: 46, size: 84, ai: 'melee', atkCd: 1.3,
    sprite: { art: 'kingwolf', shape: 'wolf', color: '#44403c', eye: '#ef4444', crown: true, aura: '#fbbf24' }, zoneFx: 'claw',
    attacks: ['charge', 'summon:lobo', 'leap', 'slam', 'charge'], specialCd: 4.2,
  },
  reina_escorpion: {
    icon: '🦂', name: 'Reina Escorpión', boss: true, hp: 22, atk: 1.7, speed: 48, range: 50, size: 88, ai: 'melee', atkCd: 1.3,
    sprite: { art: 'queenscorp', shape: 'scorpion', color: '#7c2d12', sting: '#a3e635', crown: true }, proj: 'poison', zoneFx: 'poison',
    attacks: ['volley', 'lob', 'slam', 'summon:escorpion'], specialCd: 4.0,
  },
  golem_hielo_boss: {
    icon: '🗿', name: 'Gólem de Hielo', boss: true, hp: 26, atk: 1.8, speed: 28, range: 56, size: 96, ai: 'melee', atkCd: 1.6,
    resist: 'hielo', sprite: { art: 'icegolem', shape: 'golem', color: '#bae6fd', glow: '#ffffff', crystals: true, crown: true }, proj: 'ice', zoneFx: 'ice',
    attacks: ['zones', 'slam', 'leap', 'summon:lobo_hielo', 'spin'], specialCd: 3.8,
  },
  dragon: {
    icon: '🐉', name: 'Dragón Volcánico', boss: true, hp: 30, atk: 1.9, speed: 46, range: 64, size: 110, ai: 'melee', atkCd: 1.4,
    resist: 'fuego', sprite: { art: 'dragon', shape: 'dragon', color: '#b91c1c', belly: '#fbbf24' }, proj: 'fireball', zoneFx: 'meteor',
    attacks: ['breath', 'zones', 'charge', 'lob', 'volley'], specialCd: 3.6,
  },
  caballero_maldito: {
    icon: '💀', name: 'Caballero Maldito', boss: true, hp: 34, atk: 2.0, speed: 52, range: 54, size: 96, ai: 'melee', atkCd: 1.2,
    sprite: { art: 'darkking', shape: 'humanoid', body: '#111827', skin: '#1f2937', head: 'crown', weapon: 'sword', eye: '#a855f7', aura: '#7e22ce', cape: '#3b0764', spikes: true }, proj: 'darkorb', zoneFx: 'dark',
    attacks: ['charge', 'spin', 'zones', 'summon:criatura_maldita', 'leap', 'volley'], specialCd: 3.4,
  },
};

/* ---------- Ruletas ----------
   odds: probabilidad (%) de cada rareza.
   prizes: casillas; r = rareza. Tipos de premio:
     mat+qty · potion+qty · item · skill · gems · coins · bundle:[...]  */
const WHEELS = {
  madera: {
    name: 'Ruleta de Madera', icon: '🪵', world: 1, wood: '#8b5a2b', rim: '#5b3415',
    cost: { madera: 10, piedra: 6 }, gemCost: 2,
    odds: { comun: 50, pococomun: 30, raro: 12, epico: 6, legendario: 1.8, mitico: 0.2 },
    prizes: [
      { r: 'comun', mat: 'madera', qty: 15 },
      { r: 'comun', mat: 'piedra', qty: 12 },
      { r: 'pococomun', mat: 'hierro', qty: 10 },
      { r: 'pococomun', potion: 'pocion', qty: 2 },
      { r: 'pococomun', item: 'espada_oxidada' },
      { r: 'raro', item: 'armadura_basica' },
      { r: 'epico', item: 'espada_hierro' },
      { r: 'legendario', item: 'espada_acero' },
      { r: 'mitico', bundle: [{ item: 'espada_acero' }, { item: 'armadura_reforzada' }, { gems: 10 }] },
    ],
  },
  hierro: {
    name: 'Ruleta de Hierro', icon: '⚙️', world: 2, wood: '#64748b', rim: '#334155',
    cost: { hierro: 15, cristal: 5 }, gemCost: 3,
    odds: { comun: 42, pococomun: 32, raro: 15, epico: 8, legendario: 2.5, mitico: 0.5 },
    prizes: [
      { r: 'comun', mat: 'hierro', qty: 20 },
      { r: 'comun', mat: 'oro', qty: 6 },
      { r: 'pococomun', mat: 'cristal', qty: 10 },
      { r: 'pococomun', potion: 'pocion_grande', qty: 1 },
      { r: 'raro', item: 'espada_acero' },
      { r: 'raro', mat: 'esencia', qty: 5 },
      { r: 'epico', item: 'armadura_reforzada' },
      { r: 'legendario', item: 'cimitarra' },
      { r: 'mitico', bundle: [{ item: 'armadura_escamas' }, { gems: 15 }] },
    ],
  },
  hielo: {
    name: 'Ruleta de Hielo', icon: '🧊', world: 3, wood: '#0ea5e9', rim: '#075985',
    cost: { cristal_hielo: 15, esencia_hielo: 3 }, gemCost: 4,
    odds: { comun: 35, pococomun: 32, raro: 18, epico: 10, legendario: 4, mitico: 1 },
    prizes: [
      { r: 'comun', mat: 'cristal_hielo', qty: 20 },
      { r: 'comun', mat: 'hierro', qty: 25 },
      { r: 'pococomun', mat: 'esencia_hielo', qty: 6 },
      { r: 'pococomun', potion: 'pocion_grande', qty: 2 },
      { r: 'raro', skill: 'hielo' },
      { r: 'raro', mat: 'oro', qty: 12 },
      { r: 'epico', item: 'armadura_congelada' },
      { r: 'legendario', item: 'espada_hielo' },
      { r: 'mitico', bundle: [{ item: 'espada_hielo' }, { mat: 'nucleo_hielo', qty: 1 }, { gems: 20 }] },
    ],
  },
  volcanica: {
    name: 'Ruleta Volcánica', icon: '🌋', world: 4, wood: '#b45309', rim: '#7c2d12',
    cost: { mineral_volcanico: 15, esencia_fuego: 4 }, gemCost: 5,
    odds: { comun: 28, pococomun: 30, raro: 22, epico: 13, legendario: 5.5, mitico: 1.5 },
    prizes: [
      { r: 'comun', mat: 'mineral_volcanico', qty: 25 },
      { r: 'comun', mat: 'oro', qty: 15 },
      { r: 'pococomun', mat: 'esencia_fuego', qty: 8 },
      { r: 'pococomun', mat: 'cristal_rojo', qty: 3 },
      { r: 'raro', skill: 'fuego' },
      { r: 'raro', potion: 'pocion_grande', qty: 3 },
      { r: 'epico', item: 'armadura_lava' },
      { r: 'legendario', item: 'espada_fuego' },
      { r: 'mitico', bundle: [{ item: 'espada_fuego' }, { item: 'armadura_lava' }, { mat: 'escama_dragon', qty: 1 }] },
    ],
  },
  legendaria: {
    name: 'Ruleta Legendaria', icon: '👑', world: 5, wood: '#6d28d9', rim: '#facc15',
    cost: { cristal_oscuro: 15, esencia_demoniaca: 3 }, gemCost: 6,
    odds: { comun: 20, pococomun: 28, raro: 25, epico: 17, legendario: 8, mitico: 2 },
    prizes: [
      { r: 'comun', mat: 'cristal_oscuro', qty: 20 },
      { r: 'comun', potion: 'pocion_grande', qty: 3 },
      { r: 'pococomun', mat: 'esencia_demoniaca', qty: 5 },
      { r: 'pococomun', mat: 'oro_oscuro', qty: 4 },
      { r: 'raro', skill: 'rayo' },
      { r: 'raro', mat: 'fragmento_legendario', qty: 2 },
      { r: 'epico', item: 'armadura_oscura' },
      { r: 'legendario', item: 'espada_inframundo' },
      { r: 'mitico', item: 'hoja_caos' },
      { r: 'mitico', item: 'armadura_caos' },
    ],
  },
};

/* ---------- Mundos ----------
   drops: peso de cada material al caer de un enemigo
   chestItems: objetos que pueden salir en el cofre de etapa
   bossSkill: habilidad que se desbloquea al vencer al jefe por primera vez */
const STAGES_PER_WORLD = 5;
const WORLDS = [
  {
    id: 1, name: 'Bosque', icon: '🌲', theme: 'bosque', wheel: 'madera',
    enemies: ['slime', 'lobo', 'bandido'], boss: 'rey_lobo', bossDrop: 'colmillo_rey', bossSkill: 'hielo',
    drops: { madera: 34, piedra: 28, hierro: 22, cristal: 2 },
    chestItems: ['espada_oxidada', 'armadura_basica', 'espada_hierro'],
    stageNames: ['Claro del bosque', 'Sendero de los lobos', 'Campamento bandido', 'Bosque profundo', 'Guarida del Rey Lobo'],
  },
  {
    id: 2, name: 'Desierto', icon: '🏜️', theme: 'desierto', wheel: 'hierro',
    enemies: ['escorpion', 'momia', 'bandido_desierto'], boss: 'reina_escorpion', bossDrop: 'aguijon_reina', bossSkill: 'rayo',
    drops: { hierro: 30, cristal: 20, oro: 14, esencia: 7, piedra: 12 },
    chestItems: ['espada_hierro', 'armadura_cuero', 'espada_acero'],
    stageNames: ['Dunas ardientes', 'Oasis perdido', 'Tumbas olvidadas', 'Templo de arena', 'Nido de la Reina'],
  },
  {
    id: 3, name: 'Montañas de Hielo', icon: '🏔️', theme: 'hielo', wheel: 'hielo',
    enemies: ['lobo_hielo', 'golem_hielo', 'guerrero_congelado'], boss: 'golem_hielo_boss', bossDrop: 'nucleo_hielo', bossSkill: null,
    drops: { cristal_hielo: 30, hierro: 24, esencia_hielo: 11, oro: 12, cristal: 6 },
    chestItems: ['armadura_reforzada', 'cimitarra', 'armadura_congelada'],
    stageNames: ['Paso nevado', 'Lago congelado', 'Cumbre helada', 'Fortaleza de escarcha', 'Corazón del glaciar'],
  },
  {
    id: 4, name: 'Volcán', icon: '🌋', theme: 'volcan', wheel: 'volcanica',
    enemies: ['demonio', 'criatura_fuego', 'golem_lava'], boss: 'dragon', bossDrop: 'escama_dragon', bossSkill: null,
    drops: { mineral_volcanico: 30, esencia_fuego: 16, cristal_rojo: 5, oro: 15, hierro: 14 },
    chestItems: ['armadura_congelada', 'espada_hielo', 'armadura_lava'],
    stageNames: ['Ríos de lava', 'Cavernas ígneas', 'Forja demoníaca', 'Cráter ardiente', 'Trono del Dragón'],
  },
  {
    id: 5, name: 'Reino Oscuro', icon: '🏰', theme: 'oscuro', wheel: 'legendaria',
    enemies: ['caballero_oscuro', 'mago_oscuro', 'demonio', 'criatura_maldita'], boss: 'caballero_maldito', bossDrop: 'alma_maldita', bossSkill: null,
    drops: { cristal_oscuro: 28, esencia_demoniaca: 9, oro_oscuro: 9, fragmento_legendario: 2, hierro: 20, esencia_fuego: 6 },
    chestItems: ['espada_fuego', 'armadura_lava', 'armadura_oscura'],
    stageNames: ['Puertas malditas', 'Cementerio de reyes', 'Torre del hechicero', 'Salón de las sombras', 'Trono del Caos'],
  },
];

/* ---------- Balance ---------- */
const BALANCE = {
  hpBase: 30, hpGrowth: 1.15,        // vida enemiga por etapa
  atkBase: 6, atkGrowth: 1.145,      // daño enemigo por etapa
  xpBase: 6, xpGrowth: 1.14,
  coinBase: 3, coinGrowth: 1.13,
  powerBase: 85, powerGrowth: 1.145, // poder recomendado
  enemyDmgBase: 2.05, enemyDmgStep: 0.1, // multiplicador extra de daño enemigo (crece por etapa)
  bossDmg: 0.85, bossHp: 1.35, bossHitCap: 0.22, hitCap: 0.35, // los jefes no quitan más del 22 % de la vida por golpe
  attackRate: 1.8, hitDamage: 0.7,  // golpes por segundo (x velocidad) y daño de cada golpe
  levelHp: 10, levelDmg: 2, levelDef: 1, pointsPerLevel: 2,
  pointHp: 8, pointDmg: 1.5, pointDef: 1, pointSpd: 0.03,
};

/* ---------- Inicio suave ----------
   Las primeras etapas enseñan a jugar: menos vida y daño enemigo y
   menos enemigos. A partir de la etapa 5 se usa el escalado normal. */
const EARLY_STAGES = {
  1: { hp: 0.55, atk: 0.4,  count: 5, alive: 2 },   // casi un tutorial
  2: { hp: 0.72, atk: 0.58, count: 6, alive: 3 },
  3: { hp: 0.86, atk: 0.75, count: 7, alive: 3 },
  4: { hp: 0.96, atk: 0.9,  count: 8, alive: 3 },
  5: { hp: 0.9,  atk: 0.95 },                        // primer jefe: duro pero justo
};

/* ---------- Recompensas de primera victoria ----------
   Se dan una sola vez, además del cofre. Aquí está la primera mejora
   temprana (espada oxidada al ganar la etapa 1). */
const FIRST_CLEAR = {
  1: [{ item: 'espada_oxidada' }],
  2: [{ item: 'armadura_basica' }, { potion: 'pocion', qty: 2 }],
  3: [{ skill: 'fuego' }, { tickets: 1 }],
  4: [{ mat: 'hierro', qty: 18 }, { mat: 'piedra', qty: 10 }],
  6: [{ potion: 'pocion_grande', qty: 1 }],
  8: [{ mat: 'cristal', qty: 6 }],
  11: [{ tickets: 1 }],
  16: [{ tickets: 1 }],
  21: [{ tickets: 2 }],
};

/* ---------- Tickets de ruleta ----------
   🎟️ sirven para girar cualquier ruleta desbloqueada. Cada etapa
   completada da un fragmento; con TICKET_SHARDS se forma un ticket. */
const TICKET_SHARDS = 3;

/* ---------- Combo de derrotas ----------
   Sube al derrotar enemigos seguidos y se pierde si pasan COMBO_WINDOW
   segundos sin derrotar a nadie. Cada nivel de combo suma daño. */
const COMBO_WINDOW = 4;
const COMBO_DMG_PER = 0.03, COMBO_DMG_MAX = 0.3;
const COMBO_REWARDS = {
  5:  { label: 'oro', coins: 4 },                    // coins = x monedas de la etapa
  10: { label: 'materiales', coins: 6, mats: 2 },
  15: { label: 'fragmento de ticket', shards: 1 },
  20: { label: '¡ticket y gemas!', tickets: 1, gems: 2 },
  30: { label: '¡botín legendario!', tickets: 1, gems: 4, mats: 4 },
};

/* ---------- Racha de victorias ----------
   Cada victoria seguida suma; perder o abandonar la reinicia. */
const STREAK = { bonusPer: 0.05, bonusMax: 0.5, ticketAt: [3, 5, 10, 15, 20] };

/* ---------- Rangos del caballero (evolución visual) ---------- */
const RANKS = [
  { level: 1,  name: 'Novato',         color: '#a8a29e' },
  { level: 5,  name: 'Guerrero',       color: '#4ade80' },
  { level: 10, name: 'Caballero',      color: '#60a5fa' },
  { level: 17, name: 'Veterano',       color: '#c084fc' },
  { level: 25, name: 'Legendario',     color: '#fb923c' },
  { level: 34, name: 'Señor del Caos', color: '#f43f5e' },
];
function rankOf(level) {
  let r = 0;
  RANKS.forEach((k, i) => { if (level >= k.level) r = i; });
  return r;
}

/* ---------- Misiones diarias ----------
   Cada día se eligen 3. goal puede depender del mundo alcanzado.
   ev: evento que las hace avanzar (kill, stage, coins, rare, combo, elite). */
const MISSIONS = [
  { id: 'kill',   ev: 'kill',   text: n => `Derrota ${n} enemigos`,            goal: w => 15 + w * 5,  reward: w => ({ coins: 60 * w }) },
  { id: 'stage',  ev: 'stage',  text: n => `Completa ${n} etapas`,             goal: () => 3,          reward: () => ({ tickets: 1 }) },
  { id: 'coins',  ev: 'coins',  text: n => `Consigue ${n} monedas en combate`, goal: w => 150 * w * w + 150, reward: () => ({ gems: 3 }) },
  { id: 'rare',   ev: 'rare',   text: n => `Consigue ${n} materiales raros o mejores`, goal: () => 2, reward: w => ({ gems: 2 + w }) },
  { id: 'combo',  ev: 'combo',  text: n => `Haz un combo de x${n}`,            goal: w => (w === 1 ? 6 : 10),          reward: () => ({ tickets: 1 }) },
  { id: 'elite',  ev: 'elite',  text: n => `Derrota ${n} enemigo${n > 1 ? 's' : ''} élite`, goal: () => 1, reward: w => ({ chest: true, coins: 40 * w }) },
  { id: 'streak', ev: 'streak', text: n => `Consigue una racha de x${n}`,      goal: () => 3,          reward: () => ({ gems: 3 }) },
];
const MISSIONS_PER_DAY = 3;

/* ---------- Funciones de consulta ---------- */
const MAX_STAGE = WORLDS.length * STAGES_PER_WORLD;

function worldOfStage(stage) {
  return WORLDS[Math.min(WORLDS.length - 1, Math.floor((stage - 1) / STAGES_PER_WORLD))];
}
function isBossStage(stage) { return stage % STAGES_PER_WORLD === 0; }
function stageIndexInWorld(stage) { return (stage - 1) % STAGES_PER_WORLD; }

function stageInfo(stage) {
  const world = worldOfStage(stage);
  const s = stage - 1;
  const ease = EARLY_STAGES[stage] || {};
  const power = Math.round(BALANCE.powerBase * Math.pow(BALANCE.powerGrowth, s) * (ease.atk ? 0.5 + ease.atk * 0.5 : 1));
  return {
    stage, world, boss: isBossStage(stage),
    name: world.stageNames[stageIndexInWorld(stage)] || `Etapa ${stage}`,
    hp: BALANCE.hpBase * Math.pow(BALANCE.hpGrowth, s) * (ease.hp || 1),
    atk: BALANCE.atkBase * Math.pow(BALANCE.atkGrowth, s) * (ease.atk || 1),
    // Multiplicador extra de daño que crece por etapa (suavizado al inicio por ease.atk)
    dmgMult: BALANCE.enemyDmgBase + BALANCE.enemyDmgStep * s,
    xp: Math.round(BALANCE.xpBase * Math.pow(BALANCE.xpGrowth, s)),
    coins: Math.round(BALANCE.coinBase * Math.pow(BALANCE.coinGrowth, s)),
    power,
    enemyCount: ease.count || Math.min(20, 7 + Math.floor(stage * 0.6)),
    maxAlive: ease.alive || Math.min(4, 2 + Math.floor(stage / 6)),
    eliteChance: stage < 2 ? 0 : Math.min(0.1, 0.05 + stage * 0.002),
  };
}

function itemValue(id) { return RARITY_VALUE[ITEMS[id].rarity]; }
function xpForLevel(level) { return Math.round(40 + 30 * Math.pow(level, 1.6)); }

/** Elige una clave de un objeto {clave: peso} al azar según su peso. */
function weightedPick(weights) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = Math.random() * total;
  for (const k in weights) { r -= weights[k]; if (r < 0) return k; }
  return Object.keys(weights)[0];
}

/* =====================================================================
   SISTEMAS EXTRA: calendario, logros, mascotas, encantamientos,
   cosméticos, definitiva, fases de jefe y Torre del Caos
   ===================================================================== */

/* ---------- Calendario de 7 días ----------
   Se reclama una vez al día. Si pasa más de un día sin entrar, vuelve al día 1.
   El oro escala con el mundo más alto alcanzado (w). */
const LOGIN_REWARDS = [
  { icon: '💰', label: w => `${200 * w} oro`,   prize: w => ({ coins: 200 * w }) },
  { icon: '🧪', label: () => '3 pociones',        prize: () => ({ potion: 'pocion', qty: 3 }) },
  { icon: '🎟️', label: () => '1 ticket',          prize: () => ({ tickets: 1 }) },
  { icon: '💎', label: () => '5 cristales',       prize: () => ({ gems: 5 }) },
  { icon: '⚗️', label: () => '2 pociones grandes', prize: () => ({ potion: 'pocion_grande', qty: 2 }) },
  { icon: '🎟️', label: () => '2 tickets',         prize: () => ({ tickets: 2 }) },
  { icon: '👑', label: () => 'Cofre épico + 10 💎', prize: () => ({ epicChest: true, gems: 10 }) },
];

/* ---------- Logros ----------
   Cada logro tiene 3 medallas (bronce, plata, oro) con su meta y su premio.
   value(S) devuelve el progreso actual a partir del estado del jugador. */
const MEDALS = [
  { name: 'Bronce', icon: '🥉', color: '#d97706' },
  { name: 'Plata',  icon: '🥈', color: '#cbd5e1' },
  { name: 'Oro',    icon: '🥇', color: '#facc15' },
];
const ACHIEVEMENTS = [
  { id: 'kills',   icon: '☠️', name: 'Cazador',          text: n => `Derrota ${n} enemigos`,            goals: [100, 1000, 5000],  gems: [3, 8, 20], value: S => S.stats.kills },
  { id: 'bosses',  icon: '👹', name: 'Matajefes',        text: n => `Derrota ${n} jefes`,               goals: [1, 10, 40],        gems: [3, 8, 20], value: S => Object.values(S.bossKills).reduce((a, b) => a + b, 0) },
  { id: 'worlds',  icon: '🗺️', name: 'Conquistador',     text: n => `Conquista ${n} mundo${n > 1 ? 's' : ''}`, goals: [1, 3, 5], gems: [5, 10, 25], value: S => WORLDS.filter(w => S.bossKills[w.boss]).length },
  { id: 'combo',   icon: '🔥', name: 'Imparable',        text: n => `Haz un combo de x${n}`,            goals: [10, 25, 50],       gems: [3, 8, 20], value: S => S.stats.bestCombo },
  { id: 'level',   icon: '⭐', name: 'Veterano',         text: n => `Llega al nivel ${n}`,              goals: [10, 25, 50],       gems: [3, 8, 20], value: S => S.level },
  { id: 'crafted', icon: '🔨', name: 'Herrero',          text: n => `Forja o mejora ${n} veces`,        goals: [5, 25, 75],        gems: [3, 6, 15], value: S => S.stats.crafted },
  { id: 'spins',   icon: '🎰', name: 'Afortunado',       text: n => `Gira la ruleta ${n} veces`,        goals: [10, 50, 200],      gems: [3, 6, 15], value: S => S.stats.spins },
  { id: 'elites',  icon: '⭐', name: 'Azote de élites',  text: n => `Derrota ${n} élites`,              goals: [5, 30, 100],       gems: [3, 8, 20], value: S => S.stats.elites },
  { id: 'tower',   icon: '🏰', name: 'Escalador',        text: n => `Llega al piso ${n} de la Torre`,   goals: [10, 25, 50],       gems: [5, 12, 30], value: S => S.tower.best },
  { id: 'nopot',   icon: '🧪', name: 'Sin ayuda',        text: n => `Vence ${n} jefe${n > 1 ? 's' : ''} sin usar pociones`, goals: [1, 5, 15], gems: [5, 10, 20], value: S => S.stats.noPotionBoss || 0 },
  { id: 'dragon',  icon: '🐉', name: 'Matadragones',     text: n => `Vence al Dragón Volcánico ${n} ${n > 1 ? 'veces' : 'vez'}`, goals: [1, 5, 20], gems: [5, 10, 20], value: S => S.bossKills.dragon || 0 },
  { id: 'pets',    icon: '🐾', name: 'Domador',          text: n => `Consigue ${n} mascota${n > 1 ? 's' : ''}`, goals: [1, 3, 5], gems: [3, 8, 20], value: S => Object.keys(S.pets.owned).length },
  { id: 'login',   icon: '📅', name: 'Fiel',             text: n => `Entra ${n} días`,                  goals: [3, 7, 30],         gems: [3, 8, 20], value: S => S.login.total },
  { id: 'enchant', icon: '🪄', name: 'Encantador',       text: n => `Encanta ${n} arma${n > 1 ? 's' : ''}`, goals: [1, 3, 6],      gems: [3, 6, 15], value: S => Object.keys(S.enchants).length },
];

/* ---------- Mascotas ----------
   Te siguen en combate y atacan solas. Se consiguen al vencer por primera
   vez al jefe indicado (o, después, con cierta probabilidad en su cofre).
   kind: melee (muerde de cerca) o ranged (dispara). dmg = % del daño del jugador. */
const PETS = {
  lobito:     { name: 'Lobito',          icon: '🐺', art: 'wolf',     size: 24, kind: 'melee',  dmg: 0.32, cd: 1.0, range: 26,  from: 'rey_lobo',         desc: 'Muerde rápido a los enemigos cercanos.' },
  escorpion:  { name: 'Escorpioncito',   icon: '🦂', art: 'scorpion', size: 22, kind: 'melee',  dmg: 0.26, cd: 1.1, range: 24,  from: 'reina_escorpion',  desc: 'Su picadura envenena.', poison: true },
  lobo_hielo: { name: 'Cachorro de hielo', icon: '❄️', art: 'icewolf', size: 24, kind: 'melee', dmg: 0.3, cd: 1.1, range: 26,  from: 'golem_hielo_boss', desc: 'Sus mordiscos ralentizan.', slow: true },
  llamita:    { name: 'Llamita',         icon: '🔥', art: 'flame',    size: 20, kind: 'ranged', dmg: 0.36, cd: 1.6, range: 170, from: 'dragon',           desc: 'Lanza bolas de fuego desde lejos.', proj: 'fireball' },
  fantasma:   { name: 'Espectro',        icon: '👻', art: 'ghost',    size: 24, kind: 'ranged', dmg: 0.42, cd: 1.8, range: 190, from: 'caballero_maldito', desc: 'Dispara orbes oscuros que atraviesan.', proj: 'darkorb' },
};
const PET_ORDER = ['lobito', 'escorpion', 'lobo_hielo', 'llamita', 'fantasma'];
const PET_MAX_LEVEL = 10;
const petXpFor = lvl => 20 + lvl * lvl * 12;      // experiencia (derrotas) para el siguiente nivel
const petMult = lvl => 1 + 0.15 * (lvl - 1);

/* ---------- Encantamientos ----------
   Una piedra de encantamiento da un efecto al arma equipada (uno por arma). */
const ENCHANTS = {
  veneno:  { name: 'Veneno',        icon: '🧪', color: '#84cc16', desc: 'Los golpes envenenan: daño durante 3 s.', cost: { esencia: 3, cristal: 6 }, coins: 400, gems: 3 },
  vampiro: { name: 'Robo de vida',  icon: '🩸', color: '#ef4444', desc: 'Recuperas el 6% del daño que haces.',     cost: { esencia: 4, oro: 6 }, coins: 600, gems: 4 },
  llama:   { name: 'Golpe ígneo',   icon: '🔥', color: '#fb923c', desc: '+8% de crítico y los críticos queman.',   cost: { esencia_fuego: 4, mineral_volcanico: 8 }, coins: 900, gems: 5 },
  escarcha:{ name: 'Escarcha',      icon: '❄️', color: '#7dd3fc', desc: 'Los golpes ralentizan al enemigo 2 s.',   cost: { esencia_hielo: 4, cristal_hielo: 8 }, coins: 700, gems: 4 },
};
const ENCHANT_ORDER = ['veneno', 'vampiro', 'escarcha', 'llama'];

/* ---------- Cosméticos (solo cambian el aspecto) ----------
   type: aura (brillo alrededor del caballero) o trail (estela al moverse).
   Se compran con cristales o se desbloquean con un logro (ach: id + medalla). */
const COSMETICS = {
  aura_dorada:  { type: 'aura',  name: 'Aura dorada',      icon: '✨', color: '#facc15', gems: 40 },
  aura_hielo:   { type: 'aura',  name: 'Aura de escarcha', icon: '❄️', color: '#7dd3fc', gems: 40 },
  aura_fuego:   { type: 'aura',  name: 'Aura de fuego',    icon: '🔥', color: '#f97316', ach: ['dragon', 0] },
  aura_sombra:  { type: 'aura',  name: 'Aura de sombra',   icon: '🌑', color: '#a855f7', ach: ['worlds', 2] },
  estela_luz:   { type: 'trail', name: 'Estela de luz',    icon: '💫', color: '#fde68a', gems: 25 },
  estela_hojas: { type: 'trail', name: 'Estela de hojas',  icon: '🍃', color: '#84cc16', gems: 25 },
  estela_fuego: { type: 'trail', name: 'Estela de brasas', icon: '🔥', color: '#fb923c', ach: ['combo', 1] },
  estela_caos:  { type: 'trail', name: 'Estela del Caos',  icon: '🌀', color: '#f43f5e', ach: ['tower', 1] },
};
const COSMETIC_ORDER = ['aura_dorada', 'aura_hielo', 'aura_fuego', 'aura_sombra', 'estela_luz', 'estela_hojas', 'estela_fuego', 'estela_caos'];

/* ---------- Definitiva: "Furia del Caos" ----------
   La barra se llena al golpear y al recibir daño. */
const ULTIMATE = { name: 'Furia del Caos', icon: '💥', mult: 4.5, bossMult: 2.2, fillHit: 0.035, fillKill: 0.06, fillHurt: 0.05 };

/* ---------- Segunda fase de los jefes (al 50 % de vida) ----------
   Ataques que se añaden y nombre de la fase. */
const BOSS_PHASE2 = {
  rey_lobo:          { title: 'Aullido de la manada', attacks: ['howl', 'charge', 'leap', 'charge', 'summon:lobo'] },
  reina_escorpion:   { title: 'Furia venenosa',       attacks: ['volley', 'lob', 'spin', 'slam', 'volley'] },
  golem_hielo_boss:  { title: 'Ventisca eterna',      attacks: ['zones', 'spin', 'leap', 'zones', 'summon:lobo_hielo'] },
  dragon:            { title: 'Vuelo infernal',       attacks: ['fly', 'breath', 'charge', 'fly', 'volley'] },
  caballero_maldito: { title: 'Corona del Caos',      attacks: ['spin', 'zones', 'charge', 'volley', 'summon:criatura_maldita', 'spin'] },
};

/* ---------- Torre del Caos (modo infinito) ----------
   Se desbloquea al vencer al primer jefe. Cada piso es una oleada más dura;
   cada 5 pisos aparece un jefe y hay premio. La vida se conserva entre pisos
   (se recupera un 25 % cada 5). */
const TOWER = { unlockStage: 5, milestone: 5, milestonePrize: f => ({ tickets: 1, gems: 2 + Math.floor(f / 10) }) };
const TOWER_BOSSES = ['rey_lobo', 'reina_escorpion', 'golem_hielo_boss', 'dragon', 'caballero_maldito'];
function towerInfo(floor) {
  const hw = Math.max(1, ...WORLDS.map(w => w.id));
  const base = stageInfo(Math.min(MAX_STAGE, 2 + floor));
  const extra = Math.pow(1.1, Math.max(0, floor + 2 - MAX_STAGE));
  const world = WORLDS[Math.floor((floor - 1) / TOWER.milestone) % hw];   // cambia de mundo cada 5 pisos
  return Object.assign({}, base, {
    world, tower: true, floor, boss: floor % TOWER.milestone === 0,
    name: `Piso ${floor}`,
    hp: base.hp * extra, atk: base.atk * extra, dmgMult: base.dmgMult * (1 + Math.max(0, floor - MAX_STAGE) * 0.02),
    enemyCount: Math.min(14, 4 + Math.floor(floor / 2)), maxAlive: Math.min(5, 2 + Math.floor(floor / 6)),
    eliteChance: Math.min(0.2, 0.05 + floor * 0.004),
  });
}

/* ---------- Servidor de cuentas (Supabase) ----------
   Cuentas con usuario y contraseña para cualquier jugador, partida guardada
   y ranking compartido. La clave "publishable" es pública por diseño: las
   reglas de seguridad (RLS) de la base de datos hacen que cada jugador solo
   pueda leer y guardar su propia partida. Ver supabase.sql. */
const ONLINE = {
  url: 'https://texjrivlrvrejuynfwon.supabase.co',
  key: 'sb_publishable_th04FG8XGA0v5oMflRGt_Q_7lLD-ExH',
  emailDomain: 'jugadores.reinosdelcaos.app',   // el usuario se convierte en un correo interno (nadie recibe correos)
};
