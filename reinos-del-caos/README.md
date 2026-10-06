# ⚔️ Reinos del Caos

Juego de aventura, combate y progresión por etapas para navegador, pensado primero para celular.
Abre `index.html` y juega: no necesita servidor ni instalación (los scripts se cargan como archivos normales).

## Cómo se juega

1. **Mapa** → elige una etapa desbloqueada y entra.
2. **Combate** → arena en vista 3/4: arrastra el **joystick** para moverte en cualquier dirección,
   mantén ⚔️ para atacar (cada tercer golpe seguido es fuerte), pulsa 💨 para **rodar** (eres invulnerable
   mientras ruedas) y usa 🔥 ❄️ ⚡ cuando estén cargadas y 🧪 para curarte. Cada etapa tiene **oleadas**;
   el **combo** sube tu daño, los enemigos **élite** (aura dorada) dan más botín, y las cajas, vasijas y
   barriles se rompen y esconden oro, materiales y corazones. Golpear un proyectil lo devuelve.
   Los lobos embisten (línea roja), los gólems golpean el suelo, los slimes se dividen y los arqueros
   y magos disparan a distancia. Sal de las zonas rojas que marcan los jefes antes de que exploten.
3. **Recompensas** → XP, monedas, materiales y un cofre al terminar la etapa.
4. **Ruleta** → gasta materiales (o 💎) para girar. Cada mundo desbloquea una ruleta mejor.
5. **Forja** → fabrica armas y armaduras y mejóralas hasta el nivel 5.
6. **Personaje** → reparte los puntos que ganas al subir de nivel.

En computadora también funciona con teclado: WASD o flechas, Espacio/J atacar, Shift/K rodar, 1-2-3, Q y Esc.

## Contenido

| Mundo | Etapas | Enemigos | Jefe (etapa) | Ruleta |
|---|---|---|---|---|
| 🌲 Bosque | 1-5 | Slime, Lobo, Bandido | Rey Lobo (5) | Madera |
| 🏜️ Desierto | 6-10 | Escorpión, Momia, Arquero del desierto | Reina Escorpión (10) | Hierro |
| 🏔️ Montañas de Hielo | 11-15 | Lobo de hielo, Gólem de hielo, Guerrero congelado | Gólem de Hielo (15) | Hielo |
| 🌋 Volcán | 16-20 | Demonio, Criatura de fuego, Gólem de lava | Dragón Volcánico (20) | Volcánica |
| 🏰 Reino Oscuro | 21-25 | Caballero oscuro, Mago oscuro, Demonio, Criatura maldita | Caballero Maldito (25) | Legendaria |

Rarezas: ⚪ Común · 🟢 Poco común · 🔵 Raro · 🟣 Épico · 🟠 Legendario · 🔴 Mítico.
Al vencer por primera vez a los tres primeros jefes se desbloquean las habilidades de fuego, hielo y rayo.

## Estructura del código

```
index.html        pantallas y controles
css/style.css     estilos (responsive, primero celular)
js/data.js        TODO el contenido: rarezas, materiales, objetos, recetas,
                  habilidades, enemigos, jefes, ruletas, mundos y balance
js/audio.js       efectos de sonido sintetizados (Web Audio)
js/state.js       estado del jugador, guardado en localStorage, estadísticas y recompensas
js/sprites.js     dibujo en canvas del caballero, criaturas (lobos, escorpiones,
                  espectros, dragón, gólems...), botín y escenarios
js/battle.js      arena con movimiento libre, oleadas, IA de enemigos, ataques de jefes,
                  habilidades, esquiva, combos y botín
js/ui.js          menú, mapa, ruleta, forja, inventario, personaje y ajustes
js/main.js        arranque
```

## Cómo ampliarlo

Casi todo se añade editando `js/data.js`:

- **Nuevo mundo**: añade un objeto a `WORLDS` (enemigos, jefe, materiales, ruleta, cofre).
  Sus 5 etapas se generan solas y el mapa lo muestra automáticamente.
- **Nuevo enemigo o jefe**: entrada en `ENEMIES` con su `sprite` (forma y colores) y su `ai`
  (`melee`, `ranged`, `charger`, `tank`). Los jefes combinan los ataques
  `leap`, `slam`, `zones`, `lob`, `volley`, `breath`, `charge`, `spin` y `summon:<enemigo>`.
- **Nueva arma o armadura**: entrada en `ITEMS`; luego úsala en `RECIPES`, `WHEELS` o en `chestItems` de un mundo.
- **Nueva ruleta**: entrada en `WHEELS` con sus probabilidades (`odds`) y premios.
- **Nueva habilidad**: entrada en `SKILLS` y su efecto en `castSkill()` de `js/battle.js`
  (más su botón en `index.html`).
- **Dificultad**: ajusta `BALANCE` (crecimiento de vida/daño enemigo, XP, monedas, poder recomendado).

El progreso se guarda automáticamente en el navegador (`localStorage`). En **Ajustes** hay un botón para reiniciarlo.
