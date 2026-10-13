// The playtest overlay: mounts the real runtime over the editor with the
// project as it is right now, relays its hooks to the meta-game, and tears it
// down when closed. Playtests save under their own key.
import { h } from './ui.js';
import { store } from './store.js';
import { bus } from './bus.js';

let current = null;

export function playtest(opts) {
    if (current) return current;
    opts = opts || {};
    const TW = store.TW;
    const p = store.project;
    const box = h('div.playtest', { role: 'dialog', 'aria-label': 'Playtest' });
    const bar = h('div.ptbar',
        h('span.pttitle', { text: '▶ Playtest — ' + (p.system.title || 'Untitled') }),
        h('span.pthelp', { text: 'Arrows move · Z / Enter talk · X / Esc menu · Shift run' }),
        h('button.ptclose', { title: 'Back to the Atelier (F5 toggles)', 'aria-label': 'Close playtest', text: '✕ Close', on: { click: () => close() } }));
    const stage = h('div.ptstage');
    box.append(bar, stage);
    document.body.appendChild(box);
    document.body.classList.add('playing');
    let game;
    const onHook = (name, data) => bus.emit('hook', { name, data });
    try {
        game = TW.mount(stage, JSON.parse(JSON.stringify(p)), {
            playtest: true,
            saveKey: 'tw.playtest.' + p.id,
            startOverride: opts.at || null,
            onHook,
            onWarn: (msg) => bus.emit('playtest-warn', msg),
            touch: opts.touch,
        });
    } catch (e) {
        box.remove();
        document.body.classList.remove('playing');
        throw e;
    }
    TW.audio.unlock();
    const onKey = (e) => { if (e.key === 'F5') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey, true);
    function close() {
        if (!current) return;
        window.removeEventListener('keydown', onKey, true);
        game.destroy();
        box.remove();
        document.body.classList.remove('playing');
        current = null;
        bus.emit('playtest-end', {});
    }
    current = { game, close };
    window.__twGame = game;
    bus.emit('edit', { kind: 'playtest', at: opts.at || null });
    return current;
}
export function playtestOpen() { return current; }
