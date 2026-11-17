// Paints material textures off the main thread (js/view/textures.js sends the jobs). The buffers go back transferred,
// not copied.
import { bake } from './paint.js';

self.onmessage = (e) => {
    const { id, name, size } = e.data;
    const { albedo, normal, hgt } = bake(name, size);
    self.postMessage({ id, albedo, normal, hgt }, [albedo.buffer, normal.buffer, hgt.buffer]);
};
