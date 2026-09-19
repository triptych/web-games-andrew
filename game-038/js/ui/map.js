// ============================================================
// ui/map.js - the region map and what you do when you get there
// The map is drawn as pixel art on a canvas sized to the viewport; nodes
// are tappable, and everything on it is also reachable from the list below,
// so the map is never the only way to do anything.
// ============================================================
import { el, $, clear, cap } from '../core/util.js';
import { bus } from '../core/bus.js';
import { state, visit, partyDragons, livingParty, dragonById, hasItem, flag } from '../game/state.js';
import { NODES, REGIONS, NODE_IDS, node as nodeOf, region as regionOf, neighbours, ADJACENCY } from '../data/world.js';
import { registerScreen, show, toast, screenHeader, confirmDialog, openOverlay, closeOverlay, infoDialog, emptyState, refresh, elementTag } from './shell.js';
import * as adv from '../game/adventure.js';
import { availableSideQuests, acceptQuest, isActive, isDone } from '../game/quests.js';
import { BOSSES } from '../data/bosses.js';
import { NPCS } from '../data/story.js';
import { TRAITS } from '../data/traits.js';
import { sfx, playMusic, unlock } from '../audio.js';
import { ITEMS } from '../data/items.js';
import { maxHp } from '../gen/dragon.js';

const KIND_LABEL = { home: 'Home', town: 'Town', wild: 'Wilds', roost: 'Roost', landmark: 'Landmark', spire: 'Spire' };

/**
 * You know a place by name once you have been there, or once you are
 * standing somewhere that the road to it leaves from. Being unable to read
 * the signpost you are standing under is mystery for its own sake.
 */
const known = (id) => state.visited.includes(id) || neighbours(id).some(n => state.visited.includes(n));

// ------------------------------------------------------------- map canvas --
function drawMap(canvas) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0f0c0b';
  ctx.fillRect(0, 0, W, H);

  const px = (x) => Math.round(8 + (x / 100) * (W - 16));
  const py = (y) => Math.round(8 + (y / 100) * (H - 16));

  // region washes, drawn as chunky dithered blocks rather than gradients
  for (const r of Object.values(REGIONS)) {
    const ids = NODE_IDS.filter(id => NODES[id].region === r.id);
    if (!ids.length) continue;
    const xs = ids.map(id => px(NODES[id].x)), ys = ids.map(id => py(NODES[id].y));
    const x0 = Math.min(...xs) - 12, x1 = Math.max(...xs) + 12;
    const y0 = Math.min(...ys) - 12, y1 = Math.max(...ys) + 12;
    ctx.fillStyle = r.colour + '1c';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let y = y0; y < y1; y += 4) for (let x = x0 + (y % 8 ? 2 : 0); x < x1; x += 4) {
      ctx.fillStyle = r.colour + '10';
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // roads
  ctx.lineWidth = 2;
  for (const id of NODE_IDS) {
    for (const other of ADJACENCY[id]) {
      if (id > other) continue;
      const a = NODES[id], b = NODES[other];
      const walked = state.visited.includes(id) || state.visited.includes(other);
      ctx.strokeStyle = walked ? '#4a3a31' : '#26201c';
      ctx.setLineDash(walked ? [] : [3, 4]);
      ctx.beginPath();
      ctx.moveTo(px(a.x), py(a.y));
      ctx.lineTo(px(b.x), py(b.y));
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // nodes
  for (const id of NODE_IDS) {
    const n = NODES[id];
    const seen = known(id);
    const reachable = neighbours(state.node).includes(id) && (n.act || 1) <= state.act;
    const here = state.node === id;
    const x = px(n.x), y = py(n.y);
    const size = n.kind === 'town' || n.kind === 'home' ? 9 : n.kind === 'spire' ? 10 : 7;

    ctx.fillStyle = !seen && !reachable ? '#2a2320'
      : n.kind === 'spire' ? '#9d7fd0'
      : n.kind === 'roost' ? '#e05a4a'
      : n.kind === 'town' || n.kind === 'home' ? '#f2c94c'
      : n.kind === 'landmark' ? '#58a9d6' : '#7fc96a';
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.strokeStyle = '#120d0b';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);

    if (here) {
      ctx.strokeStyle = '#ff8a3d';
      ctx.lineWidth = 2;
      const t = size + 6;
      ctx.strokeRect(x - t / 2, y - t / 2, t, t);
    } else if (reachable) {
      ctx.strokeStyle = '#ffffff55';
      ctx.lineWidth = 1;
      const t = size + 4;
      ctx.strokeRect(x - t / 2, y - t / 2, t, t);
    }
  }

  // labels for places you know of
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  for (const id of NODE_IDS) {
    if (!known(id)) continue;
    const n = NODES[id];
    ctx.fillStyle = state.node === id ? '#ff8a3d' : '#8d7f73';
    ctx.fillText(n.name.replace(/^The /, ''), px(n.x), py(n.y) - 9);
  }
}

function mapCanvas() {
  const canvas = el('canvas#mapcanvas', { width: 480, height: 400 });
  const redraw = () => drawMap(canvas);
  requestAnimationFrame(redraw);
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const my = ((e.clientY - rect.top) / rect.height) * canvas.height;
    let best = null, bestD = 22;
    for (const id of NODE_IDS) {
      const n = NODES[id];
      const x = 8 + (n.x / 100) * (canvas.width - 16);
      const y = 8 + (n.y / 100) * (canvas.height - 16);
      const d = Math.hypot(mx - x, my - y);
      if (d < bestD) { bestD = d; best = id; }
    }
    if (best) tryTravel(best);
  });
  return canvas;
}

