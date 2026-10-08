/**
 * quests.js — the quest engine and every quest: the eleven-quest main story, guild lines
 * (Hunters' Lodge, Frostspire Academy, the Lampless), town quests, the cottage, and endless
 * bounties. A quest is a list of steps; each step has journal text, an objective, an optional
 * marker, and a way to finish: a world event, a poll, or a dialogue topic. Pure sim.
 */
import { LOC, LOCATIONS } from './geography.js';
import { NPC, ENCOUNTERS } from './actors.js';
import { addItem, removeItem, countItem, equip } from './inventory.js';
import { learnRing, SIGILS } from './magic.js';
import { itemDef, registerItem } from './items.js';
import { Rng, hashStr } from './rng.js';
import './books.js';

registerItem('contraband', { type: 'quest', name: 'Sealed Crate of Spice', value: 0, weight: 4, quest: true });
registerItem('ships_log', { type: 'quest', name: "Log of the Winter Gull", value: 0, weight: 1, quest: true });

const near = (w, x, z, r) => w.cellId === 'ext' && Math.hypot(w.player.pos.x - x, w.player.pos.z - z) < r;
const nearLoc = (w, id, r) => near(w, LOC[id].x, LOC[id].z, r);
const has = (w, id, n = 1) => countItem(w.player, id) >= n;
const give = (w, id, n = 1) => { addItem(w.player, { id }, n); w.emit('pickup', { entry: { id }, n }); };
const take = (w, id, n = 1) => { removeItem(w.player, id, n); };
const gold = (w, n) => { w.player.gold += n; w.emit('pickup', { entry: { id: 'gold' }, n }); };
const say = (w, who, text, secs) => w.emit('say', { who, text, secs });
const talk = (npc, text, reply, extra = {}) => ({ npc, text, reply, ...extra });
/** Scripted foes are tagged so a step can tell whether its foe still exists (after a load, a door or a long walk). */
const alive = (w, tag) => w.actors.some((a) => a.questTag === tag && !a.dead);

// ------------------------------------------------------------------ quest definitions
export const QUESTS = {};
const Q = (id, d) => { QUESTS[id] = { id, ...d }; };

// =========================================================== MAIN QUEST
Q('mq01', { title: 'The Night the Sky Split', kind: 'main', text: 'I rode the last cart of autumn to Hollowmere Keep with a sealed letter for its captain.', steps: [
    { obj: 'Deliver the sealed letter to Hollowmere Keep', marker: { loc: 'hollowmere' }, poll: (w) => nearLoc(w, 'hollowmere', 62),
        done: (w, q) => {
            // the dead are at the gate; then the sky splits
            const L = LOC.hollowmere;
            for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const s = w.spawn(i < 4 ? 'skeleton' : 'wight_husk', L.x + Math.cos(a) * 26, L.z - 34 + Math.sin(a) * 10, { level: 1 }); s.ai.state = 'combat'; s.ai.target = w.player.id; }
            const h = w.pop.npc('halvard'); h.pos.x = L.x + 4; h.pos.z = L.z - 30; h.pos.y = w.space.ground(h.pos.x, h.pos.z, 1e4); if (!w.actors.includes(h)) w.addActor(h);
            h.ai.kind = 'follower'; h.follower = true; h.ai.leader = w.player.id;
            say(w, 'Halvard Stonehand', "Courier? Get behind me! The dead walked out of the barrow fields at dusk.");
            q.vars.t = 0;
        } },
    { obj: 'Survive the attack on the keep', marker: { loc: 'hollowmere' },
        enter: (w, q) => { q.vars.t = 0; },
        tick: (w, q, dt) => {
            q.vars.t += dt;
            if (q.vars.t > 8 && !q.vars.wyrm) {
                q.vars.wyrm = true;
                const L = LOC.hollowmere;
                const v = w.pop.spawnDragon('vyrthax', { x: L.x - 260, y: w.terrain.heightAt(L.x, L.z) + 110, z: L.z + 120 });
                v.flyby = 26; v.invulnerable = true;
                w.emit('roar', { actor: v });
                say(w, 'Halvard Stonehand', 'Sky-Father preserve us. A dragon. A black dragon!');
            }
            if (q.vars.t > 16 && !q.vars.struck) {
                q.vars.struck = true;
                const p = w.player;
                p.hp = Math.max(1, p.hp * 0.25);
                w.flags.scar = true;
                w.emit('stormStrike', { pos: { ...p.pos } });
                w.emit('note', { text: 'Lightning. The world goes white, then black. And then, somehow, you are still standing. Your arm burns with a branching scar.' });
            }
        },
        poll: (w, q) => q.vars.struck && q.vars.t > 20 },
    { obj: 'Get inside the keep', marker: { door: 'hollowmere:keep' }, enter: (w) => say(w, 'Halvard Stonehand', 'You live? Into the keep, now! The armoury, then out through the undercroft!'), on: { type: 'cellChanged', test: (e) => e.cell === 'hollowmere:keep' } },
    { obj: 'Arm yourself from the armoury chests', poll: (w) => { const r = w.player.equip.right; return !!(r && itemDef(r)?.type === 'weapon') || w.player.hands.right; } },
    { obj: 'Escape through the undercroft', marker: { cell: 'hollowmere:keep', usable: 'undercroft:d0' }, on: { type: 'cellChanged', test: (e) => e.cell === 'undercroft:d0' } },
    { obj: 'Find a way out of the undercroft', marker: { cell: 'undercroft:d0', exit: true }, on: { type: 'cellChanged', test: (e) => e.cell === 'ext' },
        done: (w) => {
            w.flags.prologueDone = true;
            const h = w.pop.npcs.get('halvard');
            if (h) { say(w, 'Halvard Stonehand', 'Air. Trees. We made it. My sister Ragna keeps a house in Pinebrook, down the river. Go to her. I have to find what is left of my company.'); h.follower = false; h.ai.kind = 'civilian'; w.pop.state.halvard = { ...(w.pop.state.halvard || {}), gone: true }; w.despawn(h); }
        } },
], complete: (w) => w.quests.start('mq02') });

Q('mq02', { title: 'Word to Brightwater', kind: 'main', text: 'The letter I carried warned of thinning ice in the Hrimsea. The Warden of Brightwater must hear of the dragon.', steps: [
    { obj: 'Find Ragna in Pinebrook', marker: { npc: 'ragna' }, topics: [talk('ragna', 'Halvard sent me. The keep has fallen.', "Halvard's alive? Thank the stars. And a black dragon... Take these, and take that letter to Warden Sigrun in Brightwater. She needs to know it came true.", { advance: true, act: (w) => { give(w, 'potion_restoreHealth_0', 2); give(w, 'bread', 2); gold(w, 25); } })] },
    { obj: 'Bring the letter to Warden Sigrun in Brightwater', marker: { npc: 'warden_sigrun' }, topics: [talk('warden_sigrun', 'I bring your letter back, Warden. Hollowmere is ash. A black dragon did it.', "So the watchers were right. Sky help us. You've earned your fee twice over, courier. Stay a while; my sage Ivo will want to hear this, and may have work for someone who walks out of a burning keep.", { advance: true, act: (w) => { take(w, 'sealed_letter'); gold(w, 100); } })] },
], complete: (w) => w.quests.start('mq03') });

