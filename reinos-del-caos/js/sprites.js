'use strict';
/* =====================================================================
   GRÁFICOS — personajes, enemigos y escenarios dibujados en canvas
   Todas las funciones dibujan con el origen en los pies (x, y).
   ===================================================================== */
const Sprites = (() => {
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
  }
  let skipShadow = false;
  function shadow(c, x, y, w) {
    if (skipShadow) return;
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.beginPath(); c.ellipse(x, y + 1, w, w * 0.25, 0, 0, Math.PI * 2); c.fill();
  }
  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v + amt)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };

  /** Mezcla dos colores hex (k = 0 → a, k = 1 → b). */
  const mix = (a, b, k) => {
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const ch = sh => Math.round(((A >> sh) & 255) * (1 - k) + ((B >> sh) & 255) * k);
    return '#' + [16, 8, 0].map(sh => ch(sh).toString(16).padStart(2, '0')).join('');
  };

  /* ---------- Guerrero del jugador ----------
     Diseño: caballero de acero oscuro con ribetes dorados, bufanda y capa
     azul marino rasgada con cruz dorada, cinturón de cuero y espada larga
     con guarda dorada y gema azul en el pomo.
     o: { face, walk, swing (0..1 o -1), heavy, time, weaponColor,
          armorColor, flash, helmet }                                   */
  const KP = {
    navy: '#1e3a5f', navyD: '#132741', navyL: '#2c5282',
    steel: '#545c6a', steelD: '#262b34', steelL: '#aab3c2',
    gold: '#c9a050', goldD: '#8a6a2c',
    leather: '#5a3a28', leatherL: '#7a5238', leatherD: '#3a2418',
    cloth: '#1c1c22', skin: '#e6bf9a', skinD: '#c49572', hair: '#2a1c14', hairL: '#45301f',
    gem: '#3b82f6',
  };

  /** Pose del brazo de la espada según el tipo de golpe.
      slash: tajo diagonal de arriba hacia abajo · thrust: estocada al frente ·
      smash: golpe vertical desde encima de la cabeza (golpe fuerte).
      Fases: preparación → corte rápido → recuperación.               */
  const SWING_POSES = {
    slash:  { up: -1.95, down: 1.1,  prep: 0.14, cut: 0.42, lean: 0.12 },
    smash:  { up: -1.55, down: 1.35, prep: 0.24, cut: 0.52, lean: 0.24 },   // golpe fuerte a una mano, sin pasar por detrás de la cabeza
  };
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  function swingPose(o, rest) {
    const t = o.swing;
    if (t < 0) return { ang: rest, ext: 0, lean: 0, trail: null };
    const style = o.style || (o.heavy ? 'smash' : 'slash');
    if (style === 'thrust') {
      // Recoge el brazo y lo lanza recto al frente
      const ang = 0.08;
      let ext, lean;
      if (t < 0.25) { const k = t / 0.25; ext = -5 * k; lean = -0.05 * k; }
      else if (t < 0.55) { const k = easeOut((t - 0.25) / 0.3); ext = -5 + 15 * k; lean = 0.14 * k; }
      else { const k = (t - 0.55) / 0.45; ext = 10 * (1 - k); lean = 0.14 * (1 - k); }
      return { ang: t < 0.55 ? ang : ang + (rest - ang) * ((t - 0.55) / 0.45), ext, lean, trail: t > 0.3 && t < 0.8 ? { thrust: true, a: 1 - Math.abs(t - 0.55) / 0.3 } : null };
    }
    const P = SWING_POSES[style];
    let ang, lean = 0, trail = null;
    if (t < P.prep) { const k = t / P.prep; ang = rest + (P.up - rest) * easeOut(k); lean = -0.06 * k; }
    else if (t < P.cut) {
      const k = easeOut((t - P.prep) / (P.cut - P.prep));
      ang = P.up + (P.down - P.up) * k; lean = P.lean * k;
      trail = { from: P.up, to: ang, a: 1 };
    } else {
      const k = (t - P.cut) / (1 - P.cut);
      ang = P.down + (rest - P.down) * k * k; lean = P.lean * (1 - k);
      if (k < 0.5) trail = { from: P.up + (P.down - P.up) * k * 1.6, to: P.down, a: 1 - k * 2 };
    }
    return { ang, ext: 0, lean, trail };
  }

  /* ---------- Arte ilustrado (atlas assets/sprites.webp) ----------
     Cuadros generados a partir del diseño con un esqueleto (caderas,
     rodillas, hombros, codos, manos, cola, alas...): por personaje hay
     10 pasos de caminata (_w), 4 de reposo (_i) y 4 de ataque (_a:
     preparación, carga completa, golpe y recuperación), más los golpes
     dibujados del caballero.
     Cada cuadro: [x, y, ancho, alto, anclaX, anclaY, escala] — el ancla son
     los pies y la escala es la del cuadro respecto al dibujo original.
     Si la imagen no carga (o se eligen gráficos clásicos) se usa el dibujo
     vectorial de siempre.                                              */
  const ART = {
    frames: {"k_slash1":[175,1777,134,132,92.2,135.1,0.7],"k_slash2":[176,1639,115,134,86.5,133.7,0.7],"k_slash3":[313,1777,108,132,65.2,130.2,0.7],"k_thrust1":[91,2309,147,120,36.9,119.0,0.7],"k_thrust2":[1060,2309,156,119,42.7,118.3,0.7],"k_thrust3":[618,2433,160,116,36.3,115.5,0.7],"k_raise":[0,0,107,185,51.3,184.1,0.7],"k_smash1":[1052,2047,153,127,46.9,127.4,0.7],"k_smash2":[988,1202,50,144,57.9,146.3,0.7],"k_smash3":[1964,1042,59,146,56.7,144.9,0.7],"slime_w0":[1659,3014,55,60,27.5,57.0,0.5],"flame_w0":[915,3014,52,90,26.1,89.0,0.5],"k_w0":[1748,1042,107,147,66.8,147.7,0.7],"k_w1":[1859,1042,101,147,59.8,148.4,0.7],"k_w2":[0,1202,105,146,61.2,148.4,0.7],"k_w3":[1042,1202,109,144,62.6,148.4,0.7],"k_w4":[1155,1202,111,144,63.3,148.4,0.7],"k_w5":[871,1202,113,145,68.2,147.7,0.7],"k_w6":[109,1202,111,146,69.6,146.3,0.7],"k_w7":[224,1202,111,146,70.3,144.9,0.7],"k_w8":[339,1202,111,146,70.3,144.9,0.7],"k_w9":[454,1202,111,146,69.6,146.3,0.7],"k_i0":[1320,1042,107,148,67.5,147.7,0.7],"k_i1":[1103,1042,105,149,67.5,147.7,0.7],"k_i2":[1212,1042,104,149,67.5,147.7,0.7],"k_i3":[1431,1042,107,148,68.2,147.7,0.7],"hood_w0":[636,2906,64,96,43.5,96.5,0.5],"hood_w1":[704,2906,58,96,39.0,96.0,0.5],"hood_w2":[951,2906,56,95,35.0,96.0,0.5],"hood_w3":[1011,2906,54,95,33.5,96.0,0.5],"hood_w4":[766,2906,54,96,34.0,96.0,0.5],"hood_w5":[824,2906,56,96,37.0,96.5,0.5],"hood_w6":[1546,2906,61,94,41.0,96.5,0.5],"hood_w7":[1611,2906,68,94,45.0,96.5,0.5],"hood_w8":[1683,2906,72,94,47.5,96.5,0.5],"hood_w9":[1759,2906,70,94,47.0,96.5,0.5],"hood_i0":[394,2906,57,96,38.0,96.0,0.5],"hood_i1":[455,2906,59,96,39.5,96.0,0.5],"hood_i2":[518,2906,56,96,37.0,96.0,0.5],"hood_i3":[578,2906,54,96,35.5,96.0,0.5],"hood_a0":[165,2906,82,96,62.5,95.5,0.5],"hood_a1":[251,2906,61,96,42.0,95.5,0.5],"hood_a2":[1466,2906,76,94,53.0,95.5,0.5],"hood_a3":[316,2906,74,96,54.0,96.0,0.5],"mummy_w0":[1263,3014,61,90,35.7,90.0,0.5],"mummy_w1":[1382,3014,52,89,29.2,89.5,0.5],"mummy_w2":[1555,3014,48,88,25.2,89.0,0.5],"mummy_w3":[1607,3014,48,88,25.2,89.0,0.5],"mummy_w4":[1438,3014,46,89,23.2,89.5,0.5],"mummy_w5":[1328,3014,50,90,27.2,90.0,0.5],"mummy_w6":[414,3014,58,92,33.7,90.5,0.5],"mummy_w7":[476,3014,68,92,38.7,90.5,0.5],"mummy_w8":[548,3014,73,92,40.7,90.5,0.5],"mummy_w9":[625,3014,70,92,39.2,90.5,0.5],"mummy_i0":[1036,3014,52,90,29.7,90.0,0.5],"mummy_i1":[1092,3014,54,90,30.7,90.0,0.5],"mummy_i2":[1150,3014,53,90,29.7,90.0,0.5],"mummy_i3":[1207,3014,52,90,28.7,90.0,0.5],"mummy_a0":[699,3014,66,91,42.7,90.5,0.5],"mummy_a1":[769,3014,72,91,48.2,90.5,0.5],"mummy_a2":[1488,3014,63,88,38.2,88.0,0.5],"mummy_a3":[971,3014,61,90,37.7,89.5,0.5],"archer_w0":[1333,2906,63,94,39.7,94.0,0.5],"archer_w1":[1833,2906,61,93,39.2,93.0,0.5],"archer_w2":[1898,2906,65,93,39.2,93.0,0.5],"archer_w3":[205,3014,67,92,39.2,92.5,0.5],"archer_w4":[1967,2906,66,93,39.2,93.0,0.5],"archer_w5":[1400,2906,62,94,39.2,94.0,0.5],"archer_w6":[0,3014,64,93,40.2,94.0,0.5],"archer_w7":[276,3014,64,92,40.7,94.0,0.5],"archer_w8":[344,3014,66,92,40.7,94.0,0.5],"archer_w9":[68,3014,65,93,40.7,94.0,0.5],"archer_i0":[1069,2906,62,94,40.2,94.0,0.5],"archer_i1":[1135,2906,62,94,40.2,94.0,0.5],"archer_i2":[1201,2906,62,94,40.7,94.0,0.5],"archer_i3":[1267,2906,62,94,40.7,94.0,0.5],"archer_a0":[884,2906,63,95,41.7,95.0,0.5],"archer_a1":[97,2906,64,96,43.7,95.5,0.5],"archer_a2":[845,3014,66,90,41.2,91.5,0.5],"archer_a3":[137,3014,64,92,41.2,93.0,0.5],"iceknight_w0":[1200,1913,72,129,35.3,129.0,0.5],"iceknight_w1":[1607,1777,64,130,30.8,129.5,0.5],"iceknight_w2":[1276,1913,65,129,30.8,129.0,0.5],"iceknight_w3":[1345,1913,66,129,31.3,129.0,0.5],"iceknight_w4":[1675,1777,66,130,30.8,129.5,0.5],"iceknight_w5":[1745,1777,64,130,30.3,130.0,0.5],"iceknight_w6":[1872,1913,66,128,31.8,130.5,0.5],"iceknight_w7":[1942,1913,78,128,36.8,129.5,0.5],"iceknight_w8":[703,2047,84,127,40.3,129.0,0.5],"iceknight_w9":[791,2047,82,127,39.8,129.0,0.5],"iceknight_i0":[1331,1777,64,130,31.3,129.5,0.5],"iceknight_i1":[1399,1777,66,130,32.3,129.5,0.5],"iceknight_i2":[1469,1777,65,130,31.8,129.5,0.5],"iceknight_i3":[1538,1777,65,130,32.3,129.5,0.5],"iceknight_a0":[1714,1913,74,128,41.3,127.5,0.5],"iceknight_a1":[0,2309,87,120,53.8,120.0,0.5],"iceknight_a2":[1792,1913,76,128,40.3,128.5,0.5],"iceknight_a3":[1256,1777,71,130,36.8,129.5,0.5],"demon_w0":[859,2793,92,107,47.8,107.0,0.5],"demon_w1":[1345,2793,86,106,42.3,106.5,0.5],"demon_w2":[1435,2793,84,106,38.3,106.5,0.5],"demon_w3":[1523,2793,82,106,36.3,106.5,0.5],"demon_w4":[1609,2793,83,106,37.3,106.5,0.5],"demon_w5":[955,2793,84,107,40.3,107.0,0.5],"demon_w6":[1696,2793,89,106,45.8,108.0,0.5],"demon_w7":[1043,2793,98,107,49.8,108.5,0.5],"demon_w8":[1145,2793,100,107,50.8,108.5,0.5],"demon_w9":[1789,2793,99,106,50.3,108.0,0.5],"demon_i0":[681,2793,84,107,42.8,107.0,0.5],"demon_i1":[769,2793,86,107,43.3,107.0,0.5],"demon_i2":[505,2793,84,108,42.3,107.5,0.5],"demon_i3":[593,2793,84,108,41.8,107.5,0.5],"demon_a0":[310,2793,95,108,53.3,108.0,0.5],"demon_a1":[409,2793,92,108,50.3,108.0,0.5],"demon_a2":[0,2906,93,104,46.8,104.5,0.5],"demon_a3":[1249,2793,92,106,48.3,106.0,0.5],"darkknight_w0":[1361,2675,97,110,46.3,109.5,0.5],"darkknight_w1":[220,2793,86,108,39.3,109.0,0.5],"darkknight_w2":[1462,2675,80,110,33.8,108.5,0.5],"darkknight_w3":[1094,2675,78,111,31.8,108.5,0.5],"darkknight_w4":[1546,2675,78,110,32.8,109.0,0.5],"darkknight_w5":[1628,2675,81,110,36.8,109.5,0.5],"darkknight_w6":[1713,2675,89,109,42.3,110.0,0.5],"darkknight_w7":[1806,2675,100,109,48.3,110.0,0.5],"darkknight_w8":[1910,2675,105,109,51.3,110.0,0.5],"darkknight_w9":[0,2793,104,109,50.8,110.0,0.5],"darkknight_i0":[1176,2675,87,110,38.3,110.0,0.5],"darkknight_i1":[1267,2675,90,110,40.8,110.0,0.5],"darkknight_i2":[1004,2675,86,111,37.3,110.0,0.5],"darkknight_i3":[537,2675,84,112,34.8,110.0,0.5],"darkknight_a0":[411,2675,122,112,72.8,111.5,0.5],"darkknight_a1":[694,2555,106,114,57.3,112.5,0.5],"darkknight_a2":[1892,2793,109,104,59.3,106.0,0.5],"darkknight_a3":[108,2793,108,108,59.3,108.5,0.5],"wizard_w0":[916,2309,66,120,42.1,119.0,0.5],"wizard_w1":[1768,2309,70,118,45.6,117.0,0.5],"wizard_w2":[224,2433,74,117,47.1,115.5,0.5],"wizard_w3":[302,2433,76,117,48.1,115.5,0.5],"wizard_w4":[1842,2309,75,118,48.1,116.0,0.5],"wizard_w5":[1921,2309,72,118,47.6,116.5,0.5],"wizard_w6":[0,2433,70,118,46.6,117.5,0.5],"wizard_w7":[74,2433,70,118,43.6,119.0,0.5],"wizard_w8":[986,2309,70,120,40.6,120.0,0.5],"wizard_w9":[1918,2179,68,121,40.1,120.5,0.5],"wizard_i0":[1620,2309,70,118,48.1,116.0,0.5],"wizard_i1":[1694,2309,70,118,47.1,116.5,0.5],"wizard_i2":[148,2433,72,117,49.6,115.5,0.5],"wizard_i3":[267,2555,74,116,51.6,115.0,0.5],"wizard_a0":[846,2309,66,120,43.6,118.5,0.5],"wizard_a1":[1721,2179,61,122,38.1,120.0,0.5],"wizard_a2":[1786,2179,64,122,38.1,121.5,0.5],"wizard_a3":[1854,2179,60,122,36.6,121.0,0.5],"darkking_w0":[1142,1352,125,140,65.3,139.8,0.6],"darkking_w1":[1271,1352,116,140,59.3,139.2,0.6],"darkking_w2":[0,1352,112,141,54.5,139.2,0.6],"darkking_w3":[116,1352,112,141,54.5,139.2,0.6],"darkking_w4":[1391,1352,110,140,54.5,139.2,0.6],"darkking_w5":[1505,1352,109,140,55.7,139.8,0.6],"darkking_w6":[232,1352,117,141,59.9,139.8,0.6],"darkking_w7":[353,1352,130,141,65.3,139.8,0.6],"darkking_w8":[487,1352,136,141,68.9,139.8,0.6],"darkking_w9":[627,1352,134,141,68.9,139.8,0.6],"darkking_i0":[903,1352,114,140,56.9,139.2,0.6],"darkking_i1":[1021,1352,117,140,59.3,139.2,0.6],"darkking_i2":[1819,1202,114,141,56.3,139.2,0.6],"darkking_i3":[1564,1202,113,142,56.3,139.2,0.6],"darkking_a0":[1270,1202,144,142,85.7,140.4,0.6],"darkking_a1":[569,1202,158,145,98.9,142.8,0.6],"darkking_a2":[1418,1202,142,142,80.9,139.2,0.6],"darkking_a3":[1681,1202,134,141,76.1,139.2,0.6],"icegolem_w0":[1225,2555,111,114,59.9,113.9,0.55],"icegolem_w1":[1340,2555,104,114,53.9,113.3,0.55],"icegolem_w2":[1448,2555,101,114,51.7,112.8,0.55],"icegolem_w3":[1553,2555,101,114,51.7,112.8,0.55],"icegolem_w4":[1658,2555,102,114,52.8,113.3,0.55],"icegolem_w5":[1764,2555,101,114,51.7,113.9,0.55],"icegolem_w6":[382,2433,106,116,56.1,115.0,0.55],"icegolem_w7":[1370,2309,118,118,62.1,115.5,0.55],"icegolem_w8":[1492,2309,124,118,65.4,115.5,0.55],"icegolem_w9":[492,2433,122,116,64.9,115.0,0.55],"icegolem_i0":[804,2555,101,114,52.2,113.9,0.55],"icegolem_i1":[909,2555,103,114,54.4,113.9,0.55],"icegolem_i2":[1016,2555,101,114,51.7,114.4,0.55],"icegolem_i3":[1121,2555,100,114,51.7,114.4,0.55],"icegolem_a0":[345,2555,116,115,72.0,115.0,0.55],"icegolem_a1":[465,2555,126,115,85.2,115.0,0.55],"icegolem_a2":[625,2675,111,112,62.7,110.6,0.55],"icegolem_a3":[298,2675,109,113,62.1,112.8,0.55],"lavagolem_w0":[1405,2433,102,116,60.1,115.5,0.5],"lavagolem_w1":[595,2555,95,115,53.6,115.0,0.5],"lavagolem_w2":[0,2675,96,114,52.6,114.5,0.5],"lavagolem_w3":[100,2675,96,114,52.6,114.0,0.5],"lavagolem_w4":[200,2675,94,114,53.1,114.5,0.5],"lavagolem_w5":[1511,2433,90,116,51.1,115.5,0.5],"lavagolem_w6":[1605,2433,97,116,56.6,116.5,0.5],"lavagolem_w7":[1706,2433,110,116,62.6,117.0,0.5],"lavagolem_w8":[1820,2433,116,116,65.6,117.0,0.5],"lavagolem_w9":[0,2555,112,116,64.6,116.5,0.5],"lavagolem_i0":[1018,2433,92,116,53.1,115.5,0.5],"lavagolem_i1":[1114,2433,95,116,55.1,115.5,0.5],"lavagolem_i2":[1213,2433,92,116,52.6,116.0,0.5],"lavagolem_i3":[1309,2433,92,116,52.6,115.5,0.5],"lavagolem_a0":[782,2433,109,116,71.6,116.5,0.5],"lavagolem_a1":[895,2433,119,116,83.6,116.5,0.5],"lavagolem_a2":[740,2675,108,112,62.6,112.5,0.5],"lavagolem_a3":[1869,2555,104,114,62.6,114.5,0.5],"wolf_w0":[425,1777,166,132,77.0,131.5,0.5],"wolf_w1":[860,1913,164,130,77.5,129.5,0.5],"wolf_w2":[595,1777,162,132,77.0,130.5,0.5],"wolf_w3":[455,1639,160,134,75.5,131.5,0.5],"wolf_w4":[619,1639,160,134,75.5,131.0,0.5],"wolf_w5":[761,1777,164,132,77.0,130.0,0.5],"wolf_w6":[1028,1913,168,130,77.5,131.0,0.5],"wolf_w7":[1127,1639,169,133,77.0,133.5,0.5],"wolf_w8":[1145,1497,168,135,75.5,135.0,0.5],"wolf_w9":[783,1639,166,134,75.5,134.5,0.5],"wolf_i0":[353,1913,165,130,76.5,129.0,0.5],"wolf_i1":[1415,1913,163,129,77.0,128.5,0.5],"wolf_i2":[522,1913,164,130,76.5,129.5,0.5],"wolf_i3":[690,1913,166,130,76.0,129.5,0.5],"wolf_a0":[529,2047,170,128,79.0,127.5,0.5],"wolf_a1":[0,2179,174,126,80.5,126.5,0.5],"wolf_a2":[1618,1352,154,140,75.5,139.0,0.5],"wolf_a3":[295,1639,156,134,72.0,134.0,0.5],"icewolf_w0":[1813,1777,172,130,74.8,128.5,0.5],"icewolf_w1":[176,2047,171,128,75.3,126.0,0.5],"icewolf_w2":[0,1913,170,130,74.8,127.0,0.5],"icewolf_w3":[0,1777,171,132,75.3,128.5,0.5],"icewolf_w4":[953,1639,170,133,73.3,128.0,0.5],"icewolf_w5":[929,1777,172,131,74.8,126.5,0.5],"icewolf_w6":[351,2047,174,128,75.3,128.5,0.5],"icewolf_w7":[174,1913,175,130,74.8,131.5,0.5],"icewolf_w8":[1727,1497,174,134,73.3,133.5,0.5],"icewolf_w9":[0,1639,172,134,73.3,132.5,0.5],"icewolf_i0":[1389,2047,171,126,74.8,126.0,0.5],"icewolf_i1":[1564,2047,171,126,75.3,125.0,0.5],"icewolf_i2":[877,2047,171,127,74.3,126.5,0.5],"icewolf_i3":[0,2047,172,128,73.8,127.0,0.5],"icewolf_a0":[1209,2047,176,126,76.8,125.5,0.5],"icewolf_a1":[178,2179,180,125,77.8,126.0,0.5],"icewolf_a2":[276,1497,170,137,78.8,134.5,0.5],"icewolf_a3":[1839,1639,168,132,73.3,130.5,0.5],"kingwolf_w0":[1578,0,208,174,100.4,173.4,0.6],"kingwolf_w1":[993,189,209,172,101.6,168.6,0.6],"kingwolf_w2":[1790,0,208,174,100.4,170.4,0.6],"kingwolf_w3":[740,0,206,176,98.6,171.6,0.6],"kingwolf_w4":[950,0,206,176,98.6,171.0,0.6],"kingwolf_w5":[0,189,209,174,100.4,168.6,0.6],"kingwolf_w6":[1206,189,211,172,101.6,173.4,0.6],"kingwolf_w7":[1160,0,211,176,100.4,177.0,0.6],"kingwolf_w8":[315,0,209,179,98.6,178.8,0.6],"kingwolf_w9":[528,0,208,179,98.6,177.6,0.6],"kingwolf_i0":[734,367,208,169,99.8,168.0,0.6],"kingwolf_i1":[946,367,209,169,101.0,168.0,0.6],"kingwolf_i2":[303,367,209,170,99.8,169.2,0.6],"kingwolf_i3":[1421,189,208,171,98.6,169.8,0.6],"kingwolf_a0":[516,367,214,169,104.0,169.2,0.6],"kingwolf_a1":[1708,367,220,167,107.0,168.6,0.6],"kingwolf_a2":[111,0,200,182,98.0,180.0,0.6],"kingwolf_a3":[1375,0,199,175,92.6,174.0,0.6],"scorpion_w0":[1220,2309,146,119,72.9,119.0,0.5],"scorpion_w1":[545,2309,149,120,72.4,121.5,0.5],"scorpion_w2":[1272,2179,150,122,71.9,123.0,0.5],"scorpion_w3":[667,2179,150,123,72.4,124.5,0.5],"scorpion_w4":[362,2179,149,125,72.9,124.5,0.5],"scorpion_w5":[515,2179,148,124,73.9,124.0,0.5],"scorpion_w6":[821,2179,146,123,74.9,121.5,0.5],"scorpion_w7":[1426,2179,144,122,75.4,118.5,0.5],"scorpion_w8":[1574,2179,143,122,74.9,116.0,0.5],"scorpion_w9":[698,2309,144,120,73.9,117.0,0.5],"scorpion_i0":[242,2309,147,120,73.4,119.5,0.5],"scorpion_i1":[971,2179,146,122,72.9,122.0,0.5],"scorpion_i2":[1121,2179,147,122,73.4,122.0,0.5],"scorpion_i3":[393,2309,148,120,74.4,119.5,0.5],"scorpion_a0":[1739,2047,147,126,72.9,125.0,0.5],"scorpion_a1":[1105,1777,147,131,72.4,130.0,0.5],"scorpion_a2":[852,2675,148,112,74.9,111.5,0.5],"scorpion_a3":[116,2555,147,116,73.9,116.5,0.5],"queenscorp_w0":[614,878,200,159,87.5,158.4,0.6],"queenscorp_w1":[206,878,199,160,86.3,160.8,0.6],"queenscorp_w2":[1492,711,200,161,86.3,162.6,0.6],"queenscorp_w3":[1719,541,200,163,86.3,164.4,0.6],"queenscorp_w4":[805,541,201,165,87.5,164.4,0.6],"queenscorp_w5":[1010,541,201,164,88.7,163.8,0.6],"queenscorp_w6":[0,711,202,163,89.9,161.4,0.6],"queenscorp_w7":[409,711,202,162,90.5,159.0,0.6],"queenscorp_w8":[409,878,201,160,89.9,156.0,0.6],"queenscorp_w9":[1124,878,200,158,88.7,156.0,0.6],"queenscorp_i0":[1696,711,200,160,88.1,159.0,0.6],"queenscorp_i1":[206,711,199,162,86.9,161.4,0.6],"queenscorp_i2":[1515,541,200,163,88.1,162.0,0.6],"queenscorp_i3":[0,878,202,160,89.3,159.0,0.6],"queenscorp_a0":[306,541,200,166,87.5,165.0,0.6],"queenscorp_a1":[787,189,202,173,86.9,171.6,0.6],"queenscorp_a2":[1542,1042,202,148,89.3,147.6,0.6],"queenscorp_a3":[898,1042,201,155,88.7,154.2,0.6],"ghost_w0":[1570,1639,130,132,61.2,129.5,0.5],"ghost_w1":[1704,1639,131,132,60.2,132.0,0.5],"ghost_w2":[1455,1497,133,134,60.2,134.0,0.5],"ghost_w3":[727,1497,134,136,59.7,135.5,0.5],"ghost_w4":[865,1497,136,136,61.2,135.0,0.5],"ghost_w5":[1005,1497,136,136,62.7,134.0,0.5],"ghost_w6":[1776,1352,135,139,64.7,132.0,0.5],"ghost_w7":[765,1352,134,141,65.2,130.0,0.5],"ghost_w8":[140,1497,132,138,64.7,128.5,0.5],"ghost_w9":[1592,1497,131,134,63.2,128.0,0.5],"ghost_i0":[1434,1639,132,132,61.7,130.5,0.5],"ghost_i1":[1317,1497,134,134,60.7,134.0,0.5],"ghost_i2":[450,1497,135,136,62.7,133.5,0.5],"ghost_i3":[589,1497,134,136,64.2,130.0,0.5],"ghost_a0":[1300,1639,130,132,61.7,129.5,0.5],"ghost_a1":[1582,1913,128,128,64.7,126.5,0.5],"ghost_a2":[731,1202,136,145,62.7,137.5,0.5],"ghost_a3":[0,1497,136,138,62.7,134.5,0.5],"dragon_w0":[510,541,291,165,119.4,155.7,0.55],"dragon_w1":[893,711,299,161,120.5,156.8,0.55],"dragon_w2":[0,541,302,166,119.4,161.7,0.55],"dragon_w3":[1633,189,301,170,117.2,165.0,0.55],"dragon_w4":[0,367,299,170,117.7,163.9,0.55],"dragon_w5":[1215,541,296,163,119.4,157.9,0.55],"dragon_w6":[1196,711,292,161,120.5,154.0,0.55],"dragon_w7":[1418,367,286,167,119.4,159.5,0.55],"dragon_w8":[213,189,282,173,117.2,163.9,0.55],"dragon_w9":[499,189,284,173,117.7,162.8,0.55],"dragon_i0":[602,1042,292,155,119.4,153.5,0.55],"dragon_i1":[1616,878,302,156,119.9,153.5,0.55],"dragon_i2":[0,1042,295,156,118.3,154.6,0.55],"dragon_i3":[1328,878,284,157,117.7,155.1,0.55],"dragon_a0":[615,711,274,161,115.0,157.9,0.55],"dragon_a1":[1159,367,255,168,108.9,165.0,0.55],"dragon_a2":[818,878,302,158,120.5,156.8,0.55],"dragon_a3":[299,1042,299,155,120.5,153.5,0.55]},
    // Altura del dibujo original de cada personaje (en píxeles a escala 1)
    base: {"k":212,"hood":192,"mummy":181,"archer":188,"iceknight":259,"demon":216,"darkknight":221,"wizard":236,"slime":119,"icegolem":208,"lavagolem":232,"flame":181,"darkking":236,"wolf":259,"scorpion":241,"icewolf":253,"ghost":268,"kingwolf":283,"queenscorp":268,"dragon":283},
    // Altura en pantalla de cada enemigo, relativa a su tamaño (e.size)
    height: { hood: 1.3, mummy: 1.25, archer: 1.3, iceknight: 1.55, demon: 1.35, darkknight: 1.35, wizard: 1.45,
              slime: 0.85, icegolem: 1.15, lavagolem: 1.2, flame: 1.25, darkking: 1.3,
              wolf: 1.15, icewolf: 1.15, kingwolf: 1.15, scorpion: 1.1, queenscorp: 1.15, ghost: 1.3, dragon: 1.0 },
    img: null, ready: false,
  };
  const KNIGHT_PX = 62;   // altura del caballero en reposo (unidades del juego)
  const WALK_FRAMES = 10, IDLE_FRAMES = 4;
  function loadArt(onReady) {
    if (typeof Image === 'undefined') return;
    const img = new Image();
    img.onload = () => { ART.img = img; ART.ready = true; if (onReady) onReady(); };
    img.src = 'assets/sprites.webp';
  }
  const artOn = () => ART.ready && !(typeof Game !== 'undefined' && Game.S && Game.S.settings && Game.S.settings.classic);
  // Versiones teñidas (golpe recibido) creadas solo para los cuadros que las necesitan
  const tints = new Map();
  function tintOf(key, color) {
    const id = key + color;
    let cv = tints.get(id);
    if (!cv) {
      const f = ART.frames[key];
      cv = document.createElement('canvas'); cv.width = f[2]; cv.height = f[3];
      const g = cv.getContext('2d');
      g.drawImage(ART.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, f[2], f[3]);
      tints.set(id, cv);
    }
    return cv;
  }
  /** Dibuja un cuadro con los pies en (0,0); unit = unidades de pantalla por píxel del dibujo original. */
  function blit(c, key, tint, unit, alpha) {
    const f = ART.frames[key];
    if (!f) return;
    const k = unit / f[6];
    if (alpha !== undefined) { if (alpha <= 0.01) return; c.globalAlpha *= alpha; }
    if (tint) c.drawImage(tintOf(key, tint), 0, 0, f[2], f[3], -f[4] * k, -f[5] * k, f[2] * k, f[3] * k);
    else c.drawImage(ART.img, f[0], f[1], f[2], f[3], -f[4] * k, -f[5] * k, f[2] * k, f[3] * k);
    if (alpha !== undefined) c.globalAlpha /= alpha;
  }
  /** Reposo: mezcla suave entre los 4 cuadros de respiración. */
  function blitIdle(c, key, t, tint, unit) {
    const ph = ((t / 2.6) % 1 + 1) % 1 * IDLE_FRAMES, i = Math.floor(ph), fr = ph - i;
    blit(c, key + '_i' + i, tint, unit);
    blit(c, key + '_i' + ((i + 1) % IDLE_FRAMES), tint, unit, fr);
  }
  const walkIndex = w => Math.floor((((w / (Math.PI * 2)) % 1) + 1) % 1 * WALK_FRAMES) % WALK_FRAMES;

  /** Cuadro del caballero en combate: tajo, estocada o golpe fuerte. */
  function knightSwing(o) {
    const t = o.swing, style = o.style || (o.heavy ? 'smash' : 'slash');
    if (style === 'thrust') return t < 0.3 ? 'k_thrust1' : t < 0.65 ? 'k_thrust2' : 'k_thrust3';
    if (style === 'smash') return t < 0.24 ? 'k_raise' : t < 0.45 ? 'k_smash1' : t < 0.72 ? 'k_smash2' : 'k_smash3';
    return t < 0.12 ? 'k_raise' : t < 0.4 ? 'k_slash1' : t < 0.7 ? 'k_slash2' : 'k_slash3';
  }
  /* Arco de energía del golpe: se dibuja en vivo para que barra de forma
     continua (no depende de los cuadros) y nunca salga recortado.
     Ángulos: 0 = al frente, positivo = hacia abajo.                    */
  const ARCS = {
    slash: { prep: 0.14, cut: 0.42, cx: 4, cy: -34, r: 34, a0: -1.95, a1: 1.3, w: 0.34 },
    smash: { prep: 0.24, cut: 0.52, cx: 6, cy: -36, r: 41, a0: -2.2, a1: 1.55, w: 0.38 },
    thrust: { prep: 0.25, cut: 0.55 },
  };
  function swingArc(c, style, t, s, color) {
    const A = ARCS[style];
    if (!A || t < A.prep) return;
    const k = Math.min(1, (t - A.prep) / (A.cut - A.prep)), e = 1 - Math.pow(1 - k, 3);
    const fade = t <= A.cut ? 1 : Math.max(0, 1 - (t - A.cut) / 0.22);
    if (fade <= 0) return;
    const [r1, g1, b1] = color;
    c.save();
    c.globalCompositeOperation = 'lighter';
    if (style === 'thrust') {
      // Estela recta de la estocada
      const len = 54 * s * e, x0 = 10 * s, y0 = -31 * s, th = 7 * s;
      const g = c.createLinearGradient(x0, 0, x0 + len, 0);
      g.addColorStop(0, `rgba(${r1},${g1},${b1},0)`); g.addColorStop(0.7, `rgba(${r1},${g1},${b1},${0.7 * fade})`); g.addColorStop(1, `rgba(255,255,255,${0.95 * fade})`);
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x0, y0 - th * 0.3); c.lineTo(x0 + len, y0 - th * 0.05); c.lineTo(x0 + len + 6 * s, y0 + 1 * s); c.lineTo(x0 + len, y0 + th * 0.35); c.lineTo(x0, y0 + th * 0.3); c.closePath(); c.fill();
      c.restore();
      return;
    }
    const cx = A.cx * s, cy = A.cy * s, R = A.r * s, W = R * A.w;
    const head = A.a0 + (A.a1 - A.a0) * e;
    const tail = t <= A.cut ? Math.max(A.a0, head - 2.4) : head - 2.4 * fade;
    if (head - tail < 0.05) { c.restore(); return; }
    const N = 26;
    const pts = [];
    for (let i = 0; i <= N; i++) { const u = i / N, a = tail + (head - tail) * u; pts.push([a, W * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.75)]); }
    const path = (scaleW, rOut) => {
      c.beginPath();
      pts.forEach(([a], i) => { const x = cx + Math.cos(a) * rOut, y = cy + Math.sin(a) * rOut; i ? c.lineTo(x, y) : c.moveTo(x, y); });
      for (let i = pts.length - 1; i >= 0; i--) { const [a, w] = pts[i]; const rr = rOut - w * scaleW; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      c.closePath();
    };
    // Resplandor
    c.fillStyle = `rgba(${r1},${g1},${b1},${0.22 * fade})`; path(1.5, R + 4 * s); c.fill();
    // Cuerpo del arco con borde brillante
    const g = c.createRadialGradient(cx, cy, Math.max(1, R - W), cx, cy, R);
    g.addColorStop(0, `rgba(${r1},${g1},${b1},0)`);
    g.addColorStop(0.45, `rgba(${r1},${g1},${b1},${0.55 * fade})`);
    g.addColorStop(0.85, `rgba(${Math.min(255, r1 + 90)},${Math.min(255, g1 + 70)},255,${0.9 * fade})`);
    g.addColorStop(1, `rgba(255,255,255,${fade})`);
    c.fillStyle = g; path(1, R); c.fill();
    // Eco del arco (una segunda estela que llega un poco tarde)
    c.globalAlpha = 0.35 * fade;
    c.save(); c.translate(cx, cy); c.rotate(-0.28); c.translate(-cx, -cy); c.fillStyle = `rgba(${r1},${g1},${b1},.8)`; path(0.55, R - 5 * s); c.fill(); c.restore();
    c.globalAlpha = 1;
    // Destellos en la punta del arco
    const hx = cx + Math.cos(head) * R, hy = cy + Math.sin(head) * R;
    c.fillStyle = `rgba(255,255,255,${0.95 * fade})`;
    for (let i = 0; i < 3; i++) {
      const a = head - i * 0.22, rr = R - i * 2 * s, sx = cx + Math.cos(a) * rr, sy = cy + Math.sin(a) * rr, sz = (3.2 - i) * s * fade;
      c.beginPath(); c.moveTo(sx, sy - sz * 1.8); c.lineTo(sx + sz * 0.5, sy); c.lineTo(sx, sy + sz * 1.8); c.lineTo(sx - sz * 0.5, sy); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(sx - sz * 1.8, sy); c.lineTo(sx, sy + sz * 0.5); c.lineTo(sx + sz * 1.8, sy); c.lineTo(sx, sy - sz * 0.5); c.closePath(); c.fill();
    }
    const hg = c.createRadialGradient(hx, hy, 0, hx, hy, 10 * s);
    hg.addColorStop(0, `rgba(255,255,255,${0.6 * fade})`); hg.addColorStop(1, `rgba(${r1},${g1},${b1},0)`);
    c.fillStyle = hg; c.beginPath(); c.arc(hx, hy, 10 * s, 0, TAU); c.fill();
    c.restore();
  }
  const ARC_BLUE = [59, 130, 246];
  /** Color del arco: azul del diseño, teñido por el arma si es mágica (épica o mejor). */
  const MAGIC = { epico: 1, legendario: 1, mitico: 1 };
  function arcColor(hex) {
    const it = typeof Game !== 'undefined' && Game.S && typeof ITEMS !== 'undefined' ? ITEMS[Game.S.equip.weapon] : null;
    if (!it || !MAGIC[it.rarity] || !hex || !/^#[0-9a-f]{6}$/i.test(hex)) return ARC_BLUE;
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat < 90) return ARC_BLUE;                    // armas sencillas: azul
    return [Math.round(r * 0.75 + 59 * 0.25), Math.round(g * 0.75 + 130 * 0.25), Math.round(b * 0.75 + 246 * 0.25)];
  }
  /** Equipo que se nota en el caballero: rareza de armadura y arma. */
  function gearLook() {
    if (typeof Game === 'undefined' || !Game.S || typeof ITEMS === 'undefined') return {};
    const S = Game.S, w = ITEMS[S.equip.weapon], a = ITEMS[S.equip.armor];
    const ri = it => (it ? RARITY_ORDER.indexOf(it.rarity) : 0);
    return { weapon: w, armor: a, wr: ri(w), ar: ri(a), aura: S.cosmetics && COSMETICS[S.cosmetics.aura] };
  }
  /* ---------- Auras y estelas cosméticas ---------- */
  const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgba = (k, a) => `rgba(${k[0]},${k[1]},${k[2]},${a})`;
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const TAU = Math.PI * 2;
  /** Destello de 4 puntas. */
  function sparkle(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill();
  }
  /** Lengua de fuego que nace en (x, y) y sube h. */
  function flameShape(c, x, y, w, h, lean) {
    c.beginPath(); c.moveTo(x - w, y);
    c.quadraticCurveTo(x - w * 1.1, y - h * 0.5, x + lean, y - h);
    c.quadraticCurveTo(x + w * 1.1, y - h * 0.45, x + w, y);
    c.quadraticCurveTo(x, y + w * 0.4, x - w, y); c.fill();
  }
  /** Cristal de hielo alargado con brillo. */
  function crystal(c, x, y, r, rot) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath(); c.moveTo(0, -r * 1.6); c.lineTo(r * 0.6, 0); c.lineTo(0, r * 1.6); c.lineTo(-r * 0.6, 0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.beginPath(); c.moveTo(0, -r * 1.6); c.lineTo(r * 0.25, -r * 0.2); c.lineTo(-r * 0.2, -r * 0.1); c.closePath(); c.fill();
    c.restore();
  }
  /** Resplandor que envuelve el cuerpo. */
  function bodyGlow(c, s, k, a, w = 34, h = 44) {
    // Degradado circular estirado a elipse: el borde se desvanece sin cortes
    c.save(); c.translate(0, -30 * s); c.scale(w / h, 1);
    const g = c.createRadialGradient(0, 0, 3 * s, 0, 0, h * s);
    g.addColorStop(0, rgba(k, a)); g.addColorStop(0.55, rgba(k, a * 0.45)); g.addColorStop(1, rgba(k, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, h * s, 0, TAU); c.fill(); c.restore();
  }
  /** Anillo mágico en el suelo, con runas que giran. */
  function groundRing(c, s, t, k, r, spin) {
    const pulse = 0.55 + Math.sin(t * 3) * 0.2;
    const g = c.createRadialGradient(0, 0, r * 0.2 * s, 0, 0, r * s);
    g.addColorStop(0, rgba(k, 0.32 * pulse)); g.addColorStop(1, rgba(k, 0));
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, r * s, r * 0.32 * s, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(k, 0.75 * pulse); c.lineWidth = 1.3 * s;
    c.beginPath(); c.ellipse(0, 0, r * 0.8 * s, r * 0.26 * s, 0, 0, TAU); c.stroke();
    c.fillStyle = rgba(k, 0.9 * pulse);
    for (let i = 0; i < 8; i++) {
      const a = t * spin + i * TAU / 8;
      c.fillRect(Math.cos(a) * r * 0.8 * s - s, Math.sin(a) * r * 0.26 * s - s, 2 * s, 2 * s);
    }
  }
  /**
   * Cada aura tiene su propio efecto, en dos capas: 'back' (detrás del caballero)
   * y 'front' (delante). Lo que orbita pasa por detrás y por delante según la profundidad.
   */
  const AURA_FX = {
    aura_dorada(c, s, t, k, layer) {
      if (layer === 'back') {
        groundRing(c, s, t, k, 34, 0.8);
        bodyGlow(c, s, k, 0.34 + Math.sin(t * 3.2) * 0.08);
        // Rayos de luz que giran despacio
        c.save(); c.translate(0, -32 * s); c.rotate(t * 0.35); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
          const a = i * TAU / 12, len = (38 + Math.sin(t * 2 + i * 1.7) * 9) * s, wd = 0.07;
          const g = c.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
          g.addColorStop(0, rgba(k, 0.32)); g.addColorStop(1, rgba(k, 0));
          c.fillStyle = g; c.beginPath(); c.moveTo(0, 0);
          c.lineTo(Math.cos(a - wd) * len, Math.sin(a - wd) * len); c.lineTo(Math.cos(a + wd) * len, Math.sin(a + wd) * len); c.fill();
        }
        c.restore();
      } else {
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 9; i++) {
          const ph = (t * 0.45 + hash(i)) % 1, tw = Math.sin(t * 6 + i * 2.3) * 0.5 + 0.5;
          c.globalAlpha = (1 - ph) * (0.4 + tw * 0.6);
          c.fillStyle = i % 3 ? rgba(k, 1) : '#fffbe6';
          sparkle(c, (hash(i + 9) - 0.5) * 46 * s + Math.sin(t + i) * 4 * s, -ph * 70 * s - 2 * s, (1.6 + tw * 2.4) * s);
        }
        c.restore();
      }
    },
    aura_hielo(c, s, t, k, layer) {
      if (layer === 'back') {
        groundRing(c, s, t, k, 32, -0.6);
        bodyGlow(c, s, k, 0.3 + Math.sin(t * 2.4) * 0.06);
        // Escarcha en el suelo: puntas de hielo alrededor de los pies
        c.fillStyle = rgba([224, 242, 254], 0.75);
        for (let i = 0; i < 7; i++) {
          const x = (i - 3) * 7 * s, h = (5 + hash(i) * 7 + Math.sin(t * 2 + i) * 1.2) * s;
          c.beginPath(); c.moveTo(x - 2.4 * s, 1 * s); c.lineTo(x + (hash(i + 3) - 0.5) * 3 * s, -h); c.lineTo(x + 2.4 * s, 1 * s); c.fill();
        }
      } else {
        // Copos que caen
        c.fillStyle = '#f0f9ff';
        for (let i = 0; i < 10; i++) {
          const ph = (t * 0.3 + hash(i)) % 1;
          c.globalAlpha = Math.sin(ph * Math.PI) * 0.85;
          c.beginPath(); c.arc((hash(i + 4) - 0.5) * 52 * s + Math.sin(t * 1.5 + i) * 5 * s, (-74 + ph * 74) * s, (0.8 + hash(i + 7)) * s, 0, TAU); c.fill();
        }
        c.globalAlpha = 1;
      }
      // Cristales que orbitan alrededor del cuerpo
      for (let i = 0; i < 5; i++) {
        const a = t * 1.3 + i * TAU / 5, depth = Math.sin(a);
        if ((depth > 0) !== (layer === 'front')) continue;
        const x = Math.cos(a) * 25 * s, y = (-30 + Math.sin(t * 2 + i) * 9) * s + depth * 6 * s;
        c.globalAlpha = 0.65 + depth * 0.3;
        c.fillStyle = rgba(k, 0.9);
        crystal(c, x, y, (2.4 + depth * 0.6) * s, Math.sin(t + i) * 0.4);
      }
      c.globalAlpha = 1;
    },
    aura_fuego(c, s, t, k, layer) {
      if (layer === 'back') {
        bodyGlow(c, s, [251, 146, 60], 0.36 + Math.sin(t * 9) * 0.05, 36, 46);
        // Llamas que suben desde los pies, por detrás del cuerpo
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 9; i++) {
          const x = (i - 4) * 5.5 * s, fl = Math.sin(t * 11 + i * 1.9) * 0.18 + Math.sin(t * 7 + i) * 0.12;
          const h = (26 + hash(i) * 26) * (1 + fl) * s * (1 - Math.abs(i - 4) * 0.08);
          c.fillStyle = 'rgba(220,38,38,.55)'; flameShape(c, x, 2 * s, 5 * s, h, Math.sin(t * 5 + i) * 4 * s);
          c.fillStyle = 'rgba(249,115,22,.6)'; flameShape(c, x, 2 * s, 3.6 * s, h * 0.75, Math.sin(t * 5 + i) * 3 * s);
          c.fillStyle = 'rgba(253,224,71,.55)'; flameShape(c, x, 2 * s, 2 * s, h * 0.45, Math.sin(t * 5 + i) * 2 * s);
        }
        c.restore();
      } else {
        // Brasas que suben girando y llamitas delante de los pies
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const x = (i - 1.5) * 9 * s, h = (8 + Math.sin(t * 12 + i * 2) * 3) * s;
          c.fillStyle = 'rgba(249,115,22,.55)'; flameShape(c, x, 2 * s, 3 * s, h, 0);
          c.fillStyle = 'rgba(254,240,138,.6)'; flameShape(c, x, 2 * s, 1.5 * s, h * 0.6, 0);
        }
        for (let i = 0; i < 12; i++) {
          const ph = (t * 0.7 + hash(i)) % 1;
          c.globalAlpha = 1 - ph;
          c.fillStyle = ph < 0.4 ? '#fde68a' : ph < 0.7 ? '#fb923c' : '#ef4444';
          const x = (hash(i + 2) - 0.5) * 40 * s + Math.sin(t * 3 + i * 1.3) * 7 * s * ph;
          c.beginPath(); c.arc(x, -ph * 82 * s, (1.6 - ph) * s + 0.4, 0, TAU); c.fill();
        }
        c.restore();
      }
    },
    aura_sombra(c, s, t, k, layer) {
      if (layer === 'back') {
        // Humo oscuro que se retuerce hacia arriba
        for (let i = 0; i < 9; i++) {
          const ph = (t * 0.35 + hash(i)) % 1;
          const x = (hash(i + 5) - 0.5) * 30 * s + Math.sin(t * 1.4 + i * 2) * 10 * s * ph;
          const r = (8 + ph * 16) * s;
          const g = c.createRadialGradient(x, -ph * 70 * s, 0, x, -ph * 70 * s, r);
          g.addColorStop(0, `rgba(30,10,50,${0.5 * Math.sin(ph * Math.PI)})`); g.addColorStop(1, 'rgba(30,10,50,0)');
          c.fillStyle = g; c.beginPath(); c.arc(x, -ph * 70 * s, r, 0, TAU); c.fill();
        }
        bodyGlow(c, s, k, 0.3 + Math.sin(t * 2.6) * 0.08);
        // Sombra que se extiende por el suelo con un círculo de runas
        c.fillStyle = 'rgba(20,0,40,.45)'; c.beginPath(); c.ellipse(0, 0, 30 * s, 9 * s, 0, 0, TAU); c.fill();
        groundRing(c, s, t, k, 30, 1.2);
      } else {
        // Chispazos violetas de vez en cuando
        const z = Math.floor(t * 3), zp = t * 3 - z;
        if (hash(z) > 0.55 && zp < 0.35) {
          c.save(); c.globalCompositeOperation = 'lighter';
          c.strokeStyle = `rgba(216,180,254,${1 - zp / 0.35})`; c.lineWidth = 1.2 * s;
          let x = (hash(z + 1) - 0.5) * 34 * s, y = -66 * s;
          c.beginPath(); c.moveTo(x, y);
          for (let j = 1; j <= 5; j++) { x += (hash(z * 7 + j) - 0.5) * 12 * s; y += 11 * s; c.lineTo(x, y); }
          c.stroke(); c.restore();
        }
      }
      // Orbes oscuros con estela que giran alrededor
      for (let i = 0; i < 3; i++) {
        for (let j = 5; j >= 0; j--) {
          const a = t * 2 + i * TAU / 3 - j * 0.12, depth = Math.sin(a);
          if ((depth > 0) !== (layer === 'front')) continue;
          const x = Math.cos(a) * 24 * s, y = (-34 + Math.sin(t * 1.6 + i * 2) * 12) * s + depth * 5 * s;
          c.globalAlpha = (1 - j / 6) * (0.75 + depth * 0.25);
          c.fillStyle = j ? rgba(k, 0.7) : '#f5d0fe';
          c.beginPath(); c.arc(x, y, (j ? 2.6 - j * 0.3 : 2.4) * s, 0, TAU); c.fill();
          if (!j) { c.fillStyle = rgba(k, 0.35); c.beginPath(); c.arc(x, y, 5 * s, 0, TAU); c.fill(); }
        }
      }
      c.globalAlpha = 1;
    },
    aura_fenix(c, s, t, k, layer) {
      if (layer === 'back') {
        // Anillo de fuego en el suelo
        c.save(); c.globalCompositeOperation = 'lighter';
        const rg = c.createRadialGradient(0, 0, 8 * s, 0, 0, 40 * s);
        rg.addColorStop(0, 'rgba(253,186,116,.45)'); rg.addColorStop(1, 'rgba(220,38,38,0)');
        c.fillStyle = rg; c.beginPath(); c.ellipse(0, 0, 40 * s, 12 * s, 0, 0, TAU); c.fill();
        c.restore();
        bodyGlow(c, s, [251, 146, 60], 0.38 + Math.sin(t * 4) * 0.08, 40, 52);
        // Alas de fuego que se abren desde los hombros y aletean despacio
        c.save(); c.globalCompositeOperation = 'lighter';
        const flap = Math.sin(t * 2.4) * 0.16;
        for (const side of [-1, 1]) {
          c.save(); c.translate(side * 6 * s, -40 * s); c.scale(side, 1); c.rotate(-flap);
          for (let j = 7; j >= 0; j--) {
            // Plumas en abanico: de casi horizontales (abajo) a casi verticales (arriba)
            const ang = -0.05 - j * 0.2 + Math.sin(t * 3 + j) * 0.03, len = (30 + j * 3 - Math.max(0, j - 5) * 7) * s;
            const ex = Math.cos(ang) * len, ey = Math.sin(ang) * len * 0.9 + 4 * s;
            const g = c.createLinearGradient(0, 0, ex, ey);
            g.addColorStop(0, 'rgba(255,251,235,.9)'); g.addColorStop(0.35, 'rgba(253,224,71,.8)'); g.addColorStop(0.75, 'rgba(249,115,22,.6)'); g.addColorStop(1, 'rgba(220,38,38,0)');
            c.fillStyle = g; c.beginPath(); c.moveTo(0, 0);
            c.quadraticCurveTo(ex * 0.5 - 5 * s, ey * 0.5 - 4 * s, ex, ey);
            c.quadraticCurveTo(ex * 0.5 + 3 * s, ey * 0.5 + 5 * s, 2 * s, 3 * s); c.closePath(); c.fill();
          }
          c.restore();
        }
        c.restore();
      } else {
        // Plumas de fuego y brasas que suben
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
          const ph = (t * 0.55 + hash(i + 40)) % 1;
          c.globalAlpha = (1 - ph) * 0.95;
          const x = (hash(i + 3) - 0.5) * 56 * s + Math.sin(t * 2 + i) * 6 * s * ph, y = -ph * 86 * s;
          if (i % 3 === 0) {
            c.save(); c.translate(x, y); c.rotate(Math.sin(t * 3 + i) * 0.6);
            c.fillStyle = '#fdba74'; c.beginPath(); c.ellipse(0, 0, 1.4 * s, 4 * s, 0, 0, TAU); c.fill(); c.restore();
          } else { c.fillStyle = ph < 0.4 ? '#fef9c3' : '#fb923c'; c.beginPath(); c.arc(x, y, (1.7 - ph) * s, 0, TAU); c.fill(); }
        }
        c.restore();
      }
    },
    aura_pesadilla(c, s, t, k, layer) {
      if (layer === 'back') {
        // Niebla roja y negra que sube
        for (let i = 0; i < 9; i++) {
          const ph = (t * 0.3 + hash(i + 70)) % 1, x = (hash(i + 71) - 0.5) * 34 * s + Math.sin(t + i * 2) * 9 * s * ph, r = (9 + ph * 15) * s;
          const g = c.createRadialGradient(x, -ph * 72 * s, 0, x, -ph * 72 * s, r);
          g.addColorStop(0, `rgba(${i % 2 ? '127,29,29' : '20,0,10'},${0.55 * Math.sin(ph * Math.PI)})`); g.addColorStop(1, 'rgba(20,0,10,0)');
          c.fillStyle = g; c.beginPath(); c.arc(x, -ph * 72 * s, r, 0, TAU); c.fill();
        }
        bodyGlow(c, s, [220, 38, 38], 0.32 + Math.sin(t * 3) * 0.08);
        // Círculo de runas con estrella que gira en el suelo
        c.save(); c.scale(1, 0.32); c.rotate(t * 0.6);
        c.strokeStyle = `rgba(239,68,68,${0.75 + Math.sin(t * 4) * 0.2})`; c.lineWidth = 1.6 * s;
        c.beginPath(); c.arc(0, 0, 34 * s, 0, TAU); c.stroke();
        c.beginPath(); c.arc(0, 0, 28 * s, 0, TAU); c.stroke();
        c.beginPath();
        for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * TAU * 2 / 5; i ? c.lineTo(Math.cos(a) * 28 * s, Math.sin(a) * 28 * s) : c.moveTo(Math.cos(a) * 28 * s, Math.sin(a) * 28 * s); }
        c.stroke(); c.restore();
      }
      // Calaveras que orbitan, con ojos rojos
      for (let i = 0; i < 3; i++) {
        const a = t * 1.4 + i * TAU / 3, depth = Math.sin(a);
        if ((depth > 0) !== (layer === 'front')) continue;
        const x = Math.cos(a) * 26 * s, y = (-36 + Math.sin(t * 2 + i * 2) * 10) * s + depth * 5 * s, r = (3.4 + depth * 0.6) * s;
        c.globalAlpha = 0.75 + depth * 0.25;
        c.fillStyle = '#f5f5f4'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
        c.fillRect(x - r * 0.6, y + r * 0.5, r * 1.2, r * 0.7);
        c.fillStyle = '#dc2626'; c.beginPath(); c.arc(x - r * 0.38, y, r * 0.28, 0, TAU); c.arc(x + r * 0.38, y, r * 0.28, 0, TAU); c.fill();
        c.fillStyle = 'rgba(239,68,68,.35)'; c.beginPath(); c.arc(x, y, r * 2, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
    },
    aura_infernal(c, s, t, k, layer) {
      if (layer === 'back') {
        // Columnas de fuego infernal (rojo con centro negro)
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i++) {
          const x = (i - 3) * 8 * s, h = (40 + hash(i + 90) * 30) * (1 + Math.sin(t * 9 + i * 1.7) * 0.15) * s * (1 - Math.abs(i - 3) * 0.1);
          c.fillStyle = 'rgba(185,28,28,.6)'; flameShape(c, x, 2 * s, 6 * s, h, Math.sin(t * 4 + i) * 5 * s);
          c.fillStyle = 'rgba(249,115,22,.55)'; flameShape(c, x, 2 * s, 4 * s, h * 0.7, Math.sin(t * 4 + i) * 3 * s);
        }
        c.restore();
        bodyGlow(c, s, [234, 88, 12], 0.35 + Math.sin(t * 6) * 0.06, 38, 50);
        // Grietas de lava en el suelo
        c.strokeStyle = `rgba(253,186,116,${0.7 + Math.sin(t * 5) * 0.2})`; c.lineWidth = 1.4 * s;
        for (let i = 0; i < 6; i++) {
          const a = i * TAU / 6 + 0.3;
          c.beginPath(); c.moveTo(Math.cos(a) * 8 * s, Math.sin(a) * 3 * s);
          c.lineTo(Math.cos(a + 0.2) * 22 * s, Math.sin(a + 0.2) * 7 * s); c.lineTo(Math.cos(a - 0.1) * 36 * s, Math.sin(a - 0.1) * 11 * s); c.stroke();
        }
      } else {
        // Corona de fuego flotando sobre la cabeza
        const cy = -74 * s + Math.sin(t * 2) * 2 * s;
        c.save(); c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, cy, 2 * s, 0, cy, 22 * s);
        g.addColorStop(0, 'rgba(253,224,71,.6)'); g.addColorStop(1, 'rgba(234,88,12,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(0, cy, 22 * s, 12 * s, 0, 0, TAU); c.fill();
        for (let i = 0; i < 7; i++) {
          const x = (i - 3) * 4.2 * s, h = (i % 2 ? 7 : 11) * s * (1 + Math.sin(t * 12 + i) * 0.2);
          c.fillStyle = i % 2 ? '#f97316' : '#fde047'; flameShape(c, x, cy + 3 * s, 2.4 * s, h, 0);
        }
        c.restore();
        c.strokeStyle = '#7c2d12'; c.lineWidth = 2 * s;
        c.beginPath(); c.ellipse(0, cy + 3 * s, 14 * s, 3.5 * s, 0, 0, TAU); c.stroke();
        c.strokeStyle = '#fbbf24'; c.lineWidth = 1 * s; c.stroke();
        // Brasas y humo negro
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 10; i++) {
          const ph = (t * 0.8 + hash(i + 50)) % 1;
          c.globalAlpha = 1 - ph; c.fillStyle = ph < 0.5 ? '#fde68a' : '#ef4444';
          c.beginPath(); c.arc((hash(i + 51) - 0.5) * 44 * s + Math.sin(t * 3 + i) * 5 * s, -ph * 80 * s, (1.6 - ph) * s + 0.4, 0, TAU); c.fill();
        }
        c.restore();
      }
    },
  };
  /** Dibuja una capa del aura (por id de cosmético). */
  function auraFx(c, s, t, id, layer) {
    const C = id && typeof COSMETICS !== 'undefined' && COSMETICS[id];
    if (!C || C.type !== 'aura') return;
    const fx = AURA_FX[id];
    c.save();
    if (fx) fx(c, s, t, rgbOf(C.color), layer);
    else if (layer === 'back') bodyGlow(c, s, rgbOf(C.color), 0.3);
    c.restore();
    const ex = AURA_EXTRA[id];
    if (ex) { c.save(); ex(c, s, t, layer); c.restore(); }
  }
  /* Detalles extra de las auras difíciles de conseguir (logros y ruletas especiales) */
  const blinkK = t => { const p = t % 4.2; return p < 0.12 ? 1 - p / 0.12 : p < 0.24 ? (p - 0.12) / 0.12 : 1; };
  const AURA_EXTRA = {
    aura_fenix(c, s, t, layer) {
      if (layer === 'back') {
        // Sello del fénix girando en el suelo: anillo de plumas de fuego
        c.save(); c.globalCompositeOperation = 'lighter'; c.scale(1, 0.3); c.rotate(t * 0.5);
        for (let i = 0; i < 14; i++) {
          c.save(); c.rotate(i * TAU / 14);
          const g = c.createLinearGradient(30 * s, 0, 48 * s, 0);
          g.addColorStop(0, 'rgba(253,224,71,.8)'); g.addColorStop(1, 'rgba(234,88,12,0)');
          c.fillStyle = g; c.beginPath(); c.moveTo(30 * s, -3 * s); c.quadraticCurveTo(42 * s, 0, 50 * s, 0); c.quadraticCurveTo(42 * s, 2 * s, 30 * s, 3 * s); c.fill();
          c.restore();
        }
        c.strokeStyle = 'rgba(254,240,138,.7)'; c.lineWidth = 1.5 * s; c.beginPath(); c.arc(0, 0, 30 * s, 0, TAU); c.stroke();
        c.restore();
        // Eco de las alas, más grande y suave
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 + Math.sin(t * 2.4) * 0.08;
        for (const side of [-1, 1]) {
          c.save(); c.translate(side * 6 * s, -40 * s); c.scale(side * 1.35, 1.35); c.rotate(-Math.sin(t * 2.4) * 0.16);
          const g = c.createRadialGradient(0, 0, 4 * s, 0, 0, 40 * s);
          g.addColorStop(0, 'rgba(253,186,116,.9)'); g.addColorStop(1, 'rgba(220,38,38,0)');
          c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(30 * s, -40 * s, 44 * s, -6 * s); c.quadraticCurveTo(26 * s, 4 * s, 0, 6 * s); c.fill();
          c.restore();
        }
        c.restore();
      } else {
        // Ráfaga de plumas cada pocos segundos
        const cyc = t % 2.6;
        if (cyc < 0.9) {
          c.save(); c.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 10; i++) {
            const a = i / 10 * TAU + Math.floor(t / 2.6), d = cyc * 55 * s;
            c.globalAlpha = 1 - cyc / 0.9;
            c.save(); c.translate(Math.cos(a) * d, -40 * s + Math.sin(a) * d * 0.7); c.rotate(a + Math.PI / 2);
            c.fillStyle = i % 2 ? '#fde047' : '#fb923c'; c.beginPath(); c.ellipse(0, 0, 1.6 * s, 5 * s, 0, 0, TAU); c.fill();
            c.restore();
          }
          c.restore();
        }
      }
    },
    aura_pesadilla(c, s, t, layer) {
      if (layer === 'back') {
        // Ojo gigante en la niebla que parpadea y te mira
        const k = blinkK(t), ey = -66 * s;
        const g = c.createRadialGradient(0, ey, 2 * s, 0, ey, 34 * s);
        g.addColorStop(0, 'rgba(127,29,29,.55)'); g.addColorStop(1, 'rgba(20,0,10,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(0, ey, 34 * s, 22 * s, 0, 0, TAU); c.fill();
        c.save(); c.translate(0, ey); c.scale(1, Math.max(0.05, k));
        c.fillStyle = 'rgba(254,226,226,.85)'; c.beginPath(); c.ellipse(0, 0, 18 * s, 8 * s, 0, 0, TAU); c.fill();
        const ix = Math.sin(t * 0.7) * 6 * s;
        c.fillStyle = '#b91c1c'; c.beginPath(); c.arc(ix, 0, 6 * s, 0, TAU); c.fill();
        c.fillStyle = '#0a0000'; c.beginPath(); c.ellipse(ix, 0, 1.6 * s, 5 * s, 0, 0, TAU); c.fill();
        c.restore();
      } else {
        // Rayos rojos que chisporrotean
        const z = Math.floor(t * 2.5), zp = t * 2.5 - z;
        if (hash(z + 300) > 0.5 && zp < 0.3) {
          c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(248,113,113,${1 - zp / 0.3})`; c.lineWidth = 1.4 * s;
          let x = (hash(z + 301) - 0.5) * 40 * s, y = -80 * s;
          c.beginPath(); c.moveTo(x, y);
          for (let j = 1; j <= 6; j++) { x += (hash(z * 5 + j) - 0.5) * 14 * s; y += 13 * s; c.lineTo(x, y); }
          c.stroke(); c.restore();
        }
      }
    },
    aura_infernal(c, s, t, layer) {
      if (layer === 'back') {
        // Cuernos de fuego detrás de la cabeza
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const side of [-1, 1]) {
          c.save(); c.translate(side * 8 * s, -58 * s); c.scale(side, 1);
          const g = c.createLinearGradient(0, 0, 20 * s, -26 * s);
          g.addColorStop(0, 'rgba(234,88,12,.85)'); g.addColorStop(1, 'rgba(254,240,138,.9)');
          c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(18 * s, -2 * s, 22 * s + Math.sin(t * 6) * s, -28 * s);
          c.quadraticCurveTo(10 * s, -10 * s, -3 * s, -6 * s); c.closePath(); c.fill();
          c.restore();
        }
        // Anillo de runas que gira en el suelo
        c.scale(1, 0.3); c.rotate(-t * 0.8);
        c.strokeStyle = 'rgba(249,115,22,.8)'; c.lineWidth = 1.4 * s;
        c.beginPath(); c.arc(0, 0, 38 * s, 0, TAU); c.stroke();
        c.fillStyle = 'rgba(253,186,116,.9)';
        for (let i = 0; i < 10; i++) { const a = i * TAU / 10; c.fillRect(Math.cos(a) * 38 * s - 2 * s, Math.sin(a) * 38 * s - 2 * s, 4 * s, 4 * s); }
        c.restore();
      }
      // Bolas de fuego que orbitan
      for (let i = 0; i < 3; i++) {
        const a = -t * 1.8 + i * TAU / 3, depth = Math.sin(a);
        if ((depth > 0) !== (layer === 'front')) continue;
        const x = Math.cos(a) * 28 * s, y = (-30 + Math.sin(t * 3 + i) * 8) * s + depth * 5 * s;
        c.save(); c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(x, y, 0, x, y, 7 * s);
        g.addColorStop(0, '#fef9c3'); g.addColorStop(0.4, 'rgba(249,115,22,.9)'); g.addColorStop(1, 'rgba(220,38,38,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, 7 * s, 0, TAU); c.fill();
        c.restore();
      }
    },
    aura_fuego(c, s, t, layer) {
      if (layer !== 'back') return;
      // Halo de llamas girando a la altura de la cintura
      c.save(); c.globalCompositeOperation = 'lighter'; c.translate(0, -26 * s); c.scale(1, 0.3);
      for (let i = 0; i < 12; i++) {
        const a = t * 1.6 + i * TAU / 12;
        c.fillStyle = i % 2 ? 'rgba(253,224,71,.7)' : 'rgba(249,115,22,.7)';
        c.beginPath(); c.arc(Math.cos(a) * 30 * s, Math.sin(a) * 30 * s, (2.5 + Math.sin(t * 8 + i)) * s, 0, TAU); c.fill();
      }
      c.restore();
    },
    aura_sombra(c, s, t, layer) {
      if (layer !== 'back') return;
      // Tentáculos de sombra que salen del suelo
      c.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1, base = (10 + (i >> 1) * 9) * s * side, sw = Math.sin(t * 2 + i) * 8 * s;
        c.strokeStyle = `rgba(46,16,101,${0.55 + Math.sin(t * 3 + i) * 0.15})`; c.lineWidth = (4 - (i >> 1)) * s;
        c.beginPath(); c.moveTo(base, 2 * s); c.quadraticCurveTo(base + side * 14 * s + sw, -20 * s, base + side * 6 * s - sw, -(34 + i * 4) * s); c.stroke();
      }
      // Ojos brillando en la oscuridad
      const k = blinkK(t + 1.3);
      c.fillStyle = `rgba(216,180,254,${0.85 * k})`;
      for (const [x, y] of [[-24, -58], [22, -50]]) { c.beginPath(); c.ellipse((x - 3) * s, y * s, 1.6 * s, 1.6 * s * k, 0, 0, TAU); c.ellipse((x + 3) * s, y * s, 1.6 * s, 1.6 * s * k, 0, 0, TAU); c.fill(); }
    },
  };
  /** Partículas del aura al atacar (las auras especiales dejan su marca en cada golpe). */
  const AURA_HIT = { aura_fenix: 'estela_fuego', aura_pesadilla: 'estela_almas', aura_infernal: 'estela_infernal', aura_fuego: 'estela_fuego', aura_sombra: 'estela_caos', aura_dorada: 'estela_luz', aura_hielo: 'estela_luz' };
  function auraPart(aura, x, y, face) {
    const id = AURA_HIT[aura];
    return id ? trailPart(id, x, y, face) : null;
  }

  /** Fénix: ave de fuego que vuela, con alas que aletean, cola de plumas y chispas. */
  function phoenix(c, x, y, size, t, face = 1, alpha = 1) {
    const k = size / 30, bob = Math.sin(t * 3) * 3 * k, flap = Math.sin(t * 9);
    c.save(); c.globalAlpha = alpha;
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x, y, 12 * k, 4 * k, 0, 0, TAU); c.fill();
    c.translate(x, y - 30 * k + bob); c.scale(face * k, k);
    c.globalCompositeOperation = 'lighter';
    const halo = c.createRadialGradient(0, 0, 2, 0, 0, 36);
    halo.addColorStop(0, 'rgba(253,186,116,.6)'); halo.addColorStop(1, 'rgba(249,115,22,0)');
    c.fillStyle = halo; c.beginPath(); c.arc(0, 0, 36, 0, TAU); c.fill();
    c.globalCompositeOperation = 'source-over';
    // Cola: plumas largas que ondean
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.24, len = 30 + (2 - Math.abs(i - 2)) * 9, wv = Math.sin(t * 4 + i) * 5;
      const ex = -8 - Math.cos(a) * len, ey = 6 + Math.sin(a) * len * 0.6 + wv;
      const g = c.createLinearGradient(-6, 4, ex, ey);
      g.addColorStop(0, '#fde047'); g.addColorStop(0.55, '#f97316'); g.addColorStop(1, 'rgba(220,38,38,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(-6, 1);
      c.quadraticCurveTo((ex - 6) / 2, (ey + 1) / 2 - 6 + wv * 0.5, ex, ey);
      c.quadraticCurveTo((ex - 6) / 2, (ey + 1) / 2 + 4, -4, 7); c.closePath(); c.fill();
      c.fillStyle = 'rgba(254,240,138,.9)'; c.beginPath(); c.arc(ex * 0.8 - 1, ey * 0.8 + 1, 1.8, 0, TAU); c.fill();
    }
    const wing = back => {
      const lift = flap * (back ? 0.8 : 1);
      c.save(); c.translate(back ? 3 : 0, -3); c.rotate(-0.35 - lift * 0.6);
      for (let j = 0; j < 5; j++) {
        const len = 27 - j * 3, ang = -1.25 + j * 0.3, ex = Math.cos(ang) * len * -0.35, ey = Math.sin(ang) * len;
        const g = c.createLinearGradient(0, 0, ex, ey);
        g.addColorStop(0, back ? '#c2410c' : '#fb923c'); g.addColorStop(0.7, back ? '#dc2626' : '#fde047'); g.addColorStop(1, 'rgba(254,240,138,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(-4, 0);
        c.quadraticCurveTo(ex * 0.5 - 6, ey * 0.5, ex - 4 - j * 2, ey);
        c.quadraticCurveTo(ex * 0.5 + 5, ey * 0.5 + 3, 5, 2); c.closePath(); c.fill();
      }
      c.restore();
    };
    wing(true);
    const bg = c.createLinearGradient(0, -10, 0, 10);
    bg.addColorStop(0, '#fde68a'); bg.addColorStop(0.5, '#f97316'); bg.addColorStop(1, '#b91c1c');
    c.fillStyle = bg; c.beginPath(); c.ellipse(0, 2, 11, 7, -0.2, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(9, -6, 6, 5.5, 0, 0, TAU); c.fill();
    // Cresta de llamas
    for (let j = 0; j < 3; j++) {
      const h = 8 + j * 2 + Math.sin(t * 10 + j) * 1.5;
      c.fillStyle = j === 1 ? '#fde047' : '#fb923c';
      c.beginPath(); c.moveTo(5 + j * 2, -10); c.quadraticCurveTo(1 + j * 2, -10 - h * 0.6, -2 + j * 3, -10 - h); c.quadraticCurveTo(6 + j * 2, -12 - h * 0.3, 9 + j * 2, -10); c.fill();
    }
    c.fillStyle = '#facc15'; c.beginPath(); c.moveTo(14, -7.5); c.lineTo(20.5, -5.2); c.lineTo(14, -3.5); c.closePath(); c.fill();
    c.fillStyle = '#fff7ed'; c.beginPath(); c.arc(11, -7.5, 1.9, 0, TAU); c.fill();
    c.fillStyle = '#7c2d12'; c.beginPath(); c.arc(11.6, -7.5, 1, 0, TAU); c.fill();
    wing(false);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const ph = (t * 0.9 + i / 8) % 1;
      c.globalAlpha = alpha * (1 - ph); c.fillStyle = i % 2 ? '#fde047' : '#fb923c';
      c.beginPath(); c.arc(-10 - ph * 30 + Math.sin(i * 3 + t * 2) * 6, 8 + Math.sin(i * 1.7) * 10 - ph * 14, 1.7 * (1 - ph) + 0.4, 0, TAU); c.fill();
    }
    c.restore();
  }

  /** Partícula de estela según el cosmético (hojas, destellos, brasas, remolinos). */
  const TRAIL_SHAPE = { estela_luz: 'star', estela_hojas: 'leaf', estela_fuego: 'ember', estela_caos: 'swirl', estela_almas: 'soul', estela_infernal: 'hellfire' };
  function trailPart(id, x, y, face, k = 1) {
    const C = COSMETICS[id], shape = TRAIL_SHAPE[id] || 'dot', r = Math.random;
    const pal = { star: ['#fde68a', '#fffbeb', '#facc15'], leaf: ['#84cc16', '#4d7c0f', '#a3e635', '#65a30d'], ember: ['#fde047', '#fb923c', '#ef4444'], swirl: ['#f43f5e', '#a855f7', '#fb7185'], soul: ['#f5f3ff', '#e9d5ff', '#c4b5fd'], hellfire: ['#ef4444', '#f97316', '#fde047'] }[shape] || [C.color];
    const p = { x: x - face * 8 * k + (r() - 0.5) * 10 * k, y: y - (2 + r() * 16) * k, vx: -face * (10 + r() * 25) * k, vy: -(10 + r() * 30) * k,
                life: 0.7, max: 0.7, color: pal[Math.floor(r() * pal.length)], size: (2.5 + r() * 2.5) * k, grav: -20 * k, shape, rot: r() * TAU, spin: (r() - 0.5) * 8 };
    if (shape === 'leaf') { p.grav = 45 * k; p.vy = -(20 + r() * 25) * k; p.life = p.max = 0.9; p.size *= 1.3; }
    if (shape === 'ember') { p.grav = -70 * k; p.life = p.max = 0.6; }
    if (shape === 'swirl') { p.spin = 10 * (r() < 0.5 ? -1 : 1); p.size *= 1.4; p.vy *= 0.4; }
    if (shape === 'star') { p.life = p.max = 0.65; }
    if (shape === 'soul') { p.grav = -35 * k; p.life = p.max = 1.0; p.size *= 1.5; p.vx *= 0.5; }
    if (shape === 'hellfire') { p.grav = -90 * k; p.life = p.max = 0.55; p.size *= 1.4; }
    return p;
  }
  function drawPart(c, p) {
    const a = Math.max(0, p.life / p.max), age = p.max - p.life, rot = (p.rot || 0) + age * (p.spin || 0);
    c.globalAlpha = a; c.fillStyle = p.color;
    if (p.shape === 'star') {
      c.save(); c.globalCompositeOperation = 'lighter';
      sparkle(c, p.x, p.y, p.size * (0.6 + Math.sin(age * 25) * 0.4 + 0.4));
      c.globalAlpha = a * 0.35; c.beginPath(); c.arc(p.x, p.y, p.size * 1.6, 0, TAU); c.fill(); c.restore();
    } else if (p.shape === 'leaf') {
      c.save(); c.translate(p.x + Math.sin(age * 6 + p.rot) * 3, p.y); c.rotate(rot);
      c.beginPath(); c.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(20,50,10,.5)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-p.size, 0); c.lineTo(p.size, 0); c.stroke();
      c.restore();
    } else if (p.shape === 'ember') {
      c.save(); c.globalCompositeOperation = 'lighter';
      const r = p.size * (0.5 + a * 0.5);
      c.globalAlpha = a * 0.4; c.beginPath(); c.arc(p.x, p.y, r * 2.2, 0, TAU); c.fill();
      c.globalAlpha = a; c.fillStyle = a > 0.5 ? '#fef9c3' : p.color; c.beginPath(); c.arc(p.x, p.y, r * 0.7, 0, TAU); c.fill();
      c.restore();
    } else if (p.shape === 'swirl') {
      c.save(); c.translate(p.x, p.y); c.rotate(rot); c.strokeStyle = p.color; c.lineWidth = 1.4;
      c.beginPath();
      for (let i = 0; i <= 14; i++) { const q = i / 14, ang = q * TAU * 1.4, rr = q * p.size * (1.4 - a * 0.4); i ? c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : c.moveTo(0, 0); }
      c.stroke(); c.restore();
    } else if (p.shape === 'soul') {
      // Alma: fantasmita con cola que ondea
      const r = p.size * 0.6, wv = Math.sin(age * 10 + p.rot) * r * 0.4;
      c.save(); c.globalAlpha = a * 0.9;
      c.beginPath(); c.arc(p.x, p.y, r, Math.PI, 0);
      c.quadraticCurveTo(p.x + r + wv, p.y + r * 1.4, p.x + wv * 0.5, p.y + r * 2.2);
      c.quadraticCurveTo(p.x - r + wv, p.y + r * 1.4, p.x - r, p.y); c.fill();
      c.fillStyle = '#4c1d95'; c.beginPath(); c.arc(p.x - r * 0.35, p.y - r * 0.1, r * 0.18, 0, TAU); c.arc(p.x + r * 0.35, p.y - r * 0.1, r * 0.18, 0, TAU); c.fill();
      c.restore();
    } else if (p.shape === 'hellfire') {
      // Llamita infernal con centro oscuro
      c.save(); c.globalCompositeOperation = 'lighter';
      const h = p.size * (1.6 + a);
      c.fillStyle = p.color; flameShape(c, p.x, p.y, p.size * 0.5, h, Math.sin(age * 12) * 2);
      c.restore();
      c.fillStyle = `rgba(20,0,0,${a * 0.6})`; flameShape(c, p.x, p.y, p.size * 0.22, h * 0.45, 0);
    } else c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    c.globalAlpha = 1;
  }

  function knightArt(c, x, y, s, o) {
    const unit = KNIGHT_PX * s / ART.base.k, tint = o.flash ? 'rgba(255,50,50,.6)' : null;
    const G = o.plain ? {} : gearLook(), t = o.time || 0;
    let key, style;
    if (o.swing >= 0) { style = o.style || (o.heavy ? 'smash' : 'slash'); key = knightSwing(o); }
    else key = o.walk ? 'k_w' + walkIndex(o.walk) : null;
    const draw = (tn, alpha) => key ? blit(c, key, tn, unit, alpha) : blitIdleTint(c, t, tn, unit, alpha);
    c.save();
    c.translate(x, y);
    c.scale(o.face, 1);
    const auraId = o.aura !== undefined ? o.aura : (Game.S && Game.S.cosmetics && Game.S.cosmetics.aura);
    if (auraId && !o.ghost) auraFx(c, s, t, auraId, 'back');
    // Arma épica o mejor: el caballero brilla con el color del arma
    if (G.wr >= 3 && G.weapon && !tint) {
      const glow = 0.35 + Math.sin(t * 4) * 0.12, off = 1.6 * s;
      for (const [dx, dy] of [[off, 0], [-off, 0], [0, off], [0, -off]]) { c.save(); c.translate(dx, dy); draw(G.weapon.color, glow); c.restore(); }
    }
    draw(tint);
    // Armadura rara o mejor: tinte del color de la armadura
    if (G.ar >= 2 && G.armor && !tint) draw(G.armor.color, 0.1 + 0.05 * (G.ar - 2));
    if (auraId && !o.ghost) auraFx(c, s, t, auraId, 'front');
    if (o.swing >= 0) swingArc(c, style, o.swing, s, arcColor(o.weaponColor));
    c.restore();
  }
  /** Reposo con tinte opcional (para brillo y color de armadura). */
  function blitIdleTint(c, t, tn, unit, alpha) {
    const ph = ((t / 2.6) % 1 + 1) % 1 * IDLE_FRAMES, i = Math.floor(ph), fr = ph - i;
    const a = alpha === undefined ? 1 : alpha;
    blit(c, 'k_i' + i, tn, unit, a);
    blit(c, 'k_i' + ((i + 1) % IDLE_FRAMES), tn, unit, a * fr);
  }

  /** Tamaño y desplazamiento para que un enemigo ilustrado quepa entero en un recuadro. */
  function artFit(def, maxW, maxH) {
    const key = def.sprite && def.sprite.art, f = key && ART.frames[key + '_w0'];
    if (!f || !artOn()) return null;
    const per = (ART.height[key] || 1.25) / ART.base[key] / f[6];   // unidades por píxel del cuadro, por unidad de tamaño
    const size = Math.min(maxH / (f[3] * per), maxW / (f[2] * per));
    return { size, dx: (f[4] - f[2] / 2) * per * size, dy: (f[3] - f[5]) * per * size };
  }

  /** Enemigo ilustrado: camina moviendo patas y brazos, respira, prepara el golpe y ataca. */
  function enemyArt(c, x, y, size, o, sp) {
    const key = sp.art;
    if (!ART.base[key]) return false;
    const t = o.time || 0, seed = o.seed || 0;
    const unit = size * (ART.height[key] || 1.25) / ART.base[key];
    const tint = o.flash ? 'rgba(255,255,255,.7)' : null;
    shadow(c, x, y, size * (key === 'slime' ? 0.42 : key === 'dragon' ? 0.55 : 0.36));
    let sx = 1, sy = 1, dy = 0, frame = null;
    if (key === 'slime') {
      const b = Math.abs(Math.sin(o.walk * 1.4));
      sx = 1 + (1 - b) * 0.12; sy = 1 - (1 - b) * 0.1; dy = -b * size * 0.12; frame = key + '_w0';
    } else if (key === 'flame') {
      sy = 1 + Math.sin(t * 9 + seed) * 0.05; sx = 1 - Math.sin(t * 9 + seed) * 0.03; dy = -size * 0.08 + Math.sin(t * 3 + seed) * 2; frame = key + '_w0';
    } else if (o.atk > 0) frame = key + (o.atk > 0.65 ? '_a0' : '_a1');        // prepara el golpe
    else if (o.recover > 0 || o.dash) frame = key + (o.dash || o.recover > 0.18 ? '_a2' : '_a3');   // golpea y se recupera
    else if (o.moving) frame = key + '_w' + walkIndex(o.walk);
    c.save();
    c.translate(x, y + dy);
    c.scale(-o.face * sx, sy);     // los dibujos miran a la izquierda
    if (frame) blit(c, frame, tint, unit);
    else blitIdle(c, key, t + seed * 0.37, tint, unit);
    c.restore();
    return true;
  }

  function knight(c, x, y, s, o) {
    const t = o.time || 0;
    const idle = !o.walk && o.swing < 0;
    const bob = idle ? Math.sin(t * 2.2) * 0.6 : Math.abs(Math.sin(o.walk)) * -1;
    // Al recibir daño todo se tiñe de rojo
    const F = col => (o.flash ? mix(col, '#ff3b3b', 0.6) : col);
    const steelBase = o.armorColor ? mix(KP.steel, o.armorColor, 0.18) : KP.steel;
    const steel = F(steelBase), steelD = F(mix(steelBase, '#000000', 0.5)), steelL = F(mix(steelBase, '#ffffff', 0.38));
    // Rango del caballero: los ribetes dorados, emblemas, brillo y aura aparecen al subir de rango
    const rank = o.rank || 0;
    const gold = F(rank >= 1 ? KP.gold : '#9aa3b2');
    const legA = Math.sin(o.walk) * 0.55;

    const rest = 0.8 + (idle ? Math.sin(t * 2.2) * 0.03 : Math.sin(o.walk) * 0.08);
    const pose = swingPose(o, rest);

    if (rank >= 4) {
      // Aura dorada (Legendario) o roja del caos (Señor del Caos)
      const auraCol = rank >= 5 ? '244,63,94' : '251,191,36';
      const pulse = 0.22 + Math.sin(t * 4) * 0.08;
      const ag = c.createRadialGradient(x, y - 26 * s, 4 * s, x, y - 26 * s, 34 * s);
      ag.addColorStop(0, `rgba(${auraCol},${pulse})`); ag.addColorStop(1, `rgba(${auraCol},0)`);
      c.fillStyle = ag; c.beginPath(); c.ellipse(x, y - 26 * s, 30 * s, 36 * s, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = `rgba(${auraCol},.9)`;
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.7 + i / 5) % 1;
        c.globalAlpha = 1 - ph;
        c.beginPath(); c.arc(x + Math.sin(i * 2.3 + t) * 14 * s, y - ph * 52 * s, 1.3 * s, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }
    shadow(c, x, y, 17 * s);
    if (artOn()) { knightArt(c, x, y, s, o); return; }
    c.save();
    c.translate(x, y);
    c.scale(o.face * s, s);
    c.rotate(pose.lean);   // el cuerpo acompaña el golpe

    // Capa (detrás de todo)
    const wave = Math.sin(t * 3 + o.walk * 0.5) * 1.6 + (o.walk ? 3 : 0) + (o.swing >= 0 ? 4 : 0);
    c.fillStyle = F(KP.navyD);
    c.beginPath();
    c.moveTo(1, -40 + bob);
    c.quadraticCurveTo(-10 - wave * 0.5, -30, -15 - wave, -5);
    const jag = [[-15 - wave, -5], [-13 - wave, -1], [-11 - wave * 0.8, -4], [-9 - wave * 0.6, 0], [-7 - wave * 0.4, -3], [-5 - wave * 0.2, 0], [-3, -4]];
    jag.forEach(([px, py]) => c.lineTo(px, py));
    c.quadraticCurveTo(-4, -22, -2, -38 + bob);
    c.closePath(); c.fill();
    c.fillStyle = F(KP.navy);
    c.beginPath();
    c.moveTo(-1, -39 + bob);
    c.quadraticCurveTo(-8 - wave * 0.4, -28, -12 - wave * 0.8, -6);
    c.lineTo(-9 - wave * 0.6, -2); c.lineTo(-7 - wave * 0.4, -5); c.lineTo(-5, -2);
    c.quadraticCurveTo(-4, -20, -1, -39 + bob);
    c.fill();
    // Cruz dorada de la capa (desde el rango Caballero)
    c.strokeStyle = rank >= 2 ? gold : 'rgba(0,0,0,0)'; c.lineWidth = 0.9;
    const cx = -7.5 - wave * 0.4, cy = -21;
    c.beginPath(); c.moveTo(cx, cy - 4); c.lineTo(cx, cy + 5); c.moveTo(cx - 2.6, cy - 1); c.lineTo(cx + 2.6, cy - 1); c.stroke();

    // Piernas
    const leg = (px, ang, back) => {
      const D = col => (back ? mix(col, '#000000', 0.3) : col);
      c.save(); c.translate(px, -22); c.rotate(ang);
      c.fillStyle = D(F(KP.cloth)); c.fillRect(-3.2, 0, 6.4, 11.5);
      c.fillStyle = D(steel); rrect(c, -3.3, 12, 6.6, 7.5, 1.5); c.fill();
      c.fillStyle = D(steelL); c.beginPath(); c.ellipse(0.6, 11.5, 3.8, 2.8, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = D(gold); c.fillRect(-3.3, 15.5, 6.6, 0.8);
      c.fillStyle = D(F(KP.leatherD)); rrect(c, -3.6, 19, 9, 4, 1.5); c.fill();
      c.restore();
    };
    leg(-3, -legA, true);
    leg(3, legA, false);

    c.save();
    c.translate(0, bob);
    // Brazo trasero con escudo (queda quieto al atacar: el golpe es a una mano)
    const shieldA = o.swing >= 0 ? 0.15 : 0.25 - legA * 0.25;
    c.save(); c.translate(-3, -37); c.rotate(shieldA);
    c.fillStyle = steelD; rrect(c, -2.4, 0, 4.8, 12, 2); c.fill();
    c.fillStyle = F(KP.leatherD); rrect(c, -2.6, 11, 5.2, 4.5, 1.5); c.fill();
    // Escudo de cometa: acero oscuro, borde dorado y cruz azul
    c.translate(-1, 8);
    c.fillStyle = steel;
    c.beginPath(); c.moveTo(-9, -9); c.lineTo(7, -9); c.lineTo(7, 2); c.quadraticCurveTo(6, 10, -1, 15); c.quadraticCurveTo(-8, 10, -9, 2); c.closePath(); c.fill();
    c.strokeStyle = gold; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = F(KP.navy);
    c.fillRect(-2.6, -7, 3.2, 18); c.fillRect(-7, -3, 12, 3);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-8, -8, 4, 9);
    c.restore();
    // Faldón azul y cinturón
    c.fillStyle = F(KP.navy);
    c.beginPath(); c.moveTo(-7, -25); c.lineTo(7, -25); c.lineTo(8.5, -13); c.lineTo(3, -12); c.lineTo(1, -16); c.lineTo(-1, -12); c.lineTo(-8, -13); c.closePath(); c.fill();
    c.strokeStyle = gold; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(8.5, -13); c.lineTo(3, -12); c.moveTo(-1, -12); c.lineTo(-8, -13); c.stroke();
    c.fillStyle = F(KP.leather); c.fillRect(-7.5, -27, 15, 3);
    c.fillStyle = gold; c.fillRect(1.5, -27.3, 3, 3.6);
    c.fillStyle = F(KP.leatherL); rrect(c, -6.5, -25.5, 4, 5, 1); c.fill();
    c.fillStyle = F(KP.leatherD); rrect(c, 5, -25, 3, 4, 1); c.fill();
    // Peto
    const g = c.createLinearGradient(-7, -41, 7, -27);
    g.addColorStop(0, steelL); g.addColorStop(0.55, steel); g.addColorStop(1, steelD);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-7, -41); c.lineTo(7, -41); c.lineTo(8.2, -32); c.lineTo(6.5, -27); c.lineTo(-6.5, -27); c.lineTo(-8, -32); c.closePath(); c.fill();
    c.strokeStyle = gold; c.lineWidth = 0.8; c.stroke();
    c.strokeStyle = steelD; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(-6, -30); c.lineTo(6.8, -30); c.stroke();
    // Emblema dorado del peto (desde el rango Guerrero)
    c.fillStyle = rank >= 1 ? gold : steelD;
    c.beginPath(); c.moveTo(2.5, -38.5); c.lineTo(3.4, -35.2); c.lineTo(6, -34.5); c.lineTo(3.4, -33.8); c.lineTo(2.5, -31); c.lineTo(1.6, -33.8); c.lineTo(-1, -34.5); c.lineTo(1.6, -35.2); c.closePath(); c.fill();

    // Bufanda / capucha azul
    c.fillStyle = F(KP.navyL);
    c.beginPath(); c.ellipse(0.5, -41.5, 7, 3.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = F(KP.navy);
    c.beginPath(); c.moveTo(-5, -43); c.quadraticCurveTo(-9, -40, -8, -34); c.lineTo(-5.5, -36); c.quadraticCurveTo(-5, -40, -2, -42); c.fill();

    // Cabeza
    if (o.helmet) {
      const hg = c.createLinearGradient(-5, -56, 7, -44);
      hg.addColorStop(0, steelL); hg.addColorStop(1, steelD);
      c.fillStyle = hg;
      c.beginPath(); c.moveTo(-5, -44); c.lineTo(-5.5, -51); c.quadraticCurveTo(-4, -57, 1.5, -57); c.quadraticCurveTo(7, -57, 7.5, -51); c.lineTo(7, -44); c.closePath(); c.fill();
      c.strokeStyle = gold; c.lineWidth = 0.8; c.stroke();
      c.fillStyle = '#05070c'; c.fillRect(1.5, -50.5, 6, 1.5);
      c.strokeStyle = gold; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(5.5, -56); c.lineTo(5.5, -46); c.moveTo(3, -52.5); c.lineTo(7.5, -52.5); c.stroke();
    } else {
      c.fillStyle = F(KP.skin);
      c.beginPath(); c.arc(1.2, -47.5, 5.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(3.5, -44.5); c.lineTo(6.6, -46); c.lineTo(6.2, -48.5); c.closePath(); c.fill();
      c.fillStyle = F(KP.skinD);
      c.beginPath(); c.ellipse(-1.2, -47.3, 1.2, 1.7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = rank >= 5 ? '#f43f5e' : '#1a120c'; c.fillRect(4, -48.8, 1.5, 1.1);
      if (rank >= 5) { c.fillStyle = 'rgba(244,63,94,.45)'; c.beginPath(); c.arc(4.8, -48.3, 2.4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = F(KP.hair); c.fillRect(3.4, -50.4, 3, 0.8);
      // Pelo oscuro y despeinado
      c.fillStyle = F(KP.hair);
      c.beginPath();
      [[-5.8, -44.5], [-7.2, -49.5], [-5, -49], [-6, -53.5], [-2, -52.5], [-1, -56.5], [2, -53.8], [5.5, -56], [5.5, -52], [8.2, -51.5], [6.6, -49.6], [4.6, -51], [2.4, -50], [0.6, -50.8], [-0.6, -48], [-2.4, -45]]
        .forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
      c.closePath(); c.fill();
      c.strokeStyle = F(KP.hairL); c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(-3, -50); c.lineTo(0, -54); c.moveTo(1.5, -51.5); c.lineTo(4.5, -54); c.stroke();
    }

    // Hombrera delantera de placas
    for (let k = 2; k >= 0; k--) {
      c.fillStyle = k === 0 ? steelL : k === 1 ? steel : steelD;
      c.beginPath(); c.ellipse(2.5, -38.5 + k * 2.6, 6.4 - k * 0.5, 3.8, -0.15, Math.PI * 0.95, Math.PI * 2.05); c.closePath(); c.fill();
      c.strokeStyle = gold; c.lineWidth = 0.6; c.stroke();
    }

    // Brazo con la espada
    const ang = pose.ang;
    c.save();
    c.translate(3, -36);
    if (pose.trail) {
      // Estela del corte: solo el tramo recorrido, de arriba hacia abajo
      const tr = pose.trail, big = o.style === 'smash' || (!o.style && o.heavy);
      c.save();
      c.globalAlpha = Math.max(0, tr.a);
      c.shadowColor = '#60a5fa'; c.shadowBlur = big ? 16 : 10;
      if (tr.thrust) {
        c.rotate(ang);
        const g = c.createLinearGradient(14, 0, 70, 0);
        g.addColorStop(0, 'rgba(147,197,253,0)'); g.addColorStop(1, 'rgba(224,242,254,.95)');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(14, -4); c.lineTo(66 + pose.ext, -1); c.lineTo(72 + pose.ext, 0); c.lineTo(66 + pose.ext, 1); c.lineTo(14, 4); c.closePath(); c.fill();
      } else if (tr.to > tr.from) {
        c.fillStyle = big ? 'rgba(125,211,252,.75)' : 'rgba(147,197,253,.6)';
        c.beginPath(); c.arc(0, 0, 54, tr.from, tr.to, false); c.arc(0, 0, big ? 32 : 42, tr.to, tr.from, true); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = big ? 3 : 2;
        c.beginPath(); c.arc(0, 0, 54, Math.max(tr.from, tr.to - 1.1), tr.to, false); c.stroke();
      }
      c.restore();
    }
    c.rotate(ang);
    // En la estocada el brazo se estira; el puño y la espada avanzan con él
    const ext = Math.max(-3, pose.ext);
    c.fillStyle = steel; rrect(c, -1.8, -2.8, 11 + Math.max(0, ext), 5.6, 2.2); c.fill();
    c.fillStyle = gold; c.beginPath(); c.arc(5, 0, 1.2, 0, Math.PI * 2); c.fill();
    c.translate(ext, 0);
    c.fillStyle = steelD; rrect(c, 9.5, -3.2, 5.5, 6.4, 1.8); c.fill();
    // Espada: pomo con gema, empuñadura, guarda dorada y hoja larga
    c.fillStyle = gold; c.beginPath(); c.arc(8.4, 0, 2.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = F(KP.gem); c.beginPath(); c.arc(8.4, 0, 1.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = F(KP.leather); c.fillRect(14.5, -1.3, 3.5, 2.6);
    c.fillStyle = gold;
    c.beginPath(); c.moveTo(18, -6.5); c.lineTo(19.8, -5.5); c.lineTo(19.8, 5.5); c.lineTo(18, 6.5); c.lineTo(17.4, 0); c.closePath(); c.fill();
    c.fillRect(19.8, -1.2, 2.2, 2.4);
    const blade = F(o.weaponColor || '#d6dbe4');
    if (rank >= 3) { c.shadowColor = rank >= 5 ? '#f43f5e' : rank >= 4 ? '#fbbf24' : '#93c5fd'; c.shadowBlur = 8; }
    c.fillStyle = blade;
    c.beginPath(); c.moveTo(21.5, -1.9); c.lineTo(50, -1.4); c.lineTo(54, 0); c.lineTo(50, 1.4); c.lineTo(21.5, 1.9); c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(22, -1.5, 27, 0.7);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(22, 0.2, 25, 0.6);
    c.fillStyle = gold; c.fillRect(22, -0.3, 9, 0.6);
    c.restore();

    c.restore();
    c.restore();
  }

  /* ---------- Humanoide (bandidos, momias, arqueros, guerreros, magos, demonios, caballeros) ----------
     sp: body, skin, head (hood|wrap|turban|helmet|wizard|horns|crown), hood, weapon
         (dagger|scimitar|sword|staff|bow|claw), eye, aura, wings, mask, cape, spikes,
         icicles, tail                                                             */
  function humanoid(c, x, y, size, o, sp) {
    const s = size / 44;
    shadow(c, x, y, 15 * s);
    c.save();
    c.translate(x, y);
    c.scale(o.face * s, s);
    const F = col => (o.flash ? '#ffffff' : col);
    const legA = Math.sin(o.walk) * 0.45;
    const t = o.time || 0;
    const body = sp.body, dark = shade(body, -45), light = shade(body, 35);
    const robe = sp.head === 'wizard';
    const armored = sp.head === 'helmet' || sp.head === 'crown';
    const breathe = Math.sin(t * 2.5 + o.seed) * 0.6;

    if (sp.aura) {
      const ag = c.createRadialGradient(0, -26, 4, 0, -26, 34);
      ag.addColorStop(0, sp.aura + '66'); ag.addColorStop(1, sp.aura + '00');
      c.fillStyle = ag; c.beginPath(); c.ellipse(0, -26, 28, 34, 0, 0, Math.PI * 2); c.fill();
    }
    // Capa
    if (sp.cape) {
      const wv = Math.sin(t * 3 + o.seed) * 2 + (o.walk ? 2 : 0);
      c.fillStyle = F(sp.cape);
      c.beginPath(); c.moveTo(-3, -35); c.quadraticCurveTo(-14 - wv, -20, -15 - wv, -3);
      for (let i = 0; i < 5; i++) c.lineTo(-15 - wv + i * 3.2, i % 2 ? -1 : -5);
      c.quadraticCurveTo(-4, -18, 3, -34); c.closePath(); c.fill();
    }
    // Alas
    if (sp.wings) {
      const fl = Math.sin(t * 9 + o.seed) * 0.25;
      for (const side of [-1, 1]) {
        c.save(); c.translate(-3, -30); c.rotate(side * 0.25 + fl * side); c.scale(side < 0 ? 1 : 0.8, 1);
        c.fillStyle = F(shade(body, -15));
        c.beginPath(); c.moveTo(0, 0); c.lineTo(-24, -18); c.lineTo(-19, -7); c.lineTo(-28, -2); c.lineTo(-18, 2); c.lineTo(-21, 11); c.lineTo(-4, 6); c.closePath(); c.fill();
        c.strokeStyle = F(dark); c.lineWidth = 1;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(-19, -7); c.moveTo(0, 0); c.lineTo(-18, 2); c.stroke();
        c.restore();
      }
    }
    // Cola de demonio
    if (sp.tail) {
      c.strokeStyle = F(sp.skin); c.lineWidth = 2.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-6, -16); c.quadraticCurveTo(-18, -12 + Math.sin(t * 4) * 3, -20, -24); c.stroke();
      c.fillStyle = F(sp.skin); c.beginPath(); c.moveTo(-20, -28); c.lineTo(-23, -22); c.lineTo(-17, -23); c.closePath(); c.fill();
    }
    // Carcaj del arquero
    if (sp.weapon === 'bow') {
      c.fillStyle = F('#78350f'); rrect(c, -10, -36, 5, 16, 2); c.fill();
      c.strokeStyle = F('#e5e7eb'); c.lineWidth = 1;
      for (const ax of [-9, -7.5, -6]) { c.beginPath(); c.moveTo(ax, -36); c.lineTo(ax - 1, -40); c.stroke(); }
    }

    // Piernas (o túnica larga)
    if (robe) {
      const hem = Math.sin(o.walk) * 1.5;
      c.fillStyle = F(dark);
      c.beginPath(); c.moveTo(-8, -18); c.lineTo(8, -18); c.lineTo(12 + hem, 0); c.lineTo(-12 + hem, 0); c.closePath(); c.fill();
    } else {
      const leg = (px, a, back) => {
        c.save(); c.translate(px, -17); c.rotate(a);
        c.fillStyle = F(back ? shade(body, -60) : shade(body, -40)); rrect(c, -3, 0, 6, 11, 2); c.fill();
        c.fillStyle = F(armored ? (back ? shade(body, -20) : body) : '#2a1d14');
        rrect(c, -3.3, 10, 6.6, 7, 1.5); c.fill();
        c.fillRect(-3.3, 15, 8.5, 2.5);
        if (sp.head === 'wrap') { c.strokeStyle = F('#a8a08a'); c.lineWidth = 0.8; c.beginPath(); c.moveTo(-3, 3); c.lineTo(3, 5); c.moveTo(-3, 8); c.lineTo(3, 10); c.stroke(); }
        c.restore();
      };
      leg(-3.5, -legA, true); leg(3.5, legA, false);
    }

    // Brazo trasero
    c.save(); c.translate(-6, -33 + breathe * 0.3); c.rotate(0.3 - legA * 0.4);
    c.fillStyle = F(shade(body, -25)); rrect(c, -2.5, 0, 5, 12, 2); c.fill();
    c.fillStyle = F(sp.skin); c.beginPath(); c.arc(0, 13, 2.4, 0, Math.PI * 2); c.fill();
    c.restore();

    // Torso
    c.save(); c.translate(0, breathe * 0.3);
    const tg = c.createLinearGradient(-9, -36, 9, -16);
    tg.addColorStop(0, F(light)); tg.addColorStop(1, F(body));
    c.fillStyle = tg;
    if (robe) {
      c.beginPath(); c.moveTo(-8, -36); c.lineTo(8, -36); c.lineTo(9, -16); c.lineTo(-9, -16); c.closePath(); c.fill();
      // Runas brillantes
      c.fillStyle = o.flash ? '#fff' : (sp.eye || '#c084fc');
      c.globalAlpha = 0.6 + Math.sin(t * 4) * 0.3;
      c.fillRect(-1, -30, 2, 7); c.fillRect(-3, -27, 6, 1.5);
      c.beginPath(); c.arc(4, -9, 1.3, 0, 7); c.arc(-5, -6, 1.1, 0, 7); c.fill();
      c.globalAlpha = 1;
    } else {
      c.beginPath(); c.moveTo(-9.5, -36); c.lineTo(9.5, -36); c.lineTo(7.5, -17); c.lineTo(-7.5, -17); c.closePath(); c.fill();
    }
    // Detalles según el tipo
    if (sp.head === 'horns') {
      c.strokeStyle = F(shade(sp.skin, -40)); c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(0, -33); c.lineTo(0, -19); c.moveTo(-5, -27); c.lineTo(5, -27); c.moveTo(-4, -22); c.lineTo(4, -22); c.stroke();
    } else if (sp.head === 'wrap') {
      c.strokeStyle = F('#a8a08a'); c.lineWidth = 1;
      for (let i = -34; i < -18; i += 3.5) { c.beginPath(); c.moveTo(-9, i); c.lineTo(9, i + 2.5); c.stroke(); }
      c.strokeStyle = F('#d6cfb4'); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(6, -18); c.quadraticCurveTo(12, -12 + Math.sin(t * 5) * 2, 10, -6); c.stroke();
    } else if (armored) {
      c.fillStyle = F(shade(body, 55)); c.fillRect(-6, -34, 4, 9);
      c.strokeStyle = F(dark); c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(-8, -26); c.lineTo(8, -26); c.moveTo(-7.5, -21); c.lineTo(7.5, -21); c.stroke();
      if (sp.icicles) { c.fillStyle = F('#e0f2fe'); for (const ix of [-6, -1, 4]) { c.beginPath(); c.moveTo(ix - 1.5, -17); c.lineTo(ix, -12); c.lineTo(ix + 1.5, -17); c.fill(); } }
    } else if (sp.head === 'hood' || sp.head === 'turban') {
      c.strokeStyle = F(dark); c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(-2, -36); c.lineTo(2, -18); c.stroke();
      c.fillStyle = F(sp.mask || sp.hood); c.beginPath(); c.moveTo(-9, -24); c.lineTo(9, -27); c.lineTo(9, -24); c.lineTo(-9, -21); c.closePath(); c.fill();
    }
    // Cinturón
    if (!robe) {
      c.fillStyle = F('#2a1d14'); c.fillRect(-8, -19, 16, 2.6);
      c.fillStyle = F(armored ? '#9ca3af' : '#a16207'); c.fillRect(1, -19.3, 2.5, 3.2);
    } else { c.fillStyle = F(sp.hood || dark); c.fillRect(-8.5, -21, 17, 2.4); }
    // Hombreras
    if (armored) {
      c.fillStyle = F(shade(body, 20));
      c.beginPath(); c.ellipse(7, -34, 5, 3.4, -0.2, 0, Math.PI * 2); c.fill();
      if (sp.spikes) { c.fillStyle = F('#d1d5db'); for (const sx of [5, 8.5]) { c.beginPath(); c.moveTo(sx - 1.2, -36); c.lineTo(sx, -41); c.lineTo(sx + 1.2, -36); c.fill(); } }
    }
    c.restore();

    // Cabeza
    c.save(); c.translate(0, breathe * 0.4);
    const eye = sp.eye || '#111827';
    c.fillStyle = F(sp.skin);
    c.beginPath(); c.arc(1, -42, 7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(4, -38.5); c.lineTo(7.5, -40); c.lineTo(7, -43); c.closePath(); c.fill();
    const glowEye = (ex, ey) => {
      c.fillStyle = o.flash ? '#fff' : eye; c.fillRect(ex, ey, 2.4, 1.8);
      if (sp.eye) { c.fillStyle = eye + '55'; c.beginPath(); c.arc(ex + 1.2, ey + 0.9, 3.4, 0, Math.PI * 2); c.fill(); }
    };
    switch (sp.head) {
      case 'hood':
        c.fillStyle = F(sp.hood);
        c.beginPath(); c.arc(0, -43, 9, Math.PI * 0.85, Math.PI * 2.1); c.lineTo(-2, -36); c.closePath(); c.fill();
        c.fillStyle = F(sp.mask || '#111827'); c.fillRect(1, -41, 7.5, 4.5);
        glowEye(4, -45);
        break;
      case 'turban':
        glowEye(4, -44);
        c.fillStyle = F(sp.hood);
        c.beginPath(); c.ellipse(0, -47, 9, 5, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = F(shade(sp.hood, -30)); c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(-8, -48); c.quadraticCurveTo(0, -44, 8, -48); c.stroke();
        c.fillStyle = F('#ef4444'); c.beginPath(); c.arc(6, -47, 1.3, 0, 7); c.fill();
        c.fillStyle = F('#1c1917'); c.fillRect(3, -39, 4, 0.8);
        break;
      case 'wrap':
        c.strokeStyle = F('#a8a08a'); c.lineWidth = 1;
        for (let i = -48; i < -36; i += 3) { c.beginPath(); c.moveTo(-6, i); c.lineTo(8, i + 1.5); c.stroke(); }
        glowEye(4, -44);
        break;
      case 'helmet':
      case 'crown': {
        const hg = c.createLinearGradient(-7, -50, 7, -38);
        hg.addColorStop(0, F(shade(body, 60))); hg.addColorStop(1, F(shade(body, 10)));
        c.fillStyle = hg;
        c.beginPath(); c.moveTo(-7, -37); c.lineTo(-7.5, -44); c.quadraticCurveTo(-6, -51, 1, -51); c.quadraticCurveTo(8, -51, 8.5, -44); c.lineTo(8, -37); c.closePath(); c.fill();
        c.fillStyle = '#05070c'; c.fillRect(2, -44.5, 6.5, 1.8);
        glowEye(4.5, -44.5);
        if (sp.icicles) { c.fillStyle = F('#e0f2fe'); c.beginPath(); c.moveTo(-6, -50); c.lineTo(-3, -57); c.lineTo(0, -51); c.fill(); }
        if (sp.head === 'crown') {
          c.fillStyle = F('#a855f7');
          c.beginPath(); c.moveTo(-7, -50); c.lineTo(-6, -58); c.lineTo(-2.5, -52); c.lineTo(0.5, -60); c.lineTo(3.5, -52); c.lineTo(7, -58); c.lineTo(8, -50); c.closePath(); c.fill();
          c.fillStyle = o.flash ? '#fff' : '#f0abfc'; c.beginPath(); c.arc(0.5, -53, 1.2, 0, 7); c.fill();
        } else if (!sp.icicles) {
          c.fillStyle = F(sp.eye || '#b91c1c');
          c.beginPath(); c.moveTo(-2, -51); c.quadraticCurveTo(-10, -56, -12, -48); c.quadraticCurveTo(-7, -52, -2, -49); c.fill();
        }
        break;
      }
      case 'wizard':
        c.fillStyle = F('#0f0a1a'); c.beginPath(); c.arc(1, -42, 6.5, 0, Math.PI * 2); c.fill();
        glowEye(3, -43.5);
        c.fillStyle = F(sp.hood);
        c.beginPath(); c.moveTo(-10, -45); c.lineTo(12, -45); c.lineTo(-1 + Math.sin(t * 2) * 1.5, -68); c.closePath(); c.fill();
        c.fillStyle = F(sp.eye || '#a855f7'); c.fillRect(-8, -47, 18, 2);
        break;
      case 'horns':
        glowEye(4, -44);
        c.fillStyle = F('#f5e6c8');
        c.beginPath(); c.moveTo(-5, -47); c.quadraticCurveTo(-11, -54, -5, -59); c.quadraticCurveTo(-7, -53, -1, -48); c.fill();
        c.beginPath(); c.moveTo(2, -48); c.quadraticCurveTo(4, -56, 10, -58); c.quadraticCurveTo(6, -53, 6, -47); c.fill();
        c.fillStyle = F('#1c0505'); c.beginPath(); c.moveTo(2, -38.5); c.lineTo(8, -39.5); c.lineTo(6, -37); c.fill();
        c.fillStyle = '#fff'; c.fillRect(3, -39, 1, 1.4); c.fillRect(6, -39.3, 1, 1.4);
        break;
      default:
        glowEye(4, -44);
    }
    c.restore();

    // Brazo delantero con el arma
    c.save();
    c.translate(5, -33 + breathe * 0.3);
    const atk = o.atk > 0 ? 1 - o.atk : 0;
    let a;
    if (sp.weapon === 'bow') a = o.atk > 0 ? -0.1 : 0.5;
    else if (sp.weapon === 'staff') a = o.atk > 0 ? -1.2 + atk * 0.6 : 0.35;
    else a = o.atk > 0 ? -1.9 + atk * 0.5 : (o.recover > 0 ? 1.15 : 0.45);
    c.rotate(a);
    c.fillStyle = F(robe ? sp.hood || dark : shade(body, -10)); rrect(c, -2.5, -2.8, 10, 5.6, 2.2); c.fill();
    c.fillStyle = F(sp.skin); c.beginPath(); c.arc(9.5, 0, 2.6, 0, Math.PI * 2); c.fill();
    switch (sp.weapon) {
      case 'dagger':
        c.fillStyle = F('#78350f'); c.fillRect(8, -1, 4, 2);
        c.fillStyle = F('#e5e7eb'); c.beginPath(); c.moveTo(12, -1.6); c.quadraticCurveTo(20, -3, 24, 0); c.lineTo(12, 1.6); c.closePath(); c.fill();
        break;
      case 'scimitar':
        c.fillStyle = F('#facc15'); c.fillRect(11, -3, 2, 6);
        c.fillStyle = F('#e5e7eb'); c.beginPath(); c.moveTo(13, -2); c.quadraticCurveTo(26, -9, 31, 2); c.lineTo(13, 2); c.closePath(); c.fill();
        break;
      case 'sword':
        c.fillStyle = F('#4b5563'); c.fillRect(8, -1.2, 5, 2.4);
        c.fillStyle = F(sp.icicles ? '#bae6fd' : '#9ca3af'); c.fillRect(12, -4.5, 2.5, 9);
        c.fillStyle = F(sp.icicles ? '#e0f2fe' : '#cbd5e1');
        c.beginPath(); c.moveTo(14.5, -2); c.lineTo(38, -1.5); c.lineTo(42, 0); c.lineTo(38, 1.5); c.lineTo(14.5, 2); c.closePath(); c.fill();
        c.fillStyle = '#ffffff66'; c.fillRect(15, -1.3, 22, 0.7);
        break;
      case 'staff': {
        c.fillStyle = F('#4a2a12'); c.fillRect(-4, -1.6, 46, 3.2);
        const gl = sp.eye || '#a855f7';
        c.fillStyle = gl + '55'; c.beginPath(); c.arc(44, 0, 8 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = o.flash ? '#fff' : gl;
        c.beginPath(); c.moveTo(44, -5.5); c.lineTo(48, 0); c.lineTo(44, 5.5); c.lineTo(40, 0); c.closePath(); c.fill();
        break;
      }
      case 'bow': {
        const pull = o.atk > 0 ? atk * 6 : 0;
        c.strokeStyle = F('#7c3a0e'); c.lineWidth = 2.2;
        c.beginPath(); c.arc(12, 0, 13, -1.25, 1.25); c.stroke();
        c.strokeStyle = '#e5e7eb'; c.lineWidth = 0.7;
        c.beginPath(); c.moveTo(16, -12.3); c.lineTo(10 - pull, 0); c.lineTo(16, 12.3); c.stroke();
        if (o.atk > 0) { c.strokeStyle = F('#a16207'); c.lineWidth = 1.2; c.beginPath(); c.moveTo(10 - pull, 0); c.lineTo(28, 0); c.stroke(); }
        break;
      }
      case 'claw':
        c.strokeStyle = F('#f5e6c8'); c.lineWidth = 1.6;
        c.beginPath(); for (const k of [-2.5, 0, 2.5]) { c.moveTo(11, k); c.lineTo(17, k * 1.7); } c.stroke();
        break;
    }
    c.restore();
    c.restore();
  }

  function slime(c, x, y, size, o, sp) {
    const t = o.time || 0;
    const sq = 1 + Math.sin(t * 7 + o.seed) * 0.08 + (o.atk > 0 ? 0.22 * (1 - o.atk) : 0);
    const w = size * 0.65 * sq, h = size * 0.58 / sq;
    shadow(c, x, y, w);
    const col = o.flash ? '#ffffff' : sp.color;
    const g = c.createRadialGradient(x - w * 0.3, y - h * 1.3, 2, x, y - h * 0.6, w * 1.2);
    g.addColorStop(0, o.flash ? '#fff' : shade(col, 60)); g.addColorStop(0.6, col); g.addColorStop(1, o.flash ? '#fff' : shade(col, -50));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x - w, y);
    c.bezierCurveTo(x - w * 1.05, y - h * 1.3, x - w * 0.4, y - h * 2, x, y - h * 1.95);
    c.bezierCurveTo(x + w * 0.5, y - h * 2, x + w * 1.05, y - h * 1.3, x + w, y);
    // borde inferior ondulado (gotas)
    for (let i = 4; i >= 0; i--) { const px = x - w + i * w * 0.5; c.quadraticCurveTo(px + w * 0.25, y + 2.5 + Math.sin(t * 6 + i) * 1, px, y); }
    c.closePath(); c.fill();
    c.strokeStyle = shade(col, -60); c.lineWidth = 1; c.stroke();
    // burbujas internas
    c.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 3; i++) { const bp = (t * 0.6 + i / 3 + o.seed) % 1; c.beginPath(); c.arc(x - w * 0.3 + i * w * 0.3, y - bp * h * 1.5, 1.2 + i * 0.4, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.6)';
    c.beginPath(); c.ellipse(x - w * 0.38, y - h * 1.45, w * 0.16, h * 0.22, -0.5, 0, Math.PI * 2); c.fill();
    // cara
    const fx = x + o.face * w * 0.3, fy = y - h * 1.05;
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(fx - 4, fy, 3, 3.6, 0, 0, Math.PI * 2); c.ellipse(fx + 4, fy, 3, 3.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#052e16';
    c.beginPath(); c.arc(fx - 4 + o.face, fy + 0.5, 1.8, 0, Math.PI * 2); c.arc(fx + 4 + o.face, fy + 0.5, 1.8, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#052e16'; c.lineWidth = 1.2;
    c.beginPath(); c.arc(fx, fy + 4, o.atk > 0 ? 3 : 2, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  }

  function golem(c, x, y, size, o, sp) {
    const s = size / 46, t = o.time || 0;
    shadow(c, x, y, 20 * s);
    c.save(); c.translate(x, y); c.scale(o.face * s, s);
    const F = col => (o.flash ? '#ffffff' : col);
    const col = sp.color, dark = shade(col, -45), light = shade(col, 30);
    const bob = Math.sin(o.walk) * 1.5;
    const lift = o.atk > 0 ? -12 * (1 - o.atk) : 0;
    const rock = (px, py, w, h, cc) => {
      c.fillStyle = F(cc);
      c.beginPath(); c.moveTo(px + w * 0.15, py); c.lineTo(px + w * 0.85, py + h * 0.05); c.lineTo(px + w, py + h * 0.55);
      c.lineTo(px + w * 0.8, py + h); c.lineTo(px + w * 0.2, py + h * 0.95); c.lineTo(px, py + h * 0.45); c.closePath(); c.fill();
      c.strokeStyle = F(dark); c.lineWidth = 1; c.stroke();
    };
    // Piernas
    rock(-13, -15, 10, 15, dark); rock(3, -15, 10, 15, shade(col, -25));
    // Brazo trasero
    rock(-25, -42 + bob, 11, 24, shade(col, -30));
    // Torso de bloques
    rock(-18, -45 + bob, 36, 32, col);
    rock(-12, -40 + bob, 12, 12, light); rock(2, -33 + bob, 13, 13, shade(col, 10));
    // Núcleo brillante
    const pulse = 0.7 + Math.sin(t * 4 + o.seed) * 0.3;
    c.fillStyle = sp.glow; c.globalAlpha = pulse;
    c.beginPath(); c.arc(0, -29 + bob, 4, 0, Math.PI * 2); c.fill();
    c.globalAlpha = pulse * 0.4; c.beginPath(); c.arc(0, -29 + bob, 8, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    // Grietas que brillan
    c.strokeStyle = sp.glow; c.lineWidth = 1.2; c.globalAlpha = 0.75;
    c.beginPath(); c.moveTo(-10, -42 + bob); c.lineTo(-4, -34 + bob); c.lineTo(-8, -24 + bob); c.moveTo(8, -40 + bob); c.lineTo(12, -30 + bob); c.lineTo(9, -20 + bob); c.stroke();
    c.globalAlpha = 1;
    // Cabeza
    rock(-8, -57 + bob, 17, 14, light);
    c.fillStyle = o.flash ? '#fff' : sp.glow;
    c.fillRect(2, -52 + bob, 4, 2.6); c.fillRect(-4, -52 + bob, 4, 2.6);
    // Brazo delantero (se levanta para golpear)
    rock(13, -44 + bob + lift, 12, 26, shade(col, -10));
    rock(14, -21 + bob + lift, 13, 9, dark);
    if (sp.crystals) {
      for (const [px, h] of [[-13, 15], [-5, 22], [6, 17]]) {
        c.fillStyle = F('#e0f2fe');
        c.beginPath(); c.moveTo(px - 4, -44 + bob); c.lineTo(px, -44 - h + bob); c.lineTo(px + 4, -44 + bob); c.fill();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(px, -44 - h + bob); c.lineTo(px + 1.5, -44 + bob); c.lineTo(px, -44 + bob); c.fill();
      }
    } else if (sp.glow === '#fb923c') {
      // gotas de lava
      c.fillStyle = '#fb923c';
      const dp = (t * 0.8 + o.seed) % 1;
      c.globalAlpha = 1 - dp; c.beginPath(); c.arc(16, -20 + dp * 18, 1.6, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    }
    c.restore();
  }

  function flame(c, x, y, size, o, sp) {
    const t = (o.time || 0) * 10 + o.seed;
    const s = size / 32;
    shadow(c, x, y, 11 * s);
    c.save(); c.translate(x, y - 4 + Math.sin(t * 0.4) * 2); c.scale(s, s);
    const gl = c.createRadialGradient(0, -14, 2, 0, -14, 26);
    gl.addColorStop(0, 'rgba(251,146,60,.45)'); gl.addColorStop(1, 'rgba(251,146,60,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(0, -14, 26, 0, Math.PI * 2); c.fill();
    const layers = o.flash ? [['#fff', 1]] : [['#9a3412', 1.08], [sp.color, 1], ['#fbbf24', 0.72], ['#fef3c7', 0.42]];
    for (const [col, k] of layers) {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(-14 * k, 0);
      c.bezierCurveTo(-18 * k, -14 * k, -8 * k + Math.sin(t) * 2, -24 * k, Math.sin(t) * 4, -38 * k - Math.sin(t * 1.3) * 3);
      c.bezierCurveTo(4 * k, -28 * k, 9 * k + Math.sin(t * 1.7) * 2, -30 * k, 10 * k, -22 * k);
      c.bezierCurveTo(18 * k, -14 * k, 16 * k, -4 * k, 14 * k, 0);
      c.closePath(); c.fill();
    }
    // Cara
    c.fillStyle = '#1c1917';
    c.beginPath(); c.ellipse(-4 + o.face * 2, -13, 2.2, 3, 0.2, 0, Math.PI * 2); c.ellipse(4 + o.face * 2, -13, 2.2, 3, -0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-4 + o.face * 2, -7); c.quadraticCurveTo(o.face * 2, o.atk > 0 ? -2 : -5, 4 + o.face * 2, -7); c.closePath(); c.fill();
    // Chispas
    c.fillStyle = '#fde047';
    for (let i = 0; i < 3; i++) { const ph = ((o.time || 0) * 1.2 + i / 3) % 1; c.globalAlpha = 1 - ph; c.fillRect(Math.sin(i * 3 + t * 0.2) * 9, -36 - ph * 16, 1.6, 1.6); }
    c.globalAlpha = 1;
    c.restore();
  }

  /** Corona dorada con gemas (jefes). */
  function crown(c, x, y, w) {
    c.fillStyle = '#facc15';
    c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y - w * 0.45); c.lineTo(x - w / 4, y - w * 0.2); c.lineTo(x, y - w * 0.55);
    c.lineTo(x + w / 4, y - w * 0.2); c.lineTo(x + w / 2, y - w * 0.45); c.lineTo(x + w / 2, y); c.closePath(); c.fill();
    c.strokeStyle = '#a16207'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#ef4444'; c.beginPath(); c.arc(x, y - w * 0.12, w * 0.08, 0, Math.PI * 2); c.fill();
  }

  /* ---------- Lobo (cuadrúpedo) ---------- */
  function wolf(c, x, y, size, o, sp) {
    const s = size / 40;
    shadow(c, x, y, 19 * s);
    c.save(); c.translate(x, y); c.scale(o.face * s, s);
    const F = col => (o.flash ? '#ffffff' : col);
    const body = sp.color, dark = shade(body, -45), light = shade(body, 45);
    const run = o.walk, dash = o.dash ? 1 : 0;
    if (sp.aura) { c.fillStyle = sp.aura + '38'; c.beginPath(); c.ellipse(0, -18, 30, 18, 0, 0, Math.PI * 2); c.fill(); }
    const leg = (lx, ph, back) => {
      const a = Math.sin(run + ph) * (0.5 + dash * 0.4);
      c.save(); c.translate(lx, -14); c.rotate(a);
      c.fillStyle = F(back ? dark : shade(body, -20));
      rrect(c, -2.2, 0, 4.4, 14, 2); c.fill();
      c.fillStyle = F(dark); c.fillRect(-2.5, 12, 5.5, 2.5);
      c.restore();
    };
    leg(-11, Math.PI, true); leg(9, 0, true);
    // Cola
    c.strokeStyle = F(body); c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-15, -20); c.quadraticCurveTo(-26, -24 + Math.sin(run) * 3, -28, -15 + Math.sin(run * 0.5) * 2); c.stroke();
    // Cuerpo
    c.fillStyle = F(body);
    c.beginPath(); c.ellipse(-1, -20, 18 + dash * 3, 8.5, -0.05, 0, Math.PI * 2); c.fill();
    c.fillStyle = F(light);
    c.beginPath(); c.ellipse(8, -17, 8, 6.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = F(dark);
    c.beginPath(); c.ellipse(-4, -26, 12, 3, 0, 0, Math.PI * 2); c.fill();
    leg(-7, Math.PI * 0.6, false); leg(13, Math.PI * 1.6, false);
    // Cabeza
    const bite = o.atk > 0 ? 1 - o.atk : 0;
    c.save(); c.translate(17, -27 + Math.sin(run) * 0.8);
    c.fillStyle = F(body);
    c.beginPath(); c.ellipse(0, 0, 8, 6.5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(13, -1); c.lineTo(5, -4); c.lineTo(-6, -6); c.lineTo(-7, -14); c.lineTo(-2, -7); c.lineTo(1, -13); c.lineTo(4, -6); c.lineTo(13, -3); c.closePath(); c.fill();
    c.fillStyle = F(light);
    c.beginPath(); c.moveTo(4, -2); c.lineTo(13, -2); c.lineTo(12, 2); c.lineTo(4, 3); c.closePath(); c.fill();
    // Mandíbula (se abre al morder)
    c.save(); c.translate(5, 2.5); c.rotate(bite * 0.5);
    c.fillStyle = F(dark); c.beginPath(); c.moveTo(0, 0); c.lineTo(8, 0.5); c.lineTo(0, 3.5); c.closePath(); c.fill();
    if (bite) { c.fillStyle = '#fff'; c.fillRect(2, -0.8, 1, 1.4); c.fillRect(5, -0.6, 1, 1.2); }
    c.restore();
    c.fillStyle = '#111'; c.beginPath(); c.arc(13, -2.4, 1.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = o.flash ? '#fff' : (sp.eye || '#fde047');
    c.beginPath(); c.ellipse(3, -3, 1.8, 1.2, -0.2, 0, Math.PI * 2); c.fill();
    if (sp.crown) crown(c, -1, -9, 11);
    c.restore();
    c.restore();
  }

  /* ---------- Escorpión ---------- */
  function scorpion(c, x, y, size, o, sp) {
    const s = size / 40;
    shadow(c, x, y, 20 * s);
    c.save(); c.translate(x, y); c.scale(o.face * s, s);
    const F = col => (o.flash ? '#ffffff' : col);
    const body = sp.color, dark = shade(body, -45), light = shade(body, 35);
    const strike = o.atk > 0 ? 1 - o.atk : 0;
    // Patas
    c.strokeStyle = F(dark); c.lineWidth = 2; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const lx = -9 + i * 6, ph = Math.sin(o.walk + i * 1.3) * 2.5;
      c.beginPath(); c.moveTo(lx, -9); c.lineTo(lx - 4 + ph, -14); c.lineTo(lx - 7 + ph, 0); c.stroke();
    }
    // Cola segmentada que se curva sobre el cuerpo y golpea al atacar
    let px = -12, py = -10;
    for (let i = 0; i < 6; i++) {
      const t = (i + 1) / 6;
      const ang = Math.PI * (1.05 + t * (0.95 + strike * 0.45));
      const nx = -12 + Math.cos(ang) * 16 * t * 1.5 + strike * t * 14;
      const ny = -10 + Math.sin(ang) * 18 * t * 1.4 - t * 6;
      c.fillStyle = F(i % 2 ? body : light);
      c.beginPath(); c.arc(nx, ny, 4.2 - i * 0.35, 0, Math.PI * 2); c.fill();
      px = nx; py = ny;
    }
    c.fillStyle = F(sp.sting || '#84cc16');
    c.beginPath(); c.moveTo(px - 2, py); c.lineTo(px + 6 + strike * 3, py + 5); c.lineTo(px + 1, py + 3); c.closePath(); c.fill();
    // Cuerpo
    c.fillStyle = F(body);
    c.beginPath(); c.ellipse(0, -9, 15, 6.5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = F(dark); c.lineWidth = 1;
    for (const sx of [-6, -1, 4]) { c.beginPath(); c.moveTo(sx, -15); c.lineTo(sx + 1, -3); c.stroke(); }
    c.fillStyle = F(light);
    c.beginPath(); c.ellipse(14, -9, 6, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = o.flash ? '#fff' : '#111';
    c.beginPath(); c.arc(16, -11, 1.1, 0, Math.PI * 2); c.arc(18, -10, 1.1, 0, Math.PI * 2); c.fill();
    // Pinzas
    const open = 0.35 + Math.sin((o.time || 0) * 4 + o.seed) * 0.15 + strike * 0.4;
    for (const [dy, dx] of [[-3, 0], [3, -2]]) {
      c.strokeStyle = F(body); c.lineWidth = 3.2;
      c.beginPath(); c.moveTo(16, -9 + dy); c.lineTo(23 + dx + strike * 4, -13 + dy); c.stroke();
      c.save(); c.translate(26 + dx + strike * 4, -13 + dy);
      c.fillStyle = F(light);
      c.beginPath(); c.ellipse(0, 0, 4, 3, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = F(dark); c.lineWidth = 2;
      c.beginPath(); c.moveTo(2, -1); c.lineTo(7, -1 - open * 6); c.moveTo(2, 1); c.lineTo(7, 1 + open * 3); c.stroke();
      c.restore();
    }
    if (sp.crown) crown(c, 13, -15, 11);
    c.restore();
  }

  /* ---------- Criatura maldita (espectro) ---------- */
  function ghost(c, x, y, size, o, sp) {
    const s = size / 38, t = (o.time || 0) * 3 + o.seed;
    shadow(c, x, y, 12 * s);
    c.save(); c.translate(x, y - 10 * s + Math.sin(t) * 3 * s); c.scale(o.face * s, s);
    c.fillStyle = sp.color + '33';
    c.beginPath(); c.ellipse(0, -18, 20, 24, 0, 0, Math.PI * 2); c.fill();
    const g = c.createLinearGradient(0, -38, 0, 4);
    g.addColorStop(0, o.flash ? '#ffffff' : shade(sp.color, 40)); g.addColorStop(1, sp.color + '00');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-11, -26); c.arc(0, -26, 11, Math.PI, 0);
    for (let i = 0; i <= 6; i++) { const k = i / 6; c.lineTo(11 - k * 22 + Math.sin(t * 2 + i) * 2, -10 + k * 2 + (i % 2 ? 6 : 0) + Math.sin(t + i) * 2); }
    c.closePath(); c.fill();
    // Brazos que se estiran al atacar
    const reach = o.atk > 0 ? (1 - o.atk) * 8 : 0;
    c.strokeStyle = o.flash ? '#fff' : shade(sp.color, 20); c.lineWidth = 2.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(6, -22); c.quadraticCurveTo(14, -24, 16 + reach, -18); c.moveTo(-2, -20); c.quadraticCurveTo(6, -14, 12 + reach * 0.7, -12); c.stroke();
    c.fillStyle = o.flash ? '#fff' : (sp.eye || '#f0abfc');
    c.shadowColor = sp.eye || '#f0abfc'; c.shadowBlur = 8;
    c.beginPath(); c.ellipse(3, -29, 2.6, 1.3, -0.3, 0, Math.PI * 2); c.ellipse(8, -28.5, 2.2, 1.1, 0.2, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#0b0412'; c.beginPath(); c.ellipse(5, -23, 3, 1.6 + Math.sin(t * 2) * 0.6, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  /* ---------- Dragón volcánico ---------- */
  function dragon(c, x, y, size, o, sp) {
    const s = size / 100, t = (o.time || 0);
    shadow(c, x, y, 52 * s);
    c.save(); c.translate(x, y); c.scale(o.face * s, s);
    const F = col => (o.flash ? '#ffffff' : col);
    const body = sp.color, dark = shade(body, -55), light = shade(body, 30), belly = sp.belly || '#fbbf24';
    const breath = o.atk > 0 ? 1 - o.atk : (o.breath ? 1 : 0);
    const flap = Math.sin(t * 4 + o.seed);
    const wing = (dx, dy, sc, col) => {
      c.save(); c.translate(dx, dy); c.scale(1, sc);
      c.fillStyle = F(col);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-30, -48); c.lineTo(-8, -40); c.lineTo(-14, -60); c.lineTo(8, -44); c.lineTo(12, -62); c.lineTo(22, -38); c.lineTo(20, -6); c.closePath(); c.fill();
      c.strokeStyle = F(dark); c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-30, -48); c.moveTo(0, 0); c.lineTo(-14, -60); c.moveTo(0, 0); c.lineTo(12, -62); c.stroke();
      c.restore();
    };
    wing(-8, -52, 0.8 + flap * 0.25, dark);
    // Cola
    c.fillStyle = F(body);
    c.beginPath(); c.moveTo(-28, -40); c.quadraticCurveTo(-58, -30 + Math.sin(t * 2) * 6, -82, -12); c.lineTo(-84, -6); c.quadraticCurveTo(-56, -20, -26, -24); c.closePath(); c.fill();
    c.fillStyle = F(light);
    c.beginPath(); c.moveTo(-86, -9); c.lineTo(-96, -16); c.lineTo(-90, -2); c.closePath(); c.fill();
    c.fillStyle = F(dark);
    rrect(c, -26, -30, 14, 30, 5); c.fill();
    // Cuerpo
    const bg = c.createLinearGradient(0, -62, 0, -18);
    bg.addColorStop(0, F(light)); bg.addColorStop(1, F(body));
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(-4, -40, 34, 21, -0.08, 0, Math.PI * 2); c.fill();
    c.fillStyle = F(belly);
    c.beginPath(); c.ellipse(2, -30, 24, 9, -0.05, 0, Math.PI * 2); c.fill();
    c.strokeStyle = F(shade(belly, -40)); c.lineWidth = 1;
    for (let i = -16; i < 22; i += 6) { c.beginPath(); c.moveTo(i, -37); c.lineTo(i + 1, -23); c.stroke(); }
    c.fillStyle = F(dark);
    for (let i = -28; i < 18; i += 8) { c.beginPath(); c.moveTo(i, -58 + Math.abs(i) * 0.12); c.lineTo(i + 4, -68 + Math.abs(i) * 0.12); c.lineTo(i + 8, -57 + Math.abs(i) * 0.12); c.fill(); }
    c.fillStyle = F(body);
    rrect(c, 12, -30, 12, 30, 5); c.fill();
    c.fillStyle = F('#f5e6c8');
    for (const cx of [14, 18, 22]) { c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx + 3, 3); c.lineTo(cx + 3, -1); c.fill(); }
    // Cuello y cabeza
    c.fillStyle = F(body);
    c.beginPath(); c.moveTo(14, -54); c.quadraticCurveTo(30, -76, 40, -84); c.lineTo(50, -74); c.quadraticCurveTo(36, -60, 26, -38); c.closePath(); c.fill();
    c.save(); c.translate(48, -82);
    c.fillStyle = F(body);
    c.beginPath(); c.moveTo(-8, -8); c.lineTo(12, -8); c.lineTo(26, -2); c.lineTo(26, 3); c.lineTo(4, 4); c.lineTo(-8, 6); c.closePath(); c.fill();
    c.fillStyle = F('#f5e6c8');
    c.beginPath(); c.moveTo(-6, -8); c.quadraticCurveTo(-16, -18, -22, -14); c.quadraticCurveTo(-12, -13, -2, -6); c.fill();
    c.save(); c.translate(2, 4); c.rotate(breath * 0.45);
    c.fillStyle = F(dark); c.beginPath(); c.moveTo(0, 0); c.lineTo(22, 0); c.lineTo(18, 5); c.lineTo(0, 5); c.closePath(); c.fill();
    c.fillStyle = '#fff'; for (const tx of [6, 11, 16]) { c.beginPath(); c.moveTo(tx, 0); c.lineTo(tx + 1.5, -2.5); c.lineTo(tx + 3, 0); c.fill(); }
    c.restore();
    if (breath) {
      c.fillStyle = 'rgba(251,146,60,.85)';
      c.beginPath(); c.arc(26, 4, 6 + Math.random() * 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(254,240,138,.9)'; c.beginPath(); c.arc(26, 4, 3, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = o.flash ? '#fff' : '#fde047';
    c.shadowColor = '#f97316'; c.shadowBlur = 10;
    c.beginPath(); c.ellipse(9, -3.5, 3, 1.6, -0.2, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#111'; c.fillRect(9, -4.5, 1, 2.5);
    c.restore();
    wing(-2, -50, 0.9 - flap * 0.3, light);
    c.restore();
  }

  const SHAPES = { slime, golem, flame, wolf, scorpion, ghost, dragon, humanoid };

  /** Dibuja cualquier enemigo según la definición de su sprite. */
  function enemy(c, e, time) {
    const sp = e.def.sprite;
    const z = e.z || 0;
    if (e.walk !== e.artWalk) { e.artWalk = e.walk; e.artMoveT = time; }
    const o = { face: e.face, walk: e.walk, flash: e.flash > 0, atk: e.windup > 0 ? e.windup / e.windupMax : 0,
                moving: time - (e.artMoveT === undefined ? -9 : e.artMoveT) < 0.15,
                recover: e.recover, time, seed: e.seed, dash: e.state === 'dash', breath: e.breath };
    if (e.elite) {
      c.fillStyle = `rgba(250,204,21,${0.22 + Math.sin(time * 6) * 0.08})`;
      c.beginPath(); c.ellipse(e.x, e.y, e.size * 0.6, e.size * 0.2, 0, 0, Math.PI * 2); c.fill();
    }
    if (z) { shadow(c, e.x, e.y, e.size * 0.4); skipShadow = true; }
    if (e.frozen > 0) c.globalAlpha = 0.85;
    if (!(sp.art && artOn() && enemyArt(c, e.x, e.y - z, e.size, o, sp))) (SHAPES[sp.shape] || humanoid)(c, e.x, e.y - z, e.size, o, sp);
    skipShadow = false;
    c.globalAlpha = 1;
    if (sp.crown && sp.shape === 'golem') crown(c, e.x, e.y - z - e.size * 1.2, e.size * 0.24);
    if (e.elite) {
      c.strokeStyle = 'rgba(250,204,21,.85)'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(e.x, e.y, e.size * 0.6, e.size * 0.2, 0, 0, Math.PI * 2); c.stroke();
    }
    if (e.slowT > 0) {
      c.strokeStyle = 'rgba(186,230,253,.8)'; c.lineWidth = 2; c.setLineDash([4, 3]);
      c.beginPath(); c.ellipse(e.x, e.y, e.size * 0.5, e.size * 0.17, 0, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
    }
    if (e.frozen > 0) {
      c.fillStyle = 'rgba(147,197,253,.45)';
      rrect(c, e.x - e.size * 0.45, e.y - z - e.size * 1.05, e.size * 0.9, e.size, 6); c.fill();
      c.strokeStyle = 'rgba(224,242,254,.9)'; c.lineWidth = 1.5; c.stroke();
    }
  }

  /* ---------- Botín y objetos del escenario ---------- */
  function coin(c, x, y, t) {
    const w = Math.abs(Math.cos(t * 6)) * 4.5 + 0.8;
    c.fillStyle = '#a16207'; c.beginPath(); c.ellipse(x, y, w + 0.8, 5.3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#facc15'; c.beginPath(); c.ellipse(x, y, w, 4.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fef9c3'; c.fillRect(x - w * 0.3, y - 3, Math.max(0.6, w * 0.3), 2);
  }
  function gem(c, x, y, color, t) {
    c.fillStyle = color + '44'; c.beginPath(); c.arc(x, y, 8 + Math.sin(t * 8) * 1.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = color;
    c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 4.5, y - 1); c.lineTo(x, y + 6); c.lineTo(x - 4.5, y - 1); c.closePath(); c.fill();
    c.fillStyle = '#ffffffaa'; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 2, y - 1); c.lineTo(x - 1.5, y - 1); c.closePath(); c.fill();
  }
  function heart(c, x, y, t) {
    const k = 1 + Math.sin(t * 7) * 0.1;
    c.fillStyle = '#ef444455'; c.beginPath(); c.arc(x, y, 9 * k, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(x, y); c.scale(k, k);
    c.fillStyle = '#ef4444';
    c.beginPath(); c.moveTo(0, 5); c.bezierCurveTo(-7, 0, -5, -6, 0, -3); c.bezierCurveTo(5, -6, 7, 0, 0, 5); c.fill();
    c.fillStyle = '#ffffff88'; c.beginPath(); c.arc(-2.2, -2.2, 1.3, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  /** Cajas, vasijas y barriles que se pueden romper. */
  function prop(c, p, t) {
    shadow(c, p.x, p.y, 12);
    const F = col => (p.flash > 0 ? '#ffffff' : col);
    const col = p.color || '#a16207';
    c.save(); c.translate(p.x + (p.flash > 0 ? Math.sin(t * 80) * 1.5 : 0), p.y);
    if (p.kind === 'pot') {
      c.fillStyle = F(col);
      c.beginPath(); c.moveTo(-5, -22); c.lineTo(5, -22); c.lineTo(6, -19); c.quadraticCurveTo(13, -12, 8, -1); c.lineTo(-8, -1); c.quadraticCurveTo(-13, -12, -6, -19); c.closePath(); c.fill();
      c.strokeStyle = F(shade(col, -50)); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-9, -12); c.lineTo(9, -12); c.stroke();
    } else if (p.kind === 'barrel') {
      c.fillStyle = F(col); rrect(c, -9, -22, 18, 22, 5); c.fill();
      c.fillStyle = F('#1c1917'); c.fillRect(-9, -18, 18, 2); c.fillRect(-9, -5, 18, 2);
      c.fillStyle = F('#f97316'); c.fillRect(-2, -14, 4, 6);
    } else {
      c.fillStyle = F(col); c.fillRect(-10, -20, 20, 20);
      c.strokeStyle = F(shade(col, -50)); c.lineWidth = 1.5;
      c.strokeRect(-10, -20, 20, 20);
      c.beginPath(); c.moveTo(-10, -20); c.lineTo(10, 0); c.moveTo(10, -20); c.lineTo(-10, 0); c.stroke();
    }
    c.restore();
  }

  /* ---------- Escenarios ---------- */
  const THEMES = {
    bosque:   { sky: ['#4aa3df', '#bfe6c8'], far: '#2f6b46', mid: '#1f5136', ground: '#4d7c32', dirt: '#6b4423', particle: 'leaf' },
    desierto: { sky: ['#f59e0b', '#fde68a'], far: '#e3a857', mid: '#c98a3d', ground: '#e8c27a', dirt: '#b7843f', particle: 'sand' },
    hielo:    { sky: ['#1e3a8a', '#a5d8ff'], far: '#c7dcf2', mid: '#8fb3d9', ground: '#eef6ff', dirt: '#9fbfe0', particle: 'snow' },
    volcan:   { sky: ['#1a0606', '#8a1c0c'], far: '#2b0f0b', mid: '#1c0a07', ground: '#2a1a17', dirt: '#120807', particle: 'ember' },
    oscuro:   { sky: ['#07030f', '#3b0764'], far: '#1e1033', mid: '#12081f', ground: '#271a3a', dirt: '#140b20', particle: 'mote' },
  };

  function background(theme, W, H, G, dpr) {
    const T = THEMES[theme] || THEMES.bosque;
    const cv = document.createElement('canvas');
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    const g = c.createLinearGradient(0, 0, 0, G);
    g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // El paisaje está diseñado para un horizonte a ~260 px; se escala al real
    const sq = Math.min(1, G / 260);
    c.save(); c.translate(0, G); c.scale(1, sq); c.translate(0, -G);

    if (theme === 'bosque') {
      c.fillStyle = '#fff8'; for (let i = 0; i < 4; i++) cloud(c, 40 + i * 130 + rnd() * 30, 40 + rnd() * 40, 0.8 + rnd() * 0.5);
      hills(c, W, G - 70, 40, T.far, rnd);
      for (let x = -10; x < W + 20; x += 22 + rnd() * 16) pine(c, x, G - 30 - rnd() * 20, 34 + rnd() * 30, T.mid);
    } else if (theme === 'desierto') {
      c.fillStyle = '#fff7d1'; c.beginPath(); c.arc(W * 0.78, 62, 26, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fde68a55'; c.beginPath(); c.arc(W * 0.78, 62, 42, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c7894a';
      [[90, 70], [150, 50], [330, 60]].forEach(([px, h]) => { c.beginPath(); c.moveTo(px - h, G - 36); c.lineTo(px, G - 36 - h); c.lineTo(px + h, G - 36); c.fill(); });
      hills(c, W, G - 40, 26, T.far, rnd);
      hills(c, W, G - 18, 16, T.mid, rnd);
      for (let i = 0; i < 4; i++) cactus(c, 30 + rnd() * (W - 60), G - 4, '#3f7d3a');
    } else if (theme === 'hielo') {
      c.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { c.globalAlpha = rnd() * 0.8; c.fillRect(rnd() * W, rnd() * G * 0.6, 1.5, 1.5); }
      c.globalAlpha = 1;
      mountains(c, W, G - 20, 150, T.far, '#ffffff', rnd);
      mountains(c, W, G - 6, 90, T.mid, '#eaf4ff', rnd);
    } else if (theme === 'volcan') {
      mountains(c, W, G - 10, 170, T.far, null, rnd);
      // Volcán con lava
      c.fillStyle = '#2d0f0a';
      c.beginPath(); c.moveTo(W * 0.35, G); c.lineTo(W * 0.55, G - 170); c.lineTo(W * 0.63, G - 170); c.lineTo(W * 0.85, G); c.fill();
      const lg = c.createLinearGradient(0, G - 175, 0, G - 60);
      lg.addColorStop(0, '#fde047'); lg.addColorStop(1, '#dc262600');
      c.fillStyle = lg;
      c.beginPath(); c.moveTo(W * 0.55, G - 170); c.lineTo(W * 0.63, G - 170); c.lineTo(W * 0.66, G - 60); c.lineTo(W * 0.52, G - 60); c.fill();
      c.fillStyle = '#f9731633'; c.beginPath(); c.arc(W * 0.59, G - 180, 40, 0, Math.PI * 2); c.fill();
      hills(c, W, G - 12, 18, T.mid, rnd);
    } else if (theme === 'oscuro') {
      c.fillStyle = '#e9d5ff'; c.beginPath(); c.arc(W * 0.2, 60, 22, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c084fc33'; c.beginPath(); c.arc(W * 0.2, 60, 40, 0, Math.PI * 2); c.fill();
      castle(c, W * 0.62, G - 20, T.far);
      hills(c, W, G - 14, 20, T.mid, rnd);
      for (let i = 0; i < 4; i++) deadTree(c, 20 + rnd() * (W - 40), G - 2, '#0a0510');
    }
    c.restore();
    // Suelo jugable (vista 3/4): más oscuro al fondo, más claro cerca
    const gg = c.createLinearGradient(0, G, 0, H);
    gg.addColorStop(0, shade(T.ground, -45)); gg.addColorStop(0.25, shade(T.ground, -15)); gg.addColorStop(1, T.ground);
    c.fillStyle = gg; c.fillRect(0, G, W, H - G);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, G, W, 3);
    for (let i = 0; i < 70; i++) {
      const px = rnd() * W, py = G + 6 + rnd() * (H - G - 6), d = (py - G) / (H - G);
      c.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.07})`;
      c.beginPath(); c.ellipse(px, py, (6 + rnd() * 14) * (0.5 + d), (2 + rnd() * 3) * (0.5 + d), 0, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 28; i++) {
      const px = rnd() * W, py = G + 10 + rnd() * (H - G - 12), d = 0.6 + (py - G) / (H - G) * 0.6;
      if (theme === 'bosque') {
        c.fillStyle = rnd() < 0.5 ? '#65a30d' : '#3f6212';
        for (let j = -2; j <= 2; j++) c.fillRect(px + j * 2 * d, py - (4 + rnd() * 4) * d, 1.4 * d, (4 + rnd() * 4) * d);
        if (rnd() < 0.3) { c.fillStyle = ['#fde047', '#f472b6', '#ffffff'][Math.floor(rnd() * 3)]; c.beginPath(); c.arc(px, py - 7 * d, 1.6 * d, 0, 7); c.fill(); }
      } else if (theme === 'desierto') {
        c.strokeStyle = 'rgba(120,72,20,.28)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(px - 12 * d, py); c.quadraticCurveTo(px, py - 3 * d, px + 12 * d, py); c.stroke();
      } else if (theme === 'hielo') {
        c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(px, py, 10 * d, 3 * d, 0, 0, 7); c.fill();
        c.fillStyle = 'rgba(96,165,250,.3)'; c.fillRect(px - 4 * d, py + 1, 8 * d, 1);
      } else if (theme === 'volcan') {
        c.strokeStyle = rnd() < 0.5 ? '#f97316' : '#dc2626'; c.lineWidth = 1.4 * d;
        c.beginPath(); c.moveTo(px, py); c.lineTo(px + 7 * d, py + 3 * d); c.lineTo(px + 4 * d, py + 8 * d); c.stroke();
      } else {
        c.fillStyle = 'rgba(168,85,247,.16)'; c.fillRect(px - 9 * d, py - 4 * d, 18 * d, 8 * d);
        c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1; c.strokeRect(px - 9 * d, py - 4 * d, 18 * d, 8 * d);
      }
    }
    // Viñeta en los bordes
    const vg = c.createRadialGradient(W / 2, (G + H) / 2, Math.min(W, H) * 0.35, W / 2, (G + H) / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    return cv;
  }

  function cloud(c, x, y, s) { c.beginPath(); c.arc(x, y, 14 * s, 0, 7); c.arc(x + 16 * s, y - 6 * s, 16 * s, 0, 7); c.arc(x + 32 * s, y, 13 * s, 0, 7); c.fill(); }
  function hills(c, W, base, amp, col, rnd) {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, base + 80);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, base - Math.sin(x * 0.02 + rnd()) * amp * 0.5 - amp * 0.5);
    c.lineTo(W, base + 80); c.fill();
  }
  function mountains(c, W, base, h, col, snow, rnd) {
    let x = -40;
    while (x < W + 40) {
      const w = 70 + rnd() * 90, hh = h * (0.6 + rnd() * 0.4);
      c.fillStyle = col; c.beginPath(); c.moveTo(x, base); c.lineTo(x + w / 2, base - hh); c.lineTo(x + w, base); c.fill();
      if (snow) { c.fillStyle = snow; c.beginPath(); c.moveTo(x + w / 2 - w * 0.13, base - hh * 0.74); c.lineTo(x + w / 2, base - hh); c.lineTo(x + w / 2 + w * 0.13, base - hh * 0.74); c.lineTo(x + w / 2, base - hh * 0.8); c.fill(); }
      x += w * 0.6;
    }
  }
  function pine(c, x, base, h, col) {
    c.fillStyle = col;
    for (let i = 0; i < 3; i++) { const y = base - i * h * 0.28, w = h * (0.38 - i * 0.08); c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y - h * 0.5); c.lineTo(x + w, y); c.fill(); }
    c.fillRect(x - 2, base, 4, 30);
  }
  function cactus(c, x, base, col) {
    c.fillStyle = col; c.fillRect(x - 3, base - 26, 6, 26); c.fillRect(x - 10, base - 18, 4, 9); c.fillRect(x - 10, base - 12, 8, 3); c.fillRect(x + 6, base - 22, 4, 10); c.fillRect(x + 2, base - 15, 8, 3);
  }
  function castle(c, x, base, col) {
    c.fillStyle = col;
    c.fillRect(x - 60, base - 70, 120, 70);
    for (const [tx, th] of [[-70, 120], [55, 110], [-10, 150]]) {
      c.fillRect(x + tx, base - th, 22, th);
      c.beginPath(); c.moveTo(x + tx - 4, base - th); c.lineTo(x + tx + 11, base - th - 26); c.lineTo(x + tx + 26, base - th); c.fill();
    }
    c.fillStyle = '#facc15aa';
    [[-62, 90], [62, 80], [-3, 120], [-30, 40], [20, 45]].forEach(([wx, wy]) => c.fillRect(x + wx, base - wy, 4, 6));
  }
  function deadTree(c, x, base, col) {
    c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, base); c.lineTo(x, base - 36); c.moveTo(x, base - 22); c.lineTo(x - 12, base - 34); c.moveTo(x, base - 30); c.lineTo(x + 11, base - 42); c.stroke();
  }

  return { loadArt, artFit, ART, knight, trailPart, drawPart, phoenix, auraPart, enemy, background, coin, gem, heart, prop, crown, THEMES, rrect, shade };
})();
