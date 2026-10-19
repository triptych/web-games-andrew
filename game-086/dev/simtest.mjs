import assert from 'node:assert/strict';
import {ARTWORKS,PALETTE} from '../js/artworks.js';
import {blankProgress,normalizeProgress,isComplete,completionCount} from '../js/coloring.js';
const p=blankProgress(ARTWORKS);assert.equal(p.version,1);assert.equal(completionCount(ARTWORKS,p),0);
for(const art of ARTWORKS){assert.ok(art.regions.length>=8,`${art.id} has colorable regions`);assert.equal(isComplete(art,p.fills[art.id]),false);for(const region of art.regions){assert.ok(region.d.startsWith('M'),`${art.id}/${region.id} is a path`);p.fills[art.id][region.id]='#b9a4f5'}assert.equal(isComplete(art,p.fills[art.id]),true);p.collected.push(art.id)}
assert.equal(completionCount(ARTWORKS,p),ARTWORKS.length);assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(p)),ARTWORKS),p);
const hostile=normalizeProgress({version:1,fills:{starship:{hull:'url(evil)',window:'#abcdef',unknown:'#123456'}},collected:['starship','not-real']},ARTWORKS);assert.equal(hostile.fills.starship.hull,undefined);assert.equal(hostile.fills.starship.window,'#abcdef');assert.deepEqual(hostile.collected,['starship']);assert.equal(normalizeProgress({version:99},ARTWORKS).collected.length,0);assert.ok(PALETTE.length>=10);
console.log(`Colorverse simtest: passed — ${ARTWORKS.length} artworks, ${ARTWORKS.reduce((n,a)=>n+a.regions.length,0)} regions, save validation and collection rules.`);
