# Colorverse

**Genre:** Cozy pixel colour-by-number adventure (mobile first)
**Engine:** Vanilla JavaScript + Canvas 2D, no asset files, no build step
**Status:** v2.0.0. A full rebuild; v1 (vector region fills) was scrapped.

## Concept

The Grey Hush has rolled across the Colorverse and washed five little worlds to grey. You are the new
Colorkeeper aboard the Prism, a lighthouse that learned to sail. Every mosaic is a grid of real pixels,
each with a number. Zoom in until you can see the numbers, pick a colour and paint the pixels back.
Restore a world's mosaics and the story sails on to the next world. Every pixel leaves a little Glimmer
behind, and Glimmer buys new Colorkeeper skills in the Constellation.

No timer, no fail state. Mistakes are shown and can be painted over.

## Core loop

1. The Star Chart shows the chapters. "Continue" goes to the next unfinished page.
2. A short scene introduces the page (who's grey, and why it matters).
3. Paint: pick a colour, tap or drag over its numbers. Zoom and pan freely.
4. Finishing a mosaic plays a reveal shimmer and a reward card with the Glimmer breakdown.
5. The after-scene plays and the story moves to the next page. When a chapter closes, it's back to the
   chart to see the new world open up.
6. Between pages, spend Glimmer in the Constellation.

## The story (5 chapters, 14 mosaics, plus 3 bonus sketches)

| Chapter | World | Mosaics | Who you meet |
|---|---|---|---|
| 1 | The Lighthouse Ship | Wick 16², Comet the Cat 20², The Prism 24² | Wick, the lantern lamplighter; Comet the ship's cat |
| 2 | Moonberry Grove | Moonberries 20², Glowcaps 24², Moonberry Dragon 32² | Mira, a small and very purple dragon |
| 3 | Starship Sprout | Seedling Pod 24², Bolt the Gardener 28², Starship Sprout 32² | Captain Fern; Bolt, who hates beige |
| 4 | Cloudtop Castle | Cloud Sheep 28², Sunwing 32², Cloudtop Castle 40² | Lady Aurelle the shepherd-knight; Sunwing the griffin |
| 5 | The Grey Hush | The Grey Hush 32², The Colorverse 48² | The Hush itself |

The twist: the Hush is a vast, soft grey moth that only wanted to be in the picture. You don't defeat
it, you paint it in all of its greys (Silver, Pewter, Smoke, Dove, Ash), and it becomes the Silver Dusk.
The finale mosaic is the whole Colorverse with everyone in it.

Dialogue portraits are crops of the mosaics, drawn grey until that character's mosaic is restored.
Bonus pages (Space Snail, Teacup Planet, Robot Koi) open with the Hidden Sketches skill.

## Painting

- Each mosaic is drawn in code with a small pixel-art language (`js/pixelart.js`): rects, ellipses,
  polygons, rings, ASCII stamps, outlines, rim shading, mirroring, clipping and seeded scatter, all
  sampled at pixel centres. The same grid gives the numbers, the thumbnails and the exported PNG.
- Unpainted pixels show a grey that keeps the picture's lights and darks. Pixels of the selected
  colour are shaded darker violet. Numbers appear from 15 px per pixel, grid lines from 7 px.
- A correct pixel is locked. A wrong pixel shows its colour washed out, with a white corner mark and
  its real number.
- Finishing a colour plays a chime and moves to the next colour that still has pixels left.
- Undo works per stroke (one drag, pour or burst) and puts back pixels, Glimmer, mistakes, streak and
  charges.

### Controls

| | Touch | Mouse / keyboard |
|---|---|---|
| Paint | tap, or drag (every pixel crossed) | click or drag |
| Zoom | pinch | wheel / trackpad pinch, + − buttons, `+` `-`, `F` fit |
| Pan | two-finger drag, or the ✥ Move tool | right or middle drag, Space + drag, arrows |
| Colours | tap a swatch | `1`–`9`, `0`, `[` `]` |
| Undo | ↶ | `Z`, Ctrl/Cmd+Z |

If a second finger lands within 260 ms of the first, the first finger's dab is undone (it was the
start of a pinch). After a pinch the remaining finger does nothing until every finger has lifted.

