#!/usr/bin/env bash
# meshy-anim.sh WORKDIR — an attack clip for each rigged model from Meshy's animation library (3 credits each).
# Reads rig-<name>.json (written by meshy-rig.sh); writes anim-<name>.glb into WORKDIR. strip-anim.mjs then keeps
# only the animation, which the game plays on the model it already loaded.
set -u
W="$1"; cd "$W" || exit 1
M() { npm exec --yes --package=meshy-cli@0.4.0 -- meshy "$@" --output-schema v1 --format json --no-update-check 2>/dev/null; }
# name action-id (219 Right-hand Sword Slash, 129 Mage Spell Cast, 127 Charged Ground Slam, 4 Attack)
ANIMS="hero-ironsworn 219
hero-stormcaller 129
hero-shadebinder 129
mon-thrall 4
mon-archer 4
mon-hag 129
mon-wretch 4
mon-sentinel 127
mon-slinger 4
boss-kolossar 127"
one() {
    local n="$1" a="$2"
    [ -f "anim-$n.glb" ] && { echo "have $n"; return; }
    local rid; rid=$(node -e "const d=require('./rig-$n.json');const t=d.result?.task||d;console.log(t.id||t.task_id)")
    local tid; tid=$(M animate create --rig-task-id "$rid" --action-id "$a" --operation-id "tv132-anim-$n" --async | node -e "const d=JSON.parse(require('fs').readFileSync(0));console.log(d.result?.task_id||'')")
    [ -z "$tid" ] && { echo "FAIL $n"; return; }
    M animate wait "$tid" --timeout 900 --save-json "anim-$n.json" >/dev/null
    M download --task-json "anim-$n.json" --asset result.animation_glb_url --output "anim-$n.glb" --workspace . >/dev/null
    echo "$n $(stat -c%s anim-$n.glb 2>/dev/null)"
}
pids=()
while read -r n a; do one "$n" "$a" & pids+=($!); sleep 1; done <<< "$ANIMS"
wait "${pids[@]}"
