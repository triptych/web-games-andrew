/**
 * collections.js — the library and museum "deposit" mechanic.
 *
 * Items found out on the island are carried until the player walks into the
 * relevant building, at which point they're deposited: books appear on the
 * library shelves, artifacts on the museum pedestals. Deposited items become
 * permanent world geometry, so the buildings visibly fill up as the player
 * completes each collection — that progress *is* the reward, so it needs to
 * be visible in the world and not only in the HUD.
 */

import { buildBox, buildBlob, buildCylinder, buildCone } from '../engine/mesh.js';
import { makeRng } from '../world/noise.js';
import { events } from '../events.js';
import { state } from '../state.js';
import { playDeposit } from '../sounds.js';
import { showToast } from '../ui.js';

const DEPOSIT_RADIUS = 7;

export class CollectionSites {
    /**
     * @param world      World instance (for landmark anchors + heightmap)
     * @param itemManager ItemManager, source of carried-item counts
     */
    constructor(world, itemManager) {
        this.world = world;
        this.itemManager = itemManager;
        this.rng = makeRng(1337);

        // Deposited display meshes, rebuilt as items arrive.
        this.shelvedBooks = [];   // library
        this.displayedArtifacts = []; // museum

        this._libraryAnchor = null;
        this._museumAnchor = null;
        this._insideLibrary = false;
        this._insideMuseum = false;
    }

    /**
     * Landmark anchors only exist once their chunk has been generated, so resolve
     * them lazily rather than in the constructor.
     */
    _anchors() {
        const pts = this.world.regionMap.points;
        if (!this._libraryAnchor) {
            const p = pts.find(pt => pt.type === 'library');
            if (p) this._libraryAnchor = { x: p.x, z: p.z, y: this.world.heightmap.heightAt(p.x, p.z) };
        }
        if (!this._museumAnchor) {
            const p = pts.find(pt => pt.type === 'museum');
            if (p) this._museumAnchor = { x: p.x, z: p.z, y: this.world.heightmap.heightAt(p.x, p.z) };
        }
        return { library: this._libraryAnchor, museum: this._museumAnchor };
    }

    update(playerPos) {
        const { library, museum } = this._anchors();

        if (library) {
            const d = Math.hypot(library.x - playerPos[0], library.z - playerPos[2]);
            const inside = d < DEPOSIT_RADIUS;
            if (inside && !this._insideLibrary) this._depositBooks(library);
            this._insideLibrary = inside;
        }
        if (museum) {
            const d = Math.hypot(museum.x - playerPos[0], museum.z - playerPos[2]);
            const inside = d < DEPOSIT_RADIUS;
            if (inside && !this._insideMuseum) this._depositArtifacts(museum);
            this._insideMuseum = inside;
        }
    }

    _depositBooks(anchor) {
        const carried = state.carriedBooks;
        if (carried === 0) return;

        for (let i = 0; i < carried; i++) {
            const slot = this.shelvedBooks.length;
            // Five shelves in a row, filling left to right then up a tier.
            const shelfIndex = slot % 5;
            const tier = Math.floor(slot / 5);
            const colors = [[176, 40, 40], [40, 76, 150], [150, 120, 30], [70, 110, 60]];
            this.shelvedBooks.push({
                mesh: buildBox(0.22, 0.32, 0.14, colors[slot % colors.length]),
                pos: [
                    anchor.x - 4 + shelfIndex * 2 + (this.rng() - 0.5) * 0.4,
                    anchor.y + 0.45 + tier * 0.5,
                    anchor.z - 3.5,
                ],
                rotY: (this.rng() - 0.5) * 0.3,
                scale: 1,
            });
        }
        state.depositBooks();
        playDeposit();
        showToast(`📚 Shelved ${carried} book${carried > 1 ? 's' : ''} — ${state.booksShelved} / ${state.booksTotal}`);
    }

    _depositArtifacts(anchor) {
        const carried = state.carriedArtifacts;
        if (carried === 0) return;

        for (let i = 0; i < carried; i++) {
            const slot = this.displayedArtifacts.length;
            // Match the ring of pedestals placed by chunk.js.
            const a = (slot % 6) / 6 * Math.PI * 2;
            const t = this.rng();
            const gold = [206, 176, 96];
            const mesh = t < 0.33
                ? buildCylinder(0.14, 0.05, 8, gold, true, true)
                : (t < 0.66 ? buildBlob(0.18, 0, gold, 0.2, this.rng) : buildCone(0.14, 0.34, 6, gold));
            this.displayedArtifacts.push({
                mesh,
                pos: [
                    anchor.x + Math.cos(a) * 4.2,
                    anchor.y + 1.25,
                    anchor.z + Math.sin(a) * 3.2,
                ],
                rotY: this.rng() * Math.PI * 2,
                scale: 1,
            });
        }
        state.depositArtifacts();
        playDeposit();
        showToast(`🏛️ Displayed ${carried} artifact${carried > 1 ? 's' : ''} — ${state.artifactsDisplayed} / ${state.artifactsTotal}`);
    }

    /** Deposited items as renderer instances. */
    getInstances() {
        return [...this.shelvedBooks, ...this.displayedArtifacts];
    }
}
