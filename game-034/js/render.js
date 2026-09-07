import { STAGE_W, STAGE_H } from './config.js';

/**
 * render.js — all procedural Canvas 2D drawing. No image assets anywhere:
 * rooms, combatants, HP bars, particles and lighting are generated shapes.
 */

let ctx, canvas;
let particles = [];
let floatingTexts = [];
let torchPhase = 0;

export function initRender(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
}

export function spawnParticle(x, y, color, opts = {}) {
    const n = opts.count || 6;
    for (let i = 0; i < n; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * (opts.spread || 120),
            vy: (Math.random() - 1.2) * (opts.spread || 120),
            life: 0,
            maxLife: 0.5 + Math.random() * 0.4,
            color,
            size: 3 + Math.random() * 3,
        });
    }
}

export function spawnFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, life: 0, maxLife: 0.9 });
}

function depthPalette(floorNum) {
    // Shift room colors darker/redder the deeper the floor.
    const t = Math.min(1, (floorNum - 1) / 30);
    const near = [
        Math.round(40 + t * 60),
        Math.round(30 - t * 18),
        Math.round(55 - t * 30),
    ];
    const far = [
        Math.round(20 + t * 30),
        Math.round(14 - t * 8),
        Math.round(30 - t * 16),
    ];
    return { near, far };
}

function rgb(arr, a = 1) { return `rgba(${arr[0]},${arr[1]},${arr[2]},${a})`; }

/** Draw the room background — a receding corridor with torch-flicker lighting. */
function drawRoomBackground(floorNum, roomType) {
    const { near, far } = depthPalette(floorNum);

    const grad = ctx.createLinearGradient(0, 0, 0, STAGE_H);
    grad.addColorStop(0, rgb(far));
    grad.addColorStop(1, rgb(near));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);

    // Perspective corridor lines
    ctx.strokeStyle = rgb(far, 0.5);
    ctx.lineWidth = 2;
    const vanishX = STAGE_W / 2, vanishY = STAGE_H * 0.38;
    const corners = [[0, 0], [STAGE_W, 0], [0, STAGE_H], [STAGE_W, STAGE_H]];
    for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(vanishX, vanishY);
        ctx.stroke();
    }

    // Flickering torch light (radial gradient, animated)
    torchPhase += 0.03;
    const flick = 0.75 + Math.sin(torchPhase * 3.1) * 0.08 + Math.sin(torchPhase * 7.7) * 0.05;
    const glow = ctx.createRadialGradient(vanishX, vanishY, 10, vanishX, vanishY, STAGE_W * 0.6);
    glow.addColorStop(0, `rgba(255, 180, 90, ${0.22 * flick})`);
    glow.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);

    // Floor type tint overlay
    if (roomType === 'treasure') {
        ctx.fillStyle = 'rgba(255, 211, 77, 0.06)';
        ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    } else if (roomType === 'rest') {
        ctx.fillStyle = 'rgba(93, 224, 138, 0.06)';
        ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    }
}

function drawHpBar(x, y, w, h, ratio, color) {
    ctx.fillStyle = 'rgba(20,10,16,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, ratio), h);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
}

