'use strict';
// ================= utilities =================
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = Math.random;
const rr = (a, b) => a + (b - a) * rnd();
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString('en-US');

// ================= save =================
const SAVE_KEY = 'frosty-fling-v1';
const defaultSave = () => ({ level: 1, flakes: 0, best: 0, upg: { power: 0, bounce: 0, aero: 0, slam: 0, magnet: 0, luck: 0 }, muted: false, pendingBonus: 0, runs: 0, seenSlam: false, bestBall: 0 });
let save = defaultSave();
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (s && s.level) { save = Object.assign(defaultSave(), s); save.upg = Object.assign(defaultSave().upg, s.upg || {}); }
} catch (e) { }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }

// ================= audio (all synthesized) =================
const Sfx = (() => {
  let ctx = null, master, sfx, music, noiseBuf, timer = null, nextT = 0, step = 0, tempo = 138, musicOn = true;
  const MEL = [72,0,74,76,79,0,76,74, 72,0,69,0,72,74,76,0, 77,0,76,74,72,0,74,0, 76,74,72,69,67,0,0,0,
               72,0,74,76,79,0,81,79, 77,0,76,74,72,74,76,0, 79,77,76,74,72,0,69,71, 72,0,0,0,79,0,84,0];
  const ROOTS = [60, 60, 65, 60, 65, 60, 67, 60];
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = save.muted ? 0 : 0.85; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.7; sfx.connect(master);
    music = ctx.createGain(); music.gain.value = 0.2; music.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextT = ctx.currentTime + 0.1; timer = setInterval(schedule, 40);
  }
  function tone(f, dur, type = 'sine', vol = 0.3, slide = null, when = 0, dest) {
    if (!ctx) return; const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  function noiseAt(t, dur, vol, freq, q, type, slide, dest) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur); f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function noise(dur, vol = 0.3, freq = 1000, q = 1, type = 'bandpass', when = 0, slide = null) { if (!ctx) return; noiseAt(ctx.currentTime + when, dur, vol, freq, q, type, slide); }
  function bell(f, t, vol) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2.01;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g); o2.connect(g); g.connect(music); o.start(t); o2.start(t); o.stop(t + 0.5); o2.stop(t + 0.5);
  }
  function bass(f, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(music); o.start(t); o.stop(t + dur + 0.05);
  }
  function schedule() {
    if (!ctx || !musicOn) { if (ctx) nextT = ctx.currentTime + 0.05; return; }
    const spb = 60 / tempo / 2;
    while (nextT < ctx.currentTime + 0.25) {
      const s = step % 64, n = MEL[s];
      if (n) bell(midi(n), nextT, 0.11);
      if (s % 8 === 0 || s % 8 === 4) bass(midi(ROOTS[Math.floor(s / 8)] - 24 + (s % 8 === 4 ? 7 : 0)), nextT, spb * 1.8);
      if (s % 8 === 2 || s % 8 === 6) { const r = ROOTS[Math.floor(s / 8)]; [0, 4, 7].forEach(k => bell(midi(r + k), nextT, 0.025)); }
      noiseAt(nextT, 0.05, s % 2 ? 0.025 : 0.05, 7500, 0.8, 'highpass', null, music);
      nextT += spb; step++;
    }
  }
  return {
    init, get ready() { return !!ctx; },
    setMuted(m) { if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.05); },
    setTempo(t) { tempo = t; }, setMusic(on) { musicOn = on; },
    boing(p = 1, v = 0.3) { tone(200 * p, 0.28, 'sine', v, 560 * p); tone(300 * p, 0.2, 'triangle', v * 0.35, 760 * p); },
    thump(v = 0.4) { noise(0.18, v, 380, 0.7, 'lowpass'); tone(120, 0.16, 'sine', v * 0.7, 55); },
    crunch() { noise(0.14, 0.35, 1900, 0.6); noise(0.08, 0.25, 900, 0.9, 'bandpass', 0.05); },
    jingle() { for (let i = 0; i < 5; i++) tone(1500 + i * 230 + Math.random() * 60, 0.3, 'triangle', 0.06, null, i * 0.035); noise(0.35, 0.12, 8000, 1, 'highpass'); },
    pling(n = 0) { const f = 880 * Math.pow(2, (n % 14) / 12); tone(f, 0.14, 'sine', 0.13); tone(f * 2, 0.1, 'sine', 0.04); },
    launch() { noise(0.5, 0.35, 400, 1, 'bandpass', 0, 3200); tone(160, 0.32, 'sawtooth', 0.05, 80); tone(520, 0.22, 'triangle', 0.1, 900, 0.02); },
    whoosh() { noise(0.45, 0.22, 500, 0.7, 'bandpass', 0, 2600); },
    slam() { tone(700, 0.22, 'square', 0.05, 140); noise(0.25, 0.25, 1200, 0.5, 'lowpass', 0, 200); },
    slamHit() { tone(90, 0.35, 'sine', 0.5, 40); noise(0.4, 0.45, 600, 0.5, 'lowpass'); tone(300, 0.4, 'triangle', 0.15, 900, 0.06); },
    melt() { tone(520, 0.45, 'sine', 0.15, 160); noise(0.5, 0.12, 5000, 0.5, 'highpass'); },
    pop() { tone(900, 0.08, 'square', 0.08, 300); noise(0.08, 0.3, 2500, 1); },
    ding() { [0, 0.08, 0.16].forEach((w, i) => tone(1318 * (1 + i * 0.25), 0.6, 'triangle', 0.12, null, w)); },
    bonk() { tone(170, 0.2, 'square', 0.1, 70); noise(0.1, 0.25, 600, 1); },
    gulp(s = 1) { const f = clamp(700 / Math.sqrt(s + 0.2), 140, 1200); tone(f, 0.12, 'sine', 0.16, f * 1.8); noise(0.06, 0.12, 2000, 1); },
    click() { tone(1000, 0.05, 'triangle', 0.08); },
    buy() { [0, 0.06, 0.12].forEach((w, i) => tone(660 * Math.pow(1.26, i), 0.18, 'triangle', 0.12, null, w)); },
    fanfare() { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(midi(n + 12), 0.35, 'triangle', 0.1, null, i * 0.07)); noise(0.8, 0.1, 9000, 1, 'highpass', 0.3); },
    firework() { noise(0.6, 0.3, 300, 0.5, 'lowpass'); for (let i = 0; i < 6; i++) noise(0.05, 0.1, 6000, 1, 'highpass', 0.15 + i * 0.06); },
    sad() { tone(392, 0.25, 'triangle', 0.1); tone(330, 0.4, 'triangle', 0.1, null, 0.22); },
  };
})();

