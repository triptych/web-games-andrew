// The Atelier's cast drawn in code (Quillon the quill, Mott the moth, the Blot,
// the First Talewright's note), the mentor panel and the story scene player.
import { h, clear } from '../editor/ui.js';
import { meta } from './progress.js';
import { SCENES, NAMES } from './story.js';

// ── portraits ───────────────────────────────────────────────────────────────
export function drawQuillon(g, S, t, look) {
    look = look || {};
    g.save();
    g.scale(S / 100, S / 100);
    const bob = Math.sin(t * 1.6) * 1.5;
    g.translate(0, bob);
    // ink drop shadow
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(36, 95, 16, 3, 0, 0, 7); g.fill();
    // shaft and nib
    g.strokeStyle = '#d8c8a0'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(30, 90); g.quadraticCurveTo(50, 60, 74, 12); g.stroke();
    g.fillStyle = '#2a2240'; g.beginPath(); g.moveTo(25, 97); g.lineTo(33, 84); g.lineTo(36, 88); g.closePath(); g.fill();
    g.fillStyle = '#5a4aff'; g.beginPath(); g.arc(24, 98, 2.4, 0, 7); g.fill();
    // the vane
    const vane = g.createLinearGradient(30, 80, 80, 10);
    vane.addColorStop(0, '#f6efe0'); vane.addColorStop(1, '#ffffff');
    g.fillStyle = vane;
    g.beginPath();
    g.moveTo(36, 78);
    g.bezierCurveTo(10, 60, 30, 18, 76, 6);
    g.bezierCurveTo(86, 22, 78, 64, 36, 78);
    g.fill();
    g.strokeStyle = 'rgba(120,100,180,0.35)'; g.lineWidth = 0.8;
    for (let i = 0; i < 9; i++) { const k = i / 9; const x = 40 + k * 32, y = 72 - k * 60; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 14 + k * 6, y - 6); g.moveTo(x, y); g.lineTo(x + 12 - k * 4, y + 2); g.stroke(); }
    g.strokeStyle = '#c8b8f0'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(36, 78); g.quadraticCurveTo(52, 50, 74, 10); g.stroke();
    // face
    const blink = (Math.sin(t * 0.9) > 0.985) ? 0.15 : 1;
    for (const [x, y] of [[44, 42], [58, 36]]) {
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, 5, 6 * blink, -0.4, 0, 7); g.fill();
        g.strokeStyle = '#3a2a60'; g.lineWidth = 1; g.stroke();
        if (blink > 0.5) { g.fillStyle = '#2a1a4a'; g.beginPath(); g.arc(x + 1, y + 1, 2.4, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 1.8, y, 0.8, 0, 7); g.fill(); }
    }
    g.strokeStyle = '#3a2a60'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(39, 33); g.lineTo(47, 32); g.moveTo(54, 27); g.lineTo(62, 26); g.stroke();
    g.beginPath(); g.arc(52, 50, 5, 0.3, 2.4); g.stroke();
    if (look.monocle) { g.strokeStyle = '#e0b040'; g.lineWidth = 1.6; g.beginPath(); g.arc(58, 36, 7, 0, 7); g.stroke(); g.beginPath(); g.moveTo(64, 40); g.quadraticCurveTo(70, 52, 66, 62); g.stroke(); }
    if (look.scarf) { g.fillStyle = '#c83a5a'; g.beginPath(); g.ellipse(36, 76, 10, 4, -0.6, 0, 7); g.fill(); g.fillRect(26, 76, 5, 12); g.fillStyle = '#fff'; g.fillRect(26, 80, 5, 2); g.fillRect(26, 85, 5, 2); }
    if (look.tophat) { g.save(); g.translate(72, 8); g.rotate(0.45); g.fillStyle = '#1a1424'; g.fillRect(-10, -2, 20, 4); g.fillRect(-7, -18, 14, 17); g.fillStyle = '#8a3ac8'; g.fillRect(-7, -6, 14, 3); g.restore(); }
    g.restore();
}

