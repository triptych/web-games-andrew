# Frosty Fling

A Christmas launch game in vanilla HTML, CSS and JavaScript with Three.js (r128, loaded from cdnjs).

## Play
Open `index.html` in a browser, or serve the folder with any static server
(for example `npx serve .`). An internet connection is needed for Three.js and the Google Fonts.

## Controls
- Fling: tap, click, or press Space when the power needle is in the dashed zone.
- Slam: tap again mid-air.
- Snowball Bonanza: hold left/right side of the screen, drag, or use the arrow keys.
- Pause: the pause button, Esc, or P.

## Source
`index.html` is the built single-file game. The readable parts live in `src/`:

| File | Contents |
| --- | --- |
| `shell.html` | Title, CSS and HUD/menu markup |
| `js1_core.js` | Utilities, save, synthesized audio, renderer, snow shader, textures, mesh baking |
| `js2_models.js` | Procedural snowman forms and every prop and character |
| `js3_world.js` | Sky/aurora, mountains, ground and snowfall shaders, particles, biomes |
| `js4_fling.js` | Slingshot, physics, items, spawning, cameras |
| `js5_bonus.js` | Snowball Bonanza bonus round |
| `js6_ui.js` | Procedural UI art, screens, upgrades, input, main loop |

Run `sh src/build.sh` to rebuild `index.html` after editing.

Progress is saved in the browser's localStorage under `frosty-fling-v1`.
