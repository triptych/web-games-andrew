/**
 * Monsters, projectiles and the things lying on the dungeon floor.
 *
 * Movement is real-time but still on the grid: a monster picks a cell,
 * then slides into it over a fixed step time, exactly like the player.
 * Nothing is ever between cells as far as the rules are concerned, only
 * as far as the renderer is concerned.
 */

import * as S from './engine/sprites.js';
import { mulberry32 } from './engine/textures.js';

export const BESTIARY = [
    {
        id: 'bat', name: 'cave bat', bmp: S.BAT,
        hp: 7, atk: 3, def: 0, xp: 4, step: 0.34, attackEvery: 1.0,
        height: 0.4, yOffset: 0.45, aggro: 7, minDepth: 1, maxDepth: 5, weight: 3,
        erratic: 0.35
    },
    {
        id: 'skeleton', name: 'skeleton', bmp: S.SKELETON,
        hp: 14, atk: 5, def: 1, xp: 9, step: 0.52, attackEvery: 1.2,
        height: 0.82, yOffset: 0, aggro: 8, minDepth: 1, maxDepth: 7, weight: 4
    },
    {
        id: 'ghoul', name: 'ghoul', bmp: S.GHOUL,
        hp: 22, atk: 7, def: 2, xp: 15, step: 0.46, attackEvery: 1.1,
        height: 0.86, yOffset: 0, aggro: 8, minDepth: 2, maxDepth: 9, weight: 4
    },
    {
        id: 'wraith', name: 'wraith', bmp: S.WRAITH,
        hp: 26, atk: 10, def: 3, xp: 26, step: 0.40, attackEvery: 1.0,
        height: 0.9, yOffset: 0.18, aggro: 10, minDepth: 4, maxDepth: 12, weight: 3,
        drainsMana: true
    },
    {
        id: 'gargoyle', name: 'gargoyle', bmp: S.GARGOYLE,
        hp: 40, atk: 12, def: 6, xp: 40, step: 0.60, attackEvery: 1.4,
        height: 0.88, yOffset: 0, aggro: 7, minDepth: 5, maxDepth: 14, weight: 3
    },
    {
        id: 'demon', name: 'pit demon', bmp: S.DEMON,
        hp: 56, atk: 16, def: 7, xp: 65, step: 0.44, attackEvery: 1.0,
        height: 0.95, yOffset: 0, aggro: 10, minDepth: 7, maxDepth: 99, weight: 3
    },
    {
        id: 'lich', name: 'grimhold lich', bmp: S.LICH,
        hp: 220, atk: 22, def: 9, xp: 500, step: 0.52, attackEvery: 0.9,
        height: 1.05, yOffset: 0.02, aggro: 99, minDepth: 99, maxDepth: 99, weight: 0,
        boss: true, drainsMana: true,
        ranged: { range: 9, every: 2.2, damage: 14 }
    }
];

const BY_ID = new Map(BESTIARY.map(d => [d.id, d]));
export const monsterDef = id => BY_ID.get(id);

/** Sprites for the things that lie on the floor. */
export const ITEM_SPRITES = {
    key: { bmp: S.KEY, height: 0.26, yOffset: 0.12 },
    hoard: { bmp: S.CHEST, height: 0.4, yOffset: 0 },
    gold: { bmp: S.GOLD, height: 0.26, yOffset: 0 },
    potion: { bmp: S.POTION, height: 0.32, yOffset: 0 },
    mana: { bmp: S.POTION, height: 0.32, yOffset: 0 },
    scroll: { bmp: S.SCROLL, height: 0.26, yOffset: 0 }
};

export class Monster {
    constructor(spec, x, y) {
        // `spec` is the bestiary entry; naming it `def` would collide with
        // the defence stat inside it.
        this.spec = spec;
        this.id = spec.id;
        this.name = spec.name;
        this.cellX = x;
        this.cellY = y;
        this.x = x + 0.5;
        this.y = y + 0.5;
        this.hp = spec.hp;
        this.hpMax = spec.hp;
        this.moveTimer = Math.random() * spec.step;
        this.attackTimer = 0;
        this.anim = null;
        this.phase = Math.random() * 6;
        this.hurtFlash = 0;
        this.awake = false;
        this.frames = [spec.bmp, S.lurchFrame(spec.bmp)];
    }

