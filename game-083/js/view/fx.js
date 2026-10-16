// Effects in three.js world space: explosion fragments (the destroyed model's own segments,
// flung out and tumbling under gravity, as Battlezone's tanks came apart), sparks, flame puffs
// and expanding rings. All cosmetic, so Math.random is fine here.

const MAX_FRAG = 1800, MAX_SPARK = 1400;

export class Fx {
    constructor() {
        this.frags = [];
        this.sparks = [];
        this.rings = [];
    }

    reset() { this.frags.length = 0; this.sparks.length = 0; this.rings.length = 0; }

    /** segs: [[ax,ay,az,bx,by,bz], ...] already placed in world space. cx,cy,cz: the blast centre. */
    shatter(segs, cx, cy, cz, col, power = 1, gravity = 18, life = 1.6) {
        for (const [ax, ay, az, bx, by, bz] of segs) {
            if (this.frags.length >= MAX_FRAG) break;
            const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
            let dx = mx - cx, dy = my - cy + 0.6, dz = mz - cz;
            const L = Math.hypot(dx, dy, dz) || 1;
            const sp = (4 + Math.random() * 10) * power;
            this.frags.push({
                x: mx, y: my, z: mz,
                vx: dx / L * sp + (Math.random() - 0.5) * 3, vy: dy / L * sp + (3 + Math.random() * 6) * power, vz: dz / L * sp + (Math.random() - 0.5) * 3,
                hx: (bx - ax) / 2, hy: (by - ay) / 2, hz: (bz - az) / 2,
                spin: (Math.random() - 0.5) * 9, a: 0, col, life: life * (0.6 + Math.random() * 0.7), t: 0, g: gravity,
            });
        }
    }

    sparks3(x, y, z, col, n = 16, speed = 10, life = 0.7, g = 6) {
        for (let i = 0; i < n && this.sparks.length < MAX_SPARK; i++) {
            const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
            const sp = speed * (0.3 + Math.random() * 0.8);
            this.sparks.push({ x, y, z, vx: Math.cos(a) * s * sp, vy: u * sp, vz: Math.sin(a) * s * sp, col, life: life * (0.5 + Math.random() * 0.7), t: 0, g });
        }
    }

    ring(x, y, z, col, r1 = 6, life = 0.6, vertical = false) {
        this.rings.push({ x, y, z, col, r1, life, t: 0, vertical });
    }

    step(dt, drift = 0) {
        for (let i = this.frags.length - 1; i >= 0; i--) {
            const f = this.frags[i];
            f.t += dt;
            if (f.t >= f.life) { this.frags.splice(i, 1); continue; }
            f.vy -= f.g * dt;
            f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt + drift * dt;
            if (f.y < 0 && f.g > 0) { f.y = 0; f.vy *= -0.35; f.vx *= 0.6; f.vz *= 0.6; f.spin *= 0.5; }
            f.a += f.spin * dt;
        }
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const s = this.sparks[i];
            s.t += dt;
            if (s.t >= s.life) { this.sparks.splice(i, 1); continue; }
            s.vy -= s.g * dt;
            s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt + drift * dt;
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.t += dt;
            r.z += drift * dt;
            if (r.t >= r.life) this.rings.splice(i, 1);
        }
    }

    draw(b) {
        for (const f of this.frags) {
            const k = 1 - f.t / f.life;
            // tumble: spin the half-vector about the vertical axis, and shrink it a little
            const c = Math.cos(f.a), s = Math.sin(f.a), sc = 0.5 + 0.5 * k;
            const hx = (f.hx * c - f.hz * s) * sc, hz = (f.hx * s + f.hz * c) * sc, hy = f.hy * Math.cos(f.a * 0.7) * sc;
            b.pen(f.col, 0.35 + 0.75 * k, 1.1);
            b.seg3(f.x - hx, f.y - hy, f.z - hz, f.x + hx, f.y + hy, f.z + hz);
        }
        for (const p of this.sparks) {
            const k = 1 - p.t / p.life;
            b.pen(p.col, 0.3 + 0.9 * k, 1.2);
            b.seg3(p.x, p.y, p.z, p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.z - p.vz * 0.03);
        }
        for (const r of this.rings) {
            const k = r.t / r.life, rad = r.r1 * (0.2 + 0.8 * Math.sqrt(k));
            b.pen(r.col, 1.2 * (1 - k), 1.3);
            const n = 18;
            let px = 0, py = 0, pz = 0;
            for (let i = 0; i <= n; i++) {
                const a = (i / n) * Math.PI * 2;
                const x = r.x + Math.cos(a) * rad;
                const y = r.vertical ? r.y + Math.sin(a) * rad : r.y;
                const z = r.vertical ? r.z : r.z + Math.sin(a) * rad;
                if (i) b.seg3(px, py, pz, x, y, z);
                px = x; py = y; pz = z;
            }
        }
    }
}
