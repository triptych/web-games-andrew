/**
 * mapui.js — the overmap's presentation layer: owns the two canvases, the
 * M toggle, and the pointer-lock dance that opening a full-screen panel in a
 * mouse-look game requires.
 *
 * Split from mapview.js (which is pure drawing) and mapstate.js (pure data) so
 * each piece stays testable on its own and main.js only has to call update()
 * and draw().
 *
 * Pointer lock is the fiddly part. The full map wants the cursor back so it can
 * be read comfortably, but releasing lock fires `pointerlockchange`, which
 * main.js otherwise reads as "the player pressed Esc" and answers with the
 * click-to-resume hint — stacked on top of the map. So opening the map sets a
 * flag that main.js consults, and closing it re-requests lock only if the map
 * is what released it.
 */

import { MapView } from './mapview.js';
import { events } from '../events.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';

// Minimap crop half-width in world units: close enough that the ~150px canvas
// shows individual cells and the player's own trail, wide enough to see the
// next ridge over.
const MINI_VIEW_RADIUS = 78;

export class MapUI {
    /**
     * @param mapState MapState
     * @param camera   FirstPersonCamera (position + facing for the marker)
     */
    constructor(mapState, camera) {
        this.map = mapState;
        this.camera = camera;
        this.view = new MapView(mapState);
        this.isOpen = false;
        // True while the map is the reason pointer lock is off, so main.js can
        // tell an intentional release from the player hitting Esc.
        this.suppressLockHint = false;

        this.$full = document.getElementById('map-panel');
        this.$fullCanvas = document.getElementById('map-canvas');
        this.$mini = document.getElementById('minimap-canvas');
        this.$progress = document.getElementById('map-progress');

        this._fullCtx = this.$fullCanvas ? this.$fullCanvas.getContext('2d') : null;
        this._miniCtx = this.$mini ? this.$mini.getContext('2d') : null;

        this._resize();
        window.addEventListener('resize', () => this._resize());

        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyM') {
                e.preventDefault();
                this.toggle();
            } else if (e.code === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        events.on('mapExplored', ({ fraction }) => {
            if (this.$progress) {
                this.$progress.textContent = Math.round(fraction * 100) + '% charted';
            }
        });
        events.on('mapAnnotation', ({ label }) => showToast(label));
    }

    /**
     * Size both canvases to their CSS box times devicePixelRatio, so the map's
     * 1px grid lines and 10px labels stay crisp on a HiDPI display instead of
     * being upscaled from a CSS-pixel backing store. The context is scaled to
     * match, letting draw() work in CSS pixels throughout.
     */
    _resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (const [canvas, ctx] of [[this.$fullCanvas, this._fullCtx], [this.$mini, this._miniCtx]]) {
            if (!canvas || !ctx) continue;
            const rect = canvas.getBoundingClientRect();
            // A display:none panel measures 0x0; fall back to the attribute size
            // so the first open is not drawn into a zero-sized buffer.
            const cssW = rect.width || canvas.clientWidth || 640;
            const cssH = rect.height || canvas.clientHeight || 640;
            canvas.width = Math.round(cssW * dpr);
            canvas.height = Math.round(cssH * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            canvas._cssW = cssW;
            canvas._cssH = cssH;
        }
    }

    toggle() {
        if (this.isOpen) this.close(); else this.open();
    }

    open() {
        if (this.isOpen || state.isComplete) return;
        this.isOpen = true;
        this.suppressLockHint = true;
        if (this.$full) this.$full.classList.remove('hidden');
        // The panel was display:none until now, so it had no measurable box;
        // size the canvas to the real one before the first draw.
        this._resize();
        this.camera.exitLock();
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        if (this.$full) this.$full.classList.add('hidden');
        // Re-lock so the player walks away from the map without an extra click.
        // The flag stays set across this call: the exitLock above and the
        // requestLock here both fire pointerlockchange, and clearing it first
        // would flash the resume hint for a frame.
        this.camera.requestLock();
        this.suppressLockHint = false;
    }

    /** Reveal cells / spot annotations from the player's current position. */
    update(playerPos) {
        this.map.update(playerPos);
    }

    /**
     * Redraw whichever presentation is showing. The full map replaces the
     * minimap rather than drawing both — the corner copy is redundant while the
     * whole island is on screen, and skipping it halves the draw cost on the
     * frames where the expensive labelled version is up.
     */
    draw() {
        if (this.isOpen) {
            if (this.$mini) this.$mini.classList.add('hidden');
            if (this._fullCtx) {
                this.view.draw(
                    this._fullCtx, this.$fullCanvas._cssW, this.$fullCanvas._cssH,
                    this.camera, { mode: 'full' },
                );
            }
        } else {
            if (this.$mini) this.$mini.classList.remove('hidden');
            if (this._miniCtx) {
                this.view.draw(
                    this._miniCtx, this.$mini._cssW, this.$mini._cssH,
                    this.camera, { mode: 'mini', viewRadius: MINI_VIEW_RADIUS },
                );
            }
        }
    }
}
