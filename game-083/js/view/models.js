// Wireframe models: every one is a flat list of 3D segments [ax,ay,az,bx,by,bz, ...] in local
// units (y up, forward is -z), drawn with drawModel(). All edges show, the way Battlezone drew
// them: there is no hidden-line removal on a vector monitor.

const TAU = Math.PI * 2;

class M {
    constructor() { this.s = []; }
    line(a, b) { this.s.push(a[0], a[1], a[2], b[0], b[1], b[2]); return this; }
    poly(pts, closed = false) {
        for (let i = 0; i + 1 < pts.length; i++) this.line(pts[i], pts[i + 1]);
        if (closed && pts.length > 2) this.line(pts[pts.length - 1], pts[0]);
        return this;
    }
    /** Rectangular frustum: bottom w0×d0 at y0, top w1×d1 at y1 (w1 = 0 makes a pyramid). */
    frustum(cx, cz, y0, w0, d0, y1, w1, d1) {
        const b = [[-w0, -d0], [w0, -d0], [w0, d0], [-w0, d0]].map(([x, z]) => [cx + x / 2, y0, cz + z / 2]);
        const t = [[-w1, -d1], [w1, -d1], [w1, d1], [-w1, d1]].map(([x, z]) => [cx + x / 2, y1, cz + z / 2]);
        this.poly(b, true);
        if (w1 > 0 || d1 > 0) this.poly(t, true);
        for (let i = 0; i < 4; i++) this.line(b[i], t[i]);
        return this;
    }
    box(cx, cy, cz, w, h, d) { return this.frustum(cx, cz, cy - h / 2, w, d, cy + h / 2, w, d); }
    /** n-sided prism or cone along y, radius r0 at y0 to r1 at y1. */
    prism(cx, cz, y0, y1, r0, r1 = r0, n = 8, a0 = 0) {
        const b = [], t = [];
        for (let i = 0; i < n; i++) {
            const a = a0 + (i / n) * TAU;
            b.push([cx + Math.cos(a) * r0, y0, cz + Math.sin(a) * r0]);
            t.push([cx + Math.cos(a) * r1, y1, cz + Math.sin(a) * r1]);
        }
        this.poly(b, true);
        if (r1 > 0.01) this.poly(t, true);
        for (let i = 0; i < n; i++) this.line(b[i], t[i]);
        return this;
    }
    /** A ring in the plane normal to axis 'x', 'y' or 'z'. */
    ring(cx, cy, cz, r, n = 8, axis = 'y', spokes = false) {
        const pts = [];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU, u = Math.cos(a) * r, v = Math.sin(a) * r;
            pts.push(axis === 'x' ? [cx, cy + u, cz + v] : axis === 'z' ? [cx + u, cy + v, cz] : [cx + u, cy, cz + v]);
        }
        this.poly(pts, true);
        if (spokes) for (let i = 0; i < n; i += 2) this.line([cx, cy, cz], pts[i]);
        return this;
    }
    /** Copy everything so far mirrored across x = 0. */
    mirrorX() {
        const s = this.s, n = s.length;
        for (let i = 0; i < n; i += 6) s.push(-s[i], s[i + 1], s[i + 2], -s[i + 3], s[i + 4], s[i + 5]);
        return this;
    }
    done() { return new Float32Array(this.s); }
}

