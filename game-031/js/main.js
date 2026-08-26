/**
 * Grimhold Abyss — entry point and game loop.
 */

import { Framebuffer } from './engine/framebuffer.js';
import { Renderer } from './engine/renderer.js';
import * as P from './engine/palette.js';
import { drawText, drawTextCentered } from './engine/font.js';
import { generateLevel, STAIRS } from './dungeon.js';
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
        this.enterLevel(1);
    }

    enterLevel(depth) {
        this.depth = depth;
        this.level = generateLevel(depth, this.seed + depth * 104729);
        this.theme = buildTheme(depth, this.seed + depth * 7919);
        this.world = createWorldView(this.level, this.theme);
        this.player = new Player(this.level.entry.x, this.level.entry.y, 0);
        this.level.revealFrom(this.player.cellX, this.player.cellY);
        this.say(`you descend into ${this.theme.name}.`, this.theme.accent);
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
        if (this.level.at(p.cellX, p.cellY) === STAIRS) {
            this.enterLevel(this.depth + 1);
            return;
        }
        this.say('there is nothing to use here.', P.DKGRAY);
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
        if (this.level.at(x, y) === STAIRS) {
            this.say('a stairway spirals down. press enter.', this.theme.accent);
        }
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
            'ENTER         use stairs, doors',
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
