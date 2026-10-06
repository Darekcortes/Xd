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
    const o = { face: e.face, walk: e.walk, flash: e.flash > 0, atk: e.windup > 0 ? e.windup / e.windupMax : 0,
                recover: e.recover, time, seed: e.seed, dash: e.state === 'dash', breath: e.breath };
    if (e.elite) {
      c.fillStyle = `rgba(250,204,21,${0.22 + Math.sin(time * 6) * 0.08})`;
      c.beginPath(); c.ellipse(e.x, e.y, e.size * 0.6, e.size * 0.2, 0, 0, Math.PI * 2); c.fill();
    }
    if (z) { shadow(c, e.x, e.y, e.size * 0.4); skipShadow = true; }
    if (e.frozen > 0) c.globalAlpha = 0.85;
    (SHAPES[sp.shape] || humanoid)(c, e.x, e.y - z, e.size, o, sp);
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

  return { knight, enemy, background, coin, gem, heart, prop, crown, THEMES, rrect, shade };
})();
