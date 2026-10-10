'use strict';
/* =====================================================================
   ICONOS DE LA INTERFAZ (sin emojis)
   Cada símbolo que antes era un emoji tiene aquí su dibujo. Un vigilante
   cambia automáticamente cualquier emoji que aparezca en la pantalla por
   su icono; los que no tengan dibujo se quitan.
   ===================================================================== */
const UIcons = (() => {
  const O = 'stroke="#140c1f" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
  const o = 'stroke="#140c1f" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"';
  let gid = 0;
  /** Construye un SVG; `g(c1, c2, dir)` devuelve url() de un degradado nuevo. */
  function mk(fn) {
    const defs = [];
    const g = (c1, c2, v = true) => { const id = 'q_' + (++gid); defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${v ? 0 : 1}" y2="${v ? 1 : 0}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`); return `url(#${id})`; };
    const r = (c1, c2) => { const id = 'q_' + (++gid); defs.push(`<radialGradient id="${id}" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`); return `url(#${id})`; };
    const body = fn(g, r);
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="gi"><defs>${defs.join('')}</defs>${body}</svg>`;
  }
  const star = (cx, cy, R, r, n = 5, rot = -Math.PI / 2) => {
    let d = '';
    for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ',' + (cy + Math.sin(a) * rr).toFixed(1); }
    return d + 'Z';
  };
  const sparkle = (cx, cy, s) => `M${cx},${cy - s} Q${cx},${cy} ${cx + s},${cy} Q${cx},${cy} ${cx},${cy + s} Q${cx},${cy} ${cx - s},${cy} Q${cx},${cy} ${cx},${cy - s}Z`;
  const face = (g, r, c1, c2, inner) => `<circle cx="32" cy="33" r="24" fill="${r(c1, c2)}" ${O}/>${inner}`;
  const medal = (n, c1, c2) => mk((g, r) => `<path d="M20,4 L28,24 L36,24 L28,4Z M44,4 L36,24 L28,24 L36,4Z" fill="#dc2626" ${o}/><circle cx="32" cy="40" r="18" fill="${r(c1, c2)}" ${O}/><circle cx="32" cy="40" r="12" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><text x="32" y="47" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="20" fill="#3b2405">${n}</text>`);
  const dot = (c) => mk((g, r) => `<circle cx="32" cy="32" r="18" fill="${r('#fff', c)}" ${O}/><circle cx="26" cy="26" r="5" fill="#fff" opacity=".7"/>`);

  const I = {};
  I['🔥'] = mk((g) => `<path d="M32,4 C40,16 52,22 50,40 C48,54 40,60 32,60 C22,60 14,52 14,40 C14,30 20,24 24,16 C26,24 28,26 30,26 C30,18 30,10 32,4Z" fill="${g('#fde047', '#dc2626')}" ${O}/><path d="M32,30 C38,38 42,42 40,50 C38,56 26,56 24,50 C22,44 28,40 30,34 C31,38 33,38 32,30Z" fill="${g('#fff7ed', '#fb923c')}"/>`);
  I['💎'] = mk((g) => `<path d="M14,22 L22,10 L42,10 L50,22 L32,56Z" fill="${g('#e0f2fe', '#0ea5e9')}" ${O}/><path d="M14,22 L50,22 M22,10 L28,22 L32,56 L36,22 L42,10 M28,22 L32,10 L36,22" fill="none" stroke="#0c4a6e" stroke-width="1.3" stroke-opacity=".6"/><path d="M22,12 L26,20" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`);
  I['🎟️'] = mk((g) => `<path d="M6,18 L58,18 L58,26 A6,6 0 0 0 58,38 L58,46 L6,46 L6,38 A6,6 0 0 0 6,26Z" fill="${g('#fda4af', '#e11d48')}" ${O}/><path d="M40,20 L40,44" stroke="#fff" stroke-width="2" stroke-dasharray="3 3"/><path d="${star(23, 32, 8, 3.4)}" fill="#fde047" ${o}/>`);
  I['⚔️'] = mk((g) => `<g ${O}><path d="M10,6 L16,6 L44,40 L40,44Z" fill="${g('#f1f5f9', '#94a3b8')}"/><path d="M54,6 L48,6 L20,40 L24,44Z" fill="${g('#f1f5f9', '#94a3b8')}"/><path d="M34,38 L46,50 M30,38 L18,50" stroke="#facc15" stroke-width="5"/><path d="M44,48 L52,56 M20,48 L12,56" stroke="#7c2d12" stroke-width="5"/></g>`);
  I['🛡️'] = mk((g) => `<path d="M32,4 L54,12 L52,36 Q48,52 32,60 Q16,52 12,36 L10,12Z" fill="${g('#60a5fa', '#1e3a8a')}" ${O}/><path d="M32,9 L49,15 L47,35 Q44,48 32,55 Q20,48 17,35 L15,15Z" fill="none" stroke="#facc15" stroke-width="2.5"/><path d="M32,16 L32,48 M22,28 L42,28" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>`);
  I['⭐'] = mk((g) => `<path d="${star(32, 34, 27, 12)}" fill="${g('#fef08a', '#f59e0b')}" ${O}/><path d="M24,24 L28,30" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`);
  I['🌟'] = mk((g, r) => `<circle cx="32" cy="33" r="28" fill="${r('#fef9c3', 'rgba(250,204,21,0)')}"/><path d="${star(32, 34, 24, 10)}" fill="${g('#fffbeb', '#facc15')}" ${O}/>`);
  I['🔒'] = mk((g) => `<path d="M20,28 L20,20 A12,12 0 0 1 44,20 L44,28" fill="none" stroke="#94a3b8" stroke-width="6"/><path d="M20,28 L20,20 A12,12 0 0 1 44,20 L44,28" fill="none" ${o}/><rect x="12" y="28" width="40" height="30" rx="5" fill="${g('#fde68a', '#b45309')}" ${O}/><circle cx="32" cy="40" r="4" fill="#3b2405"/><path d="M32,42 L32,50" stroke="#3b2405" stroke-width="3"/>`);
  I['🔐'] = I['🔒'];
  I['🎁'] = mk((g) => `<rect x="10" y="26" width="44" height="32" rx="3" fill="${g('#f87171', '#b91c1c')}" ${O}/><rect x="6" y="18" width="52" height="12" rx="3" fill="${g('#fca5a5', '#dc2626')}" ${O}/><path d="M32,18 L32,58" stroke="#facc15" stroke-width="7"/><path d="M32,18 C24,6 12,10 18,18 Z M32,18 C40,6 52,10 46,18Z" fill="#facc15" ${o}/>`);
  I['✅'] = mk((g) => `<rect x="6" y="6" width="52" height="52" rx="12" fill="${g('#4ade80', '#15803d')}" ${O}/><path d="M18,33 L28,43 L47,22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`);
  I['✓'] = I['✅'];
  I['💰'] = mk((g, r) => `<path d="M24,14 L40,14 L36,22 Q54,30 52,46 Q50,58 32,58 Q14,58 12,46 Q10,30 28,22Z" fill="${r('#e7c58f', '#92400e')}" ${O}/><path d="M24,14 L40,14" ${O}/><path d="M26,20 Q32,24 38,20" fill="none" stroke="#7c2d12" stroke-width="3"/><circle cx="32" cy="42" r="9" fill="${g('#fef08a', '#d97706')}" ${o}/><path d="M32,36 L32,48" stroke="#92400e" stroke-width="2"/>`);
  I['🪙'] = mk((g) => `<ellipse cx="32" cy="34" rx="22" ry="22" fill="${g('#fef08a', '#b45309')}" ${O}/><circle cx="32" cy="34" r="15" fill="none" stroke="#92400e" stroke-width="2"/><path d="${star(32, 34, 9, 4)}" fill="#fde68a" ${o}/>`);
  I['🏆'] = mk((g) => `<path d="M18,8 L46,8 L44,30 Q42,40 32,42 Q22,40 20,30Z" fill="${g('#fef08a', '#ca8a04')}" ${O}/><path d="M18,12 Q6,12 8,22 Q10,30 20,30 M46,12 Q58,12 56,22 Q54,30 44,30" fill="none" stroke="#ca8a04" stroke-width="4"/><path d="M28,42 L36,42 L36,50 L28,50Z" fill="#ca8a04" ${o}/><rect x="18" y="50" width="28" height="8" rx="2" fill="${g('#a16207', '#713f12')}" ${O}/><path d="${star(32, 22, 7, 3)}" fill="#fff" opacity=".8"/>`);
  I['⚠️'] = mk((g) => `<path d="M32,6 L60,56 L4,56Z" fill="${g('#fde047', '#f59e0b')}" ${O}/><path d="M32,22 L32,40" stroke="#1c1917" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="48" r="3.5" fill="#1c1917"/>`);
  I['🐾'] = mk((g) => `<g fill="${g('#d6a77a', '#7c4a1e')}" ${o}><ellipse cx="32" cy="42" rx="13" ry="11"/><ellipse cx="14" cy="28" rx="6" ry="8"/><ellipse cx="25" cy="17" rx="6" ry="8"/><ellipse cx="39" cy="17" rx="6" ry="8"/><ellipse cx="50" cy="28" rx="6" ry="8"/></g>`);
  I['💥'] = mk((g) => `<path d="${star(32, 32, 29, 13, 9)}" fill="${g('#fde047', '#ea580c')}" ${O}/><path d="${star(32, 32, 14, 7, 7)}" fill="#fff7ed"/>`);
  I['🔨'] = mk((g) => `<path d="M30,26 L36,26 L40,60 L26,60Z" fill="${g('#d6a77a', '#7c4a1e')}" ${O} transform="rotate(-35 32 40)"/><rect x="10" y="8" width="38" height="16" rx="3" fill="${g('#e2e8f0', '#64748b')}" ${O} transform="rotate(-35 30 16)"/>`);
  I['🏰'] = mk((g) => `<path d="M8,58 L8,26 L16,26 L16,20 L22,20 L22,26 L26,26 L26,16 L38,16 L38,26 L42,26 L42,20 L48,20 L48,26 L56,26 L56,58Z" fill="${g('#cbd5e1', '#64748b')}" ${O}/><path d="M26,58 L26,44 A6,6 0 0 1 38,44 L38,58Z" fill="#3f2a14" ${o}/><path d="M32,16 L32,4 L44,8 L32,12" fill="#dc2626" ${o}/><rect x="13" y="34" width="6" height="8" fill="#1e293b"/><rect x="45" y="34" width="6" height="8" fill="#1e293b"/>`);
  I['✨'] = mk(() => `<g fill="#fde047" ${o}><path d="${sparkle(24, 30, 18)}"/><path d="${sparkle(48, 16, 9)}"/><path d="${sparkle(48, 48, 8)}"/></g>`);
  I['👹'] = mk((g, r) => face(g, r, '#f87171', '#991b1b', `<path d="M12,20 L8,4 L22,14Z M52,20 L56,4 L42,14Z" fill="#f5f5f4" ${o}/><path d="M18,26 L28,30 L18,32Z M46,26 L36,30 L46,32Z" fill="#fde047" ${o}/><path d="M18,44 Q32,36 46,44 Q32,54 18,44Z" fill="#450a0a" ${o}/><path d="M24,44 L26,49 L28,44 M36,44 L38,49 L40,44" fill="#fff"/>`));
  I['🧩'] = mk((g) => `<path d="M10,20 L24,20 A6,6 0 1 1 36,20 L50,20 L50,32 A6,6 0 1 1 50,44 L50,56 L10,56 L10,44 A6,6 0 1 0 10,32Z" fill="${g('#c084fc', '#6d28d9')}" ${O}/>`);
  I['❄️'] = mk(() => `<g stroke="#e0f2fe" stroke-width="5" stroke-linecap="round"><path d="M32,6 L32,58 M9,19 L55,45 M9,45 L55,19"/><path d="M26,10 L32,16 L38,10 M26,54 L32,48 L38,54 M10,27 L18,24 L14,16 M54,37 L46,40 L50,48 M10,37 L18,40 L14,48 M54,27 L46,24 L50,16"/></g><g stroke="#0284c7" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M32,6 L32,58 M9,19 L55,45 M9,45 L55,19"/></g>`);
  I['🥶'] = I['❄️'];
  I['⚡'] = mk((g) => `<path d="M38,4 L14,36 L30,36 L24,60 L50,24 L34,24Z" fill="${g('#fef08a', '#eab308')}" ${O}/>`);
  I['🎰'] = mk((g) => `<circle cx="32" cy="32" r="26" fill="#7c2d12" ${O}/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a0 = i * Math.PI / 4, a1 = a0 + Math.PI / 4; return `<path d="M32,32 L${32 + Math.cos(a0) * 22},${32 + Math.sin(a0) * 22} A22,22 0 0 1 ${32 + Math.cos(a1) * 22},${32 + Math.sin(a1) * 22}Z" fill="${['#f87171', '#facc15', '#4ade80', '#60a5fa', '#c084fc', '#fb923c', '#f472b6', '#2dd4bf'][i]}"/>`; }).join('')}<circle cx="32" cy="32" r="6" fill="${g('#fef08a', '#ca8a04')}" ${o}/><path d="M32,2 L37,12 L27,12Z" fill="#fde047" ${o}/>`);
  I['❤️'] = mk((g) => `<path d="M32,56 C10,40 4,30 8,18 C12,8 26,6 32,18 C38,6 52,8 56,18 C60,30 54,40 32,56Z" fill="${g('#fb7185', '#be123c')}" ${O}/><path d="M16,18 Q18,12 24,13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`);
  I['💔'] = mk((g) => `<path d="M30,54 C10,40 4,30 8,18 C12,8 26,6 30,16 L26,28 L32,34 L26,44Z" fill="${g('#fb7185', '#be123c')}" ${O}/><path d="M36,54 C54,40 60,30 56,18 C52,8 38,6 34,16 L38,28 L32,34 L38,44Z" fill="${g('#fb7185', '#be123c')}" ${O}/>`);
  I['⏳'] = mk((g) => `<rect x="14" y="4" width="36" height="6" rx="2" fill="#92400e" ${o}/><rect x="14" y="54" width="36" height="6" rx="2" fill="#92400e" ${o}/><path d="M18,10 L46,10 Q46,26 34,32 Q46,38 46,54 L18,54 Q18,38 30,32 Q18,26 18,10Z" fill="#e0f2fe" fill-opacity=".6" ${O}/><path d="M24,18 L40,18 Q38,26 32,30 Q26,26 24,18Z M22,52 Q24,42 32,40 Q40,42 42,52Z" fill="#facc15"/>`);
  I['⏱️'] = mk((g) => `<rect x="27" y="2" width="10" height="7" rx="2" fill="#94a3b8" ${o}/><circle cx="32" cy="36" r="24" fill="${g('#f8fafc', '#cbd5e1')}" ${O}/><path d="M32,36 L32,20 M32,36 L42,42" stroke="#dc2626" stroke-width="3.5" stroke-linecap="round"/>`);
  I['💀'] = mk((g) => `<path d="M32,6 C14,6 8,20 10,32 C11,40 16,42 18,46 L18,56 L46,56 L46,46 C48,42 53,40 54,32 C56,20 50,6 32,6Z" fill="${g('#fafaf9', '#a8a29e')}" ${O}/><ellipse cx="23" cy="32" rx="6" ry="7" fill="#1c1917"/><ellipse cx="41" cy="32" rx="6" ry="7" fill="#1c1917"/><path d="M32,38 L29,45 L35,45Z" fill="#1c1917"/><path d="M24,50 L24,56 M30,50 L30,56 M36,50 L36,56 M42,50 L42,56" stroke="#1c1917" stroke-width="2"/>`);
  I['☠️'] = mk((g) => `<path d="M8,48 L56,60 M56,48 L8,60" stroke="#e7e5e4" stroke-width="6" stroke-linecap="round"/><path d="M32,4 C16,4 10,16 12,26 C13,33 17,35 19,38 L19,46 L45,46 L45,38 C47,35 51,33 52,26 C54,16 48,4 32,4Z" fill="${g('#fafaf9', '#a8a29e')}" ${O}/><ellipse cx="24" cy="26" rx="5.5" ry="6.5" fill="#1c1917"/><ellipse cx="40" cy="26" rx="5.5" ry="6.5" fill="#1c1917"/><path d="M32,32 L29,38 L35,38Z" fill="#1c1917"/>`);
  I['👑'] = mk((g) => `<path d="M6,20 L18,34 L32,10 L46,34 L58,20 L52,52 L12,52Z" fill="${g('#fef08a', '#ca8a04')}" ${O}/><rect x="12" y="46" width="40" height="8" rx="2" fill="#a16207" ${o}/><circle cx="32" cy="34" r="5" fill="#dc2626" ${o}/><circle cx="20" cy="42" r="3" fill="#3b82f6"/><circle cx="44" cy="42" r="3" fill="#22c55e"/>`);
  I['📜'] = mk((g) => `<path d="M14,10 L46,10 Q52,10 52,16 L52,54 L20,54 Q14,54 14,48Z" fill="${g('#fef3c7', '#d6b25e')}" ${O}/><path d="M14,10 Q8,10 8,16 Q8,22 14,22 L20,22" fill="${g('#fde68a', '#b45309')}" ${O}/><path d="M22,24 L44,24 M22,32 L44,32 M22,40 L38,40" stroke="#92400e" stroke-width="3" stroke-linecap="round"/>`);
  I['📋'] = I['📜'];
  I['☁️'] = mk((g) => `<path d="M16,48 Q4,48 6,36 Q8,26 18,28 Q20,14 34,14 Q48,14 48,28 Q60,28 58,40 Q56,48 46,48Z" fill="${g('#ffffff', '#bfdbfe')}" ${O}/>`);
  I['⬆️'] = mk((g) => `<rect x="6" y="6" width="52" height="52" rx="12" fill="${g('#60a5fa', '#1d4ed8')}" ${O}/><path d="M32,14 L48,32 L38,32 L38,50 L26,50 L26,32 L16,32Z" fill="#fff"/>`);
  I['💨'] = mk(() => `<g fill="none" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round"><path d="M6,22 L40,22 Q50,22 50,14 Q50,8 44,8"/><path d="M6,34 L50,34 Q60,34 60,42 Q60,50 52,50"/><path d="M14,46 L34,46"/></g>`);
  I['👤'] = mk((g) => `<path d="M14,58 Q14,40 32,40 Q50,40 50,58Z" fill="${g('#60a5fa', '#1e3a8a')}" ${O}/><path d="M18,24 Q18,8 32,8 Q46,8 46,24 L46,34 L18,34Z" fill="${g('#e2e8f0', '#64748b')}" ${O}/><path d="M22,22 L42,22 L42,28 L22,28Z" fill="#0f172a"/><path d="M32,8 L32,2" stroke="#dc2626" stroke-width="4" stroke-linecap="round"/>`);
  I['💾'] = mk((g) => `<path d="M8,8 L48,8 L56,16 L56,56 L8,56Z" fill="${g('#60a5fa', '#1e3a8a')}" ${O}/><rect x="16" y="8" width="26" height="16" fill="#e2e8f0" ${o}/><rect x="34" y="11" width="5" height="10" fill="#1e3a8a"/><rect x="16" y="34" width="32" height="22" fill="#f8fafc" ${o}/>`);
  I['📅'] = mk((g) => `<rect x="8" y="10" width="48" height="46" rx="5" fill="#f8fafc" ${O}/><rect x="8" y="10" width="48" height="14" rx="5" fill="${g('#f87171', '#b91c1c')}" ${O}/><path d="M20,6 L20,16 M44,6 L44,16" stroke="#475569" stroke-width="4" stroke-linecap="round"/><text x="32" y="49" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="20" fill="#1e293b">7</text>`);
  I['🪄'] = mk((g) => `<path d="M10,54 L40,24" stroke="#1c1917" stroke-width="8" stroke-linecap="round"/><path d="M10,54 L40,24" stroke="${g('#a855f7', '#4c1d95', false)}" stroke-width="5" stroke-linecap="round"/><path d="${sparkle(46, 18, 12)}" fill="#fde047" ${o}/><circle cx="56" cy="34" r="2.5" fill="#fde047"/><circle cx="28" cy="10" r="2" fill="#fde047"/>`);
  I['🗡️'] = mk((g) => `<g transform="rotate(45 32 32)"><path d="M32,2 L37,10 L37,40 L27,40 L27,10Z" fill="${g('#f1f5f9', '#94a3b8', false)}" ${O}/><rect x="20" y="40" width="24" height="5" rx="2" fill="#ca8a04" ${o}/><rect x="29" y="45" width="6" height="12" fill="#7c2d12" ${o}/></g>`);
  I['🐺'] = mk((g) => `<path d="M10,8 L22,22 L42,22 L54,8 L52,34 Q50,48 40,54 L32,58 L24,54 Q14,48 12,34Z" fill="${g('#cbd5e1', '#475569')}" ${O}/><path d="M24,36 L28,32 L24,30Z M40,36 L36,32 L40,30Z" fill="#fde047"/><path d="M26,48 L32,54 L38,48 Q32,44 26,48Z" fill="#1c1917"/>`);
  I['📱'] = mk((g) => `<rect x="16" y="4" width="32" height="56" rx="6" fill="#1e293b" ${O}/><rect x="20" y="10" width="24" height="40" rx="2" fill="${g('#7dd3fc', '#1d4ed8')}"/><circle cx="32" cy="54" r="2.5" fill="#94a3b8"/>`);
  I['📳'] = mk((g) => `<rect x="20" y="6" width="24" height="52" rx="5" fill="#1e293b" ${O}/><rect x="23" y="12" width="18" height="36" rx="2" fill="${g('#7dd3fc', '#1d4ed8')}"/><path d="M12,20 L8,26 L12,32 L8,38 M52,20 L56,26 L52,32 L56,38" fill="none" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>`);
  I['⛶'] = mk(() => `<g fill="none" stroke="#e2e8f0" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M8,22 L8,8 L22,8 M42,8 L56,8 L56,22 M56,42 L56,56 L42,56 M22,56 L8,56 L8,42"/></g>`);
  I['⚙️'] = mk((g) => `<path d="${star(32, 32, 28, 22, 8, 0)}" fill="${g('#e2e8f0', '#64748b')}" ${O}/><circle cx="32" cy="32" r="16" fill="${g('#cbd5e1', '#475569')}" ${o}/><circle cx="32" cy="32" r="7" fill="#1e293b"/>`);
  I['🎒'] = mk((g) => `<path d="M22,12 Q22,4 32,4 Q42,4 42,12" fill="none" stroke="#7c2d12" stroke-width="4"/><path d="M12,24 Q12,12 32,12 Q52,12 52,24 L52,54 Q52,60 46,60 L18,60 Q12,60 12,54Z" fill="${g('#f87171', '#991b1b')}" ${O}/><rect x="20" y="36" width="24" height="16" rx="4" fill="${g('#fca5a5', '#b91c1c')}" ${o}/><rect x="29" y="34" width="6" height="8" rx="2" fill="#facc15" ${o}/>`);
  I['🗺️'] = mk((g) => `<path d="M6,14 L22,8 L42,14 L58,8 L58,50 L42,56 L22,50 L6,56Z" fill="${g('#fef3c7', '#e7c58f')}" ${O}/><path d="M22,8 L22,50 M42,14 L42,56" stroke="#a16207" stroke-width="1.5"/><path d="M14,40 Q24,30 30,36 Q38,44 48,26" fill="none" stroke="#dc2626" stroke-width="3" stroke-dasharray="4 3"/><path d="M44,22 L52,30 M52,22 L44,30" stroke="#dc2626" stroke-width="3.5" stroke-linecap="round"/>`);
  I['🔑'] = mk((g) => `<circle cx="20" cy="22" r="13" fill="${g('#fef08a', '#ca8a04')}" ${O}/><circle cx="20" cy="22" r="5" fill="#3b2405"/><path d="M28,30 L54,56 M42,44 L48,38 M48,50 L54,44" stroke="#ca8a04" stroke-width="6" stroke-linecap="round"/>`);
  I['✏️'] = mk((g) => `<g transform="rotate(45 32 32)"><rect x="26" y="4" width="12" height="40" fill="${g('#fde047', '#f59e0b', false)}" ${O}/><path d="M26,44 L38,44 L32,58Z" fill="#fde68a" ${O}/><path d="M30,53 L34,53 L32,58Z" fill="#1c1917"/><rect x="26" y="2" width="12" height="7" rx="2" fill="#f472b6" ${o}/></g>`);
  I['🌑'] = mk((g, r) => `<circle cx="32" cy="32" r="24" fill="${r('#6b21a8', '#1e1033')}" ${O}/><circle cx="24" cy="26" r="4" fill="#4c1d95"/><circle cx="38" cy="40" r="6" fill="#4c1d95"/>`);
  I['🎯'] = mk(() => `<circle cx="32" cy="32" r="26" fill="#f8fafc" ${O}/><circle cx="32" cy="32" r="19" fill="#dc2626"/><circle cx="32" cy="32" r="12" fill="#f8fafc"/><circle cx="32" cy="32" r="6" fill="#dc2626"/><path d="M32,32 L56,8" stroke="#1c1917" stroke-width="3"/><path d="M50,6 L58,6 L58,14" fill="none" stroke="#1c1917" stroke-width="3"/>`);
  I['👁️'] = mk((g, r) => `<path d="M4,32 Q32,4 60,32 Q32,60 4,32Z" fill="#f8fafc" ${O}/><circle cx="32" cy="32" r="12" fill="${r('#93c5fd', '#1d4ed8')}" ${o}/><circle cx="32" cy="32" r="5" fill="#0f172a"/><circle cx="28" cy="28" r="2.5" fill="#fff"/>`);
  I['🦂'] = mk((g) => `<g ${o}><ellipse cx="30" cy="42" rx="14" ry="9" fill="${g('#fb923c', '#9a3412')}"/><path d="M40,38 Q54,34 54,20 Q54,10 46,10 Q50,16 46,20" fill="none" stroke="#9a3412" stroke-width="6" stroke-linecap="round"/><path d="M44,8 L50,4 L48,12Z" fill="#fde047"/><path d="M16,40 Q6,34 8,26 M16,46 Q6,52 8,58 M20,34 L14,26 M20,50 L14,58" stroke="#9a3412" stroke-width="3"/></g>`);
  I['👻'] = mk((g) => `<path d="M14,34 Q14,8 32,8 Q50,8 50,34 L50,58 L44,52 L38,58 L32,52 L26,58 L20,52 L14,58Z" fill="${g('#f5f3ff', '#c4b5fd')}" ${O}/><ellipse cx="25" cy="30" rx="4" ry="6" fill="#2e1065"/><ellipse cx="39" cy="30" rx="4" ry="6" fill="#2e1065"/><ellipse cx="32" cy="42" rx="4" ry="4.5" fill="#2e1065"/>`);
  I['🆕'] = mk((g) => `<rect x="4" y="16" width="56" height="32" rx="7" fill="${g('#60a5fa', '#1d4ed8')}" ${O}/><text x="32" y="39" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="17" fill="#fff">NEW</text>`);
  I['🚪'] = mk((g) => `<rect x="14" y="6" width="36" height="54" rx="3" fill="${g('#a16207', '#713f12')}" ${O}/><rect x="20" y="12" width="24" height="18" rx="2" fill="none" stroke="#451a03" stroke-width="2"/><rect x="20" y="34" width="24" height="20" rx="2" fill="none" stroke="#451a03" stroke-width="2"/><circle cx="42" cy="34" r="3" fill="#facc15" ${o}/>`);
  I['🏅'] = medal('1', '#fef08a', '#ca8a04');
  I['🥇'] = medal('1', '#fef08a', '#ca8a04');
  I['🥈'] = medal('2', '#f8fafc', '#94a3b8');
  I['🥉'] = medal('3', '#fed7aa', '#c2410c');
  I['🔁'] = mk(() => `<g fill="none" stroke="#e2e8f0" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M12,30 Q12,16 26,16 L48,16"/><path d="M42,8 L50,16 L42,24"/><path d="M52,34 Q52,48 38,48 L16,48"/><path d="M22,40 L14,48 L22,56"/></g>`);
  I['🔄'] = I['🔁'];
  I['🎨'] = mk((g) => `<path d="M32,6 Q58,6 58,30 Q58,40 48,40 L42,40 Q36,40 38,48 Q40,58 30,58 Q6,58 6,32 Q6,6 32,6Z" fill="${g('#fef3c7', '#d6b25e')}" ${O}/><circle cx="20" cy="22" r="5" fill="#ef4444"/><circle cx="34" cy="16" r="5" fill="#facc15"/><circle cx="46" cy="24" r="5" fill="#22c55e"/><circle cx="18" cy="38" r="5" fill="#3b82f6"/>`);
  I['📦'] = mk((g) => `<path d="M8,20 L32,8 L56,20 L56,46 L32,58 L8,46Z" fill="${g('#e7c58f', '#a16207')}" ${O}/><path d="M8,20 L32,32 L56,20 M32,32 L32,58" fill="none" stroke="#713f12" stroke-width="2"/><path d="M20,14 L44,26 L44,34" fill="none" stroke="#fef3c7" stroke-width="3"/>`);
  I['🧰'] = mk((g) => `<path d="M24,16 L24,10 L40,10 L40,16" fill="none" stroke="#475569" stroke-width="4"/><rect x="6" y="16" width="52" height="40" rx="5" fill="${g('#f87171', '#991b1b')}" ${O}/><rect x="6" y="28" width="52" height="5" fill="#450a0a"/><rect x="28" y="26" width="8" height="9" rx="1" fill="#facc15" ${o}/>`);
  I['🌋'] = mk((g) => `<path d="M4,58 L24,20 L40,20 L60,58Z" fill="${g('#78350f', '#292524')}" ${O}/><path d="M24,20 L28,30 L32,24 L36,32 L40,20Z" fill="#f97316"/><path d="M28,16 Q24,8 28,4 M36,14 Q40,8 36,2" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round"/><path d="M30,24 Q28,40 22,50 M34,26 Q38,40 44,52" fill="none" stroke="#f97316" stroke-width="3"/>`);
  I['🐉'] = mk((g) => `<path d="M10,40 Q8,20 26,16 L40,10 L36,18 Q54,18 56,32 L48,32 L44,40 L34,40 Q30,52 18,56 Q22,46 18,42Z" fill="${g('#f87171', '#991b1b')}" ${O}/><circle cx="40" cy="24" r="3" fill="#fde047" ${o}/><path d="M26,16 L22,4 L32,14 M34,12 L34,2 L40,10" fill="#7f1d1d" ${o}/><path d="M48,32 L52,36 M44,32 L46,37" stroke="#fff" stroke-width="2"/>`);
  I['🐲'] = I['🐉'];
  I['🩸'] = mk((g) => `<path d="M32,4 C40,18 50,28 50,40 A18,18 0 0 1 14,40 C14,28 24,18 32,4Z" fill="${g('#f87171', '#991b1b')}" ${O}/><path d="M22,40 Q22,32 28,28" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`);
  I['⏸'] = mk(() => `<rect x="14" y="10" width="13" height="44" rx="3" fill="#e2e8f0" ${O}/><rect x="37" y="10" width="13" height="44" rx="3" fill="#e2e8f0" ${O}/>`);
  I['▶'] = mk(() => `<path d="M16,8 L54,32 L16,56Z" fill="#e2e8f0" ${O}/>`);
  I['🏪'] = mk((g) => `<rect x="8" y="28" width="48" height="30" fill="#f8fafc" ${O}/><path d="M4,14 L60,14 L60,28 L4,28Z" fill="#dc2626" ${O}/><path d="M12,14 L12,28 M24,14 L24,28 M36,14 L36,28 M48,14 L48,28" stroke="#fff" stroke-width="5"/><path d="M4,28 Q10,34 16,28 Q22,34 28,28 Q34,34 40,28 Q46,34 52,28 Q58,34 60,28" fill="#dc2626" ${o}/><rect x="14" y="38" width="14" height="20" fill="#a16207" ${o}/><rect x="34" y="38" width="16" height="12" fill="#7dd3fc" ${o}/><rect x="8" y="6" width="48" height="8" rx="2" fill="#facc15" ${o}/>`);
  I['🛒'] = mk((g) => `<path d="M4,10 L14,10 L20,40 L52,40 L58,18 L16,18" fill="none" stroke="#e2e8f0" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><path d="M18,26 L54,26 L50,38 L21,38Z" fill="${g('#facc15', '#ca8a04')}"/><circle cx="24" cy="50" r="5" fill="#e2e8f0" ${o}/><circle cx="48" cy="50" r="5" fill="#e2e8f0" ${o}/>`);
  I['🎮'] = mk((g) => `<path d="M14,20 L50,20 Q60,20 60,34 Q60,52 50,52 Q44,52 40,44 L24,44 Q20,52 14,52 Q4,52 4,34 Q4,20 14,20Z" fill="${g('#64748b', '#1e293b')}" ${O}/><path d="M16,30 L16,40 M11,35 L21,35" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="44" cy="31" r="3.5" fill="#ef4444"/><circle cx="50" cy="38" r="3.5" fill="#22c55e"/>`);
  I['🏳️'] = mk(() => `<path d="M12,4 L12,60" stroke="#78716c" stroke-width="5" stroke-linecap="round"/><path d="M14,8 Q26,2 36,8 Q46,14 56,8 L56,34 Q46,40 36,34 Q26,28 14,34Z" fill="#f8fafc" ${O}/>`);
  I['🏁'] = mk(() => `<path d="M12,4 L12,60" stroke="#78716c" stroke-width="5" stroke-linecap="round"/><path d="M14,8 L56,8 L56,36 L14,36Z" fill="#f8fafc" ${O}/><path d="M14,8 L24,8 L24,15 L14,15Z M34,8 L44,8 L44,15 L34,15Z M24,15 L34,15 L34,22 L24,22Z M44,15 L56,15 L56,22 L44,22Z M14,22 L24,22 L24,29 L14,29Z M34,22 L44,22 L44,29 L34,29Z M24,29 L34,29 L34,36 L24,36Z M44,29 L56,29 L56,36 L44,36Z" fill="#1c1917"/>`);
  I['🏠'] = mk((g) => `<path d="M6,30 L32,8 L58,30" fill="none" stroke="#7f1d1d" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12,28 L32,12 L52,28 L52,58 L12,58Z" fill="${g('#fef3c7', '#d6b25e')}" ${O}/><rect x="26" y="40" width="12" height="18" fill="#7c2d12" ${o}/><rect x="16" y="34" width="8" height="8" fill="#7dd3fc" ${o}/>`);
  I['☀️'] = mk((g, r) => `<g stroke="#f59e0b" stroke-width="5" stroke-linecap="round">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * Math.PI / 4; return `<path d="M${32 + Math.cos(a) * 20},${32 + Math.sin(a) * 20} L${32 + Math.cos(a) * 28},${32 + Math.sin(a) * 28}"/>`; }).join('')}</g><circle cx="32" cy="32" r="14" fill="${r('#fef9c3', '#f59e0b')}" ${O}/>`);
  I['🟢'] = dot('#22c55e'); I['🔵'] = dot('#3b82f6'); I['🟣'] = dot('#a855f7'); I['🟠'] = dot('#f97316'); I['🔴'] = dot('#ef4444'); I['⚪'] = dot('#a1a1aa');
  I['🔮'] = mk((g, r) => `<circle cx="32" cy="28" r="22" fill="${r('#f5d0fe', '#7e22ce')}" ${O}/><path d="M16,50 L48,50 L52,60 L12,60Z" fill="${g('#a16207', '#713f12')}" ${O}/><path d="${sparkle(28, 24, 7)}" fill="#fff" opacity=".85"/>`);
  I['😈'] = mk((g, r) => face(g, r, '#c084fc', '#6b21a8', `<path d="M10,18 L6,4 L20,12Z M54,18 L58,4 L44,12Z" fill="#6b21a8" ${o}/><path d="M18,26 L28,32 M46,26 L36,32" stroke="#1c1917" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="35" r="3" fill="#1c1917"/><circle cx="40" cy="35" r="3" fill="#1c1917"/><path d="M20,44 Q32,54 44,44" fill="none" stroke="#1c1917" stroke-width="3.5" stroke-linecap="round"/>`));
  I['😡'] = mk((g, r) => face(g, r, '#fca5a5', '#dc2626', `<path d="M16,24 L28,30 M48,24 L36,30" stroke="#1c1917" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="35" r="3.5" fill="#1c1917"/><circle cx="40" cy="35" r="3.5" fill="#1c1917"/><path d="M22,50 Q32,42 42,50" fill="none" stroke="#1c1917" stroke-width="4" stroke-linecap="round"/>`));
  I['🗿'] = mk((g) => `<path d="M16,8 L46,6 L50,30 L46,58 L18,58 L14,30Z" fill="${g('#a8a29e', '#57534e')}" ${O}/><path d="M18,24 L30,24 M36,24 L48,24" stroke="#292524" stroke-width="4"/><path d="M32,24 L28,40 L36,40" fill="none" stroke="#292524" stroke-width="3"/><path d="M24,48 L40,48" stroke="#292524" stroke-width="4"/>`);
  I['💫'] = mk(() => `<path d="M32,32 m-4,0 a4,4 0 1 1 8,0 a8,8 0 1 1 -16,0 a12,12 0 1 1 24,0 a16,16 0 1 1 -32,0" fill="none" stroke="#fde047" stroke-width="4" stroke-linecap="round"/><path d="${star(52, 12, 8, 3.4)}" fill="#fde047" ${o}/>`);
  I['💣'] = mk((g, r) => `<circle cx="28" cy="38" r="20" fill="${r('#64748b', '#0f172a')}" ${O}/><rect x="34" y="14" width="10" height="8" rx="2" fill="#475569" ${o} transform="rotate(35 39 18)"/><path d="M42,14 Q48,6 54,8" fill="none" stroke="#a16207" stroke-width="3"/><path d="${sparkle(56, 8, 7)}" fill="#fde047"/><circle cx="20" cy="30" r="4" fill="#fff" opacity=".35"/>`);
  I['👋'] = mk((g) => `<path d="M20,58 Q8,50 10,36 L14,22 Q16,18 20,20 L22,30 L22,12 Q24,8 28,10 L30,28 L32,8 Q36,6 38,10 L38,28 L42,12 Q46,10 48,14 L46,36 Q52,30 56,34 Q50,46 44,54 Q38,60 20,58Z" fill="${g('#fde3c7', '#e7a77a')}" ${O}/>`);
  I['👈'] = mk((g) => `<path d="M4,30 L34,30 Q38,22 46,22 L56,22 L56,50 L40,50 Q34,50 32,44 L28,38 L8,38 Q2,38 4,30Z" fill="${g('#fde3c7', '#e7a77a')}" ${O}/>`);
  I['📥'] = mk((g) => `<path d="M6,36 L18,36 L22,44 L42,44 L46,36 L58,36 L58,56 L6,56Z" fill="${g('#94a3b8', '#334155')}" ${O}/><path d="M32,6 L32,30 M22,20 L32,30 L42,20" fill="none" stroke="#4ade80" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`);
  I['🎉'] = mk((g) => `<path d="M6,58 L18,18 L46,46Z" fill="${g('#fde047', '#f59e0b')}" ${O}/><path d="M12,40 L22,46 M16,28 L32,38" stroke="#dc2626" stroke-width="3"/><g stroke-width="4" stroke-linecap="round"><path d="M40,10 L44,4" stroke="#60a5fa"/><path d="M50,22 L58,18" stroke="#f472b6"/><path d="M30,8 Q36,14 32,20" stroke="#22c55e" fill="none"/></g><circle cx="54" cy="8" r="3" fill="#fde047"/><circle cx="56" cy="32" r="3" fill="#a855f7"/>`);
  I['✖️'] = mk(() => `<path d="M14,14 L50,50 M50,14 L14,50" stroke="#ef4444" stroke-width="9" stroke-linecap="round"/>`);
  I['🧙‍♂️'] = mk((g) => `<path d="M32,2 L48,34 L16,34Z" fill="${g('#818cf8', '#3730a3')}" ${O}/><path d="M8,34 L56,34" stroke="#3730a3" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="40" r="10" fill="#fde3c7" ${o}/><path d="M22,42 Q32,66 42,42 Q32,50 22,42Z" fill="#f8fafc" ${O}/><path d="${star(34, 20, 4, 1.8)}" fill="#fde047"/>`);
  I['🧙'] = I['🧙‍♂️'];
  I['🔊'] = mk((g) => `<path d="M8,24 L20,24 L34,10 L34,54 L20,40 L8,40Z" fill="${g('#e2e8f0', '#64748b')}" ${O}/><path d="M42,22 Q48,32 42,42 M48,14 Q60,32 48,50" fill="none" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round"/>`);
  I['🎵'] = mk(() => `<path d="M24,48 L24,12 L50,6 L50,42" fill="none" stroke="#e2e8f0" stroke-width="5" stroke-linejoin="round"/><ellipse cx="18" cy="48" rx="8" ry="6" fill="#e2e8f0" ${o}/><ellipse cx="44" cy="42" rx="8" ry="6" fill="#e2e8f0" ${o}/>`);
  I['⛑️'] = mk((g) => `<path d="M8,42 Q8,10 32,10 Q56,10 56,42Z" fill="${g('#e2e8f0', '#64748b')}" ${O}/><path d="M4,42 L60,42 L60,48 L4,48Z" fill="#475569" ${O}/><path d="M18,28 L46,28 L46,34 L18,34Z" fill="#0f172a"/><path d="M32,10 L32,2" stroke="#dc2626" stroke-width="4" stroke-linecap="round"/>`);
  I['🗑️'] = mk((g) => `<rect x="12" y="14" width="40" height="6" rx="2" fill="#94a3b8" ${O}/><path d="M26,14 L26,8 L38,8 L38,14" fill="none" ${O}/><path d="M16,20 L48,20 L44,58 L20,58Z" fill="${g('#cbd5e1', '#64748b')}" ${O}/><path d="M26,28 L27,50 M32,28 L32,50 M38,28 L37,50" stroke="#334155" stroke-width="2.5"/>`);
  I['🥷'] = mk((g, r) => face(g, r, '#475569', '#0f172a', `<rect x="12" y="26" width="40" height="12" rx="5" fill="#fde3c7"/><circle cx="24" cy="32" r="3" fill="#1c1917"/><circle cx="40" cy="32" r="3" fill="#1c1917"/><path d="M52,20 L60,14 M52,24 L60,26" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>`));
  I['🧟'] = mk((g, r) => face(g, r, '#fef3c7', '#a8a29e', `<path d="M10,22 L54,30 M10,38 L54,26 M12,48 L52,44" stroke="#78716c" stroke-width="3"/><circle cx="24" cy="33" r="4" fill="#dc2626"/><circle cx="40" cy="33" r="4" fill="#dc2626"/>`));
  I['🏹'] = mk((g) => `<path d="M14,6 Q52,10 56,50" fill="none" stroke="#92400e" stroke-width="5" stroke-linecap="round"/><path d="M14,6 L56,50" stroke="#e2e8f0" stroke-width="1.5"/><path d="M8,56 L44,20" stroke="#78350f" stroke-width="3"/><path d="M44,20 L48,10 L54,16Z" fill="#94a3b8" ${o}/><path d="M8,56 L6,48 M8,56 L16,58" stroke="#dc2626" stroke-width="3"/>`);
  I['🌲'] = mk((g) => `<path d="M32,4 L52,30 L42,30 L56,48 L8,48 L22,30 L12,30Z" fill="${g('#4ade80', '#166534')}" ${O}/><rect x="28" y="48" width="8" height="12" fill="#7c2d12" ${o}/>`);
  I['🏜️'] = mk((g) => `<circle cx="46" cy="16" r="8" fill="#fde047"/><path d="M2,48 Q18,30 34,44 Q46,34 62,44 L62,60 L2,60Z" fill="${g('#fcd34d', '#d97706')}" ${O}/><path d="M18,48 L18,30 M18,36 L12,32 M18,40 L24,34" stroke="#15803d" stroke-width="4" stroke-linecap="round"/>`);
  I['🏔️'] = mk((g) => `<path d="M2,58 L24,14 L36,34 L44,24 L62,58Z" fill="${g('#94a3b8', '#334155')}" ${O}/><path d="M24,14 L31,28 L26,26 L20,30 L18,26Z M44,24 L50,34 L44,32 L40,34Z" fill="#f8fafc"/>`);
  I['🍃'] = mk((g) => `<path d="M8,54 Q8,14 54,8 Q56,46 16,52Z" fill="${g('#86efac', '#15803d')}" ${O}/><path d="M10,54 Q30,34 46,16" fill="none" stroke="#14532d" stroke-width="2.5"/>`);
  I['🌀'] = mk(() => `<path d="M32,32 m0,-4 a4,4 0 1 1 -4,4 a8,8 0 1 1 8,8 a12,12 0 1 1 12,-12 a16,16 0 1 1 -16,-16 a20,20 0 1 1 -20,20" fill="none" stroke="#60a5fa" stroke-width="5" stroke-linecap="round"/>`);
  I['☄️'] = mk((g) => `<path d="M6,6 Q30,20 44,40" stroke="#fb923c" stroke-width="10" stroke-linecap="round" opacity=".5"/><path d="M14,8 Q32,22 44,40" stroke="#fde047" stroke-width="5" stroke-linecap="round" opacity=".7"/><circle cx="46" cy="44" r="12" fill="${g('#fed7aa', '#c2410c')}" ${O}/>`);
  I['👥'] = mk((g) => `<circle cx="22" cy="22" r="9" fill="${g('#93c5fd', '#1d4ed8')}" ${o}/><path d="M6,50 Q6,34 22,34 Q38,34 38,50Z" fill="${g('#93c5fd', '#1d4ed8')}" ${o}/><circle cx="42" cy="20" r="9" fill="${g('#c4b5fd', '#6d28d9')}" ${o}/><path d="M26,52 Q26,32 42,32 Q58,32 58,52Z" fill="${g('#c4b5fd', '#6d28d9')}" ${o}/>`);
  I['🌊'] = mk((g) => `<path d="M2,40 Q12,22 26,30 Q20,36 28,40 Q40,44 48,30 Q56,18 62,26 L62,60 L2,60Z" fill="${g('#7dd3fc', '#1d4ed8')}" ${O}/><path d="M6,50 Q16,44 26,50 Q36,56 46,50 Q54,46 60,50" fill="none" stroke="#e0f2fe" stroke-width="3"/>`);
  // Materiales, pociones y objetos: reutiliza sus dibujos
  const REUSE = { '🪵': 'madera', '🪨': 'piedra', '🔩': 'hierro', '💠': 'cristal', '🧈': 'oro', '🧊': 'cristal_hielo', '♦️': 'cristal_rojo', '⚱️': 'oro_oscuro', '🦷': 'colmillo_rey', '🔷': 'nucleo_hielo', '👕': 'ropa_viajero', '🦺': 'armadura_basica', '🧪': 'pocion', '⚗️': 'pocion_grande' };

  for (const k of Object.keys(REUSE)) REUSE[k.replace(/\uFE0F/g, '')] = REUSE[k];
  const cache = {};
  let uid = 0;
  /** HTML del icono para un emoji (o '' si no hay dibujo). */
  function html(e) {
    const k = e.replace(/️/g, '') in I ? e.replace(/️/g, '') : e;
    let s = I[k] || I[k + '️'] || null;
    if (!s && REUSE[e.replace(/️/g, '')]) return Icons.html(REUSE[e.replace(/️/g, '')]);
    if (!s && REUSE[e]) return Icons.html(REUSE[e]);
    if (!s) return '';
    const n = ++uid;
    return s.replace(/(id="|url\(#)q_/g, `$1q${n}_`);
  }
  // Normaliza las claves: guarda también la versión sin el selector de variante
  for (const k of Object.keys(I)) { const b = k.replace(/️/g, ''); if (!(b in I)) I[b] = I[k]; }
  const imgs = {};
  /** Imagen para dibujar el icono en un lienzo. */
  function image(e) {
    if (imgs[e] !== undefined) return imgs[e];
    const s = html(e);
    if (!s) return (imgs[e] = null);
    const im = new Image();
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.replace('<svg ', '<svg width="96" height="96" '));
    return (imgs[e] = im);
  }

  /* ---------- Cambio automático de emojis en la pantalla ---------- */
  const EMOJI = /(?:\p{Extended_Pictographic}(?:️|⃣)?(?:‍\p{Extended_Pictographic}️?)*|[⬅-⬇⬛⬜⭐⭕⏸-⏺▶◀⛶]️?)/gu;
  const KEEP = /^[\u2605\u2606\u2730-\u2737]/;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CANVAS', 'svg', 'SVG', 'OPTION']);
  /** Quita los emojis de un texto (para lo que se dibuja en el lienzo). */
  const strip = t => String(t).replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim();
  function swapNode(node) {
    const t = node.nodeValue;
    EMOJI.lastIndex = 0;
    if (!t || !EMOJI.test(t.replace(/[\u2605\u2606\u2730-\u2737]/g, ''))) return;   // solo estrellas: nada que cambiar
    EMOJI.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = EMOJI.exec(t))) {
      if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
      const svg = html(m[0]);
      if (svg) {
        const sp = document.createElement('span');
        sp.className = 'gi-wrap ui-ico';
        sp.innerHTML = svg;
        frag.appendChild(sp);
      } else if (KEEP.test(m[0])) frag.appendChild(document.createTextNode(m[0]));   // símbolos de texto (★) se quedan
      last = m.index + m[0].length;
    }
    if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentNode && !SKIP.has(root.parentNode.nodeName)) swapNode(root); return; }
    if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentNode && !SKIP.has(n.parentNode.nodeName) && !n.parentNode.closest('svg') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const list = [];
    while (tw.nextNode()) list.push(tw.currentNode);
    list.forEach(swapNode);
    // Atributos de texto que se ven (placeholder)
    root.querySelectorAll && root.querySelectorAll('[placeholder]').forEach(el => { const p = el.getAttribute('placeholder'); if (EMOJI.test(p)) el.setAttribute('placeholder', strip(p)); EMOJI.lastIndex = 0; });
  }
  let observer = null;
  function watch(root = document.body) {
    walk(root);
    if (observer) return;
    observer = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'characterData') { if (m.target.parentNode && !SKIP.has(m.target.parentNode.nodeName)) swapNode(m.target); }
        else m.addedNodes.forEach(walk);
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }
  return { html, image, strip, watch, has: e => !!(I[e] || I[e.replace(/️/g, '')] || REUSE[e.replace(/️/g, '')]) };
})();