Q('mq03', { title: 'The Storm Lodestone', kind: 'main', text: "Ivo Farran, the Warden's sage, believes a lodestone of sky-iron lies in Coldmarrow Barrow, and that it points toward the dragons' burial mounds.", steps: [
    { obj: 'Speak with Ivo Farran in Wyrmguard Hall', marker: { npc: 'ivo' }, topics: [talk('ivo', 'The Warden said you might have work.', "A sky-iron lodestone. The Binders used them to find the wyrm-mounds; one lies in Coldmarrow Barrow above Pinebrook. The door at its heart answers to the stars. Bring the lodestone to me and we may yet see where the dragons will rise.", { advance: true })] },
    { obj: 'Recover the Storm Lodestone from Coldmarrow Barrow', marker: { loc: 'coldmarrow' }, poll: (w) => has(w, 'lodestone') },
    { obj: 'Bring the lodestone to Ivo Farran', marker: { npc: 'ivo' }, topics: [talk('ivo', 'Here is your lodestone.', "Look — it swings already. East... and south. Wait. The Warden's beacon! Greywatch Tower is burning its fire. That means only one thing. Go!", { advance: true, act: (w) => { take(w, 'lodestone'); gold(w, 150); } })] },
], complete: (w) => w.quests.start('mq04') });

Q('mq04', { title: 'Ember in the Ashes', kind: 'main', text: 'The beacon at Greywatch Tower has been lit: a dragon is coming.', steps: [
    { obj: 'Go to Greywatch Tower', marker: { loc: 'greywatch' }, poll: (w) => nearLoc(w, 'greywatch', 150),
        done: (w, q) => {
            const L = LOC.greywatch;
            w.flags.stormsworn = true;
            for (let i = 0; i < 3; i++) { const g = w.spawn('hearthguard', L.x + 8 + i * 3, L.z + 10, { level: 6 }); g.faction = 'guard'; }
            w.pop.state.brenna = { ...(w.pop.state.brenna || {}), scripted: true };
            const b = w.pop.npc('brenna'); b.pos.x = L.x + 6; b.pos.z = L.z + 14; b.pos.y = w.space.ground(b.pos.x, b.pos.z, 1e4); if (!w.actors.includes(b)) w.addActor(b);
            say(w, 'Brenna', "There! Over the ridge! Shields up, and aim for the wings!");
        } },
    { obj: 'Slay the dragon', tick: (w, q) => {
            if (alive(w, 'mq04') || !nearLoc(w, 'greywatch', 260)) return;
            const L = LOC.greywatch;
            const d = w.pop.spawnDragon('dragon', { x: L.x + 220, y: w.terrain.heightAt(L.x, L.z) + 120, z: L.z - 160 });
            q.vars.dragon = d.id; d.name = 'Dragon'; d.questTag = 'mq04';
        }, on: { type: 'ember' }, done: (w) => {
            if (w.pop.state.brenna) w.pop.state.brenna.scripted = false;
            say(w, 'Brenna', "Its fire... it went into you. I've heard the old stories. Stormsworn. You'd best tell the Warden.");
        } },
    { obj: 'Return to Warden Sigrun', marker: { npc: 'warden_sigrun' }, topics: [talk('warden_sigrun', 'The dragon is dead. Its ember went into me.', "Then the stories are true, and you are what the carvings call Stormsworn. Brightwater names you Shieldfriend. Brenna will be your Sworn Sword, if she'll have you. And listen: the watchers at Highcairn lit their tower last night. They want you.", { advance: true, act: (w) => { w.flags.dragonsReturn = true; w.flags.shieldfriend_brightwater = true; w.flags['hire:brenna'] = true; gold(w, 300); give(w, 'steel_sword'); } })] },
], complete: (w) => w.quests.start('mq05') });

const CAIRNS = [[-0.4, 300], [1.9, 290], [3.6, 310]].map(([a, r]) => ({ x: LOC.summit ? LOC.summit.x + Math.cos(a) * r : 0, z: LOC.summit ? LOC.summit.z + Math.sin(a) * r : 0 }));
Q('mq05', { title: "The Pilgrim's Stair", kind: 'main', text: 'The Skywatch of Highcairn has summoned me. They keep the oldest storm-lore in the north.', steps: [
    { obj: 'Climb the Pilgrim\'s Stair to Highcairn', marker: { loc: 'highcairn' }, poll: (w) => nearLoc(w, 'highcairn', 60) || w.cellId === 'highcairn:monastery' },
    { obj: 'Speak with Master Ostvald', marker: { npc: 'ostvald' }, topics: [talk('ostvald', 'You sent for me.', "We did. The storm has been tidying itself for a hundred years, and now it has a centre: you. Show me your hand. Yes. The scar knows the shapes. I will give you two more: the Gale's second ring, and the Stride. Then prove you can use them: on the mountain's shoulders stand three beacon cairns. Light them, tonight.", { advance: true, act: (w) => { const st = w.player.storm; if ((st.rings.gale || 0) < 2) learnRing(st, 'gale'); learnRing(st, 'stride'); w.emit('ringLearned', { sigil: 'stride', ring: 1, name: 'Step', sigilName: SIGILS.stride.name }); } })] },
    { obj: 'Light the three beacon cairns on Mount Hrimgard', marker: { cairns: true }, poll: (w) => [0, 1, 2].every((i) => w.flags[`cairn${i}`]) },
    { obj: 'Return to Master Ostvald', marker: { npc: 'ostvald' }, topics: [talk('ostvald', 'The cairns are lit.', "We saw. Three fires on the mountain, as there were the night the Binders marched. Now hear the rest: Vyrthax wakes, and he is calling the dead dragons from their mounds to feed. The cartographer Sela Varr has been mapping those mounds. Find her in Pinebrook.", { advance: true, act: (w) => gold(w, 100) })] },
], complete: (w) => w.quests.start('mq06') });

Q('mq06', { title: 'The Rising', kind: 'main', text: 'Sela Varr, a cartographer in Pinebrook, has been charting the wyrm-mounds.', steps: [
    { obj: 'Find Sela Varr in Pinebrook', marker: { npc: 'sela' }, topics: [talk('sela', "Master Ostvald sent me. You map the dragon mounds?", "Nineteen of them. And the lodestone you found swings hardest toward Kalrstead. If something is going to come out of the ground, it'll be there. I'm coming with you; somebody has to write this down.", { advance: true, act: (w) => { const s = w.pop.npc('sela'); s.follower = true; s.ai.kind = 'follower'; s.ai.leader = w.player.id; w.pop.state.sela = { ...(w.pop.state.sela || {}), following: true }; } })] },
    { obj: 'Go to Kalrstead Mound', marker: { loc: 'kalrstead' }, poll: (w) => nearLoc(w, 'kalrstead', 90),
        done: (w, q) => {
            const L = LOC.kalrstead;
            const v = w.pop.spawnDragon('vyrthax', { x: L.x - 200, y: w.terrain.heightAt(L.x, L.z) + 90, z: L.z - 100 });
            v.flyby = 18; v.invulnerable = true;
            say(w, 'Sela Varr', "That's him. He's... speaking to the mound. Look out!");
        } },
    { obj: 'Slay Sahlrok', tick: (w, q) => {
            if (alive(w, 'sahlrok') || !nearLoc(w, 'kalrstead', 260)) return;
            const L = LOC.kalrstead;
            const d = w.pop.spawnDragon('dragon', { x: L.x, y: w.terrain.heightAt(L.x, L.z) + 4, z: L.z });
            d.name = 'Sahlrok'; d.questTag = 'sahlrok'; q.vars.dragon = d.id;
            w.emit('roar', { actor: d });
        }, on: { type: 'dragonDeath', test: (e) => e.actor?.name === 'Sahlrok' } },
    { obj: 'Speak with Sela', marker: { npc: 'sela' }, topics: [talk('sela', 'It is dead. What now?', "Now we know what he's doing, and that he can be stopped. The Binders left a record in Grimhallow Crypt, in the Whitewastes. If there's a way to chain him again, it's written there. I'll go back to Pinebrook and work on the map.", { advance: true, act: (w) => { const s = w.pop.npcs.get('sela'); if (s) { s.follower = false; s.ai.kind = 'civilian'; } w.pop.state.sela = { ...(w.pop.state.sela || {}), following: false }; } })] },
], complete: (w) => w.quests.start('mq07') });

