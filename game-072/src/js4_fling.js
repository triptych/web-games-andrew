// ================= fling mode =================
const GRAV = 22;
const P = { x: 0, y: 2, vx: 0, vy: 0, slams: 1, maxSlams: 1, slamming: false, stopT: 0, dist: 0, collected: 0, combo: 0, sleigh: null, sleighT: 0, squash: 0, reachedGoal: false, runT: 0, streak: 0, streakT: 0, perfect: false, spinV: 0, launched: false };
const F = { items: [], props: [], nextX: 0, nextPropX: 0, nextFarX: 0, nextFenceX: 0, nextSignX: 50, target: 50, arch: null, bestMark: null, power: 0, aimT: 0 };
let hero = null;
const targetFor = L => Math.round((50 + 38 * (L - 1) + 5 * Math.pow(L - 1, 1.55)) / 5) * 5;

function makeHero(form) {
  if (hero) scene.remove(hero.root);
  hero = buildSnowman(form); scene.add(hero.root); return hero;
}

// ---- candy-cane slingshot ----
const sling = (() => {
  const g = new THREE.Group(); const cm = caneMat();
  [-1.25, 1.25].forEach(z => { const c = part(caneGeo(2.4, 0.3, 0.14), cm, [0.3, 0, z]); c.rotation.y = Math.PI; g.add(c); });
  g.add(part(GEO.half, M(C.white), [0.3, 0, 0], [1.3, 0.45, 2.0]));
  g.add(part(GEO.box, M(C.wood), [0.3, 0.2, 0], [0.5, 0.3, 2.9]));
  const bandMat = M(C.red);
  const bands = [part(GEO.cylL, bandMat), part(GEO.cylL, bandMat)]; bands.forEach(b => g.add(b));
  const pouch = part(GEO.sph, M(0x8a2a3a), [0, 0, 0], [0.18, 0.4, 0.5]); g.add(pouch);
  const elf = buildElf(0); elf.position.set(-3.6, 0, 1.6); elf.rotation.y = 0.6; elf.scale.setScalar(1.15); g.add(elf);
  scene.add(g);
  const A = [new THREE.Vector3(0.3, 2.38, -1.25), new THREE.Vector3(0.3, 2.38, 1.25)];
  return {
    g, elf,
    setBand(bx, by, R) {
      const back = new THREE.Vector3(bx - R * 0.75, by, 0);
      bands.forEach((b, i) => setStick(b, A[i], back.clone().setZ(i ? 0.35 : -0.35), 0.045));
      pouch.position.copy(back);
    },
  };
})();
const SLING_X = 0.3, SLING_Y = 2.1;

// ---- items ----
const ITEM_DEF = {
  present: { r: 0.75, y: 0.5, build: () => buildPresent(ri(0, 4)) },
  elf: { r: 0.62, y: 0.7, build: () => buildElf(ri(0, 1)) },
  reindeer: { r: 1.15, y: 1.25, build: buildReindeer },
  ginger: { r: 0.6, y: 0.6, build: buildGinger },
  gumdrop: { r: 1.15, y: 0.4, build: buildGumdrop },
  cocoa: { r: 0.8, y: 0.6, build: buildCocoa },
  coal: { r: 0.75, y: 0.4, build: buildCoal },
  balloon: { r: 0.85, air: true, build: buildBalloonGift },
  bell: { r: 0.9, air: true, build: () => buildGoldenBell(true) },
  sleigh: { r: 1.7, air: true, build: () => buildSleigh(true) },
};
function addItem(kind, x, y = 0) {
  const d = ITEM_DEF[kind]; const m = d.build();
  m.position.set(x, d.air ? y : 0, 0);
  if (kind === 'elf' || kind === 'ginger') m.rotation.y = -0.35;
  scene.add(m);
  const it = { kind, x, y: d.air ? y : d.y, baseY: d.air ? y : 0, r: d.r, m, hit: false, t: rnd() * 5, vx: 0, vy: 0, vr: 0, gone: false };
  F.items.push(it); return it;
}
function clearFling() {
  F.items.forEach(it => scene.remove(it.m)); F.items.length = 0;
  F.props.forEach(o => scene.remove(o)); F.props.length = 0;
  if (F.arch) { scene.remove(F.arch); F.arch = null; }
  if (F.bestMark) { scene.remove(F.bestMark); F.bestMark = null; }
  clearFlakes();
}
function weighted(list) { let t = 0; list.forEach(e => t += e[1]); let r = rnd() * t; for (const e of list) { r -= e[1]; if (r <= 0) return e; } return list[0]; }

