// The eight corrupted cartridges found with the VESTA-8, and the last one.
//
// Each mission is a toy version of a game that made history. build() returns the cart as it was
// found: playable, but with parts lost. Each task is a pure check on the cart (and on what the
// player's playtests reached), with fix() as VESTA's "repair it for me". The tests apply every fix
// and have a bot play the result, so every cartridge is proved repairable and winnable.

import { V } from '../runtime/index.js';
import { makeCart, art, typeOf, litPixels, countTiles, hasFlag, hasHandler, code, usedSprites, paintedTiles, replaceTiles } from './carts.js';

const lvl = (rows, legend) => V.levelFromRows(rows, legend);
const setScript = (cart, type, src) => { typeOf(cart, type).script = src; };
const played = (ctx, k, n) => ({ done: (ctx.play.maxG[k] || 0) >= n, have: Math.min(n, Math.floor(ctx.play.maxG[k] || 0)), need: n });
const won = (ctx) => ({ done: (ctx.play.wins || 0) > 0 });
/** Set a type's control, and give any other type that wrongly took it back its control as found. */
function setControl(cart, build, name, control) {
    const found = build();
    for (const t of cart.types) {
        if (t.name === name) t.control = control;
        else if (t.control === control) t.control = (typeOf(found, t.name) || { control: 'none' }).control;
    }
}
/** A control task: done when the named type has it; if another type got it instead, say so. */
function controlOn(ctx, name, control) {
    const T = typeOf(ctx.cart, name);
    if (T && T.control === control) return { done: true };
    const wrong = ctx.cart.types.filter((t) => t.name !== name && t.control === control).map((t) => '"' + t.name + '"');
    return { done: false, note: wrong.length ? `That control is on ${wrong.join(' and ')} — it's "${name}" that needs it (set the other back to "No control").` : '' };
}

// ======================================================================
// 1. RALLY — after PONG (Atari, 1972)
// ======================================================================
const BALL = art(['........', '..33....', '.3333...', '.3333...', '..33....', '........', '........', '........']);
const M1 = {
    id: 'rally', n: 1, year: 1972, title: 'RALLY', after: 'PONG', maker: 'Atari · Allan Alcorn',
    color: '#2fb8b0',
    history: 'Atari\'s first hit was a training exercise: Nolan Bushnell asked new engineer Allan Alcorn to build a simple tennis game, inspired by the Magnavox Odyssey\'s. Alcorn split each paddle into segments so the ball leaves at a sharper angle the further from the middle it hits — the whole game in one idea. The test cabinet in Andy Capp\'s Tavern stopped working because its coin box was full.',
    teaches: 'The Sprite editor and the Object inspector',
    build() {
        return makeCart({
            title: 'RALLY', author: 'VESTA ARCHIVE', desc: 'Two paddles, one ball. First to 3.', bg: 0, label: 2,
            sprites: {
                1: ['33333332', '32222221', '32222221', '32222221', '32222221', '32222221', '32222221', '21111111'],
                2: ['..3333..', '..3223..', '..3223..', '..3223..', '..3223..', '..3223..', '..3223..', '..3333..'],
                3: ['........', '........', '........', '........', '........', '........', '........', '........'],
                4: ['........', '...22...', '...22...', '........', '........', '...22...', '...22...', '........'],
            },
            flags: { 1: ['solid'] },
            levels: [lvl([
                '                    ',
                '11111111111111111111',
                '          4         ',
                '          4         ',
                '          4         ',
                '          4         ',
                ' P        4       C ',
                '          4         ',
                '          4B        ',
                '          4         ',
                '          4         ',
                '          4         ',
                '          4         ',
                '          4         ',
                '11111111111111111111',
            ], { '1': 1, '4': 4, P: 'player', C: 'cpu', B: 'ball' })],
            types: [
                { name: 'player', spr: 2, sh: 3, control: 'none', speed: 2, edge: 'stop' },
                {
                    name: 'cpu', spr: 2, sh: 3, control: 'none', speed: 1.1, edge: 'stop', script: `
                    -- the console's player: chases the ball, a little slowly
                    on update
                      local b = first("ball")
                      if b then
                        if b.y > y + 12 then
                          vy = speed
                        elseif b.y < y + 4 then
                          vy = -speed
                        else
                          vy = 0
                        end
                      end
                    end`,
                },
                {
                    name: 'ball', spr: 3, bounce: 0, edge: 'none', script: `
                    on start
                      serve()
                    end

                    on update
                      if x < -8 then
                        rival += 1
                        sfx(2)
                        if rival >= 3 then lose() else serve() end
                      end
                      if x > 164 then
                        score += 1
                        sfx(1)
                        if score >= 3 then win() else serve() end
                      end
                    end

                    -- where the ball meets the paddle sets its angle
                    on hit player
                      vx = min(abs(vx) + 0.15, 3)
                      vy = clamp((y - other.y - 8) / 5, -2, 2)
                      sfx(0)
                    end

                    on hit cpu
                      vx = -min(abs(vx) + 0.15, 3)
                      vy = clamp((y - other.y - 8) / 5, -2, 2)
                      sfx(0)
                    end`,
                },
            ],
            script: `
            -- RALLY: after PONG (Atari, 1972)
            on start
              score = 0
              rival = 0
            end

            function serve()
              x = 78
              y = 60
              vx = choose(-1, 1) * 1.2
              vy = rnd(1.6) - 0.8
            end

            on draw
              text(score, 62, 1, 3)
              text(rival, 94, 1, 3)
            end`,
        });
    },
    tasks: [
        {
            id: 'ball', text: 'Redraw the lost ball: sprite 3 needs at least 4 lit pixels.',
            hint: 'Open SPRITES, pick slot 3 in the sheet and draw a small blob with the pencil.',
            tool: 'sprites',
            check: (c) => ({ done: litPixels(c.cart, 3) >= 4, have: Math.min(4, litPixels(c.cart, 3)), need: 4 }),
            fix: (cart) => { cart.sprites[3] = BALL; },
        },
        {
            id: 'bounce', text: 'Give the ball its bounce back: pick "ball" in OBJECTS and set its Bounce to 1.', obj: 'ball',
            hint: 'Open OBJECTS, choose "ball" and drag Bounce up to 1. A ball with no bounce just slides along the wall.',
            tool: 'objects',
            check: (c) => ({ done: (typeOf(c.cart, 'ball') || {}).bounce >= 0.95 }),
            fix: (cart) => { typeOf(cart, 'ball').bounce = 1; },
        },
        {
            id: 'paddle', text: 'Wire your paddle to the controller: pick "player" in OBJECTS and set its Control to "Player: paddle up & down".', obj: 'player',
            hint: 'Your paddle is the object called "player" (the ball and the cpu paddle are separate objects). Choose it in the list on the left, then set Control.',
            tool: 'objects',
            check: (c) => controlOn(c, 'player', 'paddle_v'),
            fix: (cart) => setControl(cart, () => M1.build(), 'player', 'paddle_v'),
        },
        {
            id: 'play', text: 'Playtest it and score a point past the console.', play: true,
            hint: 'Press PLAY. ↑ and ↓ move your paddle. Hit the ball near the end of your paddle to send it at a steep angle.',
            check: (c) => played(c, 'score', 1),
        },
    ],
};

