# SEEDFALL — painted art

The 2D illustrations in this folder were generated with [fal](https://fal.ai) on 2026-11-08 and resized to WebP
(originals were 1376×768 and 2752×1536 JPEG/PNG). The 3D world (station, planet, every in-world sprite) is still
drawn in code; these images are only used by the DOM layer.

| File | Where it shows | Model |
|---|---|---|
| `title.webp` | Title screen key art; also the Garden preview (`garden/img/games/game-125.jpg`) | `google/nano-banana-2.1` |
| `tilly-happy.webp` | TILLY's dialogue portrait (the base image) | `google/nano-banana-2.1` |
| `tilly-excited.webp`, `tilly-think.webp`, `tilly-worried.webp`, `tilly-sad.webp` | TILLY's other moods, edited from the base so she stays the same robot | `google/nano-banana-2.1/edit` |
| `vesper.webp` | VESPER's dialogue portrait | `google/nano-banana-2.1` |
| `zone-*.webp` (6) | Hangar drop list, Holo-table zone cards, the landing card on each drop, the mission report | `google/nano-banana-2.1` |
| `end-*.webp` (4) | The ending screen | `google/nano-banana-2.1` |

Every prompt shared one system instruction, which is what makes them read as one set:

> You are the art director of SEEDFALL, an HD-2D sci-fi game. Every image is HD-2D pixel art in the style of
> Octopath Traveler and Triangle Strategy: richly detailed 16-bit-era pixel sprites and pixel environments, rendered
> with soft volumetric lighting, gentle bloom, tilt-shift depth of field blur at the top and bottom of the frame,
> warm-against-cool color contrast. Never include any text, letters, logos, watermarks, signatures or user-interface
> elements.

Each prompt then described the subject from the game's own data: the zone's `intro`, hazards and creatures in
`js/sim/data.js`, the endings in `js/sim/story.js`, TILLY as her code sprite draws her. The mood edits kept the
shell, fins, antenna, halo and background and changed only the face on the screen.

To regenerate one, keep the system instruction, reuse the subject description, and export at the sizes above
(`convert in.jpg -resize 960x -quality 80 zone-x.webp`; portraits 320×320; endings 1280 wide; title 1920 wide).
