// The Infinite Library: a reading room on the Archive floor whose back wall
// opens on the Stacks, a vaulted aisle of books that goes on for ever. A dozen
// six-metre bays are laid ahead of you and behind; as you walk, the ones you
// leave are picked up and laid down again further on, each re-shelved with its
// own seeded books, subject, and now and then a ladder, an armchair (sometimes
// with a cat on it), a lectern or a drift of flying books. Every book can be
// taken down and read, at least as far as its title. Every tenth bay has a
// bell-pull that rings you back to the reading room.
// Room-local frame: the door is at +z, the Stacks run off along -z (see tower.js).

import * as THREE from 'three';
import { Batch, xf } from './materials.js';
import { lathe } from './architecture.js';
import { TAU, rng, clamp, lerp, damp, smoothstep } from './util.js';
import { canvasTex, glow, motes, emissiveMat, plaqueMesh, wallpaper } from './tower-kit.js';

const V3 = THREE.Vector3;
const L = 6;            // one bay
const HW = 1.7;         // half the aisle's width
const SHELF_H = 4.3;
const POOL = 13;

// ------------------------------------------------------------- the catalogue

const SUBJECTS = [
    'Cloud Taxonomy', 'Teapots, Lesser Known', 'Maps of Unfinished Places', 'Moths & Their Opinions', 'Recipes for Weather', 'Unwritten Sequels',
    'Dreams, Lost & Found', 'Clockwork Etiquette', 'The Sea, Abridged', 'Very Small Dragons', 'Gardening for Ghosts', 'Songs Without Words',
    'Doors (Mostly Locked)', 'Astronomy for Cats', 'Puddles: A Field Guide', 'The Art of Napping', 'Forgotten Colours', 'Letters Never Sent',
    'Knots, Fancy & Plain', 'Spoons Through the Ages', 'Snails of Distinction', 'Overdue Books', 'The Moon’s Diaries', 'Hats That Got Away',
    'Lighthouses & Loneliness', 'Ballroom Dancing for Bears', 'Things Found Down the Back of Sofas', 'Advanced Whistling', 'Rainy Tuesdays', 'Cheese, Moon-Made',
];
const ADJ = ['Brief', 'Complete', 'Unabridged', 'Secret', 'Illustrated', 'Forbidden', 'Gentle', 'Slightly Damp', 'Annotated', 'Lost', 'Unofficial', 'Pocket', 'Midnight', 'Reluctant', 'Wandering', 'Peculiar', 'Hollow', 'Velvet', 'Second-hand', 'Collected'];
const NOUN = ['Teacups', 'Lighthouses', 'Owls', 'Umbrellas', 'Comets', 'Puddles', 'Keys', 'Clocks', 'Biscuits', 'Moths', 'Lanterns', 'Whales', 'Spoons', 'Kettles', 'Dragons', 'Mushrooms', 'Staircases', 'Hedgehogs', 'Clouds', 'Mirrors', 'Sandwiches', 'Bells', 'Ghosts', 'Snails', 'Telescopes'];
const VERB = ['Whistle at', 'Befriend', 'Fold', 'Apologise to', 'Bottle', 'Knit', 'Tame', 'Translate', 'Forget', 'Waltz with', 'Polish', 'Interview'];
const FIRST = ['Ottoline', 'Barnaby', 'Wilhelmina', 'Percival', 'Agatha', 'Florian', 'Hepzibah', 'Ignatius', 'Marigold', 'Cornelius', 'Philippa', 'Septimus', 'Euphemia', 'Bartholomew', 'Clementine', 'Mortimer', 'Rosalind', 'Thaddeus'];
const LAST = ['Quill', 'Fenwick-Moth', 'Inkwell', 'Tumblethorne', 'Pemberton', 'Ashgrove', 'Bramblewick', 'Starling', 'Mothersole', 'Gallowglass', 'Thistlewood', 'Underhill', 'Larkspur', 'Peabody', 'Cobblepot', 'Nightingale'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function bookTitle(aisle, k) {
    const r = rng(`book-${aisle}-${k}`);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const subject = SUBJECTS[aisle % SUBJECTS.length];
    const forms = [
        () => `A ${pick(ADJ)} History of ${pick(NOUN)}`,
        () => `${pick(NOUN)} and Where to Find Them`,
        () => `How to ${pick(VERB)} ${pick(NOUN)}`,
        () => `On the ${pick(ADJ)} Habits of ${pick(NOUN)}`,
        () => `${2 + Math.floor(r() * 98)} Ways to ${pick(VERB)} a Dragon`,
        () => `The ${pick(ADJ)} Book of ${pick(NOUN)}, Vol. ${pick(ROMAN)}`,
        () => `${subject}: Volume ${pick(ROMAN)}`,
        () => `${subject}, ${pick(['Revisited', 'Abridged', 'for Beginners', 'in Verse', 'Illustrated', 'Explained to a Goose'])}`,
        () => `The Diary of a ${pick(ADJ)} ${pick(NOUN).replace(/s$/, '')}`,
        () => `Letters to ${pick(NOUN)}`,
        () => `Everything I Know About ${pick(NOUN)} (Second Edition)`,
    ];
    const title = pick(forms)();
    const author = `${pick(FIRST)} ${pick(LAST)}`;
    const note = pick([
        'It smells of rain.', 'Someone has pressed a flower in chapter four.', 'The last page is missing. Of course it is.', 'Borrowed 112 times. Returned 111.',
        'It hums faintly.', 'The illustrations move when you are not looking.', 'Signed by the author, twice, in different handwriting.', 'A bookmark says “you were here”.',
        'It is warm, as if someone was just reading it.', 'Printed entirely in a very small font.', 'A note in the margin says “no!!”.', 'It is much bigger on the inside.',
    ]);
    return { title, author, note };
}

const MILESTONES = {
    5: 'Aisle 5. The reading room is behind you somewhere. The Stacks are ahead of you everywhere.',
    12: 'Aisle 12. A sign reads: “Please do not feed the books.”',
    25: 'Aisle 25. You are now further in than most visitors ever go.',
    50: 'Aisle 50. The candles here have been burning for a very long time and do not seem to mind.',
    100: 'Aisle 100. A librarian’s cardigan hangs on a hook. It is still warm.',
    200: 'Aisle 200. Somewhere a long way off, somebody stamps a book. Thunk.',
    365: 'Aisle 365. One for every day of the year. The Stacks have not noticed.',
    500: 'Aisle 500. You have walked three kilometres of books. The books have watched you every step.',
    1000: 'Aisle 1,000. Nobody has ever come this far, so nobody knows what comes next. More books, probably.',
};

// ------------------------------------------------------------- the reading room

export function buildLibrary(ctx) {
    const { W, D, ceil, audio, tower } = ctx;
    const T = 0.3;
    const Z0 = -D / 2;   // where the Stacks begin
    const r = ctx.rng;
    // the back wall, with a tall arch onto the Stacks
    const AH = 4.6;
    for (const s of [-1, 1]) ctx.box('rw', W / 2 - HW + T, ceil, T, s * (HW + (W / 2 - HW + T) / 2), ceil / 2, Z0 - T / 2);
    ctx.box('rw', 2 * HW, ceil - AH, T, 0, AH + (ceil - AH) / 2, Z0 - T / 2);
    ctx.geo('gold', new THREE.TorusGeometry(HW, 0.09, 8, 32, Math.PI), 0, AH - HW + 0.02, Z0 + 0.02);
    for (const s of [-1, 1]) ctx.box('gold', 0.16, AH - HW, 0.16, s * HW, (AH - HW) / 2, Z0 + 0.02);
    const sign = plaqueMesh('THE STACKS', 'Mind the infinity', 1.4);
    sign.position.set(0, AH + 0.45, Z0 + 0.04);
    ctx.add(sign);

    // shelves floor to ceiling on both side walls, a rolling ladder, armchairs and a rug
    const spine = spineTexture();
    const bookMat = new THREE.MeshStandardMaterial({ map: spine, roughness: 0.75, metalness: 0.05 });
    const roomBooks = [];
    for (const s of [-1, 1]) {
        const x = s * (W / 2 - 0.25);
        ctx.box('darkWood', 0.06, ceil - 0.2, D - 1.0, s * (W / 2 - 0.03), (ceil - 0.2) / 2, -0.4);
        for (let k = 0; k < 8; k++) ctx.box('darkWood', 0.5, 0.05, D - 1.0, x, 0.15 + k * 0.68, -0.4);
        for (let z = -D / 2 + 0.1; z <= D / 2 - 0.9; z += 1.4) ctx.box('darkWood', 0.5, ceil - 0.2, 0.06, x, (ceil - 0.2) / 2, z);
        ctx.collideBox(x, -0.4, 0.5, D - 1.0);
        for (let k = 0; k < 7; k++) roomBooks.push({ x: x + s * 0.02, y: 0.18 + k * 0.68, z0: -D / 2 + 0.15, z1: D / 2 - 0.95, s });
    }
    const roomShelf = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bookMat, 1700);
    roomShelf.count = fillShelves(roomShelf, roomBooks, rng('reading-room'), 1700, ['#7a2a2a', '#2a4a6a', '#2f5a46', '#8a6a2a', '#4a2a5a', '#6a4a3a', '#1a3a3a']);
    ctx.add(roomShelf);
    ctx.hit(roomShelf, { label: 'A book · click to take it down', range: 5.5, onClick: (h) => readBook(roomShelf, h.instanceId, 0, 'the reading room') });
    // ladder
    ctx.geo('wood', new THREE.BoxGeometry(0.06, ceil - 0.3, 0.06), W / 2 - 0.9, (ceil - 0.3) / 2, -1.6, 0, 1, 1, 1, 0, 0.12);
    ctx.geo('wood', new THREE.BoxGeometry(0.06, ceil - 0.3, 0.06), W / 2 - 0.9, (ceil - 0.3) / 2, -1.0, 0, 1, 1, 1, 0, 0.12);
    for (let k = 0; k < 12; k++) ctx.box('wood', 0.05, 0.05, 0.6, W / 2 - 0.9 - (0.3 + k * 0.42 - (ceil - 0.3) / 2) * Math.sin(0.12), 0.3 + k * 0.42, -1.3);
    // armchairs either side of a little table with a lamp
    const chair = (x, z, ry) => {
        ctx.box('velvet', 0.9, 0.4, 0.85, x, 0.35, z, ry);
        const bx = x - Math.sin(ry) * 0.38, bz = z - Math.cos(ry) * 0.38;
        ctx.box('velvet', 0.9, 0.9, 0.18, bx, 0.8, bz, ry);
        for (const sd of [-1, 1]) ctx.box('velvet', 0.16, 0.3, 0.8, x + Math.cos(ry) * sd * 0.42, 0.68, z - Math.sin(ry) * sd * 0.42, ry);
        ctx.collide(x, z, 0.55);
    };
    chair(-2.4, 1.6, Math.PI * 0.75);
    chair(-2.4, -1.4, Math.PI * 0.25);
    ctx.geo('darkWood', new THREE.CylinderGeometry(0.4, 0.4, 0.05, 20), -3.2, 0.7, 0.1);
    ctx.geo('darkWood', new THREE.CylinderGeometry(0.05, 0.08, 0.7, 8), -3.2, 0.35, 0.1);
    ctx.geo('brass', new THREE.CylinderGeometry(0.04, 0.06, 0.4, 8), -3.2, 0.92, 0.1);
    ctx.mat('shade', emissiveMat(0xffc070, 1.4, { color: 0xffc070 }));
    ctx.geo('shade', new THREE.CylinderGeometry(0.14, 0.24, 0.24, 16, 1, true), -3.2, 1.2, 0.1);
    ctx.collide(-3.2, 0.1, 0.45);
    ctx.mat('rug', new THREE.MeshStandardMaterial({ color: 0x5a1a1a, roughness: 1 }));
    ctx.geo('rug', new THREE.CylinderGeometry(2.6, 2.6, 0.02, 48), 0, 0.01, 0.3);
    ctx.geo('gold', new THREE.TorusGeometry(2.45, 0.025, 4, 48).rotateX(Math.PI / 2), 0, 0.025, 0.3);
    const readingLight = ctx.light(0xffc070, 13, 16, 0, ceil - 0.8, 0.3);
    const stackLight = ctx.light(0xffb860, 9, 11, 0, 3.4, Z0 - 3);

    // ------------------------------------------------------------- the Stacks
    const tpl = stackTemplate(ctx, bookMat);
    const bays = [];
    for (let i = 0; i < POOL; i++) {
        const g = tpl.clone(true);
        g.visible = false;
        const lamp = g.getObjectByName('lamp');
        lamp.material = lamp.material.clone();
        for (const f of g.getObjectByName('flames').children) f.material = f.material.clone();
        const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bookMat, 1100);
        books.frustumCulled = false;
        g.add(books);
        const signTex = canvasTex(512, 160, () => {});
        const signM = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4, metalness: 0.5, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.25 }));
        signM.position.set(0, 3.95, -0.13);
        g.add(signM);
        const bay = { g, books, signTex, s: -1, feature: g.getObjectByName('features'), out: null };
        ctx.add(g);
        ctx.hit(books, { label: 'A book · click to take it down', range: 5, active: () => Math.abs(bay.s - lastS) <= 1, onClick: (h) => readBook(books, h.instanceId, bay.s, `aisle ${bay.s + 1}`, bay) });
        const bell = bay.feature.getObjectByName('bell');
        ctx.hit(bell.getObjectByName('pull'), { label: 'A bell-pull · “Ring for the reading room”', range: 4, onClick: () => ringHome() });
        bays.push(bay);
    }

    const tmpM = new THREE.Matrix4(), tmpV = new V3(), tmpQ = new THREE.Quaternion(), tmpS = new V3();
    let lifted = null;   // { mesh, id, base, t }
    function readBook(mesh, id, aisle, where, bay) {
        if (id === undefined) return;
        if (lifted) putBack();
        mesh.getMatrixAt(id, tmpM);
        lifted = { mesh, id, base: tmpM.clone(), t: 0 };
        const b = bookTitle(aisle * 997 + 13, id);
        audio.page();
        ctx.say(`“${b.title}” by ${b.author}. ${b.note}`, 6000);
        const n = (tower.booksRead = (tower.booksRead || 0) + 1);
        if (n === 10) setTimeout(() => ctx.say('Ten books taken down. The librarian (somewhere) has started a little card with your name on it.', 5000), 6200);
    }
    function putBack() {
        lifted.mesh.setMatrixAt(lifted.id, lifted.base);
        lifted.mesh.instanceMatrix.needsUpdate = true;
        lifted = null;
    }

    let farthest = 0, said = new Set();
    function ringHome() {
        audio.bell(74, 0, 0.06);
        audio.bell(81, 0.3, 0.05);
        audio.bell(86, 0.6, 0.05);
        ctx.say('Far away, a bell rings in the reading room, and the Stacks fold you gently back to it.', 4500);
        tower.flashTo(ctx.toFloor(0, Z0 + 2.6), ctx.frame.ry + Math.PI);
    }

    function layBay(bay, s) {
        bay.s = s;
        bay.g.position.z = Z0 - s * L;
        bay.g.visible = true;
        const rr = rng('bay' + s);
        const hue = (s * 0.137) % 1;
        const pal = [0, 1, 2, 3, 4, 5].map((k) => new THREE.Color().setHSL((hue + k * 0.09 + rr() * 0.05) % 1, 0.35 + rr() * 0.35, 0.22 + rr() * 0.22));
        const rows = [];
        for (const sd of [-1, 1]) for (let k = 0; k < 6; k++) rows.push({ x: sd * (HW - 0.22), y: 0.2 + k * 0.7, z0: -0.15, z1: -L + 0.15, s: sd });
        if (lifted?.mesh === bay.books) lifted = null;
        bay.books.count = fillShelves(bay.books, rows, rr, 1100, pal, true);
        bay.books.instanceMatrix.needsUpdate = true;
        bay.books.computeBoundingSphere();
        bay.books.computeBoundingBox();
        if (bay.books.instanceColor) bay.books.instanceColor.needsUpdate = true;
        // the sign on the arch
        const c = bay.signTex.image, x = c.getContext('2d');
        const gr = x.createLinearGradient(0, 0, 0, 160);
        gr.addColorStop(0, '#d8b664');
        gr.addColorStop(1, '#8a6a2c');
        x.fillStyle = gr;
        x.fillRect(0, 0, 512, 160);
        x.strokeStyle = '#4a3410';
        x.lineWidth = 6;
        x.strokeRect(8, 8, 496, 144);
        x.fillStyle = '#2a1a06';
        x.textAlign = 'center';
        x.font = '600 50px Georgia, serif';
        x.fillText(`Aisle ${(s + 1).toLocaleString('en')}`, 256, 70);
        x.font = 'italic 32px Georgia, serif';
        x.fillText(SUBJECTS[(s * 997 + 13) % SUBJECTS.length], 256, 122, 470);
        bay.signTex.needsUpdate = true;
        // what else is in this bay
        const f = bay.feature;
        const pick = rr();
        for (const ch of f.children) ch.visible = false;
        f.getObjectByName('candles').visible = true;
        if (s % 10 === 9) f.getObjectByName('bell').visible = true;
        else if (pick < 0.18) f.getObjectByName('ladder').visible = true;
        else if (pick < 0.32) {
            f.getObjectByName('chair').visible = true;
            f.getObjectByName('cat').visible = rr() < 0.5;
        } else if (pick < 0.44) f.getObjectByName('lectern').visible = true;
        else if (pick < 0.56) f.getObjectByName('swarm').visible = true;
        else if (pick < 0.62) f.getObjectByName('globe').visible = true;
        const side = rr() < 0.5 ? -1 : 1;
        f.scale.x = side;
        bay.lampHue = hue;
        bay.g.getObjectByName('lamp').material.emissive.setHSL((0.08 + hue * 0.1) % 1, 0.8, 0.55);
    }

    let lastS = -99;
    const flame = bays.map((b) => b.g.getObjectByName('flames'));
    return {
        walk: (lx, lz, m) => lz < Z0 + 0.6 && Math.abs(lx) < HW - Math.max(m, 0.35) + (m < 0 ? 0.6 : 0),
        enter() {},
        leave() {
            if (lifted) putBack();
        },
        update(dt, t) {
            const p = ctx.player();
            const depth = Z0 - p.z;
            const cur = Math.max(0, Math.floor(depth / L));
            if (cur !== lastS) {
                lastS = cur;
                const want = new Set();
                for (let s = Math.max(0, cur - 3); s <= cur + POOL - 4; s++) want.add(s);
                for (const b of bays) if (!want.has(b.s)) b.s = -1;
                for (const s of want) {
                    if (bays.some((b) => b.s === s)) continue;
                    const free = bays.find((b) => b.s === -1);
                    if (free) layBay(free, s);
                }
                for (const b of bays) if (b.s === -1) b.g.visible = false;
                if (cur > farthest) farthest = cur;
                const aisle = cur + 1;
                if (MILESTONES[aisle] && !said.has(aisle)) {
                    said.add(aisle);
                    ctx.say(MILESTONES[aisle], 6000);
                }
                if (aisle > 1) document.getElementById('hud-zone').textContent = `The Stacks · Aisle ${aisle.toLocaleString('en')}`;
            }
            // the deeper you go, the closer the dark
            const k = smoothstep(-1, 7, depth);
            tower.scene.fog.density = lerp(0.012, 0.06, k);
            tower.scene.fog.color.setRGB(lerp(0.07, 0.1, k), lerp(0.047, 0.06, k), lerp(0.078, 0.035, k));
            tower.scene.background.copy(tower.scene.fog.color);
            audio.setAir(0.05 + k * 0.12);
            // two lights walk with you down the aisle
            if (depth > 1) {
                const pf = ctx.toFloor(0, p.z - 2.2);
                stackLight.position.set(pf.x, 3.6, pf.z);
                const pb = ctx.toFloor(0, Math.min(Z0 + 2, p.z + 3.5));
                readingLight.position.set(pb.x, 3.8, pb.z);
                readingLight.intensity = lerp(13, 7, k);
            } else {
                const a = ctx.toFloor(0, 0.3), b = ctx.toFloor(0, Z0 - 3);
                readingLight.position.set(a.x, ceil - 0.8, a.z);
                readingLight.intensity = 13;
                stackLight.position.set(b.x, 3.4, b.z);
            }
            for (const b of bays) {
                if (b.s < 0) continue;
                const sw = b.g.getObjectByName('swarm');
                if (sw.visible) sw.children.forEach((bk, i) => {
                    const a = t * 0.7 + i * 1.3;
                    bk.position.set(Math.sin(a) * 0.6, 2.4 + Math.sin(a * 1.7) * 0.4, -L / 2 + Math.cos(a) * 0.9);
                    bk.rotation.set(0, -a, Math.sin(t * 6 + i) * 0.5);
                    bk.children[0].rotation.z = Math.sin(t * 8 + i) * 0.5;
                    bk.children[1].rotation.z = -Math.sin(t * 8 + i) * 0.5;
                });
            }
            flame.forEach((fl, i) => {
                if (!bays[i].g.visible) return;
                fl.children.forEach((c, j) => {
                    c.position.y = 3.0 + Math.sin(t * 0.8 + j * 2 + i) * 0.12;
                    c.material.opacity = 0.75 + Math.sin(t * 9 + j) * 0.15;
                });
            });
            if (lifted) {
                lifted.t += dt;
                const k2 = lifted.t < 0.3 ? lifted.t / 0.3 : lifted.t > 5.4 ? Math.max(0, 1 - (lifted.t - 5.4) / 0.3) : 1;
                lifted.base.decompose(tmpV, tmpQ, tmpS);
                const side = tmpV.x > 0 ? -1 : 1;
                tmpV.x += side * 0.22 * k2;
                tmpV.y += 0.05 * k2;
                tmpM.compose(tmpV, tmpQ, tmpS);
                lifted.mesh.setMatrixAt(lifted.id, tmpM);
                lifted.mesh.instanceMatrix.needsUpdate = true;
                if (lifted.t > 5.7) putBack();
            }
        },
    };
}

