// ================= procedural UI art =================
function flakeSVG(seed = 1, size = 24, stroke = '#fff', sw = 2) {
  const R = mulberry32(seed * 7919 + 3); let d = 'M0 0 L0 -10'; const b = 1 + Math.floor(R() * 3);
  for (let i = 0; i < b; i++) { const t = 3 + i * 2.6 + R() * 1.2, l = 1.8 + R() * 2.4; d += ` M0 ${(-t).toFixed(1)} l${l.toFixed(1)} ${(-l * 0.9).toFixed(1)} M0 ${(-t).toFixed(1)} l${(-l).toFixed(1)} ${(-l * 0.9).toFixed(1)}`; }
  if (R() > 0.5) d += ' M-1.6 -9.6 L0 -11.4 L1.6 -9.6';
  let g = ''; for (let k = 0; k < 6; k++) g += `<path d="${d}" transform="rotate(${k * 60})"/>`;
  return `<svg viewBox="-12.5 -12.5 25 25" width="${size}" height="${size}" aria-hidden="true"><g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${g}</g></svg>`;
}
const FLAKE = (s = 18) => flakeSVG(7, s, '#cfe9ff', 2.2);
function svgURI(svg) { return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`; }
function snowCap(seed) {
  const R = mulberry32(seed + 101), W = 400; let top = 'M0 34 L0 18 ';
  let x = 0; while (x < W) { const w = 22 + R() * 34, h = 4 + R() * 12; top += `Q${(x + w / 2).toFixed(1)} ${(18 - h).toFixed(1)} ${Math.min(W, x + w).toFixed(1)} ${(16 + R() * 4).toFixed(1)} `; x += w; }
  top += `L${W} 34 `;
  x = W; while (x > 0) { const gap = 14 + R() * 40; x -= gap; if (x < 10) break; const w = 8 + R() * 14, l = 5 + R() * 13; top += `L${(x + w).toFixed(1)} 34 Q${(x + w).toFixed(1)} ${(34 + l).toFixed(1)} ${(x + w / 2).toFixed(1)} ${(34 + l).toFixed(1)} Q${x.toFixed(1)} ${(34 + l).toFixed(1)} ${x.toFixed(1)} 34 `; }
  top += 'L0 34 Z';
  return svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 52" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9ecff"/></linearGradient></defs><path d="${top}" fill="url(#g)"/></svg>`);
}
function icicles(seed) {
  const R = mulberry32(seed), W = 600; let d = '';
  for (let x = 6; x < W - 6; x += 9 + R() * 16) { const w = 5 + R() * 8, l = 6 + R() * 24; d += `M${x.toFixed(1)} 0 L${(x + w / 2).toFixed(1)} ${l.toFixed(1)} L${(x + w).toFixed(1)} 0 Z `; }
  return `<svg class="icicles" viewBox="0 0 ${W} 32" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="#d6efff" opacity=".9"/></svg>`;
}
const ICONS = {
  power: `<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true"><path d="M14 44V22a6 6 0 0 1 12 0" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M14 44V22a6 6 0 0 1 12 0" fill="none" stroke="#e8364f" stroke-width="7" stroke-dasharray="4 5" stroke-linecap="butt"/><path d="M34 44V22a6 6 0 0 0-12 0" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".001"/><path d="M26 16 L42 6" stroke="#ffc94a" stroke-width="3" stroke-linecap="round"/><circle cx="40" cy="9" r="6" fill="#eaf5ff"/><path d="M30 14l4 1M31 9l3 2" stroke="#a9dcff" stroke-width="2" stroke-linecap="round"/></svg>`,
  bounce: `<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true"><path d="M4 40c4-18 10-18 14 0c3-11 8-11 11 0c2-6 5-6 7 0" fill="none" stroke="#a9dcff" stroke-width="2.5" stroke-dasharray="3 3"/><rect x="2" y="40" width="44" height="6" rx="3" fill="#eaf5ff"/><circle cx="38" cy="33" r="7" fill="#fff"/><circle cx="36" cy="31" r="2" fill="#cfe6ff"/></svg>`,
  aero: `<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true"><path d="M4 18h14M2 26h18M6 34h12" stroke="#a9dcff" stroke-width="3" stroke-linecap="round"/><path d="M33 6l11 18-11 18-11-18z" fill="#bfe9ff" stroke="#fff" stroke-width="2"/><path d="M33 6v36M22 24h22" stroke="#7fc0ee" stroke-width="1.5"/></svg>`,
  slam: `<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true"><g transform="translate(24 15)">${flakeSVG(3, 26, '#fff', 2.4).replace(/^<svg[^>]*>|<\/svg>$/g, '').replace('<g ', '<g transform="scale(1.05)" ')}</g><path d="M24 30v12M17 36l7 7 7-7" fill="none" stroke="#ffc94a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  magnet: `<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true"><path d="M10 8v16a14 14 0 0 0 28 0V8h-9v16a5 5 0 0 1-10 0V8z" fill="#e8364f"/><rect x="10" y="8" width="9" height="6" fill="#eaf5ff"/><rect x="29" y="8" width="9" height="6" fill="#eaf5ff"/><path d="M42 4l-3 4M44 12l-4 1M6 4l3 4" stroke="#ffc94a" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  luck: `<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true"><path d="M16 6h16v20l-6 14c-2 5-9 6-13 3s-4-8-1-11l4-6z" fill="#e8364f"/><rect x="14" y="4" width="20" height="8" rx="3" fill="#f4f8ff"/><path d="M18 22h12" stroke="#2a9d74" stroke-width="3"/><circle cx="36" cy="14" r="4" fill="#ffc94a"/><path d="M36 6v-2M42 14h2M40 9l2-2" stroke="#ffc94a" stroke-width="2" stroke-linecap="round"/></svg>`,
};
const UPG = [
  { id: 'power', name: 'Spring Coil', desc: 'A stronger candy-cane slingshot.', max: 12, base: 20 },
  { id: 'bounce', name: 'Packed Snow', desc: 'Bouncier landings, less skidding.', max: 10, base: 26 },
  { id: 'aero', name: 'Polished Ice', desc: 'Slip through the air and roll farther.', max: 10, base: 30 },
  { id: 'slam', name: 'Flurry Slam', desc: 'One more mid-air slam per fling.', max: 5, base: 60 },
  { id: 'magnet', name: 'Frost Magnet', desc: 'Pull in snowflakes from farther away.', max: 8, base: 22 },
  { id: 'luck', name: 'Lucky Stocking', desc: 'More presents, elves and golden bells.', max: 8, base: 34 },
];
const upgCost = (u, lvl) => Math.round(u.base * Math.pow(1.45, lvl));
const TIPS = [
  'Tap in mid-air to slam down. Slamming into the snow gives a huge bounce.',
  'Golden bells refill one slam and give 10 snowflakes.',
  'Hot cocoa and lumps of coal eat your speed. Bounce over them.',
  'Stop the needle in the dashed zone for a Perfect fling: 12% more speed.',
  'Chain three boosts without touching the snow for combo snowflakes.',
  'Slam straight into a present or gumdrop for a Slam Combo.',
  'From level 4, flying sleighs give free rides. Aim high!',
  'Spring Coil makes every launch stronger. It is the best first upgrade.',
];

