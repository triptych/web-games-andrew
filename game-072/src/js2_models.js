// ================= palette =================
const C = { red: 0xe8364f, redD: 0xa81f3a, green: 0x2a9d74, greenD: 0x1b6e50, pine: 0x1f6b4e, pineL: 0x2f8a5f, gold: 0xffc94a, white: 0xf4f8ff, ice: 0xbfe6ff,
  skin: 0xffd2b0, brown: 0x7a4a2a, wood: 0x8a5a34, coal: 0x24212e, orange: 0xff8a2a, cocoa: 0x6b3a22, ginger: 0xc77a3c, cream: 0xfff3df,
  black: 0x1d1b29, pink: 0xff8fb1, blue: 0x4d7cf0, purple: 0x8e4fd6, cheek: 0xff9aa8 };
const LIGHT_COLS = [0xff5a6e, 0xffd54a, 0x6ad8ff, 0x7cf08a, 0xffffff, 0xff9af0];
const snowToon = () => M(C.white);

// ================= the hero: snowball → snowman =================
const FORMS = [
  { name: 'Snowball', part: 'nothing yet', line: 'A humble snowball with big dreams.' },
  { name: 'Peeper', part: 'coal eyes', line: 'It can finally see where it is flying. Mostly.' },
  { name: 'Sniffer', part: 'a carrot nose', line: 'Smells like victory. And carrots.' },
  { name: 'Grinner', part: 'a coal smile', line: 'Now it can grin at every present it flattens.' },
  { name: 'Double Scoop', part: 'a second snowball', line: 'Two tiers of pure flinging power.' },
  { name: 'Wavey', part: 'stick arms', line: 'Perfect for waving at elves mid-air.' },
  { name: 'Cozy', part: 'a striped scarf', line: 'Toasty around the neck, frosty everywhere else.' },
  { name: 'Triple Stack', part: 'a third snowball', line: 'A proper snowman at last.' },
  { name: 'Dapper', part: 'coal buttons', line: 'Buttoned up and ready for the ball.' },
  { name: 'Top Hat', part: 'a top hat', line: 'The hat says gentleman. The landing says otherwise.' },
  { name: 'Toasty Paws', part: 'red mittens', line: 'No more frozen twig-fingers.' },
  { name: 'Festive', part: 'a sprig of holly', line: 'Peak seasonal fashion.' },
  { name: 'Snow Monarch', part: 'a sparkling frost aura', line: 'The most magnificent snowman in the land.' },
];
const MAX_FORM = FORMS.length - 1;
const formFor = level => Math.min(level - 1, MAX_FORM);
const heroSnow = makeSnowMat(0xf7faff, 0.06);