function spawnItems() {
  const L = save.level, luck = save.upg.luck;
  const obst = Math.min(0.32, 0.05 + L * 0.014);
  while (F.nextX < P.x + 150) {
    const x = F.nextX;
    const table = [['present', 30 + luck * 3], ['elf', 14 + luck * 2], ['gumdrop', 11 + luck * 1.5], ['ginger', 13], ['reindeer', L >= 3 ? 8 + luck : 0], ['balloon', 8], ['bell', 3.5 + luck * 0.7], ['sleigh', L >= 4 ? 1.3 + luck * 0.25 : 0]];
    if (x > 30) table.push(['cocoa', 100 * obst * 0.55], ['coal', 100 * obst * 0.45]);
    const kind = weighted(table)[0];
    const y = kind === 'balloon' ? rr(4, 15) : kind === 'bell' ? rr(6, 22) : kind === 'sleigh' ? rr(13, 24) : 0;
    addItem(kind, x, y);
    if (rnd() < 0.42) {
      const n = ri(5, 8), h = rr(1.5, 16), x0 = x + rr(3, 6), arc = rr(1.5, 3.5);
      for (let i = 0; i < n; i++) spawnFlake(x0 + i * 1.4, h + Math.sin(i / (n - 1) * Math.PI) * arc);
    }
    F.nextX += rr(12, 26) / (1 + luck * 0.06);
  }
}
function spawnProps() {
  while (F.nextPropX < P.x + 240) {
    const [kind, , zn, zf] = weighted(biome.props); const o = scenery(kind);
    o.position.set(F.nextPropX, 0, rr(zf, zn));
    o.rotation.y = ['house', 'cabin', 'workshop', 'igloo', 'soldier', 'lolli', 'deco'].includes(kind) ? rr(-0.3, 0.3) : rr(0, TAU);
    if (kind === 'tree') o.scale.setScalar(rr(0.8, 1.6));
    scene.add(o); F.props.push(o); F.nextPropX += rr(3, 7.5);
  }
  while (F.nextFarX < P.x + 420) { const o = SCENERY.treeFar(ri(0, 3)).clone(); o.position.set(F.nextFarX, 0, rr(-70, -135)); o.scale.setScalar(rr(1.5, 2.6)); scene.add(o); F.props.push(o); F.nextFarX += rr(7, 13); }
  while (F.nextFrontX < P.x + 200) {
    const o = rnd() < 0.6 ? scenery('drift') : scenery(pick(biome.front));
    o.position.set(F.nextFrontX, 0, rr(4.5, 6.5)); o.rotation.y = rr(-0.4, 0.4); o.scale.multiplyScalar(0.65); scene.add(o); F.props.push(o); F.nextFrontX += rr(12, 28);
  }
  while (F.nextFenceX < P.x + 220) { const o = SCENERY.fence().clone(); o.position.set(F.nextFenceX, 0, -3.5); scene.add(o); F.props.push(o); F.nextFenceX += 12; }
  while (F.nextSignX < P.x + 220) { const s = buildSign(F.nextSignX + ' m'); s.position.set(F.nextSignX, 0, -2.8); scene.add(s); F.props.push(s); F.nextSignX += 50; }
  for (let i = F.props.length - 1; i >= 0; i--) { const o = F.props[i]; if (o.position.x < P.x - 140) { scene.remove(o); F.props.splice(i, 1); } }
}
function buildArch(target) {
  const g = new THREE.Group(); const cm = caneMat();
  [-2.7, 2.7].forEach(z => { const c = part(caneGeo(5.4, 0.55, 0.24), cm, [0, 0, z]); c.rotation.y = z < 0 ? -Math.PI / 2 : Math.PI / 2; g.add(c); });
  g.add(part(GEO.plane, MT(bannerTex('GOAL', target + ' m'), 0xffffff, THREE.DoubleSide), [0, 5.0, 0], [4.6, 1.45, 1]));
  for (let i = 0; i < 11; i++) g.add(part(GEO.sphL, GL(LIGHT_COLS[i % LIGHT_COLS.length]), [0, 5.85 - Math.sin(i / 10 * Math.PI) * 0.2, -2.4 + i * 0.48], 0.09));
  g.add(part(GEO.box, GL(0xffc94a), [0, 0.03, 0], [0.35, 0.05, 6]));
  g.position.x = target; return g;
}
function buildBestMark(best) {
  const g = new THREE.Group();
  g.add(part(GEO.cylL, M(0xffffff), [0, 1.4, 0], [0.05, 2.8, 0.05]));
  const flag = part(GEO.plane, MT(canvasTex('bestflag', 256, 128, (c, w, h) => { c.fillStyle = '#7fc8ff'; c.fillRect(0, 0, w, h); c.fillStyle = '#123a7a'; c.font = '70px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BEST', w / 2, h / 2 + 4); }), 0xffffff, THREE.DoubleSide), [0.55, 2.4, 0], [1.1, 0.55, 1]);
  g.add(flag); g.position.set(best, 0, -2.3); return g;
}

