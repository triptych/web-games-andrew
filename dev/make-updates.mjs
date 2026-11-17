#!/usr/bin/env node
// Writes js/updates.json: when each game was added and when its version last
// changed, read from the git history of js/gamedata.js. Pocket Garden's
// "Recently Updated" menu sorts by it.
//
//   node dev/make-updates.mjs            write js/updates.json
//   node dev/make-updates.mjs --check    print the 15 most recent, write nothing
//
// It walks the first-parent history of the current branch, so on main each
// date is the day the change was merged (published), not the day it was
// written. The Pages deploy runs it on every push to main, so the live file
// is never stale; the copy in the repo is only a fallback for local servers.
//
// Needs the full history (a shallow clone only knows its last commit; run
// `git fetch --unshallow --filter=blob:none origin` first). A partial clone
// is fine: the old copies of gamedata.js are fetched in one batch.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = 'js/gamedata.js';
const OUT = join(ROOT, 'js/updates.json');
const check = process.argv.includes('--check');

const git = (args, opts = {}) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30, ...opts });

if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
    console.error('make-updates: this is a shallow clone, so the dates would all be today. Run: git fetch --unshallow --filter=blob:none origin');
    process.exit(1);
}

// oldest first: "<commit> <ISO date>"
const commits = git(['log', '--first-parent', '--reverse', '--format=%H %cI', '--', FILE])
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
        const [sha, date] = line.split(' ');
        return { sha, date };
    });

// the blob each commit holds for the file
const blobs = git(['rev-parse', ...commits.map((c) => `${c.sha}:${FILE}`)]).trim().split('\n');
// In a partial clone the old blobs aren't local yet: fetch them all in one
// go rather than one lazy round trip per commit.
let promisor = '';
try {
    promisor = git(['config', '--get', 'remote.origin.promisor']).trim();
} catch {
    /* not a partial clone */
}
if (promisor === 'true') {
    git(['-c', 'fetch.negotiationAlgorithm=noop', 'fetch', 'origin', '--no-tags', '--no-write-fetch-head', '--recurse-submodules=no', '--filter=blob:none', '--stdin'], {
        input: [...new Set(blobs)].join('\n') + '\n',
        stdio: ['pipe', 'ignore', 'inherit'],
    });
}

/** { 'game-001': '1.3.0', … } from one copy of gamedata.js (version is '' when it had none). */
function versionsOf(src) {
    const out = {};
    // each entry starts at its id; its version is the first one before the next id
    const parts = src.split(/\bid:\s*['"](game-\d+)['"]/);
    for (let i = 1; i < parts.length; i += 2) {
        const v = parts[i + 1].match(/\bversion:\s*['"]([^'"]+)['"]/);
        out[parts[i]] = v ? v[1] : '';
    }
    return out;
}

const games = {};
let prev = {};
for (let i = 0; i < commits.length; i++) {
    const { date } = commits[i];
    const now = versionsOf(git(['cat-file', 'blob', blobs[i]]));
    for (const [id, version] of Object.entries(now)) {
        if (!(id in prev)) {
            // first listed (or listed again after being dropped): counts as added
            games[id] = { added: games[id]?.added ?? date, updated: date, version };
        } else if (prev[id] !== version) {
            games[id] = { ...games[id], updated: date, version };
        }
    }
    prev = now;
}
// only games still listed, with today's versions
for (const id of Object.keys(games)) if (!(id in prev)) delete games[id];

const sorted = Object.entries(games).sort((a, b) => b[1].updated.localeCompare(a[1].updated) || b[0].localeCompare(a[0]));

if (check) {
    for (const [id, g] of sorted.slice(0, 15)) console.log(`${g.updated.slice(0, 10)}  ${id}  v${g.version}${g.added === g.updated ? '  (new)' : ''}`);
    console.log(`${sorted.length} games from ${commits.length} commits`);
    process.exit(0);
}

const body = sorted.map(([id, g]) => `    ${JSON.stringify(id)}: ${JSON.stringify(g)}`).join(',\n');
writeFileSync(OUT, `{\n  "generated": ${JSON.stringify(new Date().toISOString())},\n  "games": {\n${body}\n  }\n}\n`);
console.log(`make-updates: wrote ${sorted.length} games from ${commits.length} commits to js/updates.json`);
