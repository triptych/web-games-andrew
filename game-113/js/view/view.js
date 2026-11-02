// The view: owns the renderer and the two stages (the field diorama and the battle theatre), picks which one to show for
// G.mode, plays the swirl between them, and sets the colour grade. Reads G; never writes it.

import * as THREE from 'three';
import { Stage } from './stage.js';
import { SpriteLib } from './sprites.js';
import { FieldView } from './fieldview.js';
import { BattleView } from './battleview.js';
import { MAPS } from '../sim/data/maps.js';
import { THEMES } from './tiles.js';

export class View {
    constructor(canvas, quality = 2) {
        this.canvas = canvas;
        this.stage = new Stage(canvas, quality);
        this.lib = new SpriteLib();
        this.field = new FieldView(this.lib);
        this.battle = new BattleView(this.lib);
        this.showing = 'field';
        this.stage.setScene(this.field.scene, this.field.camera);
        this.swirl = 0; this.swirlDir = 0; this.pending = null;
        this.fadeTarget = 1;
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.stage.resize(w, h);
        this.field.resize(w, h); this.battle.resize(w, h);
    }

    /** True while a transition is playing: main.js holds the simulation so the count-in isn't eaten by the swirl. */
    get busy() { return this.swirlDir !== 0; }

    wantFor(G) { return G.battle && (G.mode === 'battle' || G.mode === 'results' || G.mode === 'defeat') ? 'battle' : 'field'; }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'battleStart' && this.showing === 'field') { this.swirlDir = 1; this.pending = 'battle'; }
            if (e.type === 'fade') this.fadeTarget = e.dir === 'out' ? 0 : 1;
        }
        this.field.onEvents(G, events, this.stage);
        this.battle.onEvents(G, events, this.stage);
    }

    frame(G, dt, time) {
        this.resize();
        const want = this.wantFor(G);
        // swirl out of the field, switch, swirl into the battle (and the reverse, quicker)
        if (this.swirlDir === 0 && want !== this.showing) { this.swirlDir = 1; this.pending = want; }
        if (this.swirlDir === 1) {
            this.swirl = Math.min(1, this.swirl + dt * (this.pending === 'battle' ? 2.4 : 3.5));
            if (this.swirl >= 1) { this.show(this.pending, G); this.swirlDir = -1; }
        } else if (this.swirlDir === -1) {
            this.swirl = Math.max(0, this.swirl - dt * 2.6);
            if (this.swirl <= 0) this.swirlDir = 0;
        }
        this.stage.swirl = this.swirl;
        this.stage.fade += (this.fadeTarget - this.stage.fade) * Math.min(1, dt * 4);

        let opts;
        if (this.showing === 'battle' && G.battle) {
            this.battle.update(G, dt, time);
            opts = this.battle.gradeOpts(G);
        } else {
            this.field.update(G, dt, time);
            const T = THEMES[MAPS[G.map].theme];
            // tilt-shift focus follows Lyra's height on screen
            const v = new THREE.Vector3(G.p.x, 0.8, G.p.y).project(this.field.camera);
            opts = { ...T.grade, focus: Math.max(0.25, Math.min(0.75, v.y * 0.5 + 0.5)), range: 0.17, blur: 3, vig: 0.8, exposure: T.day ? 1.0 : 1.12 };
            if (G.flags.freed && G.map === 'hollow') { opts.warm = 0.6; opts.dusk = 0; opts.bloom = 0.8; }
        }
        this.stage.render(dt, time, opts);
    }

    show(which, G) {
        this.showing = which;
        if (which === 'battle') { this.battle.build(G); this.battle.builtFor = G.battle; this.stage.use(this.battle.scene, this.battle.camera); }
        else this.stage.use(this.field.scene, this.field.camera);
    }
}
