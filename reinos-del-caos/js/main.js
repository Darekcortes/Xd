'use strict';
/* =====================================================================
   ARRANQUE DEL JUEGO
   ===================================================================== */
(function boot() {
  Game.load();
  Battle.init();
  UI.bindEvents();
  UI.show('menu');
  if (!Game.S.stats.kills && Game.S.unlocked === 1) {
    UI.toast('⚔️ ¡Bienvenido, guerrero! Pulsa JUGAR para empezar tu aventura');
  }
  // Guarda también al salir o cambiar de pestaña
  window.addEventListener('pagehide', () => Game.save(true));
})();
