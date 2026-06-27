/**
 * UIScene — Persistent HUD overlay.
 * Runs in parallel with MapScene and BattleScene.
 * Shows: chapter, gold, XP bar, and notification toasts.
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

export class UIScene extends Phaser.Scene {
    constructor() { super({ key: 'UIScene' }); }

    create() {
        this._toasts = [];

        // Gold label — top right
        this._goldLabel = this.add.text(GAME_WIDTH - 12, 10, `💰 ${state.gold}`, {
            fontSize: '14px', color: hex(COLORS.gold), fontFamily: 'monospace',
        }).setOrigin(1, 0).setDepth(50);

        // Chapter label — top center
        this._chapterLabel = this.add.text(GAME_WIDTH / 2, 10, `Chapter ${state.chapter}`, {
            fontSize: '13px', color: hex(COLORS.muted), fontFamily: 'monospace',
        }).setOrigin(0.5, 0).setDepth(50);

        // XP bar — bottom strip
        this._xpBg   = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 4, GAME_WIDTH, 8, 0x1a0830).setDepth(50);
        this._xpFill = this.add.rectangle(0, GAME_HEIGHT - 4, 0, 8, 0x8060ff).setOrigin(0, 0.5).setDepth(51);
        this._updateXP();

        // Event subscriptions
        this._offs = [
            events.on('goldChanged',    (v) => { this._goldLabel.setText(`💰 ${v}`); }),
            events.on('xpChanged',      ()  => { this._updateXP(); }),
            events.on('levelUp',        (v) => { this._toast(`Level Up! Now Lv.${v}`, hex(COLORS.gold)); }),
            events.on('questAccepted',  (id) => { this._toast(`Quest: accepted`, hex(COLORS.accent)); }),
            events.on('questCompleted', (id) => { this._toast(`Quest Complete!`, hex(COLORS.success)); }),
            events.on('itemAdded',      (item) => { this._toast(`Got item: ${item.id}`, hex(COLORS.text)); }),
            events.on('battleEnd',      (r)  => { if (r.won) this._toast(`+${r.xpGained} XP  +${r.goldGained}g`, hex(COLORS.gold)); }),
        ];
    }

    update(time, delta) {
        // Tick toasts
        for (const toast of this._toasts) {
            toast.life -= delta / 1000;
            toast.text.setAlpha(Math.min(1, toast.life * 2));
            if (toast.life <= 0) toast.text.destroy();
        }
        this._toasts = this._toasts.filter(t => t.life > 0);
    }

    _updateXP() {
        const xpForNext = 100 * state.level;
        const ratio     = Math.min(1, state.xp / xpForNext);
        this._xpFill.setSize(GAME_WIDTH * ratio, 8);
    }

    _toast(msg, color = '#ffffff') {
        const y = GAME_HEIGHT - 40 - this._toasts.length * 26;
        const txt = this.add.text(GAME_WIDTH / 2, y, msg, {
            fontSize: '14px', color, fontFamily: 'monospace',
            backgroundColor: '#0c082080',
            padding: { x: 8, y: 4 },
        }).setOrigin(0.5).setDepth(60);
        this._toasts.push({ text: txt, life: 2.5 });
    }

    shutdown() {
        this._offs.forEach(off => off());
    }
}
