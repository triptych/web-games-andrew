// Portraits for the dialogue box: stylised busts drawn on a 2D canvas, rim-lit by the street neon.
// Everyone is a few shapes and a palette; nobody has a photograph.

const LOOKS = {
    mama:      { skin: '#a8714f', hair: '#cfcfd8', style: 'bun', coat: '#7a3b2e', collar: '#d8b070', extra: 'apron', rim: ['#ffb13d', '#ff3d8b'] },
    dex:       { skin: '#c99a7a', hair: '#23233a', style: 'spikes', coat: '#2a6a8a', goggles: true, rim: ['#35e0ff', '#ff3d8b'] },
    takeda:    { skin: '#e2b392', hair: '#0d0d16', style: 'short', coat: '#1c2a4a', hat: 'cap', badge: true, rim: ['#4d7bff', '#ff3d8b'] },
    sol:       { skin: '#c9aa92', hair: '#e4e4e4', style: 'sides', coat: '#34343c', monocle: true, cyberArm: true, rim: ['#9d6bff', '#35e0ff'] },
    lila:      { skin: '#d4b4a6', hair: '#ff4d9a', style: 'long', coat: '#40206a', eyeGlow: '#ff9f3d', rim: ['#ff4d9a', '#35e0ff'] },
    corwith:   { skin: '#ecdccc', hair: '#c9c9c2', style: 'slick', coat: '#c8ccd4', tie: '#2a2a4a', smile: true, rim: ['#35e0ff', '#9aa4b4'] },
    barnacle:  { skin: '#a77d5d', hair: '#dcdcd4', style: 'beard', coat: '#4a5a3a', hat: 'beanie', rim: ['#ffb13d', '#35e0ff'] },
    teo:       { skin: '#b88d6d', hair: '#6a5a4a', style: 'messy', coat: '#5a4a3a', round: true, stubble: true, rim: ['#ffb13d', '#ff3d8b'] },
    dockhand:  { skin: '#b58565', hair: '#2a1e18', style: 'short', coat: '#5a6a3a', hat: 'cap', rim: ['#ffb13d', '#35e0ff'] },
    vendor:    { skin: '#c89678', hair: '#5a2a1a', style: 'bun', coat: '#8a3a5a', collar: '#ffd9a0', rim: ['#ff4d9a', '#ffb13d'] },
    tram:      { skin: '#d2aa8a', hair: '#1a1a22', style: 'short', coat: '#2a3a5a', hat: 'cap', badge: true, rim: ['#35e0ff', '#ffb13d'] },
    medic:     { skin: '#9a6a4a', hair: '#0e0e14', style: 'long', coat: '#c8d8d4', collar: '#d23a3a', rim: ['#4dff9a', '#ff3d8b'] },
    bouncer:   { skin: '#8a5a3e', hair: '#0a0a0e', style: 'bald', coat: '#14141a', goggles: true, rim: ['#ff3d5e', '#35e0ff'] },
    dj:        { skin: '#e0b8a0', hair: '#35e0ff', style: 'spikes', coat: '#2a1a5a', goggles: true, rim: ['#35e0ff', '#ff3d8b'] },
    ferry:     { skin: '#a8805e', hair: '#bcbcb4', style: 'beard', coat: '#2a4a5a', hat: 'beanie', rim: ['#35e0ff', '#ffb13d'] },
    archivist: { skin: '#e0c0a8', hair: '#8a8a92', style: 'sides', coat: '#4a3a5a', round: true, rim: ['#9d6bff', '#ffb13d'] },
    walk:      { skin: '#c49a7e', hair: '#2a2a32', style: 'short', coat: '#3a4a5a', rim: ['#35e0ff', '#ff3d8b'] },
};

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

function bg(g, w, h, look, t) {
    const [c1, c2] = look.rim;
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#0b0a16'); grd.addColorStop(1, '#171230');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const r = rng(hashStr(c1 + c2));
    for (let i = 0; i < 9; i++) {                 // bokeh street lights
        const x = r() * w, y = r() * h * 0.7, rad = 14 + r() * 30;
        const bk = g.createRadialGradient(x, y, 0, x, y, rad);
        const c = [c1, c2, '#ffd9a0'][i % 3];
        bk.addColorStop(0, c + '90'); bk.addColorStop(0.7, c + '26'); bk.addColorStop(1, c + '00');
        g.fillStyle = bk; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.strokeStyle = 'rgba(160,200,255,0.18)'; g.lineWidth = 1;
    const rr = rng(3);
    for (let i = 0; i < 40; i++) { const x = rr() * w, y = ((rr() * h) + t * 160 * (0.6 + rr())) % h; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 14); g.stroke(); }
}

