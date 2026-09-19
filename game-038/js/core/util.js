// ============================================================
// core/util.js - small shared helpers. No game knowledge lives here.
// ============================================================

export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

/** Title Case for generated names, leaving small words alone mid-phrase. */
export function titleCase(s) {
  const small = new Set(['of', 'the', 'and', 'in', 'at', 'on']);
  return String(s).split(' ').map((w, i) =>
    (i > 0 && small.has(w.toLowerCase())) ? w.toLowerCase() : cap(w)).join(' ');
}

/** Element-building sugar. `el('div.card#id', { onclick }, 'text', childNode)` */
export function el(spec, attrs = null, ...children) {
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
  const tag = m[1] || 'div';
  const node = document.createElement(tag);
  if (m[2]) {
    for (const token of m[2].match(/[.#][\w-]+/g) || []) {
      if (token[0] === '.') node.classList.add(token.slice(1));
      else node.id = token.slice(1);
    }
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'onclick') node.addEventListener('click', v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

/** Deterministic structural copy for plain data. */
export const clone = o => JSON.parse(JSON.stringify(o));

/** 1234 -> "1,234" */
export const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "a, b and c" */
export function listJoin(items) {
  const a = items.filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}

export const pct = (a, b) => b > 0 ? clamp(a / b, 0, 1) : 0;

/** A sortable, readable id. */
let idCounter = 0;
export function uid(prefix = 'x') {
  idCounter++;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Trailing-edge throttle used for autosave and resize. */
export function throttle(fn, ms) {
  let last = 0, timer = null;
  return (...args) => {
    const now = Date.now();
    const wait = ms - (now - last);
    clearTimeout(timer);
    if (wait <= 0) { last = now; fn(...args); }
    else timer = setTimeout(() => { last = Date.now(); fn(...args); }, wait);
  };
}
