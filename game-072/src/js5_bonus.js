// ================= Snowball Bonanza (bonus round every 5 levels) =================
const BONUS_TIME = 40;
const B = { R: 0.6, x: 0, z: 0, vx: 0, speed: 0, time: BONUS_TIME, count: 0, items: [], props: [], nextZ: -12, nextSideZ: 20, steer: 0, bonkT: 0, bonkMsgT: 0, halfW: 16, tickT: 0, announced: new Set(), largest: '' };
const ballRoot = new THREE.Group(), ballSpin = new THREE.Group(); ballRoot.add(ballSpin);
const ballMesh = new THREE.Mesh(GEO.sph, makeSnowMat(0xf7faff, 0.09)); ballSpin.add(ballMesh);
ballRoot.visible = false; scene.add(ballRoot);
const BK = [
  ['candy', 'Wrapped candy', 0.22, v => buildCandy(v)], ['ornament', 'Ornament', 0.24, v => buildOrnament(v)], ['cookie', 'Cookie', 0.25, () => buildCookie()],
  ['bell', 'Jingle bell', 0.28, () => buildGoldenBell(false)], ['mug', 'Cocoa mug', 0.36, () => buildCocoa()], ['ginger', 'Gingerbread pal', 0.42, () => buildGinger()],
  ['cane', 'Candy cane', 0.46, () => buildSmallCane()], ['present', 'Present', 0.52, v => buildPresent(v)], ['penguin', 'Penguin', 0.64, () => buildPenguin()],
  ['elf', 'Elf', 0.78, v => buildElf(v)], ['wreath', 'Wreath', 0.72, () => buildWreath()], ['snowman', 'Snowman', 1.15, () => buildDecoSnowman()],
  ['reindeer', 'Reindeer', 1.45, () => buildReindeer()], ['tree', 'Pine tree', 2.3, v => buildTree(v, true)], ['sleigh', 'Sleigh', 2.2, () => buildSleigh(true)],
  ['house', 'Cottage', 3.6, v => buildHouse(v)], ['workshop', 'Toy workshop', 5.6, () => buildWorkshop()], ['palace', 'Ice palace', 9.5, () => buildPalace()],
];
const LIVELY = new Set(['elf', 'penguin', 'reindeer', 'ginger']);
const EAT_RATIO = 0.75;
function bkProto(i) { const [k, , , build] = BK[i]; const v = ri(0, 4); return proto('bk' + k + v, () => build(v)); }

