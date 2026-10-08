/**
 * terrain-worker.js — generates the height field off the main thread so the loading
 * screen stays alive. Posts progress, then the terrain's buffers (transferred, not copied).
 */
import { Terrain, serializeTerrain, transferList } from './sim/terrain.js';

self.onmessage = () => {
    const t = new Terrain().generate((p) => self.postMessage({ progress: p }));
    const data = serializeTerrain(t);
    self.postMessage({ done: true, data }, transferList(data));
};
