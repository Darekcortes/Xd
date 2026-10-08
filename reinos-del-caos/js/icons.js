'use strict';
/* =====================================================================
   ICONOS DIBUJADOS (SVG)
   Cada arma, armadura, poción y material tiene su propio dibujo, para que
   no se confundan entre sí (antes varios compartían el mismo emoji).
   ===================================================================== */
const Icons = (() => {
  const cache = {};
  const hex = c => c.replace('#', '');
  // Aclara u oscurece un color: k > 0 hacia blanco, k < 0 hacia negro
  function tone(c, k) {
    const n = parseInt(hex(c), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = k > 0 ? 255 : 0, a = Math.abs(k);
    r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  const svg = (body, defs = '') => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="gi"><defs>${defs}</defs>${body}</svg>`;
  const lin = (id, c1, c2, x2 = 1, y2 = 0) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
  const rad = (id, c1, c2) => `<radialGradient id="${id}" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`;
  const OUT = 'stroke="#140c1f" stroke-width="1.6" stroke-linejoin="round"';

  /* ---------- Armas ---------- */
  // Cada arma: forma de hoja, colores de hoja, guarda, empuñadura, pomo y detalles
  const WEAPONS = {
    espada_madera:     { blade: 'wood', bc: '#c08a4e', guard: 'bar', gc: '#7c4a1e', grip: '#5b3413', pommel: '#7c4a1e', w: 5 },
    espada_oxidada:    { blade: 'straight', bc: '#a1887f', guard: 'bar', gc: '#6d4c41', grip: '#4e342e', pommel: '#6d4c41', w: 4.5, rust: true },
    espada_hierro:     { blade: 'straight', bc: '#cfd8dc', guard: 'curve', gc: '#78909c', grip: '#37474f', pommel: '#90a4ae', w: 4.5, fuller: true },
    hoja_rey_lobo:     { blade: 'fang', bc: '#f5f5f4', guard: 'fangs', gc: '#a8a29e', grip: '#57534e', pommel: '#facc15', gem: '#facc15' },
    espada_acero:      { blade: 'long', bc: '#e2e8f0', guard: 'ornate', gc: '#eab308', grip: '#1e3a8a', pommel: '#eab308', gem: '#3b82f6', w: 4.5, fuller: true },
    cimitarra:         { blade: 'scimitar', bc: '#fde68a', guard: 'curve', gc: '#b45309', grip: '#7f1d1d', pommel: '#f59e0b', gem: '#dc2626' },
    espada_hielo:      { blade: 'crystal', bc: '#7dd3fc', guard: 'shards', gc: '#bae6fd', grip: '#1e40af', pommel: '#e0f2fe', glow: '#7dd3fc' },
    espada_fuego:      { blade: 'flame', bc: '#fb923c', guard: 'horns', gc: '#7c2d12', grip: '#431407', pommel: '#f97316', gem: '#fde047', glow: '#f97316' },
    espada_infernal:   { blade: 'jagged', bc: '#3f0d0d', guard: 'horns', gc: '#1c0a0a', grip: '#450a0a', pommel: '#ef4444', gem: '#ef4444', cracks: '#ef4444', glow: '#ef4444' },
    espada_inframundo: { blade: 'wave', bc: '#6b21a8', guard: 'wings', gc: '#2e1065', grip: '#1e1b4b', pommel: '#c084fc', gem: '#e879f9', runes: '#e9d5ff', glow: '#a855f7' },
    espada_divina:     { blade: 'long', bc: '#fffbeb', guard: 'wings', gc: '#facc15', grip: '#1e3a8a', pommel: '#fde047', gem: '#67e8f9', runes: '#f59e0b', glow: '#fde047', w: 5.2, fuller: true },
    hoja_caos:         { blade: 'chaos', bc: '#f43f5e', guard: 'chaos', gc: '#facc15', grip: '#111827', pommel: '#facc15', gem: '#fdf2f8', runes: '#fff1f2', glow: '#f43f5e' },
  };
  function bladePath(w) {
    const cx = 32, W = w.w || 5;
    const wave = (amp, n, top, bot, width) => {
      let L = '', R = '';
      for (let i = 0; i <= n; i++) {
        const y = top + (bot - top) * i / n, off = Math.sin(i * 1.6) * amp, ww = width * (0.55 + 0.45 * i / n);
        R += `L${(cx + ww + off).toFixed(1)},${y.toFixed(1)} `;
        L = `L${(cx - ww + off).toFixed(1)},${y.toFixed(1)} ` + L;
      }
      return `M${cx},2 ${R}L${cx + width},45 L${cx - width},45 ${L}Z`;
    };
    switch (w.blade) {
      case 'wood': return `M${cx - W},45 L${cx - W},10 Q${cx},3 ${cx + W},10 L${cx + W},45 Z`;
      case 'straight': return `M${cx},5 L${cx + W},13 L${cx + W},45 L${cx - W},45 L${cx - W},13 Z`;
      case 'long': return `M${cx},2 L${cx + W},10 L${cx + W - 0.5},45 L${cx - W + 0.5},45 L${cx - W},10 Z`;
      case 'fang': return `M${cx - 5},45 C${cx - 7},30 ${cx - 4},14 ${cx + 6},3 C${cx + 3},16 ${cx + 6},32 ${cx + 5},45 Z`;
      case 'scimitar': return `M${cx - 4},45 C${cx - 4},30 ${cx + 2},14 ${cx + 14},4 C${cx + 9},18 ${cx + 7},34 ${cx + 4},45 Z`;
      case 'crystal': return `M${cx},1 L${cx + 6},10 L${cx + 4},20 L${cx + 7},30 L${cx + 5},45 L${cx - 5},45 L${cx - 7},30 L${cx - 4},20 L${cx - 6},10 Z`;
      case 'flame': return wave(2.6, 8, 4, 45, 5.5);
      case 'wave': return wave(1.8, 10, 3, 45, 5);
      case 'jagged': {
        let R = '', L = '';
        for (let i = 0; i <= 8; i++) {
          const y = 8 + i * 4.6, ww = (i % 2 ? 8 : 5.5);
          R += `L${cx + ww},${y} `; L = `L${cx - ww},${y + 2} ` + L;
        }
        return `M${cx},1 ${R}L${cx + 5},45 L${cx - 5},45 ${L}Z`;
      }
      case 'chaos': return `M${cx},1 L${cx + 4},7 L${cx + 9},12 L${cx + 6},18 L${cx + 8},30 L${cx + 6},45 L${cx - 6},45 L${cx - 8},30 L${cx - 6},18 L${cx - 9},12 L${cx - 4},7 Z`;
    }
    return '';
  }
  function guard(w, k) {
    const c = w.gc, d = tone(c, -0.35), cx = 32;
    switch (w.guard) {
      case 'bar': return `<rect x="21" y="44" width="22" height="5" rx="2" fill="${c}" ${OUT}/>`;
      case 'curve': return `<path d="M19,42 Q24,49 32,47 Q40,49 45,42 L46,46 Q40,53 32,51 Q24,53 18,46 Z" fill="url(#${k}g)" ${OUT}/>`;
      case 'ornate': return `<path d="M17,41 Q22,48 32,46 Q42,48 47,41 L48,46 Q42,53 32,51 Q22,53 16,46 Z" fill="url(#${k}g)" ${OUT}/><circle cx="17" cy="43" r="2.4" fill="${c}" ${OUT}/><circle cx="47" cy="43" r="2.4" fill="${c}" ${OUT}/>`;
      case 'fangs': return `<path d="M20,44 L44,44 L44,49 L20,49 Z" fill="${c}" ${OUT}/><path d="M21,44 L17,37 L24,44 Z M43,44 L47,37 L40,44 Z" fill="#fafaf9" ${OUT}/>`;
      case 'shards': return `<path d="M22,46 L14,38 L24,43 L28,36 L32,43 L36,36 L40,43 L50,38 L42,46 L42,50 L22,50 Z" fill="url(#${k}g)" ${OUT}/>`;
      case 'horns': return `<path d="M22,45 C16,44 13,38 15,32 C17,38 21,41 26,42 L38,42 C43,41 47,38 49,32 C51,38 48,44 42,45 L40,50 L24,50 Z" fill="url(#${k}g)" ${OUT}/>`;
      case 'wings': return `<path d="M24,44 C18,44 12,40 9,33 C14,36 16,35 19,36 C17,33 17,31 18,29 C21,34 24,38 28,41 L36,41 C40,38 43,34 46,29 C47,31 47,33 45,36 C48,35 50,36 55,33 C52,40 46,44 40,44 L38,50 L26,50 Z" fill="url(#${k}g)" ${OUT}/>`;
      case 'chaos': return `<path d="M14,40 L22,43 L26,38 L32,44 L38,38 L42,43 L50,40 L44,47 L40,51 L24,51 L20,47 Z" fill="url(#${k}g)" ${OUT}/>`;
    }
    return `<rect x="21" y="44" width="22" height="5" rx="2" fill="${c}" stroke="${d}"/>`;
  }
  function weapon(id) {
    const w = WEAPONS[id], k = 'w_' + id, bc = w.bc;
    const defs = lin(k + 'b', tone(bc, 0.45), tone(bc, -0.3)) + lin(k + 'g', tone(w.gc, 0.35), tone(w.gc, -0.35), 0, 1)
      + rad(k + 'p', tone(w.pommel, 0.6), tone(w.pommel, -0.3));
    let blade = `<path d="${bladePath(w)}" fill="url(#${k}b)" ${OUT}/>`;
    let extra = '';
    if (w.blade === 'wood') extra += `<path d="M30,12 Q31,26 29.5,42 M34,16 Q35,30 34,42" stroke="${tone(bc, -0.35)}" stroke-width="1" fill="none"/>`;
    if (w.fuller) extra += `<path d="M32,12 L32,43" stroke="${tone(bc, -0.35)}" stroke-width="1.6"/><path d="M33,13 L33,43" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>`;
    if (w.rust) extra += `<circle cx="30" cy="22" r="2" fill="#8d4a1f" opacity=".8"/><circle cx="34" cy="33" r="2.6" fill="#8d4a1f" opacity=".7"/><circle cx="31" cy="39" r="1.4" fill="#6d3412" opacity=".8"/><path d="M36.5,26 L34.5,27.5 L36.5,29" fill="#160e1d"/>`;
    if (w.blade === 'crystal') extra += `<path d="M32,2 L32,44 M26,10 L32,20 L38,10 M25,30 L32,38 L39,30" stroke="#fff" stroke-opacity=".7" stroke-width=".9" fill="none"/>`;
    if (w.blade === 'flame') extra += `<path d="M32,9 Q35,20 34,30 Q34.5,38 33.5,44 L30.5,44 Q29.5,38 30,30 Q29,20 32,9 Z" fill="#fde047" opacity=".75"/>`;
    if (w.cracks) extra += `<path d="M31,8 L33,14 L30,20 L34,27 L31,33 L33,40" stroke="${w.cracks}" stroke-width="1.6" fill="none"/><path d="M31,8 L33,14 L30,20 L34,27 L31,33 L33,40" stroke="#fde68a" stroke-width=".6" fill="none"/>`;
    if (w.runes) extra += `<g fill="${w.runes}" opacity=".9"><rect x="31" y="12" width="2" height="4" rx="1"/><rect x="30" y="20" width="4" height="1.6" rx=".8"/><rect x="31" y="26" width="2" height="4" rx="1"/><rect x="30" y="34" width="4" height="1.6" rx=".8"/></g>`;
    if (w.blade === 'chaos') extra += `<path d="M32,6 L32,43" stroke="#111827" stroke-width="2"/><path d="M32,6 L32,43" stroke="${w.runes}" stroke-width=".8"/>`;
    // Brillo de la hoja (filo)
    const shine = w.blade === 'wood' ? '' : `<path d="${bladePath(w)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8" transform="translate(-0.8 0)"/>`;
    const glow = w.glow ? `<path d="${bladePath(w)}" fill="none" stroke="${w.glow}" stroke-opacity=".45" stroke-width="5" stroke-linejoin="round"/>` : '';
    const grip = `<rect x="29" y="49" width="6" height="9" rx="1.5" fill="${w.grip}" ${OUT}/><path d="M29,51.5 L35,53 M29,54.5 L35,56" stroke="${tone(w.grip, 0.35)}" stroke-width="1"/>`;
    const pommel = `<circle cx="32" cy="59.5" r="3.4" fill="url(#${k}p)" ${OUT}/>`;
    const gem = w.gem ? `<circle cx="32" cy="47" r="2.3" fill="${w.gem}" stroke="#140c1f" stroke-width="1"/><circle cx="31.3" cy="46.3" r=".8" fill="#fff" opacity=".8"/>` : '';
    return svg(`<g transform="translate(32 32) scale(1.1) rotate(45) translate(-32 -32.5)">${glow}${blade}${extra}${shine}${grip}${guard(w, k)}${gem}${pommel}</g>`, defs);
  }

  /* ---------- Armaduras ---------- */
  const ARMORS = {
    ropa_viajero:       { kind: 'tunic', c: '#8b6b4a', trim: '#5b3a1f', belt: '#3f2a14' },
    armadura_basica:    { kind: 'plate', c: '#9ca3af', trim: '#6b7280' },
    armadura_cuero:     { kind: 'leather', c: '#a16207', trim: '#713f12', belt: '#422006' },
    armadura_reforzada: { kind: 'plate', c: '#cbd5e1', trim: '#475569', pauldrons: true, rivets: true },
    armadura_escamas:   { kind: 'scales', c: '#d97706', trim: '#78350f', pauldrons: true },
    armadura_congelada: { kind: 'plate', c: '#93c5fd', trim: '#1d4ed8', pauldrons: true, ice: true, gem: '#e0f2fe' },
    armadura_lava:      { kind: 'plate', c: '#3f1d1d', trim: '#7f1d1d', pauldrons: true, lava: true, gem: '#f97316' },
    armadura_oscura:    { kind: 'plate', c: '#3b2a5c', trim: '#1e1033', pauldrons: true, spikes: '#a78bfa', gem: '#c084fc' },
    armadura_divina:    { kind: 'plate', c: '#fef3c7', trim: '#d97706', pauldrons: true, horns: true, gem: '#67e8f9', star: true },
    armadura_caos:      { kind: 'plate', c: '#9f1239', trim: '#facc15', pauldrons: true, horns: true, gem: '#fde047', star: true },
  };
  const TORSO = 'M20,14 L27,10 Q32,15 37,10 L44,14 L49,23 L45,27 L45,51 Q32,58 19,51 L19,27 L15,23 Z';
  function armor(id) {
    const a = ARMORS[id], k = 'a_' + id, c = a.c;
    const defs = lin(k + 'm', tone(c, 0.35), tone(c, -0.35)) + lin(k + 's', tone(c, 0.5), tone(c, -0.2), 0, 1);
    let b = '';
    if (a.kind === 'tunic') {
      b += `<path d="M18,14 L27,10 Q32,14 37,10 L46,14 L53,26 L46,29 L45,52 Q32,56 19,52 L18,29 L11,26 Z" fill="url(#${k}m)" ${OUT}/>`;
      b += `<path d="M27,10 L32,22 L37,10" fill="${tone(c, -0.4)}" ${OUT}/><path d="M29.5,14 L34.5,14 M30,17 L34,17" stroke="#f5deb3" stroke-width="1"/>`;
      b += `<rect x="19" y="38" width="26" height="5" fill="${a.belt}" ${OUT}/><rect x="29.5" y="37.5" width="5" height="6" rx="1" fill="#d6b25e" ${OUT}/>`;
      b += `<path d="M22,46 L22,51 M27,47 L27,53 M37,47 L37,53 M42,46 L42,51" stroke="${tone(c, -0.3)}" stroke-width="1"/>`;
      return svg(b, defs);
    }
    b += `<path d="${TORSO}" fill="url(#${k}m)" ${OUT}/>`;
    if (a.kind === 'leather') {
      b += `<path d="${TORSO}" fill="none" stroke="#f5deb3" stroke-opacity=".7" stroke-width="1" stroke-dasharray="2 2" transform="translate(32 33) scale(.86) translate(-32 -33)"/>`;
      b += `<path d="M21,20 L43,44" stroke="${a.belt}" stroke-width="4"/><rect x="30" y="29" width="5" height="5" rx="1" fill="#d6b25e" ${OUT}/>`;
      b += `<rect x="19" y="42" width="26" height="4.5" fill="${a.belt}" ${OUT}/><rect x="29.5" y="41.5" width="5" height="5.5" rx="1" fill="#d6b25e" ${OUT}/>`;
    } else if (a.kind === 'scales') {
      let sc = '';
      for (let row = 0; row < 7; row++) for (let col = 0; col < 6; col++) {
        const x = 21.5 + col * 4.2 + (row % 2) * 2.1, y = 17 + row * 4.6;
        if (x > 44) continue;
        sc += `<path d="M${x - 2.1},${y} Q${x},${y + 5} ${x + 2.1},${y}" fill="url(#${k}s)" stroke="${tone(c, -0.5)}" stroke-width=".7"/>`;
      }
      b += `<clipPath id="${k}c"><path d="${TORSO}"/></clipPath><g clip-path="url(#${k}c)">${sc}</g><path d="${TORSO}" fill="none" ${OUT}/>`;
      b += `<path d="M27,10 Q32,15 37,10" fill="none" stroke="${a.trim}" stroke-width="2.4"/>`;
    } else {
      // Placa: línea central, pectorales y abdomen por placas
      b += `<path d="M32,16 L32,53" stroke="${tone(c, -0.45)}" stroke-width="1.2"/>`;
      b += `<path d="M21,26 Q26,32 32,28 Q38,32 43,26" fill="none" stroke="${tone(c, -0.45)}" stroke-width="1.2"/>`;
      b += `<path d="M20,38 Q32,42 44,38 M20,44 Q32,48 44,44" fill="none" stroke="${tone(c, -0.45)}" stroke-width="1.1"/>`;
      b += `<path d="M23,17 Q26,15 29,18 L28,26 Q24,25 22,23 Z" fill="#fff" opacity=".22"/>`;
      b += `<path d="M27,10 Q32,15 37,10" fill="none" stroke="${a.trim}" stroke-width="2.4"/>`;
      if (a.lava) b += `<path d="M24,20 L27,27 L24,33 L28,40 L25,48 M40,19 L37,26 L41,33 L37,41 L40,49 M32,30 L34,36 L31,42" stroke="#f97316" stroke-width="1.6" fill="none"/><path d="M24,20 L27,27 L24,33 L28,40 L25,48 M40,19 L37,26 L41,33 L37,41 L40,49" stroke="#fde68a" stroke-width=".5" fill="none"/>`;
      if (a.ice) b += `<path d="M20,51 L22,56 L24,52 L27,57 L29,53 L32,58 L35,53 L37,57 L40,52 L42,56 L44,51" fill="#e0f2fe" ${OUT}/>`;
      if (a.star) b += `<path d="M32,24 L34,30 L40,30 L35,34 L37,40 L32,36 L27,40 L29,34 L24,30 L30,30 Z" fill="${a.trim}" opacity=".9" ${OUT}/>`;
      if (a.trim && (a.horns || a.spikes)) b += `<path d="${TORSO}" fill="none" stroke="${a.trim}" stroke-width="1.2" transform="translate(32 33) scale(.9) translate(-32 -33)"/>`;
    }
    if (a.pauldrons) {
      const pc = a.ice ? '#dbeafe' : tone(c, 0.15);
      b += `<path d="M10,24 Q11,13 22,12 Q27,14 26,20 Q19,20 15,27 Z" fill="${pc}" ${OUT}/><path d="M54,24 Q53,13 42,12 Q37,14 38,20 Q45,20 49,27 Z" fill="${pc}" ${OUT}/>`;
      b += `<path d="M13,22 Q15,16 21,15" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" fill="none"/>`;
      if (a.ice) b += `<path d="M12,16 L10,8 L16,14 Z M52,16 L54,8 L48,14 Z M18,13 L18,6 L22,12 Z M46,13 L46,6 L42,12 Z" fill="#e0f2fe" ${OUT}/>`;
      if (a.spikes) b += `<path d="M12,17 L6,9 L16,14 Z M18,13 L15,4 L22,12 Z M52,17 L58,9 L48,14 Z M46,13 L49,4 L42,12 Z" fill="${a.spikes}" ${OUT}/>`;
      if (a.horns) b += `<path d="M14,15 C8,12 6,6 9,1 C11,7 15,10 20,12 Z M50,15 C56,12 58,6 55,1 C53,7 49,10 44,12 Z" fill="${a.trim}" ${OUT}/>`;
    }
    if (a.rivets) b += [[22, 30], [42, 30], [22, 47], [42, 47], [32, 20]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#e2e8f0" stroke="#334155" stroke-width=".6"/>`).join('');
    if (a.gem) b += `<path d="M32,${a.star ? 28 : 30} l3.5,3.5 l-3.5,3.5 l-3.5,-3.5 Z" fill="${a.gem}" ${OUT}/><circle cx="31" cy="${a.star ? 30.5 : 32.5}" r=".8" fill="#fff"/>`;
    return svg(b, defs);
  }

  /* ---------- Pociones ---------- */
  function potion(id) {
    const k = 'p_' + id;
    if (id === 'pocion_grande') {
      const defs = lin(k + 'l', '#c084fc', '#4c1d95', 0, 1) + rad(k + 'g', '#ffffff', '#c7d2fe');
      return svg(`<rect x="26" y="4" width="12" height="8" rx="2" fill="#a16207" ${OUT}/><rect x="24" y="11" width="16" height="5" rx="1.5" fill="#facc15" ${OUT}/>
        <path d="M27,16 L37,16 L37,21 Q52,26 52,42 Q52,58 32,58 Q12,58 12,42 Q12,26 27,21 Z" fill="url(#${k}g)" opacity=".55" ${OUT}/>
        <path d="M14,40 Q32,34 50,40 Q51,56 32,56 Q13,56 14,40 Z" fill="url(#${k}l)"/>
        <rect x="21" y="40" width="22" height="8" rx="1.5" fill="#fef3c7" stroke="#92400e" stroke-width="1"/><path d="M32,41.5 l1.6,2.5 l-1.6,2.5 l-1.6,-2.5 Z" fill="#a855f7"/>
        <circle cx="22" cy="51" r="1.6" fill="#fff" opacity=".7"/><circle cx="40" cy="52" r="1.1" fill="#fff" opacity=".7"/>
        <path d="M18,30 Q20,24 26,22" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>`, defs);
    }
    const defs = lin(k + 'l', '#fb7185', '#9f1239', 0, 1) + rad(k + 'g', '#ffffff', '#e0f2fe');
    return svg(`<rect x="27" y="6" width="10" height="8" rx="2" fill="#a16207" ${OUT}/>
      <path d="M28,14 L36,14 L36,24 Q48,30 48,42 Q48,56 32,56 Q16,56 16,42 Q16,30 28,24 Z" fill="url(#${k}g)" opacity=".55" ${OUT}/>
      <path d="M18,38 Q32,33 46,38 Q47,54 32,54 Q17,54 18,38 Z" fill="url(#${k}l)"/>
      <circle cx="26" cy="45" r="2" fill="#fff" opacity=".6"/><circle cx="35" cy="48" r="1.3" fill="#fff" opacity=".6"/><circle cx="30" cy="41" r="1" fill="#fff" opacity=".6"/>
      <path d="M21,34 Q23,28 28,26" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>`, defs);
  }

  /* ---------- Materiales ---------- */
  const ingot = (k, c) => svg(`<path d="M10,40 L18,28 L50,28 L56,40 Z" fill="${tone(c, 0.35)}" ${OUT}/><path d="M10,40 L56,40 L54,48 L12,48 Z" fill="url(#${k}m)" ${OUT}/><path d="M20,31 L46,31" stroke="#fff" stroke-opacity=".6" stroke-width="1.4"/>`, lin(k + 'm', tone(c, 0.1), tone(c, -0.4), 0, 1));
  const crystals = (k, c) => svg(`<path d="M28,56 L22,30 L30,8 L38,30 L34,56 Z" fill="url(#${k}m)" ${OUT}/><path d="M18,56 L12,38 L18,24 L24,40 Z" fill="url(#${k}m)" ${OUT}/><path d="M38,56 L42,34 L50,22 L54,40 L46,56 Z" fill="url(#${k}m)" ${OUT}/>
    <path d="M30,8 L30,56 M18,24 L19,56 M50,22 L45,56" stroke="#fff" stroke-opacity=".55" stroke-width="1"/><path d="M10,56 L56,56" ${OUT}/>`, lin(k + 'm', tone(c, 0.55), tone(c, -0.35)));
  const orb = (k, c, inner) => svg(`<circle cx="32" cy="33" r="21" fill="${c}" opacity=".25"/><circle cx="32" cy="33" r="15" fill="url(#${k}m)" ${OUT}/>${inner}<circle cx="27" cy="27" r="4" fill="#fff" opacity=".55"/>`, rad(k + 'm', tone(c, 0.6), tone(c, -0.45)));
  const rock = (k, c, veins) => svg(`<path d="M10,46 L14,28 L26,16 L42,18 L54,30 L52,48 L36,54 L18,54 Z" fill="url(#${k}m)" ${OUT}/><path d="M26,16 L30,30 L14,28 M30,30 L42,18 M30,30 L36,54 M30,30 L54,30" stroke="${tone(c, -0.45)}" stroke-width="1.1" fill="none"/>${veins || ''}`, lin(k + 'm', tone(c, 0.3), tone(c, -0.4), 1, 1));
  const MATS = {
    madera: k => svg(`<rect x="8" y="22" width="40" height="22" rx="4" fill="url(#${k}m)" ${OUT}/><ellipse cx="48" cy="33" rx="7" ry="11" fill="#e2b77a" ${OUT}/><ellipse cx="48" cy="33" rx="4" ry="7" fill="none" stroke="#a16207" stroke-width="1"/><ellipse cx="48" cy="33" rx="1.6" ry="3" fill="#a16207"/><path d="M12,28 L40,28 M14,38 L36,38" stroke="#5b3413" stroke-width="1.2"/><path d="M20,22 L24,16 L26,22" fill="#4d7c0f" ${OUT}/>`, lin(k + 'm', '#a16207', '#6b3a10', 0, 1)),
    piedra: k => rock(k, '#9ca3af'),
    hierro: k => svg(`<path d="M8,40 L18,26 L50,26 L58,40 Z" fill="#cbd5e1" ${OUT}/><path d="M8,40 L58,40 L55,50 L11,50 Z" fill="url(#${k}m)" ${OUT}/><path d="M20,29 L48,29" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"/><circle cx="20" cy="45" r="1.4" fill="#475569"/><circle cx="46" cy="45" r="1.4" fill="#475569"/>`, lin(k + 'm', '#94a3b8', '#334155', 0, 1)),
    cristal: k => crystals(k, '#22d3ee'),
    oro: k => ingot(k, '#facc15'),
    esencia: k => orb(k, '#c4b5fd', `<path d="M32,24 Q33,32 40,33 Q33,34 32,42 Q31,34 24,33 Q31,32 32,24 Z" fill="#fff"/>`),
    cristal_hielo: k => crystals(k, '#bae6fd'),
    esencia_hielo: k => orb(k, '#38bdf8', `<path d="M32,24 L32,42 M24,28.5 L40,37.5 M24,37.5 L40,28.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`),
    mineral_volcanico: k => rock(k, '#44403c', `<path d="M16,40 L24,36 L30,42 L38,36 L48,40 M22,24 L28,28" stroke="#f97316" stroke-width="2" fill="none"/><path d="M16,40 L24,36 L30,42 L38,36 L48,40" stroke="#fde68a" stroke-width=".6" fill="none"/>`),
    esencia_fuego: k => orb(k, '#f97316', `<path d="M32,22 C38,28 40,32 38,38 C37,42 27,42 26,38 C25,34 28,32 29,28 C30,31 32,31 32,22 Z" fill="#fde047"/>`),
    cristal_rojo: k => crystals(k, '#ef4444'),
    cristal_oscuro: k => crystals(k, '#9333ea'),
    esencia_demoniaca: k => orb(k, '#b91c1c', `<ellipse cx="32" cy="33" rx="8" ry="5" fill="#fde047"/><ellipse cx="32" cy="33" rx="1.8" ry="5" fill="#111"/>`),
    oro_oscuro: k => ingot(k, '#7e22ce'),
    fragmento_legendario: k => svg(`<circle cx="32" cy="32" r="22" fill="#fde047" opacity=".25"/><path d="M32,6 L38,24 L58,26 L42,38 L48,58 L32,46 L16,58 L22,38 L6,26 L26,24 Z" fill="url(#${k}m)" ${OUT}/><path d="M32,6 L32,46 M6,26 L42,38 M58,26 L22,38" stroke="#fff" stroke-opacity=".5" stroke-width="1"/>`, lin(k + 'm', '#fef9c3', '#d97706', 1, 1)),
    colmillo_rey: k => svg(`<path d="M20,8 Q44,10 48,30 Q50,46 40,58 Q38,40 30,30 Q22,22 20,8 Z" fill="url(#${k}m)" ${OUT}/><path d="M24,12 Q40,16 44,30" stroke="#fff" stroke-width="1.5" fill="none" opacity=".8"/><path d="M18,6 Q30,4 34,10 Q26,12 20,12 Z" fill="#a8a29e" ${OUT}/>`, lin(k + 'm', '#fafaf9', '#a8a29e', 1, 1)),
    aguijon_reina: k => svg(`<path d="M10,52 Q14,30 30,22 Q46,14 52,6 Q50,22 38,32 Q26,42 20,56 Z" fill="url(#${k}m)" ${OUT}/><path d="M52,6 L58,2 L54,10 Z" fill="#a3e635" ${OUT}/><path d="M16,46 Q20,40 26,38 M22,38 Q28,32 34,30 M30,30 Q36,25 42,22" stroke="#fde68a" stroke-width="1.2" fill="none" opacity=".7"/>`, lin(k + 'm', '#a855f7', '#3b0764', 1, 1)),
    nucleo_hielo: k => svg(`<circle cx="32" cy="32" r="24" fill="#7dd3fc" opacity=".25"/><path d="M32,8 L52,20 L52,44 L32,56 L12,44 L12,20 Z" fill="url(#${k}m)" ${OUT}/><path d="M32,8 L32,32 L52,20 M32,32 L12,20 M32,32 L32,56 M32,32 L12,44 M32,32 L52,44" stroke="#fff" stroke-opacity=".55" stroke-width="1" fill="none"/><circle cx="32" cy="32" r="5" fill="#fff" opacity=".85"/>`, lin(k + 'm', '#e0f2fe', '#1d4ed8', 1, 1)),
    escama_dragon: k => svg(`<path d="M32,6 Q54,14 52,36 Q48,54 32,58 Q16,54 12,36 Q10,14 32,6 Z" fill="url(#${k}m)" ${OUT}/><path d="M32,12 Q46,18 46,34 Q44,48 32,52 Q20,48 18,34 Q18,18 32,12 Z" fill="none" stroke="#a7f3d0" stroke-opacity=".6" stroke-width="1.4"/><path d="M32,14 L32,50" stroke="#064e3b" stroke-width="1.4"/><path d="M24,18 Q28,16 32,14" stroke="#fff" stroke-width="1.6" opacity=".6" fill="none"/>`, lin(k + 'm', '#34d399', '#065f46', 1, 1)),
    alma_maldita: k => svg(`<circle cx="32" cy="30" r="24" fill="#a855f7" opacity=".2"/><path d="M18,32 Q18,12 32,12 Q46,12 46,32 L46,52 L41,47 L37,53 L32,47 L27,53 L23,47 L18,52 Z" fill="url(#${k}m)" ${OUT}/><ellipse cx="27" cy="29" rx="3" ry="4.2" fill="#2e1065"/><ellipse cx="37" cy="29" rx="3" ry="4.2" fill="#2e1065"/><ellipse cx="32" cy="39" rx="2.4" ry="3" fill="#2e1065"/>`, lin(k + 'm', '#f5f3ff', '#a78bfa', 0, 1)),
  };

  /** HTML del icono (SVG) para un objeto, poción o material. Si no hay dibujo, usa el emoji. */
  // Cada copia del icono lleva sus propios id de degradado: si un id se repitiera
  // y la primera copia estuviera en una pantalla oculta, el color no se vería.
  let uid = 0;
  const unique = s => { const n = ++uid; return s.replace(/(id="|url\(#)([wapm]_)/g, `$1u${n}$2`); };
  function html(id) {
    const s = raw(id);
    return s.startsWith('<svg') ? unique(s) : s;
  }
  function raw(id) {
    if (cache[id]) return cache[id];
    let s = null;
    if (WEAPONS[id]) s = weapon(id);
    else if (ARMORS[id]) s = armor(id);
    else if (id === 'pocion' || id === 'pocion_grande') s = potion(id);
    else if (MATS[id]) s = MATS[id]('m_' + id);
    if (!s) {
      const d = (typeof ITEMS !== 'undefined' && ITEMS[id]) || (typeof MATERIALS !== 'undefined' && MATERIALS[id]) || (typeof POTIONS !== 'undefined' && POTIONS[id]);
      return d ? d.icon : '';
    }
    return (cache[id] = s);
  }
  /** Imagen (para dibujar en un lienzo, p. ej. la ruleta). */
  const imgs = {};
  function image(id) {
    if (imgs[id]) return imgs[id];
    const s = raw(id);
    if (!s.startsWith('<svg')) return null;
    const im = new Image();
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.replace('<svg ', '<svg width="128" height="128" '));
    return (imgs[id] = im);
  }
  return { html, image, has: id => !!(WEAPONS[id] || ARMORS[id] || MATS[id] || id === 'pocion' || id === 'pocion_grande') };
})();
