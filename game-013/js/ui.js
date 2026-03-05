/**
 * ui.js — HUD and in-game UI.
 * Call initUI(k) once per scene.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

let k;
let goldLabel, dayLabel;

export function initUI(kaplay) {
    k = kaplay;
    _buildHUD();
    _subscribeEvents();
}

function _buildHUD() {
    // Gold — top-left
    goldLabel = k.add([
        k.pos(16, 12),
        k.text(`Gold: ${state.gold}g`, { size: 18 }),
        k.color(...COLORS.gold),
        k.anchor('topleft'),
        k.z(100),
    ]);

    // Day — top-right
    dayLabel = k.add([
        k.pos(GAME_WIDTH - 16, 12),
        k.text(`Day ${state.day}`, { size: 18 }),
        k.color(...COLORS.accent),
        k.anchor('topright'),
        k.z(100),
    ]);

    // Controls hint — bottom
    k.add([
        k.pos(GAME_WIDTH / 2, GAME_HEIGHT - 10),
        k.text('Click a pot to plant or harvest  |  S — Shop  |  ESC — Menu', { size: 12 }),
        k.color(...COLORS.muted),
        k.anchor('bot'),
        k.z(100),
    ]);
}

function _subscribeEvents() {
    const offs = [
        events.on('goldChanged', (v) => {
            goldLabel.text = `Gold: ${v}g`;
        }),
        events.on('dayAdvanced', (v) => {
            dayLabel.text = `Day ${v}`;
        }),
    ];

    k.onSceneLeave(() => offs.forEach(off => off()));
}

/** Floating "+Ng" label that drifts upward and fades */
export function spawnGoldPopup(k, x, y, amount) {
    const label = k.add([
        k.pos(x, y),
        k.text(`+${amount}g`, { size: 16 }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.opacity(1),
        k.z(150),
    ]);
    let t = 0;
    const off = k.onUpdate(() => {
        if (!label.exists()) { off(); return; }
        t += k.dt();
        label.pos = k.vec2(x, y - t * 40);
        label.opacity = Math.max(0, 1 - t / 1.2);
        if (t > 1.2) {
            off();
            k.destroy(label);
        }
    });
}
