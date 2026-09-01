# Hearthbound — Art Generation Prompts

Phase 4 called for replacing the emoji/gradient stand-ins with real art (or, absent
that, a distinct painterly CSS treatment, which shipped first as a stopgap; see
the multi-stop gradients still kept as a fallback in `js/story.js`'s
`BACKGROUNDS`/`PORTRAITS`). Real art has since been generated and wired in — see
"Status" below. This directory holds one ready-to-paste prompt file per art asset,
kept for provenance/regeneration.

**Target generator:** Nano Banana 2 (Gemini's image generation model). Prompts are
written as plain natural-language image-generation prompts — paste a file's
contents directly into the tool.

## Layout

- `portraits/` — one file per `PORTRAITS` entry in `js/story.js`, minus `narrator`
  (which has no character and doesn't need art). 9 files.
- `backgrounds/` — one file per `BACKGROUNDS` entry in `js/story.js`. 7 files.

## Shared style guidance (baked into every prompt)

- **Medium:** painterly digital illustration, soft brushwork, warm cozy-fantasy
  palette — think storybook illustration, not photorealism or anime.
- **Portraits:** bust/waist-up, three-quarter view, transparent or simple
  softly-blurred background so the game's own vignette/frame reads through,
  square-ish aspect ratio (suggest 1:1 or 4:5).
- **Backgrounds:** wide establishing shots, no characters in frame (characters are
  layered on top separately as portraits), landscape aspect ratio (suggest 16:9),
  moody lighting matching each location's current CSS gradient (given in each
  prompt as a hex reference so color grading stays consistent with the existing
  UI palette).

## Status: wired in

Real art has been generated and wired in:

- Backgrounds live in `game-033/assets/backgrounds/` (1376×768 PNGs): `bakery.png`,
  `cellar.png`, `shop_interior.png`, `village_square.png`, `whisperwood.png`,
  `whisperwood_edge.png`, `witchs_cabin.png`. Filenames don't all match the
  `BACKGROUNDS` keys 1:1 (`cellar.png` → `shop_cellar`, `witchs_cabin.png` →
  `witch_cottage`, `whisperwood.png` → `deep_whisperwood`) — see the `image:`
  path on each `BACKGROUNDS` entry in `js/story.js` for the actual mapping.
- Character portraits live in `game-033/assets/chars/` (300×300 JPG/PNG), one
  image per *character* rather than one per mood key in `PORTRAITS` — Mira has
  `mira.jpg`/`mira_smile.jpg`/`mira_worried.jpg`, Bramwell has
  `bramwell.png`/`bramwell_happy.jpg`/`bramwell_serious.jpg`, and Hollow (named
  "witch" in the filenames) has `witch.jpg`/`witch_happy.jpg`/`witch_serious.jpg`.
  Each `PORTRAITS` mood key in `js/story.js` points at whichever file's
  expression best matches that mood. `mira_tools.jpg` was generated but isn't
  currently used by any mood key (spare variant).
- `js/vnRenderer.js`'s `showNode()` prefers `p.image`/`bg.image` when present
  (renders as a CSS `background-image`) and falls back to the emoji/gradient
  otherwise, so partial art coverage never breaks the rest of the game.

If more art gets generated later (e.g. filling in `mira_tools` as its own mood,
or replacing a placeholder), just drop the file in `assets/chars/` or
`assets/backgrounds/` and point the matching entry's `image:` key at it — no
other wiring needed.