function buildSnowman(form) {
  const root = new THREE.Group(), spin = new THREE.Group(), body = new THREE.Group();
  root.add(spin); spin.add(body);
  const has = i => form >= i;
  const tiers = has(7) ? 3 : has(4) ? 2 : 1;
  const balls = tiers === 1 ? [{ r: 0.72, y: 0 }] : tiers === 2 ? [{ r: 0.72, y: 0 }, { r: 0.5, y: 0.98 }] : [{ r: 0.72, y: 0 }, { r: 0.55, y: 0.98 }, { r: 0.4, y: 1.74 }];
  balls.forEach(b => body.add(part(GEO.sph, heroSnow, [0, b.y, 0], b.r)));
  const head = balls[balls.length - 1], torso = balls.length > 1 ? balls[balls.length - 2] : balls[0];
  const hr = head.r, hy = head.y, coal = M(C.coal);
  const onHead = (ax, ay, k = 1) => new THREE.Vector3(Math.sin(ax) * Math.cos(ay), Math.sin(ay), Math.cos(ax) * Math.cos(ay)).multiplyScalar(hr * k).add(new THREE.Vector3(0, hy, 0));
  const FACE = 0.35; // face turned a little toward travel direction
  if (has(1)) [-0.3, 0.3].forEach(a => {
    const p = onHead(a + FACE, 0.2, 0.97); body.add(part(GEO.sphL, coal, p.toArray(), [hr * 0.12, hr * 0.15, hr * 0.12]));
    const s = onHead(a + FACE + 0.04, 0.26, 1.08); body.add(part(GEO.sphL, GL(0xffffff), s.toArray(), hr * 0.035));
  });
  if (has(2)) {
    const dir = onHead(FACE, -0.02).sub(new THREE.Vector3(0, hy, 0)).normalize();
    const nose = part(GEO.cone, M(C.orange), [0, 0, 0], [hr * 0.14, hr * 0.85, hr * 0.14]);
    nose.quaternion.setFromUnitVectors(_up, dir); nose.position.set(0, hy, 0).add(dir.clone().multiplyScalar(hr * 1.3)); body.add(nose);
  }
  if (has(3)) for (let i = 0; i < 5; i++) { const t = (i - 2) / 2; body.add(part(GEO.sphL, coal, onHead(FACE + t * 0.38, -0.3 + t * t * 0.1, 0.98).toArray(), hr * 0.065)); }
  const arms = [];
  if (has(5)) [-1, 1].forEach(sd => {
    const base = [sd * torso.r * 0.82, torso.y + torso.r * 0.25, 0];
    const tip = [sd * (torso.r + 0.85), torso.y + torso.r * 0.25 + 0.55, 0.05];
    const a = new THREE.Group(); a.add(stick(GEO.cylL, M(0x6b4226), base, tip, 0.04));
    const mid = [lerp(base[0], tip[0], 0.6), lerp(base[1], tip[1], 0.6), 0];
    a.add(stick(GEO.cylL, M(0x6b4226), mid, [mid[0] + sd * 0.12, mid[1] + 0.28, 0], 0.025));
    a.add(stick(GEO.cylL, M(0x6b4226), tip, [tip[0] + sd * 0.18, tip[1] + 0.05, 0.02], 0.022));
    a.add(stick(GEO.cylL, M(0x6b4226), tip, [tip[0] + sd * 0.05, tip[1] + 0.2, 0], 0.022));
    if (has(10)) { a.add(part(GEO.sph, M(C.red), tip, 0.15)); a.add(part(GEO.sphL, M(C.red), [tip[0] - sd * 0.06, tip[1] + 0.13, 0.04], [0.06, 0.09, 0.06])); a.add(part(GEO.cyl, M(C.white), [tip[0] - sd * 0.1, tip[1] - 0.1, 0], [0.12, 0.08, 0.12], [0, 0, sd * 0.6])); }
    body.add(a); arms.push(a);
  });
  const tails = [];
  if (has(6)) {
    const ny = hy - hr * 0.82;
    const scarf = MT(stripeTex('#e8364f', '#2a9d74', 3, [6, 1]));
    body.add(part(GEO.tor, scarf, [0, ny, 0], [hr * 0.92, hr * 0.92, hr * 1.2], [Math.PI / 2, 0, 0]));
    [-0.13, 0.13].forEach((x, i) => {
      const tg = new THREE.Group(); tg.position.set(-hr * 0.55 + x * 0.6, ny, hr * 0.55); tg.add(part(GEO.box, scarf, [0, -0.28, 0], [0.18, 0.56, 0.06]));
      for (let f = 0; f < 3; f++) tg.add(part(GEO.box, M(C.gold), [-0.06 + f * 0.06, -0.6, 0], [0.03, 0.08, 0.03]));
      tg.rotation.z = -0.3 - i * 0.2; body.add(tg); tails.push(tg);
    });
  }
  if (has(8)) for (let i = 0; i < 3; i++) { const a = 0.45 - i * 0.42; const p = new THREE.Vector3(Math.sin(FACE) * Math.cos(a), Math.sin(a), Math.cos(FACE) * Math.cos(a)).multiplyScalar(torso.r).add(new THREE.Vector3(0, torso.y, 0)); body.add(part(GEO.sphL, coal, p.toArray(), torso.r * 0.09)); }
  let top = hy + hr;
  if (has(9)) {
    const hat = new THREE.Group(); hat.position.set(0, hy + hr * 0.82, 0); hat.rotation.z = -0.18; hat.rotation.x = -0.05;
    hat.add(part(GEO.cyl, M(0x2b2740), [0, 0, 0], [hr * 1.05, 0.05, hr * 1.05]));
    hat.add(part(GEO.cyl, M(0x2b2740), [0, hr * 0.55, 0], [hr * 0.68, hr * 1.1, hr * 0.68]));
    hat.add(part(GEO.cyl, M(C.red), [0, hr * 0.14, 0], [hr * 0.7, hr * 0.2, hr * 0.7]));
    if (has(11)) {
      [[-0.5, 0.4], [0.5, -0.4]].forEach(([x, r]) => hat.add(part(GEO.sphL, M(0x1f8a4e), [hr * 0.3 + x * 0.08, hr * 0.2, hr * 0.68], [0.12, 0.05, 0.02], [0, 0, r])));
      [[0, 0], [0.06, 0.05], [-0.05, 0.06]].forEach(([x, y]) => hat.add(part(GEO.sphL, M(C.red), [hr * 0.3 + x, hr * 0.22 + y, hr * 0.72], 0.045)));
    }
    body.add(hat); top = hy + hr * 0.82 + hr * 1.1;
  }
  let aura = null;
  if (has(12)) {
    aura = new THREE.Group();
    for (let i = 0; i < 18; i++) { const s = part(GEO.oct, GL(i % 3 ? 0xffffff : 0xffe08a), [0, 0, 0], 0.05 + (i % 3) * 0.02); s.userData.a = i / 18 * TAU; s.userData.h = rr(-0.6, 1.0); aura.add(s); }
    body.add(aura);
  }
  const bottom = -0.72, center = (top + bottom) / 2;
  body.position.y = -center;
  const R = Math.max(0.72, (top - bottom) / 2 * 0.92);
  return { root, spin, body, R, arms, tails, aura, form, height: top - bottom };
}
function animateSnowman(h, t) {
  h.tails.forEach((tg, i) => { tg.rotation.z = -0.4 - i * 0.2 + Math.sin(t * 14 + i) * 0.25; });
  h.arms.forEach((a, i) => { a.rotation.z = Math.sin(t * 3 + i * 2) * 0.08; });
  if (h.aura) h.aura.children.forEach((s, i) => { const a = s.userData.a + t * (0.8 + (i % 3) * 0.3); s.position.set(Math.cos(a) * 1.0, h.height * 0.35 + s.userData.h + Math.sin(t * 2 + i) * 0.15, Math.sin(a) * 1.0); s.rotation.y = t * 3; });
}