// ================= renderer & scene =================
const canvas = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.setClearColor(0x191640);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb59ad0, 70, 420);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 3000);
const hemi = new THREE.HemisphereLight(0xc6d4ff, 0x7d6aa8, 0.72); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 0.78); sun.position.set(-0.45, 0.8, 0.55).multiplyScalar(50); scene.add(sun);
const SUN_DIR = sun.position.clone().normalize();
const U = {
  uTime: { value: 0 }, uSun: { value: SUN_DIR }, uSunCol: { value: new THREE.Color(0xfff1dc) },
  uSky: { value: new THREE.Color(0xc6d4ff) }, uGround: { value: new THREE.Color(0x7d6aa8) }, uRim: { value: new THREE.Color(0xbfe0ff) },
};

// ================= GLSL =================
const GLSL_NOISE = `
float h3(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float n21(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*n21(p); p*=2.03; a*=.5; } return v; }
`;

// Snow shader: lumpy displacement, wrap lighting with cool subsurface, fresnel rim, view-dependent glitter
const SNOW_VS = `
uniform float uLump;
varying vec3 vN; varying vec3 vW; varying vec3 vL;
#include <fog_pars_vertex>
${GLSL_NOISE}
void main(){
  vec3 p=position; float n=n3(p*3.5)*0.6+n3(p*9.0)*0.4; p+=normal*(n-0.5)*uLump;
  vL=p;
  vec4 w=modelMatrix*vec4(p,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal);
  vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`;
