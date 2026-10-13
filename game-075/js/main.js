// CHROME CHALICE — boot, the fixed-step loop and the mode machine:
//
//   attract (title → story → how to play → cast → high scores → demo) ⇄ coin
//   → select → intro → play ⇄ pause/options → clear (tally) → intro → … → ending → loop 2
//   play (no lives) → continue? → game over → name entry → attract
//
// ?debug=1 exposes window.__cc for tests; &fast=N runs N× simulation per frame.

import { SIM_DT, W, H, PF_Y, SKILL } from './config.js';
import { World, newSession } from './sim/world.js';
import { Bot } from './sim/bot.js';
import { REALMS } from './sim/realms.js';
import { Renderer, STYLES } from './view/render.js';
import { Screens } from './view/screens.js';
import { makeCRT } from './view/crt.js';
import { Arcade } from './view/arcade.js';
import { audio } from './audio.js';
import { JUKEBOX, SONGS } from './music.js';
import { Input } from './input.js';
import * as store from './save.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FAST = Math.max(1, Math.min(40, +(params.get('fast') || 1)));
const PERSIST = params.has('persist') ? +params.get('persist') : 0.42;

const $ = (id) => document.getElementById(id);
const screenCanvas = $('screen');
const R = new Renderer(screenCanvas);
const SC = new Screens(R);
let crt = null;
try { crt = makeCRT($('crt')); } catch (e) { console.warn('no CRT', e); crt = null; }
const arcade = new Arcade($('arcade'));
const input = new Input({
    stick: $('stick'), stickTop: document.querySelector('.st-top'), a: $('b-a'), b: $('b-b'), c: $('b-c'),
    start: $('b-start'), pause: $('b-pause'), coins: [$('coin1'), $('coin2')], screen: $('tap'),
});
const data = store.load();

const PAGES = [['title', 9], ['story', 10], ['howto', 9], ['cast', 9], ['scores', 7], ['demo', 40]];

const G = {
    mode: 'boot', t: 0, modeT: 0, world: null, session: null, bot: null, acc: 0, credits: 0,
    page: 0, pageT: 0, sel: 0, rows: null, from: null, tally: null, contN: 10, contT: 0,
    entry: null, demo: false, seen: {}, fps: 60, fpsN: 0, slow: 0, spillT: 0,
    jukeSel: 0, clearT: 0,
};

const hiScore = () => Math.max(data.hiscores[0]?.score || 0, G.session ? G.session.score : 0);

// ================================================================== settings and layout
function applySettings() {
    const s = data.settings;
    audio.setSound(s.sound); audio.setMusic(s.music); audio.setAmbience(s.amb); audio.setVolume(s.volume);
    R.shakeOn = s.shake;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const S = s.quality === 'high' ? 3 : s.quality === 'low' ? 2 : (coarse ? 2 : 3);
    if (S !== R.S) R.setScale(S);
    R.fx.quality = S === 2 ? 0.6 : 1;
    arcade.lowPower = S === 2;
    document.body.classList.toggle('no-crt', !s.crt || !crt);
    layout();
}

function layout() {
    const vv = window.visualViewport;
    const vw = Math.round(vv ? vv.width : innerWidth), vh = Math.round(vv ? vv.height : innerHeight);
    const touch = input.touchMode;
    let mode;
    const view = data.settings.view;
    if (view === 'screen') mode = 'screen';
    else if (vw < vh && vw < 820) mode = 'portrait';
    else if (vh < 540 && vw > vh) mode = 'landscape';
    else mode = view === 'cabinet' || !touch || vw >= 900 ? 'cabinet' : 'landscape';
    document.body.dataset.layout = mode;
    document.body.classList.toggle('touch', touch);
    const st = document.documentElement.style;
    let sw, sh, mq = 0, pn = 0, side = 0, bz = 0, top = 0;
    if (mode === 'cabinet') {
        mq = Math.max(56, Math.min(120, vh * 0.12));
        pn = Math.max(84, Math.min(150, vh * 0.15));
        bz = Math.max(10, Math.min(26, vh * 0.025));
        const availH = vh - mq - pn - bz * 2 - Math.min(80, vh * 0.07);
        sh = Math.min(availH, (vw * 0.7) * 0.75, 840);
        sw = sh * 4 / 3;
        side = Math.max(40, Math.min(110, sw * 0.12));
        if (sw + side * 2 > vw - 10) { sw = vw - 10 - side * 2; sh = sw * 0.75; }
        top = Math.max(0, Math.min(vh * 0.02, 20));
    } else if (mode === 'portrait') {
        mq = Math.max(44, Math.min(70, vh * 0.07));
        bz = 6;
        sw = vw - 12; sh = sw * 0.75;
        pn = Math.max(170, vh - mq - sh - bz * 2);
    } else {
        const margin = touch || mode === 'landscape' ? Math.min(vw * 0.2, 170) : 10;
        sh = vh - 8; sw = sh * 4 / 3;
        if (sw > vw - margin * 2) { sw = vw - margin * 2; sh = sw * 0.75; }
        pn = 110;
    }
    sw = Math.floor(sw); sh = Math.floor(sh);
    st.setProperty('--sw', sw + 'px'); st.setProperty('--sh', sh + 'px');
    st.setProperty('--mq', mq + 'px'); st.setProperty('--pn', pn + 'px');
    st.setProperty('--side', side + 'px'); st.setProperty('--bz', bz + 'px'); st.setProperty('--top', top + 'px');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cc = $('crt');
    const cw = Math.round(sw * dpr), ch = Math.round(sh * dpr);
    if (cc.width !== cw || cc.height !== ch) { cc.width = cw; cc.height = ch; }
    arcade.cabW = mode === 'cabinet' ? sw + side * 2 : sw;
    arcade.resize(vw, vh, dpr);
}
addEventListener('resize', layout);
if (window.visualViewport) visualViewport.addEventListener('resize', layout);
input.onTouchMode = () => layout();

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') pause(); });

