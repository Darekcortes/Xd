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
  fuego: { name: 'Ataque de fuego',  icon: '🔥', cd: 8,  mult: 3.0, desc: 'Lanza una bola de fuego que explota y quema a los enemigos cercanos.' },
  hielo: { name: 'Ataque de hielo',  icon: '❄️', cd: 12, mult: 1.6, freeze: 2.5, desc: 'Onda helada que daña y congela a todos los enemigos.' },
  rayo:  { name: 'Ataque eléctrico', icon: '⚡', cd: 10, mult: 2.4, targets: 5, desc: 'Rayos que caen sobre los 5 enemigos más cercanos.' },
};
const SKILL_ORDER = ['fuego', 'hielo', 'rayo'];
const MAX_SKILL_LEVEL = 5;

/* ---------- Enemigos ----------
   hp/atk: multiplicadores sobre la base de la etapa
   speed: px/s · range: alcance · size: tamaño · ai: melee | ranged
   sprite: { emoji } o { shape: slime|golem|flame|humanoid, ... }
   icon: emoji para menús (si falta se usa sprite.emoji)            */
const ENEMIES = {
  // Bosque
  slime:   { icon: '🟢', name: 'Slime',   hp: 0.8, atk: 0.7, speed: 30, range: 20, size: 26, ai: 'melee', atkCd: 1.5, sprite: { shape: 'slime', color: '#4ade80' } },
  lobo:    { name: 'Lobo',    hp: 0.9, atk: 1.0, speed: 62, range: 24, size: 34, ai: 'melee', atkCd: 1.1, sprite: { emoji: '🐺' } },
  bandido: { icon: '🥷', name: 'Bandido', hp: 1.1, atk: 1.1, speed: 44, range: 26, size: 40, ai: 'melee', atkCd: 1.2, sprite: { shape: 'humanoid', body: '#7c2d12', skin: '#e0b48a', head: 'hood', hood: '#3f3f46', weapon: 'dagger' } },
  // Desierto
  escorpion:        { name: 'Escorpión',          hp: 1.0, atk: 1.1, speed: 50, range: 24, size: 34, ai: 'melee',  atkCd: 1.1, sprite: { emoji: '🦂' } },
  momia:            { icon: '🧟', name: 'Momia',              hp: 1.6, atk: 0.9, speed: 24, range: 24, size: 42, ai: 'melee',  atkCd: 1.4, sprite: { shape: 'humanoid', body: '#d6cfb4', skin: '#d6cfb4', head: 'wrap', eye: '#facc15' } },
  bandido_desierto: { icon: '🏹', name: 'Arquero del desierto', hp: 0.9, atk: 1.2, speed: 40, range: 150, size: 40, ai: 'ranged', atkCd: 2.0, proj: 'arrow', sprite: { shape: 'humanoid', body: '#c2410c', skin: '#c08457', head: 'turban', hood: '#fde68a', weapon: 'bow' } },
  // Hielo
  lobo_hielo:         { name: 'Lobo de hielo',      hp: 1.0, atk: 1.1, speed: 66, range: 24, size: 36, ai: 'melee', atkCd: 1.0, sprite: { emoji: '🐺', aura: '#7dd3fc' } },
  golem_hielo:        { icon: '🗿', name: 'Gólem de hielo',     hp: 2.2, atk: 1.3, speed: 18, range: 30, size: 46, ai: 'melee', atkCd: 1.8, sprite: { shape: 'golem', color: '#93c5fd', glow: '#e0f2fe' } },
  guerrero_congelado: { icon: '🥶', name: 'Guerrero congelado', hp: 1.3, atk: 1.2, speed: 38, range: 28, size: 42, ai: 'melee', atkCd: 1.2, sprite: { shape: 'humanoid', body: '#3b82f6', skin: '#bfdbfe', head: 'helmet', weapon: 'sword', eye: '#e0f2fe' } },
  // Volcán
  demonio:         { name: 'Demonio',           hp: 1.2, atk: 1.3, speed: 48, range: 26, size: 38, ai: 'melee',  atkCd: 1.1, sprite: { emoji: '👹' } },
  criatura_fuego:  { icon: '🔥', name: 'Criatura de fuego', hp: 0.9, atk: 1.2, speed: 50, range: 140, size: 32, ai: 'ranged', atkCd: 2.2, proj: 'fireball', sprite: { shape: 'flame', color: '#f97316' } },
  golem_lava:      { icon: '🪨', name: 'Gólem de lava',     hp: 2.3, atk: 1.4, speed: 18, range: 30, size: 48, ai: 'melee',  atkCd: 1.8, sprite: { shape: 'golem', color: '#57190f', glow: '#fb923c' } },
  // Reino Oscuro
  caballero_oscuro:  { icon: '🛡️', name: 'Caballero oscuro',  hp: 1.6, atk: 1.3, speed: 38, range: 28, size: 44, ai: 'melee',  atkCd: 1.2, sprite: { shape: 'humanoid', body: '#1f2937', skin: '#374151', head: 'helmet', weapon: 'sword', eye: '#ef4444' } },
  mago_oscuro:       { icon: '🧙', name: 'Mago oscuro',       hp: 0.9, atk: 1.5, speed: 36, range: 160, size: 42, ai: 'ranged', atkCd: 2.1, proj: 'darkorb', sprite: { shape: 'humanoid', body: '#4c1d95', skin: '#a78bfa', head: 'wizard', hood: '#2e1065', weapon: 'staff', eye: '#f0abfc' } },
  criatura_maldita:  { name: 'Criatura maldita',  hp: 1.0, atk: 1.2, speed: 58, range: 24, size: 36, ai: 'melee',  atkCd: 1.0, float: true, sprite: { emoji: '👻', aura: '#a855f7' } },

  /* ----- Jefes -----
     attacks: leap (salto con impacto), slam (onda alrededor),
     zones (zonas del suelo que explotan), lob (proyectiles en arco),
     volley (proyectiles rectos), breath (aliento en cono),
     summon:<id> (invoca esbirros)                                   */
  rey_lobo: {
    name: 'Rey Lobo', boss: true, hp: 18, atk: 1.6, speed: 58, range: 46, size: 84, ai: 'melee', atkCd: 1.3,
    sprite: { emoji: '🐺', crown: true, aura: '#fbbf24' }, zoneFx: 'claw',
    attacks: ['leap', 'summon:lobo', 'leap', 'slam'], specialCd: 4.5,
  },
  reina_escorpion: {
    name: 'Reina Escorpión', boss: true, hp: 22, atk: 1.7, speed: 46, range: 50, size: 88, ai: 'melee', atkCd: 1.3,
    sprite: { emoji: '🦂', crown: true, aura: '#f59e0b' }, proj: 'poison', zoneFx: 'poison',
    attacks: ['lob', 'slam', 'summon:escorpion', 'volley'], specialCd: 4.2,
  },
  golem_hielo_boss: {
    icon: '🗿', name: 'Gólem de Hielo', boss: true, hp: 26, atk: 1.8, speed: 26, range: 56, size: 96, ai: 'melee', atkCd: 1.6,
    sprite: { shape: 'golem', color: '#bae6fd', glow: '#ffffff', crystals: true }, zoneFx: 'ice',
    attacks: ['zones', 'slam', 'summon:lobo_hielo', 'leap'], specialCd: 4.0,
  },
  dragon: {
    name: 'Dragón Volcánico', boss: true, hp: 30, atk: 1.9, speed: 44, range: 60, size: 104, ai: 'melee', atkCd: 1.4,
    sprite: { emoji: '🐉', aura: '#ef4444' }, proj: 'fireball', zoneFx: 'meteor',
    attacks: ['breath', 'zones', 'leap', 'lob'], specialCd: 3.8,
  },
  caballero_maldito: {
    icon: '💀', name: 'Caballero Maldito', boss: true, hp: 34, atk: 2.0, speed: 50, range: 54, size: 96, ai: 'melee', atkCd: 1.2,
    sprite: { shape: 'humanoid', body: '#111827', skin: '#1f2937', head: 'crown', weapon: 'sword', eye: '#a855f7', aura: '#7e22ce' }, proj: 'darkorb', zoneFx: 'dark',
    attacks: ['leap', 'volley', 'zones', 'summon:criatura_maldita', 'slam'], specialCd: 3.5,
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
    enemies: ['slime', 'lobo', 'bandido'], boss: 'rey_lobo', bossDrop: 'colmillo_rey', bossSkill: 'fuego',
    drops: { madera: 34, piedra: 28, hierro: 22, cristal: 2 },
    chestItems: ['espada_oxidada', 'armadura_basica', 'espada_hierro'],
    stageNames: ['Claro del bosque', 'Sendero de los lobos', 'Campamento bandido', 'Bosque profundo', 'Guarida del Rey Lobo'],
  },
  {
    id: 2, name: 'Desierto', icon: '🏜️', theme: 'desierto', wheel: 'hierro',
    enemies: ['escorpion', 'momia', 'bandido_desierto'], boss: 'reina_escorpion', bossDrop: 'aguijon_reina', bossSkill: 'hielo',
    drops: { hierro: 30, cristal: 20, oro: 14, esencia: 7, piedra: 12 },
    chestItems: ['espada_hierro', 'armadura_cuero', 'espada_acero'],
    stageNames: ['Dunas ardientes', 'Oasis perdido', 'Tumbas olvidadas', 'Templo de arena', 'Nido de la Reina'],
  },
  {
    id: 3, name: 'Montañas de Hielo', icon: '🏔️', theme: 'hielo', wheel: 'hielo',
    enemies: ['lobo_hielo', 'golem_hielo', 'guerrero_congelado'], boss: 'golem_hielo_boss', bossDrop: 'nucleo_hielo', bossSkill: 'rayo',
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
  hpBase: 30, hpGrowth: 1.145,       // vida enemiga por etapa
  atkBase: 6, atkGrowth: 1.145,      // daño enemigo por etapa
  xpBase: 6, xpGrowth: 1.14,
  coinBase: 3, coinGrowth: 1.13,
  powerBase: 85, powerGrowth: 1.145, // poder recomendado
  levelHp: 10, levelDmg: 2, levelDef: 1, pointsPerLevel: 2,
  pointHp: 8, pointDmg: 1.5, pointDef: 1, pointSpd: 0.03,
};

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
  return {
    stage, world, boss: isBossStage(stage),
    name: world.stageNames[stageIndexInWorld(stage)] || `Etapa ${stage}`,
    hp: BALANCE.hpBase * Math.pow(BALANCE.hpGrowth, s),
    atk: BALANCE.atkBase * Math.pow(BALANCE.atkGrowth, s),
    xp: Math.round(BALANCE.xpBase * Math.pow(BALANCE.xpGrowth, s)),
    coins: Math.round(BALANCE.coinBase * Math.pow(BALANCE.coinGrowth, s)),
    power: Math.round(BALANCE.powerBase * Math.pow(BALANCE.powerGrowth, s)),
    enemyCount: Math.min(18, 6 + Math.floor(stage * 0.6)),
    maxAlive: Math.min(4, 2 + Math.floor(stage / 6)),
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
