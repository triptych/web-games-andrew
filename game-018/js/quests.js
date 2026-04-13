/**
 * quests.js — Quest system: tracking, completion, NPC quest givers in the village.
 *
 * Exports:
 *   initQuests(scene) — wires up events and spawns NPC meshes
 *   showQuestLog() / hideQuestLog()
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { state }  from './state.js';
import { events } from './events.js';
import { QUEST_DEFS, VILLAGE_RADIUS } from './config.js';
import { playBuild, playLevelUp, playUiClick } from './sounds.js';

// NPC positions around the village center
const NPC_POSITIONS = {
    Elder:   new THREE.Vector3(-5,  0, -5),
    Builder: new THREE.Vector3( 5,  0, -5),
    Guard:   new THREE.Vector3( 7,  0,  3),
    Healer:  new THREE.Vector3(-7,  0,  3),
};

const NPC_COLORS = {
    Elder:   0xcc9955,
    Builder: 0x55aacc,
    Guard:   0xcc5555,
    Healer:  0x55cc88,
};

const NPC_INTERACT_RANGE = 3.5;

// ---- Build NPC mesh ----
function _buildNpcMesh(name) {
    const color = NPC_COLORS[name] || 0xaaaaaa;
    const group = new THREE.Group();
    group.userData.npcName = name;

    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffddaa });
    const eyeMat  = new THREE.MeshBasicMaterial({ color: 0x222222 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.35), bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
    head.position.y = 1.6;
    group.add(head);

    // Eyes (face +Z so they're visible from the campfire side)
    for (const ox of [-0.12, 0.12]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), eyeMat);
        eye.position.set(ox, 1.63, 0.27);
        group.add(eye);
    }

    // Name indicator (coloured dot above head)
    const dotGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color });
    const dot    = new THREE.Mesh(dotGeo, dotMat);
    dot.position.y = 2.1;
    group.add(dot);

    // Floating "!" if has quests
    const bangGeo = new THREE.BoxGeometry(0.08, 0.35, 0.08);
    const bangMat = new THREE.MeshBasicMaterial({ color: 0xffee00 });
    const bang    = new THREE.Mesh(bangGeo, bangMat);
    bang.position.y = 2.55;
    bang.name = 'questBang';
    group.add(bang);

    const dotSmallGeo = new THREE.SphereGeometry(0.06, 5, 5);
    const dotSmall    = new THREE.Mesh(dotSmallGeo, bangMat);
    dotSmall.position.y = 2.35;
    group.add(dotSmall);

    return group;
}

// ---- Quest log panel ----
const panel     = document.getElementById('quest-panel');
const questList = document.getElementById('quest-list');
const closeBtn  = document.getElementById('quest-close');

function _renderQuestLog() {
    if (!questList) return;
    questList.innerHTML = '';

    // Active quests
    const active = QUEST_DEFS.filter(q => state.isQuestActive(q.id));
    const done   = QUEST_DEFS.filter(q => state.isQuestDone(q.id));
    const avail  = QUEST_DEFS.filter(q => !state.isQuestActive(q.id) && !state.isQuestDone(q.id));

    if (active.length > 0) {
        const h = document.createElement('div');
        h.style.cssText = 'color:#ffee44;font-size:11px;text-transform:uppercase;margin-bottom:6px;';
        h.textContent = 'Active Quests';
        questList.appendChild(h);

        for (const q of active) {
            const prog = state.getQuestProgress(q.id);
            const row  = document.createElement('div');
            row.className = 'quest-item quest-active';
            row.innerHTML = `
                <div class="q-title">${q.title}</div>
                <div class="q-desc">${q.desc}</div>
                <div class="q-prog">Progress: ${prog} / ${q.count}</div>
                <div class="q-reward">Reward: ${q.reward.xp} XP, ${q.reward.gold} gold${_rewardResStr(q.reward.resources)}</div>
            `;
            questList.appendChild(row);
        }
    }

    if (avail.length > 0) {
        const h = document.createElement('div');
        h.style.cssText = 'color:#88cc88;font-size:11px;text-transform:uppercase;margin-bottom:6px;margin-top:10px;';
        h.textContent = 'Available Quests';
        questList.appendChild(h);

        for (const q of avail) {
            const row = document.createElement('div');
            row.className = 'quest-item quest-avail';
            row.innerHTML = `
                <div class="q-title">${q.title}</div>
                <div class="q-desc">${q.desc}</div>
                <div class="q-reward">Reward: ${q.reward.xp} XP, ${q.reward.gold} gold${_rewardResStr(q.reward.resources)}</div>
                <button class="q-accept-btn" data-id="${q.id}">Accept</button>
            `;
            questList.appendChild(row);
        }

        questList.querySelectorAll('.q-accept-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const q = QUEST_DEFS.find(x => x.id === btn.dataset.id);
                if (!q) return;
                state.activateQuest(q.id);
                playUiClick();
                events.emit('message', `Quest accepted: "${q.title}"`, '#ffee44');
                _renderQuestLog();
            });
        });
    }

    if (done.length > 0) {
        const h = document.createElement('div');
        h.style.cssText = 'color:#668866;font-size:11px;text-transform:uppercase;margin-bottom:6px;margin-top:10px;';
        h.textContent = `Completed (${done.length})`;
        questList.appendChild(h);
        for (const q of done) {
            const row = document.createElement('div');
            row.className = 'quest-item quest-done';
            row.innerHTML = `<div class="q-title" style="color:#668866;text-decoration:line-through;">${q.title}</div>`;
            questList.appendChild(row);
        }
    }

    if (active.length + avail.length + done.length === 0) {
        questList.innerHTML = '<div style="color:#668866;font-size:12px;">No quests available yet. Explore the world!</div>';
    }
}

function _rewardResStr(res) {
    const parts = Object.entries(res || {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`);
    return parts.length ? ', +' + parts.join(', ') : '';
}

export function showQuestLog() {
    _renderQuestLog();
    if (panel) panel.style.display = 'block';
}

export function hideQuestLog() {
    if (panel) panel.style.display = 'none';
}

// ---- NPC interaction ----
function _openNpcDialog(npcName, playerPos, npcPos) {
    if (playerPos.distanceTo(npcPos) > NPC_INTERACT_RANGE) return false;
    showQuestLog();
    return true;
}

// ---- Init ----
export function initQuests(scene) {
    const npcs = [];

    // Spawn NPCs
    for (const [name, pos] of Object.entries(NPC_POSITIONS)) {
        const mesh = _buildNpcMesh(name);
        mesh.position.copy(pos);
        // Face toward campfire (origin)
        mesh.rotation.y = Math.atan2(-pos.x, -pos.z);
        scene.add(mesh);
        npcs.push({ name, mesh, pos: pos.clone() });
    }

    // Wire up quest-progress events
    events.on('monsterKilled', (type) => {
        for (const q of QUEST_DEFS) {
            if (!state.isQuestActive(q.id)) continue;
            if (q.type === 'kill' && q.target === type) {
                state.advanceQuest(q.id);
                _checkCompletion(q);
            }
        }
    });

    events.on('resourceGathered', (type, amount) => {
        for (const q of QUEST_DEFS) {
            if (!state.isQuestActive(q.id)) continue;
            if (q.type === 'gather' && q.target === type) {
                state.advanceQuest(q.id, amount);
                _checkCompletion(q);
            }
        }
    });

    events.on('buildingBuilt', (id) => {
        for (const q of QUEST_DEFS) {
            if (!state.isQuestActive(q.id)) continue;
            if (q.type === 'build' && q.target === id) {
                state.advanceQuest(q.id, 1);
                _checkCompletion(q);
            }
        }
    });

    events.on('questCompleted', (id) => {
        const q = QUEST_DEFS.find(x => x.id === id);
        if (!q) return;
        // Apply rewards
        state.addXp(q.reward.xp);
        state.addGold(q.reward.gold);
        for (const [res, amt] of Object.entries(q.reward.resources || {})) {
            if (amt > 0) state.addResource(res, amt);
        }
        playLevelUp();
        events.emit('message', `Quest complete: "${q.title}"! Rewards granted.`, '#ffee44');
        if (panel && panel.style.display === 'block') _renderQuestLog();
    });

    // Auto-open quest log panel when near an NPC and pressing Q
    document.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyQ') return;
        if (panel && (panel.style.display === 'none' || panel.style.display === '')) {
            showQuestLog();
            playUiClick();
        } else {
            hideQuestLog();
            playUiClick();
        }
    });

    if (closeBtn) closeBtn.addEventListener('click', () => { playUiClick(); hideQuestLog(); });

    // Animate NPC "!" indicators
    function update(dt) {
        const now = Date.now() * 0.003;
        for (const npc of npcs) {
            const bang = npc.mesh.getObjectByName('questBang');
            if (bang) {
                // Check if this NPC has any available quests
                const hasAvail = QUEST_DEFS.some(q =>
                    q.npc === npc.name && !state.isQuestActive(q.id) && !state.isQuestDone(q.id)
                );
                const hasActive = QUEST_DEFS.some(q =>
                    q.npc === npc.name && state.isQuestActive(q.id)
                );
                bang.visible = hasAvail || hasActive;
                bang.position.y = 2.55 + Math.sin(now + npcs.indexOf(npc)) * 0.1;
                if (hasAvail) bang.material.color.setHex(0xffee00);   // yellow = new quest
                if (hasActive && !hasAvail) bang.material.color.setHex(0x88ddff); // blue = in progress
            }
        }
    }

    return { npcs, update };
}

function _checkCompletion(q) {
    const prog = state.getQuestProgress(q.id);
    if (prog >= q.count) {
        state.completeQuest(q.id);
    }
}
