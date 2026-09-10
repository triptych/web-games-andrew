/**
 * interaction.js — player-facing feedback: the contextual prompt line and the
 * region label. Kept separate from items.js (which owns pickup detection) and
 * collections.js (which owns depositing) so all the "what should the player be
 * told right now" logic lives in one place.
 */

import { INTERACT_RADIUS } from '../config.js';
import { setPrompt } from '../ui.js';
import { state } from '../state.js';

const NEARBY_ITEM_RANGE = INTERACT_RADIUS * 3;
const BUILDING_RANGE = 20;

export function updateInteractionPrompt(itemManager, world, playerPos) {
    // Highest priority: standing near the building you owe something to.
    const carryingBooks = state.carriedBooks > 0;
    const carryingArtifacts = state.carriedArtifacts > 0;

    if (carryingBooks || carryingArtifacts) {
        const dest = _nearestRelevantBuilding(world, playerPos, carryingBooks, carryingArtifacts);
        if (dest && dest.dist < BUILDING_RANGE) {
            setPrompt(`Enter ${dest.label} to ${dest.verb}`);
            return;
        }
    }

    // Otherwise, call out a collectible within reach.
    const nearest = itemManager.nearestUncollected(playerPos);
    if (nearest) {
        const d = Math.hypot(nearest.pos[0] - playerPos[0], nearest.pos[2] - playerPos[2]);
        if (d < NEARBY_ITEM_RANGE) {
            const label = nearest.kind === 'book' ? 'Book' : 'Artifact';
            setPrompt(`${label} nearby: ${nearest.name}`);
            return;
        }
    }

    setPrompt(null);
}

function _nearestRelevantBuilding(world, playerPos, carryingBooks, carryingArtifacts) {
    const options = [];
    if (carryingBooks) options.push({ type: 'library', label: 'the Library', verb: 'shelve your books' });
    if (carryingArtifacts) options.push({ type: 'museum', label: 'the Museum', verb: 'display your artifacts' });

    let best = null;
    for (const opt of options) {
        const p = world.regionMap.points.find(pt => pt.type === opt.type);
        if (!p) continue;
        const dist = Math.hypot(p.x - playerPos[0], p.z - playerPos[2]);
        if (!best || dist < best.dist) best = { ...opt, dist };
    }
    return best;
}

export function updateRegionLabel(regionMap, playerPos) {
    state.setRegion(regionMap.regionAt(playerPos[0], playerPos[2]));
}
