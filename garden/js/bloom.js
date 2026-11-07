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

/**
 * Keep a stray NaN or Infinity pixel from becoming a flashing block.
 *
 * On Direct3D (Chrome on Windows) pow() of a base that rounding has pushed a hair below zero is
 * NaN, and a rim light does exactly that whenever a face lines up with the camera. One NaN pixel
 * is invisible, but the bloom's blur smears it across its whole kernel and every mip after it,
 * so for a moment a rectangle of the view goes black or white. The bloom reads the scene only in
 * its bright-pass, so that is where the pixel is dropped. The test looks at the float's exponent
 * bits, which a driver's fast-math can't optimise away the way it can x != x. Call once, after
 * creating the pass.
 */
export function scrubBloom(bloom) {
    const m = bloom.materialHighPassFilter;
    const read = 'vec4 texel = texture2D( tDiffuse, vUv );';
    if (!m.fragmentShader.includes(read)) {
        console.warn('scrubBloom: the bloom bright-pass has changed, so stray NaN pixels are not filtered');
        return bloom;
    }
    m.fragmentShader = m.fragmentShader
        .replace(read, `${read}
            // a NaN or Inf here would be smeared by the blur into a block over the view
            if ((floatBitsToUint(texel.r) & 0x7f800000u) == 0x7f800000u || (floatBitsToUint(texel.g) & 0x7f800000u) == 0x7f800000u ||
                (floatBitsToUint(texel.b) & 0x7f800000u) == 0x7f800000u || (floatBitsToUint(texel.a) & 0x7f800000u) == 0x7f800000u) texel = vec4( 0.0 );
            texel = min( texel, vec4( 60000.0 ) );`);
    m.needsUpdate = true;
    return bloom;
}
