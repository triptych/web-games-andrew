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
import { inventory } from './inventory.js';
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

    /**
     * Geometry for the Nth book on the library shelves. Pure function of the
     * slot index and the anchor — no RNG — because the save stores only a count
     * and rebuildDisplays() has to reproduce the exact same arrangement on load.
     * The jitter that used to come from this.rng() is derived from the slot
     * instead, so it still looks hand-placed but is reproducible.
     */
    _bookSlot(slot, anchor) {
        // Five shelves in a row, filling left to right then up a tier.
        const shelfIndex = slot % 5;
        const tier = Math.floor(slot / 5);
        const colors = [[176, 40, 40], [40, 76, 150], [150, 120, 30], [70, 110, 60]];
        // Deterministic pseudo-jitter: fractional part of an irrational multiple
        // of the slot index, mapped to -0.5..0.5.
        const j1 = ((slot * 0.7548776662) % 1) - 0.5;
        const j2 = ((slot * 0.5698402909) % 1) - 0.5;
        return {
            site: 'library',
            mesh: buildBox(0.22, 0.32, 0.14, colors[slot % colors.length]),
            pos: [
                anchor.x - 4 + shelfIndex * 2 + j1 * 0.4,
                anchor.y + 0.45 + tier * 0.5,
                // Shelves are placed by chunk.js at -d/2 + 1.2 (library d = 9),
                // nudged forward so the books sit on the shelf face, not in it.
                anchor.z - 3.3 + 0.2,
            ],
            rotY: j2 * 0.3,
            scale: 1,
        };
    }

    /** As _bookSlot, for the museum's ring of pedestals. Also RNG-free. */
    _artifactSlot(slot, anchor) {
        // Match the ring of pedestals placed by chunk.js.
        const a = (slot % 6) / 6 * Math.PI * 2;
        const t = (slot * 0.7548776662) % 1;
        const gold = [206, 176, 96];
        // buildBlob wants an rng; give it a seeded one per slot so the shape is
        // stable across a save/load rather than depending on deposit order.
        const blobRng = makeRng(4400 + slot);
        const mesh = t < 0.33
            ? buildCylinder(0.14, 0.05, 8, gold, true, true)
            : (t < 0.66 ? buildBlob(0.18, 0, gold, 0.2, blobRng) : buildCone(0.14, 0.34, 6, gold));
        return {
            site: 'museum',
            mesh,
            pos: [
                anchor.x + Math.cos(a) * 4.2,
                anchor.y + 1.25,
                anchor.z + Math.sin(a) * 3.2,
            ],
            rotY: ((slot * 0.5698402909) % 1) * Math.PI * 2,
            scale: 1,
        };
    }

    _depositBooks(anchor) {
        const returned = inventory.takeAll('book');
        if (returned.length === 0) return;

        for (let i = 0; i < returned.length; i++) {
            this.shelvedBooks.push(this._bookSlot(this.shelvedBooks.length, anchor));
        }
        state.depositBooks();
        playDeposit();
        events.emit('itemsDeposited', { kind: 'book', items: returned });
        const n = returned.length;
        // Name it when there is one, count them when there are several: "Shelved
        // Cave Songs" is a better sentence than "Shelved 1 book".
        const what = n === 1 ? returned[0].name : `${n} books`;
        showToast(`📚 Shelved ${what} — ${state.booksShelved} / ${state.booksTotal}`);
    }

    _depositArtifacts(anchor) {
        const returned = inventory.takeAll('artifact');
        if (returned.length === 0) return;

        for (let i = 0; i < returned.length; i++) {
            this.displayedArtifacts.push(this._artifactSlot(this.displayedArtifacts.length, anchor));
        }
        state.depositArtifacts();
        playDeposit();
        events.emit('itemsDeposited', { kind: 'artifact', items: returned });
        const n = returned.length;
        const what = n === 1 ? returned[0].name : `${n} artifacts`;
        showToast(`🏛️ Displayed ${what} — ${state.artifactsDisplayed} / ${state.artifactsTotal}`);
    }

    /**
     * Recreate the shelf and pedestal geometry for a loaded save.
     *
     * Called with just the two counts, since the slot builders are deterministic
     * — slot N always produces the same book in the same place.
     *
     * `playerPos` seeds the inside/outside flags. update() deposits on the
     * *transition* into a site's radius, and a freshly loaded game starts with
     * both flags false — so without this, a player who saved while standing in
     * the library would have their pack emptied by the first frame after loading.
     */
    rebuildDisplays(bookCount, artifactCount, playerPos) {
        const { library, museum } = this._anchors();
        this.shelvedBooks = [];
        this.displayedArtifacts = [];
        if (library) {
            for (let i = 0; i < bookCount; i++) this.shelvedBooks.push(this._bookSlot(i, library));
        }
        if (museum) {
            for (let i = 0; i < artifactCount; i++) this.displayedArtifacts.push(this._artifactSlot(i, museum));
        }
        if (playerPos) {
            if (library) this._insideLibrary = Math.hypot(library.x - playerPos[0], library.z - playerPos[2]) < DEPOSIT_RADIUS;
            if (museum) this._insideMuseum = Math.hypot(museum.x - playerPos[0], museum.z - playerPos[2]) < DEPOSIT_RADIUS;
        }
    }

    /** Deposited items as renderer instances. */
    getInstances() {
        return [...this.shelvedBooks, ...this.displayedArtifacts];
    }

    /**
     * Whether a deposited instance belongs in `type`'s building. Interiors render
     * exclusively, so main.js submits only the items that live in the room the
     * player is actually standing in.
     */
    instanceBelongsTo(inst, type) {
        return inst.site === type;
    }
}
