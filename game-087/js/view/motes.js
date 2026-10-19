// Embers drifting up behind the guild: a fixed Canvas 2D layer, cheap, paused while hidden or when the
// apprentice prefers reduced motion (or turns it off in Settings).

export function startMotes(canvas) {
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let on = !reduce, raf = 0, last = performance.now(), w = 0, h = 0, dpr = 1;
    const motes = Array.from({ length: 38 }, (_, i) => ({ x: (i * 0.618) % 1, y: (i * 0.377) % 1, r: 0.6 + ((i * 7) % 5) * 0.35, s: 0.006 + ((i * 13) % 7) * 0.002, ph: i, hue: i % 3 }));
    const size = () => {
        const vv = window.visualViewport;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
    };
    const frame = (now) => {
        raf = 0;
        if (!on || document.hidden) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        for (const m of motes) {
            m.y -= m.s * dt;
            m.x += Math.sin(now / 1800 + m.ph) * 0.00012;
            if (m.y < -0.05) { m.y = 1.05; m.x = (m.x + 0.37) % 1; }
            const a = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(now / 700 + m.ph * 2));
            ctx.fillStyle = m.hue === 0 ? `rgba(255,196,110,${a})` : m.hue === 1 ? `rgba(255,232,170,${a * 0.8})` : `rgba(180,220,200,${a * 0.6})`;
            ctx.beginPath();
            ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
            ctx.fill();
        }
        raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (on && !raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    size();
    window.addEventListener('resize', size);
    window.visualViewport?.addEventListener('resize', size);
    document.addEventListener('visibilitychange', kick);
    kick();
    return {
        enable(v) { on = v && !reduce; canvas.hidden = !on; if (!on) ctx.clearRect(0, 0, canvas.width, canvas.height); kick(); },
    };
}