const SNOW_FS = `
uniform vec3 uSun,uSunCol,uSky,uGround,uRim,uBase; uniform float uTime;
varying vec3 vN; varying vec3 vW; varying vec3 vL;
#include <fog_pars_fragment>
${GLSL_NOISE}
void main(){
  vec3 N=normalize(vN);
  N=normalize(N+(vec3(n3(vL*14.0),n3(vL*30.0+7.0),n3(vL*22.0+3.0))-0.5)*0.28);
  vec3 V=normalize(cameraPosition-vW);
  vec3 L=normalize(uSun);
  float ndl=dot(N,L);
  float wrap=pow(clamp(ndl*0.5+0.5,0.,1.),1.4);
  vec3 hemi=mix(uGround,uSky,N.y*0.5+0.5);
  vec3 col=uBase*(hemi*0.58+uSunCol*wrap*0.62);
  col+=vec3(0.16,0.32,0.62)*(1.0-wrap)*0.28;
  float fres=pow(1.0-clamp(dot(N,V),0.,1.),3.0);
  col+=uRim*fres*0.6;
  vec3 H=normalize(L+V);
  col+=uSunCol*pow(clamp(dot(N,H),0.,1.),28.0)*0.18;
  float s=h3(floor(vL*55.0)+floor(dot(V,vec3(7.,11.,13.))*2.5));
  float glint=step(0.982,s)*pow(clamp(dot(N,H)*0.5+0.5,0.,1.),4.0)*(0.6+0.4*sin(uTime*7.0+s*60.0));
  col+=vec3(1.0,0.97,0.9)*glint*1.8;
  gl_FragColor=vec4(col,1.0);
  #include <fog_fragment>
}`;
function makeSnowMat(base = 0xf6f9ff, lump = 0.05) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), {
      uTime: U.uTime, uSun: U.uSun, uSunCol: U.uSunCol, uSky: U.uSky, uGround: U.uGround, uRim: U.uRim,
      uBase: { value: new THREE.Color(base) }, uLump: { value: lump },
    }),
    vertexShader: SNOW_VS, fragmentShader: SNOW_FS, fog: true,
  });
}

