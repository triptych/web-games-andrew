/**
 * Compatibility wrapper for Worldroot's itch.io export.
 *
 * The shared exporter lives at dev/itch/export.mjs so other games can use it:
 *   node dev/itch/export.mjs game-064
 *
 * This old command still works and keeps the existing Worldroot output names:
 *   node game-065/dev/itch.mjs
 */
import { buildItch } from '../../dev/itch/export.mjs';

await buildItch({
    gameDir: new URL('..', import.meta.url),
    outName: 'worldroot',
    title: 'Worldroot',
});