// ================= HUD =================
const hudEl = $('#hud'), meterEl = $('#meter'), needleEl = $('#needle'), tapEl = $('#tapPrompt'), slamsEl = $('#slams'), tipEl = $('#tip'), bonusHudEl = $('#bonusHud');
$('#flakeIcon').innerHTML = FLAKE(18);
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; document.getElementById(id).textContent = v; } }
function hideAllHud() { hudEl.hidden = meterEl.hidden = tapEl.hidden = slamsEl.hidden = tipEl.hidden = bonusHudEl.hidden = true; }
function showTip(t) { tipEl.textContent = t; tipEl.hidden = false; }
function hideTip() { tipEl.hidden = true; }
function setupHudLevel() { setText('lvlNum', String(save.level)); setText('biomeChip', biome.name); }
function showAimHud() {
  hideAllHud(); hudEl.hidden = false; meterEl.hidden = false; tapEl.hidden = false; setupHudLevel(); updateFlightHud(true);
  tapEl.textContent = matchMedia('(pointer:coarse)').matches ? 'Tap to fling!' : 'Click or press Space to fling!';
  if (save.runs < 2) showTip('Stop the needle in the dashed zone for a Perfect fling.');
}
function showFlightHud() {
  meterEl.hidden = true; tapEl.hidden = true; hideTip(); slamsEl.hidden = false; updateSlamPips();
  if (!save.seenSlam) setTimeout(() => { if (mode === 'flight' && !save.seenSlam) showTip('Tap in mid-air to SLAM down. Slam into the snow for a huge bounce!'); }, 1300);
}
function updateMeter() { needleEl.style.bottom = (F.power * 100).toFixed(1) + '%'; }
function updateSlamPips() {
  const el = $('#slamPips'); let h = '';
  for (let i = 0; i < P.maxSlams; i++) h += `<div class="pip${i < P.slams ? '' : ' used'}">${flakeSVG(11 + i, 22, '#fff', 2.4)}</div>`;
  el.innerHTML = h; setText('slamLbl', P.slams > 0 ? 'TAP TO SLAM' : 'NO SLAMS LEFT');
}
function updateFlightHud(force) {
  const d = Math.max(0, Math.floor(P.dist));
  if (force || hudCache.dist !== d) { hudCache.dist = d; $('#dist').innerHTML = `${fmt(d)}<span class="u">m</span>`; }
  setText('flakeNum', '+' + fmt(P.collected));
  const max = Math.max(F.target * 1.25, save.best * 1.05, P.dist * 1.02, 10);
  const pct = v => clamp(v / max * 100, 0, 100).toFixed(1) + '%';
  $('#trackFill').style.width = pct(P.dist); $('#trackBall').style.left = pct(P.dist);
  $('#trackGoal').style.left = pct(F.target);
  const b = $('#trackBest'); b.hidden = save.best < 5; b.style.left = pct(save.best);
}
function updateBonusHud() {
  setText('timerNum', String(Math.ceil(B.time)));
  $('#timerArc').style.strokeDashoffset = (169.6 * (1 - B.time / BONUS_TIME)).toFixed(1);
  setText('sizeNum', (B.R * 2).toFixed(2) + ' m'); setText('countNum', fmt(B.count));
}
function ticker(text) { const el = $('#ticker'); const d = document.createElement('div'); d.textContent = '+ ' + text; el.prepend(d); while (el.childElementCount > 4) el.lastElementChild.remove(); setTimeout(() => d.remove(), 2200); }
function banner(text) { const w = $('#bannerWrap'); w.innerHTML = ''; const b = document.createElement('div'); b.id = 'banner'; b.textContent = text; w.appendChild(b); setTimeout(() => b.remove(), 2700); }

