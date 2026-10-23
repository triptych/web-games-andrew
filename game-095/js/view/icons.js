// Little pictures drawn on canvases: an icon for every item in the pack and a face for every
// speaker. All procedural, no files. Each icon is drawn on a 64×64 canvas.

const TAU = Math.PI * 2;
const ink = '#3a2a1a';

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fillStroke(g, fill, stroke = ink, lw = 2.5) { g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); }

const key = (g, body, bow) => {
    g.save(); g.translate(32, 32); g.rotate(-0.7);
    rr(g, -4, -4, 36, 8, 3); fillStroke(g, body);
    for (const x of [18, 25]) { g.fillStyle = body; g.fillRect(x, 4, 4, 8); g.strokeStyle = ink; g.strokeRect(x, 4, 4, 8); }
    bow(g);
    g.restore();
};

const DRAW = {
    card: (g) => { g.save(); g.rotate(-0.1); rr(g, 12, 14, 40, 36, 3); fillStroke(g, '#f6ecd0'); g.restore(); g.strokeStyle = '#d8c89e'; g.lineWidth = 1.5; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(18, 26 + i * 8); g.lineTo(44, 24 + i * 8); g.stroke(); } },
    candles: (g) => {
        const cols = ['#ff6b8b', '#ffd043', '#4fd6a0', '#56b8ff'];
        cols.forEach((c, i) => { const x = 12 + i * 12; rr(g, x, 26, 8, 28, 2); fillStroke(g, c, ink, 2); g.beginPath(); g.ellipse(x + 4, 20, 3.5, 6, 0, 0, TAU); fillStroke(g, '#ffcf4a', '#e07a1a', 1.5); });
    },
    brass_key: (g) => key(g, '#e3b84c', (g) => { g.beginPath(); g.arc(-8, 0, 10, 0, TAU); fillStroke(g, '#e3b84c'); g.beginPath(); g.arc(-8, 0, 4, 0, TAU); g.fillStyle = '#3a2a1a'; g.fill(); g.fillStyle = '#e3b84c'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-8 + Math.cos(i * 1.05) * 11, Math.sin(i * 1.05) * 11, 3, 0, TAU); g.fill(); } }),
    winding_key: (g) => key(g, '#d4dae6', (g) => { g.beginPath(); g.moveTo(-8, -10); g.lineTo(2, -10); g.lineTo(2, 10); g.lineTo(-8, 10); g.closePath(); fillStroke(g, '#d4dae6'); g.beginPath(); g.arc(-8, -10, 4, 0, TAU); fillStroke(g, '#e8edf6'); }),
    trunk_key: (g) => key(g, '#e3b84c', (g) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, r = i % 2 ? 6 : 13; g.lineTo(-8 + Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); fillStroke(g, '#ffd75a'); }),
    broom: (g) => { g.save(); g.translate(32, 32); g.rotate(0.7); rr(g, -3, -30, 6, 40, 3); fillStroke(g, '#a8743c'); g.beginPath(); g.moveTo(-10, 8); g.lineTo(10, 8); g.lineTo(14, 28); g.lineTo(-14, 28); g.closePath(); fillStroke(g, '#e6c15a'); for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 5, 12); g.lineTo(i * 5.5, 27); g.strokeStyle = '#b08a2e'; g.lineWidth = 1.2; g.stroke(); } g.restore(); },
    quill: (g) => { g.save(); g.translate(32, 32); g.rotate(0.6); g.beginPath(); g.moveTo(-6, 26); g.quadraticCurveTo(-24, -4, 4, -30); g.quadraticCurveTo(24, -4, 6, 26); g.closePath(); fillStroke(g, '#f4efe4'); g.beginPath(); g.moveTo(0, 28); g.lineTo(0, -26); g.strokeStyle = ink; g.lineWidth = 2; g.stroke(); g.restore(); },
    ink: (g) => { rr(g, 18, 26, 28, 26, 7); fillStroke(g, '#1f2e6e'); g.fillStyle = '#7a8ee8'; g.fillRect(22, 30, 5, 14); rr(g, 24, 16, 16, 12, 2); fillStroke(g, '#3a2a1a'); },
    inked_quill: (g) => { DRAW.quill(g); g.fillStyle = '#1f2e6e'; g.beginPath(); g.arc(12, 56, 4, 0, TAU); g.fill(); g.beginPath(); g.moveTo(8, 54); g.lineTo(16, 54); g.lineTo(12, 62); g.fill(); },
    invitation: (g) => { DRAW.card(g); g.fillStyle = '#b4376a'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, r = i % 2 ? 4 : 9; g.lineTo(32 + Math.cos(a) * r, 36 + Math.sin(a) * r); } g.closePath(); g.fill(); },
    music_box: (g) => { rr(g, 8, 26, 48, 26, 4); fillStroke(g, '#8a2d4a'); rr(g, 6, 20, 52, 10, 3); fillStroke(g, '#c0405e'); ['#ff6b8b', '#ffb43a', '#4fd6a0', '#56b8ff', '#a57bff'].forEach((c, i) => { g.beginPath(); g.arc(14 + i * 9, 25, 3, 0, TAU); g.fillStyle = c; g.fill(); }); g.fillStyle = '#e3b84c'; g.fillRect(8, 40, 48, 3); },
    streamers: (g) => { ['#ff6b8b', '#ffb43a', '#4fd6a0', '#56b8ff', '#a57bff'].forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(10 + i * 10, 12); g.bezierCurveTo(4 + i * 12, 30, 22 + i * 8, 40, 12 + i * 10, 56); g.stroke(); }); },
    cake_mix: (g) => { rr(g, 14, 14, 36, 40, 4); fillStroke(g, '#f1c24a'); g.fillStyle = '#fff'; g.fillRect(14, 28, 36, 12); g.fillStyle = '#c0572a'; g.font = 'bold 9px Georgia'; g.textAlign = 'center'; g.fillText('CAKE', 32, 37); rr(g, 12, 10, 40, 8, 3); fillStroke(g, '#c8932f'); },
    frosting: (g) => { rr(g, 16, 24, 32, 30, 6); fillStroke(g, '#f5a6c6'); rr(g, 14, 16, 36, 10, 3); fillStroke(g, '#e3b84c'); g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 40, 7, 0, TAU); g.fill(); },
    plain_cake: (g) => { rr(g, 10, 30, 44, 22, 6); fillStroke(g, '#f0c274'); g.fillStyle = '#d99a4a'; g.fillRect(10, 44, 44, 8); g.beginPath(); g.ellipse(32, 30, 22, 7, 0, 0, TAU); fillStroke(g, '#f6d89a'); },
    frosted_cake: (g) => { DRAW.plain_cake(g); g.beginPath(); g.ellipse(32, 30, 22, 7, 0, 0, TAU); fillStroke(g, '#f8bcd2'); g.fillStyle = '#f8bcd2'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(14 + i * 9, 34, 4, 0, TAU); g.fill(); } },
    birthday_cake: (g) => { DRAW.frosted_cake(g); ['#ff6b8b', '#ffd043', '#4fd6a0'].forEach((c, i) => { const x = 22 + i * 10; rr(g, x, 14, 5, 16, 1.5); fillStroke(g, c, ink, 1.5); g.beginPath(); g.ellipse(x + 2.5, 10, 2.6, 4, 0, 0, TAU); g.fillStyle = '#ffcf4a'; g.fill(); }); },
};

