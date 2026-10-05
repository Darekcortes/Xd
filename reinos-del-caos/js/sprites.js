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
  function shadow(c, x, y, w) {
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

  function knight(c, x, y, s, o) {
    const t = o.time || 0;
    const idle = !o.walk && o.swing < 0;
    const bob = idle ? Math.sin(t * 2.2) * 0.6 : Math.abs(Math.sin(o.walk)) * -1;
    // Al recibir daño todo se tiñe de rojo
    const F = col => (o.flash ? mix(col, '#ff3b3b', 0.6) : col);
    const steelBase = o.armorColor ? mix(KP.steel, o.armorColor, 0.18) : KP.steel;
    const steel = F(steelBase), steelD = F(mix(steelBase, '#000000', 0.5)), steelL = F(mix(steelBase, '#ffffff', 0.38));
    const gold = F(KP.gold);
    const legA = Math.sin(o.walk) * 0.55;

    shadow(c, x, y, 17 * s);
    c.save();
    c.translate(x, y);
    c.scale(o.face * s, s);

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
    // Cruz dorada de la capa
    c.strokeStyle = gold; c.lineWidth = 0.9;
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
    // Brazo trasero
    c.save(); c.translate(-3, -37); c.rotate(0.25 - legA * 0.4);
    c.fillStyle = steelD; rrect(c, -2.4, 0, 4.8, 12, 2); c.fill();
    c.fillStyle = F(KP.leatherD); rrect(c, -2.6, 11, 5.2, 4.5, 1.5); c.fill();
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
    // Emblema dorado del peto
    c.fillStyle = gold;
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
      c.fillStyle = '#1a120c'; c.fillRect(4, -48.8, 1.5, 1.1);
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
    let ang;
    if (o.swing >= 0) ang = -2.4 + (1 - Math.pow(1 - o.swing, 3)) * 3.9;
    else ang = 0.8 + (idle ? Math.sin(t * 2.2) * 0.03 : Math.sin(o.walk) * 0.08);
    c.save();
    c.translate(3, -36);
    if (o.swing >= 0) {
      // Estela azul del corte
      c.save();
      c.shadowColor = '#60a5fa'; c.shadowBlur = o.heavy ? 14 : 8;
      c.strokeStyle = o.heavy ? 'rgba(125,211,252,.9)' : 'rgba(147,197,253,.7)';
      c.lineWidth = o.heavy ? 9 : 5;
      c.beginPath(); c.arc(0, 0, 42, -2.4, ang, false); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = o.heavy ? 3 : 1.6;
      c.beginPath(); c.arc(0, 0, 44, Math.max(-2.4, ang - 1.2), ang, false); c.stroke();
      c.restore();
    }
    c.rotate(ang);
    c.fillStyle = steel; rrect(c, -1.8, -2.8, 11, 5.6, 2.2); c.fill();
    c.fillStyle = gold; c.beginPath(); c.arc(5, 0, 1.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = steelD; rrect(c, 9.5, -3.2, 5.5, 6.4, 1.8); c.fill();
    // Espada: pomo con gema, empuñadura, guarda dorada y hoja larga
    c.fillStyle = gold; c.beginPath(); c.arc(8.4, 0, 2.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = F(KP.gem); c.beginPath(); c.arc(8.4, 0, 1.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = F(KP.leather); c.fillRect(14.5, -1.3, 3.5, 2.6);
    c.fillStyle = gold;
    c.beginPath(); c.moveTo(18, -6.5); c.lineTo(19.8, -5.5); c.lineTo(19.8, 5.5); c.lineTo(18, 6.5); c.lineTo(17.4, 0); c.closePath(); c.fill();
    c.fillRect(19.8, -1.2, 2.2, 2.4);
    const blade = F(o.weaponColor || '#d6dbe4');
    c.fillStyle = blade;
    c.beginPath(); c.moveTo(21.5, -1.9); c.lineTo(50, -1.4); c.lineTo(54, 0); c.lineTo(50, 1.4); c.lineTo(21.5, 1.9); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(22, -1.5, 27, 0.7);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(22, 0.2, 25, 0.6);
    c.fillStyle = gold; c.fillRect(22, -0.3, 9, 0.6);
    c.restore();

    c.restore();
    c.restore();
  }

  /* ---------- Humanoide genérico (bandidos, momias, caballeros, magos) ---------- */
  function humanoid(c, x, y, size, o, sp) {
    const s = size / 44;
    shadow(c, x, y, 15 * s);
    c.save();
    c.translate(x, y);
    c.scale(o.face * s, s);
    const F = col => (o.flash ? '#ffffff' : col);
    const legA = Math.sin(o.walk) * 0.45;
    if (sp.aura) {
      c.fillStyle = sp.aura + '44';
      c.beginPath(); c.ellipse(0, -24, 24, 30, 0, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = F(shade(sp.body, -40));
    c.save(); c.translate(-4, -16); c.rotate(legA); c.fillRect(-3, 0, 6, 16); c.restore();
    c.save(); c.translate(4, -16); c.rotate(-legA); c.fillRect(-3, 0, 6, 16); c.restore();
    // Túnica / cuerpo
    c.fillStyle = F(sp.body);
    if (sp.head === 'wizard') {
      c.beginPath(); c.moveTo(-9, -33); c.lineTo(9, -33); c.lineTo(13, -4); c.lineTo(-13, -4); c.closePath(); c.fill();
    } else { rrect(c, -9, -33, 18, 19, 4); c.fill(); }
    if (sp.head === 'wrap') {
      c.strokeStyle = F('#a8a08a'); c.lineWidth = 1;
      for (let i = -30; i < -14; i += 4) { c.beginPath(); c.moveTo(-9, i); c.lineTo(9, i + 2); c.stroke(); }
    }
    // Cabeza
    c.fillStyle = F(sp.skin);
    c.beginPath(); c.arc(0, -39, 7.5, 0, Math.PI * 2); c.fill();
    const eye = sp.eye || '#111827';
    if (sp.head === 'hood' || sp.head === 'turban') {
      c.fillStyle = F(sp.hood);
      c.beginPath(); c.arc(0, -40, 9, Math.PI * 0.95, Math.PI * 2.05); c.fill();
      if (sp.head === 'hood') { c.fillStyle = F('#111827'); c.fillRect(0, -39, 9, 4); }
    } else if (sp.head === 'helmet' || sp.head === 'crown') {
      c.fillStyle = F(shade(sp.body, 30));
      c.beginPath(); c.arc(0, -40, 9, Math.PI, Math.PI * 2); c.fill();
      c.fillRect(-9, -40, 18, 6);
      c.fillStyle = F('#000000'); c.fillRect(0, -38, 9, 2);
      if (sp.head === 'crown') {
        c.fillStyle = F('#a855f7');
        c.beginPath(); c.moveTo(-8, -48); c.lineTo(-6, -55); c.lineTo(-2, -49); c.lineTo(1, -57); c.lineTo(4, -49); c.lineTo(8, -55); c.lineTo(9, -48); c.closePath(); c.fill();
      }
    } else if (sp.head === 'wizard') {
      c.fillStyle = F(sp.hood);
      c.beginPath(); c.moveTo(-11, -42); c.lineTo(11, -42); c.lineTo(-2, -66); c.closePath(); c.fill();
    } else if (sp.head === 'wrap') {
      c.strokeStyle = F('#a8a08a'); c.lineWidth = 1;
      c.beginPath(); c.moveTo(-7, -42); c.lineTo(7, -40); c.moveTo(-7, -37); c.lineTo(7, -35); c.stroke();
    }
    c.fillStyle = o.flash ? '#fff' : eye;
    c.fillRect(3, -40, 2.5, 2.5);
    if (sp.eye) { c.fillStyle = eye + '66'; c.beginPath(); c.arc(4, -39, 4, 0, Math.PI * 2); c.fill(); }
    // Arma
    c.save();
    c.translate(5, -27);
    const a = o.atk > 0 ? -1.6 + (1 - o.atk) * 0.4 : (o.recover > 0 ? 1.1 : 0.4);
    c.rotate(a);
    c.fillStyle = F(sp.skin); c.fillRect(-2, -2.5, 9, 5);
    switch (sp.weapon) {
      case 'dagger': c.fillStyle = F('#d4d4d8'); c.fillRect(8, -1.5, 13, 3); break;
      case 'scimitar': c.fillStyle = F('#e5e7eb'); c.beginPath(); c.moveTo(8, -2); c.quadraticCurveTo(22, -8, 28, 2); c.lineTo(8, 2); c.fill(); break;
      case 'sword': c.fillStyle = F('#94a3b8'); c.fillRect(8, -2, 26, 4); c.fillStyle = F('#facc15'); c.fillRect(7, -5, 3, 10); break;
      case 'staff':
        c.fillStyle = F('#78350f'); c.fillRect(6, -1.5, 30, 3);
        c.fillStyle = o.flash ? '#fff' : (sp.eye || '#a855f7');
        c.beginPath(); c.arc(38, 0, 4.5, 0, Math.PI * 2); c.fill();
        break;
      case 'bow':
        c.strokeStyle = F('#92400e'); c.lineWidth = 2;
        c.beginPath(); c.arc(10, 0, 12, -1.3, 1.3); c.stroke();
        c.strokeStyle = '#e5e7eb'; c.lineWidth = 0.7;
        c.beginPath(); c.moveTo(13, -11.5); c.lineTo(13, 11.5); c.stroke();
        break;
    }
    c.restore();
    c.restore();
  }

  function slime(c, x, y, size, o, sp) {
    const sq = 1 + Math.sin(o.time * 7 + o.seed) * 0.08 + (o.atk > 0 ? 0.2 * (1 - o.atk) : 0);
    const w = size * 0.65 * sq, h = size * 0.55 / sq;
    shadow(c, x, y, w);
    c.fillStyle = o.flash ? '#fff' : sp.color;
    c.beginPath(); c.ellipse(x, y - h, w, h, 0, Math.PI, 0); c.lineTo(x + w, y); c.lineTo(x - w, y); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)';
    c.beginPath(); c.ellipse(x - w * 0.35, y - h * 1.35, w * 0.18, h * 0.22, -0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#052e16';
    c.beginPath(); c.arc(x + o.face * w * 0.2, y - h * 0.9, 2.6, 0, Math.PI * 2); c.arc(x + o.face * w * 0.5, y - h * 0.9, 2.6, 0, Math.PI * 2); c.fill();
  }

  function golem(c, x, y, size, o, sp) {
    const s = size / 46;
    shadow(c, x, y, 20 * s);
    c.save(); c.translate(x, y); c.scale(o.face * s, s);
    const F = col => (o.flash ? '#ffffff' : col);
    const bob = Math.sin(o.walk) * 1.5;
    const lift = o.atk > 0 ? -10 * (1 - o.atk) : 0;
    c.fillStyle = F(shade(sp.color, -30));
    c.fillRect(-12, -14, 9, 14); c.fillRect(3, -14, 9, 14);
    c.fillStyle = F(sp.color);
    rrect(c, -17, -42 + bob, 34, 30, 6); c.fill();
    c.fillStyle = F(shade(sp.color, 20));
    rrect(c, -9, -54 + bob, 18, 14, 4); c.fill();
    c.fillStyle = F(shade(sp.color, -15));
    rrect(c, 13, -40 + bob + lift, 10, 24, 4); c.fill();
    rrect(c, -23, -40 + bob, 10, 22, 4); c.fill();
    c.fillStyle = o.flash ? '#fff' : sp.glow;
    c.fillRect(1, -50 + bob, 4, 3); c.fillRect(-6, -50 + bob, 4, 3);
    c.strokeStyle = sp.glow; c.lineWidth = 1.5; c.globalAlpha = 0.7;
    c.beginPath(); c.moveTo(-8, -36 + bob); c.lineTo(-2, -28 + bob); c.lineTo(-6, -20 + bob); c.moveTo(6, -38 + bob); c.lineTo(10, -30 + bob); c.stroke();
    c.globalAlpha = 1;
    if (sp.crystals) {
      c.fillStyle = F('#e0f2fe');
      for (const [px, h] of [[-12, 14], [-4, 20], [6, 16]]) {
        c.beginPath(); c.moveTo(px - 4, -42 + bob); c.lineTo(px, -42 - h + bob); c.lineTo(px + 4, -42 + bob); c.fill();
      }
    }
    c.restore();
  }

  function flame(c, x, y, size, o, sp) {
    const t = o.time * 10 + o.seed;
    const s = size / 32;
    c.save(); c.translate(x, y - 4 + Math.sin(t * 0.4) * 2); c.scale(s, s);
    const layers = o.flash ? [['#fff', 1]] : [[sp.color, 1], ['#fbbf24', 0.7], ['#fef3c7', 0.4]];
    for (const [col, k] of layers) {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(-14 * k, 0);
      c.quadraticCurveTo(-16 * k, -18 * k, Math.sin(t) * 4, -36 * k - Math.sin(t * 1.3) * 3);
      c.quadraticCurveTo(16 * k, -18 * k, 14 * k, 0);
      c.closePath(); c.fill();
    }
    c.fillStyle = '#1c1917';
    c.beginPath(); c.arc(-4 + o.face * 2, -12, 2.2, 0, Math.PI * 2); c.arc(4 + o.face * 2, -12, 2.2, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function emoji(c, x, y, size, o, sp) {
    const bob = sp.float ? Math.sin(o.time * 3 + o.seed) * 4 - 8 : Math.abs(Math.sin(o.walk)) * -3;
    shadow(c, x, y, size * 0.4);
    c.save();
    c.translate(x, y + bob);
    const sc = o.atk > 0 ? 1 + 0.15 * (1 - o.atk) : 1;
    c.scale(sc * (o.face < 0 ? 1 : -1), sc);
    if (sp.aura) {
      c.fillStyle = sp.aura + '40';
      c.beginPath(); c.ellipse(0, -size * 0.45, size * 0.62, size * 0.5, 0, 0, Math.PI * 2); c.fill();
    }
    if (o.flash) { c.shadowColor = '#fff'; c.shadowBlur = 18; }
    c.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.fillStyle = '#e5e7eb'; // solo se nota si el dispositivo no tiene emojis a color
    c.fillText(sp.emoji, 0, size * 0.08);
    if (o.flash) { c.globalAlpha = 0.5; c.fillText(sp.emoji, 0, size * 0.08); c.globalAlpha = 1; }
    c.restore();
  }

  /** Dibuja cualquier enemigo según la definición de su sprite. */
  function enemy(c, e, time) {
    const sp = e.def.sprite;
    const o = { face: e.face, walk: e.walk, flash: e.flash > 0, atk: e.windup > 0 ? e.windup / e.windupMax : 0, recover: e.recover, time, seed: e.seed };
    if (e.frozen > 0) c.globalAlpha = 0.85;
    if (sp.emoji) emoji(c, e.x, e.y, e.size, o, Object.assign({ float: e.def.float }, sp));
    else if (sp.shape === 'slime') slime(c, e.x, e.y, e.size, o, sp);
    else if (sp.shape === 'golem') golem(c, e.x, e.y, e.size, o, sp);
    else if (sp.shape === 'flame') flame(c, e.x, e.y, e.size, o, sp);
    else humanoid(c, e.x, e.y, e.size, o, sp);
    c.globalAlpha = 1;
    if (sp.crown) {
      c.font = `${e.size * 0.32}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillStyle = '#facc15';
      c.fillText('👑', e.x, e.y - e.size * 0.85 + Math.sin(time * 3) * 2);
    }
    if (e.frozen > 0) {
      c.fillStyle = 'rgba(147,197,253,.45)';
      rrect(c, e.x - e.size * 0.45, e.y - e.size * 1.05, e.size * 0.9, e.size, 6); c.fill();
      c.strokeStyle = 'rgba(224,242,254,.9)'; c.lineWidth = 1.5; c.stroke();
    }
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
    // Suelo
    c.fillStyle = T.ground; c.fillRect(0, G, W, H - G);
    c.fillStyle = T.dirt; c.fillRect(0, G + 12, W, H - G);
    c.fillStyle = 'rgba(0,0,0,.12)';
    for (let i = 0; i < 30; i++) c.fillRect(rnd() * W, G + 14 + rnd() * (H - G - 16), 6 + rnd() * 10, 2);
    if (theme === 'volcan') {
      c.strokeStyle = '#f97316'; c.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) { const x = rnd() * W; c.beginPath(); c.moveTo(x, G + 13); c.lineTo(x + 8, G + 24); c.lineTo(x + 3, G + 40); c.stroke(); }
    }
    if (theme === 'bosque') { c.fillStyle = '#65a30d'; for (let x = 0; x < W; x += 5) c.fillRect(x, G - 3 + rnd() * 2, 2, 5); }
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

  return { knight, enemy, background, THEMES, rrect };
})();
