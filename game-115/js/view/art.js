// Painted art (generated with fal, exported by dev/art/export.py) laid over the code-drawn sprites.
// Everything loads in the background. Until a picture arrives, and if it never does, the painter that
// asks for it gets null and draws the old code sprite instead, so the game never waits on art and a
// missing file costs one sprite, not the screen. ART.v goes up when the pictures have landed; the town
// watches it and swaps its textures in place.

const BASE = new URL('../../art/', import.meta.url);

export const ART = { v: 0, loaded: 0, total: 0, failed: [], done: false, manifest: null };
const imgs = new Map();          // file -> HTMLImageElement (decoded)
let started = null;

function load(file) {
    return new Promise((res) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => { imgs.set(file, im); ART.loaded++; res(true); };
        im.onerror = () => { ART.failed.push(file); res(false); };
        im.src = new URL(file, BASE).href;
    });
}

/** Start loading (once). Resolves when every picture has loaded or failed. */
export function loadArt() {
    if (started) return started;
    started = (async () => {
        let man;
        try { man = await (await fetch(new URL('manifest.json', BASE))).json(); } catch { ART.done = true; return ART; }
        ART.manifest = man;
        const files = [];
        for (const e of Object.values(man.sprites)) { files.push(e.f); if (e.e) files.push(e.e); }
        ART.total = files.length;
        // one swap when everything is in: re-texturing the town is cheap once and a stutter if done per picture
        await Promise.all(files.map(load));
        ART.done = true;
        ART.v++;
        return ART;
    })();
    return started;
}

/** A painted sprite by name: { img, emi, w, h, smoke, hub } in tiles, or null if it is not (yet) loaded. */
export function art(name) {
    const e = ART.manifest?.sprites[name];
    if (!e) return null;
    const img = imgs.get(e.f);
    if (!img) return null;
    return { img, emi: e.e ? imgs.get(e.e) || null : null, w: e.t[0], h: e.t[1], smoke: e.smoke || [], hub: e.hub || null, name };
}

/** Every name the manifest knows (for the gallery and the browser test). */
export const artNames = () => Object.keys(ART.manifest?.sprites || {});