export function drawItem(canvas, id) {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.save();
    g.scale(canvas.width / 64, canvas.height / 64);
    (DRAW[id] || DRAW.card)(g);
    g.restore();
}

// ------------------------------------------------------------------ faces for the dialogue box
const FACES = {
    Maya: { bg: '#2fb5a8', skin: '#8a5a3c', hair: '#1c1410', hairStyle: 'pony' },
    Theo: { bg: '#f08a3a', skin: '#f0c8a0', hair: '#5a3a22', hairStyle: 'curly', glasses: true },
    June: { bg: '#a06be0', skin: '#d9a47a', hair: '#d23a8e', hairStyle: 'bob', beret: true },
    Dev: { bg: '#e0453d', skin: '#b77a50', hair: '#e3b84a', hairStyle: 'spiky' },
};

export function drawFace(canvas, who) {
    const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    g.save(); g.scale(w / 64, h / 64);
    if (who === 'Winnie') {
        const gr = g.createRadialGradient(32, 32, 4, 32, 32, 34); gr.addColorStop(0, '#dfe8ff'); gr.addColorStop(1, '#6a78c8');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
        g.beginPath(); g.arc(32, 34, 20, Math.PI, 0); g.lineTo(52, 60); g.lineTo(12, 60); g.closePath(); g.fillStyle = '#fff'; g.fill();
        g.fillStyle = '#1a1030'; for (const x of [25, 39]) { g.beginPath(); g.ellipse(x, 34, 3.2, 5, 0, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(255,130,170,0.6)'; for (const x of [19, 45]) { g.beginPath(); g.arc(x, 42, 4, 0, TAU); g.fill(); }
        g.strokeStyle = '#1a1030'; g.lineWidth = 2; g.beginPath(); g.arc(32, 44, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    } else if (FACES[who]) {
        const f = FACES[who];
        g.fillStyle = f.bg; g.fillRect(0, 0, 64, 64);
        g.fillStyle = f.hair;
        if (f.hairStyle === 'pony') { g.beginPath(); g.arc(32, 32, 22, 0, TAU); g.fill(); g.beginPath(); g.arc(52, 40, 8, 0, TAU); g.fill(); }
        if (f.hairStyle === 'curly') for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(32 + Math.cos(i * 0.7) * 17, 24 + Math.sin(i * 0.7) * 14, 8, 0, TAU); g.fill(); }
        if (f.hairStyle === 'bob') { g.beginPath(); g.arc(32, 32, 24, 0, TAU); g.fill(); g.fillRect(8, 30, 48, 22); }
        if (f.hairStyle === 'spiky') for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(14 + i * 6, 20); g.lineTo(17 + i * 6, 4 + (i % 2) * 4); g.lineTo(21 + i * 6, 20); g.fill(); }
        g.fillStyle = f.skin; g.beginPath(); g.ellipse(32, 36, 17, 19, 0, 0, TAU); g.fill();
        g.fillStyle = f.hair; g.beginPath(); g.ellipse(32, 22, 18, 9, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#2a1a10'; for (const x of [25, 39]) { g.beginPath(); g.arc(x, 36, 2.3, 0, TAU); g.fill(); }
        g.strokeStyle = '#2a1a10'; g.lineWidth = 2; g.beginPath(); g.arc(32, 42, 5, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
        if (f.glasses) { g.lineWidth = 1.8; for (const x of [25, 39]) { g.beginPath(); g.arc(x, 36, 6, 0, TAU); g.stroke(); } g.beginPath(); g.moveTo(31, 36); g.lineTo(33, 36); g.stroke(); }
        if (f.beret) { g.fillStyle = '#2a2a8a'; g.beginPath(); g.ellipse(36, 17, 17, 6, -0.15, 0, TAU); g.fill(); }
    } else {
        g.fillStyle = '#2a2050'; g.fillRect(0, 0, 64, 64);
        g.fillStyle = '#fff2b0'; g.beginPath(); g.arc(34, 30, 14, 0, TAU); g.fill();
        g.fillStyle = '#2a2050'; g.beginPath(); g.arc(40, 26, 12, 0, TAU); g.fill();
        g.fillStyle = '#fff'; for (const [x, y] of [[12, 12], [50, 50], [14, 48], [52, 14]]) g.fillRect(x, y, 2, 2);
    }
    g.restore();
}
