// Cell grids: shields (1 px cells), asteroids (2 px) and bosses (3 px). A grid is a
// rectangle of cells in world space whose bottom-left corner is (x, y); row 0 is the
// BOTTOM row. Each cell has a type code (0 = empty) and hit points.

export class Grid {
    /**
     * @param o.types  array indexed by type code: { hp, color, steel?, core?, gun?, glow?, regen? }
     */
    constructor(o) {
        this.kind = o.kind;
        this.x = o.x; this.y = o.y;
        this.cols = o.cols; this.rows = o.rows;
        this.cw = o.cw; this.ch = o.ch;
        this.types = o.types;
        const n = this.cols * this.rows;
        this.cells = new Uint8Array(n);
        this.hp = new Uint8Array(n);
        this.orig = new Uint8Array(n);   // for regeneration
        this.flash = new Float32Array(n);
        this.alive = 0;
        this.id = o.id ?? 0;
        this.vx = o.vx ?? 0;
    }

    /** Fill from ASCII rows listed TOP to bottom. `map` turns a character into a type code. */
    fill(rows, map) {
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            const gr = this.rows - 1 - r;
            for (let c = 0; c < this.cols; c++) {
                const code = map(row[c] ?? '.');
                if (code) this.set(gr * this.cols + c, code);
            }
        }
        this.orig.set(this.cells);
        return this;
    }

    set(i, code) {
        if (!this.cells[i] && code) this.alive++;
        if (this.cells[i] && !code) this.alive--;
        this.cells[i] = code;
        this.hp[i] = code ? this.types[code].hp : 0;
    }

    get w() { return this.cols * this.cw; }
    get h() { return this.rows * this.ch; }

    cellIndex(wx, wy) {
        const c = Math.floor((wx - this.x) / this.cw), r = Math.floor((wy - this.y) / this.ch);
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
        return r * this.cols + c;
    }

    cellCenter(i, out) {
        out.x = this.x + (i % this.cols + 0.5) * this.cw;
        out.y = this.y + (Math.floor(i / this.cols) + 0.5) * this.ch;
        return out;
    }

    /** First solid cell overlapping the box, preferring the one nearest (px, py). -1 if none. */
    hitBox(x0, y0, x1, y1, px, py) {
        if (x1 <= this.x || y1 <= this.y || x0 >= this.x + this.w || y0 >= this.y + this.h) return -1;
        const c0 = Math.max(0, Math.floor((x0 - this.x) / this.cw)), c1 = Math.min(this.cols - 1, Math.floor((x1 - 1e-6 - this.x) / this.cw));
        const r0 = Math.max(0, Math.floor((y0 - this.y) / this.ch)), r1 = Math.min(this.rows - 1, Math.floor((y1 - 1e-6 - this.y) / this.ch));
        let best = -1, bd = Infinity;
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const i = r * this.cols + c;
                if (!this.cells[i]) continue;
                const dx = this.x + (c + 0.5) * this.cw - px, dy = this.y + (r + 0.5) * this.ch - py;
                const d = dx * dx + dy * dy;
                if (d < bd) { bd = d; best = i; }
            }
        }
        return best;
    }

    /**
     * Damage one cell. Returns 'destroyed', 'damaged', 'blocked' (steel) or null.
     * `force` lets fireballs and Nova bombs break steel.
     */
    damage(i, dmg, force = false) {
        const code = this.cells[i];
        if (!code) return null;
        const t = this.types[code];
        if (t.steel && !force) { this.flash[i] = 1; return 'blocked'; }
        if (this.hp[i] > dmg) { this.hp[i] -= dmg; this.flash[i] = 1; return 'damaged'; }
        this.set(i, 0);
        return 'destroyed';
    }

    /** Indices of solid cells within a radius, for craters. Jagged edge via rng. */
    cellsInRadius(cx, cy, rad, rng, jag = 0.35) {
        const out = [];
        const c0 = Math.max(0, Math.floor((cx - rad - this.x) / this.cw)), c1 = Math.min(this.cols - 1, Math.floor((cx + rad - this.x) / this.cw));
        const r0 = Math.max(0, Math.floor((cy - rad - this.y) / this.ch)), r1 = Math.min(this.rows - 1, Math.floor((cy + rad - this.y) / this.ch));
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const i = r * this.cols + c;
                if (!this.cells[i]) continue;
                const dx = this.x + (c + 0.5) * this.cw - cx, dy = this.y + (r + 0.5) * this.ch - cy;
                const lim = rad * (1 - jag + rng() * jag * 2);
                if (dx * dx + dy * dy <= lim * lim) out.push(i);
            }
        }
        return out;
    }

    countType(pred) {
        let n = 0;
        for (let i = 0; i < this.cells.length; i++) if (this.cells[i] && pred(this.types[this.cells[i]], this.cells[i])) n++;
        return n;
    }
}
