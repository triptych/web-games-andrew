// Loads the generated art (art/manifest.json). Every picture is optional: a missing one is simply skipped and
// the view draws a plain shape in its place, so a failed download never breaks the game.

export const IMG = {};
export let MANIFEST = {};

export async function loadAssets(base = 'art/') {
    try {
        const r = await fetch(base + 'manifest.json');
        MANIFEST = await r.json();
    } catch { MANIFEST = {}; }
    const keys = Object.keys(MANIFEST);
    for (const k of ['staff/imp', 'staff/spider', 'staff/golem', 'staff/gargoyle', 'staff/wraith', 'staff/lich', 'staff/mimic', 'staff/skeleton']) {
        if (!MANIFEST[k]) { MANIFEST[k] = { file: k + '.png' }; keys.push(k); }
    }
    await Promise.all(keys.map((k) => new Promise((res) => {
        const im = new Image();
        im.onload = () => { IMG[k] = im; res(); };
        im.onerror = () => res();
        im.src = base + MANIFEST[k].file;
    })));
    return IMG;
}

export const artUrl = (key) => (MANIFEST[key] ? 'art/' + MANIFEST[key].file : '');