// ================= toon materials & textures =================
function toonMap() {
  const d = new Uint8Array([78, 78, 78, 255, 145, 145, 145, 255, 210, 210, 210, 255, 250, 250, 250, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
const TOON = toonMap();
const matCache = new Map();
function M(c, extra) {
  const k = 'm' + c + (extra ? JSON.stringify(extra) : '');
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshToonMaterial(Object.assign({ color: c, gradientMap: TOON }, extra || {})));
  return matCache.get(k);
}
function GL(c, opacity) {
  const k = 'g' + c + (opacity || '');
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial(Object.assign({ color: c }, opacity ? { transparent: true, opacity, depthWrite: false } : {})));
  return matCache.get(k);
}
function MT(tex, c = 0xffffff, side) {
  const k = 't' + tex.uuid + c + (side || '');
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshToonMaterial({ color: c, map: tex, gradientMap: TOON, side: side || THREE.FrontSide }));
  return matCache.get(k);
}
const texCache = new Map();
function canvasTex(key, w, h, draw, rep) {
  if (key && texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  if (key) texCache.set(key, t); return t;
}
function stripeTex(a, b, n = 4, rep = [1, 1]) {
  return canvasTex(`st${a}${b}${n}${rep}`, 128, 128, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; const s = w / n;
    for (let i = -n - 1; i <= n + 1; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s + s / 2, 0); g.lineTo(i * s + s / 2 + w, h); g.lineTo(i * s + w, h); g.closePath(); g.fill(); }
  }, rep);
}
function starPath(g, cx, cy, R, n) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? R * 0.45 : R; const a = -Math.PI / 2 + i * Math.PI / n; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); }
const WRAPS = [['#e8364f', '#ffe08a', 'dots'], ['#239a6e', '#ffffff', 'stars'], ['#3f6fe0', '#d6efff', 'flakes'], ['#ffc94a', '#e8364f', 'stripes'], ['#8e4fd6', '#8ff0d0', 'zig']];
const RIBBONS = [0xffe08a, 0xe8364f, 0xffffff, 0x239a6e, 0xffc94a];
function wrapTex(i) {
  const [bg, fg, p] = WRAPS[i % 5];
  return canvasTex('wrap' + (i % 5), 128, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.strokeStyle = fg; g.lineWidth = 5; g.lineCap = 'round';
    if (p === 'dots') { for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) { g.beginPath(); g.arc(x * 32 + (y % 2) * 16, 16 + y * 32, 7, 0, TAU); g.fill(); } }
    else if (p === 'stars') { for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) starPath(g, x * 42 + (y % 2) * 21, 22 + y * 42, 11, 5); }
    else if (p === 'flakes') { for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) { const cx = x * 42 + (y % 2) * 21, cy = 22 + y * 42; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(cx - Math.cos(a) * 11, cy - Math.sin(a) * 11); g.lineTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11); g.stroke(); } } }
    else if (p === 'stripes') { for (let x = 0; x < 4; x++) g.fillRect(x * 32 + 9, 0, 14, h); }
    else { g.beginPath(); for (let r = 0; r < 4; r++) { const y = 16 + r * 32; g.moveTo(0, y); for (let x = 0; x <= 8; x++) g.lineTo(x * 16, y + (x % 2 ? -8 : 8)); } g.stroke(); }
  });
}
function woodBoard(g, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#b47e4c'); gr.addColorStop(1, '#8a5a34'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(60,30,10,.3)'; g.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const y = 10 + i * h / 6; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y - 6, w * 0.6, y + 8, w, y); g.stroke(); }
}
function signTex(text) {
  return canvasTex('sign' + text, 256, 128, (g, w, h) => {
    woodBoard(g, w, h); g.fillStyle = '#fff'; g.font = '62px "Lilita One", "Arial Rounded MT Bold", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(40,20,0,.5)'; g.shadowOffsetY = 4; g.fillText(text, w / 2, h / 2 + 4);
  });
}
function bannerTex(text, sub) {
  return canvasTex('ban' + text + sub, 512, 160, (g, w, h) => {
    g.fillStyle = '#fff6e6'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? '#e8364f' : '#27a074'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 22); g.closePath(); g.fill(); }
    g.fillStyle = '#c61f3b'; g.font = '74px "Lilita One", "Arial Rounded MT Bold", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 12);
    if (sub) { g.fillStyle = '#2a6f55'; g.font = '30px "Lilita One", sans-serif'; g.fillText(sub, w / 2, h - 22); }
  });
}
const glowTex = canvasTex('glow', 128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,240,200,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const swirlTex = canvasTex('swirl', 256, 256, (g, w, h) => {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill();
  const cols = ['#ff4b64', '#ffb3c6', '#7fd6ff', '#ffe07a'];
  for (let k = 0; k < 4; k++) { g.strokeStyle = cols[k]; g.lineWidth = 16; g.beginPath(); for (let a = 0; a < 18; a += 0.05) { const r = a * 7; g.lineTo(128 + Math.cos(a + k * Math.PI / 2) * r, 128 + Math.sin(a + k * Math.PI / 2) * r); if (r > 120) break; } g.stroke(); }
});

// ================= geometry helpers =================
const GEO = {
  sph: new THREE.SphereGeometry(1, 28, 18), sphL: new THREE.SphereGeometry(1, 14, 10),
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 20), cylL: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 20), coneL: new THREE.ConeGeometry(1, 1, 8),
  tor: new THREE.TorusGeometry(1, 0.28, 10, 28), arc: new THREE.TorusGeometry(1, 0.16, 8, 18, Math.PI),
  oct: new THREE.OctahedronGeometry(1, 0), ico: new THREE.IcosahedronGeometry(1, 1), dodec: new THREE.DodecahedronGeometry(1, 0),
  half: new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, Math.PI / 2), halfCyl: new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI),
  circle: new THREE.CircleGeometry(1, 32), plane: new THREE.PlaneGeometry(1, 1),
};
const BELL_GEO = new THREE.LatheGeometry([[0, 0], [0.5, 0], [0.52, 0.06], [0.4, 0.2], [0.33, 0.5], [0.3, 0.75], [0.2, 0.88], [0.08, 0.93], [0, 0.94]].map(p => new THREE.Vector2(p[0], p[1])), 24);
class CaneCurve extends THREE.Curve {
  constructor(h, r) { super(); this.h = h; this.r = r; }
  getPoint(t, target = new THREE.Vector3()) {
    const h = this.h, r = this.r, L1 = h, L2 = Math.PI * r, s = t * (L1 + L2);
    if (s <= L1) return target.set(0, s, 0);
    const a = (s - L1) / r; return target.set(r - Math.cos(a) * r, L1 + Math.sin(a) * r, 0);
  }
}
const caneGeoCache = new Map();
function caneGeo(h, r, th) {
  const k = h + '|' + r + '|' + th;
  if (!caneGeoCache.has(k)) caneGeoCache.set(k, new THREE.TubeGeometry(new CaneCurve(h, r), 48, th, 12, false));
  return caneGeoCache.get(k);
}
const caneMat = () => MT(stripeTex('#ffffff', '#e8364f', 4, [10, 1]));
function roofGeo(w, d, h) {
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2); return g;
}
const ROOF = roofGeo(3.4, 3.2, 1.5), ROOF_SNOW = roofGeo(3.6, 3.5, 1.65);

