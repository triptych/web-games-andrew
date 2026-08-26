/**
 * Grimhold Abyss — entry point and game loop.
 */

import { Framebuffer } from './engine/framebuffer.js';
import { Renderer } from './engine/renderer.js';
import * as P from './engine/palette.js';
import { drawTextCentered } from './engine/font.js';
import * as S from './engine/sprites.js';
import {
    generateLevel, DOOR, DOOR_OPEN, STAIRS, LOCKED, SECRET, STAIRS_UP
} from './dungeon.js';
import { buildTheme, createWorldView } from './themes.js';
import { Player, DIR_VECTORS } from './player.js';
import { Input } from './input.js';
import {
    populateLevel, decorate, ITEM_SPRITES, Projectile, Monster, monsterDef
} from './entities.js';
import { hasSave, readSave, writeSave, clearSave } from './save.js';
import * as HUD from './hud.js';
import { Sound } from './audio.js';

const MAX_MESSAGES = 32;
export const FINAL_DEPTH = 10;

const FIREBALL_COST = 4;
const AUTOSAVE_EVERY = 20;

/** Pack slots, in the order the number keys address them. */
const SLOTS = [
    { kind: 'potion', label: 'healing draught', color: P.LTRED },
    { kind: 'mana', label: 'flask of cold fire', color: P.LTBLUE },
    { kind: 'scroll', label: 'scroll of true seeing', color: P.LTCYAN }
];

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.fb = new Framebuffer(HUD.SCREEN_W, HUD.SCREEN_H);
        this.renderer = new Renderer(this.fb, HUD.VIEW);
        this.input = new Input();
        this.messages = [];
        this.state = 'title';
        this.time = 0;
        // ?seed=12345 makes a run reproducible — handy for bug reports and
        // for sharing a dungeon someone liked.
        const urlSeed = parseInt(new URLSearchParams(location.search).get('seed'), 10);
        this.seed = Number.isFinite(urlSeed) ? urlSeed : (Math.random() * 0x7fffffff) | 0;
        this.stats = {
            hp: 40, hpMax: 40, mana: 20, manaMax: 20,
            level: 1, xp: 0, xpNext: 20, gold: 0, keys: 0,
            atk: 5, def: 1, kills: 0,
            pack: { potion: 1, mana: 0, scroll: 0 }
        };
        this.saveTimer = AUTOSAVE_EVERY;
        this.canContinue = hasSave();
        this.projectiles = [];
        this.flash = null;
        this.shake = 0;
        this.hurtTimer = 0;
        this.sound = new Sound();
        this.castTimer = 0;
        this.depth = 0;
        this.levels = new Map();     // depth -> Level, so floors persist
        this.themes = new Map();
        this.deepest = 1;
        this.nav = { walkable: (x, y) => this.level.walkable(x, y) && !this.monsterAt(x, y) };
        this.enterLevel(1, 'down');
    }

    /**
     * @param {number} depth
     * @param {'down'|'up'} via  which stairway we came out of, which
     *        decides where on the floor we appear.
     */
    enterLevel(depth, via) {
        let level = this.levels.get(depth);
        const fresh = !level;
        if (fresh) {
            const seed = this.seed + depth * 104729;
            level = generateLevel(depth, seed);
            level.monsters = populateLevel(level, depth, seed, FINAL_DEPTH);
            level.props = decorate(level, seed);
            this.levels.set(depth, level);
            this.themes.set(depth, buildTheme(depth, this.seed + depth * 7919));
        }
        this.depth = depth;
        this.deepest = Math.max(this.deepest, depth);
        this.level = level;
        this.theme = this.themes.get(depth);
        this.world = createWorldView(level, this.theme);
        this.projectiles.length = 0;
        this.sound.play('descend');
        this.sound.setDroneDepth(depth);
        const spot = via === 'down' ? level.entry : level.stairs;
        this.player = new Player(spot.x, spot.y, this.player ? this.player.facing : 0);
        level.revealFrom(this.player.cellX, this.player.cellY);
        this.say(fresh
            ? `you descend into ${this.theme.name}.`
            : `you return to level ${depth}.`, this.theme.accent);
        if (fresh && depth === FINAL_DEPTH) {
            this.say('something ancient stirs down here.', P.LTMAGENTA);
        }
        if (this.stats) this.saveGame('descend');
    }

    say(text, color = P.LTGRAY) {
        // Walking into the same wall five times should not fill the log
        // with five identical lines; roguelikes have always counted them.
        const last = this.messages[this.messages.length - 1];
        if (last && last.base === text) {
            last.count++;
            last.text = `${text} (x${last.count})`;
            last.t = this.time;
            return;
        }
        this.messages.push({ base: text, text, color, t: this.time, count: 1 });
        if (this.messages.length > MAX_MESSAGES) this.messages.shift();
    }

    get monsters() { return this.level.monsters; }

    monsterAt(x, y) {
        return this.monsters.find(m => m.alive && m.cellX === x && m.cellY === y) || null;
    }

    /** Point test, used by projectiles which live between cells. */
    monsterAtPoint(px, py) {
        return this.monsters.find(m => m.alive &&
            Math.abs(m.x - px) < 0.5 && Math.abs(m.y - py) < 0.5) || null;
    }

    // --- input ------------------------------------------------------------

    handleActions() {
        if (this.input.consumeAnyKey()) {
            this.sound.unlock();
            this.sound.startDrone(this.depth);
        }
        for (const action of this.input.drain()) {
            if (action === 'mute') {
                this.sound.setMuted(!this.sound.muted);
                this.say(this.sound.muted ? 'sound off.' : 'sound on.', P.DKGRAY);
                continue;
            }
            if (this.state === 'title') {
                if (action === 'continue') {
                    if (this.loadGame()) this.state = 'playing';
                    continue;
                }
                clearSave();
                this.canContinue = false;
                this.state = 'playing';
                continue;
            }
            if (this.state === 'dead' || this.state === 'won') {
                if (action === 'use') location.reload();
                continue;
            }
            if (action.startsWith('item')) {
                if (this.state === 'playing' || this.state === 'inventory') {
                    this.useSlot(parseInt(action.slice(4), 10) - 1);
                }
                continue;
            }
            switch (action) {
                case 'map':
                    this.state = this.state === 'map' ? 'playing' : 'map';
                    break;
                case 'help':
                    this.state = this.state === 'help' ? 'playing' : 'help';
                    break;
                case 'inventory':
                    this.state = this.state === 'inventory' ? 'playing' : 'inventory';
                    break;
                case 'save':
                    if (this.state === 'playing') this.saveGame('manual');
                    break;
                case 'pause':
                    this.state = this.state === 'playing' ? 'paused' : 'playing';
                    break;
                case 'use':
                    if (this.state === 'playing') this.interact();
                    break;
                case 'cast':
                    if (this.state === 'playing') this.castFireball();
                    break;
                case 'melee':
                    if (this.state === 'playing') this.meleeForward();
                    break;
            }
        }
    }

    interact() {
        const p = this.player;
        const f = p.facingCell();
        const facing = this.level.at(f.x, f.y);

        if (facing === DOOR) {
            this.level.set(f.x, f.y, DOOR_OPEN);
            this.level.revealFrom(p.cellX, p.cellY);
            this.sound.play('door');
            this.say('the door grinds open.', P.LTGRAY);
            return;
        }
        if (facing === LOCKED) {
            if (this.stats.keys > 0) {
                this.stats.keys--;
                this.level.set(f.x, f.y, DOOR_OPEN);
                this.level.revealFrom(p.cellX, p.cellY);
                this.sound.play('gate');
                this.say('the key turns. the gate swings wide.', P.LTCYAN);
            } else {
                this.sound.play('locked');
                this.say('the gate is locked. you need a key.', P.LTRED);
            }
            return;
        }
        if (facing === SECRET) {
            this.level.set(f.x, f.y, DOOR_OPEN);
            this.level.revealFrom(p.cellX, p.cellY);
            this.sound.play('secret');
            this.say('a hidden door swings inward!', P.YELLOW);
            return;
        }

        if (this.openChest()) return;

        const here = this.level.at(p.cellX, p.cellY);
        if (here === STAIRS) { this.enterLevel(this.depth + 1, 'down'); return; }
        if (here === STAIRS_UP) {
            if (this.depth === 1) {
                this.say('the way you came in has collapsed.', P.DKGRAY);
            } else {
                this.enterLevel(this.depth - 1, 'up');
            }
            return;
        }

        this.say('you search the stonework, and find nothing.', P.DKGRAY);
    }

    // --- combat -----------------------------------------------------------

    meleeForward() {
        const f = this.player.facingCell();
        const target = this.monsterAt(f.x, f.y);
        if (!target) { this.say('you swing at empty air.', P.DKGRAY); return; }
        this.strike(target);
    }

    strike(target) {
        const roll = this.stats.atk + ((Math.random() * 4) | 0);
        const dmg = Math.max(1, roll - target.spec.def);
        this.castTimer = 0.12;
        this.sound.play('swing');
        if (target.hit(dmg)) this.killMonster(target, 'you cut down');
        else { this.sound.play('enemyHit'); this.say(`you hit the ${target.name} for ${dmg}.`, P.LTGRAY); }
    }

    castFireball() {
        if (this.stats.mana < FIREBALL_COST) {
            this.sound.play('locked');
            this.say('not enough power for a fireball.', P.LTBLUE);
            return;
        }
        this.sound.play('cast');
        this.stats.mana -= FIREBALL_COST;
        this.castTimer = 0.28;
        const v = DIR_VECTORS[this.player.facing];
        const dmg = 8 + this.stats.level * 2;
        this.projectiles.push(new Projectile(
            this.player.x + v.x * 0.45, this.player.y + v.y * 0.45, v.x, v.y, dmg));
    }

    killMonster(m, verb) {
        m.hp = 0;
        this.sound.play('enemyDie');
        this.stats.kills++;
        this.gainXp(m.spec.xp);
        this.say(`${verb} the ${m.name}!`, P.LTGREEN);
        // corpses sometimes leave something behind
        const r = Math.random();
        if (m.spec.boss) {
            this.state = 'won';
            this.sound.play('victory');
            clearSave();
        } else if (r < 0.22) {
            this.level.items.push({ kind: 'gold', x: m.cellX, y: m.cellY });
        } else if (r < 0.32) {
            this.level.items.push({ kind: 'potion', x: m.cellX, y: m.cellY });
        } else if (r < 0.4) {
            this.level.items.push({ kind: 'mana', x: m.cellX, y: m.cellY });
        }
    }

    gainXp(amount) {
        const s = this.stats;
        s.xp += amount;
        while (s.xp >= s.xpNext) {
            s.xp -= s.xpNext;
            s.level++;
            s.xpNext = Math.round(s.xpNext * 1.6);
            s.hpMax += 8;
            s.manaMax += 4;
            s.atk += 2;
            s.def += 1;
            s.hp = s.hpMax;
            s.mana = s.manaMax;
            this.say(`you feel stronger. level ${s.level}!`, P.YELLOW);
            this.setFlash(P.YELLOW, 0.3);
            this.sound.play('levelUp');
            this.saveGame('level');
        }
    }

    monsterAttack(m) {
        const dmg = Math.max(1, m.spec.atk + ((Math.random() * 3) | 0) - this.stats.def);
        if (m.spec.drainsMana && this.stats.mana > 0) {
            this.stats.mana = Math.max(0, this.stats.mana - 2);
            this.takeDamage(dmg, `the ${m.name}`, P.LTMAGENTA, 'drains');
        } else {
            this.takeDamage(dmg, `the ${m.name}`);
        }
    }

    takeDamage(amount, source, color = P.LTRED, verb = 'hits') {
        this.stats.hp -= amount;
        this.setFlash(P.RED, 0.22);
        this.shake = Math.min(1, this.shake + 0.5 + amount / 40);
        this.hurtTimer = 1.2;
        this.sound.play('hurt');
        this.say(`${source} ${verb} you for ${amount}.`, color);
        if (this.stats.hp <= 0) {
            this.stats.hp = 0;
            this.state = 'dead';
            this.sound.play('death');
            clearSave();
        }
    }

    setFlash(color, duration) {
        this.flash = { color, t: duration, dur: duration };
    }

    /** Anything lying on this cell goes into the pack. */
    collect(x, y) {
        const items = this.level.items;
        const s = this.stats;
        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it.x !== x || it.y !== y) continue;
            if (it.kind === 'hoard') continue;      // a chest must be opened
            items.splice(i, 1);
            switch (it.kind) {
                case 'key':
                    s.keys++;
                    this.sound.play('pickup');
                    this.say('you pocket an iron key.', P.LTCYAN);
                    break;
                case 'gold': {
                    const gold = 8 + ((Math.random() * (6 + this.depth * 4)) | 0);
                    s.gold += gold;
                    this.sound.play('gold');
                    this.say(`${gold} gold pieces.`, P.YELLOW);
                    break;
                }
                case 'potion':
                case 'mana':
                case 'scroll': {
                    s.pack[it.kind]++;
                    this.sound.play('pickup');
                    const slot = SLOTS.find(sl => sl.kind === it.kind);
                    const n = SLOTS.indexOf(slot) + 1;
                    this.say(`you take a ${slot.label}. press ${n} to use.`, slot.color);
                    break;
                }
            }
        }
    }

    useSlot(index) {
        const slot = SLOTS[index];
        if (!slot) return;
        const s = this.stats;
        if (!s.pack[slot.kind]) {
            this.say(`no ${slot.label} in your pack.`, P.DKGRAY);
            return;
        }
        s.pack[slot.kind]--;
        if (slot.kind === 'potion') {
            const heal = Math.min(s.hpMax - s.hp, 18);
            s.hp += heal;
            this.say(`you drink deep. +${heal} hit points.`, P.LTRED);
            this.setFlash(P.RED, 0.16);
        } else if (slot.kind === 'mana') {
            const gain = Math.min(s.manaMax - s.mana, 14);
            s.mana += gain;
            this.say(`cold fire fills you. +${gain} power.`, P.LTBLUE);
            this.setFlash(P.BLUE, 0.16);
        } else {
            for (let yy = 0; yy < this.level.height; yy++)
                for (let xx = 0; xx < this.level.width; xx++)
                    if (this.level.at(xx, yy) !== 0) this.level.markSeen(xx, yy);
            this.say('the level lies open in your mind.', P.LTCYAN);
            this.setFlash(P.CYAN, 0.2);
        }
    }

    openChest() {
        const p = this.player;
        const items = this.level.items;
        const i = items.findIndex(it => it.kind === 'hoard' && it.x === p.cellX && it.y === p.cellY);
        if (i < 0) return false;
        items.splice(i, 1);
        const gold = 40 + this.depth * 25 + ((Math.random() * 30) | 0);
        this.stats.gold += gold;
        this.sound.play('gold');
        this.say(`the chest holds ${gold} gold.`, P.YELLOW);
        const roll = Math.random();
        if (roll < 0.45) { this.stats.pack.potion++; this.say('...and a healing draught.', P.LTRED); }
        else if (roll < 0.75) { this.stats.pack.mana++; this.say('...and a flask of cold fire.', P.LTBLUE); }
        else if (roll < 0.9) { this.stats.pack.scroll++; this.say('...and a scroll of true seeing.', P.LTCYAN); }
        this.setFlash(P.YELLOW, 0.25);
        return true;
    }

    // --- persistence ------------------------------------------------------

    saveGame(reason) {
        // Never write from the title screen: the constructor enters level 1
        // before the player has chosen new-game or continue, and saving
        // there would clobber the run they are about to resume.
        if (this.state !== 'playing') return;
        this.saveTimer = AUTOSAVE_EVERY;
        if (writeSave(this)) this.canContinue = true;
        if (reason === 'manual') this.say('progress recorded.', P.LTGRAY);
    }

    /** Rebuild a run from a save: regenerate each floor, then apply deltas. */
    loadGame() {
        const data = readSave();
        if (!data) { this.say('no run to continue.', P.DKGRAY); return false; }
        this.seed = data.seed;
        this.deepest = data.deepest;
        this.time = data.time || 0;
        this.stats = data.stats;
        if (!this.stats.pack) this.stats.pack = { potion: 0, mana: 0, scroll: 0 };
        this.levels.clear();
        this.themes.clear();
        this.player = null;
        for (const saved of data.levels) {
            const depth = saved.depth;
            const seed = this.seed + depth * 104729;
            const level = generateLevel(depth, seed);
            level.monsters = [];
            level.props = decorate(level, seed);
            level.tiles.set(saved.tiles);
            level.seen.set(saved.seen);
            level.items = saved.items;
            for (const m of saved.monsters) {
                const spec = monsterDef(m.id);
                if (!spec) continue;
                const mob = new Monster(spec, m.x, m.y);
                mob.hp = m.hp;
                mob.awake = m.awake;
                level.monsters.push(mob);
                if (spec.boss) level.boss = mob;
            }
            this.levels.set(depth, level);
            this.themes.set(depth, buildTheme(depth, this.seed + depth * 7919));
        }
        this.enterLevel(data.depth, 'down');
        this.player.cellX = data.player.x;
        this.player.cellY = data.player.y;
        this.player.x = data.player.x + 0.5;
        this.player.y = data.player.y + 0.5;
        this.player.facing = data.player.facing;
        this.player.angle = data.player.facing * Math.PI / 2;
        this.messages.length = 0;
        this.say(`you take up the descent again on level ${data.depth}.`, this.theme.accent);
        return true;
    }

    // --- loop -------------------------------------------------------------

    update(dt) {
        this.time += dt;
        this.handleActions();
        if (this.castTimer > 0) this.castTimer -= dt;
        if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.4);
        if (this.hurtTimer > 0) this.hurtTimer -= dt;
        if (this.flash) {
            this.flash.t -= dt;
            if (this.flash.t <= 0) this.flash = null;
        }
        if (this.state !== 'playing') return;

        const move = this.input.nextMove() || this.input.heldMovement();
        if (move && !this.player.busy) {
            this.player.request(move, this.nav, (t) => this.onBump(t));
        }
        this.player.update(dt, this.nav,
            (x, y) => this.onArrive(x, y),
            (t) => this.onBump(t));

        const ctx = {
            level: this.level,
            player: this.player,
            attack: (m) => this.monsterAttack(m),
            blocked: (x, y) => (this.player.cellX === x && this.player.cellY === y) ||
                this.monsters.some(m => m.alive && m.cellX === x && m.cellY === y),
            targetAt: (x, y, owner) => {
                if (owner === 'player') return this.monsterAtPoint(x, y);
                return (Math.abs(x - this.player.x) < 0.5 && Math.abs(y - this.player.y) < 0.5)
                    ? 'player' : null;
            },
            rangedAttack: (m, sx, sy, damage) => {
                this.projectiles.push(new Projectile(
                    m.x + sx * 0.45, m.y + sy * 0.45, sx, sy, damage, 'monster'));
                this.say(`the ${m.name} hurls a bolt of cold fire.`, P.LTMAGENTA);
            },
            onHit: (proj, target) => {
                if (target === 'player') { this.takeDamage(proj.damage, 'the bolt'); return; }
                this.sound.play('impact');
                if (target.hit(proj.damage)) this.killMonster(target, 'your fire consumes');
                else this.say(`the fireball sears the ${target.name} for ${proj.damage}.`, P.YELLOW);
            },
            onWall: () => { }
        };
        for (const m of this.monsters) if (m.alive) m.update(dt, ctx);
        for (const p of this.projectiles) p.update(dt, ctx);
        this.projectiles = this.projectiles.filter(p => !p.dead);

        // power seeps back slowly; hit points do not
        const s = this.stats;
        if (s.mana < s.manaMax) s.mana = Math.min(s.manaMax, s.mana + dt * 0.5);

        this.saveTimer -= dt;
        if (this.saveTimer <= 0) this.saveGame('auto');
    }

    /** Walking into something. A monster in the way gets hit instead. */
    onBump(target) {
        const m = this.monsterAt(target.x, target.y);
        if (m) { this.strike(m); return; }
        this.sound.play('bump');
        if (this.level.at(target.x, target.y) === DOOR) {
            this.say('a closed door. press enter.', P.DKGRAY);
            return;
        }
        if (this.level.at(target.x, target.y) === LOCKED) {
            this.say('a locked gate bars the way.', P.LTRED);
            return;
        }
        this.say('the stone will not give.', P.DKGRAY);
    }

    onArrive(x, y) {
        this.sound.play('step');
        this.level.revealFrom(x, y);
        this.collect(x, y);
        const here = this.level.at(x, y);
        if (here === STAIRS) this.say('a stairway spirals down. press enter.', this.theme.accent);
        else if (here === STAIRS_UP) this.say('steps climb back the way you came.', P.DKGRAY);
        else if (this.nearSecret(x, y)) this.say('a draught stirs the dust here.', P.DKGRAY);
    }

    /** Hint that a secret door is adjacent, without saying which wall. */
    nearSecret(x, y) {
        return [[0, -1], [1, 0], [0, 1], [-1, 0]]
            .some(([dx, dy]) => this.level.at(x + dx, y + dy) === SECRET);
    }

    // --- drawing ----------------------------------------------------------

    buildSpriteList() {
        const out = [];
        for (const m of this.monsters) {
            if (!m.alive) continue;
            out.push({
                x: m.x, y: m.y, bmp: m.bmp,
                height: m.spec.height, yOffset: m.spec.yOffset,
                fullBright: m.hurtFlash > 0
            });
        }
        for (const it of this.level.items) {
            const s = ITEM_SPRITES[it.kind];
            if (!s) continue;
            out.push({
                x: it.x + 0.5, y: it.y + 0.5, bmp: s.bmp,
                height: s.height, yOffset: s.yOffset, shadeBoost: 0.4
            });
        }
        for (const pr of this.level.props) {
            const bob = pr.kind === 'torch'
                ? Math.sin(this.time * 9 + pr.flicker) * 0.012 : 0;
            out.push({
                x: pr.x, y: pr.y, bmp: pr.bmp,
                height: pr.height + bob, yOffset: pr.yOffset,
                fullBright: pr.fullBright, shadeBoost: pr.shadeBoost || 0
            });
        }
        for (const p of this.projectiles) {
            out.push({ x: p.x, y: p.y, bmp: p.bmp, height: 0.3, yOffset: 0.35, fullBright: true });
        }
        return out;
    }

    /** The hand at the bottom of the view — the series' signature. */
    drawHand() {
        const casting = this.castTimer > 0;
        const bmp = casting ? S.HAND_CAST : S.HAND;
        const scale = 3.0;
        const w = bmp.w * scale;
        const x = Math.round(HUD.VIEW.x + (HUD.VIEW.w - w) / 2);
        const lift = casting ? 10 : 0;
        // Only the top of the fist shows; the rest sits below the view, the
        // way a hand held at your waist would.
        const y = Math.round(HUD.VIEW.y + HUD.VIEW.h - bmp.h * scale + 34 - lift
            + Math.abs(this.player.bob) * 0.6);
        this.fb.blit(bmp, x, y, scale);
    }

    draw() {
        if (this.state === 'title') return this.drawTitle();

        // A hit shoves the camera around for a moment. The renderer only
        // offers pitch and yaw, which is plenty: a blobber that slid its
        // whole viewport would break the illusion of a fixed window.
        const k = this.shake;
        const jitterA = k ? Math.sin(this.time * 71) * k * 0.02 : 0;
        const jitterY = k ? Math.sin(this.time * 53) * k * 4 : 0;
        this.renderer.render(this.world, {
            x: this.player.x, y: this.player.y,
            angle: this.player.angle + jitterA,
            pitch: this.player.pitch + jitterY
        }, this.buildSpriteList());

        this.drawHand();

        // a hard black frame around the view, as the originals had
        const fb = this.fb;
        fb.fillRect(0, 0, HUD.SCREEN_W, HUD.VIEW.y, P.BLACK);
        fb.fillRect(0, HUD.VIEW.y + HUD.VIEW.h, HUD.SCREEN_W, HUD.SCREEN_H - HUD.VIEW.y - HUD.VIEW.h, P.BLACK);
        fb.fillRect(0, 0, HUD.VIEW.x, HUD.SCREEN_H, P.BLACK);
        fb.fillRect(HUD.VIEW.x + HUD.VIEW.w, 0, HUD.SCREEN_W - HUD.VIEW.x - HUD.VIEW.w, HUD.SCREEN_H, P.BLACK);

        if (this.state === 'map') HUD.drawAutomap(fb, this.level, this.player, this.theme);
        if (this.state === 'help') this.drawHelp();
        if (this.state === 'inventory') this.drawInventory();
        if (this.state === 'paused') {
            HUD.drawPanel(fb, 'paused', ['esc to resume'], { width: 160, center: true });
        }
        if (this.state === 'dead') {
            HUD.drawPanel(fb, 'you die', [
                `you fell on level ${this.depth}, ${this.theme.name}.`,
                `${this.stats.kills} slain · ${this.stats.gold} gold · level ${this.stats.level}`,
                '',
                'press enter to try again'
            ], { width: 280, center: true, titleColor: P.LTRED });
        }
        if (this.state === 'won') {
            HUD.drawPanel(fb, 'the lich falls', [
                'the grimhold is quiet for the first',
                'time in a thousand years.',
                '',
                `${this.stats.kills} slain · ${this.stats.gold} gold · level ${this.stats.level}`,
                'press enter to descend again'
            ], { width: 280, center: true, titleColor: P.YELLOW });
        }

        HUD.drawStatusBar(fb, this);
        this.applyFlash();
        fb.present(this.ctx);
    }

    /** Damage and level-up flashes are palette swaps, not overdraw. */
    applyFlash() {
        if (!this.flash) { this.fb.setPalette(1, null); return; }
        const k = this.flash.t / this.flash.dur;
        const rgb = P.EGA[this.flash.color];
        this.fb.setPalette(1 + k * 0.15, {
            r: (rgb >> 16) & 0xff, g: (rgb >> 8) & 0xff, b: rgb & 0xff,
            amount: k * 0.55
        });
    }

    drawTitle() {
        const fb = this.fb;
        fb.setPalette(1, null);
        // A glow rising from the floor of the pit. Blue holds its value for
        // most of its darkening chain, so a shade ramp would come out flat;
        // dithering blue against black directly is the only way to get a
        // real gradient out of a 16-colour palette.
        for (let y = 0; y < HUD.SCREEN_H; y++) {
            const density = Math.pow(y / HUD.SCREEN_H, 1.6) * 1.15;
            for (let x = 0; x < HUD.SCREEN_W; x++) {
                const threshold = (P.BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
                fb.pixels[y * fb.width + x] = density > threshold ? P.BLUE : P.BLACK;
            }
        }
        drawTextCentered(fb, 160, 44, 'GRIMHOLD', P.YELLOW, P.BLACK);
        drawTextCentered(fb, 160, 60, 'ABYSS', P.YELLOW, P.BLACK);
        drawTextCentered(fb, 160, 84, 'TEN LEVELS DOWN, THE LICH WAITS', P.LTGRAY, P.BLACK);
        fb.blit(S.SKELETON, 34, 92, 2.0);
        fb.blit(S.DEMON, 234, 96, 1.8);
        const blink = Math.floor(this.time * 2) % 2 === 0;
        if (blink) drawTextCentered(fb, 160, 128, 'ENTER   BEGIN THE DESCENT', P.WHITE, P.BLACK);
        if (this.canContinue)
            drawTextCentered(fb, 160, 142, 'C       CONTINUE YOUR RUN', P.LTCYAN, P.BLACK);
        drawTextCentered(fb, 160, 172, 'ARROWS MOVE  SPACE FIREBALL', P.DKGRAY);
        drawTextCentered(fb, 160, 182, 'TAB MAP  I PACK  H HELP', P.DKGRAY);
        fb.present(this.ctx);
    }

    drawInventory() {
        const pack = this.stats.pack;
        const lines = SLOTS.map((slot, i) => ({
            text: `${i + 1}.  ${String(pack[slot.kind]).padStart(2)}  ${slot.label}`,
            color: pack[slot.kind] ? slot.color : P.DKGRAY
        }));
        lines.push({ text: '', color: P.BLACK });
        lines.push({ text: `iron keys    ${this.stats.keys}`, color: this.stats.keys ? P.LTCYAN : P.DKGRAY });
        lines.push({ text: `gold         ${this.stats.gold}`, color: P.YELLOW });
        lines.push({ text: '', color: P.BLACK });
        lines.push({ text: 'press a number to use  ·  I to close', color: P.DKGRAY });
        HUD.drawPanel(this.fb, 'your pack', lines, { width: 250 });
    }

    drawHelp() {
        HUD.drawPanel(this.fb, 'controls', [
            'UP / W        step forward',
            'DOWN / S      step back',
            'LEFT / RIGHT  turn in place',
            'Q / E         sidestep',
            'SPACE / CTRL  hurl a fireball',
            'F or walk in  strike with your blade',
            'ENTER         doors, stairs, chests',
            'I             pack · 1-3 use an item',
            'TAB           automap · ESC pause',
            'F2            save now (it autosaves too)'
        ], { width: 254 });
    }

    run() {
        let last = performance.now();
        const frame = (now) => {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            this.update(dt);
            this.draw();
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }
}

const canvas = document.getElementById('screen');
const game = new Game(canvas);
game.run();
window.GAME = game;