function figure(g, w, h, look, o) {
    const cx = w / 2 + (o.sway || 0);
    const headY = h * 0.38, hr = w * 0.19;
    // shoulders and coat
    g.fillStyle = look.coat;
    g.beginPath(); g.moveTo(cx - w * 0.5, h); g.quadraticCurveTo(cx - w * 0.46, h * 0.66, cx - hr * 1.0, h * 0.6); g.lineTo(cx + hr * 1.0, h * 0.6); g.quadraticCurveTo(cx + w * 0.46, h * 0.66, cx + w * 0.5, h); g.closePath(); g.fill();
    if (look.cyberArm) { g.fillStyle = '#8a92a0'; g.fillRect(cx + w * 0.26, h * 0.7, w * 0.16, h * 0.3); g.strokeStyle = '#35e0ff'; g.lineWidth = 2; g.strokeRect(cx + w * 0.26, h * 0.7, w * 0.16, h * 0.3); }
    if (look.extra === 'apron') { g.fillStyle = '#e8e0d0'; g.fillRect(cx - hr * 0.8, h * 0.74, hr * 1.6, h * 0.26); }
    // collar / tie
    if (look.collar) { g.fillStyle = look.collar; g.beginPath(); g.moveTo(cx - hr * 0.9, h * 0.6); g.lineTo(cx, h * 0.72); g.lineTo(cx + hr * 0.9, h * 0.6); g.lineTo(cx + hr * 0.6, h * 0.58); g.lineTo(cx, h * 0.64); g.lineTo(cx - hr * 0.6, h * 0.58); g.fill(); }
    if (look.tie) { g.fillStyle = '#eef0f4'; g.beginPath(); g.moveTo(cx - hr * 0.7, h * 0.6); g.lineTo(cx, h * 0.74); g.lineTo(cx + hr * 0.7, h * 0.6); g.fill(); g.fillStyle = look.tie; g.fillRect(cx - 5, h * 0.64, 10, h * 0.18); }
    // neck
    g.fillStyle = look.skin; g.fillRect(cx - hr * 0.42, h * 0.5, hr * 0.84, h * 0.12);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - hr * 0.42, h * 0.5, hr * 0.84, h * 0.04);
    // hair behind
    g.fillStyle = look.hair;
    if (look.style === 'long') { g.beginPath(); g.ellipse(cx, headY + hr * 0.5, hr * 1.25, hr * 1.7, 0, 0, 6.3); g.fill(); }
    if (look.style === 'bun') { g.beginPath(); g.arc(cx, headY - hr * 1.15, hr * 0.5, 0, 6.3); g.fill(); }
    // head
    g.fillStyle = look.skin; g.beginPath(); g.ellipse(cx, headY, hr * 0.92, hr * 1.12, 0, 0, 6.3); g.fill();
    // hair front
    g.fillStyle = look.hair;
    switch (look.style) {
        case 'short': g.beginPath(); g.ellipse(cx, headY - hr * 0.55, hr * 0.98, hr * 0.62, 0, Math.PI, 0); g.fill(); break;
        case 'spikes': for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx + i * hr * 0.28 - 8, headY - hr * 0.7); g.lineTo(cx + i * hr * 0.3, headY - hr * 1.5 + Math.abs(i) * 5); g.lineTo(cx + i * hr * 0.28 + 8, headY - hr * 0.7); g.fill(); } g.beginPath(); g.ellipse(cx, headY - hr * 0.5, hr * 0.95, hr * 0.5, 0, Math.PI, 0); g.fill(); break;
        case 'slick': g.beginPath(); g.ellipse(cx, headY - hr * 0.6, hr * 0.98, hr * 0.5, 0, Math.PI, 0); g.fill(); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(cx - hr * 0.7, headY - hr * 0.82, hr * 1.4, 3); break;
        case 'sides': g.fillRect(cx - hr * 1.0, headY - hr * 0.3, hr * 0.22, hr * 0.9); g.fillRect(cx + hr * 0.78, headY - hr * 0.3, hr * 0.22, hr * 0.9); break;
        case 'messy': g.beginPath(); g.ellipse(cx, headY - hr * 0.55, hr * 1.02, hr * 0.62, 0.1, Math.PI, 0); g.fill(); for (let i = 0; i < 6; i++) g.fillRect(cx - hr + i * hr * 0.4, headY - hr * 1.2 + (i % 2) * 6, 9, 14); break;
        case 'long': g.beginPath(); g.ellipse(cx, headY - hr * 0.58, hr * 1.0, hr * 0.6, 0, Math.PI, 0); g.fill(); g.fillRect(cx - hr * 1.0, headY - hr * 0.6, hr * 0.28, hr * 1.6); break;
        case 'beard': g.beginPath(); g.ellipse(cx, headY + hr * 0.7, hr * 0.85, hr * 0.7, 0, 0, Math.PI); g.fill(); break;
        case 'bun': g.beginPath(); g.ellipse(cx, headY - hr * 0.55, hr * 0.98, hr * 0.58, 0, Math.PI, 0); g.fill(); break;
        default: break;
    }
    if (look.stubble) { g.fillStyle = 'rgba(30,24,20,0.35)'; g.beginPath(); g.ellipse(cx, headY + hr * 0.62, hr * 0.8, hr * 0.5, 0, 0, Math.PI); g.fill(); }
    // hats
    if (look.hat === 'cap') { g.fillStyle = look.coat; g.beginPath(); g.ellipse(cx, headY - hr * 0.62, hr * 1.02, hr * 0.5, 0, Math.PI, 0); g.fill(); g.fillRect(cx - hr * 1.05, headY - hr * 0.64, hr * 2.1, 8); g.fillStyle = '#d4a63a'; g.fillRect(cx - 10, headY - hr * 0.95, 20, 8); }
    if (look.hat === 'beanie') { g.fillStyle = '#3a3a48'; g.beginPath(); g.ellipse(cx, headY - hr * 0.55, hr * 1.02, hr * 0.7, 0, Math.PI, 0); g.fill(); g.fillStyle = '#5a5a6a'; g.fillRect(cx - hr * 1.0, headY - hr * 0.6, hr * 2, 10); }
    // face
    const ey = headY - hr * 0.05, ex = hr * 0.42;
    const open = o.talking ? (Math.sin(o.t * 22) * 0.5 + 0.5) : 0;
    g.fillStyle = '#12101a';
    if (!look.goggles) {
        for (const s of [-1, 1]) {
            const blink = (Math.sin(o.t * 0.9 + s) > 0.985) ? 0.15 : 1;
            g.beginPath(); g.ellipse(cx + s * ex, ey, hr * 0.14, hr * 0.09 * blink, 0, 0, 6.3); g.fill();
            g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(cx + s * ex - 3, ey - 3, 3, 3); g.fillStyle = '#12101a';
        }
        if (look.eyeGlow) { g.shadowColor = look.eyeGlow; g.shadowBlur = 16; g.fillStyle = look.eyeGlow; g.beginPath(); g.arc(cx - ex, ey, hr * 0.12, 0, 6.3); g.fill(); g.shadowBlur = 0; g.fillStyle = '#12101a'; }
        g.fillRect(cx - ex - hr * 0.22, ey - hr * 0.26, hr * 0.44, 3); g.fillRect(cx + ex - hr * 0.22, ey - hr * 0.26, hr * 0.44, 3);
    } else {
        g.fillStyle = '#0a0a10'; g.fillRect(cx - hr * 0.95, ey - hr * 0.2, hr * 1.9, hr * 0.38);
        g.shadowColor = look.rim[0]; g.shadowBlur = 14; g.fillStyle = look.rim[0]; g.fillRect(cx - hr * 0.85, ey - hr * 0.1, hr * 0.7, hr * 0.16); g.fillRect(cx + hr * 0.15, ey - hr * 0.1, hr * 0.7, hr * 0.16); g.shadowBlur = 0;
    }
    if (look.round) { g.strokeStyle = '#d0b060'; g.lineWidth = 2.5; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * ex, ey, hr * 0.28, 0, 6.3); g.stroke(); } g.beginPath(); g.moveTo(cx - ex + hr * 0.28, ey); g.lineTo(cx + ex - hr * 0.28, ey); g.stroke(); }
    if (look.monocle) { g.strokeStyle = '#35e0ff'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx + ex, ey, hr * 0.3, 0, 6.3); g.stroke(); }
    // nose and mouth
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.moveTo(cx, ey + hr * 0.05); g.lineTo(cx - hr * 0.1, ey + hr * 0.5); g.lineTo(cx + hr * 0.12, ey + hr * 0.5); g.fill();
    g.fillStyle = '#2a1214';
    g.beginPath();
    if (look.smile) { g.moveTo(cx - hr * 0.36, headY + hr * 0.62); g.quadraticCurveTo(cx, headY + hr * (0.9 + open * 0.2), cx + hr * 0.36, headY + hr * 0.6); g.lineWidth = 3; g.strokeStyle = '#2a1214'; g.stroke(); }
    else { g.ellipse(cx, headY + hr * 0.66, hr * 0.22, hr * (0.04 + open * 0.14), 0, 0, 6.3); g.fill(); }
    if (look.badge) { g.fillStyle = '#d4a63a'; g.beginPath(); g.moveTo(cx - hr * 0.7, h * 0.7); g.lineTo(cx - hr * 0.4, h * 0.7); g.lineTo(cx - hr * 0.55, h * 0.78); g.fill(); }
}