function clearBonus() {
  B.items.forEach(it => scene.remove(it.m)); B.items.length = 0;
  B.props.forEach(o => scene.remove(o)); B.props.length = 0;
  while (ballSpin.children.length > 1) ballSpin.remove(ballSpin.children[1]);
}
function resetBonus() {
  clearFling(); clearBonus();
  hero.root.visible = false; sling.g.visible = false;
  B.R = 0.6; B.x = 0; B.z = 0; B.vx = 0; B.speed = 0; B.time = BONUS_TIME; B.count = 0; B.nextZ = -14; B.nextSideZ = 30; B.steer = 0; B.bonkT = 0; B.halfW = 16; B.announced = new Set(); B.largest = ''; B.largestSize = 0;
  ballRoot.visible = true; ballSpin.quaternion.identity(); ballRoot.position.set(0, B.R, 0); ballMesh.scale.setScalar(B.R);
  // the snowman's face rides along on the snowball
  const face = new THREE.Group();
  [-1, 1].forEach(sd => face.add(part(GEO.sphL, M(C.coal), [sd * 0.17, 0.2, 0.55], 0.075)));
  face.add(part(GEO.cone, M(C.orange), [0, 0.05, 0.75], [0.07, 0.4, 0.07], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 5; i++) { const t = (i - 2) / 2; face.add(part(GEO.sphL, M(C.coal), [t * 0.22, -0.15 + t * t * 0.06, 0.56], 0.045)); }
  face.scale.setScalar(B.R / 0.6); ballSpin.add(face);
  groundMat.uniforms.uAxis.value = 1;
  bonusSpawn(); bonusSide();
  bonusCam(0, true);
}
function pickKindFor(desired) {
  const scored = BK.map((b, i) => ({ i, d: Math.abs(Math.log(b[2] / desired)) })).sort((a, b) => a.d - b.d);
  return scored[Math.floor(rnd() * Math.min(3, scored.length) * rnd())].i;
}
function addBonusItem(x, z, desired) {
  const i = pickKindFor(desired); const [k, name, base] = BK[i]; const p = bkProto(i); const m = p.clone();
  let size = base * rr(0.85, 1.15); if (desired > base * 1.4 && i === BK.length - 1) size = desired;
  const sc = size / p.userData.m.r;
  m.scale.setScalar(sc); m.position.set(x, -p.userData.m.minY * sc, z); m.rotation.y = rr(-0.7, 0.7);
  scene.add(m);
  B.items.push({ k, name, m, x, z, size, baseY: m.position.y, t: rnd() * 6, wob: 0, vx: k === 'penguin' ? rr(-2, 2) : 0 });
}
function bonusSpawn() {
  while (B.nextZ > B.z - 80) {
    const n = 3 + Math.floor(rnd() * 3 + B.R * 0.4);
    const used = [];
    for (let j = 0; j < n; j++) {
      const big = rnd() < 0.2;
      const desired = B.R * (big ? rr(0.85, 1.7) : rr(0.15, 0.66));
      let x = 0, tries = 0;
      do { x = rr(-B.halfW * 0.92, B.halfW * 0.92); tries++; } while (tries < 6 && used.some(u => Math.abs(u - x) < desired * 2.4));
      used.push(x); addBonusItem(x, B.nextZ + rr(-1.5, 1.5), desired);
    }
    B.nextZ -= rr(2.4, 4) * (1 + B.R * 0.2);
  }
}
function bonusSide() {
  while (B.nextSideZ > B.z - 190) {
    const z = B.nextSideZ;
    [-1, 1].forEach(sd => {
      const f = SCENERY.fence().clone(); f.rotation.y = Math.PI / 2; f.position.set(sd * (B.halfW + 1.5), 0, z); scene.add(f); B.props.push(f);
      const [kind] = weighted(biome.props); const o = scenery(kind);
      o.position.set(sd * (B.halfW + rr(5, 30)), 0, z - rr(0, 12));
      o.rotation.y = ['house', 'cabin', 'workshop', 'igloo', 'soldier', 'lolli', 'deco'].includes(kind) ? -sd * Math.PI / 2 + rr(-0.3, 0.3) : rr(0, TAU);
      if (kind === 'tree') o.scale.setScalar(rr(1, 1.8));
      scene.add(o); B.props.push(o);
      if (rnd() < 0.6) { const t = SCENERY.treeFar(ri(0, 3)).clone(); t.position.set(sd * (B.halfW + rr(35, 90)), 0, z - rr(0, 12)); t.scale.setScalar(rr(1.6, 3)); scene.add(t); B.props.push(t); }
    });
    B.nextSideZ -= 12;
  }
  for (let i = B.props.length - 1; i >= 0; i--) if (B.props[i].position.z > B.z + 40) { scene.remove(B.props[i]); B.props.splice(i, 1); }
}
const _bv = new THREE.Vector3(), _bc = new THREE.Vector3(), _axis = new THREE.Vector3();
function absorb(it) {
  const old = B.R;
  B.R = Math.cbrt(B.R * B.R * B.R + 0.72 * Math.pow(it.size, 3));
  _bc.set(B.x, old, B.z);
  _bv.set(it.x, it.m.position.y + it.size * 0.5, it.z).sub(_bc).normalize();
  it.m.position.copy(_bc).addScaledVector(_bv, old * 0.88);
  it.m.scale.multiplyScalar(0.92);
  ballSpin.attach(it.m);
  if (ballSpin.children.length > 120) ballSpin.remove(ballSpin.children[2]);
  B.count++; Sfx.gulp(it.size);
  burstPuff(it.x, it.size * 0.6, it.z, Math.min(10, 3 + Math.round(it.size * 3)), 2 + it.size * 2, 0.15 + it.size * 0.15);
  if (it.size > B.R * 0.45 || B.tickT <= 0) { ticker(it.name); B.tickT = 0.35; }
  B.largest = it.size >= (B.largestSize || 0) ? it.name : B.largest; B.largestSize = Math.max(B.largestSize || 0, it.size);
  for (const b of BK) {
    if (b[2] >= 0.7 && !B.announced.has(b[0]) && B.R * EAT_RATIO >= b[2]) { B.announced.add(b[0]); banner('Big enough for: ' + b[1] + 's!'); Sfx.ding(); }
  }
}
function updateBonus(dt) {
  if (mode === 'bonus') {
    B.time -= dt; if (B.time <= 0) { B.time = 0; endBonus(); }
  }
  const active = mode === 'bonus';
  B.halfW = 9 + B.R * 2.5;
  const tgtSpeed = active ? Math.min(9 + B.R * 2.6, 30) : (mode === 'bonusEnd' ? 0 : 0);
  B.bonkT = Math.max(0, B.bonkT - dt); B.bonkMsgT = Math.max(0, B.bonkMsgT - dt); B.tickT -= dt;
  B.speed = damp(B.speed, tgtSpeed * (B.bonkT > 0 ? 0.25 : 1), B.bonkT > 0 ? 10 : 2.2, dt);
  B.vx = damp(B.vx, active ? B.steer * (11 + B.R * 2.4) : 0, 6, dt);
  B.x = clamp(B.x + B.vx * dt, -B.halfW + B.R * 0.7, B.halfW - B.R * 0.7);
  B.z -= B.speed * dt;
  const v = Math.hypot(B.vx, B.speed);
  if (v > 0.01) { _axis.set(-B.speed, 0, -B.vx).normalize(); ballSpin.rotateOnWorldAxis(_axis, v * dt / B.R); }
  ballRoot.position.set(B.x, B.R, B.z); ballMesh.scale.setScalar(B.R);
  if (active) {
    for (let i = B.items.length - 1; i >= 0; i--) {
      const it = B.items[i];
      const dx = it.x - B.x, dz = it.z - B.z, d = Math.hypot(dx, dz), reach = B.R + it.size * 0.7 + 0.15;
      const edible = it.size <= B.R * EAT_RATIO;
      if (edible && d < reach + 1.0 + B.R * 0.6 && dz < B.R) { const k = Math.min(1, dt * 5); it.x += (B.x - it.x) * k; it.z += (B.z - it.z) * k * 0.5; it.m.position.x = it.x; it.m.position.z = it.z; }
      if (d < reach) {
        if (edible) { B.items.splice(i, 1); absorb(it); }
        else if (B.bonkT <= 0) {
          B.bonkT = 0.45; it.wob = 1; Sfx.bonk(); shake(0.3);
          const nx = -dx / (d || 1), nz = -dz / (d || 1); B.x += nx * (reach - d) * 0.6; B.z += Math.max(0, nz * (reach - d)); B.vx += nx * 8;
          if (B.bonkMsgT <= 0) { pop('Too big! Grow first', new THREE.Vector3(B.x, B.R * 2 + 1, B.z), '#a81f3a'); B.bonkMsgT = 1.2; }
        }
      }
    }
  }
  for (let i = B.items.length - 1; i >= 0; i--) {
    const it = B.items[i]; it.t += dt;
    if (LIVELY.has(it.k)) { it.m.position.y = it.baseY + Math.abs(Math.sin(it.t * 5)) * it.size * 0.12; it.m.rotation.z = Math.sin(it.t * 5) * 0.08; }
    if (it.vx) { it.x += it.vx * dt; if (Math.abs(it.x) > B.halfW) it.vx *= -1; it.m.position.x = it.x; }
    if (it.wob > 0) { it.wob = Math.max(0, it.wob - dt * 2); it.m.rotation.z = Math.sin(it.wob * 30) * it.wob * 0.2; }
    if (it.z > B.z + B.R * 3 + 9) { scene.remove(it.m); B.items.splice(i, 1); }
  }
  bonusSpawn(); bonusSide();
  groundMat.uniforms.uLane.value = B.halfW;
  shadow.position.set(B.x, 0.04, B.z); shadow.scale.setScalar(B.R * 1.15); shadow.material.uniforms.uA.value = 0.45;
  if (active && rnd() < B.speed * 0.05) burstPuff(B.x + rr(-B.R, B.R) * 0.6, 0.1, B.z + B.R * 0.5, 1, 1 + B.R * 0.3, 0.12 + B.R * 0.08);
  bonusCam(dt);
  updateBonusHud();
}
function bonusCam(dt, snap) {
  const port = camera.aspect < 1, zf = port ? clamp(0.8 / camera.aspect, 1, 1.8) : 1;
  const back = (B.R * 3.0 + 6.5) * zf, up = B.R * 1.9 + 3.4 * zf;
  const k = snap ? 1 : 1 - Math.exp(-4 * dt);
  camPos.x += (B.x * (port ? 1 : 0.8) - camPos.x) * k; camPos.y += (up - camPos.y) * k; camPos.z += (B.z + back - camPos.z) * k;
  camLook.x += (B.x * (port ? 1 : 0.9) - camLook.x) * k; camLook.y += (B.R * 0.7 - camLook.y) * k; camLook.z += (B.z - B.R * 2 - 7 - camLook.z) * k;
}
