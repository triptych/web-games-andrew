// A hand-tinted map of the island, drawn from the same height field: coast,
// paths, plazas, every statue, place names and a "you are here" arrow.

import { genreOf } from './genres.js';
import { smoothstep, clamp } from './util.js';

export class IslandMap {
    constructor(world, canvasEl) {
        this.world = world;
        this.canvas = canvasEl;
        this.base = null;
        this.places = [];
        this.onPick = null;
        canvasEl.addEventListener('click', (e) => this._click(e));
    }

    _setup() {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const size = Math.round(720 * dpr);
        this.size = size;
        this.canvas.width = this.canvas.height = size;
        const { island, layout } = this.world;
        // crop to the island (plus the islet)
        let R = 0;
        for (const sp of layout.spokes) R = Math.max(R, Math.hypot(sp.pavilion.x, sp.pavilion.z) + 22);
        R = Math.max(R, Math.hypot(layout.islet.x, layout.islet.z) + 14, layout.hubR + 20);
        this.R = R;
        const toPx = (x, z) => [((x + R) / (2 * R)) * size, ((z + R) / (2 * R)) * size];
        this.toPx = toPx;

        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        // terrain, painted at low resolution then scaled up smoothly
        const n = 260;
        const lo = document.createElement('canvas');
        lo.width = lo.height = n;
        const lctx = lo.getContext('2d');
        const img = lctx.createImageData(n, n);
        for (let j = 0; j < n; j++) {
            for (let i = 0; i < n; i++) {
                const x = -R + ((i + 0.5) / n) * 2 * R, z = -R + ((j + 0.5) / n) * 2 * R;
                const h = island.heightAt(x, z);
                let r, g, b;
                if (h < 0) {
                    const d = clamp(-h / 10, 0, 1);
                    r = 40 - d * 25; g = 110 - d * 55; b = 130 - d * 40;
                    const shallow = smoothstep(-1.5, 0, h);
                    r += shallow * 60; g += shallow * 70; b += shallow * 40;
                } else {
                    const nrm = island.normalAt(x, z);
                    const shade = 0.75 + nrm.x * 0.35 - nrm.z * 0.2;
                    const rock = smoothstep(0.75, 0.55, nrm.y);
                    const sand = smoothstep(1.6, 0.6, h);
                    r = (110 + h * 4) * (1 - rock) + 150 * rock;
                    g = (150 + h * 3) * (1 - rock) + 140 * rock;
                    b = (80 + h * 2) * (1 - rock) + 130 * rock;
                    r = r * (1 - sand) + 215 * sand;
                    g = g * (1 - sand) + 195 * sand;
                    b = b * (1 - sand) + 150 * sand;
                    r *= shade; g *= shade; b *= shade;
                }
                const k = (j * n + i) * 4;
                img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
            }
        }
        lctx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(lo, 0, 0, size, size);
        // parchment wash and vignette
        ctx.fillStyle = 'rgba(240, 220, 170, 0.18)';
        ctx.fillRect(0, 0, size, size);
        const vg = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.72);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(10,8,4,0.55)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, size, size);

        const px = size / (2 * R);
        // paths
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const lines = [...layout.spokes.map((s) => s.pts), layout.dock.pts, layout.trail.pts, layout.pier.trail.pts, layout.wharf.trail.pts];
        // the bridge out to the clock tower
        const br = layout.bridge;
        for (const [w, col] of [[3.6, 'rgba(40,30,20,0.7)'], [2.6, '#b9ad9c']]) {
            ctx.strokeStyle = col;
            ctx.lineWidth = w * px;
            ctx.beginPath();
            ctx.moveTo(...toPx(br.ax, br.az));
            ctx.lineTo(...toPx(br.bx, br.bz));
            ctx.stroke();
        }
        for (const [w, col] of [[3.8, 'rgba(60,40,20,0.55)'], [3.0, '#efe2c2']]) {
            ctx.strokeStyle = col;
            ctx.lineWidth = w * px;
            for (const pts of lines) {
                ctx.beginPath();
                pts.forEach((p, i) => (i ? ctx.lineTo(...toPx(p.x, p.z)) : ctx.moveTo(...toPx(p.x, p.z))));
                ctx.stroke();
            }
        }
        // dock
        ctx.fillStyle = '#9a7650';
        const [dx0, dz0] = toPx(-1.7, layout.dock.start), [dx1, dz1] = toPx(1.7, layout.dock.end);
        ctx.fillRect(dx0, dz0, dx1 - dx0, dz1 - dz0);
        // the fishing pier
        const pr = layout.pier;
        ctx.strokeStyle = '#9a7650';
        ctx.lineCap = 'butt';
        ctx.lineWidth = 2.6 * px;
        ctx.beginPath();
        ctx.moveTo(...toPx(pr.ax, pr.az));
        ctx.lineTo(...toPx(pr.bx, pr.bz));
        ctx.stroke();
        ctx.lineWidth = 5 * px;
        ctx.beginPath();
        ctx.moveTo(...toPx(pr.bx - pr.dx * 5, pr.bz - pr.dz * 5));
        ctx.lineTo(...toPx(pr.bx, pr.bz));
        ctx.stroke();
        // the pirate wharf, with its ship lying along it
        const wf = layout.wharf;
        ctx.lineWidth = 6.4 * px;
        ctx.beginPath();
        ctx.moveTo(...toPx(wf.ax + wf.dx * wf.rampEnd, wf.az + wf.dz * wf.rampEnd));
        ctx.lineTo(...toPx(wf.bx, wf.bz));
        ctx.stroke();
        ctx.lineWidth = 2.6 * px;
        ctx.beginPath();
        ctx.moveTo(...toPx(wf.ax, wf.az));
        ctx.lineTo(...toPx(wf.ax + wf.dx * wf.rampEnd, wf.az + wf.dz * wf.rampEnd));
        ctx.stroke();
        ctx.fillStyle = '#3a2a32';
        ctx.save();
        ctx.translate(...toPx(wf.berth.x, wf.berth.z));
        ctx.rotate(Math.atan2(wf.dz, wf.dx));
        ctx.beginPath();
        ctx.ellipse(0, 0, 12.5 * px, 3.7 * px, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.lineCap = 'round';
        // plazas
        const disc = (x, z, r, fill, stroke) => {
            ctx.beginPath();
            ctx.arc(...toPx(x, z), r * px, 0, Math.PI * 2);
            ctx.fillStyle = fill;
            ctx.fill();
            if (stroke) {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        };
        disc(0, 0, 14.5, '#efe2c2', 'rgba(60,40,20,0.6)');
        disc(0, 0, 2.2, '#8ff6ff');
        for (const sp of layout.spokes) {
            disc(sp.pavilion.x, sp.pavilion.z, 9.3, '#efe2c2', 'rgba(60,40,20,0.6)');
            disc(sp.pavilion.x, sp.pavilion.z, 3.8, sp.genre.accent, 'rgba(40,25,10,0.8)');
        }
        // statues
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const st of this.world.statues) {
            disc(st.x, st.z, 1.3, genreOf(st.game).accent, 'rgba(30,20,10,0.9)');
        }
        // labels. Each one tries its anchor first, then spots around it (nearest
        // first), and takes the first that clears every label already placed and
        // every plaza, so names never print on top of each other.
        const k = size / 720;
        const placed = [];
        const blockers = [{ x: 0, z: 0, r: 14.5 }, ...layout.spokes.map((sp) => ({ x: sp.pavilion.x, z: sp.pavilion.z, r: 9.3 }))]
            .map((b) => { const [bx, by] = toPx(b.x, b.z); return { x: bx, y: by, r: b.r * px }; });
        const hitsCircle = (r, b) => {
            const nx = clamp(b.x, r.x0, r.x1), ny = clamp(b.y, r.y0, r.y1);
            return Math.hypot(nx - b.x, ny - b.y) < b.r + 2 * k;
        };
        const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
        const place = (text, x, z, { size: fs = 15, color = '#2a1c0e', italic = false } = {}) => {
            ctx.font = `${italic ? 'italic ' : ''}600 ${fs * k}px "Cinzel", Georgia, serif`;
            const w = ctx.measureText(text).width + 6 * k, h = fs * k * 1.45;
            const [ax, ay] = toPx(x, z);
            const rect = (cx, cy) => ({ x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });
            const ok = (r) => r.x0 >= 2 && r.y0 >= 2 && r.x1 <= size - 2 && r.y1 <= size - 2
                && !placed.some((q) => overlaps(r, q)) && !blockers.some((b) => hitsCircle(r, b));
            let cx = ax, cy = ay, found = ok(rect(ax, ay));
            for (let ring = 1; !found && ring <= 12; ring++) {
                const d = ring * 5 * k;
                for (let a = 0; a < 16 && !found; a++) {
                    const ang = (a / 16) * Math.PI * 2;
                    // prefer sliding sideways/below before jumping above
                    const tx = ax + Math.cos(ang) * d * 1.6, ty = ay + Math.sin(ang) * d;
                    if (ok(rect(tx, ty))) { cx = tx; cy = ty; found = true; }
                }
            }
            placed.push(rect(cx, cy));
            ctx.lineWidth = 4 * k;
            ctx.strokeStyle = 'rgba(250, 240, 215, 0.85)';
            ctx.strokeText(text, cx, cy);
            ctx.fillStyle = color;
            ctx.fillText(text, cx, cy);
            // the picker uses wherever the label really ended up
            return { x: -R + (cx / size) * 2 * R, z: -R + (cy / size) * 2 * R };
        };
        this.places = [];
        // big names first so the small ones are the ones that give way
        for (const sp of layout.spokes) {
            const out = Math.hypot(sp.pavilion.x, sp.pavilion.z);
            const lx = sp.pavilion.x + (sp.pavilion.x / out) * 13, lz = sp.pavilion.z + (sp.pavilion.z / out) * 13;
            this.places.push({ name: sp.genre.name, ...place(`${sp.genre.emoji} ${sp.genre.short}`, lx, lz, { size: 14 }), spoke: sp });
        }
        place('The Hub', 0, -17.5, { size: 15 });
        this.places.push({ name: 'The Hub', x: 0, z: 0, stand: { x: 0, z: 8, yaw: 0 } });
        for (const lm of this.world.landmarks) {
            this.places.push({ name: lm.name, ...place(lm.name, lm.x, lm.z + 6, { size: 11, italic: true, color: '#4a3418' }), landmark: lm });
        }
        this.places.push({ name: 'The Dock', ...place('The Dock', 7, layout.dock.end - 3, { size: 12, italic: true, color: '#4a3418' }), stand: { ...layout.spawn } });
        // compass rose
        const cs = size * 0.06, cx = size - cs * 1.6, cy = cs * 1.6;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = 'rgba(40,25,10,0.8)';
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(0, -cs);
            ctx.lineTo(cs * 0.18, 0);
            ctx.lineTo(-cs * 0.18, 0);
            ctx.fill();
        }
        ctx.fillStyle = '#2a1c0e';
        ctx.font = `700 ${cs * 0.45}px Cinzel, serif`;
        ctx.fillText('N', 0, -cs * 1.3);
        ctx.restore();
        this.base = c;
    }

    draw(player, yaw) {
        if (!this.base) this._setup();
        const ctx = this.canvas.getContext('2d');
        ctx.drawImage(this.base, 0, 0);
        const [x, y] = this.toPx(player.x, player.z);
        const s = this.size / 720;
        ctx.save();
        ctx.translate(x, y);
        // camera looks along (-sin yaw, -cos yaw)
        ctx.rotate(-yaw + Math.PI);
        ctx.beginPath();
        ctx.moveTo(0, 14 * s);
        ctx.lineTo(8 * s, -8 * s);
        ctx.lineTo(0, -3 * s);
        ctx.lineTo(-8 * s, -8 * s);
        ctx.closePath();
        ctx.fillStyle = '#d0302a';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 * s;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    _click(e) {
        const rect = this.canvas.getBoundingClientRect();
        // the canvas keeps its aspect inside its box (object-fit: contain)
        const side = Math.min(rect.width, rect.height);
        const ox = rect.left + (rect.width - side) / 2, oy = rect.top + (rect.height - side) / 2;
        const u = (e.clientX - ox) / side, v = (e.clientY - oy) / side;
        const x = -this.R + u * 2 * this.R, z = -this.R + v * 2 * this.R;
        let best = null, bd = Infinity;
        for (const st of this.world.statues) {
            const d = Math.hypot(st.x - x, st.z - z);
            if (d < bd) {
                bd = d;
                best = { statue: st };
            }
        }
        const pickR = this.R * 0.035;
        if (bd > pickR) {
            best = null;
            bd = Infinity;
            for (const p of this.places) {
                const d = Math.hypot(p.x - x, p.z - z);
                if (d < bd) {
                    bd = d;
                    best = { place: p };
                }
            }
            if (bd > this.R * 0.12) best = null;
        }
        if (best) this.onPick?.(best);
    }
}