function spanner(g, w, h, o) {
    const cx = w / 2;
    // wheel
    g.fillStyle = '#16161c'; g.beginPath(); g.ellipse(cx, h * 0.9, w * 0.34, h * 0.1, 0, 0, 6.3); g.fill();
    g.fillStyle = '#ffd23d'; g.beginPath(); g.ellipse(cx, h * 0.9, w * 0.2, h * 0.055, 0, 0, 6.3); g.fill();
    // body and head
    const grd = g.createLinearGradient(cx - w * 0.3, 0, cx + w * 0.3, 0);
    grd.addColorStop(0, '#6a5a30'); grd.addColorStop(0.5, '#d2b866'); grd.addColorStop(1, '#5a4a28');
    g.fillStyle = grd; g.beginPath(); g.ellipse(cx, h * 0.52, w * 0.32, h * 0.3, 0, 0, 6.3); g.fill();
    g.fillStyle = '#2a2a30'; g.fillRect(cx - w * 0.3, h * 0.58, w * 0.6, 6);
    // lamp eye
    const pulse = o.talking ? 0.75 + Math.sin(o.t * 26) * 0.25 : 0.85 + Math.sin(o.t * 2) * 0.1;
    const blink = Math.sin(o.t * 0.9) > 0.985 ? 0.12 : 1;
    g.shadowColor = '#ffe27a'; g.shadowBlur = 40 * pulse; g.fillStyle = '#fff2b0';
    g.beginPath(); g.ellipse(cx, h * 0.44, w * 0.13, w * 0.13 * blink, 0, 0, 6.3); g.fill(); g.shadowBlur = 0;
    g.fillStyle = '#c99a2a'; g.beginPath(); g.ellipse(cx, h * 0.44, w * 0.06, w * 0.06 * blink, 0, 0, 6.3); g.fill();
    // antenna
    g.strokeStyle = '#aab'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + w * 0.1, h * 0.25); g.lineTo(cx + w * 0.16, h * 0.1); g.stroke();
    g.fillStyle = '#ff3d8b'; g.beginPath(); g.arc(cx + w * 0.16, h * 0.1, 5, 0, 6.3); g.fill();
}