// ================================================================== flow
function setMode(m) {
    G.mode = m; G.modeT = 0; G.sel = 0;
    // a mashed key must not fall through into the next screen
    if (m === 'play' || m === 'select' || m === 'intro' || m === 'continue' || m === 'entry') input.flush();
}

function toAttract(page = 0) {
    G.world = null; G.bot = null; G.demo = false; G.session = null;
    setMode('attract');
    G.page = page; G.pageT = 0;
    audio.play('title');
    audio.calm = false; audio.layer = 3; audio.glitch = 0;
}

function nextPage() {
    G.page = (G.page + 1) % PAGES.length; G.pageT = 0;
    if (PAGES[G.page][0] === 'demo') startDemo();
    else if (G.demo) { G.demo = false; G.world = null; G.bot = null; audio.play('title'); }
}

function startDemo() {
    const s = newSession({ skill: 'novice' });
    s.lives = 99;
    G.session = null;
    G.world = World.create(0, s);
    G.bot = new Bot(G.world);
    G.demo = true; G.acc = 0;
    R.reset(); R.hi = hiScore();
    audio.play('r1');
}

function insertCoin() {
    G.credits = Math.min(9, G.credits + 1);
    audio.sfx('coin');
    document.body.classList.add('has-credit');
}

function useCredit() {
    if (G.credits <= 0) G.credits = 1;     // free play
    G.credits--;
    document.body.classList.toggle('has-credit', G.credits > 0);
}

function toSelect() {
    useCredit();
    audio.sfx('start');
    G.world = null; G.bot = null; G.demo = false;
    setMode('select');
    audio.play('title');
}

function newGame() {
    const s = data.settings;
    G.session = newSession({ skill: s.skill, mode: s.mode, realm: Math.min(G.selRealm || 0, data.reached), remix: (Date.now() % 100000) + 1 });
    toIntro(G.session.realm);
}

function toIntro(ri) {
    G.session.realm = ri;
    G.world = null;
    setMode('intro');
    audio.play(REALMS[ri].song);
    audio.calm = false; audio.layer = 3; audio.glitch = 0;
}

function startRealm() {
    const s = G.session;
    G.world = World.create(s.realm, s);
    if (G.god) G.world.god = true;
    G.bot = G.autoplay ? new Bot(G.world) : null;
    G.acc = 0;
    R.reset(); R.hi = hiScore(); R.credits = G.credits;
    setMode('play');
    R.message(REALMS[s.realm].name, '#ffd23a', 2.2, 'FIND THE CHALICE');
}

function pause() {
    if (G.mode !== 'play') return;
    G.from = 'play';
    setMode('pause');
    audio.sfx('back');
}

function resume() { setMode('play'); G.acc = 0; }

function toClear() {
    const w = G.world, t = w.tally;
    const rows = [
        { label: 'REALM BONUS', value: t.realm, color: '#ffd23a' },
        { label: 'TIME BONUS', value: t.time, color: '#29e6ff' },
        { label: 'NO MISS BONUS', value: t.noMiss, color: '#ff2ece' },
        { label: `GEMS ${t.gems}`, value: null },
        { label: `DRAGONS SLAIN ${t.kills}`, value: null },
    ];
    G.tally = { rows, k: 0, total: G.session.score - t.realm - t.time - t.noMiss, done: false };
    for (const r of rows) r.shown = r.value === null ? '' : '0';
    data.reached = Math.max(data.reached, Math.min(5, G.session.realm + 1));
    store.save(data);
    setMode('clear');
    audio.play(null);
    audio.sfx('clear');
}

function afterClear() {
    const s = G.session;
    if (s.realm >= REALMS.length - 1) { toEnding(); return; }
    toIntro(s.realm + 1);
}

function toEnding() {
    data.cleared = true; store.save(data);
    setMode('ending');
    audio.play('ending');
}

function afterEnding() {
    const s = G.session;
    s.loop++;
    toIntro(0);
}

function toContinue() { setMode('continue'); G.contN = 9; G.contT = 0; audio.play(null); }

