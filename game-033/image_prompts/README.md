# Hearthbound — Art Generation Prompts

Phase 4 calls for replacing the emoji/gradient stand-ins with real art (or, absent
that, a distinct painterly CSS treatment — which has been applied in the meantime;
see `#vn-stage::before` in `index.html` and the multi-stop gradients in
`js/story.js`'s `BACKGROUNDS`). This directory holds one ready-to-paste prompt file
per art asset so that work can be generated later without re-deriving context from
the story.

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

## Wiring instructions (for whoever picks this up later)

1. Generate each image from its prompt file.
2. Drop portraits in `game-033/assets/portraits/<key>.png` and backgrounds in
   `game-033/assets/backgrounds/<key>.png` (create the `assets/` folder — it
   doesn't exist yet since this game has shipped asset-free through Phase 4).
3. In `js/story.js`, add an `image: 'assets/portraits/<key>.png'` (or
   `backgrounds/...`) key alongside each `PORTRAITS`/`BACKGROUNDS` entry.
4. In `js/vnRenderer.js`'s `showNode()`, prefer `p.image`/`bg.image` when present
   (render an `<img>`/background-image) and fall back to the emoji/gradient
   otherwise, so partial art coverage doesn't break the rest of the game.
