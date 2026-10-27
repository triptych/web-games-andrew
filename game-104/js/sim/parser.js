// Turns a typed line into { verb, a, b, text }: a canonical verb and up to two noun phrases.
// Sierra-style two-word English: "take the salve", "use salve on bryony", "ask moll about marga".
// Pure: no state. Resolving nouns against the room is the engine's job (game.js).

export const DIRS = {
    n: 'n', north: 'n', s: 's', south: 's', e: 'e', east: 'e', w: 'w', west: 'w',
    ne: 'ne', northeast: 'ne', nw: 'nw', northwest: 'nw', se: 'se', southeast: 'se', sw: 'sw', southwest: 'sw',
    u: 'u', up: 'u', d: 'd', down: 'd', in: 'in', inside: 'in', out: 'out', outside: 'out',
};

const ART = new Set(['the', 'a', 'an', 'my', 'some', 'that', 'this', 'please', 'of', 'your', 'her', 'his', 'their']);
const PREPS = new Set(['at', 'on', 'onto', 'in', 'into', 'inside', 'with', 'to', 'from', 'about', 'for', 'under', 'through', 'against', 'over', 'by', 'off', 'around']);
const PARTICLES = new Set(['up', 'at', 'to', 'on', 'in', 'into', 'around', 'down', 'out', 'over', 'off', 'under', 'inside']);

const V = (canon, words) => words.split(' ').map((w) => [w, canon]);
export const VERBS = Object.fromEntries([
    ...V('look', 'look l examine x inspect view check watch observe'),
    ...V('search', 'search rummage dig explore'),
    ...V('take', 'take get grab pick gather collect pluck harvest steal snatch peel tear cut carry'),
    ...V('drop', 'drop discard'),
    ...V('use', 'use apply put place pour tip drizzle rub spread tie fasten hang plug jam insert wedge stuff sprinkle dip feed'),
    ...V('cast', 'cast chant invoke conjure'),
    ...V('kindle', 'kindle'),
    ...V('brew', 'brew mix cook boil prepare concoct make simmer steep'),
    ...V('rest', 'rest sleep camp nap'),
    ...V('wait', 'wait z'),
    ...V('hide', 'hide duck crouch conceal'),
    ...V('say', 'say speak answer reply shout whisper utter sing call recite'),
    ...V('talk', 'talk chat converse greet hello hi'),
    ...V('ask', 'ask question query'),
    ...V('give', 'give hand offer'),
    ...V('show', 'show present display'),
    ...V('open', 'open unlock unbar unbolt unfasten'),
    ...V('close', 'close shut lock bar'),
    ...V('read', 'read'),
    ...V('smell', 'smell sniff'),
    ...V('taste', 'taste lick sip eat drink swallow bite chew'),
    ...V('study', 'study identify'),
    ...V('wear', 'wear don'),
    ...V('remove', 'remove doff'),
    ...V('knock', 'knock rap bang'),
    ...V('ring', 'ring toll'),
    ...V('listen', 'listen hear eavesdrop'),
    ...V('buy', 'buy purchase pay rent'),
    ...V('kneel', 'kneel pray bow'),
    ...V('push', 'push pull turn lift move shove'),
    ...V('light', 'light ignite'),
    ...V('go', 'go walk run enter leave climb jump swim wade step flee head cross descend ascend'),
    ...V('inventory', 'i inv inventory items'),
    ...V('herbs', 'herbs stock satchel'),
    ...V('journal', 'journal clues notes notebook'),
    ...V('spells', 'spells magic craft'),
    ...V('recipes', 'recipes brews'),
    ...V('score', 'score points'),
    ...V('hint', 'hint hints stuck'),
    ...V('help', 'help ?'),
    ...V('save', 'save'),
    ...V('restore', 'restore load undo'),
    ...V('restart', 'restart'),
    ...V('quit', 'quit'),
    ...V('wake', 'wake'),
]);

