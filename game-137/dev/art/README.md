# SHARDFRAME — the pictures (fal)

`../../art/` (about 2.1 MB) was made on 2026-11-15 with [fal](https://fal.ai), `fal-ai/nano-banana-2` (PNG) and, for three cinematic shots, `fal-ai/nano-banana-2/edit`, then exported to WebP by `export.py`. 28 paid images, all kept (about $2.30, including a 4-image pilot of which two were kept and two redone). The 3D voxel models in the game are not generated: they are code (`js/view/models.js`).

```bash
node game-137/dev/art/prompts.mjs            # the jobs: { name, system_prompt, prompt, aspect_ratio, resolution }
node game-137/dev/art/prompts.mjs pilot      # one of each kind (title, cast-kai, crew-hana, sector-prairie)
python3 -I game-137/dev/art/export.py RAW    # RAW holds <name>.png
```

Every prompt is built from the game's data: a crew member's look is `art` in `js/sim/data/crew.js`, the pilot and commander are `CAST` there, a sector's look is `art` in `js/sim/data/missions.js`.

| File | Use | Made |
|---|---|---|
| `title.webp` (1600 px) | Behind the title screen | 2K, 16:9 |
| `hangar.webp`, `ending.webp`, `sector-<id>.webp` ×3 (1280 px) | The hangar backdrop, the ending, the sortie list and briefing headers | 1K, 16:9 |
| `cast-kai.webp`, `cast-mirei.webp`, `crew-<id>.webp` ×12 (384 px) | Comms, the Overdrive cut-in, the Crew deck, the debrief | 1K, 1:1 |
| `intro-1…6.webp` (1280 px) | The opening cinematic | 1K, 16:9; shots 4–6 by `/edit` |

## The system prompt (shared)

"Early-1990s Japanese TV anime cel animation style: hand-painted acetate cels with bold clean black ink outlines, flat cel shading with crisp two-tone hard-edged shadows and a single highlight, slightly grainy warm VHS-era film colour, painted watercolour-and-gouache backgrounds, dramatic lighting, vivid saturated palette. Original characters and machines that do not resemble any existing anime or game franchise. No text, letters, numbers, logos, signatures, watermarks, frames, borders, speech bubbles or UI anywhere in the image."

## What went wrong, and what was done about it

- **The first title mech looked like a famous franchise's.** Asked for "white armour with red chest and blue shoulder panels, a single visor eye", the pilot came back white, red and blue with a V-fin: unmistakably the most famous mecha design there is, despite "original" in the system prompt. The mech was redesigned in the prompt to things that franchise doesn't have: sunset-orange and charcoal armour, teal joints, a rounded **dome** head with one horizontal visor slit, "no antenna, no fins, no horns, no face", and **backward-bending bird legs**. The same wording is in every prompt that shows the mech, and `js/view/models.js` builds the same design.
- **"Eyecatch card" drew a card.** The portrait prompt said "like a 1990s anime eyecatch card", and Hana came back as a card with a paper margin. The wording became "as in a 1990s anime eyecatch … fills the square to the edges, with no border, frame or paper margin"; Hana's pilot image was kept and `export.py` crops its centre 86%.
- **Keeping the pilot and the mech on-model in the cinematic.** Shots 4 (Kai in the cockpit), 5 (the catapult launch) and 6 (the landing) were made with `nano-banana-2/edit`, passing Kai's portrait or the title image as the reference ("this same pilot / this same mech, exactly the same design"). All three held the design.
