// TEE & SORCERY — boot, the mode machine and the frame loop.
//   title → creator → story(prologue) → map ⇄ clubhouse
//   map → [story] → hole (intro fly-over → play → result) → [story] → map … → ending → credits
// The simulation runs at a fixed 240 Hz; everything else follows its event queue.
// ?debug=1 exposes window.__ts for tests; ?hole=ID jumps straight into a hole.

import * as THREE from 'three';
import { Renderer } from './view/renderer.js';
import { Sky } from './view/sky.js';
import { Fx } from './view/fx.js';
import { CameraDirector } from './view/camera.js';
import { HoleView } from './view/holeview.js';
import { MapView } from './view/mapview.js';
import { Stage } from './view/stage.js';
import { Portraits } from './view/portrait.js';
import { TOON } from './view/toon.js';
import { setPose } from './view/anim.js';
import { buildHumanoid, heroLook } from './view/chars.js';
import { MAP_PALETTE } from './view/palette.js';
import { HOLES, HOLE_BY_ID, holeIndex } from './sim/holes.js';
import { buildCourse } from './sim/course.js';
import { World } from './sim/world.js';
import { CLUBS, CLUB_ORDER } from './sim/clubs.js';
import { SURF, SURF_NAMES } from './sim/realms.js';
import { newProfile, applyResult, buy, equip, allocate, autoAllocate, addXp, SPELL_ORDER, scoreName, ITEMS, LOOKS, OUTFITS } from './sim/rpg.js';
import { SCENES, TIPS, REALM_SPELL } from './sim/story.js';
import { audio, REALM_THEME } from './audio.js';
import { Input } from './input.js';
import { Swing } from './ui/swing.js';
import { Hud } from './ui/hud.js';
import { Dialogue } from './ui/dialogue.js';
import { Menus } from './ui/menus.js';
import * as store from './save.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug');
const SIM_DT = 1 / 240;
const FAST = DEBUG ? Math.max(1, +(Q.get('fast') ?? 1)) : 1;   // tests: run the simulation N× per frame
const SCREENS = ['title', 'creator', 'map', 'clubhouse', 'credits'];

