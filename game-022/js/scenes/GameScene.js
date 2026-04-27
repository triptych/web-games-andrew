/**
 * GameScene — core game loop.
 * Handles world rendering, player, camera, depth tracking, lore triggers.
 */
import * as Phaser from '../../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { SCENE, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, WORLD_COLS, WORLD_ROWS,
         DEPTH_TIERS, COLORS } from '../config.js';
import { GameState } from '../systems/GameState.js';
import { Player } from '../systems/Player.js';
import { TileRenderer } from '../systems/TileRenderer.js';
import * as InputManager from '../systems/InputManager.js';
import { setAmbientTier, playUiClick, initAudio } from '../systems/SoundManager.js';
import { LORE_MILESTONES, SINGING_VEIN_DISCOVERY } from '../data/lore.js';
import { DEPTH_TIERS as DT } from '../config.js';

export class GameScene extends Phaser.Scene {
    constructor() { super({ key: SCENE.GAME }); }

    create() {
        initAudio();
        GameState.stats.totalRuns = (GameState.stats.totalRuns || 0) + 1;

        const world        = this.registry.get('world');
        const exploredTiles = this.registry.get('exploredTiles');

        // Background gradient graphics (behind tiles)
        this._bgGfx = this.add.graphics().setDepth(-1).setScrollFactor(0);

        // Tile renderer
        this._tileRenderer = new TileRenderer(this, world, exploredTiles);
        this._tileRenderer.setLightRadius(GameState.derived.lightRadius);

        // Player
        this._player = new Player(this, world, exploredTiles);
        this._player.onAtBase      = () => this._onAtBase();
        this._player.onGameOver    = () => this._onGameOver();
        this._player.onDepthChanged = (d) => this._onDepthChanged(d);
        this._player.onSingingVeinFound = () => this._onSingingVeinFound();

        // Camera
        const worldH = WORLD_ROWS * TILE_SIZE;
        const worldW = WORLD_COLS * TILE_SIZE;
        // Extend top bound so the camera can center on the surface without clamping
        const camTopPad = Math.ceil(GAME_HEIGHT / 2);
        this.cameras.main.setBounds(0, -camTopPad, worldW, worldH + camTopPad);
        this.cameras.main.startFollow(
            { x: this._player.pixelX, y: this._player.pixelY },
            true, 0.12, 0.12
        );
        this._followTarget = { x: this._player.pixelX, y: this._player.pixelY };

        // Input
        InputManager.init(this);
        this._pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
        this._escKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this._useKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // State
        this._paused = false;
        this._atBase = false;
        this._lastDepth = 0;
        this._ambientTier = -1;

        // Draw initial background
        this._drawBackground(0);

        // Start UI overlay
        if (!this.scene.isActive(SCENE.UI)) {
            this.scene.launch(SCENE.UI);
        }
    }

    update(_, delta) {
        if (this._paused) return;
        const dt = delta / 1000;

        // Check pause
        if (Phaser.Input.Keyboard.JustDown(this._pauseKey) ||
            Phaser.Input.Keyboard.JustDown(this._escKey)) {
            this._togglePause();
            return;
        }

        // Refresh input
        InputManager.resetDPad();
        InputManager.update();

        // Use consumable
        if (Phaser.Input.Keyboard.JustDown(this._useKey) || InputManager.actions.use) {
            this._useConsumable();
        }

        // Update player
        this._player.update(dt, InputManager.actions);

        // Update tile renderer
        const camX = this.cameras.main.scrollX;
        const camY = this.cameras.main.scrollY;
        this._tileRenderer.setLightRadius(GameState.derived.lightRadius);
        this._tileRenderer.update(dt, this._player.tileCol, this._player.tileRow, camX, camY);

        // Smooth camera follow
        this._followTarget.x = this._player.pixelX;
        this._followTarget.y = this._player.pixelY;
        this.cameras.main.startFollow(this._followTarget, true, 0.12, 0.12);

        // Ambient tier
        const tier = DT.findIndex(t => this._player.tileRow <= t.rowEnd);
        const tierIdx = tier >= 0 ? tier : DT.length - 1;
        if (tierIdx !== this._ambientTier) {
            this._ambientTier = tierIdx;
            setAmbientTier(tierIdx);
        }
        // Redraw gradient every frame so it smoothly tracks camera scroll
        this._drawBackground(camY);
    }