## Glimmer

- 1 per correct pixel (×1.25 with Glimmer Catcher, up to ×1.5 more with a Streak).
- Finishing a mosaic: +25% of its pixels. No mistakes: +20% more. Finishing a chapter: +120 × chapter.

## The Constellation (skill tree)

17 stars in three branches from the Keeper's Spark. A star needs the stars it hangs from.

| Brush (pink) | Insight (gold) | Wonder (mint) |
|---|---|---|
| Soft Bristles 150: plus-shaped brush | Lantern Light 120: the last ≤12 pixels of a colour glow at any zoom | Glimmer Catcher 140: +25% Glimmer |
| Broad Bristles 700: 3×3 brush | Seeker Wisp 450: fly to the nearest unpainted pixel of this colour | Streak Spark 700: a run of correct pixels builds to ×1.5 |
| Comet Brush 2000: round 5-wide brush | True Hand 900: the brush skips pixels that aren't this number | Freestyle Studio 800: repaint finished mosaics with any colours |
| Paint Pour 600: tap fills the connected area of one number | Star Map 1200: a minimap with the view and the missing pixels | Time-Lapse 900: replay a mosaic in the order you painted it |
| Starburst 3200: tap paints every match in a radius-5 circle; 1 charge per 120 pixels, up to 3 | Final Flourish 3000: at 90% done, one tap finishes the mosaic | Hidden Sketches 1800: three bonus mosaics |
| | | Prism Heart 2600: rainbow sparkles from the brush, glowing gallery |

Bigger brushes only paint pixels with the selected number, so only the centre pixel can ever be a
mistake. The bot in `simtest.mjs` (which buys cheapest-first) learns the whole tree by the end of
chapter 4. A player who buys less greedily finishes it around the finale.

## Gallery, sharing, freestyle

- The gallery holds every restored mosaic: share or download a crisp upscaled PNG, watch a time-lapse,
  open the Freestyle Studio (the mosaic's own palette plus 22 studio colours; brush, flood fill, undo,
  back to the original, save PNG). Remixes are saved and can be toggled against the original.
- Share uses the Web Share API with files where supported, otherwise downloads the PNG.

## Saving

`localStorage` key `colorverse.save.v2`, written after strokes (debounced), on leaving a page and on
`pagehide`. Cells are one base-36 character per pixel; the paint order is two base-64 characters per
pixel. Loading rejects other versions and drops anything broken: wrong lengths, out-of-range colours,
unknown pages, unknown skills, skills missing a prerequisite. A page counts as done only if its cells are.
A browser that blocks storage still plays.

## Files

```
index.html, style.css
js/main.js       boot, screens, story flow, chart, constellation, gallery, settings, ?debug=1 hooks
js/paint.js      the painting screen: tools, palette, strokes, completion, freestyle, keys
js/painter.js    the canvas: camera, drawing, gestures (pointer events)
js/progress.js   the rules and the save format (pure)
js/skills.js     the Constellation (pure)
js/story.js      chapters and dialogue (pure)
js/artworks.js   every mosaic and portrait (pure)
js/pixelart.js   the pixel-art language (pure)
js/ui.js         thumbnails, PNG export, toast, modal, dialogue player
js/audio.js      Web Audio plucks and chimes
js/save.js       guarded localStorage
dev/             tests and tools, see dev/README.md
```

## Testing

See `dev/README.md`. `node game-086/dev/simtest.mjs` (rules, art, save, story, economy bot) and
`node game-086/dev/browsertest.mjs` (real clicks, wheel, keys, taps, CDP pinch and drags on phones).