export function drawMott(g, S, t) {
    g.save();
    g.scale(S / 100, S / 100);
    const flap = Math.sin(t * 9) * 0.25;
    const y0 = 52 + Math.sin(t * 2.2) * 3;
    g.translate(50, y0);
    for (const s of [-1, 1]) {
        g.save(); g.scale(s, 1); g.rotate(-0.3 + flap);
        const w = g.createRadialGradient(22, -10, 2, 22, -10, 30);
        w.addColorStop(0, '#fff6c8'); w.addColorStop(1, '#e8c070');
        g.fillStyle = w; g.beginPath(); g.ellipse(22, -12, 24, 18, -0.4, 0, 7); g.fill();
        g.fillStyle = '#f0d890'; g.beginPath(); g.ellipse(16, 12, 14, 11, 0.4, 0, 7); g.fill();
        g.fillStyle = '#8a5ad0'; g.beginPath(); g.arc(26, -14, 6, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(27, -15, 2, 0, 7); g.fill();
        g.restore();
    }
    g.fillStyle = '#a07a50'; g.beginPath(); g.ellipse(0, 4, 10, 20, 0, 0, 7); g.fill();
    g.fillStyle = '#c8a070'; for (let i = 0; i < 4; i++) { g.fillRect(-9, -4 + i * 7, 18, 2); }
    g.fillStyle = '#e8d0a8'; g.beginPath(); g.arc(0, -14, 11, 0, 7); g.fill();
    g.strokeStyle = '#7a5a3a'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-4, -23); g.quadraticCurveTo(-12, -38, -20, -36); g.moveTo(4, -23); g.quadraticCurveTo(12, -38, 20, -36); g.stroke();
    for (const s of [-1, 1]) { g.fillStyle = '#1a1424'; g.beginPath(); g.ellipse(s * 4.5, -15, 3.4, 4.2, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 4.5 + 1, -16.5, 1.2, 0, 7); g.fill(); }
    g.strokeStyle = '#7a3a3a'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, -10, 3, 0.2, 2.9); g.stroke();
    g.fillStyle = 'rgba(255,120,140,0.5)'; g.beginPath(); g.arc(-8, -10, 2, 0, 7); g.arc(8, -10, 2, 0, 7); g.fill();
    g.restore();
}

export function drawBlot(g, S, t) {
    g.save();
    g.scale(S / 100, S / 100);
    g.fillStyle = '#7a7884';
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const r = 30 + Math.sin(a * 3 + t * 0.8) * 4 + Math.sin(a * 7 - t * 0.5) * 2.5;
        const x = 50 + Math.cos(a) * r, y = 50 + Math.sin(a) * r * 0.9;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.fill();
    g.fillStyle = 'rgba(122,120,132,0.6)';
    for (let i = 0; i < 5; i++) { const a = i * 1.3 + t * 0.2; g.beginPath(); g.arc(50 + Math.cos(a) * 40, 50 + Math.sin(a) * 34, 4 + (i % 3) * 2, 0, 7); g.fill(); }
    g.fillRect(44, 76, 5, 10 + Math.sin(t) * 3); g.beginPath(); g.arc(46.5, 87 + Math.sin(t) * 3, 3, 0, 7); g.fill();
    g.fillStyle = '#d8d6e0';
    for (const x of [40, 60]) { g.beginPath(); g.ellipse(x, 48, 6, 2.2, 0, 0, 7); g.fill(); }
    g.restore();
}

export function drawNote(g, S) {
    g.save();
    g.scale(S / 100, S / 100);
    g.translate(50, 50); g.rotate(-0.08);
    g.fillStyle = '#f2e2b8'; g.fillRect(-30, -38, 60, 76);
    g.strokeStyle = 'rgba(90,60,30,0.6)'; g.lineWidth = 1;
    for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(-22, -26 + i * 8); g.bezierCurveTo(-8, -28 + i * 8, 6, -24 + i * 8, 22 - (i % 3) * 6, -26 + i * 8); g.stroke(); }
    g.fillStyle = 'rgba(120,80,40,0.25)'; g.beginPath(); g.arc(18, 26, 7, 0, 7); g.fill();
    g.restore();
}

