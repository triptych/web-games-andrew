/** Replace UnrealBloomPass's nearly box-shaped separable blur kernels with true Gaussians. */
export function roundBloom(bloom) {
    const mats = bloom.separableBlurMaterials;
    for (let i = 0; i < mats.length; i++) {
        const old = mats[i];
        const radius = old.defines.KERNEL_RADIUS;
        const sigma = radius * 0.47;
        const taps = Math.ceil(sigma * 3) + 1;
        const material = bloom.getSeperableBlurMaterial(taps);
        const weights = material.uniforms.gaussianCoefficients.value;
        for (let k = 0; k < taps; k++) weights[k] = Math.exp((-0.5 * k * k) / (sigma * sigma));
        material.uniforms.invSize.value.copy(old.uniforms.invSize.value);
        mats[i] = material;
        old.dispose();
    }
    return bloom;
}