Q('mq07', { title: 'The First Storm', kind: 'main', text: 'The Binders carved their history in Grimhallow Crypt. Somewhere in it is how they chained Vyrthax.', steps: [
    { obj: 'Search Grimhallow Crypt for the Binders\' record', marker: { loc: 'grimhallow' }, poll: (w) => has(w, 'chronicle') },
    { obj: 'Read the Chronicle of the First Storm', on: { type: 'bookRead', test: (e) => e.id === 'chronicle' } },
    { obj: 'Take the Chronicle to Master Ostvald', marker: { npc: 'ostvald' }, topics: [talk('ostvald', 'The Binders split the chaining sigil into three rings.', "Root, chain and anchor. You have touched the first already, if the crypt's stone spoke to you. The chain the clockwork folk kept in their brass sky, under Stonecleft. Go to Deepforge Hold. Bring the orrery back to life.", { advance: true, act: (w) => { if (!(w.player.storm.rings.earthbind > 0)) learnRing(w.player.storm, 'earthbind'); } })] },
], complete: (w) => w.quests.start('mq08') });

Q('mq08', { title: 'The Orrery Vault', kind: 'main', text: "The second ring of the Earthbinding sigil is written into the clockwork folk's orrery, deep in Deepforge Hold.", steps: [
    { obj: 'Recover the Orrery Core from Deepforge Hold', marker: { loc: 'deepforge' }, poll: (w) => has(w, 'orrery_core') },
    { obj: 'Seat the core in the great orrery', marker: { usable: 'orrery' }, on: { type: 'orrerySet' }, done: (w) => { const st = w.player.storm; while ((st.rings.earthbind || 0) < 2) learnRing(st, 'earthbind'); w.emit('ringLearned', { sigil: 'earthbind', ring: 2, name: 'Chain', sigilName: SIGILS.earthbind.name }); take(w, 'orrery_core'); } },
], complete: (w) => w.quests.start('mq09') });

Q('mq09', { title: 'The Chained Wyrm', kind: 'main', text: 'The last ring was given to one of Vyrthax\'s own brood, chained on the summit of Hrimgard.', steps: [
    { obj: 'Climb to Hrimgard Summit', marker: { loc: 'summit' }, poll: (w) => nearLoc(w, 'summit', 70),
        done: (w) => say(w, 'Thurnvaal', 'Little storm. You took your time.', 4) },
    { obj: 'Speak with Thurnvaal', marker: { actor: 'thurnvaal' }, tick: (w, q) => {
            if (alive(w, 'thurnvaal') || !nearLoc(w, 'summit', 250)) return;
            const L = LOC.summit;
            const t = w.pop.spawnDragon('thurnvaal', { x: L.x + 10, y: w.terrain.heightAt(L.x + 10, L.z) + 1, z: L.z });
            t.fly = false; t.chained = true; t.talkable = true; t.invulnerable = true; t.ai.state = 'ground'; t.faction = 'neutral'; t.name = 'Thurnvaal'; t.questTag = 'thurnvaal'; q.vars.th = t.id;
        }, topics: [
        talk('thurnvaal', 'Teach me the last ring. (Promise to break his chains.)', 'Then strike the chains, and hear it: ANCHOR. Keep what you hold. I go to find the sky again; when you fight my father, look up.', { advance: true, act: (w) => { w.flags.thurnvaalFreed = true; learnRing(w.player.storm, 'earthbind'); w.emit('ringLearned', { sigil: 'earthbind', ring: 3, name: 'Anchor', sigilName: SIGILS.earthbind.name }); const t = w.actors.find((a) => a.tpl === 'thurnvaal'); if (t) { t.chained = false; t.fly = true; t.flyby = 14; t.leaving = true; t.talkable = false; t.invulnerable = true; } } }),
        talk('thurnvaal', 'Your kind does not deserve the sky. (Draw your weapon.)', 'So. The Binders\' children have not changed.', { advance: true, act: (w) => { w.flags.thurnvaalSlain = true; const t = w.actors.find((a) => a.tpl === 'thurnvaal'); if (t) { t.chained = false; t.faction = 'dragon'; t.essential = false; t.invulnerable = false; t.ai.state = 'ground'; t.ai.t = 0; t.ai.target = w.player.id; t.talkable = false; } } }),
    ] },
    { obj: 'Face Vyrthax', enter: (w, q) => {
            if (w.flags.thurnvaalSlain) { q.vars.waitTh = true; }
            q.vars.t = 0;
        },
        tick: (w, q, dt) => {
            if (q.vars.waitTh) { const t = w.actors.find((a) => a.tpl === 'thurnvaal'); if (t && !t.dead) return; if (!q.vars.anchor) { q.vars.anchor = true; learnRing(w.player.storm, 'earthbind'); w.emit('ringLearned', { sigil: 'earthbind', ring: 3, name: 'Anchor', sigilName: SIGILS.earthbind.name }); w.emit('note', { text: 'Written in the frost on his chains: ANCHOR.' }); } q.vars.waitTh = false; }
            if (q.vars.v && !alive(w, 'vyr9')) { q.vars.v = false; q.vars.t = 0; }
            if (!nearLoc(w, 'summit', 300)) return;
            q.vars.t += dt;
            if (q.vars.t > 6 && !q.vars.v) {
                q.vars.v = true;
                const L = LOC.summit;
                const v = w.pop.spawnDragon('vyrthax', { x: L.x - 300, y: w.terrain.heightAt(L.x, L.z) + 120, z: L.z + 200 });
                q.vars.vid = v.id; v.questTag = 'vyr9';
                say(w, 'Vyrthax', 'BINDER. I REMEMBER YOUR HANDS.', 4);
            }
        },
        poll: (w, q) => { const v = w.byId(q.vars.vid); if (!v) return false; if (v.hp < v.hpMax * 0.55) { v.flyby = 10; v.leaving = true; v.invulnerable = true; say(w, 'Vyrthax', 'NOT HERE. NOT YET. COME TO MY TEMPLE, LITTLE STORM, AND WATCH ME DRINK.', 5); return true; } return false; } },
], complete: (w) => w.quests.start('mq10') });

Q('mq10', { title: "The Cult's Last Rite", kind: 'main', text: 'Vyrthax has fled to Vahlokar Temple to drink the embers of his risen brood. The towns must march together.', steps: [
    { obj: 'Ask Warden Sigrun to call the five towns to march', marker: { npc: 'warden_sigrun' }, topics: [talk('warden_sigrun', 'Vyrthax is at Vahlokar. I need every town behind me.', "Then you'll have them. I'll send riders to every Warden tonight, and the Hunters' Lodge will march with the Hearthguard. Kettil will grumble and Asgerd will want it in writing, but they'll come. Go ahead of us; break whatever he's feeding on.", { advance: true })] },
    { obj: 'March on Vahlokar Temple', marker: { loc: 'vahlokar' }, on: { type: 'cellChanged', test: (e) => /^vahlokar:/.test(e.cell) } },
    { obj: 'Break the three ember braziers', poll: (w) => (w.flags.braziers || 0) >= 3 },
    { obj: 'Defeat the hierophant Zahrakhul', on: { type: 'death', test: (e) => e.actor?.tpl === 'hierophant' } },
    { obj: 'Take the Crown of Zahrakhul', poll: (w) => has(w, 'hierophant_crown') },
    { obj: 'Climb into the Eye of the Storm', marker: { usable: 'eyestair' }, on: { type: 'cellChanged', test: (e) => e.cell === 'eye' } },
], complete: (w) => w.quests.start('mq11') });