export function quillLook() { return { tophat: meta.data.owned['quill.tophat'], monocle: meta.data.owned['quill.monocle'], scarf: meta.data.owned['quill.scarf'] }; }
export function drawSpeaker(g, who, S, t) {
    g.clearRect(0, 0, S, S);
    if (who === 'Q') drawQuillon(g, S, t, quillLook());
    else if (who === 'M') drawMott(g, S, t);
    else if (who === 'B') drawBlot(g, S, t);
    else if (who === 'F') drawNote(g, S);
}

/** A canvas that animates a speaker. Returns { el, set(who) }. */
export function portrait(size, who) {
    const c = h('canvas.portrait');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr; c.height = size * dpr; c.style.width = size + 'px'; c.style.height = size + 'px';
    const g = c.getContext('2d');
    let cur = who, t0 = performance.now();
    const loop = () => {
        if (!c.isConnected && performance.now() - t0 > 1000) return;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const t = meta.data.settings.reduceMotion ? 0 : (performance.now() - t0) / 1000;
        drawSpeaker(g, cur, size, t);
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return { el: c, set: (w) => { cur = w; } };
}

// ── the story scene player ──────────────────────────────────────────────────
export function playScene(id, done) {
    const sc = SCENES[id];
    if (!sc) { if (done) done(); return; }
    let i = 0;
    const pt = portrait(150, sc.lines[0][0]);
    const name = h('div.scname');
    const text = h('div.sctext', { 'aria-live': 'polite' });
    const nextBtn = h('button.primary.scnext', { text: 'Next ▸' });
    const skip = h('button.scskip', { text: 'Skip scene' });
    const bg = h('canvas.scbg');
    const box = h('div.scene', { role: 'dialog', 'aria-label': sc.title },
        bg,
        h('div.sctitle', { text: sc.title }),
        h('div.scstage', h('div.scportrait', pt.el), h('div.scbox', name, text, h('div.scbtns', skip, nextBtn))));
    document.body.appendChild(box);
    drawWorkshop(bg);
    let typing = null, full = '';
    const show = () => {
        const [who, line] = sc.lines[i];
        pt.set(who);
        box.dataset.who = who;
        name.textContent = NAMES[who] || '';
        full = line;
        text.textContent = '';
        clearInterval(typing);
        if (meta.data.settings.reduceMotion) { text.textContent = full; return; }
        let k = 0;
        typing = setInterval(() => { k += 2; text.textContent = full.slice(0, k); if (k >= full.length) { clearInterval(typing); typing = null; } }, 18);
        nextBtn.textContent = i === sc.lines.length - 1 ? 'Close ▸' : 'Next ▸';
    };
    const next = () => {
        if (typing) { clearInterval(typing); typing = null; text.textContent = full; return; }
        i++;
        if (i >= sc.lines.length) finish(); else show();
    };
    const finish = () => {
        clearInterval(typing);
        document.removeEventListener('keydown', key, true);
        box.remove();
        if (!meta.data.seen.includes(id)) { meta.data.seen.push(id); meta.save(); }
        if (done) done();
    };
    const key = (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); next(); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
    };
    document.addEventListener('keydown', key, true);
    nextBtn.addEventListener('click', next);
    skip.addEventListener('click', finish);
    box.addEventListener('click', (e) => { if (e.target === box || e.target === bg) next(); });
    show();
    setTimeout(() => nextBtn.focus(), 50);
}

