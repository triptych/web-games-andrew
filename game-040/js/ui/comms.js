/**
 * comms.js — the cockpit radio: a procedurally drawn portrait plus a line of
 * dialogue, queued so two events never talk over each other.
 *
 * Portraits are drawn in code (helmet, visor, name tag) from each cadet's
 * colours — no asset files, and it means a new cadet needs no art.
 */

import { CADETS, COMMS } from '../sim/story.js';

const SPEAKERS = {
    SPARROW: { visor: 0x7ef2ff, suit: 0x1e3a4a, name: 'SPARROW' },
    CONTROL: { visor: 0xffd166, suit: 0x33384a, name: 'HALCYON CONTROL' },
    '???':   { visor: 0xff4d6d, suit: 0x2a1a2a, name: '???' },
};
for (const c of CADETS) {
    SPEAKERS[c.callsign] = { visor: c.visor, suit: c.suit, name: c.callsign };
    SPEAKERS[c.name.toUpperCase()] = SPEAKERS[c.callsign];
}
// COMMS lines address people by first name; map those onto their callsigns.
SPEAKERS.JUNO = SPEAKERS.WRENCH;
SPEAKERS.ISLA = SPEAKERS.SHARPSHOT;
SPEAKERS.KEL = SPEAKERS.WARDEN;

const queue = [];
let current = null;
let timer = 0;
let typed = 0;
let panel = null, canvas = null, ctx = null, nameEl = null, textEl = null;

export function initComms() {
    panel = document.getElementById('comms');
    canvas = document.getElementById('comms-portrait');
    nameEl = document.getElementById('comms-name');
    textEl = document.getElementById('comms-text');
    if (canvas) {
        canvas.width = 96;
        canvas.height = 96;
        ctx = canvas.getContext('2d');
    }
    queue.length = 0;
    current = null;
    panel?.classList.add('hidden');
}

export function say(id) {
    const line = COMMS[id];
    if (!line) return;
    queue.push({ who: line.who, text: line.text, dur: line.dur ?? 4.5 });
    if (queue.length > 4) queue.splice(0, queue.length - 4);
}

export function sayRaw(who, text, dur = 4.5) {
    queue.push({ who, text, dur });
}

export function updateComms(dt) {
    if (!panel) return;
    if (!current) {
        if (queue.length === 0) return;
        current = queue.shift();
        timer = current.dur;
        typed = 0;
        drawPortrait(current.who);
        if (nameEl) nameEl.textContent = speakerFor(current.who).name;
        panel.classList.remove('hidden');
        panel.classList.add('show');
        return;
    }
    timer -= dt;
    typed = Math.min(current.text.length, typed + dt * 52);
    if (textEl) textEl.textContent = current.text.slice(0, Math.floor(typed));
    if (timer <= 0) {
        current = null;
        panel.classList.remove('show');
        if (queue.length === 0) panel.classList.add('hidden');
    }
}

function speakerFor(who) {
    return SPEAKERS[who] ?? { visor: 0xdcdcf0, suit: 0x2a2f44, name: who };
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

/** A helmeted pilot, drawn from two colours and a callsign. */
function drawPortrait(who) {
    if (!ctx) return;
    const sp = speakerFor(who);
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // backing glow
    const grad = ctx.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W / 1.5);
    grad.addColorStop(0, hex(sp.visor) + '55');
    grad.addColorStop(1, '#00000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // shoulders
    ctx.fillStyle = hex(sp.suit);
    ctx.beginPath();
    ctx.ellipse(W / 2, H + 12, W * 0.48, H * 0.36, 0, Math.PI, 0);
    ctx.fill();

    // helmet
    ctx.fillStyle = '#d8e0f0';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.46, W * 0.31, H * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // visor
    ctx.fillStyle = hex(sp.visor);
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.47, W * 0.23, H * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(W * 0.42, H * 0.42, W * 0.07, H * 0.05, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // helmet rim + antenna
    ctx.strokeStyle = hex(sp.visor);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.46, W * 0.31, H * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W * 0.78, H * 0.3);
    ctx.lineTo(W * 0.9, H * 0.14);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(W * 0.9, H * 0.13, 3, 0, Math.PI * 2);
    ctx.fill();
}

export function clearComms() {
    queue.length = 0;
    current = null;
    panel?.classList.add('hidden');
}
