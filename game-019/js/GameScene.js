/**
 * GameScene — Main Synthwave Breakout gameplay.
 *
 * Features:
 *  - Paddle controlled by mouse or left/right arrows
 *  - Ball with speed escalation and angle control
 *  - Bricks with HP tiers, neon colors, and particle explosions
 *  - Combo multiplier (resets on ball loss)
 *  - Powerup drops: wide paddle, slow ball, multiball, laser
 *  - Perspective grid background
 *  - Synthwave scanline overlay
 */

import { Scene, Math as PhaserMath, Input as PhaserInput, Geom } from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { state }  from './state.js';
import { events } from './events.js';
import {
    GAME_WIDTH, GAME_HEIGHT, COLORS,
    PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_SPEED, PADDLE_Y,
    BALL_RADIUS, BALL_SPEED_INIT, BALL_SPEED_MAX, BALL_SPEED_INC,
    BRICK_COLS, BRICK_ROWS, BRICK_WIDTH, BRICK_HEIGHT,
    BRICK_PAD_X, BRICK_PAD_Y, BRICK_OFFSET_X, BRICK_OFFSET_Y,
    BRICK_ROW_HP, POWERUP_CHANCE, POWERUP_FALL_SPD,
    PARTICLE_COUNT_BRICK, PARTICLE_COUNT_PADDLE, PARTICLE_COUNT_DEATH,
} from './config.js';
import {
    playPaddleHit, playBrickHit, playBrickDestroy, playWallBounce,
    playBallLost, playPowerupCollect, playComboJingle, playLevelComplete,
    playLaser,
} from './sounds.js';

function toHexInt(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }

// Neon brick color rows (synthwave palette)
const BRICK_ROW_COLORS = [
    [255,  60, 220],  // hot pink   row 0
    [255,  80, 100],  // coral      row 1
    [255, 160,  60],  // orange     row 2
    [255, 220,  60],  // yellow     row 3
    [100, 255, 160],  // mint       row 4
    [ 60, 220, 255],  // cyan       row 5
    [100,  80, 255],  // indigo     row 6
    [200,  60, 255],  // violet     row 7
];

const POWERUP_TYPES = ['wide', 'slow', 'multiball', 'laser'];
const POWERUP_COLORS = {
    wide:      0xff3cdc,
    slow:      0x3cccff,
    multiball: 0xffdd3c,
    laser:     0xff5050,
};

export class GameScene extends Scene {
    constructor() { super({ key: 'GameScene' }); }

    create() {
        state.reset();

        this._bricksBroken  = 0;
        this._totalBricks   = 0;
        this._ballLaunched  = false;
        this._laserCooldown = 0;
        this._lasers        = [];
        this._powerups      = [];
        this._balls         = [];
        this._particles     = [];

        this._buildBackground();
        this._buildBricks();
        this._buildPaddle();
        this._buildBall();
        this._buildInputs();

        // Event subscriptions
        this._offs = [
            events.on('gameOver',     () => this._handleGameOver()),
            events.on('levelComplete',() => this._handleLevelComplete()),
        ];
    }

    // --------------------------------------------------------
    // Build helpers
    // --------------------------------------------------------

    _buildBackground() {
        // Dark base
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, toHexInt(COLORS.bg));

        // Perspective grid
        const g = this.add.graphics();
        const horizon = GAME_HEIGHT * 0.72;
        const lineColor = toHexInt(COLORS.grid);
        const hLines = 12;
        for (let i = 0; i <= hLines; i++) {
            const t = i / hLines;
            const curve = Math.pow(t, 2.2);
            const y = horizon + (GAME_HEIGHT - horizon) * curve;
            const alpha = 0.12 + 0.3 * t;
            g.lineStyle(1, lineColor, alpha);
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(GAME_WIDTH, y);
            g.strokePath();
        }
        const vLines = 20;
        const vx = GAME_WIDTH / 2;
        for (let i = 0; i <= vLines; i++) {
            const t = i / vLines;
            const bottomX = t * GAME_WIDTH;
            const alpha = 0.06 + 0.15 * Math.abs(t - 0.5) * 2;
            g.lineStyle(1, lineColor, alpha);
            g.beginPath();
            g.moveTo(vx + (bottomX - vx) * 0.01, horizon);
            g.lineTo(bottomX, GAME_HEIGHT);
            g.strokePath();
        }

