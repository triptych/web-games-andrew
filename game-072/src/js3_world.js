// ================= sky dome: gradient, stars, moon and an animated aurora =================
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
  uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uAur: { value: new THREE.Color(0x5affc0) }, uTime: U.uTime, uAurStr: { value: 1 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
  fragmentShader: `
uniform vec3 uTop,uMid,uHor,uAur; uniform float uTime,uAurStr; varying vec3 vDir;
${GLSL_NOISE}
void main(){
  vec3 d=normalize(vDir); float h=d.y;
  vec3 col=mix(uHor,uMid,smoothstep(-0.04,0.3,h));
  col=mix(col,uTop,smoothstep(0.26,0.85,h));
  float az=atan(d.z,d.x);
  if(h>0.0){
    vec2 sp=vec2(az*90.,h*90.); vec2 cell=floor(sp); float r=h21(cell);
    if(r>0.982){ vec2 f=fract(sp)-0.5; float tw=0.55+0.45*sin(uTime*(1.5+r*5.)+r*70.); col+=vec3(1.,.96,.9)*smoothstep(0.16,0.0,length(f))*tw*smoothstep(0.06,0.4,h)*1.3; }
  }
  float a=0.;
  for(int i=0;i<3;i++){
    float fi=float(i); float x=az*2.2+fi*1.9;
    float c=0.3+fi*0.075+0.06*sin(x*1.3+uTime*0.13+fi)+0.06*fbm(vec2(x*1.4,uTime*0.05+fi));
    float band=exp(-pow((h-c)*8.5,2.));
    float rays=pow(fbm(vec2(x*13.,uTime*0.18+fi*3.)),2.)*1.8;
    a+=band*rays*smoothstep(c+0.2,c-0.02,h)*(0.75-fi*0.17);
  }
  vec3 ac=mix(uAur,vec3(0.6,0.35,1.0),smoothstep(0.3,0.55,h));
  col+=ac*a*uAurStr*0.6;
  vec3 md=normalize(vec3(-0.42,0.38,-0.82)); float m=dot(d,md);
  col=mix(col,vec3(1.,.97,.88),smoothstep(0.99935,0.9996,m));
  col+=vec3(.75,.75,1.)*(pow(max(m,0.),900.)*0.5+pow(max(m,0.),40.)*0.14);
  gl_FragColor=vec4(col,1.);
}`,
  side: THREE.BackSide, depthWrite: false, fog: false,
}));
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

// ================= mountain ridges: three parallax silhouette planes =================
const MTN_FS = `
uniform vec3 uCol,uSnowCol,uFogCol; uniform float uFreq,uAmp,uBase,uFog,uSeed,uTrees;
varying vec3 vW;
${GLSL_NOISE}
float n1(float x){ return n21(vec2(x,uSeed)); }
void main(){
  float x=vW.x*uFreq+uSeed;
  float ridge=1.0-abs(n1(x)*2.0-1.0);
  float hgt=uBase+uAmp*(ridge*0.55+n1(x*2.3)*0.3+n1(x*6.1)*0.15);
  float tree=0.;
  if(uTrees>0.){ float tx=vW.x*0.55; float f=fract(tx); float id=floor(tx); float th=(0.6+h21(vec2(id,3.))*0.9)*uTrees; tree=max(0.,th*(1.0-abs(f-0.5)*2.6)); }
  if(vW.y>hgt+tree) discard;
  float depth=hgt-vW.y;
  float cap=smoothstep(uAmp*0.16,0.0,depth-uAmp*0.06*n1(x*9.))*step(0.0,depth);
  vec3 c=mix(uCol,uSnowCol,cap);
  c=mix(c,uFogCol,clamp(uFog+smoothstep(hgt*0.25+uBase*0.2,-30.0,vW.y)*0.55,0.,1.));
  gl_FragColor=vec4(c,1.);
}`;
function makeMountain(z, freq, amp, base, seed, trees) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3000, 420), new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color() }, uSnowCol: { value: new THREE.Color() }, uFogCol: { value: new THREE.Color() }, uFreq: { value: freq }, uAmp: { value: amp }, uBase: { value: base }, uFog: { value: 0 }, uSeed: { value: seed }, uTrees: { value: trees } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: MTN_FS, fog: false,
  }));
  m.position.y = 140; m.userData.z = z; m.frustumCulled = false; m.renderOrder = -5; scene.add(m); return m;
}
const mountains = [makeMountain(-640, 0.006, 150, 30, 11.3, 0), makeMountain(-470, 0.009, 90, 8, 4.7, 0), makeMountain(-330, 0.016, 34, -2, 8.1, 7)];