// ------------------------------------------------------------------ Act I
function footman() {
    const m = new M();
    m.poly([[-0.25, 0, 0.05], [-0.12, 0.95, 0], [0.12, 0.95, 0], [0.25, 0, 0.05]]);    // legs
    m.line([0, 0.95, 0], [0, 1.6, 0]);
    m.line([-0.4, 1.5, 0], [0.4, 1.5, 0]);
    m.box(0, 1.8, 0, 0.36, 0.36, 0.36);                                                 // helm
    m.line([-0.22, 1.98, 0], [0, 2.18, 0]).line([0.22, 1.98, 0], [0, 2.18, 0]);
    m.poly([[-0.75, 1.55, -0.3], [-0.15, 1.55, -0.3], [-0.2, 1.05, -0.3], [-0.45, 0.7, -0.3], [-0.7, 1.05, -0.3]], true); // kite shield
    m.line([-0.45, 1.5, -0.3], [-0.45, 0.85, -0.3]).line([-0.68, 1.3, -0.3], [-0.22, 1.3, -0.3]);
    m.line([0.4, 1.5, 0], [0.45, 1.1, -0.2]);
    m.line([0.45, 0.1, 0.3], [0.45, 2.6, -0.6]);                                        // spear
    m.poly([[0.38, 2.5, -0.5], [0.45, 2.95, -0.75], [0.52, 2.5, -0.5]]);
    return m.done();
}

function ballista() {
    const m = new M();
    m.box(0, 0.75, 0, 2.2, 0.5, 3.2);
    for (const x of [-1.2, 1.2]) for (const z of [-1.05, 1.05]) m.ring(x, 0.55, z, 0.55, 8, 'x', true);
    m.box(0, 1.25, -0.2, 0.36, 0.3, 3.6);                                                // stock
    m.poly([[-2, 1.4, -1.0], [-1.1, 1.35, -1.75], [0, 1.3, -1.95], [1.1, 1.35, -1.75], [2, 1.4, -1.0]]); // bow
    m.poly([[-2, 1.4, -1.0], [0, 1.4, 0.9], [2, 1.4, -1.0]]);                            // string
    m.line([0, 1.5, 0.9], [0, 1.5, -2.6]);                                                 // bolt
    m.poly([[-0.15, 1.5, -2.3], [0, 1.5, -2.8], [0.15, 1.5, -2.3]]);
    m.line([-0.6, 1.0, 1.6], [-0.6, 0.2, 2.4]).line([0.6, 1.0, 1.6], [0.6, 0.2, 2.4]);    // trail legs
    return m.done();
}

function lancer() {
    const m = new M();
    m.box(0, 1.35, 0, 0.75, 0.75, 2.3);                                                    // horse
    for (const x of [-0.3, 0.3]) {
        m.poly([[x, 1.0, -0.9], [x, 0.5, -1.3], [x, 0, -1.1]]);
        m.poly([[x, 1.0, 0.9], [x, 0.5, 1.2], [x, 0, 1.4]]);
    }
    m.poly([[0, 1.55, -1.1], [0, 2.25, -1.55], [0, 2.35, -2.25], [0, 1.95, -2.35], [0, 1.75, -1.75]], true); // neck + head
    m.line([0, 2.35, -1.6], [0, 2.6, -1.5]);                                               // ear
    m.poly([[0, 1.6, 1.15], [0, 1.2, 1.6], [0, 0.6, 1.7]]);                                // tail
    m.line([0, 1.75, 0.15], [0, 2.75, 0.15]);                                              // rider
    m.line([-0.35, 2.5, 0.15], [0.35, 2.5, 0.15]);
    m.box(0, 2.95, 0.15, 0.36, 0.4, 0.36);
    m.poly([[-0.18, 3.15, 0.15], [0, 3.45, 0.3], [0.18, 3.15, 0.15]]);                     // plume
    m.line([0.45, 2.1, 1.0], [0.45, 1.75, -4.2]);                                          // lance
    m.poly([[0.45, 2.1, 0.1], [0.45, 2.45, -0.4], [0.45, 1.8, -0.4]], true);              // vamplate
    m.poly([[0.45, 1.78, -3.6], [0.45, 2.15, -3.2], [0.45, 1.85, -3.0]]);                  // pennant
    return m.done();
}