/** A pale spine with gilt bands; each book's own colour tints it. */
function spineTexture() {
    return canvasTex(64, 128, (x, w, h) => {
        x.fillStyle = '#ffffff';
        x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(0,0,0,0.12)';
        x.fillRect(0, 0, 6, h);
        x.fillRect(w - 6, 0, 6, h);
        x.fillStyle = '#e8c070';
        for (const y of [10, 18, h - 22, h - 14]) x.fillRect(4, y, w - 8, 3);
        x.fillRect(16, 44, w - 32, 4);
        x.fillRect(12, 54, w - 24, 2);
        x.fillRect(16, 62, w - 32, 4);
    });
}

/** Lays books along shelf rows. Rows run along z on the wall at x, facing the aisle by `s`. Returns the count. */
function fillShelves(mesh, rows, r, max, palette, varied = false) {
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    let n = 0;
    for (const row of rows) {
        let z = row.z0;
        const dir = row.z1 < row.z0 ? -1 : 1;
        while ((z - row.z1) * dir < 0 && n < max) {
            const w = 0.035 + r() * 0.06, h = 0.26 + r() * 0.24, d = 0.24 + r() * 0.08;
            if (r() < 0.04) {
                z += dir * (0.1 + r() * 0.25);
                continue;
            }
            const lean = r() < 0.06 ? (r() - 0.5) * 0.5 : 0;
            o.position.set(row.x - row.s * (0.25 - d / 2), row.y + h / 2, z + (dir * w) / 2);
            o.rotation.set(lean, 0, 0);
            o.scale.set(d, h, w);
            o.updateMatrix();
            mesh.setMatrixAt(n, o.matrix);
            col.copy(palette[Math.floor(r() * palette.length)]);
            if (varied) col.offsetHSL(0, 0, (r() - 0.5) * 0.08);
            mesh.setColorAt(n, col);
            n++;
            z += dir * (w + 0.004);
        }
    }
    mesh.instanceMatrix.needsUpdate = true;
    return n;
}

