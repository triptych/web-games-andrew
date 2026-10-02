// Places to pull over. Each type has names, a set piece built into the city
// chunk where it starts, a camera framing for while you're parked, a handful of
// lines that drift past while you sit there, and one small thing to do.

import * as THREE from 'three';
import { STOP_LEN, ROAD_HALF, CURB_H } from './config.js';
import { makeRand } from './rng.js';
import { hexToRgb } from './geo.js';

export const STOP_TYPES = {
    noodle: {
        label: 'Noodle Bar', color: '#ff4b4b',
        names: ['White Dragon Noodle Bar', 'Ichiban Noodle', 'Midnight Ramen', 'Hoshi Ramen', 'Noodle Bar No. 4', "Kenji's Counter"],
        lines: [
            'Four stools, all wet. The cook wipes one down with his sleeve and nods you onto it.',
            'Steam rolls off the broth and up into the neon, turning pink, then gone.',
            'Someone two stools down is asleep in his coat, chopsticks still in hand.',
            'The radio behind the counter is on your station, half a second behind.',
            'A plastic curtain keeps out most of the rain. Most of it.',
            "The menu is four pictures and a price that hasn't changed in twenty years.",
            'A spinner hums past overhead, low enough to rattle the bowls.',
        ],
        action: 'Order a bowl',
        results: [
            'He holds up four fingers. You hold up two. He makes it four anyway.',
            'Hot broth, soft noodles, a slice of something that was probably pork. Perfect.',
            'You eat slowly. The rain keeps time on the awning.',
            "The cook slides over a free egg. He doesn't say why, and you don't ask.",
        ],
    },
    diner: {
        label: 'All-Night Diner', color: '#ff6ad5',
        names: ['Starlite Diner', 'The Night Owl', "Ozzie's 24H", 'Moonbeam Diner', "Rosie's All-Nite"],
        lines: [
            "The coffee's been on the burner since the last shift change. It's still the best in the ward.",
            'A waitress with chrome fingernails refills a cup nobody asked her to.',
            'Two cab drivers argue softly about a route that no longer exists.',
            'The jukebox plays a song from before you were born. Nobody minds.',
            'Rain streaks the long window. Inside it smells like toast and ozone.',
            'A man in a long coat stares into a slice of pie like it owes him money.',
        ],
        action: 'Coffee and pie',
        results: [
            'Cherry. Probably synthetic. Still good.',
            'The coffee is black and bottomless and very, very hot.',
            "She calls you 'hon' and means it.",
            "You leave a tip under the saucer. The rain doesn't let up.",
        ],
    },
    charge: {
        label: 'Charging Station', color: '#2ff3ff',
        names: ['Bluebolt Charge', 'Ampere Station', 'Halo Power', 'Station 9 Fast Charge', 'Voltaic 24'],
        lines: [
            'The cable is warm. A soft blue ring counts your battery up.',
            'An attendant in a rain cape watches a tiny TV in the kiosk.',
            'Moths circle the canopy lights, confused about the moon.',
            'A delivery drone docks overhead and folds its rotors like a tired bird.',
            'Puddles under the canopy hold the whole sign upside down.',
        ],
        action: 'Top up the battery',
        results: [
            'Full. The meter clicks over to a round number and stops.',
            'Twelve minutes. You spend them watching rain run off the canopy.',
            'The kiosk sells canned coffee. You buy two out of habit.',
            'The charger plays a little chime when it finishes. Someone programmed that with love.',
        ],
    },
    overlook: {
        label: 'Overlook', color: '#b6ff2f',
        names: ['Skyway Overlook', 'Halo View Rest Area', 'Lookout 9', 'The Long View'],
        lines: [
            'From up here the city looks like a circuit board someone left switched on.',
            'The rain thins for a moment and you can see all the way to the arcology.',
            'A vending machine hums beside the railing, glowing like a small shrine.',
            'Far below, traffic moves like a slow red river.',
            'Wind tugs at your coat. Somewhere a siren rises and fades.',
            'Spinners drift between the towers, blinking, in no particular hurry.',
        ],
        action: 'Look out over the city',
        results: [
            'You count the lit windows in one tower and give up at three hundred.',
            'The pyramid glows on the horizon, patient as a mountain.',
            'Lightning walks across the clouds without making a sound.',
            'You stand there long enough to feel like part of the view.',
        ],
    },
    konbini: {
        label: 'Konbini', color: '#4bff9b',
        names: ['Lucky Mart', 'Moonlight 24', 'Hana 24', 'Kumo Mart', 'StarStop 24'],
        lines: [
            'The doors chime the same two notes they always do.',
            'Fluorescent light, cold aisles, and a clerk reading a paper book.',
            'Rows of rice balls and canned coffee, lined up like soldiers.',
            'A stray cat sleeps under the magazine rack. Everyone steps around it.',
            'The heater by the door is the warmest place in the ward.',
        ],
        action: 'Buy a hot can of coffee',
        results: [
            'Too sweet and exactly right. It warms your hands for ten minutes.',
            'The clerk gives you a receipt longer than the can.',
            'You also buy a rice ball. Tuna mayo. A solid choice.',
            'Two notes on the way out. Rain on the way back.',
        ],
    },
    records: {
        label: 'Record Shop', color: '#a07bff',
        names: ['Vinyl Ghost Records', 'Second Spin', 'Wax & Static', 'Lowtide Records', 'Groove Archive'],
        lines: [
            "Crates of vinyl, most of it unlabelled. The owner says that's the point.",
            'A synth record turns on the shop deck, slow and warm and crackling.',
            'The owner is older than the building and knows where every record is.',
            'Posters of bands that never got famous cover every inch of wall.',
            'Rain on the window, needle in the groove, nobody in a hurry.',
        ],
        action: 'Dig through a crate',
        results: [
            "A record with no sleeve and a handwritten label: 'for night drives'.",
            'A cassette falls out of a jacket. The owner says keep it.',
            "Side B, track 3. You'll be humming it for a week.",
            'The owner plays you something from 1983 and watches your face.',
        ],
    },
    arcade: {
        label: 'Arcade', color: '#ffe94b',
        names: ['Pixel Palace', 'Game Center Nova', 'Neon Dojo', 'Coin-Op Heaven', 'Hi-Score Hall'],
        lines: [
            'Cabinets chirp and glow in the dark like a reef at night.',
            'Two kids in rain capes duel at a fighting game with terrifying focus.',
            'The high score on the shooter has had the same initials for eleven years.',
            'A claw machine full of plush squid waits for someone lucky.',
            'The carpet is patterned with stars and older than everyone here.',
        ],
        action: 'Play one credit',
        results: [
            "You lose on the third stage. CONTINUE? it asks. You don't.",
            'You clear the first boss and a stranger nods at you, once.',
            'The claw grabs a plush squid… and drops it. Of course.',
            'Your initials land in ninth place. It counts.',
        ],
    },
    motel: {
        label: 'Motel', color: '#ff8c2f',
        names: ['Motel Aurora', 'Starfall Inn', 'Blue Lagoon Motel', 'Last Exit Motor Lodge', 'Motel Kosmos'],
        lines: [
            'Half the VACANCY sign is lit. The other half gave up years ago.',
            'An ice machine somewhere rattles like a train.',
            'Rain drips from the walkway rail onto the hood of your car.',
            'A door opens, a TV flickers inside, the door closes again.',
            'The night manager raises a hand from behind the glass without looking up.',
        ],
        action: 'Rest your eyes',
        results: [
            'You close your eyes. The engine ticks as it cools.',
            'Five minutes, maybe ten. The radio keeps you company.',
            'You dream briefly of the sea, then the rain brings you back.',
            'When you open your eyes the sign says NO VACANCY. Then it flickers back.',
        ],
    },
    laundry: {
        label: 'Laundromat', color: '#3bffd1',
        names: ['Spin Cycle 24', 'Bubble Wash', 'Suds City', 'Clean Machine', 'The Washhouse'],
        lines: [
            'Rows of round windows turning slowly, like a wall of little moons.',
            'It smells of warm cotton and cheap soap. It smells like being looked after.',
            'A woman folds shirts with the precision of a surgeon.',
            "The change machine gives you old coins with someone else's face on them.",
            'Someone left a paperback on the bench, bookmarked halfway.',
        ],
        action: 'Watch the machines spin',
        results: [
            "Round and round. It's better than television.",
            'A dryer buzzes and nobody comes for their clothes.',
            "You read a page of the abandoned paperback. It's about rain.",
            'The rhythm of the machines slows your breathing down.',
        ],
    },
    pier: {
        label: 'Pier', color: '#4b8bff',
        names: ['Pier 9', 'Old Ferry Landing', "Fishmonger's Wharf", 'Breakwater Pier', 'Pier 31'],
        lines: [
            'Black water slaps the pilings. Ship lights smear across it.',
            "A fisherman under a tarp checks a line that hasn't moved all night.",
            'Gulls sleep on the railing, heads tucked, unbothered by the rain.',
            'A ferry horn sounds, low and long, from somewhere out in the fog.',
            'The air tastes of salt and diesel and frying shrimp.',
        ],
        action: 'Walk to the end of the pier',
        results: [
            "The city is behind you. Ahead there's only fog and the blink of a buoy.",
            'You find a coin on the boards and throw it in. Old habits.',
            'The fisherman offers you a skewer of grilled squid. You take it.',
            "A ship's searchlight sweeps the water and doesn't find you.",
        ],
    },
};