Q('mq11', { title: 'The Eye of the Storm', kind: 'main', text: 'Above the temple, Vyrthax has become half storm. This ends here.', steps: [
    { obj: 'Destroy Vyrthax', enter: (w, q) => { q.vars.t = 0; }, tick: (w, q, dt) => {
            q.vars.t += dt;
            if (q.vars.spawned && !alive(w, 'vyr11')) q.vars.spawned = false;
            if (q.vars.t > 2 && !q.vars.spawned && w.cellId === 'eye') {
                q.vars.spawned = true;
                const c = w.space;
                const v = w.pop.spawnDragon('vyrthax', { x: c.W * c.ts / 2 - 60, y: 40, z: c.H * c.ts / 2 - 80 });
                v.essential = false; v.invulnerable = false; v.hpMax = v.hp = v.hpMax * 1.4; q.vars.vid = v.id; v.questTag = 'vyr11';
                say(w, 'Vyrthax', 'I AM THE WEATHER. YOU CANNOT CHAIN THE WEATHER.', 4);
                if (w.flags.thurnvaalFreed && !alive(w, 'ally')) { const t = w.pop.spawnDragon('thurnvaal', { x: c.W * c.ts / 2 + 80, y: 50, z: c.H * c.ts / 2 + 60 }); t.faction = 'player'; t.questTag = 'ally'; t.ai.kind = 'dragon'; t.ai.target = v.id; t.invulnerable = true; say(w, 'Thurnvaal', 'I said to look up, little storm.', 4); }
            }
        }, on: { type: 'death', test: (e) => e.actor?.tpl === 'vyrthax' } },
], complete: (w) => { w.flags.gameComplete = true; for (const u of w.space.usables || []) if (u.eyeExit) u.hidden = false; w.emit('gameComplete', {}); } });

// =========================================================== HUNTERS' LODGE
Q('lodge1', { title: 'The Lodge Trial', kind: 'guild', giver: 'ulfar', text: "Ulfar Grimsson of the Hunters' Lodge will take on anyone who can bring down an alpha wolf.", steps: [
    { obj: 'Hunt the alpha wolf on the plains west of Brightwater', marker: { xz: [-330, 60] }, tick: (w, q) => { if (!alive(w, 'lodge1') && near(w, -330, 60, 180)) { const a = w.spawn('alpha_wolf', -330, 60, {}); a.questTag = 'lodge1'; for (let i = 0; i < 2; i++) w.spawn('wolf', -325 + i * 3, 64, {}); } },
        on: { type: 'death', test: (e) => e.actor?.questTag === 'lodge1' } },
    { obj: 'Return to Ulfar', marker: { npc: 'ulfar' }, topics: [talk('ulfar', 'The alpha is dead.', "Then you're one of us, Tracker. The board in the hall has work for the Lodge, and I'll have more for you when you're ready.", { advance: true, act: (w) => { w.flags.lodge = 1; gold(w, 100); give(w, 'steel_bow'); } })] },
], complete: (w) => w.quests.offer('lodge2') });
Q('lodge2', { title: 'Bear Season', kind: 'guild', giver: 'ulfar', text: 'Bears have taken the den at Bramblemaw and the herders want them gone.', steps: [
    { obj: 'Clear Bramblemaw Den', marker: { loc: 'bramblemaw' }, on: { type: 'cleared', test: (e) => e.loc === 'bramblemaw' }, poll: (w) => w.cleared.has('bramblemaw') },
    { obj: 'Report to Ulfar', marker: { npc: 'ulfar' }, topics: [talk('ulfar', 'Bramblemaw is clear.', 'Good. The herders will sleep tonight.', { advance: true, act: (w) => gold(w, 250) })] },
], complete: (w) => w.quests.offer('lodge3') });
Q('lodge3', { title: "Raiders' Roost", kind: 'guild', giver: 'ulfar', text: 'Saltreavers hold Fort Saltreave on the north shore. The Lodge has been asked to burn them out.', steps: [
    { obj: 'Break the Saltreavers at Fort Saltreave', marker: { loc: 'saltreave' }, poll: (w) => w.cleared.has('saltreave') },
    { obj: 'Report to Ulfar', marker: { npc: 'ulfar' }, topics: [talk('ulfar', 'The fort is ours again.', "Ha! Kettil will have to buy the mead for a year. Hunter, you've earned your rank.", { advance: true, act: (w) => { w.flags.lodge = 2; gold(w, 400); } })] },
], complete: (w) => w.quests.offer('lodge4') });
Q('lodge4', { title: "The Old Hunter's Barrow", kind: 'guild', giver: 'ulfar', text: "The Lodge's founder lies in Oakenrest Barrow, and his spearhead with him. Ulfar wants it brought home.", steps: [
    { obj: "Recover the Old Hunter's Spearhead from Oakenrest Barrow", marker: { loc: 'oakenrest' }, poll: (w) => has(w, 'hunter_spearhead') },
    { obj: 'Bring the spearhead to Ulfar', marker: { npc: 'ulfar' }, topics: [talk('ulfar', 'The spearhead, home at last.', "...I never thought I'd see it. Lodge-Warden. That's what you are now. Wear it well.", { advance: true, act: (w) => { take(w, 'hunter_spearhead'); w.flags.lodge = 3; gold(w, 600); give(w, 'glimmer_bow'); } })] },
] });

// =========================================================== FROSTSPIRE ACADEMY
Q('acad1', { title: "The Apprentice's Trial", kind: 'guild', giver: 'varo', text: 'Magister Varo will enrol anyone who can cast a spell without setting themselves alight.', steps: [
    { obj: 'Cast any spell in front of Magister Varo', marker: { npc: 'varo' }, on: { type: 'cast', test: (e, w) => { const v = w.pop.npcs.get('varo'); return e.actor === w.player && v && w.actors.includes(v) && Math.hypot(v.pos.x - w.player.pos.x, v.pos.z - w.player.pos.z) < 12; } } },
    { obj: 'Speak with Magister Varo', marker: { npc: 'varo' }, topics: [talk('varo', 'Well?', 'Adequate. Better than adequate: your eyebrows survived. Welcome to the Frostspire. Here, a ward. You will need it more than you think.', { advance: true, act: (w) => { w.flags.academy = 1; give(w, 'tome_ward'); give(w, 'robe'); } })] },
], complete: (w) => w.quests.offer('acad2') });
Q('acad2', { title: 'The Rimeholt Excavation', kind: 'guild', giver: 'celestine', text: 'An Academy dig at Rimeholt Barrow went quiet. The High Magister wants the Staff of Hollow Winds recovered.', steps: [
    { obj: 'Recover the Staff of Hollow Winds from Rimeholt Barrow', marker: { loc: 'rimeholt' }, poll: (w) => has(w, 'staff_winds') },
    { obj: 'Return to High Magister Celestine', marker: { npc: 'celestine' }, topics: [talk('celestine', 'The staff, and the dig team\'s last notes.', 'They went too deep. They always do. Keep the staff; it has chosen you, or something like that.', { advance: true, act: (w) => { gold(w, 300); w.flags.academy = 2; } })] },
], complete: (w) => w.quests.offer('acad3') });
Q('acad3', { title: 'The Glass in Murkhollow', kind: 'guild', giver: 'celestine', text: 'A shard of the Academy\'s spire-glass was carried into Murkhollow Cavern by the Gloomkin. It must come back before it cracks.', steps: [
    { obj: 'Recover the Spire Shard from Murkhollow Cavern', marker: { loc: 'murkhollow' }, poll: (w) => has(w, 'staff_shard') },
    { obj: 'Return the shard to the High Magister', marker: { npc: 'celestine' }, topics: [talk('celestine', 'Your shard, uncracked.', 'You have done the Academy a service it will remember for exactly as long as it is convenient. I jest. Mostly. Arch-scholar of the Frostspire: the title is yours.', { advance: true, act: (w) => { take(w, 'staff_shard'); gold(w, 500); w.flags.academy = 3; give(w, 'tome_chainlightning'); } })] },
] });