function resetFling() {
  clearFling();
  P.x = SLING_X; P.y = SLING_Y; P.vx = P.vy = 0; P.slamming = false; P.stopT = 0; P.dist = 0; P.collected = 0; P.combo = 0;
  P.sleigh = null; P.sleighT = 0; P.squash = 0; P.reachedGoal = false; P.runT = 0; P.streak = 0; P.launched = false; P.spinV = 0;
  P.maxSlams = 1 + save.upg.slam; P.slams = P.maxSlams;
  F.target = targetFor(save.level);
  F.nextX = 16; F.nextPropX = -60; F.nextFrontX = -30; F.nextFarX = -200; F.nextFenceX = -60; F.nextSignX = 50; F.aimT = 0; F.power = 0;
  const form = formFor(save.level);
  if (!hero || hero.form !== form) makeHero(form);
  hero.root.visible = true; hero.root.rotation.set(0, 0, 0); hero.spin.rotation.set(0, 0, 0); hero.root.scale.set(1, 1, 1);
  F.arch = buildArch(F.target); scene.add(F.arch);
  if (save.best > 20) { F.bestMark = buildBestMark(Math.round(save.best)); scene.add(F.bestMark); }
  sling.g.visible = true;
  spawnProps(); spawnItems();
  placeHeroInSling(0);
  groundMat.uniforms.uAxis.value = 0; groundMat.uniforms.uLane.value = 2.2;
}
function placeHeroInSling(pw) {
  const bx = SLING_X - 2.3 * pw, by = SLING_Y - 0.55 * pw;
  hero.root.position.set(bx, by, 0); P.x = bx; P.y = by; sling.setBand(bx, by, hero.R);
}

function launch() {
  const pw = F.power, u = save.upg;
  P.perfect = pw > 0.9;
  const v = (24 + u.power * 3.2) * (0.42 + 0.58 * pw) * (P.perfect ? 1.12 : 1);
  const ang = 42 * DEG; P.vx = v * Math.cos(ang); P.vy = v * Math.sin(ang); P.launched = true; P.spinV = -8;
  sling.setBand(SLING_X, SLING_Y + 0.25, 0.01);
  Sfx.launch();
  if (P.perfect) { pop('PERFECT FLING!', new THREE.Vector3(P.x + 3, P.y + 2.5, 0), '#b97a12', true); Sfx.ding(); burstSparks(P.x, P.y, 0, 30, 10); flash(0.35); }
  else if (pw < 0.35) pop('…a gentle toss', new THREE.Vector3(P.x + 3, P.y + 2, 0), '#2f5fb8');
  mode = 'flight'; save.runs++;
  showFlightHud();
}

function addCombo(word, color) {
  P.combo++;
  let t = word;
  if (P.combo >= 2) { t += ' ×' + P.combo; if (P.combo >= 3) collect(P.combo, false); }
  pop(t, new THREE.Vector3(P.x + 1, P.y + 1.6, 0), color);
}
function collect(n, sound = true) { P.collected += n; if (sound) Sfx.pling(P.streak++); }

