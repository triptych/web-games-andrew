# Repo-level dev harness

Plain Node scripts, no build step, no test framework. Each newer game (037+) has its own `game-NNN/dev/` harness that plays the game properly. This folder holds checks that apply to **every** game.

| Command (from the repo root) | What it does |
|---|---|
| `node dev/smoketest.mjs` | Loads every game in real Chromium, at 1280×760 and on a touch-only 390×844 phone. It clicks or taps, presses Enter, Space, the arrows and WASD, and takes screenshots. A game fails on any console error, page error, failed request or HTTP error, if its `← Games` link is missing, off screen or covered, or if on the phone the page scrolls sideways or a canvas is clipped. |
| `NOSTORAGE=1 node dev/smoketest.mjs` | The same, with every `localStorage` access throwing a `SecurityError`, as it does when a browser blocks site data. A game must still boot and play; it just can't save. |

Options: `ONLY=game-001,game-016` runs only those games. `FROM=game-001 TO=game-036` runs a range. `VIEWS=desktop` or `VIEWS=phone` runs one size. `OUT` sets the screenshot folder (default `dev/shots/`). `BASE` sets the server (default `http://127.0.0.1:8000`).

It needs `playwright` and a static server:

```bash
python3 -m http.server 8000          # from the repo root, in another terminal
node dev/smoketest.mjs
```

Playwright installed globally? ESM ignores `NODE_PATH`, so link it in once with `mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright`.

No network to the CDNs? Several three.js games load r165 from unpkg or jsDelivr, and game-014 loads r128 from cdnjs. Fetch the packages once and the harness serves those requests from disk:

```bash
npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package
npm pack three@0.128.0 && tar xzf three-0.128.0.tgz && mv package dev/package-r128
```

Google Fonts requests are answered with an empty stylesheet, because every game falls back to a system font.

The smoke test is a floor, not a playtest. It catches a game that crashes on boot or on its first input, a 404 on an asset, a broken way back to the launcher, and a layout that does not fit a phone. It does not check that a game is fun or winnable.
