/**
 * The scene registry. Each scene module exports a plain object; cottage.js is
 * the simplest complete example of the shape:
 *
 *   id, name, ambience          identity and sound bed
 *   scale: [yFar, sFar, yNear, sNear]   perspective scaling for Rowan
 *   entries: { fromSceneId: [x, y, facing], default: [...] }
 *   bgKey(S)                    string of the flags the picture depends on
 *   paint(g, S, R)              the background, painted once then dithered
 *   paintFg?(g, S, R)           an overlay drawn in front of Rowan
 *   walk(S)                     { areas: [poly...], blockers: [poly...] }
 *   actors?(S, t, A, speaker)   depth-sorted characters drawn each frame
 *   overlay?(g, S, t, A)        per-frame effects (fire, snow, glints)
 *   look                        what "Look" says about empty space
 *   hotspots                    array (or fn of S) of clickable things
 *   enter?(G, firstVisit)       script run on arrival
 */

import cottage from './cottage.js';
import green from './green.js';
import bridge from './bridge.js';
import pines from './pines.js';
import hut from './hut.js';
import gate from './gate.js';
import cavern from './cavern.js';
import library from './library.js';
import tower from './tower.js';
import sanctum from './sanctum.js';

export const SCENES = { cottage, green, bridge, pines, hut, gate, cavern, library, tower, sanctum };
