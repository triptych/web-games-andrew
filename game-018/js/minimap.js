/**
 * minimap.js — 2D overhead minimap rendered to a canvas element.
 *
 * Shows: player (white dot), monsters (red/orange), resource nodes (coloured),
 *   village center (gold), and visited area fog.
 *
 * Exports:
 *   initMinimap(playerGroup, monsters, nodes) → { update(dt), show(), hide(), toggle() }
 */

import { WORLD_SIZE, VILLAGE_RADIUS } from './config.js';

const MAP_SIZE   = 160;   // canvas pixel size
const WORLD_HALF = WORLD_SIZE; // world units from center to edge

const canvas = document.getElementById('minimap-canvas');
const ctx    = canvas ? canvas.getContext('2d') : null;
const panel  = document.getElementById('minimap');

export function showMinimap()   { if (panel) panel.style.display = 'block'; }
export function hideMinimap()   { if (panel) panel.style.display = 'none'; }
export function toggleMinimap() { if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; }

// World coord → canvas pixel
function _toPixel(wx, wz) {
    const px = (wx / WORLD_HALF) * (MAP_SIZE / 2) + MAP_SIZE / 2;
    const py = (wz / WORLD_HALF) * (MAP_SIZE / 2) + MAP_SIZE / 2;
    return [Math.round(px), Math.round(py)];
}

function _dot(x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

export function initMinimap(playerGroup, getMonsters, nodes, dungeonEntrances) {
    if (!ctx) return { update: () => {}, show: showMinimap, hide: hideMinimap, toggle: toggleMinimap };

    function update() {
        // Clear
        ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

        // Circular clip
        ctx.save();
        ctx.beginPath();
        ctx.arc(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();

        // Background
        ctx.fillStyle = 'rgba(10,20,10,0.92)';
        ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

        // Grid lines (faint)
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        for (let g = 0; g <= MAP_SIZE; g += MAP_SIZE / 8) {
            ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, MAP_SIZE); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(MAP_SIZE, g); ctx.stroke();
        }

        // Village circle
        const [vx, vy] = _toPixel(0, 0);
        const vr = (VILLAGE_RADIUS / WORLD_HALF) * (MAP_SIZE / 2);
        ctx.beginPath();
        ctx.arc(vx, vy, vr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(200,168,68,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Village center (campfire)
        _dot(vx, vy, 3, '#c8a844');

        // Dungeon entrances (purple portals)
        if (dungeonEntrances) {
            for (const ep of dungeonEntrances) {
                const [dx, dy] = _toPixel(ep.x, ep.z);
                // Outer glow ring
                ctx.beginPath();
                ctx.arc(dx, dy, 5, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(170,80,255,0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();
                // Inner dot
                _dot(dx, dy, 3, '#aa44ff');
            }
        }

        // Resource nodes
        const nodeColors = { wood: '#8b5a2b', stone: '#999', iron: '#8888cc', herbs: '#55cc55' };
        if (nodes) {
            for (const node of nodes) {
                const [nx, ny] = _toPixel(node.pos.x, node.pos.z);
                _dot(nx, ny, node.ready ? 3 : 2, node.ready ? nodeColors[node.type] : '#444');
            }
        }

        // Monsters
        const monsters = typeof getMonsters === 'function' ? getMonsters() : getMonsters;
        for (const m of monsters) {
            if (!m.alive) continue;
            const [mx, my] = _toPixel(m.mesh.position.x, m.mesh.position.z);
            const col = m.def.isBoss ? '#ff4400' : '#ee2222';
            _dot(mx, my, m.def.isBoss ? 5 : 2.5, col);
        }

        // Player
        if (playerGroup) {
            const [px, py] = _toPixel(playerGroup.position.x, playerGroup.position.z);
            // Direction indicator
            const ang = playerGroup.rotation.y;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.sin(ang) * 7, py + Math.cos(ang) * 7);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            _dot(px, py, 4, '#ffffff');
        }

        ctx.restore();

        // Border ring
        ctx.beginPath();
        ctx.arc(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE / 2 - 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(200,168,68,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    return { update, show: showMinimap, hide: hideMinimap, toggle: toggleMinimap };
}
