'use strict';
/* =====================================================================
   ARRANQUE DEL JUEGO
   ===================================================================== */
(function boot() {
  Game.load();
  if ((typeof UIcons !== 'undefined')) UIcons.watch(document.body);   // cambia los emojis por iconos dibujados
  Music.setEnabled(Game.S.settings.music);
  Sprites.loadArt(() => UI.redrawArt());   // arte ilustrado (si no carga, se usan los dibujos clásicos)
  Battle.init();
  UI.bindEvents();
  UI.show('menu');
  // Portada: se toca para empezar (y así también se activa el sonido)
  const started = UI.title();
  started.then(() => {
    // (sin cuenta ni nombre se muestra antes la bienvenida para crear cuenta)
    if (!Game.S.stats.kills && Game.S.unlocked === 1 && (Game.account.session || Game.S.username)) {
      UI.toast('⚔️ ¡Bienvenido, guerrero! Pulsa JUGAR para empezar tu aventura');
    }
  });
  // Guarda también al salir o cambiar de pestaña (en el navegador y en la cuenta)
  const flush = () => { Game.save(true); Game.cloudWrite(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  // Conecta con la cuenta (usuario y contraseña, o la de Claude) y, si no hay, ofrece crear una
  Promise.all([Game.connectCloud(UI.onCloud).catch(() => {}), started]).then(() => setTimeout(() => {
    const free = UI.current !== 'battle' && document.getElementById('modal').hidden;
    if (!Game.account.session && !Game.S.username && free) UI.askAccount();
    else if (free) UI.loginModal(true);   // premio diario
  }, 400));
  // App instalable: el service worker solo funciona en una web normal (https), no en el archivo ni dentro de Claude
  try {
    const web = (location.protocol === 'https:' || location.hostname === 'localhost') && !/claude|anthropic/.test(location.hostname);
    if ('serviceWorker' in navigator && web && window.top === window) navigator.serviceWorker.register('sw.js').catch(() => {});
  } catch (e) { /* no disponible */ }
})();
