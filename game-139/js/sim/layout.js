// Rival layouts: one or more pyramids. Every card is covered by the two cards just below it, and
// is open ("exposed") once both of those are gone. Pure; positions are in card-widths for the view.

export function buildLayout({ peaks = 1, rows = 5 }) {
    const slots = [];
    const at = new Map();
    for (let p = 0; p < peaks; p++) {
        const px = (p - (peaks - 1) / 2) * rows;
        for (let r = 0; r < rows; r++) {
            for (let i = 0; i <= r; i++) {
                const id = slots.length;
                slots.push({ id, p, r, i, x: px + (i - r / 2), y: r, coveredBy: [], covers: [], bottom: r === rows - 1 });
                at.set(`${p},${r},${i}`, id);
            }
        }
    }
    for (const s of slots) {
        for (const di of [0, 1]) {
            const c = at.get(`${s.p},${s.r + 1},${s.i + di}`);
            if (c != null) { s.coveredBy.push(c); slots[c].covers.push(s.id); }
        }
    }
    return { slots, rows, peaks, width: peaks * rows };
}
