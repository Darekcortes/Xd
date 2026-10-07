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

## Progresión y recompensas

- **Inicio suave**: las etapas 1 a 4 tienen enemigos más débiles y menos numerosos (la 1 es casi un tutorial,
  con consejos en pantalla). El primer jefe es duro pero justo y desde el mundo 2 la dificultad sube.
- **Primera mejora rápida**: la etapa 1 regala la Espada oxidada, la 2 la Armadura básica y la 3 la habilidad de fuego.
- **Habilidades**: 🔥 fuego al ganar la etapa 3, ❄️ hielo al vencer al Rey Lobo y ⚡ rayo al vencer a la Reina Escorpión.
  Se mejoran hasta el nivel 5 en 👤 Héroe con monedas y gemas (+20 % daño y -5 % recarga por nivel).
- **Resistencias**: los enemigos de hielo solo se ralentizan con ❄️ y reciben la mitad de daño; los de fuego
  reciben la mitad de daño de 🔥 y no se queman.
- **Jefes**: ningún golpe de jefe quita más del 22 % de tu vida (35 % para el resto de enemigos).
- **Horizontal**: al entrar en combate el juego pide pantalla completa en horizontal y, si el teléfono está
  vertical, pide girarlo (se puede jugar en vertical igualmente o desactivarlo en Ajustes).
- **Tickets de ruleta 🎟️**: cada etapa da un fragmento 🧩 (3 = 1 ticket); también salen de jefes, élites,
  combos, rachas, misiones y cofres. Un ticket gira cualquier ruleta desbloqueada.
- **Combo**: sube al derrotar enemigos seguidos y se pierde tras 4 s sin derrotar a nadie. Da +3 % de daño por nivel
  (máximo +30 %) y premios en x5, x10, x15, x20 y x30.
- **Élites**: 5-10 % de los enemigos (desde la etapa 2) tienen aura dorada, más vida y daño, y sueltan mejor botín.
- **Racha de victorias**: cada victoria seguida da +5 % de oro y XP (máximo +50 %) y tickets en x3, x5, x10, x15 y x20.
  Perder o abandonar la reinicia.
- **Misiones diarias**: 3 misiones al día y un cofre extra por completarlas todas.
- **Rangos del caballero**: Novato → Guerrero → Caballero → Veterano → Legendario → Señor del Caos.
  Cada rango cambia su aspecto (ribetes dorados, cruz en la capa, espada brillante, aura).
- **Metas en el menú**: el menú muestra lo que te falta para tu próxima meta (nivel, forja, ticket, jefe, misión).

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
js/sprites.js     dibujo del caballero y las criaturas: arte ilustrado del atlas
                  (assets/sprites.webp) con dibujos vectoriales de respaldo, botín y escenarios
assets/sprites.webp  atlas del arte ilustrado: caballero (reposo, tajo, estocada,
                  golpe fuerte) y 12 enemigos
js/battle.js      arena con movimiento libre, oleadas, IA de enemigos, ataques de jefes,
                  habilidades, esquiva, combos y botín
js/ui.js          menú, mapa, ruleta, forja, inventario, personaje y ajustes
js/main.js        arranque
```

## Cómo ampliarlo

Casi todo se añade editando `js/data.js`:

- **Nuevo mundo**: añade un objeto a `WORLDS` (enemigos, jefe, materiales, ruleta, cofre).
  Sus 5 etapas se generan solas y el mapa lo muestra automáticamente.
- **Nuevo enemigo o jefe**: entrada en `ENEMIES` con su `sprite` (forma y colores, y `art` si tiene
  cuadro en el atlas de `js/sprites.js`) y su `ai`
  (`melee`, `ranged`, `charger`, `tank`). Los jefes combinan los ataques
  `leap`, `slam`, `zones`, `lob`, `volley`, `breath`, `charge`, `spin` y `summon:<enemigo>`.
- **Nueva arma o armadura**: entrada en `ITEMS`; luego úsala en `RECIPES`, `WHEELS` o en `chestItems` de un mundo.
- **Nueva ruleta**: entrada en `WHEELS` con sus probabilidades (`odds`) y premios.
- **Nueva habilidad**: entrada en `SKILLS` y su efecto en `castSkill()` de `js/battle.js`
  (más su botón en `index.html`).
- **Dificultad**: ajusta `BALANCE` (crecimiento de vida/daño enemigo, XP, monedas, poder recomendado)
  y `EARLY_STAGES` (suavizado de las primeras etapas).
- **Recompensas**: `FIRST_CLEAR` (premios de primera victoria), `COMBO_REWARDS`, `STREAK`, `MISSIONS` y `RANKS`.

El progreso se guarda automáticamente en el navegador (`localStorage`). En **Ajustes** hay un botón para reiniciarlo.