// =========================================================== THE LAMPLESS
Q('lamp1', { title: 'Salt and Shadow', kind: 'guild', giver: 'rook', text: 'Rook of the Lampless wants a sealed crate of spice in Hrimvik, and no questions.', steps: [
    { obj: 'Deliver the sealed crate to Hallvig in Hrimvik', marker: { npc: 'hallvig' }, enter: (w) => give(w, 'contraband'), topics: [talk('hallvig', 'A delivery. From Rook.', "Shh! In the back, in the back. Tell Rook the salt's good.", { advance: true, act: (w) => take(w, 'contraband') })] },
    { obj: 'Return to Rook', marker: { npc: 'rook' }, topics: [talk('rook', "Hallvig says the salt's good.", "Then you're Lampless now, friend. We don't carry lights; we carry each other. Mostly.", { advance: true, act: (w) => { w.flags.lampless = 1; gold(w, 150); } })] },
], complete: (w) => w.quests.offer('lamp2') });
Q('lamp2', { title: 'Old Debts', kind: 'guild', giver: 'rook', text: 'Three debtors owe the Lampless. Rook wants it collected, one way or another.', steps: [
    { obj: 'Collect from Ingrid, Hrolfgar and Edda (0/3)', marker: { npcs: ['ingrid', 'hrolfgar', 'edda'] }, poll: (w, q) => (q.vars.n || 0) >= 3,
        topics: ['ingrid', 'hrolfgar', 'edda'].map((n) => talk(n, 'Rook sends his regards. You owe him.', 'Fine! Fine. Here. Tell him we are square.', { once: `debt:${n}`, act: (w, q) => { q.vars.n = (q.vars.n || 0) + 1; gold(w, 60); w.quests.retitle(q, `Collect from Ingrid, Hrolfgar and Edda (${q.vars.n}/3)`); } })) },
    { obj: 'Bring the money to Rook', marker: { npc: 'rook' }, topics: [talk('rook', 'All three paid. (Hand over 180 gold.)', 'Ha. Keep a third for yourself; you earned it.', { advance: true, act: (w) => { w.player.gold = Math.max(0, w.player.gold - 120); w.flags.lampless = 2; } })] },
], complete: (w) => w.quests.offer('lamp3') });
Q('lamp3', { title: 'The Gilded Cask', kind: 'guild', giver: 'rook', text: 'A Mirefen vintner keeps a priceless gilded cask locked in her shop. Rook wants it, and wants it quietly.', steps: [
    { obj: "Steal the Gilded Cask from Edda Goldhollow's shop", marker: { npc: 'edda' }, poll: (w) => has(w, 'gilded_cask') },
    { obj: 'Bring the cask to Rook', marker: { npc: 'rook' }, topics: [talk('rook', 'One gilded cask, never opened.', "Oh, that's beautiful. Guildmaster's share is yours, and the title with it: Lampless Hand. Don't let it go to your head.", { advance: true, act: (w) => { take(w, 'gilded_cask'); gold(w, 800); w.flags.lampless = 3; give(w, 'ring_quiet'); } })] },
] });

// =========================================================== TOWN QUESTS
Q('t_ring', { title: 'The Lost Ring', kind: 'side', giver: 'freya', text: "Freya of Mirefen lost her wedding ring on the shore of Lake Mirrow.", steps: [
    { obj: "Find Freya's ring on the shore of Lake Mirrow", marker: { xz: [1010, 1060] }, enter: (w, q) => { if (!q.vars.dropped) { q.vars.dropped = true; w.items.push({ uid: 'qring', entry: { id: 'lost_ring', n: 1 }, pos: { x: 1010, y: w.terrain.heightAt(1010, 1060) + 0.05, z: 1060 }, cell: 'ext', owner: null }); } }, poll: (w) => has(w, 'lost_ring') },
    { obj: 'Return the ring to Freya', marker: { npc: 'freya' }, topics: [talk('freya', 'Is this your ring?', "Oh! Oh, thank you. Here, it's not much, but take it.", { advance: true, act: (w) => { take(w, 'lost_ring'); gold(w, 80); } })] },
] });
Q('t_giant', { title: 'Giant Trouble', kind: 'side', giver: 'ingrid', text: "A giant from Giant's Hearth has been stamping Ingrid Fallowmoor's fields flat.", steps: [
    { obj: "Deal with the giant at Giant's Hearth", marker: { loc: 'gianthearth' }, on: { type: 'death', test: (e) => e.actor?.tpl === 'giant' } },
    { obj: 'Tell Ingrid', marker: { npc: 'ingrid' }, topics: [talk('ingrid', 'Your giant will not trouble you again.', "You... actually did it. The Warden will hear of this. Here, and a wheel of cheese, and my thanks.", { advance: true, act: (w) => { gold(w, 200); give(w, 'cheese'); w.flags.bwFavor = (w.flags.bwFavor || 0) + 1; } })] },
] });
Q('t_wolves', { title: 'Wolves at the Door', kind: 'side', giver: 'bjarki', text: 'Wolves have been taking goats from the pens outside Pinebrook.', steps: [
    { obj: 'Kill the wolves near Pinebrook (0/3)', marker: { xz: [-60, 830] }, enter: (w, q) => { q.vars.k = 0; },
        tick: (w, q) => { if (!alive(w, 't_wolves') && near(w, -60, 830, 150)) { for (let i = q.vars.k; i < 3; i++) { const a = w.spawn('wolf', -60 + i * 3, 830 + i * 2, {}); a.questTag = 't_wolves'; } } },
        on: { type: 'death', test: (e, w, q) => { if (e.actor?.questTag !== 't_wolves') return false; q.vars.k++; w.quests.retitle(q, `Kill the wolves near Pinebrook (${q.vars.k}/3)`); return q.vars.k >= 3; } } },
    { obj: 'Tell Bjarki', marker: { npc: 'bjarki' }, topics: [talk('bjarki', 'The wolves are dead.', 'Then the goats are safe, and so is my supper. Thank you, friend.', { advance: true, act: (w) => gold(w, 75) })] },
] });
Q('t_hakon', { title: "Hakon's Iron", kind: 'side', giver: 'hakon', text: 'Hakon the Smith will teach anyone who can forge a decent iron dagger.', steps: [
    { obj: 'Forge an iron dagger at the forge', marker: { npc: 'hakon' }, enter: (w) => { give(w, 'ingot_iron', 2); give(w, 'leather_strips', 2); }, on: { type: 'crafted', test: (e) => e.id === 'iron_dagger' } },
    { obj: 'Show the dagger to Hakon', marker: { npc: 'hakon' }, topics: [talk('hakon', 'Here. My first dagger.', "Hm. Lopsided, but it'll cut. Keep it, and keep at it. Here's a little iron to practise with.", { advance: true, act: (w) => { give(w, 'ingot_iron', 3); w.skillUse(w.player, 'smithing', 30); } })] },
] });
Q('t_elk', { title: 'The Wounded Elk', kind: 'side', giver: 'aelric', text: 'Aelric Fernsong saw an elk with an arrow in its flank wandering the woods. He wants it put out of its pain and the meat shared.', steps: [
    { obj: 'Hunt an elk and bring back venison', marker: { xz: [40, 980] }, enter: (w, q) => { if (!q.vars.spawned) { q.vars.spawned = true; w.spawn('elk', 40, 980, {}); } }, poll: (w) => has(w, 'venison') },
    { obj: 'Bring the venison to Aelric', marker: { npc: 'aelric' }, topics: [talk('aelric', 'The elk is at peace. Here is the venison.', 'A clean kill. Thank you. Take my old bow; I hunt less these days.', { advance: true, act: (w) => { take(w, 'venison'); give(w, 'iron_bow'); give(w, 'arrow_steel', 20); w.skillUse(w.player, 'archery', 20); } })] },
] });
Q('t_letter', { title: 'Letters Home', kind: 'side', giver: 'orla', text: 'Orla at the Sleeping Elk has a letter for Brenna in Brightwater.', steps: [
    { obj: 'Deliver the letter to Brenna in Brightwater', marker: { npc: 'brenna' }, enter: (w) => give(w, 'letter_brenna'), topics: [talk('brenna', 'A letter for you, from Orla in Pinebrook.', "From my sister? ... She's well. And she's still terrible at spelling. Thank you.", { advance: true, act: (w) => { take(w, 'letter_brenna'); gold(w, 40); } })] },
] });
Q('t_necro', { title: "The Necromancer's Grave", kind: 'side', giver: 'priest_bw', text: 'Maelis the Healer says a necromancer is raising the dead in Ashmourn Barrow.', steps: [
    { obj: 'Clear Ashmourn Barrow', marker: { loc: 'ashmourn' }, poll: (w) => w.cleared.has('ashmourn') },
    { obj: 'Tell Maelis', marker: { npc: 'priest_bw' }, topics: [talk('priest_bw', 'The barrow is quiet.', 'Then the dead rest again. Let me teach you a little mending, and take these.', { advance: true, act: (w) => { give(w, 'potion_restoreHealth_2', 2); give(w, 'tome_quickmending'); } })] },
] });
Q('t_wreck', { title: 'The Wreck of the Winter Gull', kind: 'side', giver: 'runa', text: "Runa Sealsong's father captained the Winter Gull, wrecked on the north shore. She wants its log.", steps: [
    { obj: "Find the Winter Gull's log at the wreck", marker: { loc: 'wreck' }, enter: (w, q) => { if (!q.vars.dropped) { q.vars.dropped = true; const L = LOC.wreck; w.items.push({ uid: 'qlog', entry: { id: 'ships_log', n: 1 }, pos: { x: L.x + 3, y: w.terrain.heightAt(L.x + 3, L.z + 2) + 0.5, z: L.z + 2 }, cell: 'ext', owner: null }); } }, poll: (w) => has(w, 'ships_log') },
    { obj: 'Bring the log to Runa', marker: { npc: 'runa' }, topics: [talk('runa', "Your father's log.", '"Ice ahead, and the aurora at noon." ... He saw it too, then. Thank you. Take whatever you like from my stall at half price. Well. At a good price.', { advance: true, act: (w) => { take(w, 'ships_log'); gold(w, 150); give(w, 'amulet_sky'); } })] },
] });