function tryTravel(id) {
  unlock();
  if (id === state.node) { show('place'); return; }
  const check = adv.canTravel(id);
  if (!check.ok) { sfx.error(); toast(check.why, 'bad'); return; }
  adv.travelTo(id);
  sfx.step();
  const n = nodeOf(id);
  playMusic(n.kind === 'town' || n.kind === 'home' ? 'town' : 'field');
  show('place');
}

// ------------------------------------------------------------ map screen --
registerScreen('map', () => {
  const here = nodeOf(state.node);
  const wrap = el('div', null,
    screenHeader('The Road', `${regionOf(here.region).name} · ${regionOf(here.region).blurb}`),
    el('div.map-wrap', null, mapCanvas()),
    el('div.map-legend', null,
      el('span', { style: { color: '#f2c94c' } }, 'Town'),
      el('span', { style: { color: '#7fc96a' } }, 'Wilds'),
      el('span', { style: { color: '#e05a4a' } }, 'Roost'),
      el('span', { style: { color: '#58a9d6' } }, 'Landmark'),
      el('span', { style: { color: '#9d7fd0' } }, 'Spire')),
    el('div.sep'),
    el('h2', null, 'Here'),
    nodeRow(state.node, true),
    el('h2', { style: { marginTop: '14px' } }, 'From here you can walk to'),
    el('div.node-list', null, ...neighbours(state.node).map(id => nodeRow(id, false))));
  return wrap;
});

function nodeRow(id, isHere) {
  const n = nodeOf(id);
  const locked = (n.act || 1) > state.act;
  return el(`div.card.clickable.node-row${locked ? '.locked' : ''}`, {
    onclick: () => isHere ? show('place') : tryTravel(id),
  },
    el('div.grow', null,
      el('div.name', null, known(id) ? n.name : '???'),
      el('div.kind', null, `${KIND_LABEL[n.kind] || n.kind} · ${regionOf(n.region).name}${locked ? ' · locked' : ''}`)),
    el('span.chip', null, isHere ? 'Here' : locked ? '✖' : '→'));
}

// ---------------------------------------------------------- place screen --
registerScreen('place', () => {
  const n = nodeOf(state.node);
  const r = regionOf(n.region);
  const services = n.services || [];
  const actions = [];

  if (n.kind === 'wild' || n.kind === 'landmark' || n.kind === 'roost' || n.kind === 'spire') {
    actions.push(action('Explore', 'Walk out and see what is here.', () => doExplore()));
  }
  if (n.kind === 'roost' || n.kind === 'spire') {
    actions.push(action(n.boss ? 'Go down' : 'Delve', n.boss
      ? 'Something is waiting at the bottom of this one.'
      : 'A short run: a few fights, and whatever is at the end.',
      () => startRoost()));
  }
  if (services.includes('rest') || n.home) {
    const cost = n.home ? 0 : Math.round(20 + adv.partyLevel() * 4);
    actions.push(action('Rest', n.home ? 'Sleep at the Broodwell. Everything heals; bonds grow.' : `An inn bed. ${cost} coin.`, () => {
      const res = adv.rest();
      if (!res.ok) { sfx.error(); toast(res.why, 'bad'); return; }
      sfx.heal();
      toast(res.cost ? `Rested. −${res.cost} coin.` : 'Rested.', 'good');
      refresh();
    }));
  }
  if (services.includes('shop')) actions.push(action('Shop', 'Buy and sell.', () => show('shop')));
  if (services.includes('forge')) actions.push(action('Forge', "Darrow will make anything once, for parts.", () => show('forge')));
  if (services.includes('brood') || n.home) actions.push(action('The hatchery', 'Pair two dragons, and tend what is in the warm room.', () => show('broodwell')));
  if (services.includes('board')) actions.push(action('Notice board', 'Work, posted by people with problems.', () => show('board')));

  const npcs = Object.values(NPCS).filter(p => p.node === state.node);
  for (const npc of npcs) {
    const quests = availableSideQuests(state.node).filter(q => q.giver === npc.id);
    actions.push(action(`Talk to ${npc.name}`, npc.blurb + (quests.length ? ' — has something to ask.' : ''), () => talkTo(npc)));
  }

  return el('div', null,
    screenHeader(n.name, `${KIND_LABEL[n.kind] || n.kind} · ${r.name}`,
      el('button.btn.small', { onclick: () => show('map') }, 'Map')),
    el('div.card', null, el('p.dim', null, n.blurb || '')),
    partyStrip(),
    el('div.stack', null, ...actions));
});

