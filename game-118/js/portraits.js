// The eight guests' faces, drawn on a small 2D canvas once and cached as data URLs. No image files.

const LOOKS = {
    rose:  { bg: '#ffd9a0', skin: '#f1c9a5', shirt: '#b3243a', hair: '#ecebf0', acc: ['bun', 'glasses', 'pearls'] },
    joe:   { bg: '#cfe3f7', skin: '#e0b08c', shirt: '#3d7ed8', hair: '#f3f3f3', acc: ['bald', 'whitestache', 'brows'] },
    bob:   { bg: '#ffe0b0', skin: '#d99f77', shirt: '#6d9c2e', hair: '#5a3a22', acc: ['cap', 'stache'] },
    linda: { bg: '#f7d4e0', skin: '#f1c9a5', shirt: '#2f8f83', hair: '#b8541d', acc: ['curly', 'earrings'] },
    timmy: { bg: '#d8f0c0', skin: '#f1c9a5', shirt: '#f08a24', hair: '#e8b830', acc: ['spiky', 'freckles'] },
    ava:   { bg: '#fbe9a0', skin: '#8d5a3b', shirt: '#f2c230', hair: '#241810', acc: ['pigtails', 'bows'] },
    pete:  { bg: '#e6d8c0', skin: '#f1c9a5', shirt: '#2f2a28', hair: '#6a4a2a', acc: ['pilgrim', 'collar'] },
    tess:  { bg: '#e6d4f2', skin: '#e0b08c', shirt: '#7a4b9b', hair: '#241810', acc: ['turkeyhat'] },
};

const cache = new Map();

