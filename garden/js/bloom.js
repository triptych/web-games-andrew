// Round halos for three's UnrealBloomPass. Each of its blur levels weights its
// taps by a Gaussian whose sigma is the kernel radius, but stops sampling at
// that same radius, so the weights hardly fall off at all (the outermost tap of
// the 3-tap level still weighs 80% of the centre's). That is nearly a box blur,
// and a box blur run across then down turns a small bright light into a square
// glow. Here each level gets a real Gaussian with about the same spread as
// before (sigma ~0.47 x radius, which is what the old flat kernels came to),
// sampled out to three sigma, so the halos are round and the bloom keeps its size.

/** Swap the bloom pass's blur materials for true Gaussians. Call once, after creating it. */
export function roundBloom(bloom) {
    const mats = bloom.separableBlurMaterials;
    for (let i = 0; i < mats.length; i++) {
        const old = mats[i];
        const r = old.defines.KERNEL_RADIUS;
        const sigma = r * 0.47;
        const taps = Math.ceil(sigma * 3) + 1;
        const m = bloom.getSeperableBlurMaterial(taps);
        const w = m.uniforms.gaussianCoefficients.value;
        for (let k = 0; k < taps; k++) w[k] = Math.exp((-0.5 * k * k) / (sigma * sigma));
        m.uniforms.invSize.value.copy(old.uniforms.invSize.value);
        mats[i] = m;
        old.dispose();
    }
    return bloom;
}
