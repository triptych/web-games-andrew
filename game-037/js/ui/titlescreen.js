// ============================================================
// ui/titlescreen.js - seed entry, difficulty, continue (GDD §29 Phase 10)
// With a world-preview thumbnail rendered from the field functions.
// ============================================================
import { UI_TEXT } from '../data/text.js';
import { DIFFICULTY } from '../data/constants.js';
import { randomSeedString, normalizeSeedString, makeMasterSeed } from '../core/seed.js';
import { readHeader, deleteSave } from '../world/save.js';
import { calibrateElevation, rawElevationAt, elevationAt, biomeAt } from '../gen/fields.js';
import { BIOMES } from '../data/biomes.js';
import { hsl } from '../render/palette.js';

let host = null;

export function initTitle(el) { host = el; }

export function showTitle({ onNew, onContinue }) {
  host.hidden = false;
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'title';

  const h1 = document.createElement('h1');
  h1.textContent = UI_TEXT.title;
  const tag = document.createElement('p');
  tag.className = 'tagline';
  tag.textContent = UI_TEXT.tagline;
  wrap.append(h1, tag);

  const header = readHeader('auto');
  if (header) {
    const cont = document.createElement('button');
    cont.className = 'primary';
    cont.textContent = `${UI_TEXT.continueGame} — ${header.place || header.seed}, day ${header.day}`;
    cont.onclick = () => onContinue(header);
    wrap.appendChild(cont);
    const del = document.createElement('button');
    del.className = 'ghost small';
    del.textContent = 'Delete that journey';
    del.onclick = async () => {
      if (!confirm('Delete the saved journey? This cannot be undone.')) return;
      await deleteSave('auto');
      showTitle({ onNew, onContinue });
    };
    wrap.appendChild(del);
  }

  const form = document.createElement('div');
  form.className = 'seedform';
  const label = document.createElement('label');
  label.textContent = 'Seed';
  label.htmlFor = 'seed-input';
  const input = document.createElement('input');
  input.id = 'seed-input';
  input.type = 'text';
  input.maxLength = 64;
  input.value = randomSeedString();
  input.autocomplete = 'off';
  const hint = document.createElement('small');
  hint.textContent = UI_TEXT.seedHint;
  const reroll = document.createElement('button');
  reroll.className = 'ghost small';
  reroll.textContent = 'Another';
  form.append(label, input, reroll, hint);
  wrap.appendChild(form);

  const preview = document.createElement('canvas');
  preview.width = 192; preview.height = 192;
  preview.className = 'preview';
  wrap.appendChild(preview);

  const diffWrap = document.createElement('div');
  diffWrap.className = 'difficulty';
  let difficulty = 'keeper';
  for (const key of ['wanderer', 'keeper', 'longNight', 'noWake']) {
    const b = document.createElement('button');
    b.textContent = DIFFICULTY[key].label;
    b.className = key === difficulty ? '' : 'ghost';
    b.onclick = () => {
      difficulty = key;
      [...diffWrap.children].forEach(c => c.className = c === b ? '' : 'ghost');
      blurb.textContent = DIFF_BLURB[key];
    };
    diffWrap.appendChild(b);
  }
  const blurb = document.createElement('small');
  blurb.className = 'muted';
  blurb.textContent = DIFF_BLURB.keeper;
  wrap.append(diffWrap, blurb);

  const go = document.createElement('button');
  go.className = 'primary';
  go.textContent = UI_TEXT.newGame;
  go.onclick = () => onNew(normalizeSeedString(input.value), difficulty);
  wrap.appendChild(go);

  const credits = document.createElement('p');
  credits.className = 'muted small';
  credits.textContent = 'A turn-based tile game about a lantern-keeper. Vanilla HTML, CSS and JavaScript; no assets, no build, works offline.';
  wrap.appendChild(credits);

  host.appendChild(wrap);

  const draw = () => drawPreview(preview, input.value);
  reroll.onclick = () => { input.value = randomSeedString(); draw(); };
  input.oninput = () => { clearTimeout(input._t); input._t = setTimeout(draw, 260); };
  draw();
  return { input };
}

const DIFF_BLURB = {
  wanderer: 'Gentler. Waking costs half. The Quiet spreads slowly.',
  keeper: 'As intended.',
  longNight: 'Harder. Waking costs more, and the Quiet does not wait.',
  noWake: 'Death ends the campaign. The world keeps your Ledger.',
};

export function hideTitle() { if (host) { host.hidden = true; host.innerHTML = ''; } }

/** A 192px thumbnail of the world, straight from the field functions. */
function drawPreview(canvas, seedString) {
  const ctx = canvas.getContext('2d');
  const master = makeMasterSeed(seedString);
  const W = { master, rivers: null, attempt: 0 };
  W.elev = calibrateElevation(W);
  const n = canvas.width;
  const img = ctx.createImageData(n, n);
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const tx = Math.round((px / n) * 1536), ty = Math.round((py / n) * 1536);
      const e = elevationAt(W, tx, ty);
      let r, g, b;
      if (e < 0.30) { r = 74; g = 106; b = 130; }
      else if (e < 0.34) { r = 186; g = 168; b = 124; }
      else {
        const biome = biomeAt(W, tx, ty);
        const B = BIOMES[biome] || BIOMES.meadow;
        const [hh, s, l] = B.ambient;
        const c = hslToRgb(hh, s * 0.7, 0.3 + l * 0.45);
        r = c[0]; g = c[1]; b = c[2];
      }
      const i = (py * n + px) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const f = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [Math.round(f(p, q, h + 1 / 3) * 255), Math.round(f(p, q, h) * 255), Math.round(f(p, q, h - 1 / 3) * 255)];
}
