/**
 * debug.js — ?debug=1 hooks for tests (window.__sb).
 */
import * as THREE from 'three';
import { G, changed, saveGame, newGame } from './game.js';
import { go, currentScreen } from './ui/app.js';
import * as state from './sim/state.js';
import { summon } from './sim/summon.js';
import { generateGear } from './sim/gear.js';
import { generateLook } from './sim/heroes.js';
import { Rng } from './core/rng.js';
import { setNow, now } from './core/time.js';
import { setQuality, brightness, toScreen, renderer, getStage } from './view/engine.js';
import { peekStage } from './ui/stages.js';

export function install() {
    let skew = 0;
    window.__sb = {
        G, go, changed, saveGame, newGame, state, summon, setQuality, brightness, now,
        renderInfo: () => { const st = getStage(); renderer.info.reset(); renderer.render(st.scene, st.camera); return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs.length, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }; },
        current: () => (currentScreen() ? currentScreen().id : null),
        grant: (b) => { const r = state.grant(G.S, b); changed('debug'); return r; },
        grantGear: (n = 3, tier = 1) => { const rng = new Rng(77); for (let i = 0; i < n; i++) state.addGear(G.S, generateGear(rng, { tier, rarityBias: 2 })); changed('debug'); },
        randomLook: () => { const r = new Rng(Date.now() >>> 0); return generateLook(r, 'elf', 'mage', 'dark', 5); },
        skip: (mins) => { skew += mins * 60000; setNow(() => Date.now() + skew); changed('time'); },
        mineCellScreen: (r, c) => { const st = peekStage('mine'); return toScreen(st.cellPos(r, c, new THREE.Vector3()).setZ(0.5), st.camera); },
        farmPlotScreen: (i) => { const st = peekStage('farm'); return toScreen(st.plotPos(i, new THREE.Vector3()).setY(0.2), st.camera); },
    };
}
