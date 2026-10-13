// The arcade behind the cabinet, on its own full-window canvas: a back wall
// with neon signs, two rows of other machines glowing in the dark, tube
// lights in the ceiling, a blacklight carpet in perspective, and haze. The
// still parts are drawn once per resize; each frame adds the flicker, the
// other machines' screens and the light spilling from ours.

const R = Math.random;

export class Arcade {
    constructor(canvas) {
        this.c = canvas;
        this.g = canvas.getContext('2d');
        this.base = document.createElement('canvas');
        this.t = 0;
        this.spill = [255, 60, 200];
        this.screenRect = null;
        this.flick = {};
        this.cabs = [];
        this.lowPower = false;
        this.acc = 0;
    }

    resize(w, h, dpr) {
        // the room is background: half resolution reads as depth of field and costs a quarter
        const s = this.lowPower ? 0.4 : 0.6;
        this.w = w; this.h = h; this.s = s;
        this.c.width = Math.round(w * s); this.c.height = Math.round(h * s);
        this.base.width = this.c.width; this.base.height = this.c.height;
        this.drawBase();
    }

    drawBase() {
        const g = this.base.getContext('2d');
        const { w, h, s } = this;
        g.setTransform(s, 0, 0, s, 0, 0);
        const hz = h * 0.6;           // where the wall meets the floor
        this.hz = hz;
        // wall
        const wall = g.createLinearGradient(0, 0, 0, hz);
        wall.addColorStop(0, '#040108'); wall.addColorStop(0.5, '#0c0418'); wall.addColorStop(1, '#14061e');
        g.fillStyle = wall; g.fillRect(0, 0, w, hz);
        g.strokeStyle = 'rgba(255,255,255,0.025)'; g.lineWidth = 1;
        for (let y = 0; y < hz; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 14) % 2 ? 0 : 20; x < w; x += 40) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 14); g.stroke(); } }
        // ceiling
        const ceil = g.createLinearGradient(0, 0, 0, h * 0.14);
        ceil.addColorStop(0, '#000'); ceil.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = ceil; g.fillRect(0, 0, w, h * 0.14);
        // floor: carpet
        const fl = g.createLinearGradient(0, hz, 0, h);
        fl.addColorStop(0, '#0a0412'); fl.addColorStop(1, '#120620');
        g.fillStyle = fl; g.fillRect(0, hz, w, h - hz);
        // blacklight confetti in perspective
        const cols = ['#ff2ece', '#29e6ff', '#fff27a', '#3aff7a', '#a46aff'];
        let seed = 7;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (let i = 0; i < 420; i++) {
            const z = 1 + rnd() * 9, x = (rnd() * 2 - 1) * 6;
            const py = hz + (h - hz) * (1 / z) * 1.02, px = w / 2 + x / z * w * 0.5;
            if (py > h || px < -20 || px > w + 20) continue;
            const sz = 7 / z;
            g.globalAlpha = 0.18 + 0.4 / z;
            g.strokeStyle = g.fillStyle = cols[i % cols.length];
            g.lineWidth = Math.max(0.6, 1.4 / z);
            const k = i % 4;
            g.beginPath();
            if (k === 0) { g.moveTo(px - sz, py); g.quadraticCurveTo(px, py - sz * 0.6, px + sz, py); g.stroke(); }
            else if (k === 1) { g.arc(px, py, sz * 0.4, 0, Math.PI * 2); g.stroke(); }
            else if (k === 2) { g.moveTo(px, py - sz * 0.35); g.lineTo(px + sz * 0.5, py + sz * 0.25); g.lineTo(px - sz * 0.5, py + sz * 0.25); g.closePath(); g.stroke(); }
            else { g.fillRect(px, py, sz * 0.3, sz * 0.3); }
        }
        g.globalAlpha = 1;
        // the other machines: two rows receding to the back wall
        this.cabs = [];
        const cabCols = ['#ff2ece', '#29e6ff', '#ffb03a', '#3aff7a', '#a46aff', '#ff5a5a', '#5af0ff', '#fff27a'];
        for (const side of [-1, 1]) {
            for (let k = 5; k >= 0; k--) {
                const z = 1.3 + k * 0.75;
                const cw = w * 0.13 / z * 1.6, ch = h * 0.62 / z * 1.4;
                const cx = w / 2 + side * (w * 0.33 + w * 0.17 / z * 1.0) / (z * 0.65);
                const by = hz + (h - hz) * (0.9 / z);
                if (cx < -cw || cx > w + cw) continue;
                const x = cx - cw / 2, y = by - ch;
                const color = cabCols[(k * 3 + (side > 0 ? 1 : 0)) % cabCols.length];
                // body
                const bg = g.createLinearGradient(x, 0, x + cw, 0);
                bg.addColorStop(0, '#07040c'); bg.addColorStop(side < 0 ? 0.8 : 0.2, '#160a22'); bg.addColorStop(1, '#07040c');
                g.fillStyle = bg;
                g.beginPath();
                g.moveTo(x, by); g.lineTo(x, y + ch * 0.18); g.lineTo(x + cw * 0.08, y); g.lineTo(x + cw * 0.92, y); g.lineTo(x + cw, y + ch * 0.18); g.lineTo(x + cw, by); g.closePath(); g.fill();
                g.strokeStyle = color; g.globalAlpha = 0.5 / z + 0.15; g.lineWidth = 1.2 / z + 0.4;
                g.stroke(); g.globalAlpha = 1;
                // marquee
                const my = y + ch * 0.03, mh = ch * 0.1;
                g.fillStyle = color; g.globalAlpha = 0.55; g.fillRect(x + cw * 0.12, my, cw * 0.76, mh); g.globalAlpha = 1;
                // panel
                g.fillStyle = '#100818'; g.fillRect(x - cw * 0.04, y + ch * 0.6, cw * 1.08, ch * 0.08);
                const scr = { x: x + cw * 0.16, y: y + ch * 0.2, w: cw * 0.68, h: ch * 0.32, color, z, phase: R() * 10, kind: Math.floor(R() * 4), mx: x + cw * 0.12, my, mw: cw * 0.76, mh };
                g.fillStyle = '#020104'; g.fillRect(scr.x - 2, scr.y - 2, scr.w + 4, scr.h + 4);
                this.cabs.push(scr);
            }
        }
        // a glow under where our cabinet stands
        const pool = g.createRadialGradient(w / 2, h * 0.95, 10, w / 2, h * 0.95, w * 0.45);
        pool.addColorStop(0, 'rgba(255,46,206,0.16)'); pool.addColorStop(1, 'rgba(255,46,206,0)');
        g.fillStyle = pool; g.fillRect(0, hz, w, h - hz);
    }

    draw(dt, spill) {
        this.t += dt;
        this.acc += dt;
        if (this.acc < (this.lowPower ? 0.2 : 0.1)) return;
        this.acc = 0;
        if (spill) this.spill = spill;
        const g = this.g, { w, h, s } = this;
        if (!w) return;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(this.base, 0, 0);
        g.setTransform(s, 0, 0, s, 0, 0);
        const t = this.t;
        // tube lights in the ceiling
        for (let i = 0; i < 7; i++) {
            const x = w * (0.08 + i * 0.14), y = h * 0.04 + Math.abs(i - 3) * h * 0.008;
            const on = !(i === 5 && Math.sin(t * 23) > 0.6 && Math.sin(t * 3.1) > 0.3);
            g.globalAlpha = on ? 0.85 : 0.2;
            g.fillStyle = '#e8f0ff'; g.fillRect(x - w * 0.04, y, w * 0.08, 2);
            if (on) { const gl = g.createRadialGradient(x, y, 1, x, y, w * 0.08); gl.addColorStop(0, 'rgba(200,220,255,0.25)'); gl.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = gl; g.fillRect(x - w * 0.08, y - 10, w * 0.16, w * 0.08); }
        }
        g.globalAlpha = 1;
        // neon signs on the back wall
        const side = Math.max(60, (w - (this.cabW || w * 0.6)) / 4);
        this.neon('Arcade', side, h * 0.13, Math.min(side * 0.7, 64), '#ff2ece', 'Yellowtail, "Brush Script MT", cursive', 'a');
        this.neon('OPEN 24 HRS', side, h * 0.23, Math.min(side * 0.16, 16), '#ff4040', '"Press Start 2P", monospace', 'o');
        this.neon('HIGH SCORE', w - side, h * 0.15, Math.min(side * 0.16, 16), '#fff27a', '"Press Start 2P", monospace', 'h');
        this.palm(w * 0.88, h * 0.42, Math.min(h * 0.18, w * 0.12));
        this.palm(w * 0.1, h * 0.44, Math.min(h * 0.14, w * 0.1), true);
        // the other machines' screens
        for (const c of this.cabs) {
            const k = Math.floor((t + c.phase) * 6);
            g.save();
            g.beginPath(); g.rect(c.x, c.y, c.w, c.h); g.clip();
            g.fillStyle = '#06020c'; g.fillRect(c.x, c.y, c.w, c.h);
            g.globalAlpha = 0.85 / Math.sqrt(c.z);
            if (c.kind === 0) {
                for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? c.color : '#ffffff'; g.fillRect(c.x + ((i * 37 + k * 3) % 100) / 100 * c.w, c.y + ((i * 53 + k) % 100) / 100 * c.h, c.w * 0.06, c.h * 0.06); }
            } else if (c.kind === 1) {
                for (let i = 0; i < 5; i++) { g.fillStyle = c.color; g.fillRect(c.x, c.y + c.h * (i / 5), c.w * (0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i + c.phase))), c.h / 7); }
            } else if (c.kind === 2) {
                g.fillStyle = c.color; g.fillRect(c.x + c.w * 0.1, c.y + c.h * 0.3, c.w * 0.8, c.h * 0.25);
                if (k % 2) { g.fillStyle = '#fff'; g.fillRect(c.x + c.w * 0.3, c.y + c.h * 0.7, c.w * 0.4, c.h * 0.08); }
            } else {
                for (let i = 0; i < 14; i++) { g.fillStyle = i % 3 ? '#ffffff' : c.color; const sx = (i * 71 + t * 30 * (1 + i % 3)) % 100 / 100; g.fillRect(c.x + sx * c.w, c.y + ((i * 29) % 100) / 100 * c.h, 1.2, 1.2); }
            }
            g.restore();
            // screen glow and marquee flicker
            g.save(); g.globalCompositeOperation = 'lighter';
            const gl = g.createRadialGradient(c.x + c.w / 2, c.y + c.h / 2, 1, c.x + c.w / 2, c.y + c.h / 2, c.w);
            gl.addColorStop(0, c.color + '30'); gl.addColorStop(1, c.color + '00');
            g.fillStyle = gl; g.fillRect(c.x - c.w / 2, c.y - c.h, c.w * 2, c.h * 3);
            g.globalAlpha = 0.25 + 0.1 * Math.sin(t * 3 + c.phase); g.fillStyle = c.color; g.fillRect(c.mx, c.my, c.mw, c.mh);
            g.restore();
        }
        // our own screen lights the room
        const [r, gg, b] = this.spill;
        g.save(); g.globalCompositeOperation = 'lighter';
        const sp = g.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.45, Math.max(w, h) * 0.55);
        sp.addColorStop(0, `rgba(${r},${gg},${b},0.16)`); sp.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        g.fillStyle = sp; g.fillRect(0, 0, w, h);
        // haze
        const hzg = g.createLinearGradient(0, h * 0.35, 0, h * 0.75);
        hzg.addColorStop(0, 'rgba(120,40,160,0)'); hzg.addColorStop(0.5, 'rgba(120,40,160,0.07)'); hzg.addColorStop(1, 'rgba(120,40,160,0)');
        g.fillStyle = hzg; g.fillRect(0, 0, w, h);
        g.restore();
    }

    neon(text, x, y, size, color, font, key) {
        const g = this.g;
        // now and then a sign stutters
        const f = this.flick[key] || (this.flick[key] = { t: 0, off: false });
        f.t -= 0.05;
        if (f.t <= 0) { f.off = R() < 0.08; f.t = f.off ? 0.05 + R() * 0.15 : 1 + R() * 4; }
        g.save();
        g.font = `${size}px ${font}`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.globalAlpha = f.off ? 0.18 : 1;
        g.shadowColor = color; g.shadowBlur = size * 0.6;
        g.strokeStyle = color; g.lineWidth = Math.max(1, size * 0.06);
        g.strokeText(text, x, y);
        g.shadowBlur = size * 0.2;
        g.fillStyle = f.off ? '#301020' : '#fff4fc';
        g.globalAlpha = f.off ? 0.2 : 0.85;
        g.fillText(text, x, y);
        g.restore();
    }

    palm(x, y, s, flip) {
        const g = this.g;
        g.save();
        g.translate(x, y); if (flip) g.scale(-1, 1);
        g.lineCap = 'round';
        g.shadowBlur = 12; g.shadowColor = '#3affb0'; g.strokeStyle = '#3affb0'; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.12, -s * 0.5, -s * 0.05, -s); g.stroke();
        g.shadowColor = '#29e6ff'; g.strokeStyle = '#29e6ff';
        for (const a of [-2.7, -2.1, -1.5, -0.9, -0.3]) {
            g.beginPath(); g.moveTo(-s * 0.05, -s);
            g.quadraticCurveTo(-s * 0.05 + Math.cos(a) * s * 0.35, -s - s * 0.25 + Math.sin(a) * s * 0.1, -s * 0.05 + Math.cos(a) * s * 0.55, -s + Math.sin(a) * s * 0.2 + s * 0.18);
            g.stroke();
        }
        g.restore();
    }
}