    get alive() { return this.hp > 0; }

    get bmp() {
        // a slow two-frame shuffle, which is all a 1991 crawler ever had
        return this.frames[(this.phase | 0) % 2];
    }

    hit(amount) {
        this.hp -= amount;
        this.hurtFlash = 0.18;
        this.awake = true;
        return this.hp <= 0;
    }

    /**
     * @param {number} dt
     * @param {object} ctx { level, player, monsters, attack(monster), blocked(x,y) }
     */
    update(dt, ctx) {
        this.phase += dt * 3;
        if (this.hurtFlash > 0) this.hurtFlash -= dt;
        if (this.attackTimer > 0) this.attackTimer -= dt;

        if (this.anim) {
            this.anim.t += dt;
            const p = Math.min(1, this.anim.t / this.anim.dur);
            this.x = this.anim.fromX + (this.anim.toX - this.anim.fromX) * p;
            this.y = this.anim.fromY + (this.anim.toY - this.anim.fromY) * p;
            if (p >= 1) this.anim = null;
            return;
        }

        const px = ctx.player.cellX, py = ctx.player.cellY;
        const dx = px - this.cellX, dy = py - this.cellY;
        const dist = Math.abs(dx) + Math.abs(dy);

        if (!this.awake) {
            if (dist <= this.spec.aggro) this.awake = true;
            else return;
        }

        if (dist === 1) {
            if (this.attackTimer <= 0) {
                this.attackTimer = this.spec.attackEvery;
                ctx.attack(this);
            }
            return;
        }

        // A caster with a clear line down a row or column throws instead of
        // closing, which is what makes the lich fight about cover.
        const r = this.spec.ranged;
        if (r && this.attackTimer <= 0 && dist <= r.range && (dx === 0 || dy === 0)) {
            const sx = Math.sign(dx), sy = Math.sign(dy);
            let clear = true;
            for (let i = 1; i < dist; i++) {
                if (!ctx.level.walkable(this.cellX + sx * i, this.cellY + sy * i)) { clear = false; break; }
            }
            if (clear) {
                this.attackTimer = r.every;
                ctx.rangedAttack(this, sx, sy, r.damage);
                return;
            }
        }

        this.moveTimer -= dt;
        if (this.moveTimer > 0) return;
        this.moveTimer = this.spec.step;

        // greedy chase: try the dominant axis, then the other, then a
        // random shuffle so a monster in a corner does not lock up
        const options = [];
        if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx) options.push([Math.sign(dx), 0]);
            if (dy) options.push([0, Math.sign(dy)]);
        } else {
            if (dy) options.push([0, Math.sign(dy)]);
            if (dx) options.push([Math.sign(dx), 0]);
        }
        if (this.spec.erratic && Math.random() < this.spec.erratic) options.length = 0;
        options.push([1, 0], [-1, 0], [0, 1], [0, -1]);

        for (const [sx, sy] of options) {
            const nx = this.cellX + sx, ny = this.cellY + sy;
            if (!ctx.level.walkable(nx, ny)) continue;
            if (ctx.blocked(nx, ny)) continue;
            this.anim = {
                t: 0, dur: this.spec.step * 0.9,
                fromX: this.x, fromY: this.y, toX: nx + 0.5, toY: ny + 0.5
            };
            this.cellX = nx;
            this.cellY = ny;
            return;
        }
    }
}

/** The fireball: travels in a straight line, cell by cell, fast. */
export class Projectile {
    constructor(x, y, dx, dy, damage, owner = 'player', bmp = S.FIREBALL) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.speed = 7.5;
        this.damage = damage;
        this.owner = owner;
        this.life = 1.6;
        this.dead = false;
        this.bmp = bmp;
    }

    update(dt, ctx) {
        this.life -= dt;
        if (this.life <= 0) { this.dead = true; return; }
        const steps = Math.max(1, Math.ceil(this.speed * dt / 0.2));
        const sub = dt / steps;
        for (let i = 0; i < steps && !this.dead; i++) {
            this.x += this.dx * this.speed * sub;
            this.y += this.dy * this.speed * sub;
            const cx = Math.floor(this.x), cy = Math.floor(this.y);
            if (!ctx.level.walkable(cx, cy)) { this.dead = true; ctx.onWall(this); return; }
            const target = ctx.targetAt(this.x, this.y, this.owner);
            if (target) { this.dead = true; ctx.onHit(this, target); return; }
        }
    }
}