function hitItem(it) {
  it.hit = true; it.t = 0; const sl = P.slamming; const mult = sl ? 1.3 : 1;
  if (sl && it.kind !== 'cocoa' && it.kind !== 'coal' && it.kind !== 'bell') { pop('SLAM COMBO!', new THREE.Vector3(P.x, P.y + 3, 0), '#b97a12'); collect(5, false); }
  switch (it.kind) {
    case 'present': P.vy = Math.max(P.vy, 12 * mult); P.vx += 2 * mult; Sfx.jingle(); Sfx.boing(1.1); burstConfetti(it.x, it.y + 0.4, 0, 40, 9); addCombo('BOING!', '#e8364f'); break;
    case 'elf': P.vx += 5 * mult; P.vy = Math.max(P.vy, 8 * mult); it.vx = P.vx * 0.4 + 6; it.vy = 13; it.vr = -12; Sfx.boing(1.4); Sfx.whoosh(); burstConfetti(it.x, it.y, 0, 18, 6); addCombo('ELF KICK!', '#13684a'); break;
    case 'reindeer': P.vy = Math.max(P.vy, 18 * mult); P.vx += 1.5; it.vx = 5; it.vy = 9; it.vr = 5; Sfx.boing(0.7, 0.4); burstPuff(it.x, 0.3, 0, 14, 5, 0.35); addCombo('REINDEER LIFT!', '#7a4a2a'); break;
    case 'ginger': P.vx += 1.5; P.vy = Math.max(P.vy, 6); it.vx = P.vx * 0.5 + 3; it.vy = 10; it.vr = -15; Sfx.crunch(); collect(3); burstSparks(it.x, it.y, 0, 14, 5, 0xc77a3c, 12); addCombo('CRUNCH! +3', '#a35a1e'); break;
    case 'gumdrop': P.vy = Math.max(Math.abs(P.vy) * 0.95, 14 * mult); P.vx += 1; Sfx.boing(0.8, 0.45); addCombo('SPROING!', '#8e4fd6'); break;
    case 'balloon': P.vy = Math.max(P.vy, 11); P.vx += 1.5; Sfx.pop(); burstConfetti(it.x, it.y + 0.8, 0, 26, 7); it.m.visible = false; addCombo('POP!', '#2f5fb8'); break;
    case 'bell': collect(10, false); P.slams = Math.min(P.maxSlams, P.slams + 1); P.vy = Math.max(P.vy, 6); Sfx.ding(); burstSparks(it.x, it.y, 0, 34, 9, [0xffe07a, 0xffffff]); pop('DING! +10 · SLAM REFILL', new THREE.Vector3(it.x, it.y + 1.5, 0), '#b97a12'); updateSlamPips(); break;
    case 'sleigh': P.sleigh = it; P.sleighT = 2.4; P.slamming = false; Sfx.jingle(); Sfx.fanfare(); pop('SLEIGH RIDE!', new THREE.Vector3(P.x + 2, P.y + 2, 0), '#e8364f', true); break;
    case 'cocoa': P.vx *= 0.55; P.vy = Math.max(P.vy * 0.3, 5); Sfx.melt(); burstPuff(it.x, 1.3, 0, 16, 3, 0.3); it.vr = -4; pop('TOO TOASTY!', new THREE.Vector3(it.x, it.y + 1.8, 0), '#a81f3a'); P.combo = 0; shake(0.25); break;
    case 'coal': P.vx *= 0.7; P.vy = Math.max(P.vy, 6); Sfx.thump(0.5); burstSparks(it.x, 0.5, 0, 16, 6, 0x3a3446, 14); pop('LUMP OF COAL!', new THREE.Vector3(it.x, it.y + 1.8, 0), '#24212e'); P.combo = 0; shake(0.3); break;
  }
  if (it.kind !== 'cocoa' && it.kind !== 'coal' && it.kind !== 'bell') P.slamming = false;
  P.squash = 0.6;
}

function trySlam() {
  if (P.sleighT > 0 || P.slamming) return;
  if (P.y < hero.R + 0.6) { pop('Slam in the air!', new THREE.Vector3(P.x + 2, P.y + 2, 0), '#2f5fb8'); return; }
  if (P.slams <= 0) { pop('No slams left', new THREE.Vector3(P.x + 2, P.y + 2, 0), '#2f5fb8'); return; }
  P.slams--; P.slamming = true; P.vy = Math.min(P.vy, -24); P.vx += 1.5; Sfx.slam(); updateSlamPips();
  if (!save.seenSlam) { save.seenSlam = true; persist(); hideTip(); }
}

