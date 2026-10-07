'use strict';
/* =====================================================================
   ARRANQUE DEL JUEGO
   ===================================================================== */
(function boot() {
  Game.load();
  Sprites.loadArt(() => UI.redrawArt());   // arte ilustrado (si no carga, se usan los dibujos clásicos)
  Battle.init();
  UI.bindEvents();
  UI.show('menu');
  if (!Game.S.stats.kills && Game.S.unlocked === 1) {
    UI.toast('⚔️ ¡Bienvenido, guerrero! Pulsa JUGAR para empezar tu aventura');
  }
  // Guarda también al salir o cambiar de pestaña (en el navegador y en la cuenta)
  const flush = () => { Game.save(true); Game.cloudWrite(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  // Conecta con la cuenta de Claude (si la hay) y después pide el nombre de usuario
  Game.connectCloud(UI.onCloud).finally(() => setTimeout(() => {
    if (!Game.S.username && UI.current !== 'battle' && document.getElementById('modal').hidden) UI.askUsername();
  }, 400));
})();
