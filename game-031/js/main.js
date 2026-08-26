/**
 * Grimhold Abyss — entry point and game loop.
 */

import { Framebuffer } from './engine/framebuffer.js';
import { Renderer } from './engine/renderer.js';
import * as P from './engine/palette.js';
import { drawText, drawTextCentered } from './engine/font.js';
import {
    generateLevel, FLOOR, DOOR, DOOR_OPEN, STAIRS, LOCKED, SECRET, STAIRS_UP
} from './dungeon.js';
import { buildTheme, createWorldView } from './themes.js';
import { Player } from './player.js';
import { Input } from './input.js';
import * as HUD from './hud.js';

const MAX_MESSAGES = 32;

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
            level: 1, xp: 0, xpNext: 20, gold: 0, keys: 0
        };
        this.depth = 0;
        this.levels = new Map();     // depth -> Level, so floors persist
        this.themes = new Map();
        this.deepest = 1;
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
            level = generateLevel(depth, this.seed + depth * 104729);
            this.levels.set(depth, level);
            this.themes.set(depth, buildTheme(depth, this.seed + depth * 7919));
        }
        this.depth = depth;
        this.deepest = Math.max(this.deepest, depth);
        this.level = level;
        this.theme = this.themes.get(depth);
        this.world = createWorldView(level, this.theme);
        const spot = via === 'down' ? level.entry : level.stairs;
        this.player = new Player(spot.x, spot.y, this.player ? this.player.facing : 0);
        level.revealFrom(this.player.cellX, this.player.cellY);
        this.say(fresh
            ? `you descend into ${this.theme.name}.`
            : `you return to level ${depth}.`, this.theme.accent);
    }

    say(text, color = P.LTGRAY) {
        this.messages.push({ text, color, t: this.time });
        if (this.messages.length > MAX_MESSAGES) this.messages.shift();
    }

    // --- input ------------------------------------------------------------

    handleActions() {
        for (const action of this.input.drain()) {
            if (this.state === 'title') { this.state = 'playing'; continue; }
            switch (action) {
                case 'map':
                    this.state = this.state === 'map' ? 'playing' : 'map';
                    break;
                case 'help':
                    this.state = this.state === 'help' ? 'playing' : 'help';
                    break;
                case 'pause':
                    if (this.state !== 'playing') this.state = 'playing';
                    break;
                case 'use':
                    if (this.state === 'playing') this.interact();
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
            this.say('the door grinds open.', P.LTGRAY);
            return;
        }
        if (facing === LOCKED) {
            if (this.stats.keys > 0) {
                this.stats.keys--;
                this.level.set(f.x, f.y, DOOR_OPEN);
                this.level.revealFrom(p.cellX, p.cellY);
                this.say('the key turns. the gate swings wide.', P.LTCYAN);
            } else {
                this.say('the gate is locked. you need a key.', P.LTRED);
            }
            return;
        }
        if (facing === SECRET) {
            this.level.set(f.x, f.y, DOOR_OPEN);
            this.level.revealFrom(p.cellX, p.cellY);
            this.say('a hidden door swings inward!', P.YELLOW);
            return;
        }

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

    /** Anything lying on this cell goes into the pack. */
    collect(x, y) {
        const items = this.level.items;
        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it.x !== x || it.y !== y) continue;
            items.splice(i, 1);
            if (it.kind === 'key') {
                this.stats.keys++;
                this.say('you pocket an iron key.', P.LTCYAN);
            } else if (it.kind === 'hoard') {
                const gold = 40 + this.depth * 25 + ((Math.random() * 30) | 0);
                this.stats.gold += gold;
                this.say(`a forgotten hoard! ${gold} gold.`, P.YELLOW);
            }
        }
    }

    // --- loop -------------------------------------------------------------

    update(dt) {
        this.time += dt;
        this.handleActions();
        if (this.state !== 'playing') return;

        const move = this.input.nextMove() || this.input.heldMovement();
        if (move && !this.player.busy) {
            this.player.request(move, this.level, () => this.say('the stone will not give.', P.DKGRAY));
        }
        this.player.update(dt, this.level,
            (x, y) => this.onArrive(x, y),
            () => this.say('the stone will not give.', P.DKGRAY));
    }

    onArrive(x, y) {
        this.level.revealFrom(x, y);
        this.collect(x, y);
        const here = this.level.at(x, y);
        if (here === STAIRS) this.say('a stairway spirals down. press enter.', this.theme.accent);
        else if (here === STAIRS_UP) this.say('steps climb back the way you came.', P.DKGRAY);
        else if (this.nearSecret(x, y)) this.say('a draught stirs the dust here.', P.DKGRAY);
        else if (this.facingBlockedByLock(x, y)) this.say('a locked gate bars the way.', P.LTRED);
    }

    /** Hint that a secret door is adjacent, without saying which wall. */
    nearSecret(x, y) {
        return [[0, -1], [1, 0], [0, 1], [-1, 0]]
            .some(([dx, dy]) => this.level.at(x + dx, y + dy) === SECRET);
    }

    facingBlockedByLock(x, y) {
        return [[0, -1], [1, 0], [0, 1], [-1, 0]]
            .some(([dx, dy]) => this.level.at(x + dx, y + dy) === LOCKED);
    }

    draw() {
        if (this.state === 'title') return this.drawTitle();

        this.renderer.render(this.world, {
            x: this.player.x, y: this.player.y,
            angle: this.player.angle, pitch: this.player.pitch
        }, []);

        // a hard black frame around the view, as the originals had
        this.fb.fillRect(0, 0, HUD.SCREEN_W, HUD.VIEW.y, P.BLACK);
        this.fb.fillRect(0, HUD.VIEW.y + HUD.VIEW.h, HUD.SCREEN_W, HUD.SCREEN_H - HUD.VIEW.y - HUD.VIEW.h, P.BLACK);
        this.fb.fillRect(0, 0, HUD.VIEW.x, HUD.SCREEN_H, P.BLACK);
        this.fb.fillRect(HUD.VIEW.x + HUD.VIEW.w, 0, HUD.SCREEN_W - HUD.VIEW.x - HUD.VIEW.w, HUD.SCREEN_H, P.BLACK);

        if (this.state === 'map') HUD.drawAutomap(this.fb, this.level, this.player, this.theme);
        if (this.state === 'help') this.drawHelp();

        HUD.drawStatusBar(this.fb, this);
        this.fb.present(this.ctx);
    }

    drawTitle() {
        const fb = this.fb;
        fb.clear(P.BLACK);
        // a dithered blue glow rising from the floor of the pit
        for (let y = 0; y < HUD.SCREEN_H; y++) {
            const level = Math.max(0, 2.4 - (y / HUD.SCREEN_H) * 2.6);
            for (let x = 0; x < HUD.SCREEN_W; x++) {
                const l = Math.min(P.SHADES - 1, P.ditherLevel(level, x, y));
                fb.pixels[y * fb.width + x] = P.shadeTable[l * 16 + P.BLUE];
            }
        }
        drawTextCentered(fb, 160, 52, 'GRIMHOLD', P.YELLOW, P.BLACK);
        drawTextCentered(fb, 160, 68, 'ABYSS', P.YELLOW, P.BLACK);
        drawTextCentered(fb, 160, 92, 'A DUNGEON OF UNKNOWN DEPTH', P.LTGRAY, P.BLACK);
        if (Math.floor(this.time * 2) % 2 === 0)
            drawTextCentered(fb, 160, 130, 'PRESS ANY KEY', P.WHITE, P.BLACK);
        drawTextCentered(fb, 160, 178, 'ARROWS MOVE  TAB MAP  H HELP', P.DKGRAY);
        fb.present(this.ctx);
    }

    drawHelp() {
        HUD.drawPanel(this.fb, 'controls', [
            'UP / W        step forward',
            'DOWN / S      step back',
            'LEFT / RIGHT  turn in place',
            'Q / E         sidestep',
            'ENTER         doors, stairs, search',
            'TAB           automap',
            'H             this screen'
        ], { width: 250 });
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