// =========================================================== HOUSE
Q('h_cottage', { title: 'Windward Cottage', kind: 'misc', giver: 'aldric', text: 'Steward Aldric Venn says Windward Cottage in Brightwater is for sale, to the right buyer.', steps: [
    { obj: 'Buy Windward Cottage (2500 gold)', marker: { npc: 'aldric' }, topics: [talk('aldric', 'I will buy the cottage. (2500 gold)', 'Done. Here is the key; it\'s yours. Mind the draught.', { advance: true, cond: (w) => w.player.gold >= 2500, act: (w) => { w.player.gold -= 2500; give(w, 'key_cottage'); const b = w.settlements.buildings.find((x) => x.loc === 'brightwater' && x.type?.startsWith('house') && !Object.values(NPC).some((n) => n.home === x.id)); if (b) { w.flags[`owns:${b.id}`] = true; w.flags.cottage = b.id; } } })] },
] });

// ------------------------------------------------------------------ bounties (endless)
function bountyTarget(w, rng) {
    const opts = Object.keys(ENCOUNTERS).filter((loc) => LOC[loc] && !(w.pop.camps.get(loc)?.clearedAt != null && w.time.total - w.pop.camps.get(loc).clearedAt < 72));
    return opts.length ? rng.pick(opts) : null;
}

// ------------------------------------------------------------------ the engine
export class Quests {
    constructor(world) {
        this.w = world;
        this.state = {};        // id → { step, done, vars, offered, title? }
        this.tracked = null;
        this.queue = [];        // every world event, pushed by World.emit
        this.pollT = 0;
        this.bountyN = 0;
    }
    q(id) { return this.state[id]; }
    active(id) { const s = this.state[id]; return s && !s.done && s.step >= 0; }
    done(id) { return !!this.state[id]?.done; }
    def(id) { return QUESTS[id] || this.state[id]?.def; }

    start(id, def = null) {
        if (this.state[id] && this.state[id].step >= 0) return;
        const d = def || QUESTS[id];
        if (!d) return;
        this.state[id] = { step: 0, done: false, vars: {}, def: def ? d : undefined };
        if (!this.tracked || this.def(this.tracked)?.kind !== 'main' || d.kind === 'main') this.tracked = id;
        this.w.emit('questStart', { id, title: d.title });
        this.enterStep(id);
    }
    /** Make a quest available from its giver without starting it. */
    offer(id) { if (!this.state[id]) this.state[id] = { step: -1, done: false, vars: {}, offered: true }; }
    enterStep(id) {
        const s = this.state[id], d = this.def(id), st = d.steps[s.step];
        s.objText = null;
        if (st?.enter) st.enter(this.w, s);
        if (st) this.w.emit('objective', { id, text: st.obj });
    }
    retitle(s, text) { s.objText = text; }
    advance(id) {
        const s = this.state[id], d = this.def(id);
        if (!s || s.done) return;
        const st = d.steps[s.step];
        if (st?.done) st.done(this.w, s);
        s.step++;
        if (s.step >= d.steps.length) {
            s.done = true;
            this.w.emit('questDone', { id, title: d.title });
            if (this.tracked === id) this.tracked = Object.keys(this.state).find((k) => this.active(k)) || null;
            if (d.complete) d.complete(this.w, s);
            if (d.reward) d.reward(this.w, s);
            return;
        }
        this.enterStep(id);
    }

    tick(dt) {
        const w = this.w;
        // events since the last tick
        while (this.queue.length) {
            const e = this.queue.shift();
            for (const id of Object.keys(this.state)) {
                if (!this.active(id)) continue;
                const s = this.state[id], st = this.def(id).steps[s.step];
                if (st?.on && st.on.type === e.type && (!st.on.test || st.on.test(e, w, s))) this.advance(id);
            }
            this.onEvent(e);
        }
        for (const id of Object.keys(this.state)) {
            if (!this.active(id)) continue;
            const s = this.state[id], st = this.def(id).steps[s.step];
            if (st?.tick) st.tick(w, s, dt);
        }
        this.pollT -= dt;
        if (this.pollT <= 0) {
            this.pollT = 0.5;
            for (const id of Object.keys(this.state)) {
                if (!this.active(id)) continue;
                const s = this.state[id], st = this.def(id).steps[s.step];
                if (st?.poll && st.poll(w, s)) this.advance(id);
            }
            this.discover();
        }
    }

    /** Locations reveal themselves when you come close. */
    discover() {
        const w = this.w;
        if (w.cellId !== 'ext') return;
        const p = w.player;
        for (const L of LOCATIONS) {
            if (w.discovered.has(L.id)) continue;
            if (Math.hypot(L.x - p.pos.x, L.z - p.pos.z) < Math.max(55, (L.flat || 20) + 30)) { w.discovered.add(L.id); w.stats.locations++; w.emit('discovered', { loc: L.id }); }
        }
    }

