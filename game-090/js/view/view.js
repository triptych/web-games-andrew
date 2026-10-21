// The View: one renderer, four scenes (the station, a floor, a battle, a cutscene set) and the
// director that plays the sim's events in order. Battle events each animate something and say how
// long to wait; the UI and the audio hear every event at the moment it plays. `busy` is true
// while anything is still playing, and the UI only offers choices when it is not.

import { Stage } from './stage.js';
import { HubView } from './hub.js';
import { ExploreView } from './explore.js';
import { BattleView } from './battle.js';
import { Backdrop } from './backdrop.js';
import { Portraits } from './portraits.js';

export class View {
    constructor(canvas, quality = 2) {
        this.stage = new Stage(canvas);
        this.stage.setQuality(quality);
        this.quality = quality;
        this.hub = new HubView(quality);
        this.explore = new ExploreView(quality);
        this.battle = new BattleView(quality);
        this.backdrop = new Backdrop(quality);
        this.battle.stage = this.stage;
        this.portraits = new Portraits(this.stage.r);
        this.scene = 'hub';
        this.queue = [];
        this.wait = 0;
        this.speed = 1;
        this.battleSpeed = 1;
        this.listeners = [];           // (e) => void, called as each event plays
        this.swirl = 0; this.swirlDir = 0; this.swirlTo = null;
        this.fade = 0; this.fadeDir = 0;
        this.G = null;
        this.use('hub');
        this.hub.preset('title'); this.hub.snap();
    }

    get inBattle() { return this.scene === 'battle'; }
    get busy() { return this.queue.length > 0 || this.wait > 0 || this.swirlDir !== 0; }

    use(name) {
        this.scene = name;
        const m = { hub: this.hub, explore: this.explore, battle: this.battle, backdrop: this.backdrop }[name];
        this.stage.use(m.scene, m.camera);
        this.stage.glitch = 0; this.stage.zoom = 0;
        this.stage.grade(name === 'battle' ? { sat: 1.18, contrast: 1.1, vignette: 0.5 } : name === 'explore' ? { sat: 1.1, contrast: 1.07, vignette: 0.5 } : { sat: 1.12, contrast: 1.04, vignette: 0.38 });
        if (name !== 'battle') this.battle.fx.clear();
    }

    push(events) { for (const e of events) this.queue.push(e); }
    hurry(on) { this.speed = on ? 4 : 1; }
    clear() { this.queue.length = 0; this.wait = 0; this.swirlDir = 0; this.swirl = 0; this.stage.swirl = 0; }

    next() {
        const e = this.queue.shift();
        const G = this.G;
        const sp = this.battleSpeed * this.speed;
        for (const fn of this.listeners) fn(e);
        if (e.type.startsWith('b_')) {
            if (e.type === 'b_start' && this.scene !== 'battle') {
                // twist into the fight: swirl up, cut, untwist
                this.queue.unshift(e);
                this.swirlTo = 'battle'; this.swirlDir = 1; this.swirl = 0;
                this.battleStarted = true;
                this.queue.shift();
                this.pendingStart = e;
                this.wait = 0;
                return;
            }
            if (this.scene !== 'battle') this.use('battle');
            this.wait = this.battle.play(e, G, sp);
            return;
        }
        if (e.type.startsWith('x_')) { this.explore.play(e, G); this.wait = 0; return; }
        this.wait = 0;
    }

    /** Leave the battle field: back to the floor or the station. */
    leaveBattle(to) {
        if (this.scene === 'battle') { this.battle.clearUnits(); this.use(to); }
    }

    update(dt, t, G) {
        this.G = G;
        if (this.swirlDir) {
            this.swirl += dt * 1.7 * this.swirlDir * Math.max(1, this.speed * 0.6);
            if (this.swirlDir > 0 && this.swirl >= 1) {
                this.swirl = 1; this.swirlDir = -1;
                this.use('battle');
                const e = this.pendingStart; this.pendingStart = null;
                this.wait = this.battle.play(e, G, this.battleSpeed * this.speed);
            }
            if (this.swirlDir < 0 && this.swirl <= 0) { this.swirl = 0; this.swirlDir = 0; }
        }
        this.stage.swirl = this.swirl;
        if (this.fadeDir) {
            this.fade = Math.max(0, Math.min(1, this.fade + dt * this.fadeDir * 2.2));
            if (this.fade === 0 || this.fade === 1) this.fadeDir = 0;
            this.stage.setFade(this.fade);
        }
        if (this.wait > 0) this.wait -= dt * (this.scene === 'battle' ? 1 : 1);
        let guard = 0;
        while (this.wait <= 0 && this.queue.length && !(this.swirlDir > 0) && guard++ < 80) this.next();
        if (this.wait < 0 && !this.queue.length) this.wait = 0;
        const sp = this.battleSpeed * this.speed;
        if (this.scene === 'battle') this.battle.update(dt * sp, t, this.stage.w, this.stage.h);
        else if (this.scene === 'explore') this.explore.update(dt, t, G);
        else if (this.scene === 'backdrop') this.backdrop.update(dt, t);
        else this.hub.update(dt, t, G);
        this.stage.render(dt, t);
    }

    fadeOut() { this.fadeDir = 1; }
    fadeIn() { this.fadeDir = -1; }
}