// ================= snowy ground with dunes and glitter =================
const GROUND_SIZE = 1000, GROUND_SEG = 150, GSTEP = GROUND_SIZE / GROUND_SEG;
const groundMat = new THREE.ShaderMaterial({
  uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { uSnow: { value: new THREE.Color(0xf4f8ff) }, uShadow: { value: new THREE.Color(0x8c9be0) }, uSun: U.uSun, uTime: U.uTime, uAxis: { value: 0 }, uLane: { value: 2.2 } }),
  vertexShader: `
uniform float uAxis,uLane; varying vec3 vW;
#include <fog_pars_vertex>
${GLSL_NOISE}
void main(){
  vec4 w=modelMatrix*vec4(position,1.);
  float td=uAxis<0.5?abs(w.z):abs(w.x);
  float m=smoothstep(uLane+20.,uLane+75.,td);
  w.y+=(fbm(w.xz*0.025)*9.0+fbm(w.xz*0.08)*2.0-4.0)*m;
  vW=w.xyz; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
  fragmentShader: `
uniform vec3 uSnow,uShadow,uSun; uniform float uTime,uAxis,uLane; varying vec3 vW;
#include <fog_pars_fragment>
${GLSL_NOISE}
void main(){
  vec3 N=normalize(cross(dFdx(vW),dFdy(vW))); if(N.y<0.) N=-N;
  float ndl=clamp(dot(N,normalize(uSun))*0.5+0.5,0.,1.);
  vec3 c=mix(uShadow,uSnow,pow(ndl,1.6));
  c*=0.93+0.1*fbm(vW.xz*0.12);
  float td=uAxis<0.5?abs(vW.z):abs(vW.x);
  float lane=smoothstep(uLane,uLane*0.6,td);
  c=mix(c,c*vec3(0.86,0.9,1.0),lane*0.45);
  float ruts=smoothstep(0.12,0.0,abs(td-uLane*0.35))*lane;
  c*=1.0-ruts*0.12;
  vec2 g=floor(vW.xz*5.); vec2 f=fract(vW.xz*5.)-0.5;
  vec3 V=normalize(cameraPosition-vW);
  float r=h21(g+floor(dot(V,vec3(5.,9.,7.))*2.0));
  float dist=length(cameraPosition-vW);
  c+=vec3(1.)*step(0.992,r)*smoothstep(0.22,0.0,length(f))*smoothstep(90.,8.,dist)*1.2;
  gl_FragColor=vec4(c,1.);
  #include <fog_fragment>
}`,
  fog: true,
});
groundMat.extensions.derivatives = true;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEG, GROUND_SEG).rotateX(-Math.PI / 2), groundMat);
ground.frustumCulled = false; scene.add(ground);

// ================= falling snow (GPU animated points) =================
const SNOW_N = 1800;
const snowGeo = new THREE.BufferGeometry();
{ const p = new Float32Array(SNOW_N * 3), s = new Float32Array(SNOW_N); for (let i = 0; i < SNOW_N; i++) { p[i * 3] = rnd() * 90; p[i * 3 + 1] = rnd() * 60; p[i * 3 + 2] = rnd() * 70; s[i] = rnd(); } snowGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); snowGeo.setAttribute('aSeed', new THREE.BufferAttribute(s, 1)); }
const snowMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime, uCam: { value: new THREE.Vector3() }, uSize: { value: 6 * renderer.getPixelRatio() }, uWind: { value: -2.5 } },
  vertexShader: `
uniform float uTime,uSize,uWind; uniform vec3 uCam; attribute float aSeed; varying float vA;
void main(){
  vec3 box=vec3(90.,60.,70.);
  vec3 p=position;
  p.y-=uTime*(1.1+aSeed*1.7);
  p.x+=uTime*uWind+sin(uTime*(0.6+aSeed)+aSeed*20.)*1.3;
  p.z+=sin(uTime*0.5+aSeed*10.)*0.9;
  vec3 base=uCam-vec3(box.x*0.5,box.y*0.5,box.z*0.85);
  p=base+mod(p-base,box);
  vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
  gl_PointSize=uSize*(0.45+aSeed)*(26./max(1.,-mv.z));
  vA=0.45+0.55*aSeed;
}`,
  fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-0.5); gl_FragColor=vec4(1.,1.,1.,smoothstep(0.5,0.12,d)*vA); }`,
  transparent: true, depthWrite: false,
});
const snowPts = new THREE.Points(snowGeo, snowMat); snowPts.frustumCulled = false; scene.add(snowPts);