    onEvent(e) {
        const w = this.w;
        if (e.type === 'death' && e.actor?.isCellBoss) {
            // quest items the bosses were guarding
            const c = w.space;
            const put = (id) => { if (!has(w, id) && !e.actor.inv.some((x) => x.id === id)) addItem(e.actor, { id }, 1); };
            if (c.loc === 'coldmarrow' && this.active('mq03')) put('lodestone');
            if (c.loc === 'grimhallow' && this.active('mq07')) put('chronicle');
            if (c.loc === 'deepforge' && this.active('mq08')) put('orrery_core');
            if (c.loc === 'oakenrest' && this.active('lodge4')) put('hunter_spearhead');
            if (c.loc === 'rimeholt' && this.active('acad2')) put('staff_winds');
            if (c.loc === 'murkhollow' && this.active('acad3')) put('staff_shard');
        }
        if (e.type === 'cleared') {
            for (const id of Object.keys(this.state)) if (this.active(id) && id.startsWith('bounty') && this.state[id].vars.loc === e.loc && this.state[id].step === 0) this.advance(id);
        }
        if (e.type === 'readBook') {
            const d = itemDef(e.entry);
            if (d?.rune) { w.flags.runes = w.flags.runes || {}; if (!w.flags.runes[d.rune]) { w.flags.runes[d.rune] = true; w.emit('runeLearned', { id: d.rune, name: d.name.replace('Rune-Book: ', '') }); removeItem(w.player, e.entry, 1); } }
        }
    }

    /** Quest objects inside cells as they are entered. */
    cellSetup(c) {
        const w = this.w;
        if (!c) return;
        if (c.id === 'coldmarrow:d0' && !w.flags.hunterCorpse) {
            w.flags.hunterCorpse = true;
            const r = c.rooms[1] || c.rooms[0];
            const x = (r.x + r.w / 2) * c.ts, z = (r.z + r.h / 2) * c.ts;
            const b = w.spawn('bandit', x, z, { level: 1, y: c.floorAt(x, z) + 1 });
            b.name = 'Treasure Hunter'; b.inv.length = 0; addItem(b, { id: 'star_chart' }, 1); addItem(b, { id: 'hunter_note' }, 1); b.gold = 12;
            w.kill(b, null);
        }
        if (c.id === 'hollowmere:keep') {
            for (const u of c.usables) if (u.kind === 'container' && u.ckind === 'armoury' && !w.containers.has(u.cid)) w.container(u.cid, 'armoury', { inv: armouryLoot(u.cid) });
        }
        if (c.loc === 'deepforge' && c.level === c.levels - 1 && !c.usables.some((u) => u.kind === 'orrery')) {
            const r = c.rooms[c.rooms.length - 1];
            const x = (r.x + r.w / 2) * c.ts, z = (r.z + r.h / 2) * c.ts;
            c.usables.push({ kind: 'orrery', x, y: c.floorAt(x, z) + 1.5, z, r: 2.2, name: 'The Great Orrery' });
        }
        if (c.loc === 'vahlokar' && !c.usables.some((u) => u.kind === 'ember_brazier')) {
            c.rooms.slice(1).filter((_, i) => i % 2 === 0).slice(0, c.level === 0 ? 2 : 1).forEach((r, i) => {
                const x = (r.x + 0.8) * c.ts, z = (r.z + 0.8) * c.ts;
                c.usables.push({ kind: 'ember_brazier', x, y: c.floorAt(x, z) + 1.2, z, r: 1.4, bid: `${c.id}:b${i}`, name: 'Ember Brazier' });
                c.lights.push({ x, z, y: c.floorAt(x, z) + 1.4, r: 9, i: 1, col: 0xff5a20, fire: true, bid: `${c.id}:b${i}` });
                c.props.push({ type: 'brazier_in', x, z, y: c.floorAt(x, z), rot: 0, s: 1.6 });
            });
            if (c.level === c.levels - 1) {
                const r = c.rooms[c.rooms.length - 1];
                const x = (r.x + r.w - 0.8) * c.ts, z = (r.z + 0.8) * c.ts;
                c.usables.push({ kind: 'eyestair', x, y: c.floorAt(x, z) + 1.4, z, r: 1.6, name: 'Stair to the Eye of the Storm' });
                c.props.push({ type: 'door_frame_big', x, z, y: c.floorAt(x, z), rot: 0 });
            }
            for (const u of c.usables) if (u.kind === 'ember_brazier' && w.flags[`broke:${u.bid}`]) u.hidden = true;
        }
    }

    /** Extra things to use outdoors (beacon cairns). */
    extUsables(pos, r) {
        const out = [];
        if (this.active('mq05') && this.state.mq05.step === 2) CAIRNS.forEach((c, i) => {
            if (this.w.flags[`cairn${i}`] || Math.abs(c.x - pos.x) > r + 3 || Math.abs(c.z - pos.z) > r + 3) return;
            out.push({ kind: 'cairn', x: c.x, y: this.w.terrain.heightAt(c.x, c.z) + 1, z: c.z, r: 1.6, idx: i, name: 'Beacon Cairn' });
        });
        return out;
    }
    cairnPositions() { return CAIRNS.map((c, i) => ({ ...c, y: this.w.terrain.heightAt(c.x, c.z), lit: !!this.w.flags[`cairn${i}`] })); }

    /** Use a quest object; returns true if handled. */
    use(f) {
        const w = this.w;
        switch (f.kind) {
            case 'cairn': w.flags[`cairn${f.idx}`] = true; w.emit('cairnLit', { idx: f.idx, x: f.x, z: f.z }); w.emit('note', { text: `The beacon cairn catches. ${[0, 1, 2].filter((i) => w.flags[`cairn${i}`]).length} of 3 lit.` }); return true;
            case 'orrery':
                if (!has(w, 'orrery_core')) { w.emit('note', { text: 'An empty socket waits at the heart of the brass sky.' }); return true; }
                w.emit('orrerySet', {}); w.emit('note', { text: 'The orrery shudders and turns. Among its brass stars a shape of light unfolds: CHAIN.' }); return true;
            case 'ember_brazier':
                w.flags[`broke:${f.bid}`] = true; w.flags.braziers = (w.flags.braziers || 0) + 1; f.hidden = true;
                { const L = w.space.lights?.find((l) => l.bid === f.bid); if (L) L.i = 0; }
                w.emit('explode', { pos: { x: f.x, y: f.y - 1, z: f.z }, radius: 3, elem: 'fire' });
                w.emit('note', { text: `You overturn the ember brazier. (${w.flags.braziers}/3)` });
                return true;
            case 'eyestair':
                if (!has(w, 'hierophant_crown')) { w.emit('note', { text: 'The stair is sealed by a ring of iron. It wants the hierophant\'s crown.' }); return true; }
                w.emit('useDoor', { door: { to: 'eye', name: 'The Eye of the Storm' } });
                return true;
        }
        return false;
    }

