// Course monsters: cute obstacles that wander on fixed paths (a pure function of time, so a bot can
// predict them) and pop for XP and gold when the ball bonks them.

export const MONSTERS = {
    slime: { name: 'Puffslime', r: 0.62, h: 0.55, xp: 6, gold: 3, speed: 0.32 },
    scarab: { name: 'Scarab', r: 0.55, h: 0.45, xp: 8, gold: 4, speed: 0.55 },
    penguin: { name: 'Penguin Knight', r: 0.6, h: 0.65, xp: 10, gold: 4, speed: 0.4 },
    imp: { name: 'Ember Imp', r: 0.58, h: 0.7, xp: 12, gold: 5, speed: 0.6 },
    wisp: { name: 'Bogey Wisp', r: 0.62, h: 1.6, xp: 14, gold: 6, speed: 0.45 },
};

// Where monster i is at time t: { x, y, z, face, hop }.
export function monsterPos(course, m, t, out = {}) {
    const M = MONSTERS[m.kind];
    const ph = m.i * 1.7 + m.x * 0.13;
    const w = M.speed;
    let x, z, hop = 0;
    switch (m.kind) {
        case 'scarab': {
            const a = ph * 2.1;
            const s = Math.sin(t * w + ph);
            x = m.x + Math.cos(a) * m.r * s; z = m.z + Math.sin(a) * m.r * s;
            break;
        }
        case 'penguin': {
            x = m.x + Math.sin(t * w + ph) * m.r; z = m.z + Math.sin(2 * (t * w + ph)) * m.r * 0.5;
            break;
        }
        default: {
            const a = t * w * (m.i % 2 ? -1 : 1) + ph;
            x = m.x + Math.sin(a) * m.r; z = m.z + Math.cos(a) * m.r;
            if (m.kind === 'slime' || m.kind === 'imp') hop = Math.abs(Math.sin(t * (m.kind === 'imp' ? 5 : 3.4) + ph)) * (m.kind === 'imp' ? 0.7 : 0.45);
        }
    }
    const gy = course.heightAt(x, z);
    out.x = x; out.z = z;
    out.y = (gy < -20 ? m.y0 ?? 0 : gy) + M.h + hop + (m.kind === 'wisp' ? Math.sin(t * 1.7 + ph) * 0.35 : 0);
    // facing: direction of travel
    const dt = 0.05;
    let nx, nz;
    if (m.kind === 'scarab') { const a = ph * 2.1; const s2 = Math.sin((t + dt) * w + ph); nx = m.x + Math.cos(a) * m.r * s2; nz = m.z + Math.sin(a) * m.r * s2; }
    else if (m.kind === 'penguin') { nx = m.x + Math.sin((t + dt) * w + ph) * m.r; nz = m.z + Math.sin(2 * ((t + dt) * w + ph)) * m.r * 0.5; }
    else { const a = (t + dt) * w * (m.i % 2 ? -1 : 1) + ph; nx = m.x + Math.sin(a) * m.r; nz = m.z + Math.cos(a) * m.r; }
    out.face = Math.atan2(nx - x, nz - z);
    out.hop = hop;
    out.vx = (nx - x) / dt; out.vz = (nz - z) / dt;
    return out;
}