function drawCombatantShape(c, x, y, scale) {
    const flash = c.anim.hitFlash > 0;
    ctx.save();
    ctx.translate(x, y);

    const bob = Math.sin(performance.now() / 260 + c.anim.bob) * 3 * scale;
    ctx.translate(0, bob);

    const pulse = c.anim.attackPulse > 0 ? c.anim.attackPulse * 6 : 0;
    ctx.translate(c.side === 'hero' ? pulse : -pulse, 0);

    ctx.fillStyle = flash ? '#ffffff' : c.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;

    const s = 22 * scale;
    switch (c.shape) {
        case 'square':
            ctx.beginPath(); ctx.rect(-s / 2, -s / 2, s, s); ctx.fill(); ctx.stroke();
            break;
        case 'triangle':
            ctx.beginPath();
            ctx.moveTo(0, -s / 1.5); ctx.lineTo(s / 1.5, s / 1.8); ctx.lineTo(-s / 1.5, s / 1.8);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            break;
        case 'diamond':
            ctx.beginPath();
            ctx.moveTo(0, -s / 1.4); ctx.lineTo(s / 1.4, 0); ctx.lineTo(0, s / 1.4); ctx.lineTo(-s / 1.4, 0);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            break;
        case 'circle':
            ctx.beginPath(); ctx.arc(0, 0, s / 1.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            break;
        case 'blob':
            ctx.beginPath();
            ctx.ellipse(0, s * 0.15, s / 1.5, s / 2.2, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.05, s * 0.12, 0, Math.PI * 2); ctx.fill();
            break;
        case 'humanoid':
            ctx.beginPath(); ctx.arc(0, -s / 2, s / 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.rect(-s / 3, -s / 6, s / 1.5, s / 1.2); ctx.fill(); ctx.stroke();
            break;
        case 'wing':
            ctx.beginPath();
            ctx.moveTo(0, -s / 2); ctx.lineTo(s / 1.2, s / 6); ctx.lineTo(0, s / 2.2); ctx.lineTo(-s / 1.2, s / 6);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            break;
        case 'boss':
            ctx.beginPath(); ctx.rect(-s / 1.4, -s / 1.4, s * 1.4, s * 1.4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#1a1010';
            ctx.beginPath(); ctx.arc(-s * 0.3, -s * 0.25, s * 0.12, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.25, s * 0.12, 0, Math.PI * 2); ctx.fill();
            break;
        default:
            ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    ctx.restore();
}

function decayAnim(c, dt) {
    if (c.anim.hitFlash > 0) c.anim.hitFlash = Math.max(0, c.anim.hitFlash - dt * 6);
    if (c.anim.attackPulse > 0) c.anim.attackPulse = Math.max(0, c.anim.attackPulse - dt * 5);
    if (c.anim.healFlash > 0) c.anim.healFlash = Math.max(0, c.anim.healFlash - dt * 4);
}

/** Main draw call — called every rAF frame from main.js. */
export function renderFrame(dt, sceneState) {
    if (!ctx) return;
    const { floorNum, roomType, party, monsters, roomLabel } = sceneState;

    drawRoomBackground(floorNum, roomType);

    // Party row (left-front), monsters row (right-back) — mirrors a corridor face-off.
    const partyY = STAGE_H * 0.72;
    const monsterY = STAGE_H * 0.42;

    party.forEach((h, i) => {
        decayAnim(h, dt);
        if (!h.alive) return;
        const x = STAGE_W * 0.18 + i * 90;
        drawCombatantShape(h, x, partyY, 1.3);
        drawHpBar(x - 30, partyY + 34, 60, 7, h.hp / h.maxHp, '#5de08a');
    });

    monsters.forEach((m, i) => {
        decayAnim(m, dt);
        if (!m.alive) return;
        const x = STAGE_W * 0.62 + i * 80;
        drawCombatantShape(m, x, monsterY, 1.15);
        drawHpBar(x - 28, monsterY - 46, 56, 6, m.hp / m.maxHp, '#e2455a');
    });

    // Particles
    particles = particles.filter(p => p.life < p.maxLife);
    for (const p of particles) {
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 220 * dt; // gravity
        const a = 1 - p.life / p.maxLife;
        ctx.fillStyle = rgb(p.color, a);
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }

    // Floating combat text
    floatingTexts = floatingTexts.filter(t => t.life < t.maxLife);
    ctx.font = 'bold 16px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    for (const t of floatingTexts) {
        t.life += dt;
        const a = 1 - t.life / t.maxLife;
        ctx.fillStyle = rgb(t.color, a);
        ctx.fillText(t.text, t.x, t.y - t.life * 40);
    }

    // Room label (top-center, subtle)
    if (roomLabel) {
        ctx.font = '13px Trebuchet MS, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(232,226,240,0.55)';
        ctx.fillText(roomLabel, STAGE_W / 2, 26);
    }
}