/** Draw a portrait into a canvas. `o` = { t, talking, name }. */
export function drawPortrait(canvas, lookId, o = {}) {
    const g = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    let look = LOOKS[lookId] || LOOKS.walk;
    if (lookId === 'walk' || !LOOKS[lookId]) {
        // anonymous customers vary by name
        const r = rng(hashStr(o.name || 'x'));
        look = { ...LOOKS.walk, skin: ['#c49a7e', '#8a5a3e', '#e0b8a0', '#a8805e'][Math.floor(r() * 4)], hair: ['#2a2a32', '#6a3a1a', '#d0d0d0', '#35e0ff'][Math.floor(r() * 4)], coat: ['#3a4a5a', '#5a3a4a', '#3a5a4a', '#4a4a5a'][Math.floor(r() * 4)], style: ['short', 'spikes', 'long', 'sides'][Math.floor(r() * 4)] };
    }
    const t = o.t || 0;
    bg(g, w, h, look, t);
    if (lookId === 'spanner') spanner(g, w, h, { t, talking: o.talking });
    else figure(g, w, h, look, { t, talking: o.talking, sway: Math.sin(t * 0.8) * 2 });
    // neon rim light from both sides, then a little scanline
    const [c1, c2] = look.rim;
    const l = g.createLinearGradient(0, 0, w * 0.35, 0); l.addColorStop(0, c1 + '55'); l.addColorStop(1, c1 + '00');
    g.fillStyle = l; g.globalCompositeOperation = 'lighter'; g.fillRect(0, 0, w, h);
    const rr = g.createLinearGradient(w, 0, w * 0.65, 0); rr.addColorStop(0, c2 + '55'); rr.addColorStop(1, c2 + '00');
    g.fillStyle = rr; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    const v = g.createRadialGradient(w / 2, h * 0.45, w * 0.3, w / 2, h * 0.5, w * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
}
