#!/usr/bin/env bash
# meshy-rig.sh WORKDIR — rig the humanoid models made by meshy-batch.mjs and fetch Meshy's walking and running clips.
# Reads each model's image-to-3d task id from WORKDIR/state.json. 5 credits a rig. Writes rig-<name>.glb (the rigged
# model with its walk) and run-<name>.glb (the same model running) into WORKDIR.
set -u
W="$1"; cd "$W" || exit 1
M() { npm exec --yes --package=meshy-cli@0.4.0 -- meshy "$@" --output-schema v1 --format json --no-update-check 2>/dev/null; }
# name height(m)
RIGS="hero-ironsworn 1.75
hero-stormcaller 1.75
hero-shadebinder 1.7
mon-thrall 1.8
mon-archer 1.8
mon-hag 1.7
mon-wretch 1.8
mon-sentinel 2.4
mon-slinger 1.6
boss-kolossar 6.0"
rig() {
    local n="$1" h="$2"
    [ -f "rig-$n.glb" ] && { echo "have $n"; return; }
    local id; id=$(node -e "console.log(require('./state.json')['$n'].i3d)")
    local tid; tid=$(M rigging create --input-task-id "$id" --height-meters "$h" --operation-id "tv132-rig-$n" --async | node -e "const d=JSON.parse(require('fs').readFileSync(0));console.log(d.result?.task_id||'')")
    [ -z "$tid" ] && { echo "FAIL $n submit"; return; }
    M rigging wait "$tid" --timeout 900 --save-json "rig-$n.json" | node -e "const d=JSON.parse(require('fs').readFileSync(0));const t=d.result?.task||{};console.log('$n',t.status,t.consumed_credits,t.task_error?JSON.stringify(t.task_error):'')"
    M download --task-json "rig-$n.json" --asset result.basic_animations.walking_glb_url --output "rig-$n.glb" --workspace . >/dev/null
    M download --task-json "rig-$n.json" --asset result.basic_animations.running_glb_url --output "run-$n.glb" --workspace . >/dev/null
    ls -la "rig-$n.glb" "run-$n.glb" 2>&1 | awk '{print $5, $9}'
}
while read -r n h; do rig "$n" "$h" & sleep 2; done <<< "$RIGS"
wait