/**
 * Fill a fresh level with monsters and loot. Density and the depth bands
 * of the bestiary do the difficulty curve; there is no separate scaling
 * multiplier, so a floor is exactly as dangerous as what spawned on it.
 */
export function populateLevel(level, depth, seed, finalDepth) {
    const rng = mulberry32(seed ^ 0x5f3759df);
    const monsters = [];
    const occupied = new Set();
    const key = (x, y) => y * level.width + x;
    occupied.add(key(level.entry.x, level.entry.y));

    const spots = [];
    for (const room of level.rooms) {
        for (let y = room.y; y < room.y + room.h; y++)
            for (let x = room.x; x < room.x + room.w; x++)
                if (level.at(x, y) === 1) spots.push({ x, y });
    }
    for (let i = spots.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [spots[i], spots[j]] = [spots[j], spots[i]];
    }

    const pool = BESTIARY.filter(d => d.weight > 0 && depth >= d.minDepth && depth <= d.maxDepth);
    const totalWeight = pool.reduce((a, d) => a + d.weight, 0);
    const count = Math.min(spots.length - 4, 4 + Math.floor(depth * 1.6));

    for (let i = 0; i < count; i++) {
        const spot = spots.pop();
        if (!spot) break;
        if (occupied.has(key(spot.x, spot.y))) continue;
        // keep the entry stairs a safe place to arrive
        if (Math.abs(spot.x - level.entry.x) + Math.abs(spot.y - level.entry.y) < 4) continue;
        let roll = rng() * totalWeight, pick = pool[0];
        for (const d of pool) { roll -= d.weight; if (roll <= 0) { pick = d; break; } }
        occupied.add(key(spot.x, spot.y));
        monsters.push(new Monster(pick, spot.x, spot.y));
    }

    if (depth === finalDepth) {
        const room = level.stairsRoom || level.rooms[level.rooms.length - 1];
        const bx = (room.x + room.w / 2) | 0, by = (room.y + room.h / 2) | 0;
        const boss = new Monster(monsterDef('lich'), bx, by);
        boss.awake = false;
        monsters.push(boss);
        level.boss = boss;
    }

    // loot
    const lootCount = 2 + ((rng() * 3) | 0);
    for (let i = 0; i < lootCount; i++) {
        const spot = spots.pop();
        if (!spot) break;
        const r = rng();
        const kind = r < 0.36 ? 'gold' : r < 0.62 ? 'potion' : r < 0.82 ? 'mana' : 'scroll';
        level.items.push({ kind, x: spot.x, y: spot.y });
    }

    return monsters;
}

/** Wall torches and floor debris — pure decoration, but they sell the place. */
export function decorate(level, seed) {
    const rng = mulberry32(seed ^ 0x9e3779b9);
    const props = [];
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (let y = 1; y < level.height - 1; y++) {
        for (let x = 1; x < level.width - 1; x++) {
            if (!level.walkable(x, y)) continue;
            if (rng() > 0.07) continue;
            for (const [dx, dy] of dirs) {
                if (level.at(x + dx, y + dy) !== 0) continue;   // must be plain rock
                props.push({
                    kind: 'torch', bmp: S.TORCH,
                    x: x + 0.5 + dx * 0.42, y: y + 0.5 + dy * 0.42,
                    height: 0.34, yOffset: 0.62, fullBright: true, flicker: rng() * 6
                });
                break;
            }
        }
    }
    for (let i = 0; i < 6; i++) {
        const room = level.rooms[(rng() * level.rooms.length) | 0];
        if (!room) break;
        const x = room.x + ((rng() * room.w) | 0), y = room.y + ((rng() * room.h) | 0);
        if (level.at(x, y) !== 1) continue;
        props.push({
            kind: 'bones', bmp: S.BONES, x: x + 0.5, y: y + 0.5,
            height: 0.16, yOffset: 0, shadeBoost: 0.5
        });
    }
    return props;
}
