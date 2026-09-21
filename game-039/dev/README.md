# Dev harnesses (not part of the game)

These run under Node with a stubbed DOM. They are how this game was verified
without a browser; none of them are loaded by `index.html`.

Run them from the `game-039/` directory:

| Command | What it checks |
|---|---|
| `node dev/check.mjs` | Every relative import resolves and every named import exists as an export. |
| `node dev/simtest.mjs` | The real physics: echo walls deflect motes, opposite-polarity knots capture them, the flux economy balances, waves resolve, save/load round-trips the exact board, generation is deterministic. |
| `node dev/rendertest.mjs` | Drives the actual render loop against a strict fake Canvas2D that throws on unknown methods, non-finite coordinates, undefined fill styles and `drawImage(undefined)`. Walks every screen and the save/load UI. |
| `node dev/balance.mjs` | Runs scripted bots of different skill levels and reports wave reached, score, chain and death rate, so the difficulty curve can be tuned against numbers. |
| `node dev/forceprobe.mjs` | Prints wake repulsion strength at various distances against the inward drift per wave. |

`balance.mjs` mirrors the wave state machine from `js/main.js` `stepGame()`. If
you change that loop, change it here too or the probe measures a game that does
not exist.