const clean = (s) => s.toLowerCase().replace(/[^a-z0-9'? -]+/g, ' ').replace(/'s\b/g, 's').replace(/'/g, '').replace(/\s+/g, ' ').trim();
const nouns = (toks) => toks.filter((t) => !ART.has(t)).join(' ');

export function parse(line) {
    const s = clean(String(line || ''));
    if (!s) return { empty: true };
    let toks = s.split(' ');
    // a bare direction
    if (toks.length === 1 && DIRS[toks[0]]) return { verb: 'go', dir: DIRS[toks[0]], a: '', b: '', raw: s };
    const vw = toks[0];
    let verb = VERBS[vw];
    if (!verb) return { unknown: vw, raw: s };
    let rest = toks.slice(1);

    // verb + particle quirks
    if (vw === 'enter' || vw === 'leave') {
        if (!rest.length) return { verb: 'go', dir: vw === 'enter' ? 'in' : 'out', a: '', b: '', raw: s };
    }
    if (vw === 'look' && rest[0] === 'around' && rest.length === 1) rest = [];
    if (vw === 'pick' && rest[0] === 'up') rest = rest.slice(1);
    if (vw === 'put' && rest[0] === 'on') { verb = 'wear'; rest = rest.slice(1); }
    if (vw === 'put' && rest[0] === 'down') { verb = 'drop'; rest = rest.slice(1); }
    if (vw === 'take' && rest[0] === 'off') { verb = 'remove'; rest = rest.slice(1); }
    if (vw === 'turn' && rest[0] === 'on') { verb = 'light'; rest = rest.slice(1); }
    if (vw === 'get' && rest[0] === 'up') rest = [];
    if (vw === 'pay' && rest[0] === 'for') rest = rest.slice(1);
    if (vw === 'kindle') { verb = 'cast'; rest = ['kindle', ...rest]; }
    if (vw === 'wake' && rest[0] === 'up') rest = rest.slice(1);
    if (vw === 'talk' || vw === 'speak' && rest[0] === 'to') { /* handled by the particle drop below */ }
    if (vw === 'say' || vw === 'speak' || vw === 'answer' || vw === 'reply' || vw === 'shout' || vw === 'whisper' || vw === 'utter' || vw === 'sing' || vw === 'call' || vw === 'recite') {
        // "speak to X" is talk; everything else is speech
        if (!(vw === 'speak' && (rest[0] === 'to' || rest[0] === 'with')) && !(vw === 'call' && false)) {
            const text = rest.join(' ').replace(/^"|"$/g, '');
            return { verb: 'say', text, a: '', b: '', raw: s };
        }
        verb = 'talk';
    }
    if (verb === 'brew' || verb === 'buy') return { verb, text: nouns(rest), a: nouns(rest), b: '', raw: s };

    // drop one leading particle ("look at", "talk to", "go to", "listen to"), but not for movement
    if (verb !== 'go' && rest.length && PARTICLES.has(rest[0]) && !(verb === 'use' && rest[0] === 'on')) rest = rest.slice(1);
    if (verb === 'go' && rest[0] === 'to') rest = rest.slice(1);
    if (verb === 'go' && rest.length === 1 && DIRS[rest[0]]) return { verb: 'go', dir: DIRS[rest[0]], a: '', b: '', raw: s };
    if (verb === 'go' && rest.length === 2 && rest[0] === 'to' && DIRS[rest[1]]) return { verb: 'go', dir: DIRS[rest[1]], a: '', b: '', raw: s };

    if (verb === 'cast') {
        // "cast loosen on door", "cast sight", "cast veil"
        const i = rest.findIndex((t) => PREPS.has(t));
        const spell = nouns(i < 0 ? rest : rest.slice(0, i));
        const target = i < 0 ? '' : nouns(rest.slice(i + 1));
        return { verb, a: spell, b: target, raw: s };
    }

    const i = rest.findIndex((t, k) => k > 0 && PREPS.has(t));
    let a, b, prep = '';
    if (i < 0) { a = nouns(rest); b = ''; } else { a = nouns(rest.slice(0, i)); prep = rest[i]; b = nouns(rest.slice(i + 1)); }
    // "ask about X" with no one named
    if (!a && rest[0] && PREPS.has(rest[0]) && rest.length > 1) { prep = rest[0]; b = nouns(rest.slice(1)); }
    // unlock A with B → use B on A
    if ((vw === 'unlock' || vw === 'unbar' || vw === 'unbolt') && b) return { verb: 'use', a: b, b: a, prep: 'on', raw: s };
    // open A with B → use B on A
    if (verb === 'open' && b && prep === 'with') return { verb: 'use', a: b, b: a, prep: 'on', raw: s };
    // "give B A" is rare, "feed A B" is: feed the crow salt
    if (vw === 'feed' && a && b && prep !== 'to') return { verb: 'use', a: b, b: a, prep: 'on', raw: s };
    return { verb, a, b, prep, raw: s };
}

/** Words of a noun phrase and of an entity's names, for matching. */
export const words = (s) => s.split(' ').filter(Boolean);
export function matches(phrase, names) {
    const pw = words(phrase);
    if (!pw.length) return false;
    const nw = new Set(names.flatMap((n) => words(clean(n))));
    return pw.every((w) => nw.has(w) || (w.length >= 3 && [...nw].some((n) => n.startsWith(w))));
}
export function exact(phrase, names) {
    return names.some((n) => clean(n) === phrase);
}