function wizard() {
    const m = new M();
    m.frustum(0, 0, 0, 1.3, 1.3, 1.5, 0.45, 0.45);                                         // robe
    m.prism(0, 0, 1.5, 1.7, 0.28, 0.28, 6);
    m.ring(0, 1.75, 0, 0.7, 10);                                                          // brim
    m.prism(0, 0, 1.75, 2.9, 0.42, 0, 6);                                                 // hat
    m.line([0, 2.9, 0], [0.25, 3.05, 0.25]);
    m.line([-0.3, 1.3, 0], [-0.75, 1.1, -0.3]).line([0.3, 1.3, 0], [0.7, 1.4, -0.2]);     // arms
    m.line([0.7, -0.2, -0.2], [0.7, 2.4, -0.2]);                                           // staff
    return m.done();
}

function troll() {
    const m = new M();
    m.frustum(0, 0.15, 1.2, 1.9, 1.4, 2.9, 1.4, 1.1);                                     // hunched body
    m.poly([[-0.55, 1.2, 0.2], [-0.6, 0.6, 0.0], [-0.45, 0, -0.2]]);                       // legs
    m.poly([[0.55, 1.2, 0.2], [0.6, 0.6, 0.0], [0.45, 0, -0.2]]);
    m.box(0, 2.85, -0.75, 0.75, 0.6, 0.7);                                                 // head, low and forward
    m.poly([[-0.25, 2.65, -1.12], [-0.15, 2.4, -1.15]]).poly([[0.25, 2.65, -1.12], [0.15, 2.4, -1.15]]); // tusks
    m.poly([[-0.95, 2.7, 0], [-1.35, 1.5, -0.3], [-1.25, 0.5, -0.5]]);                     // arms
    m.poly([[0.95, 2.7, 0], [1.4, 1.8, -0.4], [1.5, 1.3, -1.2]]);
    m.prism(1.5, -1.4, 1.2, 3.3, 0.18, 0.45, 5);                                           // club
    return m.done();
}

function juggernaut() {
    const m = new M();
    m.box(0, 1.0, 0, 3.0, 1.0, 5.0);
    m.frustum(0, 0.2, 1.5, 3.0, 4.6, 2.6, 2.0, 3.4);                                      // armoured roof
    for (const x of [-1.6, 1.6]) for (const z of [-1.7, 0, 1.7]) m.ring(x, 0.7, z, 0.7, 8, 'x', true);
    m.poly([[-1.4, 0.6, -2.5], [0, 1.0, -4.3], [1.4, 0.6, -2.5]]);                         // ram
    m.poly([[-1.4, 1.5, -2.5], [0, 1.0, -4.3], [1.4, 1.5, -2.5]]);
    m.box(0, 2.85, 0.2, 0.4, 0.3, 2.6);                                                    // roof ballista
    m.poly([[-1.6, 3.0, -0.6], [0, 2.95, -1.3], [1.6, 3.0, -0.6]]);
    m.poly([[-1.6, 3.0, -0.6], [0, 3.0, 1.2], [1.6, 3.0, -0.6]]);
    for (const x of [-1.2, 0, 1.2]) m.line([x, 1.5, -2.5], [x, 2.0, -2.9]);                // spikes
    return m.done();
}

function dragonbaneBody() {
    const m = new M();
    m.box(0, 1.6, 0, 7, 2.2, 8);
    for (const x of [-3.7, 3.7]) for (const z of [-2.6, 2.6]) m.ring(x, 1.4, z, 1.4, 10, 'x', true);
    m.frustum(0, 0.3, 2.7, 6, 6.6, 9.2, 4.6, 5);                                          // the tower
    m.line([-2.9, 4.8, -3.0], [2.9, 4.8, -3.0]).line([-2.6, 7, -2.75], [2.6, 7, -2.75]);  // tiers
    for (let i = 0; i < 5; i++) {
        const x = -2.3 + i * 1.15;
        m.poly([[x - 0.3, 9.2, -2.5], [x - 0.3, 9.9, -2.5], [x + 0.3, 9.9, -2.5], [x + 0.3, 9.2, -2.5]]); // merlons
    }
    m.ring(0, 5.9, -3.0, 1.15, 12, 'z', true);                                             // the ward-eye
    m.ring(0, 5.9, -3.0, 0.45, 6, 'z');
    m.poly([[-3.4, 0.5, -4], [0, 1.2, -6.2], [3.4, 0.5, -4]]);                             // plough
    return m.done();
}

