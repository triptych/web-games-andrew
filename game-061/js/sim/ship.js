// Ship stats derived from hull class, component Mks and research.

import { HULLS, COMPONENTS } from '../config.js';

export function newShip(designSeed) {
    return {
        hull: 1,
        comps: { engine: 1, thrusters: 1, shield: 1, armor: 1, cargo: 1, mining: 1, weapon: 1, scanner: 1, warp: 0, tank: 1, scoop: 0 },
        design: designSeed >>> 0,
        paint: 0,
        name: 'Wren',
        hp: 100,
        fuel: 2,
    };
}

export function shipStats(ship, techs = []) {
    const has = (t) => techs.includes(t);
    const H = HULLS[ship.hull];
    const c = (id) => COMPONENTS[id].stats[ship.comps[id]] || {};
    const ion = has('ion') ? 1.1 : 1;
    const eng = c('engine'), sh = c('shield'), mine = c('mining'), w = c('weapon'), sc = c('scanner');
    return {
        hullName: H.name,
        scale: H.scale,
        speed: eng.speed * ion * (1 - (ship.hull - 1) * 0.02),
        accel: eng.accel * ion,
        turn: c('thrusters').turn * ion * (1 - (ship.hull - 1) * 0.04),
        shield: sh.shield * (has('harmonics') ? 1.25 : 1),
        regen: sh.regen * (has('harmonics') ? 1.35 : 1),
        hullMax: Math.round(H.hull * c('armor').hullMul),
        cargo: H.cargo + c('cargo').cargo,
        mineRate: mine.rate * (has('deepcore') ? 1.2 : 1),
        mineHard: mine.hard,
        mineRange: mine.range,
        dmg: w.dmg,
        fireRate: w.rate,
        twin: !!w.twin,
        plasma: !!w.plasma,
        scanRange: sc.range,
        scanSpeed: sc.speed,
        scanComp: ship.comps.scanner >= 2,
        scanHidden: ship.comps.scanner >= 3,
        warpRange: COMPONENTS.warp.stats[ship.comps.warp].range,
        fuelMax: c('tank').fuel,
        scoopFuel: ship.comps.scoop >= 1,
        scoopGas: ship.comps.scoop >= 2,
        energyMax: 100,
        boostMul: 1.9,
        radius: 7 * H.scale,
    };
}

export const jumpCost = (ly, techs = []) => Math.max(1, Math.ceil((ly / 4) * (techs.includes('folding') ? 0.75 : 1)));