function action(title, blurb, onClick) {
  return el('button.btn.wide', { onclick: () => { unlock(); sfx.ui(); onClick(); } },
    el('div', { style: { textAlign: 'left', width: '100%' } },
      el('div', null, title),
      el('div.faint', null, blurb)));
}

function partyStrip() {
  const party = partyDragons();
  if (!party.length) return el('div.card', null, el('p.bad', null, 'You have no dragons in the party. Go to the Brood and pick some.'));
  return el('div.card.tight', null,
    el('div.row', { style: { gap: '10px' } }, ...party.map(d =>
      el('div.grow', { style: { minWidth: 0 } },
        el('div.truncate', { style: { fontSize: '11px' } }, d.name),
        el('div.faint', null, `${d.hp}/${maxHp(d)}`),
        el('div.bar.thin', null, el('i', { style: { width: (d.hp / maxHp(d) * 100) + '%' } }))))));
}

// ------------------------------------------------------------- exploring --
function doExplore() {
  if (!livingParty().length) { sfx.error(); toast('Every dragon you have is out cold.', 'bad'); return; }
  const ev = adv.explore();
  if (ev.kind === 'battle') {
    playMusic('battle');
    show('battle', { encounter: ev.encounter, onDone: () => show('place') });
    return;
  }
  if (ev.kind === 'forage') {
    sfx.coin();
    infoDialog('You find something', el('div', null,
      el('p.dim', null, ev.text),
      ...ev.items.map(id => el('div.reward-line', null, `➕ ${ITEMS[id].name}`))));
    return;
  }
  if (ev.kind === 'vignette') return showVignette(ev.vignette);
  toast(ev.text || 'Nothing out here.');
}

function showVignette(v) {
  const body = el('div', null, el('p', null, v.text), el('div.choice-list'));
  const list = body.querySelector('.choice-list');
  v.choices.forEach((c, i) => {
    const req = c.requires || {};
    const blocked = (req.item && !hasItem(req.item)) || (req.coin && state.coin < req.coin);
    list.append(el('button.btn.wide', {
      disabled: blocked,
      onclick: () => {
        const res = adv.resolveVignette(v, i);
        closeOverlay();
        if (!res.ok) { sfx.error(); toast(res.why, 'bad'); return; }
        sfx.confirm();
        if (res.lines.length) infoDialog('—', el('div', null, ...res.lines.map(l => el('p.dim', null, l))));
        refresh();
      },
    }, el('div', { style: { width: '100%', textAlign: 'left' } },
      el('div', null, c.text),
      blocked ? el('div.locked-why', null, req.item ? `You need a ${ITEMS[req.item].name}.` : `You need ${req.coin} coin.`) : null)));
  });
  openOverlay(el('div', null, el('h2', null, 'On the road'), body), { dismissable: false });
}

// ---------------------------------------------------------------- roosts --
function startRoost() {
  if (!livingParty().length) { sfx.error(); toast('Not with the brood in this state.', 'bad'); return; }
  const res = adv.enterRoost();
  if (!res.ok) { toast(res.why, 'bad'); return; }
  show('roost');
}