// ================= particles (instanced) =================
function makeParticles(geo, mat, n, colorize) {
  const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.Color(1, 1, 1); if (colorize) for (let i = 0; i < n; i++) im.setColorAt(i, col);
  scene.add(im);
  const ps = []; for (let i = 0; i < n; i++) ps.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, vr: 0, s: 1, g: 10, drag: 0.5 });
  let head = 0; const dummy = new THREE.Object3D();
  return {
    spawn(o, color) { const p = ps[head]; Object.assign(p, o); p.life = p.max; if (colorize && color !== undefined) { im.setColorAt(head, col.set(color)); im.instanceColor.needsUpdate = true; } head = (head + 1) % n; },
    update(dt) {
      for (let i = 0; i < n; i++) {
        const p = ps[i];
        if (p.life > 0) {
          p.life -= dt; p.vy -= p.g * dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.05 && p.g > 0) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.7; }
          p.rx += p.vr * dt; p.ry += p.vr * 0.7 * dt;
          const t = clamp(p.life / p.max, 0, 1); const sc = p.s * (t < 0.25 ? t / 0.25 : 1);
          dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, p.ry, p.rz); dummy.scale.setScalar(Math.max(sc, 0.0001));
        } else { dummy.scale.setScalar(0.0001); dummy.position.set(0, -50, 0); }
        dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    },
  };
}
const confetti = makeParticles(new THREE.PlaneGeometry(0.22, 0.13), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 500, true);
const puffs = makeParticles(new THREE.IcosahedronGeometry(1, 1), M(0xffffff), 260, false);
const sparks = makeParticles(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial(), 300, true);
const CONF_COLS = [0xe8364f, 0xffc94a, 0x2a9d74, 0x4d7cf0, 0xffffff, 0xff8fb1, 0x8e4fd6];
function burstConfetti(x, y, z, n = 30, power = 8, cols = CONF_COLS) {
  for (let i = 0; i < n; i++) { const a = rr(0, TAU), e = rr(0.2, 1.4), v = rr(0.4, 1) * power; confetti.spawn({ x, y, z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v, vz: Math.sin(a) * Math.cos(e) * v, rx: rr(0, 6), ry: rr(0, 6), rz: rr(0, 6), vr: rr(-12, 12), s: rr(0.8, 1.4), g: 9, drag: 1.6, max: rr(1.2, 2.2) }, pick(cols)); }
}
function burstPuff(x, y, z, n = 10, power = 4, size = 0.25) {
  for (let i = 0; i < n; i++) { const a = rr(0, TAU); puffs.spawn({ x: x + rr(-0.3, 0.3), y: y + rr(0, 0.2), z: z + rr(-0.3, 0.3), vx: Math.cos(a) * rr(0.3, 1) * power, vy: rr(0.4, 1) * power, vz: Math.sin(a) * rr(0.3, 1) * power, rx: 0, ry: 0, rz: 0, vr: rr(-3, 3), s: rr(0.6, 1.3) * size, g: 6, drag: 2.5, max: rr(0.5, 0.9) }); }
}
function burstSparks(x, y, z, n = 20, power = 8, col = 0xffe07a, g = 4) {
  for (let i = 0; i < n; i++) { const a = rr(0, TAU), e = rr(-1.3, 1.3), v = rr(0.5, 1) * power; sparks.spawn({ x, y, z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v, vz: Math.sin(a) * Math.cos(e) * v, rx: rr(0, 6), ry: 0, rz: 0, vr: rr(-10, 10), s: rr(0.06, 0.14), g, drag: 1.4, max: rr(0.6, 1.2) }, Array.isArray(col) ? pick(col) : col); }
}

