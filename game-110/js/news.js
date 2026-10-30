// The gossip ticker: what the kingdom is saying about the Overlord. Each line has a test on the game state, and the
// ticker picks among the ones that fit, so the news follows how the castle is doing. Pure (it takes a random number).

import { tierOf } from './sim/game.js';

const L = [
    // always
    [() => true, 'Royal Herald: “The Overlord remains extremely evil. Please do not approach the castle.”'],
    [() => true, 'Weather: overcast over the Dark Castle, with a 60% chance of cinnamon.'],
    [() => true, 'Local man swears he heard the Overlord humming a waltz. Local man has been told to stop.'],
    [() => true, 'Heroes’ Guild reminds members that “Overlord” is not a hobby and “doily” is not a code word.'],
    [() => true, 'The Overlord’s Mother writes: “She was always such a good girl. Terrible. But good.”'],
    [() => true, 'Advice column: “My overlord left a fruit basket at my door. Should I be afraid?” Yes. Probably. Enjoy the fruit.'],
    [() => true, 'Notice: anonymous bakery “Dark Delights” wins Best Scone for the third year running.'],
    [(G) => G.owned.imp > 0, 'Imps seen at the village market, buying vanilla “for curses”.'],
    [(G) => G.owned.imp >= 25, 'The Union of Small Flames demands better toques. The Overlord agrees immediately.'],
    [(G) => G.owned.cauldron > 0, 'Rumour: the castle’s cauldrons now smell of soup. The Overlord insists it is “poison soup”.'],
    [(G) => G.owned.golem > 0, 'A twelve-foot gingerbread man was seen at the border. Witnesses report it “smelled lovely” and “was terrifying”.'],
    [(G) => G.owned.spider > 0, 'Tailors’ Guild alarmed by a sudden surplus of exquisite black lace.'],
    [(G) => G.owned.loom > 0, 'Tapestry depicting the Overlord “looking menacing” arrives anonymously at the cathedral. It has tassels.'],
    [(G) => G.owned.bat > 0, 'Fashion news: velvet capes are back. A bat was seen taking measurements.'],
    [(G) => G.owned.gargoyle > 0, 'Florist’s shop reports a gargoyle buying 400 black roses. It paid in exact change.'],
    [(G) => G.owned.wraith > 0, 'The castle windows glow every night now. “Ambience,” says a spokeswraith.'],
    [(G) => G.owned.portrait > 0, 'Art critics praise the Overlord’s portraits, which keep rearranging themselves.'],
    [(G) => G.owned.skeleton > 0, 'Villagers report waltz music from the crypt. Several have taken up dancing.'],
    [(G) => G.owned.mimic > 0, 'A treasure chest offered an adventurer a canapé. The adventurer accepted. Both are fine.'],
    [(G) => G.owned.lich > 0, 'The Lich Party Planner has sent out 9,000 invitations. Nobody has dared RSVP “no”.'],
    // reputation
    [(G) => tierOf(G.dread).id === 'suspected', 'Gossip: “Is the Overlord… nice?” The Heroes’ Guild is sending someone to check.'],
    [(G) => tierOf(G.dread).id === 'suspected', 'A child reports the Overlord gave her a cupcake. Authorities say “that’s how they get you”.'],
    [(G) => tierOf(G.dread).id === 'suspected', 'Headline: OVERLORD SEEN IN APRON. Castle declines to comment.'],
    [(G) => tierOf(G.dread).id === 'dreaded', 'Thunder over the Dark Castle again. Villagers lock their doors and bake protective pies.'],
    [(G) => tierOf(G.dread).id === 'dreaded', 'The kingdom trembles. Tribute arrives early, gift-wrapped.'],
    [(G) => tierOf(G.dread).id === 'feared', 'Peasants report a cackle “so evil it rattled the teacups”.'],
    [(G) => G.stats.heroes >= 5, 'Heroes’ Guild losing members: “We went to fight evil and it was… very dramatic.”'],
    [(G) => G.stats.heroMiss >= 1, 'A hero claims the Overlord’s castle is “full of doilies”. Nobody believes him. Yet.'],
    [(G) => G.decor.mirrorball, 'Nightlife: the Mirrorball of Doom can be seen from three kingdoms.'],
    [(G) => G.decor.organ, 'The Brooding Organ has started taking requests.'],
    [(G) => G.runs >= 1, 'Real estate: another evil lair goes on the market. “Lovely curtains,” says the agent.'],
    [(G) => G.runs >= 1, 'Heroes finally storm the old castle. They find it spotless, with a thank-you note.'],
    [(G) => Object.keys(G.heirlooms).length > 0, 'Antiques expert: “The Overlord has an eye for heirlooms. And three for curses.”'],
    [(G) => G.stats.clicks > 500, 'The Overlord has a callus from whisking. Doctors recommend “less whisking”. The Overlord laughs evilly.'],
];

/** A fitting headline. r is a number in [0, 1). */
export function headline(G, r) {
    const fit = L.filter(([t]) => t(G));
    return fit[Math.floor(r * fit.length) % fit.length][1];
}