export const AMBIENT_LINES = [
    'Rain ticks on the roof of the car.',
    'The wipers rest. The radio murmurs.',
    "The city doesn't sleep, but it does get quiet.",
    'Somewhere far off, a siren. Then nothing.',
    'Your breath fogs the window a little.',
];

/** Gives a stop its name and camera framing (deterministic from its seed). */
export function nameStop(st) {
    const r = makeRand(st.seed);
    const T = STOP_TYPES[st.type];
    st.name = r.pick(T.names);
    st.label = T.label;
    st.def = T;
    // camera framing, relative to the bay centre: [along, u, height above road]
    // (the parked card sits on the left, so every framing keeps the car centre or right)
    st.view = st.type === 'overlook'
        ? { cam: [18, 4, 2.6], look: [-6, 30, -3] }
        : st.type === 'pier'
            ? { cam: [-16, 1.5, 2.4], look: [6, 18, 1.8] }
            : { cam: [-16, 1.5, 2.4], look: [4, 12.5, 2.2] };
}

// ------------------------------------------------------------------
// Set pieces
// ------------------------------------------------------------------

function nameTexture(text, sub, color) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(8,4,14,0.92)';
    g.beginPath(); g.roundRect(6, 6, 500, 116, 14); g.fill();
    g.shadowColor = color; g.shadowBlur = 14;
    g.strokeStyle = color; g.lineWidth = 4;
    g.beginPath(); g.roundRect(10, 10, 492, 108, 12); g.stroke();
    const font = '"Arial Black","Impact",Arial,sans-serif';
    let size = 52;
    g.font = `${size}px ${font}`;
    while (g.measureText(text).width > 450 && size > 20) { size -= 2; g.font = `${size}px ${font}`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(text, 256, sub ? 54 : 64);
    g.shadowBlur = 4;
    g.fillStyle = '#fff';
    g.globalAlpha = 0.6;
    g.fillText(text, 256, sub ? 54 : 64);
    g.globalAlpha = 1;
    if (sub) {
        g.font = `20px ${font}`;
        g.shadowBlur = 8;
        g.fillStyle = '#ffffff';
        g.fillText(sub, 256, 98);
    }
    const t = new THREE.CanvasTexture(c);
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
}