// ======================================================================
// 2. BRICKBREAK — after BREAKOUT (Atari, 1976)
// ======================================================================
const brick = (k, h) => [h.repeat(7) + '.', h + k.repeat(6) + '.', h + k.repeat(6) + '.', h + k.repeat(6) + '.', h + k.repeat(6) + '.', h + k.repeat(6) + '.', k.repeat(7) + '.', '........'];
const M2_BUMP = `
on bump
  if tile >= 5 then
    settile(tx, ty, 0)
    score += 1
    sfx(1)
  end
end
`;
const M2 = {
    id: 'brick', n: 2, year: 1976, title: 'BRICKBREAK', after: 'BREAKOUT', maker: 'Atari · Bushnell & Bristow',
    color: '#ff8a2a',
    history: 'Breakout turned Pong into a game for one: knock a wall down, brick by brick. Atari\'s prototype board was famously built over four nights by Steve Wozniak, with Steve Jobs as go-between. A few years later Wozniak put a colour Breakout in BASIC on his own computer, the Apple II.',
    teaches: 'The Map editor and your first script',
    build() {
        return makeCart({
            title: 'BRICKBREAK', author: 'VESTA ARCHIVE', desc: 'Knock the wall down, brick by brick.', bg: 0, label: 5,
            sprites: {
                1: ['21111112', '12222221', '12222221', '12222221', '12222221', '12222221', '12222221', '21111112'],
                2: ['........', '........', '........', '33333333', '22222222', '11111111', '........', '........'],
                3: ['........', '........', '...33...', '..3333..', '..3333..', '...33...', '........', '........'],
                5: brick('4', '5'), 6: brick('5', '6'), 7: brick('6', '3'),
            },
            flags: { 1: ['solid'], 5: ['solid'], 6: ['solid'], 7: ['solid'] },
            hud: { score: true, lives: true },
            start: { lives: 3 },
            levels: [lvl([
                '                    ',
                '11111111111111111111',
                '1                  1',
                '1                  1',
                '1                  1',
                '1                  1',
                '1                  1',
                '1                  1',
                '1                  1',
                '1                  1',
                '1                  1',
                '1        B         1',
                '1                  1',
                '1        P         1',
                '1                  1',
            ], { '1': 1, B: 'ball', P: 'paddle' })],
            types: [
                { name: 'paddle', spr: 2, sw: 3, control: 'paddle_h', speed: 2.5, edge: 'stop' },
                {
                    name: 'ball', spr: 3, bounce: 1, edge: 'none', script: `
                    on start
                      serve()
                    end

                    function serve()
                      x = 76
                      y = 84
                      vx = choose(-1, 1) * 0.8
                      vy = -1.3
                    end

                    on update
                      if y > 124 then
                        lives -= 1
                        sfx(2)
                        if lives <= 0 then lose() else serve() end
                      end
                    end

                    on hit paddle
                      vy = -abs(vy)
                      vx = clamp((x - other.x - 8) / 6, -1.8, 1.8)
                      sfx(0)
                    end

                    -- !! CORRUPTED: the "on bump" handler that broke bricks was lost.
                    -- When the ball bumps a solid tile, "tile" is its sprite number
                    -- and tx, ty are its map cell.
                    `,
                },
            ],
            script: `
            -- BRICKBREAK: after BREAKOUT (Atari, 1976)
            on start
              score = 0
            end

            on update
              bricks = counttiles(5) + counttiles(6) + counttiles(7)
              if score > 0 and bricks == 0 then win() end
            end`,
        });
    },
    tasks: [
        {
            id: 'bricks', text: 'Lay the wall back: paint at least 24 bricks (sprites 5, 6 or 7) on the map.',
            hint: 'Open MAP, pick a brick from the tile strip and drag across rows 3 to 6. Leave room above the paddle!',
            tool: 'map',
            check: (c) => { const n = countTiles(c.cart, 0, [5, 6, 7]); return { done: n >= 24, have: Math.min(24, n), need: 24 }; },
            fix: (cart) => {
                const L = cart.levels[0];
                for (let y = 3; y <= 6; y++) for (let x = 2; x <= 17; x++) V.setTileLevel(L, x, y, y <= 3 ? 7 : y <= 4 ? 6 : 5);
            },
        },
        {
            id: 'bump', text: 'Rewrite the ball\'s lost "on bump" handler so a brick it hits disappears and scores.', obj: 'ball',
            hint: 'In OBJECTS → ball → SCRIPT, add:\non bump\n  if tile >= 5 then\n    settile(tx, ty, 0)\n    score += 1\n  end\nend',
            tool: 'code',
            check: (c) => {
                const s = (typeOf(c.cart, 'ball') || {}).script || '';
                return { done: hasHandler(s, 'bump') && /settile\s*\(/.test(code(s)) };
            },
            fix: (cart) => { const t = typeOf(cart, 'ball'); t.script = t.script.replace(/-- !! CORRUPTED[\s\S]*$/, '').trimEnd() + '\n' + M2_BUMP; },
        },
        {
            id: 'play', text: 'Playtest it and break 10 bricks.', play: true,
            hint: '← and → move the paddle. Where the ball lands on the paddle steers it.',
            check: (c) => played(c, 'score', 10),
        },
    ],
};


// ======================================================================
// 3. INVASION — after SPACE INVADERS (Taito, 1978)
// ======================================================================
const ALIEN_B = art(['.a....a.', 'a.a..a.a', 'aaaaaaaa', 'aa.aa.aa', 'aaaaaaaa', '..a..a..', '.a....a.', '........']);
const M3_FIRE = `
on press a
  if count("bullet") == 0 then
    spawn("bullet", x, y - 6)
    sfx(4)
  end
end
`;
const M3 = {
    id: 'invasion', n: 3, year: 1978, title: 'INVASION', after: 'SPACE INVADERS', maker: 'Taito · Tomohiro Nishikado',
    color: '#ff5fb4',
    history: 'Tomohiro Nishikado built the hardware and the game himself. The invaders speed up as you shoot them down for a reason he didn\'t plan: the board could only move so many sprites per frame, so with fewer left each one moved more often. He kept it. It is the first game where the enemies fight back, and the first with a saved high score.',
    teaches: 'Spawning, animation frames and loops',
    build() {
        return makeCart({
            title: 'INVASION', author: 'VESTA ARCHIVE', desc: 'They march. They speed up. Hold the line.', bg: 0, label: 2,
            sprites: {
                1: ['...77...', '...77...', '..7777..', '.777777.', '77777777', '77d77d77', '........', '........'],
                2: ['.a....a.', '..a..a..', '.aaaaaa.', 'aa.aa.aa', 'aaaaaaaa', '.a.aa.a.', 'a......a', '........'],
                3: ['........', '........', '........', '........', '........', '........', '........', '........'],
                4: ['........', '...3....', '...3....', '...3....', '...3....', '........', '........', '........'],
                5: ['...5....', '....5...', '...5....', '....5...', '...5....', '........', '........', '........'],
                6: ['77777777', '77777777', '7d7d7d7d', 'd7d7d7d7', '77777777', '7d7d7d7d', 'd7d7d7d7', '77777777'],
                7: ['dddddddd', '7777777', '........', '........', '........', '........', '........', '........'],
                8: ['........', '.....3..', '........', '........', '..3.....', '........', '.......e', '........'],
            },
            flags: { 6: ['solid'], 7: ['solid'] },
            hud: { score: true, lives: true },
            start: { lives: 3 },
            levels: [lvl([
                '                    ',
                '   8        8     8 ',
                '                    ',
                '   A A A A A A A A  ',
                '                    ',
                '   A A A A A A A A  ',
                '         8          ',
                '   A A A A A A A A  ',
                '                    ',
                ' 8               8  ',
                '                    ',
                '   66    66   66    ',
                '   66    66   66    ',
                '         S          ',
                '77777777777777777777',
            ], { '6': 6, '7': 7, '8': 8, A: 'alien', S: 'ship' })],
            types: [
                {
                    name: 'ship', spr: 1, control: 'paddle_h', speed: 1.5, edge: 'stop', script: `
                    -- !! CORRUPTED: the fire control was lost. Pressing A should
                    -- spawn a "bullet" just above the ship (one at a time).

                    on hit bomb
                      destroy(other)
                      if not blinking() then
                        lives -= 1
                        sfx(7)
                        shake(10)
                        blink(60)
                        if lives <= 0 then lose() end
                      end
                    end`,
                },
                {
                    name: 'alien', spr: 2, frames: [2, 3], anim: 30, walls: false, edge: 'none', script: `
                    on update
                      if chance(0.002) and count("bomb") < 3 then
                        spawn("bomb", x, y + 6)
                      end
                      if y > 84 then lose() end
                    end`,
                },
                {
                    name: 'bullet', spr: 4, edge: 'destroy', script: `
                    on start
                      vy = -3
                    end
                    on hit alien
                      destroy(other)
                      destroy()
                      score += 10
                      sfx(5)
                    end
                    on bump
                      settile(tx, ty, 0)
                      destroy()
                    end`,
                },
                {
                    name: 'bomb', spr: 5, edge: 'destroy', script: `
                    on start
                      vy = 1.2
                    end
                    on bump
                      if tile == 6 then settile(tx, ty, 0) end
                      destroy()
                    end`,
                },
            ],
            script: `
            -- INVASION: after SPACE INVADERS (Taito, 1978)
            on start
              score = 0
              dir = 1
              tick = 0
            end

            -- the fleet marches together, faster as it shrinks
            on update
              tick += 1
              if tick >= 4 + count("alien") then
                tick = 0
                local edge = false
                for a in all("alien") do
                  a.x += dir * 2
                  if a.x < 4 or a.x > 148 then edge = true end
                end
                if edge then
                  dir = -dir
                  for a in all("alien") do
                    a.y += 4
                  end
                end
              end
              if count("alien") == 0 then win() end
            end`,
        });
    },
    tasks: [
        {
            id: 'frame', text: 'The invaders\' second animation frame is blank: draw sprite 3 (at least 8 pixels).',
            hint: 'In SPRITES, copy sprite 2 (COPY), select slot 3, PASTE, then move the legs. The alien flips between 2 and 3.',
            tool: 'sprites',
            check: (c) => ({ done: litPixels(c.cart, 3) >= 8, have: Math.min(8, litPixels(c.cart, 3)), need: 8 }),
            fix: (cart) => { cart.sprites[3] = ALIEN_B; },
        },
        {
            id: 'fire', text: 'Arm the ship: in the "ship" script, pressing A must spawn a "bullet".', obj: 'ship',
            hint: 'OBJECTS → ship → SCRIPT:\non press a\n  if count("bullet") == 0 then\n    spawn("bullet", x, y - 6)\n  end\nend',
            tool: 'code',
            check: (c) => { const s = code((typeOf(c.cart, 'ship') || {}).script); return { done: /spawn\s*\(\s*["']bullet["']/.test(s) && !V.compile(s).error }; },
            fix: (cart) => { const t = typeOf(cart, 'ship'); t.script = t.script.replace(/-- !! CORRUPTED[^\n]*\n[^\n]*\n/, '') + M3_FIRE; },
        },
        {
            id: 'play', text: 'Playtest it and score 100 points.', play: true,
            hint: '← → to move, A (Z or Space) to fire. Your bunkers soak up bombs — and your own shots.',
            check: (c) => played(c, 'score', 100),
        },
    ],
};

// ======================================================================
// 4. MAZE MUNCH — after PAC-MAN (Namco, 1980)
// ======================================================================
const MAZE_HALF = [
    '          ',
    '##########',
    '#o.......#',
    '#.##.###.#',
    '#.........',
    '#.##.#.###',
    '#....#....',
    '####.###.#',
    '####.#...G',
    '####.#.###',
    '#.........',
    '#.##.###.#',
    '#o.#......',
    '#....#....',
    '##########',
];
const MAZE_ROWS = MAZE_HALF.map((r) => r + [...r].reverse().join(''));
MAZE_ROWS[12] = MAZE_ROWS[12].slice(0, 9) + 'P' + MAZE_ROWS[12].slice(10);
const MAZE_GLITCH = [[3, 2], [5, 8], [11, 16], [9, 11], [7, 1]];      // [row, col]
const M4 = {
    id: 'munch', n: 4, year: 1980, title: 'MAZE MUNCH', after: 'PAC-MAN', maker: 'Namco · Toru Iwatani',
    color: '#ffd23f',
    history: 'Toru Iwatani wanted a game about eating that anyone would enjoy, not only people who liked shooting. Each of its four ghosts aims at a different spot around the player, so together they seem to plan; players gave them names and personalities. It became the first video-game character to be a star in its own right.',
    teaches: 'Maze movement and AI that chases',
    build() {
        const rows = MAZE_ROWS.map((r) => r.split(''));
        for (const [y, x] of MAZE_GLITCH) rows[y][x] = 'X';
        return makeCart({
            title: 'MAZE MUNCH', author: 'VESTA ARCHIVE', desc: 'Eat every dot. Mind the ghosts.', bg: 0, label: 3,
            sprites: {
                1: ['88888888', '8111111e', '81....1e', '81....1e', '81....1e', '81....1e', '8111111e', 'eeeeeeee'],
                2: ['........', '........', '........', '...bb...', '...bb...', '........', '........', '........'],
                3: ['..6666..', '.666666.', '66666...', '6666....', '6666....', '66666...', '.666666.', '..6666..'],
                4: ['..6666..', '.666666.', '66666666', '66666666', '66666666', '66666666', '.666666.', '..6666..'],
                5: ['..4444..', '.444444.', '4334334.', '4314314.', '44444444', '44444444', '44444444', '4.44.44.'],
                6: ['..eeee..', '.eeeeee.', 'e33e33e.', 'e31e31e.', 'eeeeeeee', 'eeeeeeee', 'eeeeeeee', 'e.ee.ee.'],
                7: ['..aaaa..', '.aaaaaa.', 'a33a33a.', 'a31a31a.', 'aaaaaaaa', 'aaaaaaaa', 'aaaaaaaa', 'a.aa.aa.'],
                8: ['9.e.4.a.', '.3.f.6.e', 'e.9.1.3.', '.4.a.e.9', '3.6.9.f.', '.e.3.4.1', 'a.1.e.9.', '.9.4.3.e'],
                9: ['........', '..bbbb..', '.bbbbbb.', '.bbbbbb.', '.bbbbbb.', '.bbbbbb.', '..bbbb..', '........'],
                10: ['..8888..', '.888888.', '8338338.', '8818818.', '88888888', '83838388', '88888888', '8.88.88.'],
            },
            flags: { 1: ['solid'] },
            hud: { score: true, lives: true },
            start: { lives: 3 },
            levels: [lvl(MAZE_ROWS.map((r, y) => (y === 12 ? r : r)).map((r, y) => rows[y].join('')), {
                '#': 1, '.': 2, o: 9, X: 8, P: [0, 'munch'], G: [0, 'ghost'],
            })],
            types: [
                {
                    name: 'munch', spr: 3, frames: [3, 4], anim: 5, animMove: true, control: 'move4', speed: 1, edge: 'stop', hitbox: 'full', script: `
                    on enter
                      if tile == 2 then
                        settile(tx, ty, 0)
                        score += 1
                        sfx(0)
                      elseif tile == 9 then
                        settile(tx, ty, 0)
                        score += 5
                        power = 360
                        sfx(6)
                      end
                    end

                    on hit ghost
                      if power > 0 then
                        home(other)
                        score += 20
                        sfx(5)
                      elseif not blinking() then
                        lives -= 1
                        sfx(7)
                        shake(15)
                        if lives <= 0 then
                          lose()
                        else
                          home()
                          blink(90)
                          for g in all("ghost") do home(g) end
                        end
                      end
                    end`,
                },
                {
                    name: 'ghost', spr: 5, control: 'none', speed: 0.9, edge: 'stop', autoflip: false, hitbox: 'full', script: `
                    on start
                      me.look = 5 + rndi(0, 2)
                    end

                    -- a power dot turns every ghost blue and slow
                    on update
                      if power > 0 then
                        spr = 10
                        speed = 0.5
                      else
                        spr = me.look
                        speed = 0.9
                      end
                    end`,
                },
            ],
            script: `
            -- MAZE MUNCH: after PAC-MAN (Namco, 1980)
            on start
              score = 0
              power = 0
            end

            on update
              if power > 0 then power -= 1 end
              if counttiles(2) + counttiles(9) == 0 then win() end
            end`,
        });
    },
    tasks: [
        {
            id: 'patch', text: 'Patch the maze: replace every glitched tile (sprite 8) with a wall.',
            hint: 'In MAP, pick the wall (sprite 1) and paint over the noisy tiles. There are five.',
            tool: 'map',
            // every glitched cell must be a wall again (painting them empty doesn't close the maze)
            check: (c) => { const L = c.cart.levels[0]; const n = MAZE_GLITCH.filter(([y, x]) => L && hasFlag(c.cart, V.tileAtLevel(L, x, y), 'solid')).length; return { done: n === MAZE_GLITCH.length, have: n, need: MAZE_GLITCH.length }; },
            fix: (cart) => replaceTiles(cart, 0, 8, 1),
        },
        {
            id: 'maze', text: 'Munch slides about loose: pick "munch" in OBJECTS and set its Control to "Player: maze runner".', obj: 'munch',
            hint: 'OBJECTS → munch → Control. A maze runner keeps going and turns at the next gap, like the arcade.',
            tool: 'objects',
            check: (c) => controlOn(c, 'munch', 'maze'),
            fix: (cart) => setControl(cart, () => M4.build(), 'munch', 'maze'),
        },
        {
            id: 'chase', text: 'The ghosts have no brains: pick "ghost" in OBJECTS and set its Control to "AI: chase the player through a maze".', obj: 'ghost',
            hint: 'OBJECTS → ghost → Control.',
            tool: 'objects',
            check: (c) => controlOn(c, 'ghost', 'chase'),
            fix: (cart) => setControl(cart, () => M4.build(), 'ghost', 'chase'),
        },
        {
            id: 'play', text: 'Playtest it and eat 50 dots.', play: true,
            hint: 'Arrow keys steer; you can turn early, before the corner. Big dots make the ghosts edible.',
            check: (c) => played(c, 'score', 50),
        },
    ],
};

// ======================================================================
// 5. ROAD HOP — after FROGGER (Konami, 1981)
// ======================================================================
const CAR = art(['........', '..4444..', '.443344.', '44444444', '44444444', '.1....1.', '........', '........']);
const M5 = {
    id: 'hop', n: 5, year: 1981, title: 'ROAD HOP', after: 'FROGGER', maker: 'Konami',
    color: '#5fd35a',
    history: 'A frog, a highway and a river. Frogger is a game of reading patterns: every lane moves at its own speed, and the only way across the water is to ride the logs. It has no enemy that hunts you at all — just traffic, timing, and the urge to get home.',
    teaches: 'Tile flags, hazards and screen wrapping',
    build() {
        const rows = [
            '                    ',
            '999H99999H99999H9999',
            '44444444444444444444',
            '44444444444444444444',
            '44444444444444444444',
            '44444444444444444444',
            '22222222222222222222',
            '33333333333333333333',
            '55555555555555555555',
            '33333333333333333333',
            '55555555555555555555',
            '33333333333333333333',
            '22222222222222222222',
            '22222222222222222222',
            '22222222222222222222',
        ];
        const L = lvl(rows, { '9': 9, H: 6, '4': 4, '2': 2, '3': 3, '5': 5 });
        const put = (t, cx, cy) => L.objs.push({ t, x: cx * 8, y: cy * 8 });
        for (const [y, xs] of [[2, [1, 11]], [3, [4, 13]], [4, [0, 8, 15]], [5, [6, 16]]]) for (const x of xs) put('log', x, y);
        for (const [y, xs] of [[7, [2, 10, 16]], [9, [0, 7, 13]], [11, [5, 12, 18]]]) for (const x of xs) put('car', x, y);
        for (const [y, xs] of [[8, [3, 14]], [10, [1, 9]]]) for (const x of xs) put('truck', x, y);
        put('frog', 10, 13);
        return makeCart({
            title: 'ROAD HOP', author: 'VESTA ARCHIVE', desc: 'Cross the road, ride the logs, get three frogs home.', bg: 0, label: 11,
            sprites: {
                2: ['d7d7d7d7', '7d7d7d7d', 'dddddddd', 'd7ddd7dd', 'dddddddd', 'dd7ddd7d', 'dddddddd', 'd7ddd7dd'],
                3: ['11111111', '11111111', '1f111111', '11111111', '11111f11', '11111111', '11111111', '11111111'],
                4: ['88888888', '8e888888', 'e8e88888', '88888e88', '8888e8e8', '88888888', '88e88888', '8e8e8888'],
                5: ['11111111', '11111111', '11111111', '33331111', '11111111', '11111111', '11111111', '11111111'],
                6: ['88888888', '8.7777.8', '.777777.', '77777777', '777777d.', '.7777d78', '8.dd7788', '88888888'],
                7: ['88888888', '8.7777.8', '.766667.', '76366367', '766666d.', '.7666d78', '8.dd7788', '88888888'],
                8: ['........', '........', '........', '........', '........', '........', '........', '........'],
                9: ['.d.dd.d.', 'dd7ddd7d', 'd7dddd7d', 'ddd7dddd', 'dd7dd7dd', 'd7dddd7d', 'dddd7ddd', 'dddddddd'],
                10: ['........', 'ffffffff', 'f3f3f3f3', 'ffffffff', 'ffffffff', 'ffffffff', '.1....1.', '........'],
                11: ['.7....7.', '737..737', '.777777.', '..7777..', '.777777.', '7.7777.7', '7......7', '........'],
                12: ['........', 'cccccccc', 'cbcccccc', 'cccccbcc', 'cccccccc', 'cbcccccc', 'cccccccc', '........'],
            },
            flags: { 9: ['solid'], 7: ['solid'] },
            hud: { score: true, lives: true },
            start: { lives: 4 },
            levels: [L],
            types: [
                {
                    name: 'frog', spr: 11, control: 'grid', speed: 1, edge: 'stop', autoflip: false, script: `
                    on hit car
                      squash()
                    end
                    on hit truck
                      squash()
                    end

                    -- ride a log
                    on hit log
                      x += other.vx
                    end

                    on hazard
                      if not touching("log") then squash() end
                    end

                    on enter
                      if tile == 6 then
                        settile(tx, ty, 7)
                        score += 50
                        homes += 1
                        sfx(6)
                        if homes >= 3 then win() else home() end
                      end
                    end`,
                },
                {
                    name: 'log', spr: 12, sw: 3, walls: false, edge: 'destroy', hitbox: 'full', script: `
                    on start
                      local lane = cell(y)
                      if lane == 2 then
                        vx = 0.5
                      elseif lane == 3 then
                        vx = -0.7
                      elseif lane == 4 then
                        vx = 0.6
                      else
                        vx = -0.45
                      end
                    end`,
                },
                {
                    name: 'car', spr: 8, walls: false, edge: 'wrap', script: `
                    on start
                      local lane = cell(y)
                      if lane == 7 then
                        vx = -0.9
                      elseif lane == 9 then
                        vx = 0.7
                      else
                        vx = -1.2
                      end
                      flipx = vx < 0
                    end`,
                },
                {
                    name: 'truck', spr: 10, sw: 2, walls: false, edge: 'wrap', script: `
                    on start
                      if cell(y) == 8 then vx = 0.5 else vx = -0.6 end
                    end`,
                },
            ],
            script: `
            -- ROAD HOP: after FROGGER (Konami, 1981)
            on start
              score = 0
              homes = 0
            end

            function squash()
              if blinking() then return end
              lives -= 1
              sfx(7)
              shake(8)
              if lives <= 0 then
                lose()
              else
                home()
                blink(60)
              end
            end`,
        });
    },
    tasks: [
        {
            id: 'car', text: 'The cars are invisible: draw sprite 8 (at least 10 pixels).',
            hint: 'SPRITES → slot 8. A box with wheels will do. Cars driving left are flipped for you.',
            tool: 'sprites',
            check: (c) => ({ done: litPixels(c.cart, 8) >= 10, have: Math.min(10, litPixels(c.cart, 8)), need: 10 }),
            fix: (cart) => { cart.sprites[8] = CAR; },
        },
        {
            id: 'river', text: 'The frog can swim, which is wrong: flag the water (sprite 4) as HAZARD.',
            hint: 'SPRITES → slot 4 → tick HAZARD under the canvas. The frog\'s "on hazard" handler does the rest.',
            tool: 'sprites',
            check: (c) => ({ done: hasFlag(c.cart, 4, 'hazard') }),
            fix: (cart) => { cart.flags[4] |= V.FLAG.hazard; },
        },
        {
            id: 'wrap', text: 'The logs drift away for ever: pick "log" in OBJECTS and set its Edge to "wraps to the other side".', obj: 'log',
            hint: 'OBJECTS → log → Edge.',
            tool: 'objects',
            check: (c) => ({ done: (typeOf(c.cart, 'log') || {}).edge === 'wrap' }),
            fix: (cart) => { typeOf(cart, 'log').edge = 'wrap'; },
        },
        {
            id: 'play', text: 'Playtest it and get a frog home.', play: true,
            hint: 'Each press hops one tile. Wait for a gap, ride a log, hop into a lily pad at the top.',
            check: (c) => played(c, 'homes', 1),
        },
    ],
};

// ======================================================================
// 6. GIRDER CLIMB — after DONKEY KONG (Nintendo, 1981)
// ======================================================================
function girderLevel() {
    const g = Array.from({ length: 15 }, () => Array(20).fill(' '));
    for (let y = 1; y < 15; y++) { g[y][0] = '1'; g[y][19] = '1'; }
    for (const [y, x0, x1] of [[2, 1, 16], [5, 3, 18], [8, 1, 16], [11, 3, 18]]) for (let x = x0; x <= x1; x++) g[y][x] = '2';
    for (let x = 1; x <= 18; x++) g[14][x] = '5';
    for (const [x, top, bot] of [[7, 2, 5], [13, 5, 8], [5, 8, 11], [15, 11, 14]]) {
        g[top][x] = '4';
        for (let y = top + 1; y < bot; y++) g[y][x] = '3';
    }
    g[13][1] = '6';
    g[1][2] = 'K'; g[1][10] = 'C'; g[13][17] = 'H';
    return lvl(g.map((r) => r.join('')), { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, K: 'kong', C: 'captive', H: 'hero' });
}
const M6 = {
    id: 'girder', n: 6, year: 1981, title: 'GIRDER CLIMB', after: 'DONKEY KONG', maker: 'Nintendo · Shigeru Miyamoto',
    color: '#e8394d',
    history: 'Shigeru Miyamoto\'s first game told a story with no words: a giant ape, a captive at the top, and a little carpenter called Jumpman climbing the girders under a hail of barrels. It was one of the first games where jumping was the point. Jumpman got a new name a year later: Mario.',
    teaches: 'Gravity, jumping and ladders',
    build() {
        return makeCart({
            title: 'GIRDER CLIMB', author: 'VESTA ARCHIVE', desc: 'Climb. Jump the barrels. Reach the top.', bg: 0, label: 9,
            sprites: {
                1: ['f1ff1ff1', 'ffffffff', 'f1ff1ff1', 'ffffffff', 'f1ff1ff1', 'ffffffff', 'f1ff1ff1', 'ffffffff'],
                2: ['44444444', '4.44.44.', '44444444', '........', '........', '........', '........', '........'],
                3: ['.e....e.', '.eeeeee.', '.e....e.', '.e....e.', '.eeeeee.', '.e....e.', '.e....e.', '.eeeeee.'],
                4: ['44444444', '4e44.4e.', '4eeeeee4', '.e....e.', '.eeeeee.', '.e....e.', '.e....e.', '.eeeeee.'],
                5: ['44444444', '4.44.44.', '44444444', '44444444', '4.44.44.', '44444444', '........', '........'],
                6: ['.888888.', '83333338', '.888888.', '.8e88e8.', '.888888.', '.8e88e8.', '.888888.', '.555555.'],
                7: ['........', '..cccc..', '.cbccbc.', '.cccccc.', '.cccccc.', '.cbccbc.', '..cccc..', '........'],
                8: ['........', '..cccc..', '.ccbbcc.', '.cccccc.', '.cccccc.', '.ccbbcc.', '..cccc..', '........'],
                9: ['..444...', '.44444..', '..bbb...', '..b1b...', '.4444...', 'b.88.b..', '..88....', '.c..c...'],
                10: ['..444...', '.44444..', '..bbb...', '..b1b...', '.4444...', '..88b...', '.8..8...', 'c....c..'],
                11: ['..aaaa..', '.a6666a.', '..bbbb..', '..b1b1..', '...bb...', '.aaaaaa.', '.aaaaaa.', '..b..b..'],
                12: ['.cccccc.', 'cbbccbbc', 'cb1cc1bc', 'cccccccc', 'cbbbbbbc', 'cb4444bc', 'cccccccc', 'cc.cc.cc'],
            },
            flags: { 1: ['solid'], 2: ['oneway'], 3: [], 4: ['oneway', 'ladder'], 5: ['solid'] },
            hud: { score: true, lives: true },
            start: { lives: 3 },
            levels: [girderLevel()],
            types: [
                {
                    name: 'hero', spr: 9, frames: [9, 10], anim: 6, animMove: true, control: 'none', speed: 1, jump: 2.6, gravity: 0.2, edge: 'stop', script: `
                    on hit barrel
                      if not blinking() then
                        lives -= 1
                        sfx(7)
                        shake(12)
                        if lives <= 0 then
                          lose()
                        else
                          home()
                          blink(90)
                        end
                      end
                    end

                    on hit captive
                      score += 500
                      win()
                    end

                    -- 100 points for every barrel you jump
                    on update
                      for b in all("barrel") do
                        if b.scored == 0 and abs(b.x - x) < 5 and b.y > y + 4 and b.y - y < 16 then
                          b.scored = 1
                          score += 100
                          sfx(1)
                        end
                      end
                    end`,
                },
                {
                    name: 'barrel', spr: 7, frames: [7, 8], anim: 8, control: 'patrol', speed: 1, gravity: 0, edge: 'destroy', script: `
                    -- into the oil drum at the bottom
                    on update
                      if y > 100 and x < 16 then destroy() end
                    end`,
                },
                {
                    name: 'kong', spr: 12, walls: false, script: `
                    on start
                      me.wait = 40
                    end

                    -- throw a barrel every two or three seconds
                    on update
                      me.wait -= 1
                      if me.wait <= 0 then
                        spawn("barrel", x + 10, y)
                        sfx(3)
                        me.wait = rndi(110, 190)
                      end
                    end`,
                },
                { name: 'captive', spr: 11, walls: false },
            ],
            script: `
            -- GIRDER CLIMB: after DONKEY KONG (Nintendo, 1981)
            on start
              score = 0
            end`,
        });
    },
    tasks: [
        {
            id: 'ladder', text: 'The ladders can\'t be climbed: flag sprite 3 as LADDER.',
            hint: 'SPRITES → slot 3 → tick LADDER. Sprite 4, the girder with a ladder through it, already is one.',
            tool: 'sprites',
            check: (c) => ({ done: hasFlag(c.cart, 3, 'ladder') }),
            fix: (cart) => { cart.flags[3] |= V.FLAG.ladder; },
        },
        {
            id: 'hero', text: 'Give the hero legs: pick "hero" in OBJECTS and set its Control to "Player: run & jump".', obj: 'hero',
            hint: 'OBJECTS → hero → Control. Jump is how high it leaps; Gravity pulls it down.',
            tool: 'objects',
            check: (c) => controlOn(c, 'hero', 'platform'),
            fix: (cart) => setControl(cart, () => M6.build(), 'hero', 'platform'),
        },
        {
            id: 'gravity', text: 'The barrels float: pick "barrel" in OBJECTS and give it some Gravity (0.15 is right).', obj: 'barrel',
            hint: 'OBJECTS → barrel → Gravity. Without it they never fall through the gaps.',
            tool: 'objects',
            check: (c) => ({ done: ((typeOf(c.cart, 'barrel') || {}).gravity || 0) > 0.05 }),
            fix: (cart) => { typeOf(cart, 'barrel').gravity = 0.15; },
        },
        {
            id: 'play', text: 'Playtest it and reach the top.', play: true,
            hint: '← → run, A or ↑ jumps, ↑ ↓ on a ladder climbs. Jump barrels for points.',
            check: (c) => won(c),
        },
    ],
};

// ======================================================================
// 7. SCROLL RUN — after SUPER MARIO BROS. (Nintendo, 1985)
// ======================================================================
const GLITCH = ['9.e.4.a.', '.3.f.6.e', 'e.9.1.3.', '.4.a.e.9', '3.6.9.f.', '.e.3.4.1', 'a.1.e.9.', '.9.4.3.e'];
const COIN = art(['........', '..6666..', '.66b666.', '.6b6666.', '.6b6666.', '.666666.', '..6666..', '........']);
function runLevel() {
    const W = 100, H = 15;
    const g = Array.from({ length: H }, () => Array(W).fill(' '));
    const gaps = new Set([22, 23, 41, 42, 43, 62, 63]);
    for (let x = 0; x < W; x++) if (!gaps.has(x)) { g[13][x] = '1'; g[14][x] = '2'; }
    for (let x = 74; x <= 81; x++) { g[13][x] = 'X'; g[14][x] = ' '; }
    const pipe = (x, h) => {
        for (let y = 13 - h; y < 13; y++) { g[y][x] = y === 13 - h ? 'p' : 'b'; g[y][x + 1] = y === 13 - h ? 'q' : 'd'; }
    };
    pipe(14, 2); pipe(30, 3); pipe(50, 2); pipe(68, 3);
    const row = (y, x, str) => { for (let i = 0; i < str.length; i++) if (str[i] !== ' ') g[y][x + i] = str[i]; };
    row(9, 8, '3?3?3'); row(9, 34, '3??3'); row(5, 36, '?'); row(9, 56, '?3?');
    for (let i = 0; i < 5; i++) for (let y = 12 - i; y <= 12; y++) g[y][84 + i] = '2';
    for (const [x, y] of [[4, 3], [19, 2], [33, 4], [47, 2], [60, 3], [77, 2], [90, 4]]) g[y][x] = 'c';
    for (const [x] of [[6], [26], [46], [58], [73], [93]]) g[12][x] = 'h';
    g[8][92] = 'f';
    for (let y = 9; y <= 12; y++) g[y][96] = 'k';
    g[12][95] = 'k'; g[12][97] = 'k'; g[11][96] = 'k';
    const L = lvl(g.map((r) => r.join('')), {
        '1': 1, '2': 2, '3': 3, '?': 6, X: 16, p: 9, q: 10, b: 11, d: 12, c: 13, h: 14, f: 24, k: 25,
    });
    const put = (t, cx, cy) => L.objs.push({ t, x: cx * 8, y: cy * 8 });
    put('runner', 2, 12);
    for (const x of [19, 27, 38, 47, 55, 58, 72]) put('walker', x, 12);
    for (const [x, y] of [[22, 10], [23, 10], [41, 9], [42, 8], [43, 9], [62, 10], [63, 10], [35, 7], [36, 7], [8, 7], [12, 7], [57, 7], [86, 6], [87, 5]]) put('coin', x, y);
    put('flag', 92, 9);
    return L;
}
const M7 = {
    id: 'run', n: 7, year: 1985, title: 'SCROLL RUN', after: 'SUPER MARIO BROS.', maker: 'Nintendo · Miyamoto & Tezuka',
    color: '#63c6ff',
    history: 'The world was bigger than the television. Super Mario Bros. scrolled smoothly to the right through a whole kingdom, with secrets in blocks and pipes, and a jump you could steer in the air. Its first level teaches everything without a word: the first enemy walks straight at you, so you learn to jump.',
    teaches: 'Big maps and a camera that follows',
    build() {
        return makeCart({
            title: 'SCROLL RUN', author: 'VESTA ARCHIVE', desc: 'Run right. Stomp, jump, reach the flag.', bg: 14, label: 17,
            sprites: {
                1: ['77777777', '7d77d77d', 'cccccccc', 'c5ccc5cc', 'cccccccc', 'cc5ccc5c', 'cccccccc', '5ccc5ccc'],
                2: ['cccccccc', 'c5ccc5cc', 'cccccccc', 'cc5ccc5c', 'cccccccc', 'c5ccc5cc', 'cccccccc', 'cc5ccc5c'],
                3: ['55555555', '5ccc5ccc', '5ccc5ccc', 'cccccccc', '555c5555', 'cc5ccc5c', 'cc5ccc5c', 'cccccccc'],
                6: ['66666665', '6bbbbbb5', '6b6556b5', '6bbb56b5', '6bb56bb5', '6bbbbbb5', '6bb56bb5', '55555555'],
                7: ['cccccccc', 'c555555c', 'c5cccc5c', 'c5cccc5c', 'c5cccc5c', 'c5cccc5c', 'c555555c', 'cccccccc'],
                9: ['dddddddd', 'd7777777', 'd7377777', 'd7377777', 'dddddddd', '.d737777', '.d737777', '.d737777'],
                10: ['dddddddd', '7777777d', '777777dd', '777777dd', 'dddddddd', '77777dd.', '77777dd.', '77777dd.'],
                11: ['.d737777', '.d737777', '.d737777', '.d737777', '.d737777', '.d737777', '.d737777', '.d737777'],
                12: ['77777dd.', '77777dd.', '77777dd.', '77777dd.', '77777dd.', '77777dd.', '77777dd.', '77777dd.'],
                13: ['........', '...33...', '.333333.', '33333333', '3333333f', '.333f3f.', '........', '........'],
                14: ['........', '........', '...77...', '..7777..', '.77d777.', '7777d777', '777777d7', '7d777777'],
                16: GLITCH,
                17: ['..444...', '.444444.', '.bb1b...', '.bbbbb..', '.44884..', 'b4888.4.', '..8..8..', '.cc..cc.'],
                18: ['..444...', '.444444.', '.bb1b...', '.bbbbb..', '.448844.', '..888b..', '.8...8..', 'cc....c.'],
                19: ['..cccc..', '.cccccc.', 'c3c1c3cc', 'cccccccc', '.cbbbbc.', '..bbbb..', '.cc..cc.', '........'],
                20: ['..cccc..', '.cccccc.', 'c3c1c3cc', 'cccccccc', '.cbbbbc.', '..bbbb..', 'cc....cc', '........'],
                21: ['........', '........', '........', '........', '........', '........', '........', '........'],
                22: ['........', '...66...', '...6b...', '...66...', '...66...', '...66...', '...66...', '........'],
                23: ['...33...', '...33...', '...33...', '...33...', '...33...', '...33...', '...33...', '...33...'],
                24: ['...37777', '...37777', '...37777', '...37...', '...3....', '...3....', '...3....', '...3....'],
                25: ['ffffffff', 'f1fff1ff', 'ffffffff', 'fff1fff1', 'ffffffff', 'f1fff1ff', 'ffffffff', 'ff1fff1f'],
            },
            flags: { 1: ['solid'], 2: ['solid'], 3: ['solid'], 6: ['solid'], 7: ['solid'], 9: ['solid'], 10: ['solid'], 11: ['solid'], 12: ['solid'], 25: ['solid'] },
            hud: { score: true, lives: true },
            start: { lives: 3 },
            camera: { follow: '' },
            levels: [runLevel()],
            types: [
                {
                    name: 'runner', spr: 17, frames: [17, 18], anim: 5, animMove: true, control: 'platform', speed: 1.2, jump: 3.4, gravity: 0.18, edge: 'stop', script: `
                    on hit walker
                      if vy > 0 and y < other.y - 2 then
                        destroy(other)
                        vy = -2.5
                        score += 100
                        sfx(5)
                      else
                        ouch()
                      end
                    end

                    on hit coin
                      destroy(other)
                      score += 10
                      sfx(1)
                    end

                    on hit flag
                      score += 1000
                      win()
                    end

                    -- head-butt a ? block from below
                    on bump
                      if tile == 6 and ty < cell(y + 4) then
                        settile(tx, ty, 7)
                        score += 10
                        sfx(1)
                      end
                    end

                    on update
                      if y > 108 then ouch() end
                    end`,
                },
                { name: 'walker', spr: 19, frames: [19, 20], anim: 10, control: 'patrol', speed: 0.4, gravity: 0.2, edge: 'destroy', autoflip: false },
                { name: 'coin', spr: 21, frames: [21, 22], anim: 12, walls: false, edge: 'none' },
                { name: 'flag', spr: 23, sh: 4, walls: false, edge: 'none' },
            ],
            script: `
            -- SCROLL RUN: after SUPER MARIO BROS. (Nintendo, 1985)
            on start
              score = 0
            end

            function ouch()
              if blinking() then return end
              lives -= 1
              sfx(7)
              shake(10)
              if lives <= 0 then
                lose()
              else
                home()
                blink(90)
              end
            end`,
        });
    },
    tasks: [
        {
            id: 'camera', text: 'The camera is stuck on the first screen: make it follow the runner.',
            hint: 'Open CART and set "Camera follows" to runner.',
            tool: 'cart',
            check: (c) => ({ done: c.cart.camera.follow === 'runner' }),
            fix: (cart) => { cart.camera.follow = 'runner'; },
        },
        {
            id: 'bridge', text: 'Repair the broken ground near the end: no glitched tiles (sprite 16) may remain.',
            hint: 'MAP → scroll right with two fingers or the arrows → paint ground (sprite 1) over the noisy tiles.',
            tool: 'map',
            // the eight cells of the broken bridge must be solid ground again
            check: (c) => { const L = c.cart.levels[0]; let n = 0; for (let x = 74; x <= 81; x++) if (L && hasFlag(c.cart, V.tileAtLevel(L, x, 13), 'solid')) n++; return { done: n === 8, have: n, need: 8 }; },
            fix: (cart) => replaceTiles(cart, 0, 16, 1),
        },
        {
            id: 'coin', text: 'The coins are invisible: draw sprite 21 (at least 10 pixels).',
            hint: 'SPRITES → slot 21. Sprite 22 is the coin seen edge-on; the two frames make it spin.',
            tool: 'sprites',
            check: (c) => ({ done: litPixels(c.cart, 21) >= 10, have: Math.min(10, litPixels(c.cart, 21)), need: 10 }),
            fix: (cart) => { cart.sprites[21] = COIN; },
        },
        {
            id: 'play', text: 'Playtest it and reach the flag.', play: true,
            hint: 'Hold A (or ↑) for a higher jump. Land on walkers to stomp them; touch one from the side and it hurts.',
            check: (c) => won(c),
        },
    ],
};

// ======================================================================
// 8. DUNGEON KEY — after THE LEGEND OF ZELDA (Nintendo, 1986)
// ======================================================================
const SWORD = art(['........', '........', '.c......', 'cc3333.3', '.c33333f', '.c......', '........', '........']);
const M8_ATTACK = `
on press a
  if count("sword") == 0 then
    spawn("sword", x + fx * 7, y + fy * 7)
    sfx(4)
  end
end
`;
function room(build) {
    const g = Array.from({ length: 15 }, () => Array(20).fill('2'));
    for (let x = 0; x < 20; x++) { g[0][x] = ' '; g[1][x] = '1'; g[14][x] = '1'; }
    for (let y = 1; y < 15; y++) { g[y][0] = '1'; g[y][19] = '1'; }
    build(g);
    return g.map((r) => r.join(''));
}
const ROOM1 = room((g) => {
    for (let y = 2; y <= 5; y++) g[y][15] = '1';
    for (let x = 15; x <= 18; x++) g[5][x] = '1';
    g[3][15] = '3';
    for (const [x, y] of [[5, 5], [5, 9], [10, 7], [12, 11], [8, 3]]) g[y][x] = '6';
    g[11][3] = 'K'; g[12][9] = 'H'; g[4][6] = 'B'; g[9][13] = 'B';
});
const ROOM2 = room((g) => {
    for (let y = 2; y <= 6; y++) { g[y][7] = '1'; g[y][12] = '1'; }
    for (let x = 7; x <= 12; x++) g[6][x] = '1';
    g[6][9] = '3';
    g[3][9] = 'R'; g[12][9] = 'H'; g[4][3] = 'B'; g[4][16] = 'B'; g[9][9] = 'B'; g[10][4] = 'B';
    g[12][2] = 'L'; g[12][17] = 'K';
    for (const [x, y] of [[4, 8], [15, 8], [6, 11], [13, 11]]) g[y][x] = '6';
});
const M8 = {
    id: 'dungeon', n: 8, year: 1986, title: 'DUNGEON KEY', after: 'THE LEGEND OF ZELDA', maker: 'Nintendo · Miyamoto & Tezuka',
    color: '#7a3fb0',
    history: 'Miyamoto wanted it to feel like exploring the countryside he roamed as a child. You start with nothing, in a world that doesn\'t tell you where to go. Its cartridge had a battery inside so your adventure was still there tomorrow — one of the first console games you could save.',
    teaches: 'Rooms, keys, doors and a sword',
    build() {
        const legend = { '1': 1, '2': 2, '3': 3, '6': 6, K: [2, 'key'], H: [2, 'hero'], B: [2, 'blob'], R: [2, 'relic'], L: [2, 'heart'] };
        return makeCart({
            title: 'DUNGEON KEY', author: 'VESTA ARCHIVE', desc: 'Find the key, open the door, claim the relic.', bg: 1, label: 17,
            sprites: {
                1: ['ffffffff', 'f11f111f', 'ffffffff', '1f11f11f', 'ffffffff', 'f11f111f', 'ffffffff', '1f11f11f'],
                2: ['11111111', '1111111.', '11111111', '1111.111', '11111111', '1.111111', '11111111', '111111.1'],
                3: ['cccccccc', 'c5cccc5c', 'cccccccc', 'ccc66ccc', 'ccc11ccc', 'cccc1ccc', 'c5cccc5c', 'cccccccc'],
                4: ['ffffffff', 'f1111111', 'ff1fffff', 'ff1f1111', 'ff1ff1ff', 'ff1ff1f1', 'ff1ff1f1', 'ff1ff1f1'],
                6: ['.ffffff.', 'f333333f', 'f3ffff3f', 'f3f11f3f', 'f3f11f3f', 'f3ffff3f', 'f333333f', '.ffffff.'],
                9: ['..777...', '.77777..', '.7bbb...', '.b1b1...', '.bbbb...', '77d777..', '.7777b..', '.c..c...'],
                10: ['..777...', '.77777..', '.7bbb...', '.b1b1...', '.bbbb...', '77d777..', 'b7777...', 'c....c..'],
                11: ['........', '........', '........', '........', '........', '........', '........', '........'],
                12: ['...3....', '..333...', '..333...', '..333...', '..333...', '.ccccc..', '...c....', '...c....'],
                13: ['........', '........', '..aaaa..', '.aaaaaa.', 'aa3aa3aa', 'aa1aa1aa', 'aaaaaaaa', '.a.aa.a.'],
                14: ['........', '...aa...', '.aaaaaa.', 'aaaaaaaa', 'aa3aa3aa', 'aa1aa1aa', 'aaaaaaaa', 'a.a..a.a'],
                15: ['........', '..666...', '.6...6..', '.6...6..', '..666...', '...6....', '...66...', '...6.6..'],
                16: ['........', '.44.44..', '4444444.', '4444444.', '.44444..', '..444...', '...4....', '........'],
                17: ['...6....', '...6....', '..666...', '6666666.', '.66b66..', '..666...', '.66.66..', '6.....6.'],
                18: ['...b....', '...6....', '..6b6...', 'b6666b6.', '.66666..', '..6b6...', '.66.66..', 'b.....b.'],
            },
            flags: { 1: ['solid'], 3: ['solid'], 6: ['solid'] },
            hud: { score: true, lives: true },
            start: { lives: 3 },
            levels: [lvl(ROOM1, legend), lvl(ROOM2, legend)],
            types: [
                {
                    name: 'hero', spr: 9, frames: [9, 10], anim: 8, animMove: true, control: 'move4', speed: 1, edge: 'stop', script: `
                    -- !! CORRUPTED: the attack was lost. Pressing A should spawn
                    -- a "sword" one step ahead, the way the hero faces (fx, fy).

                    on hit blob
                      if not blinking() then
                        lives -= 1
                        sfx(7)
                        blink(60)
                        shake(6)
                        move(sign(x - other.x) * 8, sign(y - other.y) * 8)
                        if lives <= 0 then lose() end
                      end
                    end

                    on hit key
                      destroy(other)
                      keys += 1
                      sfx(1)
                      say("You got a KEY!", 70)
                    end

                    on hit heart
                      destroy(other)
                      lives = min(lives + 1, 5)
                      sfx(6)
                    end

                    on hit relic
                      score += 1000
                      win()
                    end

                    -- walk into a locked door with a key to open it
                    on bump
                      if tile == 3 and keys > 0 then
                        settile(tx, ty, 2)
                        keys -= 1
                        sfx(6)
                      end
                    end

                    -- stairs lead down to the next room
                    on enter
                      if tile == 4 then
                        sfx(3)
                        nextlevel()
                      end
                    end`,
                },
                {
                    name: 'sword', spr: 11, walls: false, edge: 'none', autoflip: false, script: `
                    on start
                      if fy ~= 0 then spr = 12 end
                      flipx = fx < 0
                      flipy = fy < 0
                    end

                    on update
                      if timer > 10 then destroy() end
                    end

                    on hit blob
                      if not blinking(other) then
                        hurt(1, other)
                        blink(20, other)
                        score += 10
                        sfx(5)
                      end
                    end`,
                },
                { name: 'blob', spr: 13, frames: [13, 14], anim: 12, control: 'wander', speed: 0.5, hp: 2, edge: 'stop' },
                { name: 'key', spr: 15, walls: false },
                { name: 'heart', spr: 16, walls: false },
                { name: 'relic', spr: 17, frames: [17, 18], anim: 20, walls: false },
            ],
            script: `
            -- DUNGEON KEY: after THE LEGEND OF ZELDA (Nintendo, 1986)
            on start
              score = 0
              keys = 0
              say("Find the key. Open the door.", 120)
            end

            on draw
              if keys > 0 then text("KEY", 70, 1, 6) end
            end`,
        });
    },
    tasks: [
        {
            id: 'sword', text: 'Forge the sword: draw sprite 11, a blade pointing right (at least 5 pixels).',
            hint: 'SPRITES → slot 11. Sprite 12 is the same sword pointing up; the game turns it for left and down.',
            tool: 'sprites',
            check: (c) => ({ done: litPixels(c.cart, 11) >= 5, have: Math.min(5, litPixels(c.cart, 11)), need: 5 }),
            fix: (cart) => { cart.sprites[11] = SWORD; },
        },
        {
            id: 'attack', text: 'Teach the hero to attack: in the "hero" script, pressing A spawns a "sword" ahead of it.', obj: 'hero',
            hint: 'OBJECTS → hero → SCRIPT:\non press a\n  if count("sword") == 0 then\n    spawn("sword", x + fx * 7, y + fy * 7)\n  end\nend',
            tool: 'code',
            check: (c) => { const s = code((typeOf(c.cart, 'hero') || {}).script); return { done: /spawn\s*\(\s*["']sword["']/.test(s) && !V.compile(s).error }; },
            fix: (cart) => { const t = typeOf(cart, 'hero'); t.script = t.script.replace(/-- !! CORRUPTED[^\n]*\n[^\n]*\n/, '') + M8_ATTACK; },
        },
        {
            id: 'stairs', text: 'The way down is gone: paint the stairs (sprite 4) in room 1, behind the locked door.',
            hint: 'MAP → level 1 → sprite 4 → paint it in the little room top-right.',
            tool: 'map',
            check: (c) => ({ done: countTiles(c.cart, 0, 4) >= 1 }),
            fix: (cart) => { V.setTileLevel(cart.levels[0], 17, 3, 4); },
        },
        {
            id: 'play', text: 'Playtest it and claim the relic in room 2.', play: true,
            hint: 'Arrows walk, A swings. Blobs take two hits. Keys open doors: walk into one.',
            check: (c) => won(c),
        },
    ],
};

// ======================================================================
// 9. THE LAST CARTRIDGE — yours
// ======================================================================
function lastObjects(cart) {
    cart.types = [
        { ...V.defaultType('ship'), spr: 1, control: 'paddle_h', speed: 2 },
        { ...V.defaultType('star'), spr: 2, walls: false, edge: 'none' },
    ];
    cart.levels[0].objs = [{ t: 'ship', x: 76, y: 104 }];
}
const M9 = {
    id: 'last', n: 9, year: 0, title: 'THE LAST CARTRIDGE', after: 'YOUR OWN GAME', maker: 'You',
    color: '#ffffff',
    history: 'The ninth cartridge was never finished. Its label is blank except for two words in pencil: MY GAME. Every game in the archive started like this — an empty sheet and somebody who wanted to make something.',
    teaches: 'Everything',
    final: true,
    build() {
        const c = makeCart({
            title: 'UNTITLED', author: '', desc: '', bg: 0, label: 1,
            sprites: {}, levels: [V.blankLevel()],
            hud: { score: true, lives: false },
            script: '-- THE LAST CARTRIDGE: your game.\n-- Ideas: on start, on update, on draw.\n',
        });
        return c;
    },
    tasks: [
        {
            id: 'name', text: 'Give your game a name.',
            hint: 'CART → Title.',
            tool: 'cart',
            check: (c) => ({ done: !!c.cart.title.trim() && c.cart.title.trim().toUpperCase() !== 'UNTITLED' }),
            fix: (cart) => { cart.title = 'STARFALL'; cart.desc = 'Catch every falling star.'; },
        },
        {
            id: 'sprites', text: 'Draw at least three sprites.',
            hint: 'Anything: a hero, a wall, a thing to collect.',
            tool: 'sprites',
            check: (c) => { const n = usedSprites(c.cart); return { done: n >= 3, have: Math.min(3, n), need: 3 }; },
            fix: (cart) => {
                cart.sprites[1] = art(['.e....e.', 'eeeeeeee', 'e3eeee3e', 'eeeeeeee', '.eeeeee.', '..e..e..', '.e....e.', '........']);
                cart.sprites[2] = art(['...6....', '...6....', '..666...', '6666666.', '.66666..', '..666...', '.66.66..', '6.....6.']);
                cart.sprites[3] = art(['98989898', '89898989', '99999999', '........', '........', '........', '........', '........']);
                cart.flags[3] = V.FLAG.solid;
            },
        },
        {
            id: 'level', text: 'Build a level: paint at least 20 tiles.',
            hint: 'MAP: pick a sprite as a tile and paint. Tick SOLID on a sprite to make it a wall.',
            tool: 'map',
            check: (c) => { const n = paintedTiles(c.cart); return { done: n >= 20, have: Math.min(20, n), need: 20 }; },
            fix: (cart) => { const L = cart.levels[0]; for (let x = 0; x < 20; x++) V.setTileLevel(L, x, 14, 3); },
        },
        {
            id: 'objects', text: 'Make at least two kinds of object, one of them steered by the player.',
            hint: 'OBJECTS → NEW, then give one a Player control. Place them with the MAP\'s object brush.',
            tool: 'objects',
            check: (c) => ({ done: c.cart.types.length >= 2 && c.cart.types.some((t) => V.isPlayerControl(t.control)) }),
            fix: (cart) => lastObjects(cart),
        },
        {
            id: 'script', text: 'Write a script with at least one "on" handler.',
            hint: 'Give an object a script, or use the GAME script. "on start", "on update" and "on hit" are good first ones.',
            tool: 'code',
            check: (c) => ({ done: [c.cart.script, ...c.cart.types.map((t) => t.script)].some((s) => { const p = V.compile(s); return !p.error && Object.keys(p.handlers).some((k) => k !== 'init'); }) }),
            fix: (cart) => {
                cart.script = 'on start\n  score = 0\n  missed = 0\nend\n\non update\n  if chance(0.015) then spawn("star", rndi(4, 148), -8) end\n  if score >= 12 then win() end\n  if missed >= 8 then lose() end\nend\n';
                if (!cart.types.find((t) => t.name === 'star') || !cart.types.find((t) => t.name === 'ship')) lastObjects(cart);
                const star = cart.types.find((t) => t.name === 'star');
                star.script = 'on start\n  vy = 0.5 + rnd(0.4)\nend\n\non update\n  if y > 120 then\n    missed += 1\n    destroy()\n  end\nend\n';
                const ship = cart.types.find((t) => t.name === 'ship');
                ship.script = 'on hit star\n  destroy(other)\n  score += 1\n  sfx(1)\nend\n';
            },
        },
        {
            id: 'play', text: 'Playtest your game and win it.', play: true,
            hint: 'Your game needs a way to win: call win() when the player has done it.',
            check: (c) => won(c),
        },
    ],
};

export const MISSIONS = [M1, M2, M3, M4, M5, M6, M7, M8, M9];
export const missionById = (id) => MISSIONS.find((m) => m.id === id);

/** Every task's state for a mission. ctx = { cart, play: { maxG, wins } }. */
export function taskStates(m, cart, play) {
    const ctx = { cart: V.normalize(cart), play: { maxG: {}, wins: 0, ...(play || {}) } };
    return m.tasks.map((t) => {
        let r;
        try { r = t.check(ctx); } catch { r = { done: false }; }
        if (typeof r === 'boolean') r = { done: r };
        return { id: t.id, ...r };
    });
}
/** VESTA's repair: apply every fix (or one). */
export function repair(m, cart, taskId) {
    const c = JSON.parse(JSON.stringify(cart));
    for (const t of m.tasks) if (t.fix && (!taskId || t.id === taskId)) t.fix(c);
    return V.normalize(c);
}
export { usedSprites, paintedTiles, replaceTiles };