/** One bay of the Stacks, from z = 0 to z = -L: shelves, a vaulted ceiling, an arch, a lamp and the furniture that may appear. */
function stackTemplate(ctx, bookMat) {
    const mats = { ...ctx.mats, ...ctx.roomMats };
    const b = new Batch();
    const box = (key, w, h, d, x, y, z, ry = 0) => b.add(key, new THREE.BoxGeometry(w, h, d), xf(x, y, z, ry));
    mats.vault = mats.vault || new THREE.MeshStandardMaterial({ map: wallpaper('stars', 0x1a0e18, '#c8a050', '#f3e3bf', [6, 2]), roughness: 0.9, side: THREE.BackSide });
    mats.runner = new THREE.MeshStandardMaterial({ color: 0x7a1a2a, roughness: 1 });
    box('rf', HW * 2 + 0.2, 0.2, L, 0, -0.1, -L / 2);
    box('runner', 1.3, 0.02, L, 0, 0.01, -L / 2);
    box('gold', 0.05, 0.022, L, -0.68, 0.012, -L / 2);
    box('gold', 0.05, 0.022, L, 0.68, 0.012, -L / 2);
    for (const s of [-1, 1]) {
        const x = s * (HW - 0.22);
        box('darkWood', 0.06, SHELF_H, L, s * (HW + 0.02), SHELF_H / 2, -L / 2);
        for (let k = 0; k < 7; k++) box('darkWood', 0.48, 0.05, L, x, 0.17 + k * 0.7, -L / 2);
        for (const z of [-0.06, -L / 2, -L + 0.06]) box('darkWood', 0.5, SHELF_H, 0.1, x, SHELF_H / 2, z);
        box('darkWood', 0.56, 0.2, L, x + s * 0.02, SHELF_H + 0.1, -L / 2);
    }
    // a barrel vault over the aisle, with a gilded rib at each arch
    b.add('vault', new THREE.CylinderGeometry(HW + 0.05, HW + 0.05, L, 24, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), xf(0, SHELF_H + 0.2, -L / 2));
    b.add('gold', new THREE.TorusGeometry(HW, 0.07, 6, 24, Math.PI), xf(0, SHELF_H + 0.2, -0.05));
    for (const s of [-1, 1]) box('gold', 0.14, SHELF_H + 0.2, 0.14, s * (HW - 0.02), (SHELF_H + 0.2) / 2, -0.05);
    // the hanging lamp's chain
    box('iron', 0.02, 1.0, 0.02, 0, SHELF_H + 1.2, -L / 2);
    const g = b.build(mats, { castShadow: false, receiveShadow: false });
    const lampMat = emissiveMat(0xffb050, 2.2, { color: 0xffd090 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10).scale(1, 1.3, 1), lampMat);
    lamp.name = 'lamp';
    lamp.position.set(0, SHELF_H + 0.55, -L / 2);
    g.add(lamp);
    const lg = glow(0xffc070, 1.8, 0.45);
    lg.position.copy(lamp.position);
    g.add(lg);

    // the furniture that may or may not be in a bay (turned to either side by the bay)
    const f = new THREE.Group();
    f.name = 'features';
    g.add(f);
    // floating candles
    const candles = new THREE.Group();
    candles.name = 'candles';
    for (let k = 0; k < 3; k++) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.26, 8), ctx.mats.wax);
        c.position.set(-0.6 + k * 0.6, 2.9, -1.2 - k * 1.8);
        candles.add(c);
    }
    f.add(candles);
    const flames = new THREE.Group();
    flames.name = 'flames';
    for (let k = 0; k < 3; k++) {
        const fl = glow(0xffc070, 0.35, 0.85);
        fl.position.set(-0.6 + k * 0.6, 3.0, -1.2 - k * 1.8);
        flames.add(fl);
    }
    g.add(flames);
    // a rolling ladder
    const ladder = new THREE.Group();
    ladder.name = 'ladder';
    for (const z of [-2.2, -2.8]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 4.2, 0.05), ctx.mats.wood);
        rail.position.set(HW - 0.75, 2.05, z);
        rail.rotation.z = -0.14;
        ladder.add(rail);
    }
    for (let k = 0; k < 10; k++) {
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.6), ctx.mats.wood);
        rung.position.set(HW - 0.75 + (2.05 - (0.3 + k * 0.42)) * Math.sin(0.14), 0.3 + k * 0.42, -2.5);
        ladder.add(rung);
    }
    f.add(ladder);
    // an armchair, sometimes with a cat in it
    const chair = new THREE.Group();
    chair.name = 'chair';
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.38, 0.7), ctx.mats.velvet);
    seat.position.set(HW - 0.85, 0.32, -3);
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.7), ctx.mats.velvet);
    back.position.set(HW - 0.55, 0.8, -3);
    chair.add(back);
    f.add(chair);
    const cat = new THREE.Group();
    cat.name = 'cat';
    const fur = new THREE.MeshStandardMaterial({ color: 0xe0883a, roughness: 1 });
    const cb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10).scale(1, 0.55, 1.2), fur);
    cb.position.set(HW - 0.9, 0.62, -3);
    cat.add(cb);
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), fur);
    ch.position.set(HW - 0.95, 0.64, -2.8);
    cat.add(ch);
    for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), fur);
        ear.position.set(HW - 0.95 + s * 0.06, 0.74, -2.8);
        cat.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 16, Math.PI * 1.2), fur);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(HW - 0.9, 0.58, -3.05);
    cat.add(tail);
    f.add(cat);
    // a lectern with an open book and a candle
    const lec = new THREE.Group();
    lec.name = 'lectern';
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.1, 8), ctx.mats.darkWood);
    post.position.set(HW - 0.85, 0.55, -3);
    lec.add(post);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.6), ctx.mats.darkWood);
    top.position.set(HW - 0.85, 1.12, -3);
    top.rotation.z = 0.3;
    lec.add(top);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.5), ctx.mats.paper);
    pages.position.set(HW - 0.86, 1.16, -3);
    pages.rotation.z = 0.3;
    lec.add(pages);
    f.add(lec);
    // a drift of books flying about like birds
    const swarm = new THREE.Group();
    swarm.name = 'swarm';
    for (let k = 0; k < 5; k++) {
        const bk = new THREE.Group();
        const c = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(k / 5, 0.5, 0.4), roughness: 0.8, side: THREE.DoubleSide });
        for (const s of [-1, 1]) {
            const half = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.22).translate(s * 0.08, 0, 0), c);
            bk.add(half);
        }
        swarm.add(bk);
    }
    f.add(swarm);
    // a globe on a stand
    const globe = new THREE.Group();
    globe.name = 'globe';
    const gs = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.18, 0.9, 10), ctx.mats.darkWood);
    gs.position.set(HW - 0.8, 0.45, -3);
    globe.add(gs);
    const gb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), new THREE.MeshStandardMaterial({ color: 0x3a6a9a, roughness: 0.4, emissive: 0x0a1a2a }));
    gb.position.set(HW - 0.8, 1.15, -3);
    globe.add(gb);
    f.add(globe);
    // the bell-pull home, every tenth bay
    const bell = new THREE.Group();
    bell.name = 'bell';
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6), ctx.mats.velvet);
    rope.position.set(HW - 0.5, 2.6, -3);
    bell.add(rope);
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 10), ctx.mats.gold);
    tassel.position.set(HW - 0.5, 1.3, -3);
    tassel.name = 'pull';
    bell.add(tassel);
    const bellTop = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10, 0, TAU, 0, Math.PI / 1.6), ctx.mats.gold);
    bellTop.position.set(HW - 0.5, 3.9, -3);
    bell.add(bellTop);
    const bellSign = plaqueMesh('Ring for the', 'reading room', 0.5);
    bellSign.position.set(HW - 0.5, 1.7, -2.6);
    bellSign.rotation.y = -Math.PI / 2;
    bell.add(bellSign);
    f.add(bell);
    return g;
}