        // Horizon glow strip
        const sunG = this.add.graphics();
        sunG.fillStyle(toHexInt(COLORS.accent), 0.15);
        sunG.fillRect(0, horizon - 2, GAME_WIDTH, 4);

        // Scanlines
        const sl = this.add.graphics();
        sl.lineStyle(1, 0x000000, 0.1);
        for (let y = 0; y < GAME_HEIGHT; y += 3) {
            sl.beginPath(); sl.moveTo(0, y); sl.lineTo(GAME_WIDTH, y); sl.strokePath();
        }
        sl.setDepth(1000);

        // Bottom danger zone line
        const dz = this.add.graphics();
        dz.lineStyle(1, toHexInt(COLORS.danger), 0.25);
        dz.beginPath();
        dz.moveTo(0, GAME_HEIGHT - 10);
        dz.lineTo(GAME_WIDTH, GAME_HEIGHT - 10);
        dz.strokePath();
    }

    _buildBricks() {
        this._bricks = [];
        for (let row = 0; row < BRICK_ROWS; row++) {
            for (let col = 0; col < BRICK_COLS; col++) {
                const x = BRICK_OFFSET_X + col * (BRICK_WIDTH + BRICK_PAD_X) + BRICK_WIDTH / 2;
                const y = BRICK_OFFSET_Y + row * (BRICK_HEIGHT + BRICK_PAD_Y) + BRICK_HEIGHT / 2;
                const hp     = BRICK_ROW_HP[row];
                const color  = BRICK_ROW_COLORS[row];
                const brick  = this._makeBrick(x, y, hp, color, row, col);
                this._bricks.push(brick);
                this._totalBricks++;
            }
        }
    }

    _makeBrick(x, y, hp, colorArr, row, col) {
        const g = this.add.graphics();
        g.x = x;
        g.y = y;
        this._drawBrickGraphic(g, hp, colorArr);

        return {
            gfx: g,
            x, y,
            hp, maxHp: hp,
            color: colorArr,
            alive: true,
            row, col,
            bounds: new Geom.Rectangle(
                x - BRICK_WIDTH / 2, y - BRICK_HEIGHT / 2,
                BRICK_WIDTH, BRICK_HEIGHT
            ),
        };
    }

    _drawBrickGraphic(g, hp, colorArr) {
        g.clear();
        const w = BRICK_WIDTH;
        const h = BRICK_HEIGHT;
        const c = toHexInt(colorArr);
        const alpha = hp >= 3 ? 1.0 : hp === 2 ? 0.78 : 0.55;

        g.fillStyle(c, alpha * 0.85);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 3);

        // Inner highlight
        g.lineStyle(1, 0xffffff, alpha * 0.4);
        g.strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 2);

        // Crack marks for damaged bricks
        if (hp === 2) {
            g.lineStyle(1, 0x000000, 0.5);
            g.beginPath();
            g.moveTo(-w / 4, -h / 4);
            g.lineTo(w / 6, h / 3);
            g.strokePath();
        } else if (hp >= 3) {
            // No damage yet — bright clean look
        }
    }

    _buildPaddle() {
        this._paddleW     = PADDLE_WIDTH;
        this._paddleX     = GAME_WIDTH / 2;
        this._paddleY     = PADDLE_Y;
        this._paddleGfx   = this.add.graphics();
        this._drawPaddle();
        this._widePaddleTimer = 0;
        this._laserPaddleTimer = 0;
    }

    _drawPaddle() {
        const g  = this._paddleGfx;
        const w  = this._paddleW;
        const h  = PADDLE_HEIGHT;
        const c  = toHexInt(COLORS.paddleColor);
        g.clear();
        g.x = this._paddleX;
        g.y = this._paddleY;

        // Glow
        g.fillStyle(c, 0.15);
        g.fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 6);

        // Body
        g.fillStyle(c, 0.9);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 4);

        // Shine
        g.fillStyle(0xffffff, 0.3);
        g.fillRoundedRect(-w / 2 + 4, -h / 2 + 2, w - 8, 4, 2);
    }

    _buildBall() {
        this._spawnBall(GAME_WIDTH / 2, PADDLE_Y - BALL_RADIUS - 6, null);
        this._ballLaunched = false;
    }

    _spawnBall(x, y, angle) {
        const speed = BALL_SPEED_INIT;
        let vx, vy;
        if (angle === null) {
            vx = 0; vy = 0;
        } else {
            vx = Math.cos(angle) * speed;
            vy = Math.sin(angle) * speed;
        }

        const gfx = this.add.graphics();
        gfx.x = x;
        gfx.y = y;

        // Persistent trail graphics object (drawn in world space)
        const trailGfx = this.add.graphics();
        trailGfx.setDepth(48);

        const ball = {
            gfx,
            trailGfx,
            x, y,
            vx, vy,
            speed,
            alive: true,
            trail: [],
        };
        this._balls.push(ball);
        return ball;
    }

    _buildInputs() {
        this._keys = this.input.keyboard.addKeys({
            left:    PhaserInput.Keyboard.KeyCodes.LEFT,
            right:   PhaserInput.Keyboard.KeyCodes.RIGHT,
            a:       PhaserInput.Keyboard.KeyCodes.A,
            d:       PhaserInput.Keyboard.KeyCodes.D,
            space:   PhaserInput.Keyboard.KeyCodes.SPACE,
            restart: PhaserInput.Keyboard.KeyCodes.R,
            pause:   PhaserInput.Keyboard.KeyCodes.P,
            escape:  PhaserInput.Keyboard.KeyCodes.ESC,
            mute:    PhaserInput.Keyboard.KeyCodes.M,
            laser:   PhaserInput.Keyboard.KeyCodes.Z,
        });
    }

    // --------------------------------------------------------
    // Update
    // --------------------------------------------------------

    update(time, delta) {
        if (state.isGameOver) return;
        if (state.isPaused)   return;

        const dt = delta / 1000;

        this._handleInput(dt);
        this._updateBalls(dt);
        this._updateLasers(dt);
        this._updatePowerups(dt);
        this._updateParticles(dt);
        this._updatePowerupTimers(dt);

        // Redraw paddle each frame for accurate position
        this._drawPaddle();
    }

    // --------------------------------------------------------
    // Input
    // --------------------------------------------------------

    _handleInput(dt) {
        const leftDown  = this._keys.left.isDown  || this._keys.a.isDown;
        const rightDown = this._keys.right.isDown || this._keys.d.isDown;
        const mouseX    = this.input.mousePointer.x / this.scale.displayScale.x;

        // Mouse takes priority if it moved recently
        if (Math.abs(mouseX - this._paddleX) > 2) {
            this._paddleX = PhaserMath.Clamp(mouseX, this._paddleW / 2, GAME_WIDTH - this._paddleW / 2);
        }

        if (leftDown)  this._paddleX = Math.max(this._paddleW / 2,                this._paddleX - PADDLE_SPEED * dt);
        if (rightDown) this._paddleX = Math.min(GAME_WIDTH - this._paddleW / 2,   this._paddleX + PADDLE_SPEED * dt);

        // Launch ball
        if (PhaserInput.Keyboard.JustDown(this._keys.space) ||
            this.input.mousePointer.leftButtonDown()) {
            if (!this._ballLaunched) {
                this._launchBall();
            }
        }

        // Laser fire
        if ((PhaserInput.Keyboard.JustDown(this._keys.laser) ||
             this.input.mousePointer.rightButtonDown()) &&
            state.activePowerups.laserPaddle) {
            this._fireLaser();
        }

        // Stick unlaunched ball to paddle
        if (!this._ballLaunched && this._balls.length > 0) {
            const b = this._balls[0];
            b.x = this._paddleX;
            b.y = PADDLE_Y - BALL_RADIUS - 6;
            b.gfx.x = b.x;
            b.gfx.y = b.y;
        }

        // Keys
        if (PhaserInput.Keyboard.JustDown(this._keys.restart)) this._restart();
        if (PhaserInput.Keyboard.JustDown(this._keys.pause))   state.isPaused = !state.isPaused;
        if (PhaserInput.Keyboard.JustDown(this._keys.escape))  this._goToMenu();
        if (PhaserInput.Keyboard.JustDown(this._keys.mute)) {
            const { toggleSound } = require('./sounds.js');
            toggleSound();
        }
    }

    _launchBall() {
        this._ballLaunched = true;
        const angle = -Math.PI / 2 + PhaserMath.FloatBetween(-0.4, 0.4);
        if (this._balls.length > 0) {
            const b = this._balls[0];
            b.vx = Math.cos(angle) * BALL_SPEED_INIT;
            b.vy = Math.sin(angle) * BALL_SPEED_INIT;
        }
    }

    // --------------------------------------------------------
    // Ball physics
    // --------------------------------------------------------

    _updateBalls(dt) {
        const dead = [];

        for (const ball of this._balls) {
            if (!ball.alive) continue;

            // Stick to paddle if not launched
            if (!this._ballLaunched) continue;

            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;

            // Trail — keep more points for a longer Tron streak
            ball.trail.push({ x: ball.x, y: ball.y });
            if (ball.trail.length > 28) ball.trail.shift();

            // Wall bounces
            if (ball.x - BALL_RADIUS <= 0) {
                ball.x = BALL_RADIUS;
                ball.vx = Math.abs(ball.vx);
                playWallBounce();
                this._spawnParticles(ball.x, ball.y, COLORS.ballColor, 4);
            }
            if (ball.x + BALL_RADIUS >= GAME_WIDTH) {
                ball.x = GAME_WIDTH - BALL_RADIUS;
                ball.vx = -Math.abs(ball.vx);
                playWallBounce();
                this._spawnParticles(ball.x, ball.y, COLORS.ballColor, 4);
            }
            if (ball.y - BALL_RADIUS <= 0) {
                ball.y = BALL_RADIUS;
                ball.vy = Math.abs(ball.vy);
                playWallBounce();
            }

            // Paddle collision
            if (ball.vy > 0 &&
                ball.y + BALL_RADIUS >= this._paddleY - PADDLE_HEIGHT / 2 &&
                ball.y - BALL_RADIUS <= this._paddleY + PADDLE_HEIGHT / 2 &&
                ball.x >= this._paddleX - this._paddleW / 2 - BALL_RADIUS &&
                ball.x <= this._paddleX + this._paddleW / 2 + BALL_RADIUS) {

                // Angle based on hit position
                const rel   = (ball.x - this._paddleX) / (this._paddleW / 2);
                const angle = rel * (Math.PI / 3);  // max ±60°
                const spd   = Math.min(ball.speed, BALL_SPEED_MAX);
                ball.vx = Math.sin(angle) * spd;
                ball.vy = -Math.abs(Math.cos(angle) * spd);
                ball.y  = this._paddleY - PADDLE_HEIGHT / 2 - BALL_RADIUS;
                playPaddleHit();
                this._spawnParticles(ball.x, ball.y, COLORS.paddleColor, PARTICLE_COUNT_PADDLE);
                state.resetCombo();
            }

            // Brick collision
            this._checkBrickCollision(ball);

            // Ball lost
            if (ball.y - BALL_RADIUS > GAME_HEIGHT) {
                dead.push(ball);
            }

            // Update graphics
            this._drawBallWithTrail(ball);
        }

        // Remove dead balls
        for (const ball of dead) {
            ball.alive = false;
            ball.gfx.destroy();
            ball.trailGfx.destroy();
            this._balls = this._balls.filter(b => b !== ball);
        }

        if (this._balls.length === 0 && this._ballLaunched) {
            this._ballLost();
        }
    }

    _drawBallWithTrail(ball) {
        // --- Tron light trail (world-space, separate graphics object) ---
        const tg = ball.trailGfx;
        tg.clear();

        const trail = ball.trail;
        const n = trail.length;
        if (n >= 2) {
            // Outer wide glow layer
            for (let i = 1; i < n; i++) {
                const t = i / n;                      // 0→tail, 1→head
                const alpha = Math.pow(t, 1.5) * 0.25;
                const width = 2 + 8 * t;
                tg.lineStyle(width, toHexInt(COLORS.ballColor), alpha);
                tg.beginPath();
                tg.moveTo(trail[i - 1].x, trail[i - 1].y);
                tg.lineTo(trail[i].x,     trail[i].y);
                tg.strokePath();
            }
            // Core bright white line
            for (let i = 1; i < n; i++) {
                const t = i / n;
                const alpha = Math.pow(t, 1.2) * 0.85;
                const width = Math.max(1, 2 * t);
                tg.lineStyle(width, 0xffffff, alpha);
                tg.beginPath();
                tg.moveTo(trail[i - 1].x, trail[i - 1].y);
                tg.lineTo(trail[i].x,     trail[i].y);
                tg.strokePath();
            }
            // Cyan accent edge line
            for (let i = Math.max(1, n - 10); i < n; i++) {
                const t = (i - (n - 10)) / 10;
                tg.lineStyle(1, toHexInt(COLORS.accent2), t * 0.6);
                tg.beginPath();
                tg.moveTo(trail[i - 1].x, trail[i - 1].y);
                tg.lineTo(trail[i].x,     trail[i].y);
                tg.strokePath();
            }
        }

        // --- Ball head ---
        const g = ball.gfx;
        g.clear();

        // Outer glow halo
        g.fillStyle(toHexInt(COLORS.ballColor), 0.12);
        g.fillCircle(0, 0, BALL_RADIUS + 9);

        // Mid glow
        g.fillStyle(toHexInt(COLORS.ballColor), 0.3);
        g.fillCircle(0, 0, BALL_RADIUS + 4);

        // Main ball
        g.fillStyle(toHexInt(COLORS.ballColor), 1);
        g.fillCircle(0, 0, BALL_RADIUS);

        // White core
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(0, 0, BALL_RADIUS * 0.45);

        // Bright ring
        g.lineStyle(1.5, 0xffffff, 0.9);
        g.strokeCircle(0, 0, BALL_RADIUS);

        g.x = ball.x;
        g.y = ball.y;
        g.setDepth(50);
    }

    _checkBrickCollision(ball) {
        for (const brick of this._bricks) {
            if (!brick.alive) continue;

            const { x, y, bounds } = brick;
            const bLeft   = bounds.x;
            const bRight  = bounds.x + bounds.width;
            const bTop    = bounds.y;
            const bBottom = bounds.y + bounds.height;

            // AABB + circle
            const nearX = PhaserMath.Clamp(ball.x, bLeft, bRight);
            const nearY = PhaserMath.Clamp(ball.y, bTop, bBottom);
            const dx = ball.x - nearX;
            const dy = ball.y - nearY;
            const distSq = dx * dx + dy * dy;

            if (distSq > BALL_RADIUS * BALL_RADIUS) continue;

            // Determine bounce axis
            const overlapLeft   = ball.x - bLeft;
            const overlapRight  = bRight - ball.x;
            const overlapTop    = ball.y - bTop;
            const overlapBottom = bBottom - ball.y;

            const minH = Math.min(overlapLeft, overlapRight);
            const minV = Math.min(overlapTop, overlapBottom);

            if (minH < minV) {
                ball.vx = -ball.vx;
            } else {
                ball.vy = -ball.vy;
            }

            // Speed up
            const spd = Math.min(
                Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) + BALL_SPEED_INC,
                BALL_SPEED_MAX
            );
            const angle = Math.atan2(ball.vy, ball.vx);
            ball.vx = Math.cos(angle) * spd;
            ball.vy = Math.sin(angle) * spd;
            ball.speed = spd;

            // Hit brick
            brick.hp--;
            if (brick.hp <= 0) {
                this._destroyBrick(brick);
            } else {
                this._drawBrickGraphic(brick.gfx, brick.hp, brick.color);
                playBrickHit();
            }

            break; // one collision per frame per ball
        }
    }

    _destroyBrick(brick) {
        brick.alive = false;
        brick.gfx.destroy();
        this._bricksBroken++;

        playBrickDestroy();
        this._spawnParticles(brick.x, brick.y, brick.color, PARTICLE_COUNT_BRICK);

        // Screen shake — intensity scales with brick HP tier
        const shakeMag = 0.004 + 0.003 * (brick.maxHp - 1);
        this.cameras.main.shake(120, shakeMag);

        // Score
        const pts = brick.maxHp * 10;
        state.addScore(pts);

        events.emit('brickDestroyed', brick.x, brick.y, brick.color);

        // Combo jingle
        if (state.combo > 0 && state.combo % 4 === 0) playComboJingle();

        // Powerup drop
        if (Math.random() < POWERUP_CHANCE) {
            this._dropPowerup(brick.x, brick.y);
        }

        // Level complete?
        if (this._bricksBroken >= this._totalBricks) {
            events.emit('levelComplete');
        }
    }

    // --------------------------------------------------------
    // Lasers (laser paddle powerup)
    // --------------------------------------------------------

    _fireLaser() {
        if (this._laserCooldown > 0) return;
        this._laserCooldown = 0.25;
        playLaser();

        for (const xOff of [-this._paddleW / 4, this._paddleW / 4]) {
            const g = this.add.graphics();
            g.fillStyle(toHexInt(COLORS.danger), 1);
            g.fillRect(-2, -12, 4, 24);
            g.lineStyle(1, 0xff8888, 0.5);
            g.strokeRect(-3, -14, 6, 28);
            g.x = this._paddleX + xOff;
            g.y = this._paddleY - PADDLE_HEIGHT;
            this._lasers.push({ gfx: g, x: g.x, y: g.y, vy: -900, alive: true });
        }
    }

    _updateLasers(dt) {
        if (this._laserCooldown > 0) this._laserCooldown -= dt;

        for (const laser of this._lasers) {
            if (!laser.alive) continue;
            laser.y += laser.vy * dt;
            laser.gfx.y = laser.y;

            if (laser.y < -20) { laser.alive = false; laser.gfx.destroy(); continue; }

            // Brick check
            for (const brick of this._bricks) {
                if (!brick.alive) continue;
                if (laser.x >= brick.bounds.x && laser.x <= brick.bounds.x + brick.bounds.width &&
                    laser.y >= brick.bounds.y && laser.y <= brick.bounds.y + brick.bounds.height) {
                    brick.hp--;
                    if (brick.hp <= 0) this._destroyBrick(brick);
                    else { this._drawBrickGraphic(brick.gfx, brick.hp, brick.color); playBrickHit(); }
                    laser.alive = false;
                    laser.gfx.destroy();
                    break;
                }
            }
        }
        this._lasers = this._lasers.filter(l => l.alive);
    }

    // --------------------------------------------------------
    // Powerups
    // --------------------------------------------------------

    _dropPowerup(x, y) {
        const type  = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        const color = POWERUP_COLORS[type];

        const g = this.add.graphics();
        g.fillStyle(color, 0.9);
        g.fillRoundedRect(-14, -14, 28, 28, 4);
        g.lineStyle(2, 0xffffff, 0.5);
        g.strokeRoundedRect(-14, -14, 28, 28, 4);

        const label = this.add.text(0, 0, type[0].toUpperCase(), {
            fontSize: '13px',
            fontFamily: 'monospace',
            color: '#ffffff',
        }).setOrigin(0.5, 0.5);

        const container = this.add.container(x, y, [g, label]);

        this._powerups.push({
            container,
            x, y: y,
            type,
            alive: true,
        });
    }

    _updatePowerups(dt) {
        for (const pu of this._powerups) {
            if (!pu.alive) continue;
            pu.y += POWERUP_FALL_SPD * dt;
            pu.container.y = pu.y;

            // Collect check
            if (pu.y + 14 >= this._paddleY - PADDLE_HEIGHT / 2 &&
                pu.y - 14 <= this._paddleY + PADDLE_HEIGHT / 2 &&
                pu.container.x >= this._paddleX - this._paddleW / 2 - 14 &&
                pu.container.x <= this._paddleX + this._paddleW / 2 + 14) {
                this._collectPowerup(pu);
            }

            if (pu.y > GAME_HEIGHT + 20) { pu.alive = false; pu.container.destroy(); }
        }
        this._powerups = this._powerups.filter(p => p.alive);
    }

    _collectPowerup(pu) {
        pu.alive = false;
        pu.container.destroy();
        playPowerupCollect();
        state.addScore(50);
        events.emit('powerupCollected', pu.type);
        this._spawnParticles(pu.container.x, pu.y, COLORS.accent, 12);

        switch (pu.type) {
            case 'wide':
                state.activePowerups.widePaddle = true;
                this._paddleW = PADDLE_WIDTH * 1.7;
                this._widePaddleTimer = 10;
                break;
            case 'slow':
                state.activePowerups.slowBall = true;
                for (const b of this._balls) {
                    const spd = BALL_SPEED_INIT * 0.65;
                    const ang = Math.atan2(b.vy, b.vx);
                    b.vx = Math.cos(ang) * spd;
                    b.vy = Math.sin(ang) * spd;
                    b.speed = spd;
                }
                this._slowBallTimer = 8;
                break;
            case 'multiball':
                this._spawnExtraBalls();
                break;
            case 'laser':
                state.activePowerups.laserPaddle = true;
                this._laserPaddleTimer = 12;
                break;
        }
    }

    _spawnExtraBalls() {
        const existing = [...this._balls];
        for (const b of existing) {
            if (!b.alive) continue;
            const angleOff = 0.4;
            const spd = b.speed;
            const base = Math.atan2(b.vy, b.vx);
            for (const off of [-angleOff, angleOff]) {
                const a = base + off;
                const nb = this._spawnBall(b.x, b.y, null);
                nb.vx = Math.cos(a) * spd;
                nb.vy = Math.sin(a) * spd;
                nb.speed = spd;
                this._ballLaunched = true;
            }
        }
    }

    _updatePowerupTimers(dt) {
        if (this._widePaddleTimer > 0) {
            this._widePaddleTimer -= dt;
            if (this._widePaddleTimer <= 0) {
                state.activePowerups.widePaddle = false;
                this._paddleW = PADDLE_WIDTH;
            }
        }
        if (this._slowBallTimer > 0) {
            this._slowBallTimer -= dt;
            if (this._slowBallTimer <= 0) {
                state.activePowerups.slowBall = false;
            }
        }
        if (this._laserPaddleTimer > 0) {
            this._laserPaddleTimer -= dt;
            if (this._laserPaddleTimer <= 0) {
                state.activePowerups.laserPaddle = false;
            }
        }
    }

    // --------------------------------------------------------
    // Particles
    // --------------------------------------------------------

    _spawnParticles(x, y, colorArr, count) {
        const c = toHexInt(colorArr);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 220;
            const g = this.add.graphics();
            g.fillStyle(c, 1);
            const size = 2 + Math.random() * 4;
            g.fillRect(-size / 2, -size / 2, size, size);
            g.x = x;
            g.y = y;
            g.setDepth(60);

            this._particles.push({
                gfx: g,
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 40,
                life: 0.5 + Math.random() * 0.4,
                maxLife: 0.5 + Math.random() * 0.4,
                size,
                alive: true,
            });
        }
    }

    _updateParticles(dt) {
        for (const p of this._particles) {
            if (!p.alive) continue;
            p.life -= dt;
            if (p.life <= 0) { p.alive = false; p.gfx.destroy(); continue; }
            p.vy += 300 * dt;
            p.x  += p.vx * dt;
            p.y  += p.vy * dt;
            const alpha = p.life / p.maxLife;
            p.gfx.x = p.x;
            p.gfx.y = p.y;
            p.gfx.setAlpha(alpha);
        }
        this._particles = this._particles.filter(p => p.alive);
    }

    // --------------------------------------------------------
    // Events
    // --------------------------------------------------------

    _ballLost() {
        this._ballLaunched = false;
        // Spawn death burst at paddle
        this._spawnParticles(this._paddleX, PADDLE_Y, COLORS.danger, PARTICLE_COUNT_DEATH);
        playBallLost();
        state.loseLife();

        if (!state.isGameOver) {
            // Respawn ball
            this.time.delayedCall(800, () => {
                if (!state.isGameOver) {
                    this._buildBall();
                }
            });
        }
    }

    _handleGameOver() {
        // Freeze — UIScene shows overlay
        for (const b of this._balls) { b.vx = 0; b.vy = 0; }
    }

    _handleLevelComplete() {
        playLevelComplete();
        state.level++;
        // Small delay, then restart level with same score/lives
        this.time.delayedCall(1500, () => {
            events.clearAll();
            this.scene.restart();
            this.scene.get('UIScene').scene.restart();
        });
    }

    _restart() {
        events.clearAll();
        this.scene.restart();
        this.scene.get('UIScene').scene.restart();
    }

    _goToMenu() {
        events.clearAll();
        this.scene.stop('UIScene');
        this.scene.start('SplashScene');
    }

    shutdown() {
        this._offs.forEach(off => off());
    }
}