function draw(g, L) {
    const has = (a) => L.acc.includes(a);
    g.fillStyle = L.bg;
    g.fillRect(0, 0, 96, 96);
    // behind the head
    g.fillStyle = L.hair;
    if (has('bun')) { g.beginPath(); g.arc(48, 14, 12, 0, 7); g.fill(); }
    if (has('pigtails')) { for (const x of [18, 78]) { g.beginPath(); g.arc(x, 56, 11, 0, 7); g.fill(); } }
    if (has('curly')) { for (let i = 0; i < 10; i++) { const a = Math.PI * (0.95 + i * 0.12); g.beginPath(); g.arc(48 + Math.cos(a) * 29, 46 + Math.sin(a) * 31 + 6, 10, 0, 7); g.fill(); } }
    // shoulders and neck
    g.fillStyle = L.shirt;
    g.beginPath(); g.moveTo(4, 98); g.quadraticCurveTo(8, 66, 48, 64); g.quadraticCurveTo(88, 66, 92, 98); g.fill();
    if (has('collar')) { g.fillStyle = '#fff4de'; g.beginPath(); g.moveTo(30, 66); g.lineTo(48, 84); g.lineTo(66, 66); g.lineTo(60, 62); g.lineTo(48, 74); g.lineTo(36, 62); g.fill(); }
    g.fillStyle = L.skin;
    g.fillRect(41, 56, 14, 14);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(41, 56, 14, 5);
    // head and ears
    g.fillStyle = L.skin;
    for (const x of [26, 70]) { g.beginPath(); g.arc(x, 46, 5.5, 0, 7); g.fill(); }
    g.beginPath(); g.ellipse(48, 44, 22, 25, 0, 0, 7); g.fill();
    // hair on top
    g.fillStyle = L.hair;
    if (!has('bald') && !has('turkeyhat') && !has('pilgrim')) {
        g.beginPath(); g.ellipse(48, 28, 23, 14, 0, Math.PI, 0); g.fill();
        if (has('cap')) g.clearRect(0, 0, 0, 0);
    }
    if (has('spiky')) { for (let i = 0; i < 5; i++) { const x = 30 + i * 9; g.beginPath(); g.moveTo(x - 5, 28); g.lineTo(x + (i === 2 ? -4 : 0), 8 + (i % 2) * 5); g.lineTo(x + 5, 28); g.fill(); } }
    if (has('bald')) { g.fillStyle = L.hair; for (const x of [27, 69]) { g.beginPath(); g.ellipse(x, 40, 4, 8, 0, 0, 7); g.fill(); } }
    // accessories that sit on the head
    if (has('cap')) {
        g.fillStyle = '#f08a24';
        g.beginPath(); g.ellipse(48, 27, 23, 15, 0, Math.PI, 0); g.fill();
        g.fillRect(24, 26, 62, 6);
        g.fillStyle = '#c9640c'; g.beginPath(); g.ellipse(48, 30, 24, 4, 0, 0, 7); g.fill();
    }
    if (has('pilgrim')) {
        g.fillStyle = '#2a2320';
        g.fillRect(31, 2, 34, 24);
        g.beginPath(); g.ellipse(48, 27, 33, 6, 0, 0, 7); g.fill();
        g.fillStyle = '#fff4de'; g.fillRect(31, 18, 34, 6);
        g.fillStyle = '#f5b82e'; g.fillRect(43, 16, 10, 10);
        g.fillStyle = '#2a2320'; g.fillRect(46, 19, 4, 4);
    }
    if (has('turkeyhat')) {
        const cols = ['#c92f3c', '#f08a24', '#f2c230', '#6d9c2e', '#3d7ed8'];
        cols.forEach((c, i) => { const a = Math.PI * (1.12 + i * 0.19); g.fillStyle = c; g.beginPath(); g.ellipse(48 + Math.cos(a) * 20, 14 + Math.sin(a) * 18 + 8, 6, 15, a + Math.PI / 2, 0, 7); g.fill(); });
        g.fillStyle = '#8a5330'; g.beginPath(); g.ellipse(48, 26, 24, 15, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#c92f3c'; g.beginPath(); g.ellipse(48, 38, 3, 8, 0, 0, 7); g.fill();
    }
    if (has('bows')) { g.fillStyle = '#c92f3c'; for (const x of [22, 74]) { g.beginPath(); g.arc(x - 4, 44, 5, 0, 7); g.arc(x + 4, 44, 5, 0, 7); g.fill(); } }
    if (has('brows') || has('whitestache')) { g.fillStyle = '#f3f3f3'; g.fillRect(31, 33, 14, 4); g.fillRect(51, 33, 14, 4); }
    // face
    g.fillStyle = '#2a1a10';
    for (const x of [39, 57]) { g.beginPath(); g.arc(x, 46, 3.2, 0, 7); g.fill(); }
    g.fillStyle = '#fff';
    for (const x of [40, 58]) { g.beginPath(); g.arc(x, 45, 1.1, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(224,90,90,0.32)';
    for (const x of [32, 64]) { g.beginPath(); g.arc(x, 55, 5, 0, 7); g.fill(); }
    if (has('freckles')) { g.fillStyle = 'rgba(150,80,40,0.6)'; for (const [x, y] of [[34, 52], [38, 54], [58, 54], [62, 52], [36, 56], [60, 56]]) g.fillRect(x, y, 2, 2); }
    g.strokeStyle = '#7a2d1a'; g.lineWidth = 2.6; g.lineCap = 'round';
    g.beginPath(); g.arc(48, 55, 8, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.fillStyle = L.skin;
    g.beginPath(); g.ellipse(48, 51, 3.4, 2.8, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.1)'; g.beginPath(); g.ellipse(48, 52, 3, 2, 0, 0, Math.PI); g.fill();
    if (has('stache') || has('whitestache')) {
        g.fillStyle = has('whitestache') ? '#f3f3f3' : '#3a2412';
        g.beginPath(); g.ellipse(41, 54, 8, 3.6, -0.25, 0, 7); g.ellipse(55, 54, 8, 3.6, 0.25, 0, 7); g.fill();
    }
    if (has('glasses')) {
        g.strokeStyle = '#6a4a2a'; g.lineWidth = 2.4;
        for (const x of [39, 57]) { g.beginPath(); g.arc(x, 46, 8, 0, 7); g.stroke(); }
        g.beginPath(); g.moveTo(47, 45); g.lineTo(49, 45); g.stroke();
    }
    if (has('pearls')) { g.fillStyle = '#fff9ec'; for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + i * 0.116); g.beginPath(); g.arc(48 + Math.cos(a) * 14, 66 + Math.sin(a) * 7, 2.6, 0, 7); g.fill(); } }
    if (has('earrings')) { g.fillStyle = '#f5b82e'; for (const x of [26, 70]) { g.beginPath(); g.arc(x, 56, 3.2, 0, 7); g.fill(); } }
}

export function portrait(id) {
    let url = cache.get(id);
    if (url) return url;
    const L = LOOKS[id] || LOOKS.rose;
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    draw(c.getContext('2d'), L);
    url = c.toDataURL('image/png');
    cache.set(id, url);
    return url;
}
