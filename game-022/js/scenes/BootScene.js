import * as Phaser from '../../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
import { SCENE } from '../config.js';

export class BootScene extends Phaser.Scene {
    constructor() { super({ key: SCENE.BOOT }); }

    preload() {
        // No assets to load — all graphics are procedural
    }

    create() {
        this.scene.start(SCENE.PRELOAD);
    }
}