// ================= interactive & decorative builders =================
function buildPresent(i = 0, withBow = true) {
  const g = new THREE.Group(); const wrap = MT(wrapTex(i)), rib = M(RIBBONS[i % 5]);
  g.add(part(GEO.box, wrap, [0, 0.42, 0], [0.86, 0.84, 0.86]));
  g.add(part(GEO.box, rib, [0, 0.42, 0], [0.88, 0.85, 0.15])); g.add(part(GEO.box, rib, [0, 0.42, 0], [0.15, 0.85, 0.88]));
  const lid = new THREE.Group(); lid.position.y = 0.9;
  lid.add(part(GEO.box, wrap, [0, 0, 0], [0.96, 0.16, 0.96]));
  lid.add(part(GEO.box, rib, [0, 0, 0], [0.98, 0.17, 0.16])); lid.add(part(GEO.box, rib, [0, 0, 0], [0.16, 0.17, 0.98]));
  if (withBow) {
    lid.add(part(GEO.tor, rib, [-0.16, 0.18, 0], [0.18, 0.14, 0.2], [0, 0, 0.5])); lid.add(part(GEO.tor, rib, [0.16, 0.18, 0], [0.18, 0.14, 0.2], [0, 0, -0.5]));
    lid.add(part(GEO.sphL, rib, [0, 0.12, 0], 0.08));
  }
  g.add(lid); g.userData.lid = lid; return g;
}
function buildElf(v = 0) {
  const g = new THREE.Group(); const suit = v % 2 ? C.red : C.green, hatC = v % 2 ? C.green : C.red;
  const legs = MT(stripeTex('#ffffff', v % 2 ? '#2a9d74' : '#e8364f', 3, [2, 2]));
  [-0.12, 0.12].forEach(x => { g.add(part(GEO.cylL, legs, [x, 0.22, 0], [0.065, 0.36, 0.065])); g.add(part(GEO.sphL, M(C.greenD), [x + 0.05, 0.05, 0.03], [0.1, 0.07, 0.15])); g.add(part(GEO.sphL, M(C.gold), [x + 0.13, 0.1, 0.03], 0.03)); });
  g.add(part(GEO.sph, M(suit), [0, 0.6, 0], [0.3, 0.32, 0.26]));
  g.add(part(GEO.cyl, M(C.black), [0, 0.5, 0], [0.3, 0.07, 0.26]));
  g.add(part(GEO.box, M(C.gold), [0, 0.5, 0.26], [0.11, 0.09, 0.03]));
  g.add(part(GEO.cone, M(hatC), [0, 0.87, 0], [0.27, 0.14, 0.27], [Math.PI, 0, 0]));
  const mkArm = sd => { const a = new THREE.Group(); a.position.set(sd * 0.27, 0.74, 0); a.add(part(GEO.sphL, M(suit), [0, -0.15, 0], [0.07, 0.17, 0.07])); a.add(part(GEO.sphL, M(C.skin), [0, -0.33, 0], 0.07)); a.rotation.z = sd * 0.45; g.add(a); return a; };
  const armL = mkArm(-1), armR = mkArm(1);
  const head = new THREE.Group(); head.position.y = 1.1; g.add(head);
  head.add(part(GEO.sph, M(C.skin), [0, 0, 0], 0.24));
  [-1, 1].forEach(sd => { head.add(part(GEO.coneL, M(C.skin), [sd * 0.25, 0.04, 0], [0.06, 0.22, 0.05], [0, 0, -sd * (Math.PI / 2 - 0.45)])); head.add(part(GEO.sphL, M(C.black), [sd * 0.08, 0.03, 0.21], [0.035, 0.045, 0.03])); head.add(part(GEO.sphL, M(C.cheek), [sd * 0.14, -0.06, 0.18], [0.05, 0.035, 0.02])); });
  head.add(part(GEO.arc, M(0x9b3b3b), [0, -0.07, 0.22], 0.06, [0, 0, Math.PI]));
  const hat = new THREE.Group(); hat.position.set(0, 0.14, 0); hat.rotation.z = -0.35; head.add(hat);
  hat.add(part(GEO.tor, M(C.white), [0, 0, 0], [0.24, 0.24, 0.3], [Math.PI / 2, 0, 0]));
  hat.add(part(GEO.cone, M(hatC), [0, 0.28, 0], [0.23, 0.54, 0.23]));
  hat.add(part(GEO.sphL, M(C.white), [0, 0.57, 0], 0.075));
  g.userData = { armL, armR, head }; return g;
}
function buildReindeer() {
  const outer = new THREE.Group(), g = new THREE.Group(); outer.add(g); g.rotation.y = Math.PI;
  const fur = M(0x9a6a43), light = M(0xe7cfa9), dark = M(0x3b2618), ant = M(0xd9b98a);
  g.add(part(GEO.sph, fur, [0, 1.15, 0], [0.75, 0.42, 0.38])); g.add(part(GEO.sph, light, [0.05, 1.02, 0], [0.55, 0.28, 0.3]));
  const legs = [];
  [[0.45, 0.2], [0.45, -0.2], [-0.45, 0.2], [-0.45, -0.2]].forEach(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 1.0, z); l.add(part(GEO.cylL, fur, [0, -0.4, 0], [0.075, 0.8, 0.075])); l.add(part(GEO.cylL, dark, [0, -0.88, 0], [0.085, 0.14, 0.085])); g.add(l); legs.push(l); });
  g.add(stick(GEO.cylL, fur, [0.5, 1.3, 0], [0.8, 1.75, 0], 0.15));
  const head = new THREE.Group(); head.position.set(0.86, 1.88, 0); g.add(head);
  head.add(part(GEO.sph, fur, [0, 0, 0], [0.26, 0.22, 0.2])); head.add(part(GEO.sph, light, [0.22, -0.06, 0], [0.18, 0.13, 0.15]));
  head.add(part(GEO.sphL, M(0x4a2a20), [0.38, -0.03, 0], 0.065));
  [-1, 1].forEach(sd => {
    head.add(part(GEO.sphL, M(C.black), [0.12, 0.08, sd * 0.15], 0.04)); head.add(part(GEO.sphL, M(0xffffff), [0.14, 0.1, sd * 0.17], 0.012));
    head.add(part(GEO.coneL, fur, [-0.08, 0.16, sd * 0.2], [0.06, 0.18, 0.04], [sd * 0.9, 0, 0.3]));
    const b = [-0.02, 0.18, sd * 0.1], t1 = [-0.18, 0.62, sd * 0.32];
    head.add(stick(GEO.cylL, ant, b, t1, 0.035)); head.add(stick(GEO.cylL, ant, [-0.08, 0.36, sd * 0.19], [0.1, 0.55, sd * 0.25], 0.028));
    head.add(stick(GEO.cylL, ant, [-0.14, 0.52, sd * 0.27], [-0.36, 0.68, sd * 0.36], 0.025)); head.add(stick(GEO.cylL, ant, t1, [-0.12, 0.78, sd * 0.36], 0.025));
  });
  g.add(part(GEO.tor, M(C.red), [0.66, 1.55, 0], [0.17, 0.17, 0.2], [Math.PI / 2, 0, -0.6]));
  g.add(part(GEO.sphL, M(C.gold), [0.78, 1.42, 0.1], 0.07));
  g.add(part(GEO.sphL, M(0xfff7ea), [-0.76, 1.3, 0], 0.11));
  outer.userData = { head, legs }; return outer;
}
function buildGinger() {
  const g = new THREE.Group(); const gb = M(C.ginger), ic = M(0xffffff), z = 0.09;
  g.add(part(GEO.sph, gb, [0, 1.0, 0], [0.26, 0.26, z])); g.add(part(GEO.sph, gb, [0, 0.56, 0], [0.27, 0.32, z]));
  [-1, 1].forEach(sd => {
    g.add(part(GEO.sph, gb, [sd * 0.33, 0.68, 0], [0.2, 0.09, z], [0, 0, sd * 0.35]));
    g.add(part(GEO.sph, gb, [sd * 0.14, 0.2, 0], [0.1, 0.24, z], [0, 0, sd * 0.2]));
    g.add(part(GEO.sphL, ic, [sd * 0.08, 1.04, 0.08], 0.035));
    g.add(part(GEO.arc, ic, [sd * 0.42, 0.72, 0.07], 0.06, [0, 0, Math.PI / 2 * sd]));
    g.add(part(GEO.arc, ic, [sd * 0.17, 0.05, 0.07], 0.06, [0, 0, Math.PI]));
  });
  g.add(part(GEO.arc, ic, [0, 0.96, 0.08], 0.09, [0, 0, Math.PI]));
  g.add(part(GEO.sphL, M(C.red), [0, 0.66, 0.08], 0.05)); g.add(part(GEO.sphL, M(C.green), [0, 0.5, 0.08], 0.05));
  return g;
}
function buildGumdrop() {
  const col = pick([C.red, C.green, C.gold, C.purple, 0x3fc1ff, 0xff7ab8]);
  const g = new THREE.Group(), top = new THREE.Group(); g.add(top);
  top.add(part(GEO.half, M(col), [0, 0, 0], [1.15, 0.95, 1.15]));
  for (let i = 0; i < 16; i++) { const a = rr(0, TAU), e = rr(0.15, 1.35); const p = new THREE.Vector3(Math.cos(a) * Math.cos(e) * 1.15, Math.sin(e) * 0.95, Math.sin(a) * Math.cos(e) * 1.15); top.add(part(GEO.box, M(0xffffff), p.toArray(), 0.06, [rr(0, 3), rr(0, 3), 0])); }
  g.userData.top = top; return g;
}
function buildCocoa() {
  const g = new THREE.Group();
  g.add(part(GEO.cyl, M(C.red), [0, 0.55, 0], [0.55, 1.1, 0.55]));
  g.add(part(GEO.cyl, MT(stripeTex('#ffffff', '#2a9d74', 4, [4, 1])), [0, 0.72, 0], [0.56, 0.22, 0.56]));
  g.add(part(GEO.cyl, M(C.cocoa), [0, 1.08, 0], [0.5, 0.04, 0.5]));
  [[0.15, 0.1], [-0.18, -0.05], [0.0, -0.22]].forEach(([x, z], i) => g.add(part(GEO.box, M(0xffffff), [x, 1.13, z], 0.17, [0.2 * i, i, 0.3])));
  g.add(part(GEO.tor, M(C.red), [0.6, 0.6, 0], [0.26, 0.28, 0.4]));
  const steam = new THREE.Group(); g.add(steam);
  for (let i = 0; i < 4; i++) steam.add(part(GEO.sphL, GL(0xffffff, 0.5), [0, 1.3, 0], 0.16));
  g.userData.steam = steam; return g;
}
function buildCoal() {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) g.add(part(GEO.dodec, M(C.coal), [rr(-0.6, 0.6), rr(0.15, 0.35) + (i > 5 ? 0.35 : 0), rr(-0.5, 0.5)], rr(0.22, 0.36), [rr(0, 3), rr(0, 3), 0]));
  g.add(part(GEO.dodec, M(0x3a3446), [0, 0.75, 0], 0.3, [0.4, 0.3, 0]));
  [-1, 1].forEach(sd => g.add(part(GEO.sphL, GL(0xff7a3a), [sd * 0.1, 0.8, 0.27], 0.035)));
  return g;
}
function buildBalloonGift() {
  const g = new THREE.Group(); const col = pick([C.red, 0x3fc1ff, C.gold, C.purple]);
  const pr = buildPresent(ri(0, 4), false); pr.scale.setScalar(0.55); pr.position.y = -1.0; g.add(pr);
  g.add(part(GEO.cylL, M(0xffffff), [0, -0.1, 0], [0.012, 0.9, 0.012]));
  g.add(part(GEO.sph, M(col), [0, 0.75, 0], [0.55, 0.65, 0.55]));
  g.add(part(GEO.coneL, M(col), [0, 0.1, 0], [0.08, 0.12, 0.08], [Math.PI, 0, 0]));
  g.add(part(GEO.sphL, GL(0xffffff, 0.6), [-0.2, 0.98, 0.35], [0.1, 0.16, 0.05]));
  g.userData.present = pr; return g;
}
let glowMat = null;
function glowSprite(color, scale) {
  if (!glowMat) glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(glowMat.clone()); s.material.color.set(color); s.scale.setScalar(scale); return s;
}
function buildGoldenBell(withGlow = true) {
  const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
  inner.add(part(BELL_GEO, M(C.gold, { emissive: 0x5a3a00 }), [0, -0.5, 0], 1.0));
  inner.add(part(GEO.sphL, M(0xb98a1a), [0, -0.56, 0], 0.12));
  inner.add(part(GEO.tor, M(C.red), [-0.17, 0.5, 0], [0.16, 0.12, 0.2], [0, 0, 0.6])); inner.add(part(GEO.tor, M(C.red), [0.17, 0.5, 0], [0.16, 0.12, 0.2], [0, 0, -0.6]));
  inner.add(part(GEO.sphL, M(C.red), [0, 0.47, 0], 0.08));
  [[-0.25, 0.4], [0.25, -0.4]].forEach(([x, r]) => inner.add(part(GEO.sphL, M(0x1f8a4e), [x * 0.6, 0.55, -0.05], [0.18, 0.07, 0.02], [0, 0, r])));
  if (withGlow) g.add(glowSprite(0xffd76a, 3.2));
  g.userData.inner = inner; return g;
}
function buildSanta(g) {
  g.add(part(GEO.sph, M(C.red), [0, 0.45, 0], [0.42, 0.45, 0.4])); g.add(part(GEO.cyl, M(C.black), [0, 0.32, 0], [0.43, 0.09, 0.41]));
  g.add(part(GEO.box, M(C.gold), [0.4, 0.32, 0], [0.04, 0.11, 0.14]));
  g.add(part(GEO.sph, M(C.skin), [0.02, 0.98, 0], 0.22));
  g.add(part(GEO.sph, M(0xffffff), [0.1, 0.85, 0], [0.18, 0.22, 0.2])); g.add(part(GEO.sphL, M(0xffffff), [0.2, 0.93, 0], [0.06, 0.04, 0.16]));
  g.add(part(GEO.sphL, M(C.cheek), [0.22, 0.98, 0], 0.055));
  [-1, 1].forEach(sd => g.add(part(GEO.sphL, M(C.black), [0.18, 1.04, sd * 0.08], 0.03)));
  const hat = new THREE.Group(); hat.position.set(0, 1.12, 0); hat.rotation.z = 0.4; g.add(hat);
  hat.add(part(GEO.tor, M(0xffffff), [0, 0, 0], [0.21, 0.21, 0.3], [Math.PI / 2, 0, 0])); hat.add(part(GEO.cone, M(C.red), [0, 0.25, 0], [0.2, 0.5, 0.2])); hat.add(part(GEO.sphL, M(0xffffff), [0, 0.52, 0], 0.07));
  const arm = new THREE.Group(); arm.position.set(0.05, 0.62, 0.32); arm.add(part(GEO.sphL, M(C.red), [0, 0.18, 0], [0.09, 0.22, 0.09])); arm.add(part(GEO.sphL, M(0xffffff), [0, 0.42, 0], 0.09)); g.add(arm);
  return arm;
}
function buildSleigh(withSanta = true) {
  const g = new THREE.Group(); const red = M(C.red), gold = M(C.gold);
  g.add(part(GEO.box, red, [0, 0.6, 0], [1.9, 0.62, 1.1])); g.add(part(GEO.box, red, [-0.85, 1.0, 0], [0.3, 0.6, 1.1]));
  g.add(part(GEO.halfCyl, red, [0.95, 0.6, 0], [0.34, 1.1, 0.31], [Math.PI / 2, 0, -Math.PI / 2]));
  g.add(part(GEO.box, gold, [0, 0.93, 0.56], [1.95, 0.07, 0.04])); g.add(part(GEO.box, gold, [0, 0.93, -0.56], [1.95, 0.07, 0.04]));
  [-0.45, 0.45].forEach(z => { g.add(part(GEO.box, gold, [0, 0.06, z], [2.3, 0.07, 0.07])); g.add(part(GEO.arc, gold, [1.15, 0.3, z], [0.26, 0.26, 0.4], [0, 0, -Math.PI / 2])); [-0.6, 0.5].forEach(x => g.add(part(GEO.cylL, gold, [x, 0.18, z], [0.03, 0.25, 0.03]))); });
  g.add(part(GEO.sph, M(0x8a5a34), [-0.55, 1.2, 0], [0.45, 0.5, 0.42]));
  [[-0.5, 1.6, 0.1, 0], [-0.75, 1.5, -0.15, 2]].forEach(([x, y, z, i]) => { const p = buildPresent(i); p.scale.setScalar(0.4); p.position.set(x, y, z); p.rotation.set(0.2, i, 0.3); g.add(p); });
  let arm = null;
  if (withSanta) { const s = new THREE.Group(); s.position.set(0.25, 0.7, 0); g.add(s); arm = buildSanta(s); }
  g.userData.arm = arm; return g;
}
function buildTree(seed = 0, lights = true) {
  const R = mulberry32(seed * 977 + 13); const g = new THREE.Group();
  g.add(part(GEO.cylL, M(0x6b4226), [0, 0.45, 0], [0.18, 0.9, 0.18]));
  const tiers = 4, green = seed % 3 === 2 ? C.pineL : C.pine;
  for (let i = 0; i < tiers; i++) {
    const r = 1.45 - i * 0.3, h = 1.35 - i * 0.12, y = 0.85 + i * 0.72;
    g.add(part(GEO.cone, M(green), [0, y + h / 2, 0], [r, h, r], [0, R() * 3, 0]));
    g.add(part(GEO.cone, M(C.white), [0, y + h * 0.78, 0], [r * 0.5, h * 0.42, r * 0.5]));
    if (lights) for (let k = 0; k < 4; k++) { const a = R() * TAU, yy = y + h * (0.15 + R() * 0.3), rr2 = r * (1 - (yy - y) / h) * 1.02; g.add(part(GEO.sphL, GL(LIGHT_COLS[Math.floor(R() * LIGHT_COLS.length)]), [Math.cos(a) * rr2, yy, Math.sin(a) * rr2], 0.075)); }
  }
  if (lights) g.add(part(GEO.oct, GL(0xffe07a), [0, 0.85 + 3 * 0.72 + 1.15, 0], [0.22, 0.28, 0.1]));
  return g;
}
function buildHouse(seed = 0, opts = {}) {
  const walls = opts.wall || [0xd9666f, 0x6fa2d9, 0xe8c26a, 0x8fcf9c, 0xc8a2e8][seed % 5];
  const roofC = opts.roof || [0x7a3b5e, 0x34507a, 0x8a4b2a, 0x3b6b4f, 0x5b3f8a][seed % 5];
  const g = new THREE.Group();
  g.add(part(GEO.box, M(walls), [0, 1.15, 0], [3, 2.3, 2.8]));
  g.add(part(ROOF, M(roofC), [0, 2.3, 0], 1)); g.add(part(ROOF_SNOW, M(C.white), [0, 2.38, 0], 1));
  g.add(part(GEO.box, M(0xb5543e), [0.8, 3.3, -0.3], [0.45, 1.0, 0.45])); g.add(part(GEO.box, M(C.white), [0.8, 3.85, -0.3], [0.55, 0.14, 0.55]));
  const win = GL(0xffd98a), frame = M(0xffffff);
  [-0.85, 0.85].forEach(x => { g.add(part(GEO.plane, win, [x, 1.35, 1.41], [0.62, 0.62, 1])); g.add(part(GEO.box, frame, [x, 1.35, 1.42], [0.06, 0.66, 0.03])); g.add(part(GEO.box, frame, [x, 1.35, 1.42], [0.66, 0.06, 0.03])); g.add(part(GEO.box, M(C.white), [x, 1.0, 1.45], [0.75, 0.1, 0.12])); });
  g.add(part(GEO.box, M(0x6b3a22), [0, 0.6, 1.41], [0.62, 1.2, 0.05]));
  g.add(part(GEO.tor, M(C.pine), [0, 0.85, 1.46], [0.17, 0.17, 0.3])); g.add(part(GEO.sphL, M(C.red), [0, 0.7, 1.48], 0.05));
  for (let i = 0; i < 9; i++) g.add(part(GEO.coneL, M(C.ice), [-1.55 + i * 0.39, 2.22, 1.62], [0.06, rr(0.15, 0.4), 0.06], [Math.PI, 0, 0]));
  for (let i = 0; i < 8; i++) g.add(part(GEO.sphL, GL(LIGHT_COLS[i % LIGHT_COLS.length]), [-1.5 + i * 0.43, 2.3 + Math.sin(i * 1.3) * 0.04, 1.64], 0.06));
  if (opts.sign) { const s = part(GEO.plane, MT(opts.sign), [0, 2.75, 1.45], [1.6, 0.6, 1]); g.add(s); }
  return g;
}
function buildLamp() {
  const g = new THREE.Group();
  g.add(part(GEO.cylL, MT(stripeTex('#ffffff', '#e8364f', 3, [1, 3])), [0, 1.3, 0], [0.07, 2.6, 0.07]));
  g.add(part(GEO.cyl, M(0x2b2740), [0, 2.65, 0], [0.18, 0.08, 0.18])); g.add(part(GEO.sphL, GL(0xffe2a0), [0, 2.85, 0], 0.18));
  g.add(part(GEO.cone, M(0x2b2740), [0, 3.1, 0], [0.24, 0.22, 0.24])); g.add(part(GEO.cone, M(C.white), [0, 3.17, 0], [0.2, 0.12, 0.2]));
  g.add(part(GEO.tor, M(C.pine), [0, 2.3, 0], [0.16, 0.16, 0.3], [Math.PI / 2, 0, 0])); g.add(part(GEO.sphL, M(C.red), [0, 2.2, 0.17], 0.06));
  return g;
}
function buildDecoSnowman() {
  const g = new THREE.Group(); const s = M(C.white);
  g.add(part(GEO.sph, s, [0, 0.55, 0], 0.6)); g.add(part(GEO.sph, s, [0, 1.3, 0], 0.42)); g.add(part(GEO.sph, s, [0, 1.85, 0], 0.3));
  [-1, 1].forEach(sd => g.add(part(GEO.sphL, M(C.coal), [sd * 0.1, 1.92, 0.27], 0.04)));
  g.add(part(GEO.cone, M(C.orange), [0, 1.84, 0.4], [0.05, 0.28, 0.05], [Math.PI / 2, 0, 0]));
  g.add(part(GEO.tor, M(C.blue), [0, 1.6, 0], [0.3, 0.3, 0.4], [Math.PI / 2, 0, 0]));
  g.add(stick(GEO.cylL, M(0x6b4226), [0.35, 1.35, 0], [0.9, 1.75, 0], 0.03)); g.add(stick(GEO.cylL, M(0x6b4226), [-0.35, 1.35, 0], [-0.85, 1.6, 0], 0.03));
  g.add(part(GEO.cyl, M(C.red), [0, 2.12, 0], [0.24, 0.06, 0.24])); g.add(part(GEO.cone, M(C.red), [0, 2.32, 0], [0.18, 0.35, 0.18]));
  return g;
}
function buildBigCane() { const g = new THREE.Group(); const c = part(caneGeo(4.5, 0.8, 0.28), caneMat()); c.rotation.y = rr(0, TAU); g.add(c); g.add(part(GEO.half, M(C.white), [0, 0, 0], [0.7, 0.35, 0.7])); return g; }
function buildGumHill() { const g = new THREE.Group(); const col = pick([0xff9ec4, 0x9fe3c9, 0xffd98a, 0xb9a6ff, 0x8fd3ff]); g.add(part(GEO.half, M(col), [0, 0, 0], [rr(2.5, 4), rr(2, 3.4), rr(2.5, 4)])); g.add(part(GEO.half, M(C.white), [0, rr(1.6, 2.4), 0], [1.2, 0.7, 1.2])); return g; }
function buildLolli() {
  const g = new THREE.Group(); g.add(part(GEO.cylL, M(0xffffff), [0, 1.4, 0], [0.08, 2.8, 0.08]));
  const disc = MT(swirlTex, 0xffffff, THREE.DoubleSide); g.add(part(GEO.circle, disc, [0, 3.3, 0.12], 0.95)); g.add(part(GEO.cyl, M(0xffb3c6), [0, 3.3, 0], [0.95, 0.22, 0.95], [Math.PI / 2, 0, 0]));
  g.add(part(GEO.circle, disc, [0, 3.3, -0.12], 0.95, [0, Math.PI, 0])); return g;
}
function buildWorkshop() { const g = buildHouse(0, { wall: 0xc8413f, roof: 0x2a6f55, sign: bannerTex('TOYS', '') }); g.scale.set(1.5, 1.4, 1.3); const o = new THREE.Group(); o.add(g); return o; }
function buildSoldier() {
  const g = new THREE.Group();
  [-0.1, 0.1].forEach(x => g.add(part(GEO.cylL, M(0x2b4a9a), [x, 0.35, 0], [0.08, 0.7, 0.08])));
  g.add(part(GEO.cyl, M(C.red), [0, 0.95, 0], [0.22, 0.6, 0.18])); g.add(part(GEO.cyl, M(C.white), [0, 0.7, 0], [0.23, 0.07, 0.19]));
  [0.85, 1.0, 1.15].forEach(y => g.add(part(GEO.sphL, M(C.gold), [0, y, 0.18], 0.035)));
  g.add(part(GEO.sph, M(C.skin), [0, 1.42, 0], 0.17)); g.add(part(GEO.cyl, M(C.black), [0, 1.72, 0], [0.17, 0.42, 0.17]));
  g.add(part(GEO.sphL, M(C.cheek), [0.1, 1.38, 0.13], 0.04)); g.add(part(GEO.sphL, M(C.cheek), [-0.1, 1.38, 0.13], 0.04));
  g.scale.setScalar(1.3); const o = new THREE.Group(); o.add(g); return o;
}
function buildPresentPile() { const g = new THREE.Group(); [[0, 0, 0, 1.2], [1.0, 0, 0.3, 0.9], [0.4, 1.0, 0.1, 0.8], [-0.9, 0, -0.2, 0.75]].forEach(([x, y, z, s], i) => { const p = buildPresent(i + ri(0, 4)); p.scale.setScalar(s); p.position.set(x, y, z); p.rotation.y = rr(-0.5, 0.5); g.add(p); }); return g; }
function buildCrystal(n = 6) {
  const g = new THREE.Group(); const m = new THREE.MeshToonMaterial({ color: 0x9feaff, emissive: 0x1d5fa0, gradientMap: TOON, transparent: true, opacity: 0.88 });
  for (let i = 0; i < n; i++) { const h = rr(1.2, 3.2) * (i === 0 ? 1.4 : 1); g.add(part(GEO.oct, m, [rr(-0.7, 0.7), h * 0.45, rr(-0.5, 0.5)], [rr(0.3, 0.5), h, rr(0.3, 0.5)], [rr(-0.3, 0.3), rr(0, 3), rr(-0.3, 0.3)])); }
  g.add(part(GEO.half, M(C.white), [0, 0, 0], [1.3, 0.3, 1.1])); return g;
}
function buildIgloo() {
  const g = new THREE.Group(); g.add(part(GEO.half, M(0xeaf4ff), [0, 0, 0], [2, 1.7, 2]));
  g.add(part(GEO.halfCyl, M(0xeaf4ff), [0, 0, 2.0], [0.8, 1.2, 0.85], [Math.PI / 2, 0, 0]));
  g.add(part(GEO.circle, GL(0xffc77a), [0, 0.45, 2.61], [0.5, 0.55, 1]));
  for (let i = 1; i < 4; i++) g.add(part(GEO.tor, M(0xcfe2f5), [0, i * 0.42, 0], [Math.sqrt(4 - Math.pow(i * 0.42 / 1.7 * 2, 2)) * 0.98, Math.sqrt(4 - Math.pow(i * 0.42 / 1.7 * 2, 2)) * 0.98, 0.15], [Math.PI / 2, 0, 0]));
  return g;
}
function buildCabin() { return buildHouse(2, { wall: 0x8a5a34, roof: 0x4a2f1f }); }
function buildFence() {
  const g = new THREE.Group(); const st = MT(stripeTex('#ffffff', '#e8364f', 3, [1, 2]));
  [0, 3, 6, 9].forEach(x => { g.add(part(GEO.cylL, st, [x, 0.55, 0], [0.08, 1.1, 0.08])); g.add(part(GEO.sphL, M(C.white), [x, 1.12, 0], 0.12)); });
  [0.4, 0.85].forEach(y => g.add(part(GEO.cylL, st, [6, y, 0], [0.05, 12, 0.05], [0, 0, Math.PI / 2])));
  return g;
}
function buildSign(text) {
  const g = new THREE.Group();
  g.add(part(GEO.cylL, M(0x6b4226), [0, 0.9, 0], [0.08, 1.8, 0.08]));
  g.add(part(GEO.plane, MT(signTex(text)), [0, 1.65, 0.07], [1.6, 0.8, 1]));
  g.add(part(GEO.box, M(0x6b4226), [0, 1.65, 0], [1.66, 0.86, 0.1]));
  g.add(part(GEO.box, M(C.white), [0, 2.1, 0], [1.75, 0.12, 0.2]));
  return g;
}
// bonus-only small things
function buildCandy(i = 0) { const col = [C.red, C.green, C.purple, 0x3fc1ff, C.gold][i % 5]; const g = new THREE.Group(); const m = M(col); g.add(part(GEO.sph, MT(stripeTex('#ffffff', '#' + col.toString(16).padStart(6, '0'), 3, [2, 1])), [0, 0.3, 0], [0.42, 0.28, 0.28])); [-1, 1].forEach(sd => g.add(part(GEO.coneL, m, [sd * 0.55, 0.3, 0], [0.2, 0.3, 0.2], [0, 0, sd * Math.PI / 2]))); return g; }
function buildOrnament(i = 0) { const col = [C.red, C.gold, 0x3fc1ff, C.green, C.purple][i % 5]; const g = new THREE.Group(); g.add(part(GEO.sph, M(col), [0, 0.4, 0], 0.4)); g.add(part(GEO.tor, M(0xffffff), [0, 0.4, 0], [0.4, 0.4, 0.15], [Math.PI / 2, 0, 0])); g.add(part(GEO.cyl, M(C.gold), [0, 0.84, 0], [0.12, 0.1, 0.12])); g.add(part(GEO.tor, M(C.gold), [0, 0.95, 0], 0.07)); g.add(part(GEO.sphL, GL(0xffffff, 0.7), [-0.14, 0.55, 0.3], [0.07, 0.1, 0.04])); return g; }
function buildCookie() { const g = new THREE.Group(); g.add(part(GEO.cyl, M(0xd9a35e), [0, 0.08, 0], [0.45, 0.14, 0.45])); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3, r = i % 2 ? 0.25 : 0.15; g.add(part(GEO.dodec, M(0x4a2a18), [Math.cos(a) * r, 0.17, Math.sin(a) * r], 0.06)); } return g; }
function buildSmallCane() { const g = new THREE.Group(); const c = part(caneGeo(1.1, 0.22, 0.07), caneMat()); g.add(c); return g; }
function buildPenguin() {
  const g = new THREE.Group();
  g.add(part(GEO.sph, M(0x22263a), [0, 0.55, 0], [0.4, 0.55, 0.38])); g.add(part(GEO.sph, M(0xffffff), [0, 0.5, 0.15], [0.3, 0.44, 0.26]));
  g.add(part(GEO.sph, M(0x22263a), [0, 1.15, 0], 0.28)); g.add(part(GEO.sph, M(0xffffff), [0, 1.13, 0.12], [0.2, 0.18, 0.18]));
  [-1, 1].forEach(sd => { g.add(part(GEO.sphL, M(C.black), [sd * 0.08, 1.18, 0.27], 0.035)); g.add(part(GEO.sph, M(0x22263a), [sd * 0.4, 0.6, 0], [0.08, 0.32, 0.16], [0, 0, sd * 0.3])); g.add(part(GEO.sphL, M(C.orange), [sd * 0.13, 0.04, 0.12], [0.11, 0.05, 0.16])); });
  g.add(part(GEO.cone, M(C.orange), [0, 1.08, 0.36], [0.06, 0.16, 0.06], [Math.PI / 2, 0, 0]));
  g.add(part(GEO.tor, M(C.red), [0, 0.92, 0], [0.26, 0.26, 0.4], [Math.PI / 2, 0, 0]));
  g.add(part(GEO.cone, M(C.red), [0, 1.42, 0], [0.18, 0.32, 0.18], [0, 0, 0.3])); g.add(part(GEO.sphL, M(0xffffff), [0.1, 1.58, 0], 0.06));
  return g;
}
function buildWreath() { const g = new THREE.Group(); g.add(part(GEO.tor, M(C.pine), [0, 0.7, 0], [0.55, 0.55, 0.9])); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; g.add(part(GEO.sphL, M(i % 3 ? C.red : C.gold), [Math.cos(a) * 0.55, 0.7 + Math.sin(a) * 0.55, 0.15], 0.07)); } g.add(part(GEO.tor, M(C.red), [-0.12, 0.18, 0.15], [0.12, 0.09, 0.15], [0, 0, 0.5])); g.add(part(GEO.tor, M(C.red), [0.12, 0.18, 0.15], [0.12, 0.09, 0.15], [0, 0, -0.5])); return g; }
function buildPalace() {
  const g = new THREE.Group(); const wall = M(0xdff3ff), roofM = new THREE.MeshToonMaterial({ color: 0x8fdcff, emissive: 0x1d4f90, gradientMap: TOON });
  g.add(part(GEO.box, wall, [0, 1.5, 0], [5, 3, 3]));
  [[-2.6, 0], [2.6, 0], [0, -1.4]].forEach(([x, z], i) => { const h = i === 2 ? 6 : 4.5; g.add(part(GEO.cyl, wall, [x, h / 2, z], [0.9, h, 0.9])); g.add(part(GEO.cone, roofM, [x, h + 1.0, z], [1.1, 2.0, 1.1])); g.add(part(GEO.oct, GL(0xffe07a), [x, h + 2.2, z], 0.2)); });
  g.add(part(GEO.halfCyl, GL(0x9fe0ff), [0, 0.9, 1.52], [0.8, 0.1, 1.2], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 6; i++) g.add(part(GEO.plane, GL(0xbfe9ff), [-1.8 + i * 0.72, 2.2, 1.52], [0.3, 0.5, 1]));
  return g;
}

// ================= prototype cache (baked for scenery and bonus items) =================
const protoCache = new Map();
function proto(key, build) {
  if (!protoCache.has(key)) { const raw = build(); const b = bake(raw); b.userData.m = measure(b); protoCache.set(key, b); }
  return protoCache.get(key);
}
const SCENERY = {
  house: v => proto('house' + v, () => buildHouse(v)),
  cabin: () => proto('cabin', buildCabin),
  tree: v => proto('tree' + v, () => buildTree(v, true)),
  treeFar: v => proto('treeF' + v, () => buildTree(v, false)),
  lamp: () => proto('lamp', buildLamp),
  deco: () => proto('deco', buildDecoSnowman),
  bigcane: v => proto('cane' + v, buildBigCane),
  gumhill: v => proto('gum' + v, buildGumHill),
  lolli: () => proto('lolli', buildLolli),
  workshop: () => proto('workshop', buildWorkshop),
  soldier: () => proto('soldier', buildSoldier),
  pile: v => proto('pile' + v, buildPresentPile),
  crystal: v => proto('crystal' + v, () => buildCrystal(6)),
  igloo: () => proto('igloo', buildIgloo),
  fence: () => proto('fence', buildFence),
  drift: v => proto('drift' + v, () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) g.add(part(GEO.half, M(C.white), [rr(-2, 2), 0, rr(-0.8, 0.8)], [rr(1, 2.2), rr(0.4, 0.9), rr(0.8, 1.4)])); return g; }),
  smalltree: v => proto('stree' + v, () => { const t = buildTree(v, true); t.scale.setScalar(0.55); const g = new THREE.Group(); g.add(t); return g; }),
  candy: v => proto('fcandy' + v, () => { const g = new THREE.Group(); const c = buildSmallCane(); c.scale.setScalar(1.3); g.add(c); const c2 = buildSmallCane(); c2.scale.setScalar(1.0); c2.position.set(0.8, 0, 0.2); c2.rotation.y = 2; g.add(c2); g.add(part(GEO.half, M(C.white), [0.3, 0, 0], [1.2, 0.35, 0.8])); return g; }),
};
function scenery(kind) { const v = ri(0, 3); return SCENERY[kind](v).clone(); }
