// ============================================================
// ui/scene.js - story scenes and the ending choice (GDD 2)
// The runner has already applied whatever the scene changes; this only
// shows it. A scene can therefore never be "missed".
// ============================================================
import { el } from '../core/util.js';
import { bus } from '../core/bus.js';
import { state } from '../game/state.js';
import { openOverlay, closeOverlay, show, toast, refresh } from './shell.js';
import { nextScene, finishScene, hasPending, endingAvailability, chooseEnding } from '../game/scenes.js';
import { sfx, playMusic } from '../audio.js';

let showing = false;

/** Drain the queue, one scene at a time, oldest first. */
export function playPending(after = null) {
  if (showing) return;
  const entry = nextScene();
  if (!entry) { after && after(); return; }
  showing = true;
  playScene(entry.scene, () => {
    showing = false;
    finishScene(entry);
    playPending(after);
  });
}

function playScene(scene, done) {
  let i = 0;
  const body = el('div.scene');
  const nav = el('div.scene-nav');
  const host = el('div', null, body, nav);

  const renderLine = () => {
    const line = scene.lines[i];
    body.append(el('div', null,
      line.who ? el('div.who', null, line.who === 'you' ? state.wardenName : line.who) : null,
      el('div.line', { html: formatText(line.text) })));
    host.scrollIntoView?.({ block: 'end' });
    const overlay = document.querySelector('.overlay-inner');
    if (overlay) overlay.scrollTop = overlay.scrollHeight;
  };

  const advance = () => {
    i++;
    if (i < scene.lines.length) { sfx.ui(); renderLine(); updateNav(); return; }
    if (scene.choices) return renderChoices();
    closeOverlay();
    done();
  };

  const updateNav = () => {
    nav.replaceChildren();
    const last = i >= scene.lines.length - 1;
    // On the last line of a scene that asks something, the question IS the
    // navigation. Without this the player reads the final line and is left
    // with no button at all.
    if (last && scene.choices) return renderChoices();
    nav.append(el('button.btn.wide.primary', { onclick: advance }, last ? 'Go on' : 'Next'));
    if (!last && scene.lines.length > 2) {
      nav.append(el('button.btn.small', {
        onclick: () => { while (i < scene.lines.length - 1) { i++; renderLine(); } updateNav(); },
      }, 'All of it'));
    }
  };

  const renderChoices = () => {
    nav.replaceChildren();
    const avail = endingAvailability();
    const list = el('div.choice-list');
    for (const c of scene.choices) {
      const locked = c.requires && !avail[c.requires];
      list.append(el('button.btn.wide', {
        disabled: locked,
        onclick: () => {
          const res = chooseEnding(c.id);
          if (!res.ok) { toast(res.why, 'bad'); return; }
          closeOverlay();
          done();
          playPending(() => show('title'));
        },
      }, el('div', { style: { width: '100%', textAlign: 'left' } },
        el('div', null, c.text),
        locked ? el('div.locked-why', null, c.locked) : null)));
    }
    nav.append(list);
  };

  renderLine();
  updateNav();
  if (scene.ending) playMusic('town');
  openOverlay(host, { dismissable: false });
}

/** *emphasis* is the only markup a scene needs. */
function formatText(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

export function wireSceneUI() {
  bus.on('scene:queued', () => setTimeout(() => playPending(), 60));
}