function flightStep(dt) {
  const u = save.upg, R = hero.R;
  if (P.sleighT > 0) {
    P.sleighT -= dt; const s = P.sleigh;
    P.vx = damp(P.vx, 38 + u.aero * 1.5, 2, dt); P.vy = 0; P.y = damp(P.y, 18, 1.6, dt); P.x += P.vx * dt;
    s.m.position.set(P.x + 0.3, P.y - R - 0.55, 0); s.x = P.x;
    if (rnd() < 0.4) burstSparks(P.x - 1.2, P.y - R - 0.4, 0, 1, 2, [0xffe07a, 0xffffff], 1);
    if (P.sleighT <= 0) { P.vy = 10; s.leaving = true; s.vx = P.vx * 1.15; s.vy = 7; Sfx.whoosh(); pop('WHEEE!', new THREE.Vector3(P.x + 2, P.y + 2, 0), '#e8364f'); }
    return;
  }
  P.vy -= GRAV * dt; if (P.slamming) P.vy -= 45 * dt;
  const drag = Math.max(0.01, 0.045 - u.aero * 0.0033);
  P.vx -= P.vx * drag * dt;
  P.x += P.vx * dt; P.y += P.vy * dt;
  if (P.y <= R) {
    P.y = R;
    if (P.vy < 0) {
      const imp = -P.vy;
      if (P.slamming) {
        P.slamming = false; P.vy = Math.max(imp * 0.7, 15 + u.bounce * 1.4); P.vx += 2;
        Sfx.slamHit(); shake(0.6); flash(0.25); burstPuff(P.x, 0.2, 0, 26, 9, 0.4); pop('SNOW SLAM!', new THREE.Vector3(P.x, 3, 0), '#2f5fb8', true); P.squash = 1;
      } else if (imp > 3.2) {
        P.vy = imp * Math.min(0.72, 0.42 + u.bounce * 0.03); P.vx *= Math.min(0.93, 0.8 + u.bounce * 0.012);
        Sfx.thump(clamp(imp / 40, 0.1, 0.45)); if (imp > 8) Sfx.boing(0.6 + imp / 60, clamp(imp / 80, 0.05, 0.25));
        burstPuff(P.x, 0.2, 0, clamp(Math.round(imp / 2), 4, 16), clamp(imp / 4, 2, 7), 0.28); P.squash = clamp(imp / 25, 0.2, 0.9);
      } else P.vy = 0;
      P.combo = 0;
    }
  }
  const onGround = P.y <= R + 0.001 && P.vy === 0;
  if (onGround) {
    P.vx -= Math.max(2.6, 6.5 - u.aero * 0.38) * dt; if (P.vx < 0) P.vx = 0;
    if (rnd() < P.vx * 0.02) burstPuff(P.x - R * 0.6, 0.1, rr(-0.4, 0.4), 1, 1.5, 0.18);
  }
  P.vx = Math.min(P.vx, 95); P.vy = Math.min(P.vy, 70);
  for (const it of F.items) {
    if (it.hit) continue;
    const dx = it.x - P.x, dy = it.y - P.y, rr2 = R + it.r;
    if (dx * dx + dy * dy < rr2 * rr2) hitItem(it);
  }
  if (onGround && P.vx < 0.5) P.stopT += dt; else P.stopT = 0;
}

