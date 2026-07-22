/**
 * sounds.js — Web Audio API procedural sound effects.
 * Call initAudio() on first user gesture.
 */
let ac = null, master = null, on = true;

export function initAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain();
  master.gain.value = 0.28;
  master.connect(ac.destination);
}
export function toggleSound() { on = !on; return on; }

function osc(type, f, dur, vol = 0.3, delay = 0) {
  if (!on || !ac) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + delay;
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.01);
}
function sweep(type, f0, f1, dur, vol = 0.3, delay = 0) {
  if (!on || !ac) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.01);
}
function noise(dur, vol = 0.15, delay = 0) {
  if (!on || !ac) return;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = buf;
  const g = ac.createGain(), t = ac.currentTime + delay;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(g); g.connect(master); s.start(t);
}

export const sfx = {
  cursor:  () => osc('square', 520, 0.05, 0.12),
  confirm: () => { osc('sine', 660, 0.07, 0.18); osc('sine', 880, 0.09, 0.14, 0.05); },
  cancel:  () => osc('sine', 300, 0.09, 0.15),
  step:    () => osc('sine', 180, 0.04, 0.06),
  hit:     () => { sweep('square', 320, 90, 0.12, 0.25); noise(0.08, 0.1); },
  cast:    () => { sweep('sine', 400, 1200, 0.25, 0.2); osc('triangle', 900, 0.2, 0.12, 0.1); },
  heal:    () => { const n=[523,659,784]; n.forEach((f,i)=>osc('sine', f, 0.2, 0.16, i*0.06)); },
  coin:    () => { osc('square', 988, 0.06, 0.16); osc('square', 1319, 0.1, 0.13, 0.05); },
  encounter:() => { sweep('sawtooth', 200, 600, 0.3, 0.25); osc('square', 300, 0.4, 0.15, 0.1); },
  victory: () => { const n=[523,659,784,1047]; n.forEach((f,i)=>osc('sine', f, 0.25, 0.2, i*0.1)); },
  defeat:  () => { sweep('sawtooth', 400, 60, 0.9, 0.35); noise(0.5, 0.14, 0.15); },
};