export function buildStop(ctx, st) {
    if (!st.name) nameStop(st);
    const { road, G, ox, oz, extra, vents } = ctx;
    const R = makeRand(st.seed ^ 0xabc);
    const sm = st.s + STOP_LEN / 2;
    const f = road.frame(sm, {});
    const y = road.elevation(sm);
    const tx = f.tx, tz = f.tz, rx = f.rx, rz = f.rz;
    const bx = f.x - ox, bz = f.z - oz;
    const at = (along, u, dy = 0) => [bx + tx * along + rx * u, y + dy, bz + tz * along + rz * u];
    const color = hexToRgb(st.def.color);
    const fn = [-rx, -rz];      // facing the road

    const box = (geo, along, u, y0, y1, hwAlong, hwU, col, opts) => {
        const p = at(along, u);
        geo.box(p[0], p[2], y + y0, y + y1, tx, tz, hwAlong, hwU, col, opts && opts.win ? opts.win : null, opts);
    };
    const facadeQuad = (along0, along1, u, y0, y1, colBot, colTop = colBot) => {
        const a = at(along0, u), b = at(along1, u);
        G.flat.quad([a[0], y + y0, a[2]], [b[0], y + y0, b[2]], [b[0], y + y1, b[2]], [a[0], y + y1, a[2]],
            [colBot, colBot, colTop, colTop], null, [fn[0], 0, fn[1]]);
    };
    const nameSign = (along, u, y0, width, sub = null, twoSided = false) => {
        const tex = nameTexture(st.name.toUpperCase(), sub, st.def.color);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
        const geo = new THREE.BufferGeometry();
        const hw = width / 2, h = width / 4;
        const pos = [], uv = [];
        const faces = twoSided ? [1, -1] : [1];
        for (const dir of faces) {
            const nx = fn[0] * dir, nz = fn[1] * dir;
            const qx = nz, qz = -nx;
            const c = at(along, u - 0.05 * dir);
            const p0 = [c[0] - qx * hw, y + y0, c[2] - qz * hw], p1 = [c[0] + qx * hw, y + y0, c[2] + qz * hw];
            const p2 = [p1[0], y + y0 + h, p1[2]], p3 = [p0[0], y + y0 + h, p0[2]];
            pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
            uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.computeBoundingSphere();
        extra.push({ mesh: new THREE.Mesh(geo, mat), texture: tex, material: mat, order: 2 });
        const g = at(along, u - 1.2, y0 + h / 2);
        G.pts.add(g[0], g[1], g[2], color, width * 0.5);
    };
    const ped = (along, u) => {
        const p = at(along, u);
        const c = [0.04, 0.035, 0.05];
        G.flat.box(p[0], p[2], y + CURB_H, y + CURB_H + 1.45, tx, tz, 0.22, 0.14, c);
        G.flat.box(p[0], p[2], y + CURB_H + 1.45, y + CURB_H + 1.72, tx, tz, 0.11, 0.11, c);
        if (R.chance(0.75)) {
            const uc = R.pick([[0.2, 0.9, 1], [1, 0.3, 0.7], [1, 0.8, 0.3], [0.7, 0.4, 1]]);
            G.flat.box(p[0], p[2], y + CURB_H + 1.1, y + CURB_H + 2.0, tx, tz, 0.025, 0.025, uc, null, { flat: true });
            G.flat.box(p[0], p[2], y + CURB_H + 2.0, y + CURB_H + 2.08, tx, tz, 0.6, 0.6, uc.map((v) => v * 0.35), null, { bottom: true });
            G.pts.add(p[0], y + CURB_H + 1.6, p[2], uc, 0.6);
        }
    };
    const backdrop = (h, u0 = 16, depth = 14, along0 = -23, along1 = 23) => {
        const win = { cw: 3.2, ch: 3.6, ou: R.int(0, 31) / 32, ov: R.int(0, 31) / 32 };
        const p = at((along0 + along1) / 2, u0 + depth / 2);
        G.bld.box(p[0], p[2], 0, y + h, tx, tz, (along1 - along0) / 2, depth / 2, ctx.def.tint[0].map((v) => v * 0.8), win);
    };
    const shopGlass = (along0, along1, u, col) => {
        facadeQuad(along0, along1, u - 0.04, 0.3 + CURB_H, 3.4, col, col.map((v) => v * 0.6));
    };

    switch (st.type) {
    case 'noodle': {
        backdrop(R.range(12, 20), 17.5);
        box(G.flat, 0, 16.9, 0, 4.2, 9, 0.5, [0.06, 0.04, 0.04], { top: false });
        shopGlass(-8, 8, 16.4, [1, 0.62, 0.32]);
        box(G.flat, 0, 15.9, CURB_H, 1.15, 7, 0.45, [0.28, 0.14, 0.07]);
        box(G.flat, 0, 15.0, 3.0, 3.2, 8.5, 1.9, [0.45, 0.04, 0.05], { bottom: true });
        for (let a = -8; a <= 8; a += 1.6) {
            const p = at(a, 13.2, 2.75);
            G.pts.add(p[0], p[1], p[2], R.chance(0.8) ? [1, 0.25, 0.1] : [1, 0.7, 0.3], 0.75);
        }
        for (let a = -5; a <= 5; a += 2) box(G.flat, a, 15.0, CURB_H, 0.75, 0.22, 0.22, [0.15, 0.1, 0.1]);
        box(G.flat, 1.5, 16.9, 0.4, 2.1, 0.3, 0.25, [0.02, 0.02, 0.03]);
        box(G.flat, 1.5, 16.9, 2.1, 2.4, 0.13, 0.13, [0.02, 0.02, 0.03]);
        nameSign(0, 13.8, 3.3, 8);
        const v = at(3, 15.6, 1.2);
        vents.push({ s: sm + 3, x: v[0] + ox, y: v[1], z: v[2] + oz, rate: 2.2 });
        ped(-6, 14.2); ped(5.5, 13.4);
        break;
    }
    case 'diner': {
        backdrop(R.range(16, 40), 24, 16);
        box(G.flat, 0, 21, 0, 5.4, 17, 5, [0.3, 0.3, 0.34]);
        shopGlass(-15, 15, 16, [1, 0.82, 0.55]);
        for (let a = -14; a < 15; a += 3) box(G.flat, a, 16.02, CURB_H, 3.4, 0.05, 0.04, [0.12, 0.12, 0.14], { top: false });
        box(G.flat, 0, 15.95, 3.7, 4.0, 17, 0.06, color, { flat: true, top: false });
        box(G.flat, -14, 13.5, CURB_H, 9, 0.15, 0.15, [0.15, 0.15, 0.18]);
        nameSign(-14, 13.5, 9, 7, 'OPEN ALL NITE', true);
        nameSign(0, 15.7, 4.2, 9);
        ped(-4, 14.4); ped(9, 13.8);
        break;
    }
    case 'charge': {
        backdrop(R.range(14, 30), 26, 14);
        box(G.flat, 0, 15, 5.0, 5.6, 13, 6.8, [0.18, 0.18, 0.22], { bottom: true });
        for (const a of [-11, 11]) for (const u of [10.5, 20]) box(G.flat, a, u, 0, 5, 0.2, 0.2, [0.2, 0.2, 0.24]);
        for (let a = -11; a <= 11; a += 3.5) for (let u = 10; u <= 20; u += 3.3) {
            const p = at(a, u, 4.9);
            G.pts.add(p[0], p[1], p[2], [0.85, 0.95, 1], 1.1);
        }
        for (let a = -9; a <= 9; a += 6) {
            box(G.flat, a, 12.2, CURB_H, 1.7, 0.3, 0.2, [0.1, 0.1, 0.13]);
            const p = at(a, 11.95, 1.4);
            G.pts.add(p[0], p[1], p[2], [0.2, 0.95, 1], 0.6);
            facadeQuad(a - 0.2, a + 0.2, 11.97, 1.0, 1.5, [0.2, 0.9, 1]);
        }
        box(G.flat, 4, 19.5, 0, 3.2, 3, 2, [0.08, 0.08, 0.1]);
        shopGlass(1.2, 6.8, 17.45, [0.75, 0.9, 1]);
        nameSign(0, 8.15, 5.65, 9);
        ped(5, 16.4);
        break;
    }
    case 'overlook': {
        // a deck bolted onto the viaduct, with a railing and a view
        for (let a = -STOP_LEN / 2 - 2; a < STOP_LEN / 2 + 2; a += 4) {
            const p0 = at(a, ROAD_HALF), p1 = at(a, 19), p2 = at(a + 4, 19), p3 = at(a + 4, ROAD_HALF);
            G.road.quad(p0, p1, p2, p3, [ROAD_HALF, a], [19, a], [19, a + 4], [ROAD_HALF, a + 4], [2, 0]);
            const q0 = at(a, 19), q1 = at(a + 4, 19);
            G.flat.quad([q0[0], y - 1.5, q0[2]], [q1[0], y - 1.5, q1[2]], [q1[0], y, q1[2]], [q0[0], y, q0[2]], [0.07, 0.065, 0.08], null, [rx, 0, rz]);
            G.flat.quad(at(a, ROAD_HALF, -1.5), at(a, 19, -1.5), at(a + 4, 19, -1.5), at(a + 4, ROAD_HALF, -1.5), [0.05, 0.045, 0.06], null, [0, -1, 0]);
            G.lines.seg(at(a, 18.7, 1.05), at(a + 4, 18.7, 1.05), [0.35, 0.35, 0.4]);
            box(G.flat, a, 18.7, 0, 1.05, 0.05, 0.05, [0.2, 0.2, 0.24]);
            const lp = at(a, 18.7, 1.1);
            G.pts.add(lp[0], lp[1], lp[2], color, 0.35);
        }
        for (const a of [-STOP_LEN / 2 - 2, STOP_LEN / 2 + 2]) {
            const p = at(a, 13);
            G.flat.box(p[0], p[2], y - 1.5, y + 1, -rz, rx, 6, 0.15, [0.1, 0.1, 0.12]);
        }
        box(G.flat, 0, 13, -0.8 - y, -1.5, 1.4, 2.2, [0.1, 0.095, 0.12]);
        // vending machine, bench, coin binoculars
        box(G.flat, -6, 17.4, 0, 1.9, 0.5, 0.45, [0.1, 0.1, 0.12]);
        facadeQuad(-6.4, -5.6, 16.93, 0.4, 1.8, [0.95, 0.95, 1], [0.5, 0.8, 1]);
        const vp = at(-6, 16.5, 1.3); G.pts.add(vp[0], vp[1], vp[2], [0.6, 0.85, 1], 1.4);
        box(G.flat, 2, 17.6, 0.4, 0.5, 1.5, 0.3, [0.14, 0.1, 0.08]);
        box(G.flat, 8, 18.1, 0, 1.2, 0.06, 0.06, [0.25, 0.25, 0.28]);
        box(G.flat, 8, 18.1, 1.2, 1.5, 0.25, 0.15, [0.25, 0.25, 0.28]);
        const sp = at(-12, 18.4);
        G.flat.box(sp[0], sp[2], y, y + 3, tx, tz, 0.08, 0.08, [0.15, 0.15, 0.18]);
        nameSign(-12, 18.3, 3, 4);
        ped(4, 17.9); ped(10.5, 18.0);
        break;
    }
    case 'konbini': {
        backdrop(R.range(12, 30), 17.5);
        box(G.flat, 0, 17, 0, 4.6, 12, 0.6, [0.08, 0.08, 0.1], { top: false });
        shopGlass(-11, 11, 16.4, [0.62, 0.68, 0.72]);
        for (let a = -10; a < 10; a += R.range(2.5, 4.5)) {
            facadeQuad(a, a + R.range(0.6, 1.4), 16.33, 1.4, 2.6, R.pick([[0.9, 0.3, 0.3], [0.3, 0.6, 0.9], [0.9, 0.8, 0.3]]));
        }
        const bands = [[0.1, 0.8, 0.3], [0.1, 0.4, 1], [1, 0.45, 0.1]];
        box(G.flat, 0, 16.35, 3.6, 3.85, 12, 0.05, R.pick(bands), { flat: true, top: false });
        box(G.flat, 0, 16.35, 3.85, 4.1, 12, 0.05, R.pick(bands), { flat: true, top: false });
        nameSign(-4, 16.2, 4.2, 7);
        box(G.flat, 8, 15.6, CURB_H, 1.0, 0.3, 0.3, [0.15, 0.25, 0.2]);
        ped(2, 14); ped(-9, 15.2); ped(6, 13.2);
        break;
    }
    case 'records': {
        backdrop(R.range(14, 26), 17.5);
        box(G.flat, 0, 17, 0, 4.4, 10, 0.6, [0.06, 0.05, 0.08], { top: false });
        shopGlass(-6, 6, 16.4, [0.6, 0.35, 1]);
        for (let a = -5; a <= 5; a += 2.5) {
            const p = at(a, 16.3, 2.4);
            G.pts.add(p[0], p[1], p[2], [0.9, 0.5, 1], 1.0);
        }
        nameSign(0, 16.2, 4.2, 8);
        ped(-3, 14.6);
        break;
    }
    case 'arcade': {
        backdrop(R.range(14, 34), 17.5);
        box(G.flat, 0, 17, 0, 4.6, 12, 0.6, [0.05, 0.04, 0.07], { top: false });
        shopGlass(-10, 10, 16.4, [0.8, 0.22, 0.66]);
        for (let a = -10, i = 0; a <= 10; a += 0.8, i++) {
            const p = at(a, 16.2, 4.3);
            G.pts.add(p[0], p[1], p[2], i % 2 ? [1, 0.9, 0.3] : [0.3, 1, 1], 0.5, 1.2, i * 0.07, 0.35);
        }
        for (let a = -8; a <= 8; a += 2.2) {
            box(G.flat, a, 17.1, 0, 2.0, 0.5, 0.4, [0.05, 0.05, 0.08]);
            const p = at(a, 16.6, 1.5);
            G.pts.add(p[0], p[1], p[2], R.pick([[0.3, 1, 0.6], [1, 0.3, 0.5], [0.4, 0.6, 1]]), 0.7);
        }
        nameSign(0, 16.2, 4.7, 9);
        ped(-6, 14.1); ped(-5.2, 14.3); ped(7, 15.0);
        break;
    }
    case 'motel': {
        backdrop(R.range(10, 22), 30, 12);
        for (let a = -STOP_LEN / 2; a < STOP_LEN / 2; a += 4) {
            G.road.quad(at(a, 15.5, CURB_H), at(a, 19.5, CURB_H), at(a + 4, 19.5, CURB_H), at(a + 4, 15.5, CURB_H),
                [15.5, a], [19.5, a], [19.5, a + 4], [15.5, a + 4], [2, 0]);
        }
        box(G.flat, 0, 24, 0, 7.4, 20, 4.5, [0.24, 0.17, 0.2]);
        box(G.flat, 0, 18.8, 3.5, 3.75, 20, 0.8, [0.18, 0.13, 0.15], { bottom: true });
        G.lines.seg(at(-20, 18.1, 4.7), at(20, 18.1, 4.7), [0.5, 0.45, 0.4]);
        for (let a = -18; a <= 18; a += 4) {
            for (const fl of [0, 3.7]) {
                facadeQuad(a - 0.5, a + 0.5, 19.47, fl + CURB_H, fl + 2.3, [0.04, 0.03, 0.04]);
                const lit = R.chance(0.45);
                facadeQuad(a + 0.8, a + 2.2, 19.47, fl + 1.0, fl + 2.1, lit ? [1, 0.7, 0.4] : [0.06, 0.06, 0.09]);
                const p = at(a, 19.2, fl + 2.6);
                G.pts.add(p[0], p[1], p[2], [1, 0.8, 0.5], 0.5);
            }
        }
        box(G.flat, -15, 14, CURB_H, 11, 0.18, 0.18, [0.15, 0.15, 0.18]);
        nameSign(-15, 14, 11, 7, 'VACANCY', true);
        ped(6, 18.5);
        break;
    }
    case 'laundry': {
        backdrop(R.range(12, 26), 17.5);
        box(G.flat, 0, 17, 0, 4.4, 11, 0.6, [0.07, 0.07, 0.08], { top: false });
        shopGlass(-10, 10, 16.4, [0.75, 1, 0.9]);
        for (let a = -9; a <= 9; a += 1.5) {
            for (const h of [0.9, 2.1]) {
                const p = at(a, 16.3, h);
                G.pts.add(p[0], p[1], p[2], [0.6, 1, 0.95], 0.9, 0, 0, 1);
            }
        }
        nameSign(0, 16.2, 4.3, 8);
        ped(-2, 15);
        break;
    }
    case 'pier': {
        const pierU0 = 12.6, pierU1 = 70;
        const pm = at(0, (pierU0 + pierU1) / 2);
        G.flat.box(pm[0], pm[2], -0.5, y + 0.15, tx, tz, 5, (pierU1 - pierU0) / 2, [0.12, 0.09, 0.07]);
        for (let u = pierU0; u < pierU1; u += 8) {
            for (const a of [-4.6, 4.6]) {
                const p = at(a, u);
                G.flat.box(p[0], p[2], 0.15, 1.1, tx, tz, 0.06, 0.06, [0.18, 0.15, 0.12]);
            }
            const lp = at(4.6, u, 3.2);
            G.flat.box(lp[0], lp[2], 0.15, 3.1, tx, tz, 0.07, 0.07, [0.12, 0.12, 0.13]);
            G.pts.add(lp[0], lp[1], lp[2], [1, 0.75, 0.45], 1.4);
        }
        for (const a of [-4.5, 4.5]) box(G.flat, a, 13.2, CURB_H, 5.5, 0.18, 0.18, [0.2, 0.18, 0.2]);
        box(G.flat, -9, 18, CURB_H, 1.2, 1.8, 1.0, [0.25, 0.14, 0.08]);
        box(G.flat, -9, 18, 2.6, 2.8, 2.4, 1.6, [0.1, 0.25, 0.4], { bottom: true });
        for (let a = -11, i = 0; a <= -7; a += 1, i++) {
            const p = at(a, 16.4, 2.5);
            G.pts.add(p[0], p[1], p[2], [1, 0.3, 0.15], 0.6);
        }
        ctx.city._boat(ctx, at(0, pierU1 + 6, 0), rx, rz, 14);
        nameSign(0, 13.2, 5.5, 8);
        ped(-1, 22); ped(1, 40);
        break;
    }
    }
}
