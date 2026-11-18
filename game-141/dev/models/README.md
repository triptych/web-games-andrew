# SANDSUNK — the artifact models (Meshy)

The sixteen models in `../../models/` (4.0 MB) were made on 2026-11-18 with [Meshy](https://www.meshy.ai) (CLI 0.4.0) from the fal artifact pictures (`dev/art/`), so the museum's 3D piece and its painted icon are the same object. They are loaded only by the museum viewer (`js/view/museum.js`); a model that fails to load is replaced by its painted picture on a card.

| Step | Tool | Cost each |
|---|---|---|
| 1. The reference picture | fal `nano-banana-2` (`art-<id>.png`, see `dev/art/README.md`) | ≈ $0.08 |
| 2. A textured mesh | Meshy `image-to-3d --image-url art-<id>.png --model-type smart-topology --target-polycount 4000 (heart 6000) --should-texture true --enable-pbr false --texture-resolution 2k` | 15 credits |
| 3. Shrink for the web | `opt.mjs` (copied from game-138): WebP textures at 1024 px, quantised geometry, standing on y = 0 and 1 unit tall | 0 |

240 credits in all (a two-model pilot, the scarab and the lens, then the other fourteen). `meshy-state.json` is the batch's journal (task ids and credits).

```bash
node game-141/dev/models/meshy-batch.mjs RAW WORK          # step 2 for every artifact; resumable (WORK/state.json)
# step 3, in a scratch folder with: npm i @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 sharp meshoptimizer
node opt.mjs WORK/raw-scarab.glb game-141/models/scarab.glb 1024
```

The viewer overrides each material's roughness (0.5) and metalness (0.15) and lights it with a RoomEnvironment map, a warm spotlight and a cool rim light, which suits the base-colour-only textures.
