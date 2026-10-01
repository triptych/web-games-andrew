/**
 * title.js — the title over the citadel, and the new-game flow.
 */

import { h, app, btn, confirmBox, modal } from '../dom.js';
import { G, hasSave, newGame, loadGame } from '../../game.js';
import { go } from '../app.js';
import { peekStage } from '../stages.js';
import { generateHero } from '../../sim/heroes.js';
import { initAudio, playMusic, sfx } from '../../audio.js';
import { Rng } from '../../core/rng.js';

export const titleScreen = {
    id: 'title',
    stage: 'citadel',
    chrome: 'title',
    enter(root) {
        const st = peekStage('citadel');
        // a parade of random heroes wandering the island behind the logo
        const r = new Rng(Date.now() >>> 0);
        const looks = G.S && G.S.heroes.length ? G.S.heroes.slice(0, 6).map((x) => x.look) : Array.from({ length: 6 }, () => generateHero({ seed: r.seed(), rarity: r.int(3, 5) }).look);
        st.setHeroes(looks);
        st.setOverlord(G.S && G.S.overlord.look);
        st.dist = 1.25;
        const has = hasSave() && G.S;
        const ui = h('div.title-screen',
            h('div.logo', h('div.logo-main', 'SIGILBORN'), h('div.logo-sub', 'Overlord of the Endless Spire')),
            h('div',
                h('div.title-btns',
                    has ? btn(`Continue <small>· ${G.S.overlord.name}, Lv ${G.S.overlord.level}</small>`, () => { initAudio(); start(false); }, 'gold') : null,
                    btn(has ? 'New Game' : 'Begin', async () => {
                        initAudio();
                        if (has && !(await confirmBox('Start over? Your current citadel, heroes and gear will be lost.', 'Start Over', 'Keep Playing', 'red'))) return;
                        start(true);
                    }, has ? 'ghost' : 'gold'),
                ),
                h('div.title-foot', 'Summon unique heroes · Command them in battle · Build your citadel', h('br'), 'Every hero, monster and sound is generated in code.'),
            ),
        );
        app(root, ui);
    },
    exit() {
        const st = peekStage('citadel');
        st.dist = 1;
    },
};

async function start(fresh) {
    sfx('reward');
    if (fresh) {
        newGame();
        await go('creator', { mode: 'overlord', first: true }, { fade: true, noHistory: true });
        return;
    }
    if (!G.S) loadGame();
    playMusic('citadel');
    await go('citadel', { welcome: true }, { fade: true, noHistory: true });
}

export function showIntro(done) {
    const pages = [
        { t: 'The Shattered Throne', p: 'Long ago the Sigil Throne bound a hundred heroes to the service of the realm. Then the Usurper Vael\'zor broke it, and its heroes scattered across the planes like sparks from a forge.' },
        { t: 'A New Overlord', p: 'You have climbed to the last floating citadel and laid your hand on the broken throne. It answered. Through the Summoning Circle you can call heroes back out of the sigil-light — and no two of them are ever the same.' },
        { t: 'Your First Orders', p: 'Two loyal retainers already wait in the courtyard. Summon more at the Circle, win back the eight lost regions, and set the citadel to work: the mine, the farm, the forge and the treasury keep running even while you are away.' },
    ];
    let i = 0;
    const show = () => {
        const pg = pages[i];
        modal({
            title: pg.t, body: h('p', pg.p), dismiss: false,
            buttons: [{ label: i < pages.length - 1 ? 'Next' : 'To the Citadel!', cls: 'gold', onClick: () => { i++; if (i < pages.length) setTimeout(show, 220); else done(); } }],
        });
    };
    show();
}
