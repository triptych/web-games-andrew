/**
 * hooks.mjs — Node module-resolution hooks that point `import 'three'` and
 * `import 'three/addons/...'` at the fakes in this folder.
 *
 * Used as: register('./hooks.mjs', import.meta.url) before importing any view
 * module. This is how the harnesses exercise the REAL rendering code without a
 * browser or a network fetch of three.js.
 */

export async function resolve(specifier, context, next) {
    if (specifier === 'three') {
        return { url: new URL('./fake-three.mjs', import.meta.url).href, shortCircuit: true };
    }
    if (specifier.startsWith('three/addons/')) {
        return { url: new URL('./fake-three-addons.mjs', import.meta.url).href, shortCircuit: true };
    }
    return next(specifier, context);
}
