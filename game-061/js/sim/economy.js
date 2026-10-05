// Station markets. Prices = base × economy × species taste × per-station jitter × supply.
// Supply moves with your trades and recovers over time, so a single market can't be pumped.

import { ITEMS, ALL_ITEMS, ECONOMIES, RAW } from '../config.js';
import { RNG, sub } from '../rng.js';

const RECOVER = 900; // seconds for supply offsets to decay by e

function baseline(galaxy, station) {
    if (station._baseline) return station._baseline;
    const sp = galaxy.species[station.species];
    const econ = ECONOMIES[station.economy] || ECONOMIES.frontier;
    const r = new RNG(sub(station.seed, 'market'));
    const out = {};
    for (const id of ALL_ITEMS) {
        const it = ITEMS[id];
        let f = r.range(0.9, 1.1);
        let stock = it.cat === 'goods' ? r.int(0, 6) : it.cat === 'raw' ? r.int(10, 60) : r.int(0, 20);
        if (econ.makes.includes(id)) { f *= 0.7; stock += it.cat === 'goods' ? r.int(30, 80) : r.int(80, 220); }
        if (econ.wants.includes(id)) f *= 1.35;
        if (sp) {
            if (sp.craves.includes(id)) f *= 1.35 + (sub(station.seed, id) % 35) / 100;
            if (sp.makes.includes(id)) { f *= 0.76; stock += r.int(25, 70); }
        }
        if (id === 'fuelcell') stock = Math.max(stock, 30);
        if (id === 'rations') stock = Math.max(stock, 20);
        if (station.kind === 'outpost') stock = Math.round(stock * 0.6);
        if (station.kind === 'hub') stock = Math.round(stock * 1.3);
        if (id === 'exotic' || id === 'voidstone') stock = Math.min(stock, 4);
        const taboo = sp && sp.taboo === id;
        out[id] = { f, stock: taboo ? 0 : stock, taboo };
    }
    Object.defineProperty(station, '_baseline', { value: out, enumerable: false });
    return out;
}

export function marketState(game, station) {
    const st = game.s.markets[station.id] || (game.s.markets[station.id] = { t: game.s.time, d: {}, stock: {} });
    const dt = game.s.time - st.t;
    if (dt > 0) {
        const k = Math.exp(-dt / RECOVER);
        for (const id in st.d) { st.d[id] *= k; if (Math.abs(st.d[id]) < 0.002) delete st.d[id]; }
        for (const id in st.stock) { st.stock[id] *= k; if (Math.abs(st.stock[id]) < 0.5) delete st.stock[id]; }
        st.t = game.s.time;
    }
    return st;
}

// What the station pays you per unit (sell) and what you pay (buy), and units in stock.
export function quote(game, station, id) {
    const b = baseline(game.galaxy, station)[id];
    const st = marketState(game, station);
    const sp = game.galaxy.species[station.species];
    const standing = sp ? game.standing(sp.id) : 0;
    let mood = 1 + Math.max(-0.2, Math.min(0.12, standing / 500));
    if (game.hasTech('xeno') && sp) mood += 0.1;
    mood += game.embassyBonus() * 0.04;
    const d = st.d[id] || 0;
    const sell = b.taboo ? 0 : Math.max(1, Math.round(ITEMS[id].price * b.f * (1 + d) * mood));
    const buyRaw = ITEMS[id].price * b.f * (1 + Math.max(0, d) * 0.8 + Math.max(0, -(st.stock[id] || 0)) / (b.stock + 40) * 0.6) * 1.14 / Math.min(mood, 1.08);
    const buy = Math.max(sell + 1, Math.round(buyRaw));
    const stock = Math.max(0, Math.floor(b.stock + (st.stock[id] || 0)));
    return { sell, buy, stock, taboo: b.taboo, crave: sp ? sp.craves.includes(id) : false, make: sp ? sp.makes.includes(id) : false, f: b.f };
}

const elasticity = (game, station, id) => 0.55 / (baseline(game.galaxy, station)[id].stock + 70);

export function sellTo(game, station, id, n) {
    const st = marketState(game, station);
    let total = 0;
    for (let i = 0; i < n; i++) {
        const q = quote(game, station, id);
        if (q.taboo) break;
        total += q.sell;
        st.d[id] = Math.max(-0.65, (st.d[id] || 0) - elasticity(game, station, id));
    }
    st.stock[id] = (st.stock[id] || 0) + n * 0.5;
    return total;
}

export function buyFrom(game, station, id, n) {
    const st = marketState(game, station);
    let total = 0;
    for (let i = 0; i < n; i++) {
        const q = quote(game, station, id);
        total += q.buy;
        st.d[id] = Math.min(0.8, (st.d[id] || 0) + elasticity(game, station, id) * 0.8);
        st.stock[id] = (st.stock[id] || 0) - 1;
    }
    return total;
}

export function dataPrice(game, station) {
    const sp = game.galaxy.species[station.species];
    let p = 6;
    if (game.hasTech('cartog')) p *= 1.5;
    if (sp?.temperament === 'scholarly') p *= 1.25;
    return Math.round(p * 10) / 10;
}

export const isRaw = (id) => RAW.includes(id);
