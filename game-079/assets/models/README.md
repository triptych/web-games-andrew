# Enemy and boss models

Made with [Meshy](https://www.meshy.ai) (text-to-3d: a `preview` task for the shape, then a `refine` task for the PBR texture at 2k), then shrunk for the web by `dev/optimize-models.mjs` (weld, simplify, resize textures to 1k or 2k, WebP, prune). The raw Meshy files are 20-70 MB each and 0.5-2M triangles; these are 0.4-1.6 MB and 5-26k.

Each file is one mesh facing +z, standing on its lowest point. `js/view/models.js` (`GLB` table) scales it to the enemy's height, turns it to face -z and gives it the actor shader (world lighting, hit flash, freeze, burn, dissolve). Six are static meshes that the code poses as a whole (bob, sway, lean, squash). The three humanoids (Snarl Trooper, Meatbeast, Warlord Vrask) are rigged: `<name>.glb` is a skinned mesh and `<name>_walk.glb` / `<name>_run.glb` hold Meshy's walking and running clips (armature only), blended with the bind pose by the enemy's speed. A file that fails to load falls back to the old procedural model.

| File | Enemy | Triangles | Preview task | Refine task |
|---|---|---|---|---|
| `chomper.glb` | Chomper | 5,000 | `01a1c30f-8aff-73e4-b28d-c9a9fbe49443` | `01a1c310-3c7a-779c-bf66-0cc96aecfe32` |
| `trooper.glb` | Snarl Trooper (rigged) | 14,600 | `01a1c30e-8ee1-774b-b43c-c7c2424857b7` | `01a1c30f-3c30-7440-be50-948018ff15cd` |
| `drone.glb` | Skull Drone | 8,000 | `01a1c30f-8abc-70ca-9f7a-771223ad38fc` | `01a1c310-3e56-7358-8d6d-072c5231b575` |
| `psy.glb` | Brainstalker | 8,000 | `01a1c30f-8b9d-7434-a89a-aa60f1d4e987` | `01a1c310-3e77-70c0-879a-14def7450cd7` |
| `brute.glb` | Meatbeast (rigged) | 14,600 | `01a1c30f-8a6a-7693-96ca-ba9b373a114f` | `01a1c310-39ff-727a-a722-59bfaaf7eade` |
| `tank.glb` | Octotank | 26,000 | `01a1c30f-8a5c-774f-869b-af4f59258162` | `01a1c310-3efe-760a-a13d-8aba6a403f27` |
| `chompra.glb` | Queen Chompra | 16,000 | `01a1c30f-8b88-7098-85f8-f447f5d4a4b4` | `01a1c310-8d4e-74b2-896c-fc372fb3939b` |
| `vrask.glb` | Warlord Vrask (rigged) | 19,300 | `01a1c30f-8b5a-71c1-a1d3-7b8c8ab9c35d` | `01a1c310-8df4-72cb-94b1-2f576344d2b5` |
| `rourke.glb` | Rourke | 18,000 | `01a1c30f-8ad0-72a4-8339-013a16748c4a` | `01a1c310-4072-7600-b81b-068c9a89f24f` |

The Pylon (Throne of Lies) is a prop, not an enemy, and is still procedural. Cost: 30 Meshy credits a model (20 preview + 10 refine), plus 10 for each of the three rigged ones (a 5-credit remesh and a 5-credit rig).

## Rigging

Meshy's rigger takes at most 300,000 faces and the refined models have 1.3-2.2M, so each humanoid was remeshed to 30k triangles first (the remesh keeps the textures), then rigged at its in-game height with `meshy rigging create`. The rigged files replace the static ones above; the 14-19k triangle counts are after `optimize-models.mjs` simplified the 31k rigged mesh.

| Enemy | Height | Remesh task | Rigging task |
|---|---|---|---|
| Snarl Trooper | 1.9 m | `01a1c33a-380f-7191-9f3b-0afc466fe96a` | `01a1c33b-ca71-706d-88ed-9cfa353044aa` |
| Meatbeast | 2.6 m | `01a1c338-4467-71f3-ad34-1049bbebc79b` | `01a1c33a-3189-7441-95c3-162bee05cfd0` |
| Warlord Vrask | 3.0 m | `01a1c33a-3753-7446-96e1-3eb3deeff45c` | `01a1c33b-c892-724f-90d9-18dc5b8feace` |

The clips come from the rigging task (`result.basic_animations.walking_armature_glb_url` and `running_armature_glb_url`). There are no attack clips: wind-ups and charges are still leans on top of the run cycle, and Meshy's animation library (`meshy animate`) could add real ones.

## Prompts

Each prompt began with the enemy's game name and a colon ("Snarl Trooper: a bipedal alien soldier, ..."); the names are left off below.

- **chomper:** a small knee-high four-legged alien creature that is basically a dome-shaped mouth, olive-green hide, huge jaw lined with white teeth and red gums, row of cream-colored bone spikes along its back, four stubby legs with claws, a single yellow glowing stalk eye on top, stylized game enemy, full body
- **trooper:** a bipedal alien soldier, dark blue-steel armor over purple skin, barrel chest with a large grinning mouth full of white fangs and red gums on the chest, helmeted head with three glowing red eyes and a dark fin, round shoulder pads, holding a plasma rifle with glowing cyan coils, 1980s sci-fi B-movie monster, stylized game character, full body, neutral standing pose
- **drone:** a floating chrome metal human-like skull with glowing red eyes in dark sockets and a hinged jaw with teeth, two cylindrical jet thruster pods on either side with blue flames, a small antenna with a red tip, sci-fi flying enemy, stylized game asset
- **psy:** an alien with an exposed glowing pink wrinkled brain on top of a dark purple armored pod, one huge white eyeball with a violet glowing iris on the pod front, dangling pink feelers, walking on three long thin spindly legs, stylized game enemy, full body
- **brute:** a hulking hunched alien brute, raw red flesh muscles with bolted-on steel armor plates across the chest and shin guards, a row of bone spines along the back, small head sunk between the shoulders with curved tusks and glowing orange eyes, huge knuckled fists with bone spikes, stylized game enemy, full body, neutral standing pose
- **tank:** an alien war machine, wide dark-purple armored dome turret with glowing green ports on a low hull with two black tank treads, two rocket pods with tube launchers on the sides, six writhing purple-pink tentacles rising from the turret top, stylized game enemy
- **chompra:** a giant alien queen, a huge dome-shaped mouth creature with olive-green hide, enormous jaws full of white teeth, a golden crown of spikes on its head, glowing lime-green egg sac with eggs on its back, four stout clawed legs, a yellow stalk eye, stylized game boss, full body
- **vrask:** a tall alien warlord with green skin, dark purple plate armor with gold trim, a gold horned helmet, a large golden arm cannon on the right arm, a three-clawed golden left hand, a jetpack on the back and a tattered dark red cape, glowing yellow eyes, stylized game boss, full body, neutral standing pose
- **rourke:** a giant wrinkled pink alien brain with the upper body of a human man in an olive military uniform fused into its front with arms outstretched, dog tags on his chest, thick cables and tentacles hanging from the brain, a glowing magenta halo ring floating above, stylized game final boss

## Regenerating

Download a refined task's GLB with the Meshy CLI (`meshy download --resource text-to-3d --task-id <refine id> --model-format glb --output raw/<name>.glb`). For a rigged one, download the rigging task's `result.rigged_character_glb_url` as `raw/<name>_rig.glb` and its walking and running armature GLBs as `raw/<name>_walk.glb` and `raw/<name>_run.glb`; the script prefers `_rig` when it exists. Then:

```bash
node game-079/dev/optimize-models.mjs raw            # all nine
node game-079/dev/optimize-models.mjs raw chomper    # one
```

Look at the result on `dev/models.html` (`?row=enemies` and `?row=bosses`).