    /** Dialogue options this NPC has for active quests (and offers for available ones). */
    topicsFor(actor) {
        const w = this.w, out = [];
        const id = actor.npcId || actor.tpl;
        for (const qid of Object.keys(this.state)) {
            const s = this.state[qid];
            const d = this.def(qid);
            if (!d) continue;
            if (s.step === -1 && d.giver === id) { out.push({ text: `${d.title}?`, reply: d.text, quest: qid, offer: true, action: () => this.start(qid) }); continue; }
            if (!this.active(qid)) continue;
            const st = d.steps[s.step];
            for (const t of st?.topics || []) {
                if (t.npc !== id) continue;
                if (t.once && w.flags[t.once]) continue;
                if (t.cond && !t.cond(w, s)) { out.push({ text: t.text, reply: t.failReply || "You don't have what that needs yet.", quest: qid, disabled: true }); continue; }
                out.push({ text: t.text, reply: t.reply, quest: qid, action: () => { if (t.once) w.flags[t.once] = true; if (t.act) t.act(w, s); if (t.advance) this.advance(qid); } });
            }
        }
        // quest givers with nothing offered yet: kick off their first quest
        const firsts = { ulfar: 'lodge1', varo: 'acad1', rook: 'lamp1', freya: 't_ring', ingrid: 't_giant', bjarki: 't_wolves', hakon: 't_hakon', aelric: 't_elk', orla: 't_letter', priest_bw: 't_necro', runa: 't_wreck', aldric: 'h_cottage' };
        const f = firsts[id];
        if (f && !this.state[f] && (f !== 'h_cottage' || this.done('mq04'))) out.push({ text: `${QUESTS[f].title}?`, reply: QUESTS[f].text, quest: f, offer: true, action: () => this.start(f) });
        // bounties from the Wardens
        if (actor.role === 'warden' && this.done('mq02')) {
            const open = Object.keys(this.state).find((k) => k.startsWith('bounty') && this.active(k));
            if (!open) out.push({ text: 'Any bounties posted?', reply: 'There is always someone causing trouble on the roads.', action: () => this.startBounty(actor) });
            else if (this.state[open].step === 1) out.push({ text: 'The bounty is done.', reply: 'So I hear. Here is your reward.', action: () => this.advance(open) });
        }
        return out;
    }

    startBounty(warden) {
        const w = this.w;
        const rng = new Rng(hashStr(warden.npcId || 'w') ^ (this.bountyN * 7919) ^ Math.floor(w.time.total));
        const loc = bountyTarget(w, rng);
        if (!loc) { w.emit('say', { who: warden.name, text: 'Quiet times. Come back later.' }); return; }
        const id = `bounty${++this.bountyN}`;
        const reward = 100 + w.player.sheet.level * 25;
        const def = { title: `Bounty: ${LOC[loc].name}`, kind: 'misc', text: `${warden.name} has posted a bounty on whatever is causing trouble at ${LOC[loc].name}.`, steps: [
            { obj: `Clear ${LOC[loc].name}`, marker: { loc } },
            { obj: `Collect the bounty from ${warden.name}`, marker: { npc: warden.npcId } },
        ], complete: (ww) => gold(ww, reward) };
        this.start(id, def);
        this.state[id].vars.loc = loc;
        w.flags[`told:${loc}`] = true;
    }

    // ---------------------------------------------------------------- journal and markers
    list(done) {
        const order = { main: 0, guild: 1, side: 2, misc: 3 };
        return Object.keys(this.state).filter((k) => this.state[k].step >= 0 && !!this.state[k].done === done).map((k) => {
            const s = this.state[k], d = this.def(k);
            const objectives = d.steps.slice(0, done ? d.steps.length : s.step + 1).map((st, i) => ({ text: i === s.step && s.objText ? s.objText : st.obj, done: done || i < s.step }));
            return { id: k, title: d.title, kind: d.kind, text: d.text, objectives, done };
        }).sort((a, b) => order[a.kind] - order[b.kind]);
    }
    markers() {
        const w = this.w, out = [];
        const ids = this.tracked && this.active(this.tracked) ? [this.tracked] : [];
        for (const id of ids) {
            const s = this.state[id], st = this.def(id).steps[s.step];
            const m = st?.marker;
            if (!m) continue;
            const title = st.obj;
            const pushLoc = (x, z, cell = null) => out.push({ x, z, title, cell });
            if (m.loc) {
                if (w.cellId !== 'ext' && w.space.loc === m.loc) { /* inside: no outdoor marker */ } else pushLoc(LOC[m.loc].x, LOC[m.loc].z);
            }
            if (m.xz) pushLoc(m.xz[0], m.xz[1]);
            if (m.cairns) for (const c of this.cairnPositions()) if (!c.lit) pushLoc(c.x, c.z);
            for (const nid of m.npcs || (m.npc ? [m.npc] : [])) {
                const a = w.pop.npcs.get(nid);
                if (a && w.actors.includes(a)) out.push({ x: a.pos.x, z: a.pos.z, title, cell: w.cellId });
                else {
                    const cell = w.pop.npcCell.get(nid);
                    const n = NPC[nid];
                    const bid = cell && cell !== 'ext' && cell !== 'away' ? cell : (n?.work || n?.home);
                    const door = w.settlements.doors.find((d) => d.to === bid);
                    if (w.cellId === 'ext') { if (door) pushLoc(door.x, door.z); else if (n) pushLoc(LOC[n.loc].x, LOC[n.loc].z); }
                }
            }
            if (m.actor) { const a = w.actors.find((x) => x.tpl === m.actor && !x.dead); if (a) out.push({ x: a.pos.x, z: a.pos.z, title, cell: w.cellId }); }
            if (m.door && w.cellId === 'ext') { const d = w.settlements.doors.find((x) => x.to === m.door); if (d) pushLoc(d.x, d.z); }
            if (m.cell && w.cellId === m.cell) {
                const c = w.space;
                if (m.exit) { const u = c.usables.find((x) => x.kind === 'door' && x.door.to === 'ext'); if (u) out.push({ x: u.x, z: u.z, title, cell: w.cellId }); }
                if (m.usable) { const u = c.usables.find((x) => x.door?.to === m.usable); if (u) out.push({ x: u.x, z: u.z, title, cell: w.cellId }); }
            }
            if (m.usable && w.cellId !== 'ext') { const u = w.space.usables.find((x) => x.kind === m.usable); if (u) out.push({ x: u.x, z: u.z, title, cell: w.cellId }); }
        }
        return out;
    }

    save() { const out = {}; for (const [k, s] of Object.entries(this.state)) out[k] = { step: s.step, done: s.done, vars: s.vars, objText: s.objText, def: s.def ? { title: s.def.title, kind: s.def.kind, text: s.def.text, loc: s.vars.loc } : undefined }; return { state: out, tracked: this.tracked, bountyN: this.bountyN }; }
    load(d) {
        this.state = {};
        for (const [k, s] of Object.entries(d?.state || {})) {
            this.state[k] = { step: s.step, done: s.done, vars: s.vars || {}, objText: s.objText };
            if (k.startsWith('bounty') && s.def) {
                const loc = s.vars?.loc, reward = 100 + this.w.player.sheet.level * 25;
                this.state[k].def = { title: s.def.title, kind: 'misc', text: s.def.text, steps: [{ obj: `Clear ${LOC[loc]?.name}`, marker: { loc } }, { obj: 'Collect the bounty' }], complete: (ww) => gold(ww, reward) };
            }
        }
        this.tracked = d?.tracked || null; this.bountyN = d?.bountyN || 0;
    }
}

function armouryLoot(cid) {
    const second = cid.endsWith('1') || cid.endsWith('3') || cid.endsWith('5') || cid.endsWith('7') || cid.endsWith('9');
    return second ? [{ id: 'iron_bow', n: 1 }, { id: 'arrow_iron', n: 30 }, { id: 'hide_feet', n: 1 }, { id: 'hide_hands', n: 1 }, { id: 'torch', n: 2 }, { id: 'tome_flames', n: 1 }]
        : [{ id: 'iron_sword', n: 1 }, { id: 'iron_shield', n: 1 }, { id: 'hide_body', n: 1 }, { id: 'hide_head', n: 1 }, { id: 'potion_restoreHealth_0', n: 3 }, { id: 'lockpick', n: 4 }];
}
