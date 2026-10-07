// Quick geometry report for every track: length, tightest bend, closest approach between distant
// parts of the loop (bridges excepted), steepest slope.
import { Track } from '../js/sim/track.js';
import { TRACKS, trackDef } from '../js/sim/tracks.js';
const only = process.argv[2];
for (const id of Object.keys(TRACKS)) {
    if (only && !only.split(',').includes(id)) continue;
    const t = new Track(trackDef(id));
    let minR = Infinity, minRi = 0, rawR = Infinity;
    for (let i = 0; i < t.N; i++) { const k = Math.abs(t.kap[i]); if (1 / k < minR) { minR = 1 / k; minRi = i; } rawR = Math.min(rawR, 1 / Math.abs(t.kRaw[i])); }
    const need = 2 * t.wall + 6;
    let minC = Infinity, ci = 0, cj = 0;
    const skip = Math.ceil((t.wall * 3.2) / t.ds);
    for (let i = 0; i < t.N; i += 1) for (let j = i + skip; j < t.N; j += 1) {
        if (t.N - j + i < skip) continue;
        if (Math.abs(t.py[i] - t.py[j]) > 5.5) continue;
        const d = Math.hypot(t.px[i] - t.px[j], t.pz[i] - t.pz[j]);
        if (d < minC) { minC = d; ci = i; cj = j; }
    }
    let maxS = 0;
    for (let i = 0; i < t.N; i++) maxS = Math.max(maxS, Math.abs(t.slopeAt(i)));
    const bad = (rawR < t.wall + 3.5 ? ' TIGHT' : '') + (minC < need ? ' CLOSE' : '');
    console.log(`${id.padEnd(13)} L=${t.L.toFixed(0).padStart(5)}m N=${t.N} minR=${minR.toFixed(1)}@${(minRi / t.N).toFixed(2)} clear=${minC.toFixed(1)}/${need.toFixed(0)}@${(ci / t.N).toFixed(2)},${(cj / t.N).toFixed(2)} raw=${rawR.toFixed(1)} wall=${t.wall} slope=${maxS.toFixed(2)}${bad}`);
}
