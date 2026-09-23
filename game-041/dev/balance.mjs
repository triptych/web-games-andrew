/**
 * balance.mjs — two scripted bots with an invincible miner, measuring the tower
 * defence on its own (no pumping, no gems, no rocks):
 *   blasters   never digs; builds blasters on the busiest cells it can afford
 *   mixed+dig  builds a mix, upgrades, and wanders — digging shortcuts by accident
 * The gap between them is the point of the game: careless digging feeds the monsters.
 *
 *   node dev/balance.mjs
 */
import { Game } from '../js/game.js';
import { COLS, ROWS, TOWERS } from '../js/config.js';
for (const mode of ['blasters', 'mixed+dig']) for (const seed of [1,2,3]) {
  const g = new Game(seed); g.newGame();
  let i = 0;
  while (g.phase !== 'gameover' && i < 60*60*25) {
    i++;
    g.player.inv = 1e9; // measure tower defence alone
    if (i % 30 === 0 && g.phase === 'play') {
      const w = g.world; const type = mode === 'blasters' ? 'blaster' : ['blaster','frost','arc','boomer'][g.towers.length % 4];
      if (g.gold >= TOWERS[type].cost) {
        // best cell = most adjacent tunnel cells within 2
        let best=null, bs=-1;
        for (let r=1;r<ROWS;r++) for (let c=0;c<COLS;c++) { if (!g.canBuild(c,r,null)) continue; let s=0;
          for (let dr=-2;dr<=2;dr++) for (let dc=-2;dc<=2;dc++) if (dr*dr+dc*dc<=4 && w.isTunnel(c+dc,r+dr) && r+dr>0) s++;
          if (s>bs){bs=s;best=[c,r];} }
        if (best) g.build(best[0], best[1], type);
      } else if (mode !== 'blasters') { const t = g.towers.find(t => t.lvl < 2); if (t && g.gold > 60) g.upgrade(t); }
    }
    // mixed+dig: wander to eat dots in dead-end fashion (just move down/left/right on a schedule)
    const dir = mode === 'blasters' ? -1 : [1,0,0,2,2,2,1,0,0,3][Math.floor(i/40)%10];
    g.update(1/60, { dir, pump: false, pumpPressed: false });
  }
  console.log(mode, 'seed', seed, 'round', g.round, 'wave', g.wave, 'core', g.coreHp, 'score', g.score, 'towers', g.towers.length, 'kills', g.stats.kills, 'leaks', g.stats.leaks, 'min', (i/3600).toFixed(1));
}