function doContinue() {
    useCredit();
    const s = G.session, w = G.world;
    s.lives = 3; s.continues++;
    w.over = false; w.player.deadT = 0.05;
    audio.sfx('start');
    audio.play(w.boss && w.boss.active && !w.boss.dead ? 'boss' : REALMS[w.realmIndex].song, true);
    setMode('play'); G.acc = 0;
}

function toGameOver() { setMode('gameover'); audio.sfx('gameover'); }

function afterGameOver() {
    const s = G.session;
    if (store.rank(data, s.score) >= 0) {
        G.entry = { letters: ['A', 'A', 'A'], pos: 0 };
        setMode('entry');
        audio.play('entry');
    } else toAttract(4);
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ.!♥ ';
function finishEntry() {
    const s = G.session;
    store.record(data, { name: G.entry.letters.join(''), score: s.score, realm: s.realm + 1, mode: s.mode });
    store.save(data);
    audio.sfx('start');
    toAttract(4);
}

// ================================================================== menus
function selectRows() {
    const s = data.settings;
    const realm = Math.min(G.selRealm || 0, data.reached);
    return [
        { label: 'MODE', value: s.mode === 'remix' ? 'REMIX' : 'ARCADE', arrows: true, act: 'mode' },
        { label: 'SKILL', value: `${SKILL[s.skill].name} (${SKILL[s.skill].sw})`, arrows: true, act: 'skill' },
        { label: 'START REALM', value: data.reached > 0 ? `${realm + 1} ${REALMS[realm].name.split(' ').slice(-1)[0]}` : '1', arrows: data.reached > 0, act: 'realm', disabled: data.reached <= 0 },
        { label: 'OPTIONS', act: 'options' },
        { label: 'START GAME', act: 'go' },
    ];
}

function optionRows() {
    const s = data.settings;
    const on = (b) => (b ? 'ON' : 'OFF');
    return [
        { label: 'SOUND FX', value: on(s.sound), act: 'sound' },
        { label: 'MUSIC', value: on(s.music), act: 'music' },
        { label: 'ARCADE NOISE', value: on(s.amb), act: 'amb' },
        { label: 'VOLUME', value: `${Math.round(s.volume * 10)}`, arrows: true, act: 'volume' },
        { label: 'CRT', value: crt ? on(s.crt) : 'N/A', act: 'crt' },
        { label: 'VIEW', value: s.view.toUpperCase(), act: 'view' },
        { label: 'SCREEN SHAKE', value: on(s.shake), act: 'shake' },
        { label: 'GRAPHICS', value: s.quality.toUpperCase(), act: 'quality' },
        { label: 'SOUND TEST', act: 'jukebox' },
        { label: 'BACK', act: 'back' },
    ];
}

function changeOption(act, dir) {
    const s = data.settings;
    const cyc = (list, v) => list[(list.indexOf(v) + (dir < 0 ? list.length - 1 : 1)) % list.length];
    switch (act) {
        case 'sound': s.sound = !s.sound; break;
        case 'music': s.music = !s.music; break;
        case 'amb': s.amb = !s.amb; break;
        case 'volume': s.volume = Math.round(Math.max(0, Math.min(1, s.volume + (dir || 1) * 0.1)) * 10) / 10; break;
        case 'crt': s.crt = !s.crt; break;
        case 'view': s.view = cyc(['auto', 'cabinet', 'screen'], s.view); break;
        case 'shake': s.shake = !s.shake; break;
        case 'quality': s.quality = cyc(['auto', 'high', 'low'], s.quality); break;
        case 'mode': s.mode = s.mode === 'remix' ? 'arcade' : 'remix'; break;
        case 'skill': s.skill = s.skill === 'expert' ? 'novice' : 'expert'; break;
        case 'realm': G.selRealm = ((G.selRealm || 0) + (dir || 1) + data.reached + 1) % (data.reached + 1); break;
        default: return false;
    }
    store.save(data);
    applySettings();
    audio.sfx('move');
    return true;
}

/** Generic list-menu driver. Returns the act of a confirmed row, or 'back'. */
function driveMenu(inp, rows) {
    for (const tp of inp.taps) {
        const x = tp.x * W, y = tp.y * H;
        const hit = SC.taps.find((t) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h);
        if (hit && hit.act && hit.act.row !== undefined) {
            if (rows[hit.act.row].disabled) continue;
            G.sel = hit.act.row; audio.sfx('select');
            return rows[G.sel].act;
        }
    }
    if (inp.up || inp.down) {
        const d = inp.up ? -1 : 1;
        for (let k = 0; k < rows.length; k++) { G.sel = (G.sel + d + rows.length) % rows.length; if (!rows[G.sel].disabled) break; }
        audio.sfx('move');
    }
    if ((inp.left || inp.right) && rows[G.sel] && rows[G.sel].value !== undefined) changeOption(rows[G.sel].act, inp.left ? -1 : 1);
    if (inp.back) { audio.sfx('back'); return 'back'; }
    if (inp.confirm && rows[G.sel] && !rows[G.sel].disabled) { audio.sfx('select'); return rows[G.sel].act; }
    return null;
}

function tapAct(inp) {
    for (const tp of inp.taps) {
        const x = tp.x * W, y = tp.y * H;
        const hit = SC.taps.find((t) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h);
        if (hit) return hit.act;
    }
    return null;
}

// ================================================================== events → effects and sound
const DEATH_TEXT = { bite: 'SWALLOWED!', null: 'DELETED!', collapse: 'CRUSHED!', laser: 'ZAPPED!', fire: 'TOASTED!', ice: 'FROZEN!', blast: 'BLOWN UP!', boss: 'CRUSHED!', zap: 'SHORTED OUT!', glitch: 'GLITCHED!', bossfire: 'TOASTED!' };
const CASTLE_COL = { gold: '#ffd23a', onyx: '#9aa0c0', pearl: '#ffffff', neon: '#2ae8c0', violet: '#b070ff', chrome: '#e8f0ff' };

function onEvent(e, quiet) {
    G.seen[e.type] = (G.seen[e.type] || 0) + 1;
    const fx = R.fx;
    const S = quiet ? () => {} : (n, o) => audio.sfx(n, o);
    switch (e.type) {
        case 'pickup': S(e.kind === 'key' ? 'key' : 'pickup'); fx.burst(e.x, e.y, '#ffffff', 8, 40, 0.35, 1); break;
        case 'chalice': S('chalice'); fx.ring(e.x, e.y, '#ffd23a', 40, 0.6, 2); if (!quiet) R.message('THE CHALICE!', '#ffd23a', 2.4, 'CARRY IT TO THE SUNSET KEEP'); break;
        case 'drop': S('drop'); break;
        case 'slash': S('slash'); break;
        case 'dash': S('dash'); fx.burst(e.x, e.y, '#ff5ad2', 10, 50, 0.3, 1.2); break;
        case 'hurt': S('hurt'); fx.shake(0.35); fx.flash('#ff2a50', 0.3); fx.burst(e.x, e.y, '#ff6080', 12, 70, 0.4); break;
        case 'die':
            S(e.cause === 'bite' ? 'swallow' : 'die'); fx.shake(0.7);
            if (e.cause !== 'bite') { fx.burst(e.x, e.y, '#29e6ff', 40, 110, 0.9, 1.6); fx.burst(e.x, e.y, '#ffffff', 20, 60, 0.6, 1); fx.flash('#ffffff', 0.4); }
            if (!quiet) R.message(DEATH_TEXT[e.cause] || 'OUCH!', '#ff2a50', 2);
            break;
        case 'respawn': S('respawn'); fx.ring(e.x, e.y, '#29e6ff', 26, 0.5, 1.5); break;
        case 'jaws': S('jaws'); break;
        case 'snap': S('snap'); break;
        case 'roar': S('roar', { big: e.kind === 'boss' }); if (e.kind === 'boss') fx.shake(0.3); break;
        case 'tell': S('tell'); break;
        case 'fire': S('fire'); break;
        case 'ice': S('ice'); break;
        case 'dhit': S('dhit'); fx.burst(e.x, e.y, '#ffffff', 12, 80, 0.3); fx.shake(0.18); break;
        case 'dkill': {
            S('dkill'); fx.shake(0.55); fx.flash('#ffffff', 0.22);
            const fr = R.A.dragons[e.kind].frames[0];
            fx.shatter(fr.img, e.x - 12, e.y - 14, false, 90);
            fx.ring(e.x, e.y, R.A.dragons[e.kind].pal.glow, 34, 0.5, 2);
            fx.text(e.x, e.y - 18, e.combo > 1 ? `COMBO ×${e.combo}` : 'SLAIN!', e.combo > 1 ? '#fff27a' : '#ffffff');
            break;
        }
        case 'gate': S('gate'); fx.burst(e.x, e.y, CASTLE_COL[e.color] || '#fff', 24, 70, 0.6); if (!quiet) R.message('GATE OPEN', CASTLE_COL[e.color] || '#fff', 1.8); break;
        case 'block': S('block'); fx.burst(e.x, e.y, '#29e6ff', 8, 60, 0.3); break;
        case 'fizz': S('fizz'); fx.burst(e.x, e.y, e.kind === 'ice' ? '#a0f0ff' : '#ff8a1a', 5, 40, 0.25); break;
        case 'teleport': S('teleport'); fx.ring(e.tx, e.ty, '#ff5ad2', 30, 0.4, 2); fx.flash('#ff5ad2', 0.35); break;
        case 'arm': S('arm'); break;
        case 'blast': S('blast'); fx.shake(0.8); fx.flash('#ffb060', 0.45); fx.burst(e.x, e.y, '#ff8a1a', 50, 140, 0.8, 2); fx.burst(e.x, e.y, '#fff27a', 20, 80, 0.5, 1.5); fx.ring(e.x, e.y, '#ffb060', 44, 0.4, 3); break;
        case 'rubble': S('rubble'); fx.burst(e.x, e.y, '#c08040', 5, 50, 0.6, 1.5); break;
        case 'bridge': S('bridge'); fx.burst(e.x, e.y, '#ffd040', 14, 50, 0.4); break;
        case 'dispense': fx.ring(e.x, e.y, '#ff2a50', 14, 0.4, 1); break;
        case 'batgrab': S('batgrab'); break;
        case 'snatch': S('snatch'); if (!quiet) R.message('BYTE STOLE IT!', '#5cf0b0', 1.8); break;
        case 'bathit': S('bathit'); fx.burst(e.x, e.y, '#5cf0b0', 16, 70, 0.5); fx.text(e.x, e.y - 10, '300', '#5cf0b0'); break;
        case 'batdrop': break;
        case 'gem': S('gem', { chain: e.chain, big: e.big }); fx.burst(e.x, e.y, e.big ? '#ff5ad2' : '#29e6ff', 8, 40, 0.35, 1); fx.text(e.x, e.y - 8, e.big ? '500' : '100', e.big ? '#ff5ad2' : '#29e6ff'); break;
        case 'battery': S('battery'); fx.text(e.x, e.y - 8, 'SHIELD+', '#3aff7a'); break;
        case 'oneup': case 'extra': S('oneup'); if (!quiet) R.message('1UP!', '#29e6ff', 1.6); break;
        case 'cassette':
            S('cassette');
            if (!data.cassettes.includes(e.song)) { data.cassettes.push(e.song); store.save(data); }
            if (!quiet) R.message('CASSETTE!', '#ff5ad2', 2.4, `"${SONGS[e.song].name}" IN THE SOUND TEST`);
            break;
        case 'shard': S('shard'); fx.ring(e.x, e.y, '#e8f0ff', 24, 0.4, 1.5); if (!quiet) R.message(`CHROME SHARD ${e.n}/3`, '#e8f0ff', 1.8); break;
        case 'citadel': S('citadel'); fx.shake(0.4); if (!quiet) R.message('THE CITADEL OPENS', '#e8f0ff', 2.6); break;
        case 'nullwarn': S('nullwarn'); if (!quiet) R.message('THE GRID IS GLITCHING', '#ff2ece', 2.4, 'HURRY!'); break;
        case 'null': S('null'); fx.flash('#ffffff', 0.3); if (!quiet) R.message('THE NULL HUNTS YOU', '#ff2ece', 2.4); break;
        case 'nullstun': S('nullstun'); fx.burst(e.x, e.y, '#ffffff', 16, 80, 0.4); break;
        case 'boss': S('boss'); audio.play('boss'); fx.shake(0.6); if (!quiet) R.message('CHROMAGON', '#e8f0ff', 3, 'STRIKE WHEN HIS CHROME GOES DULL'); break;
        case 'phase': S('phase'); fx.flash('#ffffff', 0.6); fx.shake(0.7); fx.ring(e.x, e.y, '#ff2ece', 80, 0.6, 3); if (!quiet) R.message(`PHASE ${e.phase}`, '#ff2ece', 1.8); break;
        case 'bosshit': S('bosshit'); fx.burst(e.x, e.y, '#ffffff', 20, 100, 0.4); fx.shake(0.25); break;
        case 'clank': S('clank'); fx.burst(e.x, e.y, '#fff27a', 6, 60, 0.2); break;
        case 'dive': S('roar', { big: true }); break;
        case 'slam': S('slam'); fx.shake(0.5); fx.burst(e.x, e.y, '#c8d4e8', 20, 90, 0.5); break;
        case 'fan': S('fan'); break;
        case 'laserTell': S('laserTell'); break;
        case 'laser': S('laser'); fx.shake(0.35); break;
        case 'bossdie': S('phase'); fx.flash('#ffffff', 0.8); fx.shake(1); if (!quiet) R.message('CHROMAGON FALLS!', '#ffd23a', 3); break;
        case 'bossboom': S('bossboom'); fx.burst(e.x, e.y, Math.random() < 0.5 ? '#ff8a1a' : '#e8f0ff', 18, 100, 0.5, 1.6); fx.shake(0.3); break;
        case 'bossgone': fx.shatter(R.A.boss.frames[0].img, e.x - 20, e.y - 22, false, 120); fx.flash('#ffffff', 0.7); break;
        case 'collapse': if (!quiet) R.message('THE CITADEL IS FALLING', '#ff2a50', 3, 'RUN HOME!'); fx.shake(0.6); break;
        case 'rumble': fx.shake(e.left <= 10 ? 0.2 : 0.08); if (e.left <= 10) S('tick'); break;
        case 'barrier': S('barrier'); fx.flash('#ffffff', 0.4); if (!quiet) R.message('THE WALL DISSOLVES', '#c8d4e8', 2.2); break;
        case 'secret': S('secret'); if (!quiet) R.message('SECRET ROOM!', '#ff5ad2', 3, '+25000'); break;
        case 'blink': case 'shimmer': S('blink'); fx.ring(e.tx ?? e.x, e.ty ?? e.y, '#ff40e0', 20, 0.3, 1); break;
        case 'minidie': fx.burst(e.x, e.y, '#ff2ece', 10, 60, 0.3); break;
        case 'nouse': S('nouse'); break;
        case 'room': S('room'); break;
        case 'batwake': break;
    }
}

// ================================================================== per-mode update
function updatePlay(dt, inp) {
    const w = G.world;
    if (inp.pause || inp.start || (inp.esc && !G.bot)) { pause(); return; }
    let acc = G.acc + dt * FAST;
    let first = true, steps = 0;
    while (acc >= SIM_DT && steps < 8 * FAST) {
        const snap = G.bot ? G.bot.think(SIM_DT) : { ax: inp.ax, ay: inp.ay, use: first && inp.a, drop: first && inp.b, dash: first && inp.c };
        w.step(SIM_DT, snap);
        first = false; acc -= SIM_DT; steps++;
        if (w.cleared || w.over) break;
    }
    if (steps >= 8 * FAST) acc = 0;
    G.acc = acc;
    for (const e of w.events) onEvent(e, false);
    w.events.length = 0;
    musicFor(w);
    if (w.cleared && G.mode === 'play') {
        G.clearT += dt;
        if (G.clearT === dt) R.message('CHALICE HOME!', '#ffd23a', 2);
        if (G.clearT > 1.4) { G.clearT = 0; toClear(); }
    }
    if (w.over && G.mode === 'play') toContinue();
}

function musicFor(w) {
    const room = w.map.rooms[w.room];
    const bossOn = w.boss && w.boss.active && !w.boss.dead;
    if (!bossOn && audio.song && audio.song.id === 'boss' && !(w.collapseT > 0)) audio.play(REALMS[w.realmIndex].song);
    audio.calm = !!(room && room.vault && !bossOn);
    const chasing = w.dragons.some((d) => !d.dead && (d.state === 'chase' || d.state === 'bite') && w.roomOf(d) === w.room);
    audio.layer = room && room.dark ? 2 : chasing ? 4 : 3;
    const n = w.nul;
    let gl = 0;
    if (n.active) { const p = w.player; gl = Math.max(0, 1 - Math.hypot(n.x - p.x, n.y - p.y) / 140); }
    audio.glitch = gl;
    G.glitch = gl;
}

function updateDemo(dt) {
    const w = G.world;
    G.acc += dt;
    let steps = 0;
    while (G.acc >= SIM_DT && steps < 8) { w.step(SIM_DT, G.bot.think(SIM_DT)); G.acc -= SIM_DT; steps++; }
    for (const e of w.events) onEvent(e, true);
    w.events.length = 0;
    if (w.cleared || w.over || G.pageT > PAGES[5][1]) nextPage();
}

function update(dt, inp) {
    G.t += dt; G.modeT += dt;
    if (inp.coin) insertCoin();
    if (inp.mute) { data.settings.sound = !data.settings.sound; data.settings.music = data.settings.sound; store.save(data); applySettings(); }
    if (inp.view) { data.settings.view = data.settings.view === 'screen' ? 'cabinet' : 'screen'; store.save(data); applySettings(); }
    R.credits = G.credits;
    switch (G.mode) {
        case 'attract': {
            G.pageT += dt;
            if (G.demo) updateDemo(dt);
            else if (G.pageT > PAGES[G.page][1]) nextPage();
            const tapped = tapAct(inp);
            if (inp.start || inp.a || tapped === 'start') { toSelect(); return; }
            if (inp.right) nextPage();
            break;
        }
        case 'select': {
            G.rows = selectRows();
            const act = driveMenu(inp, G.rows);
            if (act === 'back') toAttract();
            else if (act === 'options') { G.from = 'select'; setMode('options'); }
            else if (act === 'go') newGame();
            else if (act === 'mode' || act === 'skill' || act === 'realm') changeOption(act, 1);
            break;
        }
        case 'options': {
            G.rows = optionRows();
            const act = driveMenu(inp, G.rows);
            if (act === 'back') { const f = G.from; setMode(f === 'pause' ? 'pause' : 'select'); if (f === 'pause') { G.from = 'play'; G.sel = 1; } else G.sel = 3; }
            else if (act === 'jukebox') { setMode('jukebox'); G.jukeSel = 0; G.jukeBack = G.from; }
            else if (act) changeOption(act, 1);
            break;
        }
        case 'jukebox': {
            const unlocked = jukeUnlocked();
            const rows = JUKEBOX.map((id) => ({ act: id, disabled: !unlocked.includes(id) })).concat([{ act: 'back' }]);
            G.sel = G.jukeSel;
            const act = driveMenu(inp, rows);
            G.jukeSel = G.sel;
            if (act === 'back') { audio.play(G.jukeBack === 'pause' && G.world ? REALMS[G.world.realmIndex].song : 'title'); G.from = G.jukeBack; setMode('options'); G.sel = 8; }
            else if (act) audio.play(act, true);
            break;
        }
        case 'intro':
            if ((G.modeT > 0.6 && (inp.confirm || tapAct(inp))) || G.modeT > 3.4) startRealm();
            break;
        case 'play':
            updatePlay(dt, inp);
            break;
        case 'pause': {
            const rows = [{ label: 'RESUME', act: 'resume' }, { label: 'OPTIONS', act: 'options' }, { label: 'QUIT', act: 'quit' }];
            G.rows = rows;
            if (inp.pause) { resume(); break; }
            const act = driveMenu(inp, rows);
            if (act === 'resume' || act === 'back') resume();
            else if (act === 'options') { G.from = 'pause'; setMode('options'); }
            else if (act === 'quit') { if (store.rank(data, G.session.score) >= 0) { G.entry = { letters: ['A', 'A', 'A'], pos: 0 }; setMode('entry'); audio.play('entry'); } else toAttract(); }
            break;
        }
        case 'clear': {
            const T = G.tally;
            if (!T.done) {
                const r = T.rows[T.k];
                if (r && r.value !== null) {
                    const step = Math.max(50, Math.round(r.value / 40));
                    r.cur = Math.min(r.value, (r.cur || 0) + step);
                    r.shown = String(r.cur);
                    T.total = Math.min(G.session.score, T.total + step);
                    audio.sfx('tally');
                    if (r.cur >= r.value) T.k++;
                } else T.k++;
                if (T.k >= T.rows.length) { T.done = true; T.total = G.session.score; }
                if (inp.confirm || tapAct(inp)) { for (const rr of T.rows) if (rr.value !== null) rr.shown = String(rr.value); T.done = true; T.total = G.session.score; }
            } else if (inp.confirm || tapAct(inp) || G.modeT > 9) afterClear();
            break;
        }
        case 'continue': {
            G.contT += dt;
            if (G.contT >= 1.1) { G.contT = 0; G.contN--; audio.sfx('tick'); if (G.contN < 0) { toGameOver(); break; } }
            const tap = tapAct(inp);
            if (inp.start || inp.a || tap === 'confirm') doContinue();
            else if (inp.b || tap === 'back') toGameOver();
            break;
        }
        case 'gameover':
            if (G.modeT > 3.5 || (G.modeT > 1 && (inp.confirm || tapAct(inp)))) afterGameOver();
            break;
        case 'entry': {
            const E = G.entry;
            const cyc = (i, d) => { const k = LETTERS.indexOf(E.letters[i]); E.letters[i] = LETTERS[(k + d + LETTERS.length) % LETTERS.length]; audio.sfx('move'); };
            const tap = tapAct(inp);
            if (tap && tap.up !== undefined) { E.pos = tap.up; cyc(tap.up, -1); }
            else if (tap && tap.down !== undefined) { E.pos = tap.down; cyc(tap.down, 1); }
            else if (tap === 'confirm') { E.pos++; audio.sfx('select'); }
            if (inp.up && E.pos < 3) cyc(E.pos, -1);
            if (inp.down && E.pos < 3) cyc(E.pos, 1);
            if (inp.right && E.pos < 3) { E.pos++; audio.sfx('move'); }
            if (inp.left && E.pos > 0) { E.pos--; audio.sfx('move'); }
            if (inp.confirm) { E.pos++; audio.sfx('select'); }
            if (inp.back && E.pos > 0) E.pos--;
            if (E.pos >= 3) finishEntry();
            break;
        }
        case 'ending':
            if ((G.modeT > 10 && (inp.confirm || tapAct(inp))) || G.modeT > 34) afterEnding();
            break;
    }
}

function jukeUnlocked() {
    const ids = ['title', 'entry'];
    for (const r of REALMS) if (data.cassettes.includes(r.song)) ids.push(r.song);
    if (data.reached >= 5 || data.cleared) ids.push('boss');
    if (data.cleared) ids.push('ending');
    return ids;
}

// ================================================================== draw
function draw(dt) {
    R.pulse = audio.beat();
    const t = G.t;
    const hi = hiScore();
    switch (G.mode) {
        case 'boot': SC.clear(); break;
        case 'attract': {
            const p = PAGES[G.page][0];
            if (p === 'demo' && G.world) { R.hi = hi; R.draw(G.world, dt); SC.demoOverlay(G.pageT, G.credits); }
            else if (p === 'title') SC.title(t, G.credits, hi);
            else if (p === 'story') SC.story(G.pageT, G.credits, hi);
            else if (p === 'howto') SC.howto(t, G.credits, hi, R.A);
            else if (p === 'cast') SC.cast(G.pageT, G.credits, hi, R.A);
            else if (p === 'scores') SC.scores(t, G.credits, hi, data.hiscores);
            break;
        }
        case 'select': SC.menu('GAME SELECT', G.rows || selectRows(), G.sel, t, { foot: 'ARCADE: THE REALMS AS DESIGNED.  REMIX: SHUFFLED' }); break;
        case 'options': SC.menu('OPTIONS', G.rows || optionRows(), G.sel, t, { y0: 50, gap: 15 }); break;
        case 'jukebox': SC.jukebox(G.jukeSel, jukeUnlocked(), audio.song ? audio.song.id : null, t); break;
        case 'intro': SC.intro(G.session.realm, G.session.loop, G.modeT, R.A, `${SKILL[G.session.skill].name} (${SKILL[G.session.skill].sw})${G.session.mode === 'remix' ? '  REMIX' : ''}`); break;
        case 'play': R.draw(G.world, dt); break;
        case 'pause': R.draw(G.world, 0); SC.menu('PAUSED', G.rows || [], G.sel, t, { backdrop: false, y0: 100, color: '#ff2ece' }); break;
        case 'clear': R.draw(G.world, dt); SC.tally(G.tally.rows, G.tally.total, G.modeT, G.tally.done); break;
        case 'continue': R.draw(G.world, dt); SC.cont(Math.max(0, G.contN), G.credits, t); break;
        case 'gameover': R.draw(G.world, dt); SC.gameover(G.modeT); break;
        case 'entry': SC.entry(G.session.score, G.entry.letters, G.entry.pos, t); break;
        case 'ending': SC.ending(G.modeT, G.session.score); break;
    }
    // the tube
    const t0 = performance.now();
    if (crt && data.settings.crt) {
        crt.render(screenCanvas, { time: t, glitch: (G.mode === 'play' ? G.glitch || 0 : 0), curv: 1, persist: G.modeT < 0.12 ? 0 : PERSIST });
    }
    // light spilling out of the screen: from what is on it, without reading pixels back
    G.spillT -= dt;
    if (G.spillT <= 0) {
        G.spillT = 0.2;
        let sp = [255, 46, 206];
        if (G.world && (G.mode === 'play' || G.mode === 'pause' || G.demo)) {
            sp = hexRGB(STYLES[G.world.map.realm.style].hud);
            const room = G.world.map.rooms[G.world.room];
            if (room && room.dark) sp = sp.map((v) => v * 0.35);
        } else if (G.mode === 'ending' || G.mode === 'intro') sp = [255, 150, 60];
        if (R.fx.flashA > 0.2) sp = hexRGB(R.fx.flashC);
        sp = sp.map((v) => Math.round(v));
        document.documentElement.style.setProperty('--spill', sp.join(','));
        arcade.spill = sp;
    }
    const t1 = performance.now();
    arcade.draw(dt);
    if (DEBUG) { const p = G.prof || (G.prof = {}); p.crt = (p.crt || 0) * 0.9 + (t1 - t0) * 0.1; p.arcade = (p.arcade || 0) * 0.9 + (performance.now() - t1) * 0.1; }
}
function hexRGB(h) { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

// ================================================================== the loop
let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
    last = now;
    try {
        const inp = input.frame(dt);
        update(dt, inp);
        draw(dt);
    } catch (e) {
        console.error(e);
    }
    // frame-rate watch, on the wall clock: after three slow seconds in a row, drop to the lighter tier
    G.fpsN++;
    if (!G.fpsWall) G.fpsWall = now;
    if (now - G.fpsWall >= 1000) {
        G.fps = G.fpsN * 1000 / (now - G.fpsWall);
        G.fpsN = 0; G.fpsWall = now;
        if (data.settings.quality === 'auto' && G.fps < 40 && !DEBUG) {
            if (++G.slow >= 3 && R.S > 2) { R.setScale(2); R.fx.quality = 0.6; arcade.lowPower = true; }
        } else G.slow = 0;
    }
    if (DEBUG) {
        const p = G.prof || (G.prof = {});
        p.frame = (p.frame || 0) * 0.9 + (performance.now() - now) * 0.1;
    }
}

// ================================================================== boot
async function boot() {
    applySettings();
    try { if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load('40px Yellowtail'), document.fonts.load('16px "Press Start 2P"')]), new Promise((r) => setTimeout(r, 1500))]); } catch { /* fonts optional */ }
    layout();
    $('boot').hidden = true;
    toAttract(0);
    requestAnimationFrame(frame);
}
boot();