function part(geo, mat, p = [0, 0, 0], s = 1, r = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat); m.position.set(p[0], p[1], p[2]);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]);
  m.rotation.set(r[0], r[1], r[2]); return m;
}
const _up = new THREE.Vector3(0, 1, 0);
function stick(geo, mat, a, b, r) {
  const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
  const d = B.clone().sub(A), L = d.length(); const m = new THREE.Mesh(geo, mat);
  m.position.copy(A).add(B).multiplyScalar(0.5); m.scale.set(r, L, r); m.quaternion.setFromUnitVectors(_up, d.normalize()); return m;
}
function setStick(m, A, B, r) {
  const d = new THREE.Vector3().subVectors(B, A); const L = d.length() || 0.001;
  m.position.copy(A).add(B).multiplyScalar(0.5); m.scale.set(r, L, r); m.quaternion.setFromUnitVectors(_up, d.normalize());
}
// Merge every mesh in a group into as few meshes as possible: plain toon colours collapse into one
// vertex-coloured mesh, textured / glowing / transparent materials keep their own bucket.
let VC_MAT = null;
function bake(g) {
  if (!VC_MAT) VC_MAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: TOON });
  g.updateMatrixWorld(true);
  const buckets = new Map();
  g.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material;
    const plain = m.isMeshToonMaterial && !m.map && !m.transparent && (!m.emissive || m.emissive.getHex() === 0);
    const key = plain ? VC_MAT : m;
    if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(o);
  });
  const out = new THREE.Group(); const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  buckets.forEach((meshes, mat) => {
    let total = 0; const vc = mat === VC_MAT;
    const parts = meshes.map(m => {
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); total += geo.attributes.position.count; geo.userData.col = m.material.color; return geo;
    });
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), col = vc ? new Float32Array(total * 3) : null; let o3 = 0, o2 = 0;
    parts.forEach(p => {
      const n = p.attributes.position.count;
      pos.set(p.attributes.position.array, o3); nor.set(p.attributes.normal.array, o3);
      if (p.attributes.uv) uv.set(p.attributes.uv.array, o2);
      if (vc) { const c = p.userData.col; for (let i = 0; i < n; i++) { col[o3 + i * 3] = c.r; col[o3 + i * 3 + 1] = c.g; col[o3 + i * 3 + 2] = c.b; } }
      o3 += n * 3; o2 += n * 2; p.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (vc) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere(); out.add(new THREE.Mesh(geo, mat));
  });
  return out;
}
const _box = new THREE.Box3(), _sph = new THREE.Sphere();
function measure(o) { _box.setFromObject(o); _box.getBoundingSphere(_sph); return { r: _sph.radius, minY: _box.min.y, h: _box.max.y - _box.min.y, w: Math.max(_box.max.x - _box.min.x, _box.max.z - _box.min.z) }; }