    _drawBackground(camY) {
        const g = this._bgGfx;
        g.clear();

        // Determine which tier the camera top and bottom are in, then lerp
        const topRow    = Math.max(0, Math.floor(camY / TILE_SIZE));
        const botRow    = topRow + Math.ceil(GAME_HEIGHT / TILE_SIZE);
        const _topIdx = DT.findIndex(t => topRow <= t.rowEnd);
        const _botIdx = DT.findIndex(t => botRow <= t.rowEnd);
        const ti = _topIdx >= 0 ? _topIdx : DT.length - 1;
        const bi = _botIdx >= 0 ? _botIdx : DT.length - 1;

        const topColor = DT[ti].bgTop;
        const botColor = DT[bi].bgBot;

        // Draw a vertical gradient by stepping through GAME_HEIGHT in bands
        const steps = 12;
        const bandH = Math.ceil(GAME_HEIGHT / steps);
        for (let s = 0; s < steps; s++) {
            const t = s / (steps - 1);
            const c = lerpColor(topColor, botColor, t);
            g.fillStyle(c, 1);
            g.fillRect(0, s * bandH, GAME_WIDTH, bandH + 1);
        }
    }

    _togglePause() {
        this._paused = !this._paused;
        const ui = this.scene.get(SCENE.UI);
        if (ui && ui.setPaused) ui.setPaused(this._paused);
    }

    _onAtBase() {
        if (this._atBase) return;
        this._atBase = true;

        // Slight delay to avoid instantly re-triggering
        this.time.delayedCall(300, () => {
            this._atBase = false;
            this.scene.pause(SCENE.GAME);
            this.scene.launch(SCENE.BASE);
        });
    }

    _onGameOver() {
        this.scene.stop(SCENE.UI);
        this.scene.stop(SCENE.BASE);
        this.scene.start(SCENE.GAMEOVER);
    }

    _onDepthChanged(depthM) {
        if (depthM === this._lastDepth) return;
        this._lastDepth = depthM;

        // Check lore milestones
        for (const milestone of LORE_MILESTONES) {
            if (depthM >= milestone.depth && !GameState.hasUnlockedLore(milestone.depth)) {
                GameState.unlockLore(milestone.depth);
                const ui = this.scene.get(SCENE.UI);
                if (ui && ui.showLore) ui.showLore(milestone.text);
            }
        }

        // Depth record alert
        const ui = this.scene.get(SCENE.UI);
        if (depthM > GameState.stats.maxDepth && ui && ui.showAlert) {
            // Only flash every 500m
            if (Math.floor(depthM / 500) > Math.floor((depthM - 16) / 500)) {
                ui.showAlert(`NEW DEPTH: ${depthM}m`, '#00CCFF');
            }
        }

        // Cargo full warning
        if (GameState.isCargoFull() && ui && ui.showAlert) {
            if (Math.random() < 0.01) ui.showAlert('CARGO FULL', '#FF8800');
        }
    }

    _onSingingVeinFound() {
        const ui = this.scene.get(SCENE.UI);
        if (ui) {
            ui.showLore(SINGING_VEIN_DISCOVERY);
            ui.showAlert('SINGING VEIN FOUND!', '#FFFFFF');
        }
    }

    _useConsumable() {
        const c = GameState.consumables;
        const ui = this.scene.get(SCENE.UI);

        if (c.repair_kit > 0) {
            c.repair_kit--;
            GameState.repairHull(25);
            if (ui) ui.showAlert('+25 HULL', hex(COLORS.success));
            playUiClick();
            return;
        }
        if (c.recall_flare > 0) {
            this._player.useRecallFlare();
            if (ui) ui.showAlert('RECALL ACTIVATED', '#00CCFF');
            return;
        }
        if (c.tnt > 0) {
            this._player.useTNT();
            if (ui) ui.showAlert('BOOM!', '#FF8800');
            this._tileRenderer.setDirty();
            return;
        }
        if (c.seismic > 0) {
            c.seismic--;
            this._useSeismicScan();
            if (ui) ui.showAlert('SEISMIC SCAN', '#00FFCC');
            playUiClick();
            return;
        }
    }

    _useSeismicScan() {
        const col  = this._player.tileCol;
        const row  = this._player.tileRow;
        // Reveal a 40-wide, 20-tall strip centered on player column, below current position
        this._tileRenderer.seismicReveal(col, row + 1, 20, 20);
        this._tileRenderer.setDirty();
    }

    shutdown() {
        // Cleanup handled by Phaser scene lifecycle
    }
}

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

function lerpColor(a, b, t) {
    const ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF;
    const br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
}
