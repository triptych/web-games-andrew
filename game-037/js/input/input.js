// ============================================================
// input/input.js - gestures and keys to intents (GDD §27.2)
// Three ways to move, all present. Nothing is timed. Nothing needs precision.
// ============================================================
import { DIRS8 } from '../core/coords.js';
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';

const KEY_DIRS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0],
  y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
  Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};

export function initInput({ canvas, pad, contextBtn, tools, onMove, onContext, onWait, onPanel, onVerb, onTapTile, onShove, onRest }) {
  // --- keyboard ---
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const key = e.key;
    const dir = KEY_DIRS[key] || KEY_DIRS[e.code];
    if (dir) { e.preventDefault(); onMove(dir[0], dir[1]); return; }
    switch (key) {
      case ' ': case 'Enter': e.preventDefault(); onContext(); break;
      case '.': case '5': onWait(); break;
      case 'i': onPanel('inventory'); break;
      case 'q': onPanel('journal'); break;
      case 'c': onPanel('character'); break;
      case 'm': onPanel('map'); break;
      case 'L': onPanel('ledger'); break;
      case 'g': onVerb('take'); break;
      case 'x': onVerb('examine'); break;
      case 'f': onVerb('douse'); break;
      case 'r': onRest(); break;
      case 'e': onVerb('listen'); break;
      case '>': onVerb('descend'); break;
      case '<': onVerb('ascend'); break;
      case 'Escape': onPanel('close'); break;
      case '1': case '2': case '3': case '4': onVerb('tool' + key); break;
      default: break;
    }
  });

  // --- the virtual stick: drag, tap a sector, or flick ---
  let padActive = false, padStart = null, repeatTimer = null, lastDir = null;
  const stop = () => { padActive = false; lastDir = null; if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; } };

  const dirFromVector = (dx, dy) => {
    const mag = Math.hypot(dx, dy);
    if (mag < 12) return null;
    const a = Math.atan2(dy, dx);
    const oct = Math.round(a / (Math.PI / 4));
    const map = { 0: [1, 0], 1: [1, 1], 2: [0, 1], 3: [-1, 1], '-1': [1, -1], '-2': [0, -1], '-3': [-1, -1], 4: [-1, 0], '-4': [-1, 0] };
    return map[String(oct)] || null;
  };

  if (pad) {
    pad.addEventListener('pointerdown', e => {
      e.preventDefault();
      pad.setPointerCapture(e.pointerId);
      padActive = true;
      const r = pad.getBoundingClientRect();
      padStart = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      handlePad(e);
    });
    pad.addEventListener('pointermove', e => { if (padActive) handlePad(e); });
    pad.addEventListener('pointerup', stop);
    pad.addEventListener('pointercancel', stop);
    pad.addEventListener('lostpointercapture', stop);
  }

  function handlePad(e) {
    const dir = dirFromVector(e.clientX - padStart.x, e.clientY - padStart.y);
    if (!dir) return;
    if (!lastDir || lastDir[0] !== dir[0] || lastDir[1] !== dir[1]) {
      lastDir = dir;
      onMove(dir[0], dir[1]);
      if (repeatTimer) clearInterval(repeatTimer);
      setTimeout(() => {
        if (!padActive) return;
        repeatTimer = setInterval(() => { if (padActive && lastDir) onMove(lastDir[0], lastDir[1]); }, 140);
      }, 260);
    }
  }

  // --- the context button, with a long press for the verb wheel ---
  if (contextBtn) {
    let pressTimer = null, longFired = false;
    contextBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      longFired = false;
      pressTimer = setTimeout(() => { longFired = true; onVerb('wheel'); }, 420);
    });
    const release = () => { clearTimeout(pressTimer); if (!longFired) onContext(); };
    contextBtn.addEventListener('pointerup', e => { e.preventDefault(); release(); });
    contextBtn.addEventListener('pointercancel', () => clearTimeout(pressTimer));
  }

  // --- tools ---
  if (tools) {
    tools.addEventListener('click', e => {
      const btn = e.target.closest('.toolbtn');
      if (!btn || !btn.dataset.tool) return;
      onVerb('usetool:' + btn.dataset.tool);
    });
  }

  // --- tap-to-move on the canvas, and swipe ---
  if (canvas) {
    let downAt = null, downTime = 0;
    canvas.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; downTime = Date.now(); });
    canvas.addEventListener('pointerup', e => {
      if (!downAt) return;
      const dx = e.clientX - downAt.x, dy = e.clientY - downAt.y;
      const dist = Math.hypot(dx, dy);
      const dt = Date.now() - downTime;
      if (dist > 40 && dt < 400) {
        const dir = dirFromVector(dx, dy);
        if (dir) { onMove(dir[0], dir[1]); downAt = null; return; }
      }
      if (dist < 12) {
        const r = canvas.getBoundingClientRect();
        onTapTile((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      }
      downAt = null;
    });
  }
}

/** A radial verb wheel: faster and more forgiving than a list on a phone. */
export function showVerbWheel(host, verbs, onPick) {
  host.hidden = false;
  host.innerHTML = '';
  const wheel = document.createElement('div');
  wheel.className = 'wheel';
  const n = Math.min(8, verbs.length);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const b = document.createElement('button');
    b.className = 'wedge';
    b.textContent = verbs[i];
    b.style.left = `calc(50% + ${Math.cos(a) * 82}px)`;
    b.style.top = `calc(50% + ${Math.sin(a) * 82}px)`;
    b.onclick = () => { host.hidden = true; host.innerHTML = ''; onPick(verbs[i]); };
    wheel.appendChild(b);
  }
  const cancel = document.createElement('button');
  cancel.className = 'wedge centre';
  cancel.textContent = 'Back';
  cancel.onclick = () => { host.hidden = true; host.innerHTML = ''; };
  wheel.appendChild(cancel);
  host.appendChild(wheel);
}