/** The workshop behind the story scenes, with the Blot as wide as the chapter says. */
function drawWorkshop(c) {
    c.width = 640; c.height = 360;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 360);
    sky.addColorStop(0, '#1a1236'); sky.addColorStop(1, '#3a2450');
    g.fillStyle = sky; g.fillRect(0, 0, 640, 360);
    // window with stars
    g.fillStyle = '#0a0820'; g.fillRect(380, 40, 180, 140);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,' + Math.random() + ')'; g.fillRect(380 + Math.random() * 180, 40 + Math.random() * 140, 1.5, 1.5); }
    g.fillStyle = '#fff4c8'; g.beginPath(); g.arc(520, 80, 16, 0, 7); g.fill();
    g.strokeStyle = '#5a3a2a'; g.lineWidth = 8; g.strokeRect(380, 40, 180, 140); g.beginPath(); g.moveTo(470, 40); g.lineTo(470, 180); g.moveTo(380, 110); g.lineTo(560, 110); g.stroke();
    // shelves
    g.fillStyle = '#4a2e20'; for (const y of [70, 140]) g.fillRect(40, y, 260, 8);
    const cols = ['#c84a4a', '#4a6ac8', '#4aa060', '#d0a030', '#8a4ac8', '#e8783a'];
    for (let s = 0; s < 2; s++) for (let i = 0; i < 18; i++) { g.fillStyle = cols[(i + s * 3) % 6]; const hh = 30 + ((i * 7) % 14); g.fillRect(48 + i * 14, (s ? 140 : 70) - hh, 11, hh); }
    // desk and the Worldbook
    g.fillStyle = '#5a3a26'; g.fillRect(0, 260, 640, 100);
    g.fillStyle = '#3a2418'; g.fillRect(0, 256, 640, 8);
    g.fillStyle = '#f2e6c8'; g.beginPath(); g.moveTo(230, 250); g.quadraticCurveTo(320, 230, 320, 252); g.quadraticCurveTo(320, 230, 410, 250); g.lineTo(410, 270); g.quadraticCurveTo(320, 252, 230, 270); g.fill();
    g.strokeStyle = 'rgba(80,50,30,0.5)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(245, 250 + i * 3); g.lineTo(305, 246 + i * 3); g.moveTo(335, 246 + i * 3); g.lineTo(395, 250 + i * 3); g.stroke(); }
    // lamp glow
    const lg = g.createRadialGradient(560, 230, 4, 560, 230, 160);
    lg.addColorStop(0, 'rgba(255,220,140,0.55)'); lg.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = lg; g.fillRect(380, 60, 260, 300);
    g.fillStyle = '#c8a040'; g.fillRect(552, 236, 16, 22); g.fillStyle = '#ffe8a0'; g.beginPath(); g.arc(560, 228, 10, 0, 7); g.fill();
    // the Blot, as big as it still is
    const k = Math.max(0, 1 - meta.data.chapter / 9);
    if (k > 0) {
        const bl = g.createRadialGradient(320, 180, 120 + (1 - k) * 260, 320, 180, 420);
        bl.addColorStop(0, 'rgba(110,108,122,0)'); bl.addColorStop(1, 'rgba(110,108,122,' + (0.85 * k + 0.1) + ')');
        g.fillStyle = bl; g.fillRect(0, 0, 640, 360);
    }
}

// ── the mentor panel ────────────────────────────────────────────────────────
export class MentorPanel {
    constructor(el) {
        this.el = el;
        this.pt = portrait(72, 'Q');
        this.say = h('div.mentorsay', { 'aria-live': 'polite' });
        this.who = h('div.mentorwho', { text: 'Quillon' });
        this.queue = [];
        el.appendChild(h('div.mentor', h('div.mentorpic', this.pt.el), h('div.mentorbubble', this.who, this.say)));
        this.pt.el.addEventListener('click', () => this.onPortrait && this.onPortrait());
    }
    speak(who, text) {
        this.pt.set(who);
        this.who.textContent = NAMES[who] || '';
        this.el.querySelector('.mentor').dataset.who = who;
        clearInterval(this.typing);
        if (meta.data.settings.reduceMotion) { this.say.textContent = text; return; }
        let k = 0;
        this.say.textContent = '';
        this.typing = setInterval(() => { k += 2; this.say.textContent = text.slice(0, k); if (k >= text.length) clearInterval(this.typing); }, 16);
    }
}
export { clear };
