/**
 * fake-three-addons.mjs — EffectComposer / RenderPass / UnrealBloomPass stubs
 * for the Node harnesses. They check the same invariants the real ones rely on:
 * a composer must be given a renderer, and it must be resized when the canvas is.
 */

export class RenderPass {
    constructor(scene, camera) {
        if (!scene || !camera) throw new Error('[fake-three] RenderPass needs a scene and a camera');
        this.scene = scene;
        this.camera = camera;
    }
    setSize() {}
}

export class UnrealBloomPass {
    constructor(resolution, strength, radius, threshold) {
        if (!resolution || !Number.isFinite(resolution.x)) throw new Error('[fake-three] UnrealBloomPass needs a Vector2 resolution');
        for (const [name, v] of [['strength', strength], ['radius', radius], ['threshold', threshold]]) {
            if (!Number.isFinite(v)) throw new Error(`[fake-three] UnrealBloomPass ${name} = ${v}`);
        }
        this.resolution = resolution;
        this.strength = strength;
        this.radius = radius;
        this.threshold = threshold;
        this.sized = 0;
    }
    setSize(w, h) { this.sized++; this.width = w; this.height = h; }
}

export class EffectComposer {
    constructor(renderer) {
        if (!renderer) throw new Error('[fake-three] EffectComposer without a renderer');
        this.renderer = renderer;
        this.passes = [];
        this.renders = 0;
        this.sized = 0;
    }
    addPass(pass) {
        if (!pass) throw new Error('[fake-three] addPass(undefined)');
        this.passes.push(pass);
    }
    setSize(w, h) {
        this.sized++;
        for (const p of this.passes) p.setSize?.(w, h);
    }
    render() {
        const rp = this.passes.find((p) => p instanceof RenderPass);
        if (!rp) throw new Error('[fake-three] composer.render() with no RenderPass');
        this.renders++;
        return this.renderer.render(rp.scene, rp.camera);
    }
}
