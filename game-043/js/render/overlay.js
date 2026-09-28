// A device-resolution canvas over the pixel canvas, for crisp text.
export class Overlay {
    constructor(canvas) { this.cv = canvas; this.g = canvas.getContext('2d'); this.k = 1; this.dpr = 1; }
    resize(devW, devH, cssW, cssH, k, dpr) {
        this.cv.width = devW; this.cv.height = devH;
        this.cv.style.width = cssW + 'px'; this.cv.style.height = cssH + 'px';
        this.k = k; this.dpr = dpr;
    }
    clear() { this.g.clearRect(0, 0, this.cv.width, this.cv.height); }
    /** x, y in game pixels; size in CSS pixels. */
    text(x, y, str, { size = 11, color = '#fff', align = 'center', stroke = '#2d2418', bold = true, alpha = 1, base = 'alphabetic' } = {}) {
        const g = this.g;
        g.globalAlpha = alpha;
        g.font = `${bold ? 'bold ' : ''}${Math.round(size * this.dpr)}px "Trebuchet MS", system-ui, sans-serif`;
        g.textAlign = align; g.textBaseline = base;
        const X = Math.round(x * this.k), Y = Math.round(y * this.k);
        if (stroke) { g.lineWidth = Math.max(2, 3 * this.dpr); g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(str, X, Y); }
        g.fillStyle = color; g.fillText(str, X, Y);
        g.globalAlpha = 1;
    }
}