// ================= collectible snowflakes (instanced) =================
const flakeGeo = (() => {
  const g = new THREE.Group(); const m = new THREE.MeshBasicMaterial();
  for (let k = 0; k < 3; k++) g.add(part(GEO.box, m, [0, 0, 0], [0.09, 1.0, 0.07], [0, 0, k * Math.PI / 3]));
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; [0.28, 0.4].forEach((d, j) => { const cx = -Math.sin(a) * d, cy = Math.cos(a) * d; [-1, 1].forEach(sd => g.add(part(GEO.box, m, [cx + Math.cos(a) * sd * 0.07, cy + Math.sin(a) * sd * 0.07, 0], [0.05, 0.2 - j * 0.06, 0.05], [0, 0, a + sd * 0.8]))); }); }
  g.add(part(GEO.oct, m, [0, 0, 0], 0.12));
  return bake(g).children[0].geometry;
})();
const FLAKE_N = 260;
const flakeIM = new THREE.InstancedMesh(flakeGeo, new THREE.MeshToonMaterial({ color: 0xe4f6ff, emissive: 0x3a8fe8, emissiveIntensity: 0.6, gradientMap: TOON }), FLAKE_N);
flakeIM.frustumCulled = false; flakeIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(flakeIM);
const flakes = []; for (let i = 0; i < FLAKE_N; i++) flakes.push({ alive: false, x: 0, y: 0, z: 0, t: 0, pull: false, ph: rnd() * 6 });
function spawnFlake(x, y, z = 0) { const f = flakes.find(f => !f.alive); if (!f) return; f.alive = true; f.x = x; f.y = y; f.z = z; f.pull = false; f.t = 0; }
function clearFlakes() { flakes.forEach(f => f.alive = false); }
const _dm = new THREE.Object3D();
function drawFlakes(t) {
  for (let i = 0; i < FLAKE_N; i++) {
    const f = flakes[i];
    if (f.alive) { _dm.position.set(f.x, f.y + Math.sin(t * 2 + f.ph) * 0.15, f.z); _dm.rotation.set(0, t * 2 + f.ph, 0); _dm.scale.setScalar(f.pull ? 0.45 : 0.62); }
    else { _dm.position.set(0, -60, 0); _dm.scale.setScalar(0.0001); }
    _dm.updateMatrix(); flakeIM.setMatrixAt(i, _dm.matrix);
  }
  flakeIM.instanceMatrix.needsUpdate = true;
}