class App {
    constructor() {
        const data = store.load();
        this.profile = data.profile;
        this.settings = data.settings;
        this.R = new Renderer($('view'));
        this.input = new Input($('view'));
        this.autoQ = this.input.touch ? 1 : 2;
        this.R.setQuality(this.settings.quality >= 0 ? this.settings.quality : this.autoQ);
        this.sky = new Sky(this.R.scene);
        this.fx = new Fx(this.R.scene);
        this.dir = new CameraDirector(this.R.camera);
        this.dir.baseFov = 52;
        this.hv = new HoleView(this.R, this.fx, this.sky, this.dir);
        this.map = new MapView(this.R, this.sky, this.fx);
        this.stage = new Stage(this.R, this.sky, this.fx);
        this.portraits = new Portraits();
        this.hud = new Hud(this);
        this.dlg = new Dialogue(this.portraits);
        this.menus = new Menus(this);
        this.swing = new Swing();
        audio.setVolumes(this.settings.music, this.settings.sfx);
        this.mode = 'boot';
        this.t = 0; this.acc = 0; this.last = performance.now();
        this.slow = 0;
        this.world = null;
        this.overlay = null;
        document.addEventListener('click', (e) => this.onClick(e));
        this.input.on((a, d) => this.onAction(a, d));
        const unlock = () => audio.init();
        for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true });
        document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'hole' && !this.overlay && this.playing()) this.openPause(); });
        if (DEBUG) this.debugHooks();
        requestAnimationFrame((t) => this.frame(t));
        const jump = Q.get('hole');
        if (jump && HOLE_BY_ID[jump]) {
            if (!this.profile) this.profile = newProfile();
            this.loaded();
            this.startHole(jump, { skipStory: true });
        } else {
            this.goTitle();
            this.loaded();
        }
    }

    loaded() { setTimeout(() => $('loading').classList.add('done'), 150); }

    // everything a hole leaves on screen
    leaveHole() {
        this.intro = false;
        this.world = null;
        this.swing.reset();
        this.hud.show(false);
        this.hud.holeCard(null, false);
        $('banner').classList.add('hidden');
        this.hud.closeItems();
        $('toasts').innerHTML = '';
    }

    // ================================================================ helpers
    showScreen(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }
    showScene(which) {
        this.hv.root.visible = which === 'hole';
        this.map.root.visible = which === 'map';
        this.stage.root.visible = which === 'stage';
        this.R.story.uniforms.uTilt.value = which === 'map' ? 1 : 0;
    }
    fade(fn) {
        const f = $('fade');
        f.classList.add('on');
        setTimeout(() => { try { fn(); } finally { setTimeout(() => f.classList.remove('on'), 60); } }, 360);
    }
    persist() { store.save({ profile: this.profile, settings: this.settings }); }
    progress() { let n = 0; for (let r = 0; r < 5; r++) if (this.profile.holes[`${r + 1}-4`]) n = r + 1; return n; }
    unlocked = (i) => i === 0 || i === 1 || !!this.profile?.holes[HOLES[i - 2]?.id] || !!this.profile?.holes[HOLES[i - 1]?.id];
    playing() { return this.world && !['done', 'failed'].includes(this.world.s.phase); }

    // ================================================================ title
    goTitle() {
        this.mode = 'title';
        this.closeOverlays();
        this.leaveHole();
        this.showScreen('title');
        this.menus.title(!!this.profile);
        audio.play('title');
        // backdrop: Windmill Way at golden hour, the hero practising swings
        const prof = this.profile ?? newProfile();
        const c = buildCourse(HOLE_BY_ID['1-2']);
        this.titleWorld = new World(c, { profile: prof, quiet: true });
        this.world = null;
        this.hv.build(c, this.titleWorld, prof);
        this.showScene('hole');
        const hp = this.hv.hero.root.position;
        this.dir.setOrbit(hp.x, hp.z, 7.5, 2.4, 0.1);
        this.dir.orbitC.y = hp.y; this.dir.orbitY = 1.7;
        this.dir.update(1); this.dir.snap();
        setPose(this.hv.hero, 'idle');
        this.titleT = 0;
    }

    startCreator() {
        this.mode = 'creator';
        this.creatorState = { look: 0, outfit: 0 };
        this.showScreen('creator');
        $('hero-name').value = 'Pip';
        this.menus.creator(this.creatorState);
        this.refreshCreatorHero();
        const h = this.hv.hero.root.position;
        this.dir.setFocus(new THREE.Vector3(h.x, h.y + 1.6, h.z), new THREE.Vector3(h.x - 3.2, h.y + 2.4, h.z + 4.8), 3);
    }
    refreshCreatorHero() {
        const st = this.creatorState;
        const old = this.hv.hero;
        const rig = buildHumanoid(heroLook(LOOKS[st.look], OUTFITS[st.outfit]));
        rig.root.scale.copy(old.root.scale);
        rig.root.position.copy(old.root.position);
        rig.root.rotation.y = 0.6;
        this.hv.root.remove(old.root);
        this.hv.root.add(rig.root);
        this.hv.hero = rig;
        this.hv.heroAt = null;
        setPose(rig, 'cheer');
        clearTimeout(this.cheerT);
        this.cheerT = setTimeout(() => { if (this.hv.hero === rig) setPose(rig, 'idle'); }, 900);
    }
    finishCreator() {
        const name = ($('hero-name').value || 'Pip').trim().slice(0, 12) || 'Pip';
        this.profile = newProfile(name, this.creatorState.look, this.creatorState.outfit);
        this.persist();
        this.playStory('prologue', () => { this.profile.flags.prologue = true; this.persist(); this.goMap(1); });
    }

    // ================================================================ story
    playStory(id, then, inline = false) {
        const sc = SCENES[id];
        if (!sc) { then?.(); return; }
        if (inline) {
            this.dlg.play(id, this.profile, { inline: true, onDone: then });
            return;
        }
        this.fade(() => {
            this.mode = 'story';
            this.closeOverlays();
            this.leaveHole();
            this.showScreen(null);
            this.stage.build(sc.stage, sc.cast, this.profile);
            this.showScene('stage');
            audio.play(sc.stage === 'clubhouse' ? (id === 'ending' ? 'ending' : 'club') : REALM_THEME[['meadow', 'sand', 'frost', 'cinder', 'sky'].indexOf(sc.stage)] ?? 'map');
            if (id === 'boss:4' || id === 'phase2') audio.play('final');
            this.stage.update(0, 0, this.dir); this.dir.update(1); this.dir.snap();
            this.dlg.play(id, this.profile, { onLine: (who, mood) => this.stage.speak(who, mood), onDone: () => this.fade(() => then?.()) });
        });
    }

    // ================================================================ map
    goMap(select = null) {
        this.mode = 'map';
        this.closeOverlays();
        this.leaveHole();
        this.showScreen('map');
        this.hv.clear();
        this.stage.clear();
        this.R.setPalette(MAP_PALETTE);
        this.sky.apply(MAP_PALETTE, new THREE.Vector3(0, 0, 0), 130, 99);
        this.fx.setAmbient(null);
        this.map.build(this.profile);
        this.map.refresh(this.profile, this.unlocked);
        this.showScene('map');
        audio.play('map');
        this.map.sel = this.map.cur;
        this.map.update(0, this.t, this.dir); this.dir.update(1); this.dir.snap();
        this.menus.mapTop(this.profile);
        this.updateMapCard();
        if (select !== null && select !== this.map.cur && this.unlocked(select)) this.mapWalk(select);
    }
    updateMapCard() {
        const i = this.map.walk ? this.map.walk.target : this.map.cur;
        this.menus.mapCard(this.map.nodes[i], this.profile, this.unlocked(i));
    }
    mapWalk(i) {
        if (i < 0 || i >= this.map.nodes.length || !this.unlocked(i) || this.map.walk) return;
        this.map.sel = i;
        audio.sfxPlay('step');
        this.map.walkTo(i, () => { this.profile.node = i; this.persist(); this.updateMapCard(); });
        this.updateMapCard();
    }
    mapEnter() {
        if (this.map.walk) return;
        const n = this.map.nodes[this.map.cur];
        audio.sfxPlay('open');
        if (n.kind === 'club') this.openClub();
        else if (this.unlocked(this.map.cur)) this.startHole(n.hole.id);
    }

    // ================================================================ clubhouse
    openClub() {
        this.fade(() => {
            this.mode = 'club';
            this.leaveHole();
            this.showScreen('clubhouse');
            this.stage.build('clubhouse', ['eagle', 'hero', 'wedge'], this.profile);
            this.stage.speak('eagle', 'happy');
            this.showScene('stage');
            audio.play('club');
            this.menus.tab = this.profile.pts > 0 ? 'stats' : 'shop';
            this.menus.club(this.profile, this.progress());
        });
    }

    // ================================================================ holes
    startHole(id, opts = {}) {
        const hole = HOLE_BY_ID[id];
        const r = hole.realm;
        const first = HOLES.find((h) => h.realm === r);
        const P = this.profile;
        if (!opts.skipStory) {
            if (first.id === id && !P.flags[`intro:${r}`]) return this.playStory(`intro:${r}`, () => { P.flags[`intro:${r}`] = true; this.persist(); this.startHole(id, { skipStory: true }); });
            if (hole.boss && !P.flags[`boss:${r}`]) return this.playStory(`boss:${r}`, () => { P.flags[`boss:${r}`] = true; this.persist(); this.startHole(id, { skipStory: true }); });
        }
        this.fade(() => {
            this.mode = 'hole';
            this.closeOverlays();
            this.showScreen(null);
            this.stage.clear();
            const course = buildCourse(hole);
            this.world = new World(course, { profile: P, seed: (Math.random() * 1e9) >>> 0 });
            this.hv.build(course, this.world, P);
            this.showScene('hole');
            this.hud.setHole(this.world, P);
            this.hud.show(true);
            this.swing.reset();
            this.acc = 0;
            this.view = 'aim';
            this.dir.orbit = 0; this.dir.pitch = 0;
            this.tipsShown = new Set();
            audio.play(hole.boss ? (r === 4 ? 'final' : 'boss') : REALM_THEME[r]);
            // intro: hole card and a fly-over from the green back to the tee
            this.intro = true;
            this.hud.holeCard(this.world, true);
            const pts = [course.cup, ...(hole.route ?? []).slice().reverse().map(([x, z]) => ({ x, y: course.heightAt(x, z), z })), course.tee]
                .map((p) => ({ x: p.x, y: Math.max(p.y, -10), z: p.z }));
            this.dir.flyover(pts, () => this.endIntro());
            this.dir.update(1 / 60); this.dir.snap();
        });
    }
    endIntro() {
        if (!this.intro) return;
        this.intro = false;
        this.hud.holeCard(null, false);
        this.aimCam();
        this.dir.update(1 / 60); this.dir.snap();
        if (this.world.hole.tutorial && this.settings.tips) this.tip('first');
        else if (this.world.hole.boss && this.settings.tips) this.toastWedge(this.world.hole.blurb);
    }
    aimCam() {
        const s = this.world.s;
        this.dir.setAim(s.ball, s.aimYaw, s.club, this.world.distToCup());
    }
    tip(key) {
        if (!this.settings.tips || this.tipsShown?.has(key)) return;
        this.tipsShown.add(key);
        this.toastWedge(TIPS[key]);
    }
    toastWedge(text, ms = 4200) { this.hud.toast(text, this.portraits.get('wedge', 'normal', this.profile), ms); }

    // swing input during a hole
    swingPress() {
        const w = this.world;
        if (!w || this.intro || this.overlay || this.dlg.active) return;
        if (w.s.phase !== 'aim') return;
        this.hud.closeItems();
        if (!this.swing.active) {
            const club = CLUBS[w.s.club];
            const speed = 1.12 * club.meter * w.d.meterSpeed * (this.settings.gentle ? 0.7 : 1);
            const zone = w.d.perfectZone * (this.settings.gentle ? 1.6 : 1);
            this.swing.start(speed, zone);
            audio.sfxPlay('meter');
            setPose(this.hv.hero, 'swing', { angle: 0 });
            return;
        }
        const shot = this.swing.press();
        audio.sfxPlay('tick');
        if (shot) this.fire(shot);
    }
    fire(shot) {
        const w = this.world;
        const ok = w.shoot({ club: w.s.club, power: shot.power, acc: shot.acc, perfect: shot.perfect });
        if (!ok) return;
        this.followT = 0;
        this.dir.orbit = 0; this.dir.pitch = 0;
        this.view = 'flight';
        this.dir.setFlight(w.s.ball);
        if (w.s.club === 'putter') this.dir.k = 3;
        if (shot.perfect) this.hud.banner('PERFECT!', '', false, 900);
        else if (Math.abs(shot.acc) > 0.6) this.hud.banner(shot.acc > 0 ? 'Slice!' : 'Hook!', '', true, 900);
        if (w.hole.tutorial) this.tip('perfect');
    }

    updateHole(dt) {
        const w = this.world, s = w.s;
        if (this.intro) { this.dir.update(dt); return; }
        // aiming
        if (s.phase === 'aim' && !this.swing.active && !this.overlay && !this.dlg.active) {
            const rate = (s.club === 'putter' ? 0.5 : 0.95) * (this.input.fine ? 0.25 : 1);
            let d = 0;
            if (this.input.held.has('left')) d += rate * dt;
            if (this.input.held.has('right')) d -= rate * dt;
            d += this.input.takeAim() * (s.club === 'putter' ? 0.5 : 1);
            if (d) w.setAim(s.aimYaw + d);
        } else this.input.takeAim();
        const [ob, pb] = this.input.takeOrbit();
        this.dir.orbit = Math.max(-1.6, Math.min(1.6, this.dir.orbit + ob));
        this.dir.pitch = Math.max(-0.3, Math.min(1.5, this.dir.pitch + pb));
        // the swing meter
        if (this.swing.active) {
            const r = this.swing.update(dt);
            if (r === 'cancel') { setPose(this.hv.hero, 'address'); audio.sfxPlay('whiff'); }
            else if (r) this.fire(r);
            const m = this.swing.m;
            const ang = this.swing.state === 'power' ? -2.5 * Math.max(0, m) : this.swing.state === 'acc' ? -2.5 * this.swing.power * Math.max(0, m / Math.max(0.05, this.swing.power)) : 0;
            if (this.swing.active) this.hv.hero.poseOpts.angle = ang;
        }
        // the simulation
        if (!this.overlay && !this.dlg.active) {
            this.acc = Math.min(this.acc + dt * FAST, 0.25 * FAST);
            let n = 0;
            while (this.acc >= SIM_DT && n < 120 * FAST) { w.step(SIM_DT); this.acc -= SIM_DT; n++; }
        }
        this.drain();
        // follow-through animation after the strike
        if (this.followT !== null && this.followT !== undefined) {
            this.followT += dt;
            const h = this.hv.hero;
            if (h.pose === 'swing') h.poseOpts.angle = Math.min(2.3, -0.2 + this.followT * 14);
            if (this.followT > 1.4 && h.pose === 'swing') setPose(h, 'idle');
        }
        // camera
        const ph = s.phase;
        if (ph === 'aim') {
            if (this.view === 'over') this.dir.setOverhead(w.course, s.ball, w.target());
            else { this.view = 'aim'; this.dir.setAim(s.ball, s.aimYaw, s.club, w.distToCup()); }
        } else if (ph === 'act' && s.boss) {
            const T = w.target();
            const B = s.ball;
            const dx = T.x - B.x, dz = T.z - B.z, dl = Math.hypot(dx, dz) || 1;
            this.dir.setFocus(new THREE.Vector3(T.x, T.y, T.z), new THREE.Vector3(B.x - (dx / dl) * 8, Math.max(B.y, T.y) + 6, B.z - (dz / dl) * 8), 2.2);
        } else if (ph === 'done') {
            if (this.dir.mode !== 'orbit') { const C = w.course.cup; this.dir.setOrbit(C.x, C.z, 9, 4, 0.35); this.dir.orbitC.y = C.y; this.dir.orbitY = 0.5; }
        }
        this.dir.update(dt);
        // turns
        if (ph !== this.lastPhase) this.phaseChanged(this.lastPhase, ph);
        this.lastPhase = ph;
    }

    phaseChanged(from, to) {
        const w = this.world;
        if (to === 'aim') {
            this.followT = null;
            this.hv.placeHeroAtBall();
            setPose(this.hv.hero, 'address');
            this.hv.hero.setExpr('normal');
            this.view = 'aim';
            const sid = w.lieSurf();
            if (w.hole.tutorial && sid === SURF.green) this.tip('green');
            if (w.s.wind.speed > 3) this.tip('wind');
        }
        if (to === 'done') setTimeout(() => this.finishHole(), 2200);
        if (to === 'failed') setTimeout(() => { audio.sfxPlay('fail'); this.menus.failed(w.hole); this.overlay = 'result'; }, 900);
    }

    // world events → view, audio, HUD
    drain() {
        const w = this.world;
        const evs = w.events;
        if (!evs.length) return;
        const sname = (sid) => SURF_NAMES[sid] ?? 'fairway';
        for (const e of evs) {
            this.hv.onEvent(e);
            switch (e.type) {
                case 'shot': audio.sfxPlay('swing', { power: e.power }); audio.sfxPlay('hit', { club: e.club, perfect: e.perfect }); break;
                case 'land': case 'bounce': {
                    let n = sname(e.surf);
                    if (n === 'dune' || n === 'quick') n = 'sand';
                    audio.sfxPlay('bounce', { surf: n, speed: e.speed, gap: 0.05 });
                    break;
                }
                case 'plug': audio.sfxPlay('bounce', { surf: e.surf === SURF.snow ? 'snow' : 'sand', speed: 14 }); break;
                case 'thunk': audio.sfxPlay('thunk', { tag: e.tag }); break;
                case 'leaves': audio.sfxPlay('leaves'); break;
                case 'hazard': {
                    audio.sfxPlay(e.kind === 'water' ? 'splash' : e.kind === 'lava' ? 'lava' : e.kind === 'void' ? 'void' : 'oob');
                    const t = { water: 'Splash!', lava: 'Sizzle!', void: 'Into the void!', oob: 'Out of bounds' }[e.kind];
                    this.hud.banner(t, w.s.kicked ? 'No penalty' : '+1 penalty stroke', true, 1500);
                    if (this.settings.tips) { this.tip('hazard'); if (w.s.spells.includes('mulligan')) setTimeout(() => this.tip('mulligan'), 1800); }
                    break;
                }
                case 'holed': {
                    audio.sfxPlay('holed');
                    const name = scoreName(w.s.strokes, w.s.par);
                    this.hud.banner(name, w.s.strokes < w.s.par ? `${w.s.par - w.s.strokes} under par!` : w.s.strokes === w.s.par ? 'Right on par' : `${w.s.strokes} strokes`, w.s.strokes > w.s.par);
                    if (w.s.strokes < w.s.par) for (let i = 0; i < 6; i++) setTimeout(() => { const C = w.course.cup; this.fx.preset('firework', C.x + (Math.random() - 0.5) * 16, C.y + 10 + Math.random() * 6, C.z + (Math.random() - 0.5) * 16); audio.sfxPlay('poof', { gap: 0 }); }, 300 + i * 350);
                    break;
                }
                case 'lipout': audio.sfxPlay('lipout'); this.hud.banner('Lipped out!', '', true, 1000); break;
                case 'monsterHit': audio.sfxPlay('poof'); audio.sfxPlay('coin'); this.popAt(e, `+${e.xp} XP`, '#9ad8ff'); if (w.hole.tutorial) this.tip('monster'); break;
                case 'pickup': audio.sfxPlay(e.kind === 'coin' ? 'coin' : e.kind === 'gem' ? 'gem' : e.kind === 'orb' ? 'mana' : 'crystal'); if (e.kind === 'crystal') this.hud.toast(`Found a ${ITEMS[e.item].icon} ${ITEMS[e.item].name}!`); if (e.kind === 'gem') this.popAt(e, '+10', '#ff8ad8'); break;
                case 'bossHit': audio.sfxPlay('bossHit'); audio.sfxPlay('roar', { gap: 0.4 }); this.popAt(e, `-${e.dmg}`, e.perfect ? '#ffe070' : '#ff8a8a'); if (this.settings.shake) this.dir.shake = Math.max(this.dir.shake, 0.9); break;
                case 'wallHit': audio.sfxPlay('bounce', { surf: 'ice', speed: 16 }); break;
                case 'bossAct': if (e.action === 'stomp') audio.sfxPlay('stomp'); else if (e.action === 'fire' || e.action === 'storm') audio.sfxPlay('spell', { id: e.action === 'fire' ? 'fire' : 'ward' }); else if (e.action === 'frost' || e.action === 'snowball') audio.sfxPlay('spell', { id: 'frost' }); else if (e.action === 'teleport') audio.sfxPlay('spell', { id: 'seek' }); else audio.sfxPlay('roar'); break;
                case 'bossDown': audio.sfxPlay('roar', { low: true }); this.hud.banner('Seal broken!', 'The cup is open', false, 2200); break;
                case 'sealBroken': audio.sfxPlay('seal'); break;
                case 'bossPhase': audio.sfxPlay('roar', { low: true }); setTimeout(() => this.playStory('phase2', null, true), 600); break;
                case 'geyser': audio.sfxPlay('geyser'); break;
                case 'rune': audio.sfxPlay('rune'); break;
                case 'spell': audio.sfxPlay('spell', { id: e.id }); if (e.id === 'mulligan') { this.hv.placeHeroAtBall(true); this.hud.banner('Mulligan!', 'Stroke refunded', false, 1100); } break;
                case 'item': audio.sfxPlay('item'); break;
                case 'kicked': if (this.settings.shake) this.dir.shake = Math.max(this.dir.shake, 0.6); this.dir.setFlight(w.s.ball); break;
                case 'frostSkate': audio.sfxPlay('bounce', { surf: 'ice', speed: 10, gap: 0.2 }); break;
                case 'burn': audio.sfxPlay('spell', { id: 'fire', gap: 0.3 }); break;
                case 'drop': this.aimCam(); break;
            }
        }
        evs.length = 0;
    }

    popAt(p, text, color) {
        const v = new THREE.Vector3(p.x, p.y + 1, p.z).project(this.R.camera);
        if (v.z > 1) return;
        this.hud.dmg((v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, text, color);
    }

    finishHole() {
        const w = this.world;
        if (!w || w.s.phase !== 'done' || this.overlay === 'result') return;
        const P = this.profile;
        const hole = w.hole;
        const pay = applyResult(P, hole, w.s.result);
        // first boss clear: shard and spell
        let note = '';
        if (hole.boss && pay.first) {
            const sp = REALM_SPELL[hole.realm];
            if (sp && !P.spells.includes(sp)) { P.spells.push(sp); note = `New spell learnt: <b>${SPELL_ORDER.includes(sp) ? sp : ''}</b>`; }
            if (hole.realm === 4) P.cleared = true;
        }
        if (note) note = note.replace(/<b>(\w+)<\/b>/, (m, id) => `<b>${{ ward: 'Gust Ward', fire: 'Fireball', frost: 'Frost Step', seek: 'Seeker' }[id] ?? id}</b>`);
        this.persist();
        this.lastResult = { hole, pay };
        this.menus.result(hole, w.s.result, pay, { note });
        this.overlay = 'result';
        audio.sfxPlay(pay.ups ? 'levelup' : 'fanfare');
        for (let i = 0; i < pay.stars; i++) setTimeout(() => { this.menus.showStars(i + 1); audio.sfxPlay('star', { i, gap: 0 }); }, 500 + i * 380);
        if (pay.ups) { const h = this.hv.hero.root.position; this.fx.preset('levelup', h.x, h.y, h.z); }
    }

    afterResult() {
        const { hole, pay } = this.lastResult ?? {};
        this.closeOverlays();
        if (!hole) return this.goMap();
        const P = this.profile;
        const idx = holeIndex(hole.id) + 1;      // map node of this hole
        const next = Math.min(idx + 1, HOLES.length);
        if (hole.boss && !P.flags[`win:${hole.realm}`]) {
            return this.playStory(hole.realm === 4 ? 'ending' : `win:${hole.realm}`, () => {
                P.flags[`win:${hole.realm}`] = true;
                this.persist();
                if (hole.realm === 4) this.rollCredits();
                else { P.node = idx; this.persist(); this.goMap(next); }
            });
        }
        P.node = idx; this.persist();
        this.goMap(pay?.first ? next : null);
    }

    rollCredits() {
        this.mode = 'credits';
        this.leaveHole();
        this.showScreen('credits');
        this.stage.build('clubhouse', ['queen', 'bogey', 'hero', 'wedge', 'eagle'], this.profile);
        this.stage.speak('hero', 'happy');
        this.showScene('stage');
        audio.play('ending');
        this.menus.credits(this.profile);
        this.creditT = 0;
    }

    // ================================================================ overlays
    openPause() {
        if (this.overlay) return;
        this.swing.reset();
        this.menus.pause(this.mode === 'hole');
        this.overlay = 'pause';
        audio.sfxPlay('open');
    }
    closeOverlays() {
        for (const id of ['pause', 'settings', 'confirm', 'result']) $(id).classList.add('hidden');
        this.overlay = null;
        this.hud.closeItems?.();
    }
    openSettings() {
        $('pause').classList.add('hidden');
        this.menus.settings(this.settings, this.mode === 'title');
        this.overlay = 'settings';
    }
    applySettings() {
        audio.setVolumes(this.settings.music, this.settings.sfx);
        this.R.setQuality(this.settings.quality >= 0 ? this.settings.quality : this.autoQ);
        this.persist();
    }

    // ================================================================ input
    onClick(e) {
        const b = e.target.closest('[data-act]');
        if (b) {
            if (b.disabled) return;
            this.act(b.dataset.act, b.dataset);
            return;
        }
        const tab = e.target.closest('[data-tab]');
        if (tab) { this.menus.tab = tab.dataset.tab; audio.sfxPlay('click'); this.menus.club(this.profile, this.progress()); }
    }

    act(a, d = {}) {
        const P = this.profile;
        const cyc = (v) => (v <= 0 ? 0.35 : v < 0.45 ? 0.7 : v < 0.8 ? 1 : 0);
        if (!['swing'].includes(a)) audio.sfxPlay('click');
        switch (a) {
            case 'title-continue': this.fade(() => this.goMap()); break;
            case 'title-new':
                if (this.profile) { this.menus.confirm('Start a new quest? Your saved quest will be replaced.', 'New quest'); this.confirmFn = () => this.startCreator(); this.overlay = 'confirm'; }
                else this.startCreator();
                break;
            case 'title-settings': this.openSettings(); break;
            case 'creator-back': this.goTitle(); break;
            case 'creator-go': this.finishCreator(); break;
            case 'pick-look': this.creatorState.look = +d.i; this.menus.creator(this.creatorState); this.refreshCreatorHero(); break;
            case 'pick-outfit': this.creatorState.outfit = +d.i; this.menus.creator(this.creatorState); this.refreshCreatorHero(); break;
            case 'dlg-skip': this.dlg.skip(); break;
            case 'map-prev': this.mapWalk(this.map.cur - 1); break;
            case 'map-next': this.mapWalk(this.map.cur + 1); break;
            case 'map-go': this.mapEnter(); break;
            case 'map-menu': this.menus.pause(false); this.overlay = 'pause'; $('pause-panel').insertAdjacentHTML('beforeend', '<button class="btn" data-act="to-title">Title screen</button>'); break;
            case 'to-title': this.closeOverlays(); this.fade(() => this.goTitle()); break;
            case 'club-close': this.fade(() => this.goMap()); break;
            case 'buy': if (buy(P, d.cat, d.id)) { audio.sfxPlay('buy'); this.persist(); } else audio.sfxPlay('error'); this.menus.club(P, this.progress()); break;
            case 'equip': if (equip(P, d.cat, d.id)) { audio.sfxPlay('equip'); this.persist(); } this.menus.club(P, this.progress()); break;
            case 'add-stat': allocate(P, d.k); this.persist(); this.menus.club(P, this.progress()); break;
            case 'auto-stats': autoAllocate(P); this.persist(); this.menus.club(P, this.progress()); break;
            case 'swing': this.swingPress(); break;
            case 'club-prev': case 'club-next': this.cycleClub(a === 'club-next' ? 1 : -1); break;
            case 'view': this.toggleView(); break;
            case 'spell': this.castSpell(d.id); break;
            case 'items': this.openItems(); break;
            case 'pause': if (this.overlay === 'pause') this.closeOverlays(); else if (!this.overlay) this.openPause(); break;
            case 'resume': this.closeOverlays(); break;
            case 'retry': case 'res-retry': this.closeOverlays(); this.startHole(this.world?.hole.id ?? this.lastResult?.hole.id, { skipStory: true }); break;
            case 'quit-map': this.closeOverlays(); this.fade(() => this.goMap()); break;
            case 'res-continue': this.afterResult(); break;
            case 'res-map': this.closeOverlays(); this.fade(() => this.goMap()); break;
            case 'open-settings': this.openSettings(); break;
            case 'close-settings': this.closeOverlays(); if (this.mode === 'hole' || this.mode === 'map') this.openPause(); break;
            case 'set-music': this.settings.music = cyc(this.settings.music); this.applySettings(); this.menus.settings(this.settings, this.mode === 'title'); break;
            case 'set-sfx': this.settings.sfx = cyc(this.settings.sfx); this.applySettings(); this.menus.settings(this.settings, this.mode === 'title'); break;
            case 'set-quality': this.settings.quality = this.settings.quality >= 2 ? -1 : this.settings.quality + 1; this.applySettings(); this.menus.settings(this.settings, this.mode === 'title'); break;
            case 'set-gentle': this.settings.gentle = !this.settings.gentle; this.applySettings(); this.menus.settings(this.settings, this.mode === 'title'); break;
            case 'set-shake': this.settings.shake = !this.settings.shake; this.applySettings(); this.menus.settings(this.settings, this.mode === 'title'); break;
            case 'set-tips': this.settings.tips = !this.settings.tips; this.applySettings(); this.menus.settings(this.settings, this.mode === 'title'); break;
            case 'erase': this.closeOverlays(); this.menus.confirm('Erase your saved quest? This cannot be undone.', 'Erase'); this.confirmFn = () => { store.wipe(); this.profile = null; this.persist(); this.goTitle(); }; this.overlay = 'confirm'; break;
            case 'confirm-yes': { const f = this.confirmFn; this.confirmFn = null; this.closeOverlays(); f?.(); break; }
            case 'confirm-no': this.closeOverlays(); break;
        }
    }

    cycleClub(d) {
        const w = this.world;
        if (!w || w.s.phase !== 'aim' || this.swing.active) return;
        const i = CLUB_ORDER.indexOf(w.s.club);
        w.setClub(CLUB_ORDER[(i + d + CLUB_ORDER.length) % CLUB_ORDER.length]);
    }
    toggleView() {
        if (!this.world || this.world.s.phase !== 'aim') return;
        this.view = this.view === 'over' ? 'aim' : 'over';
    }
    castSpell(id) {
        const w = this.world;
        if (!w || this.swing.active) return;
        if (!w.armSpell(id)) audio.sfxPlay('error');
        else if (id !== 'mulligan') audio.sfxPlay('open');
    }
    openItems() {
        const w = this.world;
        if (!w || w.s.phase !== 'aim' || this.swing.active) return;
        if (this.hud.itemMenu) { this.hud.closeItems(); return; }
        this.hud.itemPicker(w, (id) => { if (!id) { if (w.s.armed.item) w.s.armed.item = null; return; } if (!w.armItem(id)) audio.sfxPlay('error'); });
    }

    onAction(a, d) {
        audio.init();
        if (a === 'mute') { const on = this.settings.music > 0 || this.settings.sfx > 0; this.muteMem = on ? [this.settings.music, this.settings.sfx] : this.muteMem ?? [0.7, 0.85]; [this.settings.music, this.settings.sfx] = on ? [0, 0] : this.muteMem; this.applySettings(); return; }
        if (this.dlg.active) {
            if (a === 'swing' || a === 'confirm' || a === 'tap') this.dlg.advance();
            if (a === 'pause' || a === 'back') this.dlg.skip();
            return;
        }
        if (this.overlay) {
            if ((a === 'pause' || a === 'back') && ['pause', 'settings', 'confirm'].includes(this.overlay)) this.closeOverlays();
            if ((a === 'confirm' || a === 'swing') && this.overlay === 'result') { const b = document.querySelector('#result-panel [data-act="res-continue"], #result-panel [data-act="res-retry"]'); b?.click(); }
            return;
        }
        switch (this.mode) {
            case 'title':
                if (a === 'up') this.menus.titleMove(-1);
                else if (a === 'down') this.menus.titleMove(1);
                else if (a === 'confirm' || a === 'swing') this.act('title-' + this.menus.titleChosen());
                else if (a === 'tap' && !d.btn) { /* buttons handle themselves */ }
                break;
            case 'creator':
                if (a === 'confirm') this.finishCreator();
                if (a === 'pause' || a === 'back') this.goTitle();
                break;
            case 'map':
                if (a === 'left' || a === 'down') this.mapWalk(this.map.cur - 1);
                else if (a === 'right' || a === 'up') this.mapWalk(this.map.cur + 1);
                else if (a === 'confirm' || a === 'swing') this.mapEnter();
                else if (a === 'pause' || a === 'back') this.act('map-menu');
                else if (a === 'tap') {
                    const i = this.map.pick(d.x, d.y, innerWidth, innerHeight);
                    if (i >= 0) { if (i === this.map.cur) this.mapEnter(); else this.mapWalk(i); }
                }
                break;
            case 'club':
                if (a === 'pause' || a === 'back') this.act('club-close');
                break;
            case 'hole':
                if (this.intro) { if (a === 'swing' || a === 'confirm' || a === 'tap') { this.dir.onDone = null; this.endIntro(); } return; }
                if (a === 'swing') this.swingPress();
                else if (a === 'confirm' && this.world.s.phase === 'aim') this.swingPress();
                else if (a === 'up') this.cycleClub(-1);
                else if (a === 'down') this.cycleClub(1);
                else if (a === 'view') this.toggleView();
                else if (a === 'pause') this.openPause();
                else if (a.startsWith('spell')) this.castSpell(SPELL_ORDER[+a.slice(5) - 1]);
                else if (a === 'item') this.openItems();
                else if (a === 'retry' && DEBUG) this.act('retry');
                break;
            case 'credits':
                if ((a === 'tap' || a === 'confirm' || a === 'swing') && this.creditT > 3) { $('credits').classList.add('hidden'); this.goMap(); }
                break;
        }
    }

    // ================================================================ frame
    frame(now) {
        requestAnimationFrame((t) => this.frame(t));
        const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
        this.last = now;
        this.t += dt;
        TOON.uTime.value = this.t;
        this.dlg.update(dt);
        switch (this.mode) {
            case 'title': case 'creator': {
                const tw = this.titleWorld;
                if (tw) tw.step(dt);
                this.titleT += dt;
                const h = this.hv.hero;
                if (this.mode === 'title' && h) {
                    // practice swings every few seconds
                    const k = this.titleT % 6;
                    if (k < 0.05 && h.pose !== 'swing') setPose(h, 'swing', { angle: 0 });
                    if (h.pose === 'swing') { const u = this.titleT % 6; h.poseOpts.angle = u < 1.2 ? -2.4 * (u / 1.2) : u < 1.45 ? -2.4 + (u - 1.2) * 18 : 2.2; if (u > 2.6) setPose(h, 'idle'); }
                }
                if (tw) { this.hv.world = tw; this.hv.sync(dt, this.t, { hideAim: true }); }
                this.dir.update(dt);
                break;
            }
            case 'story': case 'club': this.stage.update(dt, this.t, this.dir); this.dir.update(dt); break;
            case 'credits': this.creditT += dt; this.stage.update(dt, this.t, this.dir); this.dir.update(dt); break;
            case 'map': this.map.update(dt * FAST, this.t, this.dir); this.dir.update(dt); if (!this.map.walk && this.map.sel !== this.map.cur) this.map.sel = this.map.cur; break;
            case 'hole':
                if (this.world) {
                    this.updateHole(dt);
                    this.hv.sync(dt, this.t, { hideAim: this.swing.active && this.swing.state === 'acc' });
                    const cy = Math.atan2(this.dir.look.x - this.dir.pos.x, this.dir.look.z - this.dir.pos.z);
                    this.hud.update(this.world, this.swing, cy, dt);
                }
                break;
        }
        this.fx.trail.cam = this.R.camera;
        this.fx.update(dt, this.R.camera.position, this.mode === 'hole' && this.world ? this.hv.ball.position : this.dir.look);
        this.sky.update(dt, this.t, this.R.camera.position);
        this.R.render(dt, this.t);
        // adaptive quality: drop a tier after sustained slow frames (auto only)
        if (this.settings.quality < 0 && dt > 0) {
            this.fpsAcc = (this.fpsAcc ?? 0) + dt; this.fpsN = (this.fpsN ?? 0) + 1;
            if (this.fpsAcc > 2) {
                const fps = this.fpsN / this.fpsAcc;
                this.fpsAcc = 0; this.fpsN = 0;
                if (fps < 34 && !DEBUG) { if (++this.slow >= 3 && this.R.quality > 0) { this.R.setQuality(this.R.quality - 1); this.slow = 0; } } else this.slow = 0;
            }
        }
    }

    // ================================================================ debug
    debugHooks() {
        const app = this;
        window.__ts = {
            app,
            get world() { return app.world; },
            get profile() { return app.profile; },
            get mode() { return app.mode; },
            go: (id) => { if (!app.profile) app.profile = newProfile(); app.startHole(id, { skipStory: true }); },
            win: () => { const w = app.world; if (!w) return; if (w.s.boss) { w.s.boss.hp = 0; w.s.sealed = false; } const B = w.s.ball; const C = w.course.cup; B.x = C.x; B.z = C.z; B.y = C.y + 0.4; B.vx = 0.5; B.vz = 0; B.vy = -0.5; B.state = 'moving'; w.s.phase = 'flight'; },
            give: (k, n = 1) => { app.profile.items[k] = (app.profile.items[k] || 0) + n; if (app.world) app.world.s.items[k] = (app.world.s.items[k] || 0) + n; },
            gold: (n) => { app.profile.gold += n; },
            xp: (n) => addXp(app.profile, n),
            shoot: (o) => { const w = app.world; if (o.yaw !== undefined) w.setAim(o.yaw); if (o.club) w.setClub(o.club); app.fire({ power: o.power ?? 0.6, acc: o.acc ?? 0, perfect: o.perfect ?? true }); },
            skipIntro: () => app.endIntro(),
            portraits: app.portraits,
            hash: () => app.world?.hash(),
        };
    }
}

try {
    new App();
} catch (e) {
    console.error(e);
    $('loading').innerHTML = `<div style="max-width:420px;text-align:center;padding:20px">Tee &amp; Sorcery couldn't start: ${String(e.message ?? e)}</div>`;
}
