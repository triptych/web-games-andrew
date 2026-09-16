// ============================================================
// ui/toast.js - one non-modal line, never blocking
// ============================================================
let host = null;

export function initToast(el) { host = el; }

export function toast(text, icon = '') {
  if (!host) return;
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = (icon ? icon + ' ' : '') + text;
  host.appendChild(div);
  setTimeout(() => { div.classList.add('out'); }, 2200);
  setTimeout(() => { div.remove(); }, 2800);
}