if (DEBUG) {
    window.__cc = {
        get mode() { return G.mode; }, get pageName() { return PAGES[G.page][0]; }, get world() { return G.world; }, get session() { return G.session; },
        get credits() { return G.credits; }, G, data, R, audio, input, crt: () => !!crt,
        start(realm = 0, opts = {}) {
            audio.init();
            G.credits = 1; useCredit();
            if (opts.skill) data.settings.skill = opts.skill;
            if (opts.mode) data.settings.mode = opts.mode;
            G.session = newSession({ skill: data.settings.skill, mode: data.settings.mode, realm, remix: opts.remix || 7 });
            G.session.realm = realm;
            toIntro(realm); startRealm();
            return G.mode;
        },
        god(on = true) { G.god = on; if (G.world) G.world.god = on; },
        autoplay(on = true) { G.autoplay = on; if (G.world) G.bot = on ? new Bot(G.world) : null; },
        page(n) { G.page = n; G.pageT = 0; if (PAGES[n][0] === 'demo') startDemo(); },
        clearRealm() { const w = G.world; const ch = w.items.find((i) => i.kind === 'chalice'); const R0 = w.roomRect(w.map.homeVault); if (ch) { ch.holder = null; ch.x = R0.x + 150; ch.y = R0.y + 90; } else { w.boss.dead = true; w.boss.active = false; } return true; },
        kill() { const w = G.world; w.session.lives = 0; w.player.inv = 0; w.die('zap'); },
        ending() { toEnding(); },
        layout,
        set(k, v) { data.settings[k] = v; applySettings(); },
    };
}
