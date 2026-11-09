// One bot year with a progress log: node game-125/dev/year.mjs [seed] [skill]
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Ge = await import('../js/sim/genetics.js');
const C = await import('../js/config.js');
const seed = +(process.argv[2] || 7919), skill = +(process.argv[3] || 1);
const G = Gm.newGame(seed), B = Bt.makeBot({ skill });
let ticks = 0, lastLog = -1, lastM = 0;
const t0 = Date.now();
while (!G.over && ticks < 2e7) {
    const inp = Bt.botTick(G, B); if (inp) Gm.step(G, inp, C.STEP); ticks++;
    for (const e of G.events) if (['researched', 'fabricated', 'colony', 'final', 'echo'].includes(e.type)) console.log(`  d${G.day.toFixed(0)} ${e.type} ${e.id || e.gen || e.zone || e.idx || ''}`);
    if (G.stats.missions !== lastM && G.report) { lastM = G.stats.missions; const r = G.report; if (process.env.V) console.log(`  d${G.day.toFixed(0)} drop z${r.zone} ${r.how} ${JSON.stringify(r.brought)} kills ${r.kills} ${r.days}d`); }
    G.events.length = 0;
    if (Math.floor(G.day / 30) !== lastLog) { lastLog = Math.floor(G.day / 30); console.log(`day ${G.day.toFixed(0)} gen ${G.bot.gen} eden ${Ge.edenIndex(G).toFixed(1)} res ${JSON.stringify(Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, Math.round(v)])))} drops ${G.stats.missions} deaths ${G.stats.deaths} strains ${G.stats.releases} zones ${G.zones.map((z) => Math.round(Ge.terraOf(z))).join('/')}`); }
}
console.log(G.ending, `${((Date.now() - t0) / 1000).toFixed(1)}s ${ticks} ticks`);
