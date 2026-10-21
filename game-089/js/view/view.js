// The View: one renderer, two scenes (the island board and the battle field), and the director
// that plays the sim's events back in order. Each event goes to the board or the battle view,
// which animates it and says how long to wait; the UI and the audio hear every event too.
// `busy` is true while anything is still playing, and the UI only offers choices when it isn't.

import { Stage } from './stage.js';
import { BoardView } from './boardview.js';
import { BattleView } from './battleview.js';

const HOLD = new Set(['reward', 'defeat', 'dungeonCamp', 'victory', 'gameover']);
const BOARD_ONLY = new Set(['dice', 'step', 'land', 'warp', 'lap', 'gold', 'toll', 'buy', 'upgrade', 'roamer', 'roamerGone', 'roamerFight', 'rivalTurn', 'rivalFight', 'rivalGold', 'rivalLap', 'turn', 'fountain', 'blessing', 'dragonWakes', 'mimic', 'treasure']);

export class View {
    constructor(canvas, overlay) {
        this.stage = new Stage(canvas);
        this.board = new BoardView(overlay);
        this.battle = new BattleView(overlay);
        this.overlay = overlay;
        this.queue = [];
        this.wait = 0;
        this.speed = 1;
        this.battleSpeed = 1;
        this.inBattle = false;
        this.swirl = 0;          // the transition into a battle, 0 → 1
        this.swirlDir = 0;
        this.listeners = [];     // (e) => void, called as each event plays
        this.G = null;
        this.stage.use(this.board.scene, this.board.camera);
    }

    get busy() { return this.queue.length > 0 || this.wait > 0 || this.swirlDir !== 0; }

    sync(G) {
        this.G = G;
        this.queue.length = 0;
        this.wait = 0;
        this.board.sync(G);
        this.showBoard();
    }

    showBoard() {
        this.inBattle = false;
        this.battle.fx.clear();
        this.stage.use(this.board.scene, this.board.camera);
    }

    showBattle() {
        this.inBattle = true;
        this.stage.use(this.battle.scene, this.battle.camera);
    }

    push(events) { for (const e of events) this.queue.push(e); }

    /** Skip ahead: play the rest of the queue at high speed. */
    hurry(on) { this.speed = on ? 4 : 1; }

    next() {
        const e = this.queue.shift();
        const G = this.G;
        for (const fn of this.listeners) fn(e);
        if (e.type === 'b_start') {
            // swirl, then cut to the battle field
            if (!this.inBattle) { this.queue.unshift(e); this.queue.unshift({ type: '_swirl' }); return this.next(); }
            this.wait = this.battle.play(e, G, this.battleSpeed * this.speed);
            return;
        }
        if (e.type === '_swirl') { this.swirlDir = 1; this.swirl = 0; return; }
        if (e.type.startsWith('b_')) {
            if (!this.inBattle) this.showBattle();
            this.wait = this.battle.play(e, G, this.battleSpeed * this.speed);
            return;
        }
        if (BOARD_ONLY.has(e.type)) {
            // the battle's result card is still up: keep the board in step, off screen and at once
            if (this.inBattle && HOLD.has(G.phase) && !this.queue.some((x) => x.type === 'dice' || x.type === 'step')) {
                this.board.play(e, G, 60);
                this.wait = 0;
                return;
            }
            if (this.inBattle) this.showBoard();
            this.wait = this.board.play(e, G, this.speed);
            return;
        }
        this.wait = 0;
    }

    /** Leave the battle field once the reward or defeat card is closed. */
    leaveBattle() { if (this.inBattle) this.showBoard(); }

    update(dt, t) {
        // the battle swirl: twist in, cut, and untwist on the other side
        if (this.swirlDir) {
            this.swirl += dt * 1.6 * this.swirlDir * Math.max(1, this.speed * 0.6);
            if (this.swirlDir > 0 && this.swirl >= 1) { this.swirl = 1; this.swirlDir = -1; this.showBattle(); }
            if (this.swirlDir < 0 && this.swirl <= 0) { this.swirl = 0; this.swirlDir = 0; }
        }
        this.stage.swirl = this.swirl;
        if (this.wait > 0) this.wait -= dt;
        let guard = 0;
        while (this.wait <= 0 && this.queue.length && !(this.swirlDir > 0) && guard++ < 60) this.next();
        if (this.wait < 0 && !this.queue.length) this.wait = 0;
        const w = this.stage.w, h = this.stage.h;
        if (this.inBattle) this.battle.update(dt, t, w, h);
        else this.board.update(dt, t, w, h, this.G);
        if (this.battle.flash) { this.stage.doFlash(this.battle.flash[0], this.battle.flash[1]); this.battle.flash = null; }
        this.stage.render(dt, t);
    }
}