function updateItems(dt) {
  for (let i = F.items.length - 1; i >= 0; i--) {
    const it = F.items[i]; it.t += dt; const m = it.m, ud = m.userData;
    if (!it.hit) {
      switch (it.kind) {
        case 'elf': ud.armL.rotation.z = -0.45 - Math.abs(Math.sin(it.t * 6)) * 1.6; ud.armR.rotation.z = 0.45 + Math.abs(Math.sin(it.t * 6 + 1)) * 0.4; m.position.y = Math.abs(Math.sin(it.t * 5)) * 0.15; break;
        case 'reindeer': ud.legs.forEach((l, k) => l.rotation.z = Math.sin(it.t * 7 + k * 1.6) * 0.35); ud.head.rotation.z = Math.sin(it.t * 2) * 0.1; break;
        case 'balloon': m.position.y = it.baseY + Math.sin(it.t * 1.6) * 0.5; it.y = m.position.y + 0.3; m.rotation.z = Math.sin(it.t * 1.2) * 0.1; break;
        case 'bell': ud.inner.rotation.z = Math.sin(it.t * 3) * 0.35; m.position.y = it.baseY + Math.sin(it.t * 1.3) * 0.3; it.y = m.position.y; break;
        case 'cocoa': ud.steam.children.forEach((s, k) => { const p = (it.t * 0.45 + k / 4) % 1; s.position.set(Math.sin(p * 9 + k) * 0.15, 1.2 + p * 1.6, 0); s.scale.setScalar(0.1 + p * 0.25); }); break;
        case 'sleigh': m.position.y = it.baseY + Math.sin(it.t * 1.4) * 0.5; it.y = m.position.y + 1.0; if (ud.arm) ud.arm.rotation.x = Math.sin(it.t * 6) * 0.4; break;
        case 'ginger': m.rotation.z = Math.sin(it.t * 4) * 0.08; break;
      }
    } else {
      switch (it.kind) {
        case 'present': { const lid = ud.lid; lid.position.y = 0.9 + it.t * 7 - it.t * it.t * 11; lid.rotation.z = -it.t * 7; lid.position.x = it.t * 2; const sq = Math.exp(-it.t * 6) * Math.cos(it.t * 22); m.scale.set(1 + sq * 0.25, 1 - sq * 0.35, 1 + sq * 0.25); if (it.t > 1.4) it.gone = true; break; }
        case 'elf': case 'reindeer': case 'ginger': case 'cocoa':
          if (it.kind === 'cocoa') { if (m.rotation.z > -1.45) m.rotation.z += it.vr * dt; break; }
          it.vy -= 25 * dt; m.position.x += it.vx * dt; m.position.y = Math.max(0, m.position.y + it.vy * dt); m.rotation.z += it.vr * dt;
          if (m.position.y === 0) { it.vx *= 0.9; it.vr *= 0.9; if (it.vy < -3) burstPuff(m.position.x, 0.1, 0, 4, 2, 0.2); it.vy = 0; }
          break;
        case 'gumdrop': { const k = 1 - 0.55 * Math.exp(-it.t * 7) * Math.cos(it.t * 26); ud.top.scale.set(1 + (1 - k) * 0.5, k, 1 + (1 - k) * 0.5); break; }
        case 'bell': m.scale.setScalar(1 + it.t * 3); if (it.t > 0.25) it.gone = true; break;
        case 'balloon': if (it.t > 0.1) it.gone = true; break;
        case 'sleigh': if (it.leaving) { it.vy += 3 * dt; m.position.x += it.vx * dt; m.position.y += it.vy * dt; if (m.position.x > P.x + 120) it.gone = true; } break;
      }
    }
    if (it.gone || (m.position.x < P.x - 60 && it !== P.sleigh)) { scene.remove(m); F.items.splice(i, 1); }
  }
}
function updateFlingFlakes(dt) {
  const mr = 1.5 + save.upg.magnet * 0.9, R = hero.R;
  for (const f of flakes) {
    if (!f.alive) continue;
    const dx = P.x - f.x, dy = P.y - f.y, d = Math.hypot(dx, dy);
    if (d < mr + R) f.pull = true;
    if (f.pull) { const sp = (25 + Math.hypot(P.vx, P.vy)) * dt; f.x += dx / d * Math.min(sp, d); f.y += dy / d * Math.min(sp, d); }
    if (d < R + 0.35) { f.alive = false; collect(1); burstSparks(f.x, f.y, 0, 3, 3, 0xbfe6ff, 0); }
    else if (f.x < P.x - 60) f.alive = false;
  }
  P.streakT += dt; if (P.streakT > 1.2) { P.streak = 0; P.streakT = 0; }
}