function dragonbaneTurret() {
    const m = new M();
    m.box(0, 10.3, 0, 1.0, 0.7, 6);
    m.poly([[-4.4, 10.6, -1.5], [-2.4, 10.5, -3.0], [0, 10.4, -3.4], [2.4, 10.5, -3.0], [4.4, 10.6, -1.5]]);
    m.poly([[-4.4, 10.6, -1.5], [0, 10.7, 2.6], [4.4, 10.6, -1.5]]);
    m.line([0, 10.8, 2.6], [0, 10.8, -4.6]);
    m.poly([[-0.3, 10.8, -4.0], [0, 10.8, -5.0], [0.3, 10.8, -4.0]]);
    return m.done();
}

// ------------------------------------------------------------------ the plain
function menhir() { return new M().frustum(0, 0, 0, 1.6, 1.1, 4.6, 0.9, 0.6).line([-0.45, 4.6, 0], [0.2, 5.0, 0]).line([0.2, 5.0, 0], [0.45, 4.6, 0]).done(); }
function cairn() { return new M().frustum(0, 0, 0, 4.2, 4.2, 3.6, 0, 0).done(); }
function ruin() {
    const m = new M();
    m.poly([[-2.6, 0, -0.4], [-2.6, 3.8, -0.4], [-2.0, 4.3, -0.4], [-1.6, 3.6, -0.4], [-0.9, 3.9, -0.4], [-0.6, 0, -0.4]]);
    m.poly([[-2.6, 0, 0.4], [-2.6, 3.8, 0.4], [-2.0, 4.3, 0.4], [-1.6, 3.6, 0.4], [-0.9, 3.9, 0.4], [-0.6, 0, 0.4]]);
    m.line([-2.6, 3.8, -0.4], [-2.6, 3.8, 0.4]).line([-0.9, 3.9, -0.4], [-0.9, 3.9, 0.4]);
    m.poly([[-0.6, 2.2, -0.4], [0.2, 2.9, -0.4], [1.0, 2.2, -0.4]]);                       // the broken arch
    m.poly([[1.0, 0, -0.4], [1.0, 2.2, -0.4], [1.6, 2.6, -0.4], [2.6, 1.8, -0.4], [2.6, 0, -0.4]]);
    m.poly([[1.0, 0, 0.4], [1.0, 2.2, 0.4], [1.6, 2.6, 0.4], [2.6, 1.8, 0.4], [2.6, 0, 0.4]]);
    m.line([1.6, 2.6, -0.4], [1.6, 2.6, 0.4]);
    m.box(0.6, 0.35, 1.6, 1.2, 0.7, 0.8);                                                  // a fallen block
    return m.done();
}
function pine() {
    const m = new M();
    m.line([0, 0, 0], [0, 1.0, 0]);
    m.prism(0, 0, 1.0, 3.0, 1.6, 0, 6);
    m.prism(0, 0, 2.4, 4.4, 1.2, 0, 6, 0.5);
    m.prism(0, 0, 3.8, 5.8, 0.8, 0, 6);
    return m.done();
}
function barrow() {
    const m = new M();
    m.prism(0, 0, 0, 1.2, 2.6, 1.9, 8);
    m.prism(0, 0, 1.2, 1.9, 1.9, 0.8, 8);
    m.poly([[-0.5, 0, -2.6], [-0.5, 0.9, -2.4], [0, 1.2, -2.3], [0.5, 0.9, -2.4], [0.5, 0, -2.6]]); // the door
    return m.done();
}