// ================= blob shadow =================
const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  uniforms: { uA: { value: 0.35 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float d=length(vUv-0.5)*2.; gl_FragColor=vec4(0.18,0.16,0.42,smoothstep(1.,0.,d)*uA); }`,
  transparent: true, depthWrite: false,
}));
shadow.position.y = 0.04; shadow.renderOrder = 1; scene.add(shadow);

// ================= floating words =================
const popsEl = $('#pops'); const _pv = new THREE.Vector3();
function pop(text, pos, color = '#2f5fb8', big = false) {
  _pv.copy(pos).project(camera); if (_pv.z > 1) return;
  while (popsEl.childElementCount > 6) popsEl.firstElementChild.remove();
  const el = document.createElement('div'); el.className = 'pop ol' + (big ? ' big' : ''); el.textContent = text;
  el.style.left = clamp((_pv.x * 0.5 + 0.5) * innerWidth, 90, innerWidth - 90) + 'px'; el.style.top = clamp((-_pv.y * 0.5 + 0.5) * innerHeight, 120, innerHeight - 60) + 'px';
  el.style.setProperty('--pc', color); el.style.setProperty('--rot', rr(-7, 7).toFixed(1) + 'deg');
  popsEl.appendChild(el); setTimeout(() => el.remove(), 1200);
}
const flashEl = $('#flash');
function flash(a = 0.6) { flashEl.style.transition = 'none'; flashEl.style.opacity = a; requestAnimationFrame(() => { flashEl.style.transition = 'opacity .45s ease-out'; flashEl.style.opacity = 0; }); }
let shakeAmt = 0; const shakeV = new THREE.Vector3();
function shake(a) { shakeAmt = Math.max(shakeAmt, a); }

// ================= biomes =================
const BIOMES = [
  { name: 'Gumdrop Village', front: ['candy','smalltree'], top: 0x161447, mid: 0x463a97, hor: 0xf6a9c3, fog: 0xc29fd2, aur: 0x5affc0, sky: 0xc6d4ff, gnd: 0x8a74b4, shadow: 0x8f98e2, snow: 0xf6f8ff, mtn: [0x5b4f9e, 0x6e60b2, 0x8a7cc6], props: [['house', 4, -11, -34], ['tree', 5, -8, -60], ['lamp', 2, -5.2, -5.6], ['deco', 1.2, -7, -12], ['pile', 0.8, -6.5, -10]] },
  { name: 'Whispering Pines', front: ['smalltree','smalltree'], top: 0x0a1736, mid: 0x1d3c78, hor: 0x8cc4e0, fog: 0x7ea6c8, aur: 0x52ff9a, sky: 0xbcd8ff, gnd: 0x5d7aa8, shadow: 0x7f9fd8, snow: 0xf2f8ff, mtn: [0x23406e, 0x2f5687, 0x3d6d9c], props: [['tree', 9, -7, -60], ['cabin', 2, -12, -30], ['lamp', 1, -5.2, -5.6], ['deco', 0.6, -7, -12]] },
  { name: 'Peppermint Pass', front: ['candy','candy'], top: 0x2a1048, mid: 0x7a3990, hor: 0xffb7cb, fog: 0xe3a8c8, aur: 0xff8ad8, sky: 0xffd0e8, gnd: 0xb07aa8, shadow: 0xc49ad8, snow: 0xfff6fb, mtn: [0x8c4f9a, 0xa868ae, 0xc488c0], props: [['bigcane', 4, -7, -40], ['gumhill', 4, -12, -50], ['lolli', 3, -7, -26], ['tree', 2, -9, -50]] },
  { name: 'Workshop Row', front: ['candy','smalltree'], top: 0x1b1036, mid: 0x5a2c5c, hor: 0xffc48c, fog: 0xd8a08e, aur: 0xffd66a, sky: 0xffe0c6, gnd: 0x9a6a7e, shadow: 0xb89ad0, snow: 0xfff8f0, mtn: [0x6a3a62, 0x87507a, 0xa36a8c], props: [['workshop', 3, -13, -32], ['tree', 4, -8, -55], ['soldier', 2, -5.5, -7], ['pile', 2, -6.5, -12], ['lamp', 2, -5.2, -5.6]] },
  { name: 'Aurora Summit', front: ['drift','smalltree'], top: 0x040719, mid: 0x112c64, hor: 0x5fd6c8, fog: 0x4e8eaa, aur: 0x3dffd2, sky: 0xb8f0ff, gnd: 0x3d6a90, shadow: 0x6f9fd6, snow: 0xeefaff, mtn: [0x15335c, 0x1f4a78, 0x2d6290], props: [['crystal', 5, -8, -45], ['tree', 4, -9, -55], ['igloo', 1.5, -12, -28]] },
];
let biome = BIOMES[0];
const biomeFor = level => BIOMES[Math.floor((level - 1) / 5) % BIOMES.length];
function applyBiome(b) {
  biome = b; const u = sky.material.uniforms;
  u.uTop.value.set(b.top); u.uMid.value.set(b.mid); u.uHor.value.set(b.hor); u.uAur.value.set(b.aur);
  scene.fog.color.set(b.fog); renderer.setClearColor(b.fog);
  hemi.color.set(b.sky); hemi.groundColor.set(b.gnd); U.uSky.value.set(b.sky); U.uGround.value.set(b.gnd);
  groundMat.uniforms.uSnow.value.set(b.snow); groundMat.uniforms.uShadow.value.set(b.shadow);
  mountains.forEach((m, i) => { const u = m.material.uniforms; u.uCol.value.set(b.mtn[i]); u.uSnowCol.value.set(b.snow).lerp(new THREE.Color(b.mtn[i]), 0.25 + i * 0.1); u.uFogCol.value.set(b.fog); u.uFog.value = [0.45, 0.28, 0.12][i]; });
}
function placeBackdrop() {
  sky.position.copy(camera.position);
  mountains.forEach(m => { m.position.x = camera.position.x; m.position.z = camera.position.z + m.userData.z; });
  ground.position.x = Math.round(camera.position.x / GSTEP) * GSTEP;
  ground.position.z = Math.round((camera.position.z - GROUND_SIZE * 0.32) / GSTEP) * GSTEP;
  snowMat.uniforms.uCam.value.copy(camera.position);
}