// ================= screens =================
const screensEl = $('#screens');
function showScreen(html, cls = 'dim') {
  screensEl.innerHTML = `<div class="screen ${cls}">${html}</div>`;
  const s = screensEl.firstElementChild;
  s.querySelectorAll('.panel').forEach(p => p.style.setProperty('--cap', snowCap(Math.floor(rnd() * 9999))));
  const f = s.querySelector('[data-focus]') || s.querySelector('.btn');
  if (f && !matchMedia('(pointer:coarse)').matches) setTimeout(() => f.focus({ preventScroll: true }), 60);
  return s;
}
function hideScreen() { screensEl.innerHTML = ''; }
const soundIcon = () => save.muted
  ? `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7h3l5-4v14l-5-4H3z" fill="currentColor"/><path d="M14 7l4 6M18 7l-4 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
  : `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7h3l5-4v14l-5-4H3z" fill="currentColor"/><path d="M14 6.5a5 5 0 0 1 0 7M16.5 4a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const letters = w => [...w].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');

function gotoTitle() {
  paused = false; hideAllHud(); clearBonus(); ballRoot.visible = false;
  applyBiome(biomeFor(save.level)); resetFling(); mode = 'title';
  const f = FORMS[formFor(save.level)];
  const play = save.pendingBonus ? 'Snowball Bonanza!' : `Play · Level ${save.level}`;
  showScreen(`<div class="title">
    <div><h1 class="logo" aria-label="Frosty Fling"><span class="w w1">${letters('Frosty')}</span>${icicles(42)}<span class="w w2">${letters('Fling')}</span></h1>
    <p class="tagline">Fling a snowball, bounce off presents, and grow it into the snowman of the season.</p></div>
    <div class="title-foot">
      <div class="btn-row" style="margin-top:0"><button class="btn" data-act="play" data-focus>${play}</button><button class="btn ice" data-act="shop">Upgrades</button><button class="iconbtn" data-act="mute" aria-label="Toggle sound" style="width:52px;height:52px">${soundIcon()}</button></div>
      <div class="title-stats"><span class="chip">${FLAKE(16)} ${fmt(save.flakes)}</span><span class="chip"><small>Best</small> ${fmt(save.best)} m</span><span class="chip"><small>Form</small> ${f.name}</span></div>
      <button class="link" data-act="reset">Reset progress</button>
    </div></div>`, 'clear');
}
function startLevel() {
  hideScreen(); paused = false; clearBonus(); ballRoot.visible = false;
  applyBiome(biomeFor(save.level)); resetFling(); mode = 'aim';
  Sfx.setTempo(138); showAimHud();
}
function endRun() {
  if (mode !== 'flight') return;
  mode = 'done';
  const dist = Math.max(0, Math.round(P.dist)); const success = dist >= F.target;
  const distFlakes = Math.floor(dist / 2.5), goalBonus = success ? 15 + save.level * 5 : 0;
  const earned = distFlakes + P.collected + goalBonus;
  const newBest = dist > save.best; if (newBest) save.best = dist;
  save.flakes += earned;
  const cleared = save.level;
  if (success) { save.level++; if (cleared % 5 === 0) save.pendingBonus = cleared; }
  persist();
  slamsEl.hidden = true; hideTip();
  if (!success) Sfx.sad();
  setTimeout(() => showResults({ dist, success, earned, distFlakes, collected: P.collected, goalBonus, newBest, cleared, target: F.target }), 950);
}
function showResults(r) {
  mode = 'results'; hudEl.hidden = true;
  const stats = `<dl class="stats">
      <dt>Distance</dt><dd>${fmt(r.dist)} m</dd>
      <dt>Snowflakes for distance</dt><dd>${FLAKE(14)} ${fmt(r.distFlakes)}</dd>
      <dt>Snowflakes caught</dt><dd>${FLAKE(14)} ${fmt(r.collected)}</dd>
      ${r.success ? `<dt>Goal bonus</dt><dd>${FLAKE(14)} ${fmt(r.goalBonus)}</dd>` : ''}
      <dt><b>Total earned</b></dt><dd>${FLAKE(14)} ${fmt(r.earned)}</dd></dl>`;
  if (r.success) {
    showScreen(`<div class="panel">
      <div class="eyebrow">Level ${r.cleared} · ${biome.name}</div>
      <h2>${pick(['Goal smashed!', 'Snow-tacular!', 'What a fling!', 'Flurry of glory!'])}</h2>
      <div class="bigstat ol">${fmt(r.dist)}<span class="u">m</span></div>
      <p>Goal was ${fmt(r.target)} m${r.newBest ? ' · New personal best!' : ''}</p>${stats}
      <div class="btn-row"><button class="btn gold" data-act="evolve" data-focus>Grow my snowman</button></div></div>`);
    Sfx.fanfare(); burstConfetti(P.x, P.y + 3, 2, 60, 10);
  } else {
    const ratio = r.dist / r.target;
    showScreen(`<div class="panel">
      <div class="eyebrow">Level ${r.cleared} · Goal ${fmt(r.target)} m</div>
      <h2>${ratio > 0.75 ? pick(['So close!', 'Nearly there!', 'Brrr, almost!']) : pick(['Keep flinging!', 'Warm-up fling', 'Snow problem, try again'])}</h2>
      <div class="meterbar" role="img" aria-label="${fmt(r.dist)} of ${fmt(r.target)} metres"><i style="width:${clamp(ratio * 100, 2, 100)}%"></i></div>
      <p>${fmt(r.dist)} m of ${fmt(r.target)} m${r.newBest ? ' · New personal best!' : ''}</p>${stats}
      <p style="font-size:14px;opacity:.85">Tip: ${pick(TIPS)}</p>
      <div class="wallet">${FLAKE(20)} ${fmt(save.flakes)}</div>
      <div class="btn-row"><button class="btn ice" data-act="shopRun">Upgrades</button><button class="btn" data-act="again" data-focus>Fling again</button></div></div>`);
  }
}
let shopFrom = 'title';
function showShop(from) {
  if (from) shopFrom = from;
  const cards = UPG.map(u => {
    const lv = save.upg[u.id], maxed = lv >= u.max, cost = upgCost(u, lv), can = !maxed && save.flakes >= cost;
    let pips = ''; for (let i = 0; i < u.max; i++) pips += `<i class="pip${i < lv ? ' on' : ''}"></i>`;
    return `<div class="upg">${ICONS[u.id]}<h3>${u.name}</h3><p>${u.desc}</p><div class="pips">${pips}</div>
      <button class="btn small ${can ? 'gold' : 'ice'}" data-act="buy" data-id="${u.id}" ${can ? '' : 'disabled'}>${maxed ? 'Maxed out' : `${FLAKE(14)} ${fmt(cost)}`}</button></div>`;
  }).join('');
  const s = showScreen(`<div class="panel wide">
    <div class="eyebrow">Workshop</div><h2>Upgrades</h2>
    <div class="wallet">${FLAKE(20)} ${fmt(save.flakes)}</div>
    <div class="shop-grid">${cards}</div>
    <div class="btn-row"><button class="btn" data-act="shopDone" data-focus>${shopFrom === 'run' ? 'Fling again' : 'Back'}</button></div></div>`);
  return s;
}
let evolveT0 = 0, evolveInfo = null;
function showEvolve() {
  mode = 'evolve'; evolveT0 = T;
  const prev = hero.form, next = formFor(save.level); const maxed = next === prev;
  const R = hero.R; hero.spin.rotation.z = 0; hero.root.scale.set(1, 1, 1); hero.root.position.set(P.x, R, 0); P.y = R;
  evolveInfo = { prev, next, done: false, x: P.x };
  const f = FORMS[next];
  if (maxed) { save.flakes += 25; persist(); }
  const cont = save.pendingBonus ? 'Start Snowball Bonanza' : `On to level ${save.level}`;
  showScreen(`<div class="panel">
    <div class="eyebrow">Level ${save.level - 1} cleared</div>
    <h2>${maxed ? 'Still magnificent' : 'Your snowman grew!'}</h2>
    <div class="formcard">${flakeSVG(next + 20, 44, '#ffc94a', 2)}<div><b>${f.name}</b><span>${maxed ? 'Fully grown already, so here are 25 bonus snowflakes.' : `New: ${f.part}. ${f.line}`}</span></div></div>
    ${(save.level - 1) % 5 === 0 ? `<p>New area ahead: <b>${biomeFor(save.level).name}</b></p>` : ''}
    <div class="btn-row"><button class="btn" data-act="continue" data-focus>${cont}</button></div></div>`, 'bottom');
}
function evolveCam(t) {
  if (!evolveInfo) return;
  const e = evolveInfo, a = Math.sin((t - evolveT0) * 0.4) * 0.55 - 0.2; const port = camera.aspect < 1;
  const d = port ? 11 : 8; const cy = hero.R;
  camPos.set(e.x + Math.sin(a) * d, cy + 2.2, Math.cos(a) * d); camLook.set(e.x, cy - (port ? 2.2 : 1.6), 0);
  if (!e.done && t - evolveT0 > 0.7) {
    e.done = true;
    if (e.next !== e.prev) { makeHero(e.next); hero.root.position.set(e.x, hero.R, 0); }
    flash(0.55); Sfx.fanfare(); burstSparks(e.x, hero.R + 0.5, 0, 60, 7, [0xffe07a, 0xffffff, 0xbfe6ff], 1); burstConfetti(e.x, hero.R + 1, 0, 50, 8);
    hero.root.scale.setScalar(0.4); e.popT = t;
  }
  if (e.popT) { const k = t - e.popT; const s = 1 + Math.sin(Math.min(k, 0.6) / 0.6 * Math.PI) * 0.25 * Math.exp(-k * 2); hero.root.scale.setScalar(k < 0.25 ? lerp(0.4, 1.2, k / 0.25) : s); hero.root.position.y = hero.R + Math.max(0, Math.sin(Math.min(k * 4, Math.PI))) * 0.6; }
  hero.spin.rotation.z = 0; hero.root.rotation.y = Math.sin(t * 1.5) * 0.25;
}
function showBonusIntro() {
  hideAllHud(); applyBiome(biomeFor(Math.max(1, save.pendingBonus))); resetBonus(); mode = 'bonusIntro'; Sfx.setTempo(168);
  const touch = matchMedia('(pointer:coarse)').matches;
  showScreen(`<div class="panel">
    <div class="eyebrow">Bonus round · after level ${save.pendingBonus}</div>
    <h2>Snowball Bonanza!</h2>
    <p>Roll downhill and scoop up anything smaller than your snowball. The bigger it grows, the bigger the things it can swallow.</p>
    <dl class="stats"><dt>Steer</dt><dd>${touch ? 'Hold left or right side' : '<kbd>←</kbd> <kbd>→</kbd> or drag'}</dd><dt>Time</dt><dd>${BONUS_TIME} seconds</dd><dt>Too big?</dt><dd>Bonk!</dd></dl>
    <div class="btn-row"><button class="btn gold" data-act="bonusGo" data-focus>Start rolling</button></div></div>`);
}
function startBonus() {
  hideScreen(); hideAllHud(); bonusHudEl.hidden = false; mode = 'bonus'; updateBonusHud();
  Sfx.whoosh(); banner('Roll up the little things!');
}
function endBonus() {
  if (mode !== 'bonus') return; mode = 'bonusEnd'; Sfx.fanfare();
  const width = B.R * 2; const earned = Math.round(width * 20 + B.count);
  const record = width > (save.bestBall || 0); if (record) save.bestBall = width;
  save.flakes += earned; save.pendingBonus = 0; persist();
  burstConfetti(B.x, B.R * 2 + 1, B.z, 90, 12);
  setTimeout(() => {
    mode = 'bonusResults'; bonusHudEl.hidden = true;
    showScreen(`<div class="panel">
      <div class="eyebrow">Snowball Bonanza</div><h2>${width > 6 ? 'An avalanche on legs!' : width > 3 ? 'What a snowball!' : 'A respectable snowball'}</h2>
      <div class="bigstat ol">${width.toFixed(2)}<span class="u">m wide</span></div>
      ${record ? '<p>Your biggest snowball yet!</p>' : ''}
      <dl class="stats"><dt>Things rolled up</dt><dd>${fmt(B.count)}</dd><dt>Biggest catch</dt><dd>${B.largest || 'Nothing yet'}</dd><dt><b>Snowflakes earned</b></dt><dd>${FLAKE(14)} ${fmt(earned)}</dd></dl>
      <div class="btn-row"><button class="btn" data-act="bonusDone" data-focus>Back to flinging</button></div></div>`);
  }, 1300);
}
function showPause() {
  if (!['aim', 'flight', 'bonus'].includes(mode) || paused) return;
  paused = true; Sfx.setMusic(false);
  showScreen(`<div class="panel"><div class="eyebrow">Taking a breather</div><h2>Paused</h2>
    <div class="btn-row"><button class="btn" data-act="resume" data-focus>Resume</button>${mode !== 'bonus' ? '<button class="btn ice" data-act="restart">Restart fling</button>' : ''}</div>
    <div class="btn-row"><button class="btn ice small" data-act="mute">${save.muted ? 'Sound off' : 'Sound on'}</button><button class="btn ice small" data-act="title">Main menu</button></div></div>`);
}
function resume() { paused = false; Sfx.setMusic(true); hideScreen(); }

