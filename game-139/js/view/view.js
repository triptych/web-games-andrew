// The three.js card table: reads G every frame and moves the cards toward where the state says they are;
// turns sim events into small effects. Never changes G. Picking (which card is under a tap) lives here too.
//
// World: the table is the XZ plane, the player sits at +Z looking toward -Z. Cards lie flat (face up on +Y),
// the rival's pyramid has its apex far away and its open bottom row nearest you; your hand is closest.

import * as THREE from 'three';
import { RIVALS } from '../sim/data/rivals.js';
import { ownFace, rivalFace, backTexture, redrawAll, image } from './cards.js';
import { ROOT } from '../media.js';

const CARD_W = 1, CARD_D = 1.5, CARD_T = 0.02;
const ROW_DZ = 0.66, COL_DX = 1.08;
const HAND_Z = 3.0, HAND_SCALE = 1.4;

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.setClearColor(0x120b07);
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x120b07, 14, 30);
        this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);

        this.scene.add(new THREE.HemisphereLight(0xffe2b8, 0x2a1a10, 1.2));
        const key = new THREE.DirectionalLight(0xffe7c4, 1.5);
        key.position.set(-2, 9, 6);
        this.scene.add(key);
        this.candle = new THREE.PointLight(0xffa04a, 14, 14, 1.6);
        this.candle.position.set(3.2, 2.2, -1);
        this.scene.add(this.candle);

        // the table
        const tableTex = new THREE.TextureLoader().load(ROOT + 'art/table.webp');
        tableTex.colorSpace = THREE.SRGBColorSpace;
        tableTex.anisotropy = 8;
        const table = new THREE.Mesh(new THREE.PlaneGeometry(34, 30), new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.85, color: 0xd8c4a8 }));
        table.rotation.x = -Math.PI / 2;
        table.position.set(0, 0, -0.5);
        this.scene.add(table);

        // a candle in a holder (the warm light's excuse)
        const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 20), new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.6 }));
        wax.position.set(3.2, 0.42, -1);
        const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.08, 24), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.6, roughness: 0.35 }));
        dish.position.set(3.2, 0.04, -1);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
        flame.scale.set(1, 1.9, 1);
        flame.position.set(3.2, 0.86, -1);
        this.candleGroup = new THREE.Group();
        this.candleGroup.add(wax, dish, flame);
        this.flame = flame;
        this.scene.add(this.candleGroup);

        // the rival's portrait, framed, standing behind the pyramid
        this.portraitMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(2.36, 3.06, 0.08), new THREE.MeshStandardMaterial({ color: 0x5a3a1c, metalness: 0.3, roughness: 0.5 }));
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.8), this.portraitMat);
        pic.position.z = 0.045;
        this.portrait = new THREE.Group();
        this.portrait.add(frame, pic);
        this.portrait.rotation.x = -0.62;
        this.portrait.scale.setScalar(0.82);
        this.scene.add(this.portrait);
        this.portraitId = null;

        // shared card pieces
        this.geo = new THREE.BoxGeometry(CARD_W, CARD_T, CARD_D);
        this.edgeMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
        this.ownBack = new THREE.MeshStandardMaterial({ map: backTexture('cardback'), roughness: 0.6 });
        this.rivalBack = new THREE.MeshStandardMaterial({ map: backTexture('rivalback'), roughness: 0.6 });
        this.rivalMeshes = new Map();   // slot id -> mesh
        this.handMeshes = new Map();    // uid -> mesh
        this.leaving = [];              // meshes flying away
        this.piles = this.makePiles();
        this.fx = [];
        this.shake = 0;
        this.sel = null;                // { slot } | { hand }
        this.targets = new Set();       // keys of cards that would pair with the selection
        this.cursor = null;             // keyboard focus key
        this.fightKey = null;
        this.layoutCache = null;
        this.raycaster = new THREE.Raycaster();
        this.ndc = new THREE.Vector2();
        this.time = 0;

        document.fonts?.ready?.then(() => redrawAll());
        this.resize();
        const onResize = () => this.resize(true);
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    makePiles() {
        const mk = (mat) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, 1, CARD_D), [this.edgeMat, this.edgeMat, mat, this.edgeMat, this.edgeMat, this.edgeMat]);
            m.scale.set(0.8, 0.02, 0.8);
            this.scene.add(m);
            return m;
        };
        return { draw: mk(this.ownBack), discard: mk(this.ownBack) };
    }

    // ------------------------------------------------------------------ sizing
    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.clearViewOffset();
        this.camera.updateProjectionMatrix();
        this.fitDirty = true;
    }

    /** Move the camera back until the pyramid, the portrait and the hand all fit between the HUD bars. */
    fit(L, handN) {
        const pyrW = Math.max(5, L.width * COL_DX + 0.6);
        const handW = Math.max(4, handN * this.handSpacing(handN, pyrW) + 0.4);
        const W = Math.max(pyrW, handW) + 0.4;
        const z0 = this.rowZ(0, L.rows) - 2.2, z1 = HAND_Z + 0.75 * HAND_SCALE;
        const cz = (z0 + z1) / 2;
        const pts = [
            [-W / 2, 0, z0], [W / 2, 0, z0], [-W / 2, 0, z1], [W / 2, 0, z1],
            [0, 2.55, this.rowZ(0, L.rows) - 1.55], [-W / 2, 0.9, z1], [W / 2, 0.9, z1],
        ].map((p) => new THREE.Vector3(...p));
        const portraitMode = this.camera.aspect < 0.9;
        const top = portraitMode ? 0.66 : 0.78, bottom = portraitMode ? -0.72 : -0.8, side = 0.97;
        const tilt = portraitMode ? 1.2 : 1.08;            // radians below the horizon
        const look = new THREE.Vector3(0, 0, cz + (portraitMode ? 0.2 : 0.1));
        let lo = 4, hi = 60;
        for (let i = 0; i < 26; i++) {
            const d = (lo + hi) / 2;
            this.camera.position.set(0, look.y + Math.sin(tilt) * d, look.z + Math.cos(tilt) * d);
            this.camera.lookAt(look);
            this.camera.updateMatrixWorld();
            const okFit = pts.every((p) => { const v = p.clone().project(this.camera); return v.x > -side && v.x < side && v.y < top && v.y > bottom; });
            if (okFit) hi = d; else lo = d;
        }
        this.camera.position.set(0, look.y + Math.sin(tilt) * hi, look.z + Math.cos(tilt) * hi);
        this.camera.lookAt(look);
        this.camera.far = hi * 3; this.scene.fog.near = hi * 1.2; this.scene.fog.far = hi * 2.6;
        // centre the content between the HUD bars (a phone is width-bound and would leave it riding high)
        this.camera.clearViewOffset();
        this.camera.updateProjectionMatrix();
        this.camera.updateMatrixWorld();
        const ys = pts.map((p) => p.clone().project(this.camera).y);
        const dy = (Math.max(...ys) + Math.min(...ys)) / 2 - (top + bottom) / 2;
        if (Math.abs(dy) > 0.02) this.camera.setViewOffset(this.w, this.h, 0, -dy * this.h / 2, this.w, this.h);
        this.camera.updateProjectionMatrix();
        this.fitDirty = false;
        this.fitFor = `${L.rows}:${L.width}:${handN}`;
        this.pyrW = pyrW;
    }

    rowZ(r, rows) { return 0.75 - (rows - 1 - r) * ROW_DZ; }
    handSpacing(n, pyrW = this.pyrW || 6) { return Math.min(1.12 * HAND_SCALE, Math.max(0.7, (Math.max(pyrW, 6.4) - 0.2) / Math.max(1, n))); }

    // ------------------------------------------------------------------ meshes
    cardMesh(faceTex, backMat) {
        const face = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.55, emissive: 0x000000 });
        const m = new THREE.Mesh(this.geo, [this.edgeMat, this.edgeMat, face, backMat, this.edgeMat, this.edgeMat]);
        m.userData.face = face;
        this.scene.add(m);
        return m;
    }

    resetFight() {
        for (const m of [...this.rivalMeshes.values(), ...this.handMeshes.values(), ...this.leaving.map((l) => l.m)]) { this.scene.remove(m); m.userData.face.dispose(); }
        this.rivalMeshes.clear(); this.handMeshes.clear(); this.leaving = [];
        this.sel = null; this.targets.clear();
    }

    setPortrait(rid) {
        if (this.portraitId === rid) return;
        this.portraitId = rid;
        const img = image(`art/rival-${rid}.webp`, () => {
            if (this.portraitId !== rid || !img.ready) return;
            const t = new THREE.Texture(img);
            t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
            this.portraitMat.map?.dispose();
            this.portraitMat.map = t; this.portraitMat.needsUpdate = true;
        });
    }

    // ------------------------------------------------------------------ per frame
    frame(G, dt, layout) {
        this.time += dt;
        this.resize();
        const F = G.fight;
        const night = !!F && (G.phase === 'night' || G.phase === 'won' || (G.phase === 'over' && F));
        const key = F ? `${F.rival}:${G.seen.length}` : null;
        if (key !== this.fightKey) { this.resetFight(); this.fightKey = key; }
        this.portrait.visible = night;
        this.piles.draw.visible = this.piles.discard.visible = night;
        if (night) this.syncFight(G, dt, layout);
        else if (this.fitDirty || this.fitFor !== 'idle') this.fitIdle();

        // leaving cards
        const k = 1 - Math.exp(-dt * 7);
        for (let i = this.leaving.length - 1; i >= 0; i--) {
            const l = this.leaving[i];
            l.m.position.lerp(l.to, k);
            l.t += dt;
            const s = Math.max(0.01, 1 - l.t * 1.6);
            l.m.scale.setScalar(s);
            if (l.t > 0.7) { this.scene.remove(l.m); l.m.userData.face.dispose(); this.leaving.splice(i, 1); }
        }
        // sparks
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const f = this.fx[i];
            f.t += dt;
            f.m.position.y += dt * 1.2;
            f.m.material.opacity = Math.max(0, 1 - f.t / f.life);
            f.m.scale.setScalar(1 + f.t * 2);
            if (f.t >= f.life) { this.scene.remove(f.m); f.m.material.dispose(); this.fx.splice(i, 1); }
        }
        // the candle breathes gently (no flashing: slow, small)
        const flick = 0.92 + Math.sin(this.time * 2.1) * 0.04 + Math.sin(this.time * 3.3 + 1) * 0.03;
        this.candle.intensity = 14 * flick;
        this.flame.scale.set(1, 1.9 * flick, 1);
        // shake on a hit
        const base = this.camBase || this.camera.position.clone();
        if (this.shake > 0) {
            this.shake = Math.max(0, this.shake - dt * 2.5);
            const a = this.shake * 0.08;
            this.camera.position.set(base.x + Math.sin(this.time * 60) * a, base.y, base.z + Math.cos(this.time * 53) * a);
        } else if (this.camBase) this.camera.position.copy(this.camBase);
        this.renderer.render(this.scene, this.camera);
    }

    fitIdle() {
        // between nights the table is a backdrop behind the DOM screens
        this.camera.clearViewOffset();
        this.camera.position.set(0, 7.5, 6.5);
        this.camera.lookAt(0, 0, -0.5);
        this.camera.updateProjectionMatrix();
        this.camBase = this.camera.position.clone();
        this.fitFor = 'idle'; this.fitDirty = false;
    }

    syncFight(G, dt, L) {
        const F = G.fight, R = RIVALS[F.rival];
        this.setPortrait(F.rival);
        const hand = F.hand;
        const want = `${L.rows}:${L.width}:${Math.max(5, hand.length)}`;
        if (this.fitDirty || this.fitFor !== want) { this.fit(L, Math.max(5, hand.length)); this.camBase = this.camera.position.clone(); }
        const k = 1 - Math.exp(-dt * 10);
        const apexZ = this.rowZ(0, L.rows);
        this.portrait.position.set(0, 1.05, apexZ - 1.45);
        const pileX = Math.max(L.width * COL_DX / 2 - 0.6, 1.7);
        const drawPos = new THREE.Vector3(-pileX, 0, apexZ + 0.1), discPos = new THREE.Vector3(pileX, 0, apexZ + 0.1);
        this.piles.draw.position.copy(drawPos); this.piles.discard.position.copy(discPos);
        this.piles.draw.scale.y = Math.max(0.001, F.draw.length * 0.012);
        this.piles.discard.scale.y = Math.max(0.001, F.discard.length * 0.012);
        this.piles.draw.position.y = this.piles.draw.scale.y / 2;
        this.piles.discard.position.y = this.piles.discard.scale.y / 2;
        this.drawPos = drawPos; this.discPos = discPos;

        // rival cards
        for (const s of L.slots) {
            const st = F.slots[s.id];
            let m = this.rivalMeshes.get(s.id);
            if (st.gone) {
                if (m) { this.leaving.push({ m, to: new THREE.Vector3(0, 1.5, apexZ - 1.4), t: 0 }); this.rivalMeshes.delete(s.id); }
                continue;
            }
            const tex = rivalFace(F.rival, st.rank, st.taint, st.bounty);
            if (!m) {
                m = this.cardMesh(tex, this.rivalBack);
                m.position.set(s.x * COL_DX, 2.5, apexZ - 2);
                m.rotation.z = st.up ? 0 : Math.PI;
                m.userData.kind = 'slot'; m.userData.id = s.id;
                this.rivalMeshes.set(s.id, m);
            }
            if (m.userData.face.map !== tex) { m.userData.face.map = tex; m.userData.face.needsUpdate = true; }
            const open = !this.coveredBy(F, s);
            const selected = this.sel?.slot === s.id;
            const lift = selected ? 0.32 : this.cursor === 's' + s.id ? 0.14 : this.targets.has('s' + s.id) ? 0.1 : 0;
            const tx = s.x * COL_DX, tz = this.rowZ(s.r, L.rows) + (s.p ? 0 : 0);
            m.position.x += (tx - m.position.x) * k;
            m.position.z += (tz - m.position.z) * k;
            m.position.y += (0.02 + s.r * 0.025 + lift - m.position.y) * k;
            m.rotation.z += ((st.up ? 0 : Math.PI) - m.rotation.z) * k;
            m.rotation.x += ((selected ? -0.12 : 0) - m.rotation.x) * k;
            const glow = selected ? 0x7a5200 : this.targets.has('s' + s.id) ? 0x2a6a18 : st.lock ? 0x10243a : 0x000000;
            m.userData.face.emissive.setHex(glow);
            m.userData.face.color.setHex(open || !st.up ? 0xffffff : 0x9a8f80);
            m.userData.open = open && !st.lock;
            if (st.lock) m.userData.face.color.setHex(0x8fa8c8);
        }

        // your hand
        const n = hand.length, sp = this.handSpacing(n);
        hand.forEach((uid, i) => {
            const c = F.cards[uid];
            let m = this.handMeshes.get(uid);
            const tex = ownFace(c.id, c.up);
            if (!m) {
                m = this.cardMesh(tex, this.ownBack);
                m.position.copy(this.drawPos).setY(0.3);
                m.rotation.z = Math.PI;
                m.userData.kind = 'hand'; m.userData.uid = uid;
                this.handMeshes.set(uid, m);
            }
            const selected = this.sel?.hand === uid;
            const x = (i - (n - 1) / 2) * sp;
            const lift = selected ? 0.5 : this.cursor === 'h' + uid ? 0.22 : 0;
            m.position.x += (x - m.position.x) * k;
            m.position.y += (0.12 + i * 0.012 + lift - m.position.y) * k;
            m.position.z += (HAND_Z - (selected ? 0.35 : 0) - m.position.z) * k;
            m.rotation.z += (0 - m.rotation.z) * k;
            m.rotation.x += (0.5 - m.rotation.x) * k;
            m.scale.setScalar(HAND_SCALE);
            m.userData.face.emissive.setHex(selected ? 0x5a3c00 : this.targets.has('h' + uid) ? 0x2a6a18 : 0x000000);
            m.userData.open = true;
        });
        for (const [uid, m] of this.handMeshes) {
            if (hand.includes(uid)) continue;
            this.leaving.push({ m, to: this.discPos.clone().setY(0.4), t: 0 });
            this.handMeshes.delete(uid);
        }
    }

    coveredBy(F, s) { return s.coveredBy.some((c) => !F.slots[c].gone); }

    // ------------------------------------------------------------------ picking
    /** The card under a client point: { slot } | { hand } | null. */
    pick(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const meshes = [...this.handMeshes.values(), ...this.rivalMeshes.values()].filter((m) => m.userData.open);
        const hit = this.raycaster.intersectObjects(meshes, false)[0];
        if (!hit) return null;
        const u = hit.object.userData;
        return u.kind === 'hand' ? { hand: u.uid } : { slot: u.id };
    }

    /** Where a card is on screen, in client px (for keyboard focus rings and the browser tests). */
    screenOf(sel) {
        const m = sel.hand ? this.handMeshes.get(sel.hand) : this.rivalMeshes.get(sel.slot);
        if (!m) return null;
        const v = m.position.clone().project(this.camera);
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    }

    /** Is anything still moving into place? */
    get busy() { return this.leaving.length > 0; }

    // ------------------------------------------------------------------ events
    spark(pos, color = 0xffd27a) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.copy(pos).setY(0.3);
        this.scene.add(m);
        this.fx.push({ m, t: 0, life: 0.6 });
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'settle') {
                const m = this.rivalMeshes.get(e.slot);
                if (m) this.spark(m.position, e.how === 'cut' ? 0xff5a4a : 0xffd27a);
            } else if (e.type === 'hurt' && e.why === 'hit') this.shake = Math.min(1, 0.4 + e.n * 0.06);
            else if (e.type === 'arrive') this.fitDirty = true;
        }
    }
}
