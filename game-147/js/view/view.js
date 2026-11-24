// The view: one renderer, two dioramas. The inn (hotel3d) when at home or picking an expedition, the arena (battle3d)
// in a fight. Reads G; never writes it.

import { Stage } from './stage.js';
import { Hotel3D } from './hotel3d.js';
import { Battle3D } from './battle3d.js';

export class View {
    constructor(canvas, audio) {
        this.stage = new Stage(canvas);
        this.hotel = new Hotel3D(this.stage);
        this.battle = new Battle3D(this.stage, audio);
        this.mode = 'hotel';
    }

    get busy() { return this.mode === 'battle' && this.battle.busy; }

    onEvents(G, events) {
        this.hotel.onEvents(G, events);
        this.battle.onEvents(G, events);
    }

    /** skipRender: update everything but don't draw (main skips some draws while a full-screen panel covers a phone). */
    frame(G, dt, skipRender = false) {
        const inBattle = G.mode === 'battle' || (this.battle.busy && this.mode === 'battle');
        const mode = inBattle ? 'battle' : 'hotel';
        if (mode !== this.mode) {
            // a soft wash over the switch between the inn and the arena
            const f = document.getElementById('fade');
            f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
        }
        this.mode = mode;
        this.hotel.sync(G, dt);
        if (inBattle) {
            this.battle.update(G, dt);
            if (!skipRender) this.battle.render();
        } else {
            this.stage.setBackdrop(G.mode === 'expedition' ? G.exp.region : 'hotel');
            if (!skipRender) this.hotel.render();
        }
    }
}