const ACT = {
  play() { if (save.pendingBonus) showBonusIntro(); else startLevel(); },
  shop() { showShop('title'); }, shopRun() { showShop('run'); },
  shopDone() { if (shopFrom === 'run') startLevel(); else gotoTitle(); },
  buy(b) {
    const u = UPG.find(x => x.id === b.dataset.id); const lv = save.upg[u.id]; const cost = upgCost(u, lv);
    if (lv >= u.max || save.flakes < cost) return;
    save.flakes -= cost; save.upg[u.id]++; persist(); Sfx.buy();
    const sc = screensEl.querySelector('.screen').scrollTop; const s = showShop(); s.scrollTop = sc;
    const btn = s.querySelector(`[data-id="${u.id}"]`); if (btn) btn.focus({ preventScroll: true });
  },
  again() { startLevel(); },
  evolve() { showEvolve(); },
  continue() { if (save.pendingBonus) showBonusIntro(); else startLevel(); },
  bonusGo() { startBonus(); },
  bonusDone() { startLevel(); },
  resume() { resume(); },
  restart() { paused = false; Sfx.setMusic(true); startLevel(); },
  title() { paused = false; Sfx.setMusic(true); gotoTitle(); },
  mute(b) { save.muted = !save.muted; persist(); Sfx.setMuted(save.muted); if (b.classList.contains('iconbtn')) b.innerHTML = soundIcon(); else b.textContent = save.muted ? 'Sound off' : 'Sound on'; },
  reset() {
    showScreen(`<div class="panel"><div class="eyebrow">Careful</div><h2>Start over?</h2><p>This melts your snowman back to a snowball and clears every level, upgrade and snowflake.</p>
      <div class="btn-row"><button class="btn ice" data-act="title" data-focus>Keep my snowman</button><button class="btn" data-act="resetYes">Reset everything</button></div></div>`);
  },
  resetYes() { const m = save.muted; save = defaultSave(); save.muted = m; persist(); gotoTitle(); },
};
screensEl.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; Sfx.init(); Sfx.click(); ACT[b.dataset.act] && ACT[b.dataset.act](b); });
$('#pauseBtn').addEventListener('click', e => { e.stopPropagation(); Sfx.init(); showPause(); });
$('#pauseBtn2').addEventListener('click', e => { e.stopPropagation(); Sfx.init(); showPause(); });