// ---- cameras ----
const camPos = new THREE.Vector3(10, 4, 18), camLook = new THREE.Vector3(6, 2, 0);
function viewHalfWidth(dist) { return dist * Math.tan(camera.fov * DEG / 2) * camera.aspect; }
function flingCam(dt, snap) {
  const asp = camera.aspect, port = asp < 1;
  const zf = port ? clamp(0.66 / asp, 1, 1.5) : 1;
  const spd = Math.hypot(P.vx, P.vy);
  const tz = (15 + Math.min(P.y * 0.55, 40) + Math.min(spd * 0.09, 9)) * zf;
  const hw = viewHalfWidth(tz);
  const tx = P.x + hw * 0.42 + Math.min(P.vx * 0.04, 3);
  const ty = Math.max(2.3 * zf, P.y * 0.7 + 2.0);
  const k = snap ? 1 : 1 - Math.exp(-4.5 * dt);
  camPos.x += (tx - camPos.x) * k; camPos.y += (ty - camPos.y) * k; camPos.z += (tz - camPos.z) * k;
  camLook.x += (tx - camLook.x) * k; camLook.y += (Math.max(port ? 5.2 : 3.0, P.y * 0.62 + (port ? 3.2 : 1.6)) - camLook.y) * k; camLook.z = 0;
}
function titleCam(t) {
  const port = camera.aspect < 1, zf = port ? clamp(0.75 / camera.aspect, 1, 1.9) : 1;
  camPos.set(1.5 + Math.sin(t * 0.15) * 2.5, 2.6 + Math.sin(t * 0.21) * 0.4, 10.5 * zf);
  camLook.set(port ? 0.6 : 2.2, port ? 3.2 : 2.6, 0);
}
function applyCam(dt) {
  shakeAmt = Math.max(0, shakeAmt - dt * 1.6);
  const s = shakeAmt * shakeAmt * 1.2;
  shakeV.set(rr(-s, s), rr(-s, s), 0);
  camera.position.copy(camPos).add(shakeV); camera.lookAt(camLook);
}

function updateFling(dt) {
  if (mode === 'aim') {
    F.aimT += dt; const spd = 1.5 + Math.min(save.level * 0.04, 1.0);
    F.power = 0.5 - 0.5 * Math.cos(F.aimT * spd * Math.PI);
    placeHeroInSling(F.power);
    hero.root.rotation.z = F.power * 0.25;
    sling.elf.position.y = Math.abs(Math.sin(T * 4)) * 0.15;
    updateMeter();
    flingCam(dt);
  } else if (mode === 'flight' || mode === 'done') {
    if (mode === 'flight') {
      P.runT += dt; const n = 4; for (let i = 0; i < n; i++) flightStep(dt / n);
      P.dist = Math.max(P.dist, P.x);
      if (!P.reachedGoal && P.x >= F.target) {
        P.reachedGoal = true; Sfx.fanfare(); Sfx.firework(); flash(0.3);
        pop('GOAL!', new THREE.Vector3(P.x + 4, P.y + 3, 0), '#b97a12', true);
        for (let k = 0; k < 4; k++) setTimeout(() => { burstSparks(F.target + rr(-6, 10), rr(10, 18), rr(-8, -2), 50, 9, [CONF_COLS[k], 0xffffff], 2); Sfx.firework(); }, k * 260);
        burstConfetti(F.target, 5, 0, 80, 12);
      }
      if (P.stopT > 0.7 || P.runT > 150) endRun();
    } else {
      P.vx = damp(P.vx, 0, 3, dt);
    }
    const R = hero.R;
    if (P.y <= R + 0.01 && P.sleighT <= 0) P.spinV = -P.vx / R; else P.spinV = damp(P.spinV, P.slamming ? -18 : -P.vx / R * 0.6, 2, dt);
    hero.spin.rotation.z += P.spinV * dt;
    P.squash = Math.max(0, P.squash - dt * 4);
    const sq = Math.sin(P.squash * Math.PI / 2) * P.squash;
    hero.root.scale.set(1 + sq * 0.18, 1 - sq * 0.28, 1 + sq * 0.18);
    hero.root.rotation.z = 0;
    hero.root.position.set(P.x, P.y - R * sq * 0.28, 0);
    updateItems(dt); updateFlingFlakes(dt);
    spawnItems(); spawnProps();
    sling.setBand(SLING_X, SLING_Y + 0.25 + Math.sin(T * 20) * Math.exp(-P.runT * 3) * 0.3, 0.01);
    sling.elf.position.y = Math.abs(Math.sin(T * 7)) * 0.4 * Math.exp(-P.runT * 0.5);
    updateFlightHud();
    flingCam(dt);
  } else if (mode === 'title' || mode === 'evolve') {
    sling.elf.position.y = Math.abs(Math.sin(T * 3)) * 0.1;
  }
  animateSnowman(hero, T);
  shadow.position.set(hero.root.position.x, 0.04, 0);
  const hgt = Math.max(0, hero.root.position.y - hero.R);
  shadow.scale.setScalar(hero.R * (1.1 + hgt * 0.04)); shadow.material.uniforms.uA.value = 0.42 / (1 + hgt * 0.12);
  drawFlakes(T);
}
