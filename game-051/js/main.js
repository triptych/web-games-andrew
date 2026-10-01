/**
 * main.js — boot: renderer, save, screens; then the frame loop.
 */

import { initEngine, renderFrame } from './view/engine.js';
import { G, loadGame, hasSave, tick, saveGame } from './game.js';
import { go, updateScreen, register } from './ui/app.js';
import { pumpPortraits } from './ui/portraits.js';
import { initAudio, setSound, setMusic } from './audio.js';
import { $ } from './ui/dom.js';
import { getStage3D } from './ui/stages.js';
import { SCREENS } from './ui/screens/index.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

function bootProgress(f, text) {
    $('#boot-fill').style.width = Math.round(f * 100) + '%';
    if (text) $('#boot-text').textContent = text;
}

async function boot() {
    bootProgress(0.1, 'Waking the renderer…');
    initEngine($('#gl-host'));
    for (const s of SCREENS) register(s);
    bootProgress(0.3, 'Raising the citadel…');
    await getStage3D('citadel');
    bootProgress(0.6, 'Polishing the sigils…');
    await getStage3D('showcase');
    bootProgress(0.85, 'Reading the chronicle…');
    const loaded = hasSave() && loadGame();
    if (G.S) { setSound(G.S.settings.sound); setMusic(G.S.settings.music); }
    bootProgress(1, 'Ready');
    // unlock audio on the first touch
    const unlock = () => { initAudio(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
    await go('title', { loaded }, { noHistory: true });
    setTimeout(() => $('#boot').classList.add('gone'), 150);
    setTimeout(() => $('#boot').remove(), 800);
    requestAnimationFrame(loop);
    setInterval(() => { try { tick(); } catch (e) { console.error(e); } }, 1000);
    addEventListener('visibilitychange', () => { if (document.hidden) saveGame(true); });
    addEventListener('pagehide', () => saveGame(true));
    if (DEBUG) {
        const dbg = await import('./debug.js');
        dbg.install();
    }
    window.__ready = true;
}

let last = performance.now();
function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    try {
        updateScreen(dt, now / 1000);
        renderFrame(dt, now / 1000);
        pumpPortraits(2);
    } catch (e) { console.error(e); }
    requestAnimationFrame(loop);
}

boot().catch((e) => {
    console.error(e);
    const t = $('#boot-text');
    if (t) t.textContent = 'Something went wrong starting the game: ' + e.message;
});