// ------------------------------------------------------------------ Act II
function tower(h) {
    const m = new M();
    m.prism(0, 0, 0, h, 2.0, 1.7, 6, Math.PI / 6);
    m.prism(0, 0, h, h + 0.7, 2.4, 2.4, 6, Math.PI / 6);                                   // battlement
    m.ring(0, h * 0.5, 0, 1.9, 6, 'y');
    m.line([-1.0, h * 0.55, -1.4], [-1.0, h * 0.55 + 1.2, -1.4]);                          // arrow slit
    m.line([1.0, h * 0.35, -1.4], [1.0, h * 0.35 + 1.2, -1.4]);
    return m.done();
}

function crystal() {
    const m = new M();
    const t = [0, 1.3, 0], b = [0, -1.3, 0], r = 0.8;
    const eq = [[r, 0, 0], [0, 0, r], [-r, 0, 0], [0, 0, -r]];
    m.poly(eq, true);
    for (const p of eq) { m.line(t, p); m.line(b, p); }
    return m.done();
}

function turret() {
    const m = new M();
    m.box(0, -0.6, 0, 1.2, 0.5, 1.2);
    m.line([0, -0.35, 0], [0, 0.2, 0]);
    m.box(0, 0.35, 0, 0.3, 0.3, 2.2);
    m.poly([[-1.4, 0.45, -0.5], [0, 0.4, -1.1], [1.4, 0.45, -0.5]]);
    m.poly([[-1.4, 0.45, -0.5], [0, 0.45, 0.9], [1.4, 0.45, -0.5]]);
    return m.done();
}

export const MODELS = {
    footman: footman(), ballista: ballista(), lancer: lancer(), wizard: wizard(), troll: troll(),
    juggernaut: juggernaut(), dragonbane: dragonbaneBody(), dragonbaneTurret: dragonbaneTurret(),
    menhir: menhir(), cairn: cairn(), ruin: ruin(), pine: pine(), barrow: barrow(),
    crystal: crystal(), turret: turret(),
};

const towerCache = new Map();
export function towerModel(h) {
    const k = Math.round(h * 4) / 4;
    if (!towerCache.has(k)) towerCache.set(k, tower(k));
    return towerCache.get(k);
}

/** The obstacle models are drawn at a scale that matches their collision radius. */
export const OB_BASE_R = { menhir: 1.3, cairn: 2.8, ruin: 3.0, pine: 1.5, barrow: 2.6 };

/**
 * Draw a model at (x, y, z) in three.js coordinates, turned to heading h (h = 0 faces -z, h grows
 * turning right), scaled by s. sy squashes it vertically (for bobbing and squash).
 */
export function drawModel(b, model, x, y, z, h, s = 1, sy = 1) {
    const c = Math.cos(h), sn = Math.sin(h);
    for (let i = 0; i < model.length; i += 6) {
        const ax = model[i] * s, ay = model[i + 1] * s * sy, az = model[i + 2] * s;
        const bx = model[i + 3] * s, by = model[i + 4] * s * sy, bz = model[i + 5] * s;
        b.seg3(x + ax * c - az * sn, y + ay, z + ax * sn + az * c, x + bx * c - bz * sn, y + by, z + bx * sn + bz * c);
    }
}

/** Every segment of a placed model in world space, for explosions. */
export function placedSegments(model, x, y, z, h, s = 1, step = 1) {
    const c = Math.cos(h), sn = Math.sin(h), out = [];
    for (let i = 0; i < model.length; i += 6 * step) {
        const ax = model[i] * s, ay = model[i + 1] * s, az = model[i + 2] * s;
        const bx = model[i + 3] * s, by = model[i + 4] * s, bz = model[i + 5] * s;
        out.push([x + ax * c - az * sn, y + ay, z + ax * sn + az * c, x + bx * c - bz * sn, y + by, z + bx * sn + bz * c]);
    }
    return out;
}
