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

    frame(G, dt) {
        const inBattle = G.mode === 'battle' || (this.battle.busy && this.mode === 'battle');
        this.mode = inBattle ? 'battle' : 'hotel';
        this.hotel.sync(G, dt);
        if (inBattle) {
            this.battle.update(G, dt);
            this.battle.render();
        } else {
            this.stage.setBackdrop(G.mode === 'expedition' ? G.exp.region : 'hotel');
            this.hotel.render();
        }
    }
}
