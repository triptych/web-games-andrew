/**
 * EndingScene — the mission's end.
 *
 * Launched by BaseScene, which pauses itself underneath, the first time
 * Singing Vein ore is carried back to base. Plays the epilogue line by line,
 * then the run's numbers, then offers to keep mining (back to the base, with
 * the world as it is), start a new game, or go to the main menu.
 */
import * as Phaser from '../../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { SCENE, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config.js';
import { GameState } from '../systems/GameState.js';
import { EPILOGUE } from '../data/lore.js';
import { playUiClick, playSingingVein } from '../systems/SoundManager.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

const LINE_DELAY = 260;   // ms between epilogue lines

export class EndingScene extends Phaser.Scene {
    constructor() { super({ key: SCENE.ENDING }); }

    create(data) {
        const CX = GAME_WIDTH / 2;
        playSingingVein();

        this.add.rectangle(CX, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05040c, 0.96);

        // A slow white shimmer behind the title, for the Vein
        const glow = this.add.circle(CX, 70, 70, 0xffffff, 0.08);
        this.tweens.add({ targets: glow, scale: 1.35, alpha: 0.02, duration: 1800, yoyo: true, repeat: -1 });

        this.add.text(CX, 58, 'MISSION', {
            fontSize: '34px', color: '#FFFFFF', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add.text(CX, 96, 'COMPLETE', {
            fontSize: '34px', color: hex(COLORS.accent), fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);

        let y = 150;
        EPILOGUE.forEach((line, i) => {
            const t = this.add.text(CX, y, line, {
                fontSize: '11px', fontFamily: 'monospace',
                color: line.startsWith('AXIOM') ? hex(COLORS.accent) : '#B8B8D8',
            }).setOrigin(0.5).setAlpha(0);
            this.tweens.add({ targets: t, alpha: 1, duration: 500, delay: i * LINE_DELAY });
            y += line ? 18 : 10;
        });

        // The run in numbers
        const stats = GameState.stats;
        const lines = [
            `Singing Vein delivered:  ${(data?.veinValue ?? 0).toLocaleString()} cr`,
            `Deepest reached:  ${stats.maxDepth}m`,
            `Credits earned:  ${stats.totalCreditsEarned.toLocaleString()}`,
            `Deployments:  ${stats.totalRuns}   Machines lost:  ${stats.totalDeaths}`,
        ];
        const statsDelay = EPILOGUE.length * LINE_DELAY + 300;
        y += 14;
        lines.forEach((line, i) => {
            const t = this.add.text(CX, y + i * 20, line, {
                fontSize: '12px', fontFamily: 'monospace', color: i === 0 ? hex(COLORS.gold) : hex(COLORS.text),
            }).setOrigin(0.5).setAlpha(0);
            this.tweens.add({ targets: t, alpha: 1, duration: 400, delay: statsDelay + i * 150 });
        });

        // Buttons appear once the text has, so a stray tap can't skip the ending
        const buttonsDelay = statsDelay + lines.length * 150 + 300;
        const by = GAME_HEIGHT - 130;
        this._button(CX, by,      '[ KEEP MINING ]', hex(COLORS.success), '18px', buttonsDelay, () => {
            this.scene.stop(SCENE.ENDING);
            this.scene.resume(SCENE.BASE);
        });
        this._button(CX, by + 44, '[ NEW GAME ]',    '#8899AA', '14px', buttonsDelay, () => {
            GameState.resetForNewGame();
            this._leaveTo(SCENE.PRELOAD);
        });
        this._button(CX, by + 80, '[ MAIN MENU ]',   '#667788', '14px', buttonsDelay, () => {
            this._leaveTo(SCENE.SPLASH);
        });
    }

    _button(x, y, label, color, size, delay, onPress) {
        const btn = this.add.text(x, y, label, { fontSize: size, color, fontFamily: 'monospace', padding: { x: 12, y: 10 } })
            .setOrigin(0.5).setAlpha(0);
        this.time.delayedCall(delay, () => {
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerover', () => btn.setColor('#FFFFFF'));
            btn.on('pointerout',  () => btn.setColor(color));
            btn.on('pointerdown', () => { playUiClick(); onPress(); });
        });
        this.tweens.add({ targets: btn, alpha: 1, duration: 400, delay });
        return btn;
    }

    /** Close the paused game scenes underneath, then switch. */
    _leaveTo(key) {
        GameState.save();
        for (const k of [SCENE.UI, SCENE.BASE, SCENE.GAME]) this.scene.stop(k);
        this.scene.start(key);
    }
}
