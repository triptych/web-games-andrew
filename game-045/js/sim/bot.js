/**
 * bot.js — a simple autopilot. It plays the attract-mode demo behind the
 * title screen, and dev/simtest.mjs uses it to play whole games headlessly.
 *
 * It flips when a descending ball enters the zone above a flipper, holds for
 * a moment, and pulls the plunger for a random time. Deterministic given the
 * world's RNG state, so it never touches Math.random either.
 */

import { FLIPPER } from '../config.js';

export function makeBot(skill = 1) {
    return { hold: [0, 0], cool: [0, 0], pull: -1, pullFor: 0, skill };
}

export function botInput(bot, w, dt) {
    const input = { left: false, right: false, launch: false, nudge: false };

    w.flippers.forEach((f, s) => {
        if (bot.hold[s] > 0) {
            bot.hold[s] -= dt;
            input[s === 0 ? 'left' : 'right'] = true;
            if (bot.hold[s] <= 0) bot.cool[s] = 0.14;   // let the flipper drop before re-flipping
            return;
        }
        if (bot.cool[s] > 0) { bot.cool[s] -= dt; return; }
        for (const b of w.balls) {
            if (b.held || b.inLane || b.vy > 2) continue;
            // Only this flipper's half of the table.
            if (f.side < 0 ? b.x > 0.4 : b.x < -0.4) continue;
            if (b.y > FLIPPER.pivotY + 2.6 || b.y < 1.2) continue;
            const reach = Math.hypot(b.x - (f.px + f.tipX) / 2, b.y - (f.py + f.tipY) / 2);
            // A little randomness in timing = varied shot angles.
            if (reach < 1.25 + w.rng.range(-0.25, 0.35) * bot.skill) {
                bot.hold[s] = 0.16 + w.rng.range(0, 0.1);
                input[s === 0 ? 'left' : 'right'] = true;
                break;
            }
        }
    });

    const held = w.balls.some((b) => b.held);
    if (held && w.autoLaunch < 0) {
        if (bot.pull < 0) {
            bot.pull = 0;
            bot.pullFor = w.rng.range(0.25, 1.0);
        }
        bot.pull += dt;
        input.launch = bot.pull < bot.pullFor;
        if (!input.launch) bot.pull = -1;
    }
    return input;
}
