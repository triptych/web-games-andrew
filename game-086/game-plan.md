# Colorverse

**Genre:** Cozy coloring / collection  
**Engine:** Vanilla JavaScript + Canvas 2D, no asset files  
**Status:** v1.0.0 scaffold

## Concept
A small, soothing coloring book drifting between friendly science fiction and whimsical fantasy. Fill enclosed regions in line drawings, try different palettes, and collect completed pieces in a personal gallery. No score, timer, failure state or required color scheme.

## Core loop
1. Choose Starship Sprout, Moonberry Dragon or Cloudtop Castle.
2. Pick a color and tap/click an enclosed region.
3. Undo a fill, switch colors, or reset the page.
4. Fill every region to collect the artwork.
5. Export/share the current page as a PNG.

## Mechanics
- Artwork is represented by closed Canvas `Path2D` shapes; the same paths are used for painting and hit-testing.
- Fills are keyed by stable artwork and region IDs.
- Completion adds the page to the collection; repainting and undo remain available.
- Progress is saved to guarded `localStorage`; invalid versions and fill values are ignored.
- Share uses Web Share for files when supported, otherwise downloads a PNG.

## Testing
Run `node game-086/dev/simtest.mjs`. Browser interaction and appearance still need a live browser pass.
