// An auto-player. It plays through the same input the player uses, so the tests, the balance
// table and an attract-mode demo all exercise the real rules. Pure, like the rest of js/sim.

export function makeBot({ skill = 1 } = {}) {
    return { skill, target: null };
}

export function botInput(G, bot) {
    const p = G.player;
    // commit to a target until it is gone, or the bot dithers between two across a boundary
    if (!bot.target || !G.pickups.includes(bot.target)) {
        let best = null, bd = Infinity;
        for (const c of G.pickups) {
            const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
            if (d < bd) { bd = d; best = c; }
        }
        bot.target = best;
    }
    const t = bot.target;
    if (!t) return { x: 0, y: 0, a: false };
    const dx = t.x - p.x, dy = t.y - p.y, l = Math.hypot(dx, dy) || 1;
    return { x: (dx / l) * bot.skill, y: (dy / l) * bot.skill, a: false };
}