registerScreen('roost', () => {
  const run = state.roost;
  if (!run) { show('place'); return el('div'); }
  const room = adv.roostRoom();
  const n = nodeOf(run.nodeId);
  const progress = `Room ${run.index + 1} of ${run.rooms.length}`;

  const body = el('div.stack');
  if (!room) {
    adv.leaveRoost();
    show('place');
    return el('div');
  }
  if (room.kind === 'battle') {
    body.append(el('p.dim', null, room.elite ? 'Something bigger is in here.' : room.encounter.intro));
    body.append(el('button.btn.wide.primary', {
      onclick: () => {
        playMusic('battle');
        show('battle', { encounter: room.encounter, onDone: (report) => {
          if (report && report.won) { adv.roostAdvance(); show('roost'); }
          else { adv.leaveRoost(); show('place'); }
        } });
      },
    }, 'Fight'));
  } else if (room.kind === 'treasure') {
    body.append(el('p.dim', null, 'A cache, tucked into the rock where the nesting used to be.'));
    body.append(el('button.btn.wide.primary', {
      onclick: () => {
        const got = adv.openTreasure();
        sfx.coin();
        infoDialog('In the cache', el('div', null,
          el('div.reward-line', null, `➕ ${ITEMS[got.item].name}`),
          el('div.reward-line.gold', null, `● ${got.coin} coin`)),
          () => { adv.roostAdvance(); show('roost'); });
      },
    }, 'Open it'));
  } else if (room.kind === 'boss') {
    const def = BOSSES[room.bossId];
    body.append(el('p.dim', null, def.intro));
    if (flag(`met_${room.bossId}`)) {
      // You have been down here before. Say what you learned the hard way.
      const traits = (def.traits || []).map(t => TRAITS[t]).filter(Boolean);
      body.append(el('div.card.tight', null,
        el('div.faint', null, 'You have met this one before.'),
        el('div.row.wrap', { style: { marginTop: '4px' } },
          el('span.faint', null, `${def.name} is`),
          elementTag(def.elements[0]),
          def.elements[1] ? elementTag(def.elements[1]) : null,
          el('span.faint', null, `\u00b7 Lv ${def.level}`)),
        ...traits.map(t => el('div.faint', null, `\u2022 ${t.name}: ${t.desc}`))));
    }
    body.append(el('button.btn.wide.primary', {
      onclick: () => {
        playMusic('boss');
        const r = adv.startBossBattle(room.bossId);
        if (!r.ok) { toast(r.why, 'bad'); return; }
        show('battle', { existing: r.battle, bossId: room.bossId, onDone: (report) => {
          if (report && report.won) { adv.roostAdvance(); show('roost'); }
          else { adv.leaveRoost(); show('place'); }
        } });
      },
    }, `Face ${def.name}`));
  }

  body.append(el('button.btn.wide', {
    onclick: () => confirmDialog({
      title: 'Turn back?',
      body: 'You keep what you have found. The roost will be different next time.',
      confirmText: 'Climb out',
      onConfirm: () => { adv.leaveRoost(); show('place'); },
    }),
  }, 'Turn back'));

  return el('div', null,
    screenHeader(n.name, progress),
    partyStrip(),
    body);
});

// ----------------------------------------------------------------- board --
registerScreen('board', () => {
  const jobs = adv.boardFor(state.node);
  return el('div', null,
    screenHeader('Notice board', 'Work, posted by people with problems.',
      el('button.btn.small', { onclick: () => show('place') }, 'Back')),
    jobs.length ? el('div.stack', null, ...jobs.map(q =>
      el('div.card.quest-card.board', null,
        el('div.row.spread', null, el('strong', null, q.title), el('span.gold', null, `●${q.reward.coin}`)),
        el('p.dim', { style: { fontSize: '12px', margin: '6px 0' } }, q.detail),
        el('div.faint', null, 'Pays: ' + q.reward.items.map(i => ITEMS[i].name).join(', ')),
        el('button.btn.small.primary', {
          style: { marginTop: '8px' },
          onclick: () => {
            acceptQuest({ ...q, kind: 'board' });
            sfx.confirm();
            toast('Taken on.', 'good');
            refresh();
          },
        }, 'Take it')))) : emptyState('Nothing posted. Come back when the act turns.'));
});

// ------------------------------------------------------------------- npc --
function talkTo(npc) {
  const quests = availableSideQuests(state.node).filter(q => q.giver === npc.id);
  const body = el('div', null, el('p.dim', null, npc.blurb));
  if (!quests.length) body.append(el('p', null, '“Nothing for you today, Warden. Mind how you go.”'));
  for (const q of quests) {
    body.append(el('div.card', null,
      el('strong', null, q.title),
      el('p.dim', { style: { fontSize: '12px' } }, q.detail),
      el('div.faint', null, `Pays ●${q.reward.coin}` + (q.reward.items ? ' and ' + q.reward.items.map(i => ITEMS[i].name).join(', ') : '')),
      el('button.btn.small.primary', {
        style: { marginTop: '8px' },
        onclick: () => { acceptQuest({ ...q, kind: 'side' }); sfx.confirm(); closeOverlay(); toast('Taken on.', 'good'); refresh(); },
      }, 'Take it')));
  }
  body.append(el('button.btn.wide', { onclick: closeOverlay }, 'Leave it there'));
  openOverlay(el('div', null, el('h2', null, npc.name), body));
}