// ================= input =================
let dragging = false, keyL = false, keyR = false;
function onAction() { if (paused) return; if (mode === 'aim') launch(); else if (mode === 'flight') trySlam(); }
function steerFrom(x) { B.steer = clamp((x / innerWidth - 0.5) * 2.6, -1, 1); }
window.addEventListener('pointerdown', e => {
  Sfx.init();
  if (e.target.closest('button,.screen')) return;
  if (mode === 'bonus') { dragging = true; steerFrom(e.clientX); return; }
  onAction();
});
window.addEventListener('pointermove', e => { if (mode === 'bonus' && dragging) steerFrom(e.clientX); });
const endDrag = () => { dragging = false; if (!keyL && !keyR) B.steer = 0; };
window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag);
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keyL = true; B.steer = (keyR ? 1 : 0) - 1; e.preventDefault(); }
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keyR = true; B.steer = 1 - (keyL ? 1 : 0); e.preventDefault(); }
  else if (e.key === ' ' || e.key === 'Enter') { if (!screensEl.firstElementChild) { e.preventDefault(); Sfx.init(); if (!e.repeat) onAction(); } }
  else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (paused) resume(); else showPause(); }
});
window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keyL = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keyR = false;
  if (!dragging) B.steer = (keyR ? 1 : 0) - (keyL ? 1 : 0);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) showPause(); });
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); });
window.addEventListener('contextmenu', e => e.preventDefault());

// ================= main loop =================
let mode = 'loading', paused = false, T = 0, last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (paused) dt = 0;
  T += dt; U.uTime.value = T;
  if (mode.startsWith('bonus')) updateBonus(dt);
  else { updateFling(dt); if (mode === 'title') titleCam(T); else if (mode === 'evolve') evolveCam(T); }
  confetti.update(dt); puffs.update(dt); sparks.update(dt);
  applyCam(dt); placeBackdrop();
  renderer.render(scene, camera);
}
function boot() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  gotoTitle(); titleCam(0); applyCam(0); placeBackdrop();
  requestAnimationFrame(frame);
  setTimeout(() => $('#loading').classList.add('gone'), 250);
}
(document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve()).then(boot);
