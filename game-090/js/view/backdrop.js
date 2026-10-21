// A zone seen as a set for a cutscene: the first floor (or the boss's arena) of a zone, built
// with the same environment code as the field, with a slow orbiting camera and, when a boss is
// named, that boss standing on its dais.

import * as THREE from 'three';
import { buildEnvironment, CELL } from './env.js';
import { genFloor, floorSeed } from '../sim/gen.js';
import { ZONES } from '../sim/data/zones.js';
import { buildDaemon, hexify } from './daemons3d.js';
import { bossDais } from './markers.js';
import { TOON } from './toon.js';
import { DAEMONS } from '../sim/data/daemons.js';

export class Backdrop {
    constructor(quality = 2) {
        this.quality = quality;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(44, 1.6, 0.3, 200);
        this.env = null; this.boss = null; this.key = ''; this.center = new THREE.Vector3(); this.orbit = 0; this.r = 10; this.h = 4;
        this.floorIdx = 0;
    }
    show(zoneId, bossId = null, calm = false) {
        const key = `${zoneId}:${bossId}:${calm}`;
        if (key === this.key) return;
        this.key = key;
        if (this.env) { this.scene.remove(this.env.group); this.env.dispose(); }
        if (this.boss) this.scene.remove(this.boss.root);
        this.boss = null;
        const Z = ZONES[zoneId];
        let idx = 0;
        if (bossId) for (const [k, v] of Object.entries(Z.bosses || {})) if (v === bossId) idx = +k;
        const fl = genFloor(zoneId, idx, floorSeed(zoneId, idx, 0));
        this.env = buildEnvironment(fl, zoneId, null, this.quality);
        this.scene.add(this.env.group);
        const I = this.env.info;
        this.scene.fog = new THREE.Fog(I.fogColor, 12, 52); this.scene.background = I.fogColor;
        TOON.uRim.value.set(I.rim); TOON.uRimK.value = I.rimK;
        if (bossId && fl.boss) {
            this.center.set(fl.boss.x * CELL + CELL / 2, 0, fl.boss.y * CELL + CELL / 2);
            const d = bossDais(DAEMONS[bossId].model.c[2]); d.root.position.copy(this.center); this.scene.add(d.root); this.dais = d;
            const m = buildDaemon(bossId); if (!calm) hexify(m);
            m.root.position.copy(this.center).setY(0.3); m.root.scale.multiplyScalar(1.3);
            this.scene.add(m.root); this.boss = m;
            this.r = 9 + m.h * 1.4; this.h = 1.6 + m.h * 0.6; this.focusY = m.h * 0.55;
        } else {
            this.center.set(fl.up.x * CELL + CELL / 2 + 6, 0, fl.up.y * CELL + CELL / 2);
            this.r = 9; this.h = 4.5; this.focusY = 1.5;
        }
    }
    update(dt, t) {
        TOON.uTime.value = t;
        this.orbit += dt * 0.18;
        const a = this.orbit;
        this.camera.position.set(this.center.x + Math.sin(a) * 4.5 + 2, this.h + Math.sin(a * 0.7) * 0.4, this.center.z + this.r + Math.cos(a) * 1.2);
        this.camera.lookAt(this.center.x, this.focusY || 1.5, this.center.z);
        if (this.boss) this.boss.pose({ move: 0 }, t);
        if (this.dais) this.dais.update(t);
        if (this.env) this.env.update(t, this.center.x, this.center.z, this.camera.position);
    }
}
