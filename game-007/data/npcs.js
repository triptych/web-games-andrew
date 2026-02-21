// NPC definitions for the game

export const NPCS = {

    // ===== HIGH PRIEST ATEM-RA (Crypt) =====
    "atem_ra": {
        id: "atem_ra",
        name: "Ghost of Atem-Ra",
        shortName: "Atem-Ra",
        description: "The translucent figure of an ancient high priest. He wears elaborate ceremonial robes that shimmer with a faint inner light. His expression is solemn but not unkind.",
        location: "crypt",
        state: "idle",
        questGiver: true,
        tradeable: true,
        dialogue: {
            greeting: "The mists between realms part before you, traveler. I am Atem-Ra, High Priest of the Temple of Celestial Light. You disturb my long rest — yet I sense you carry a purpose. Ask what you will.",
            greeting_repeat: "You return, seeker. The temple's secrets are not yet exhausted. Ask what you will.",
            topics: {
                "crystal": {
                    keywords: ["crystal", "crystal of light", "artifact", "sacred"],
                    text: "The Crystal of Light was our most sacred artifact — a gift from the celestial powers, imbued with the essence of Sun, Moon, Star, and Comet. I shattered it when the temple fell, to prevent its power from falling into corrupted hands. I hid the three shards in places of meaning: the heights, the depths, and where sacred fire burns eternal. If you seek to restore the Crystal, you must find all three shards and unite them with the main crystal upon the sanctum pedestal."
                },
                "shards": {
                    keywords: ["shards", "shard", "pieces", "piece", "fragments", "fragment"],
                    text: "I hid the three shards where they would be preserved. One I placed in the heights — above the library, where sky meets stone. One I placed in the depths — in this very crypt, upon my own sarcophagus, so I might watch over it. And one I placed where sacred fire burns — in the ritual chamber, upon the altar of the four celestial bodies. Have you found them all?"
                },
                "order": {
                    keywords: ["order", "sequence", "celestial", "sun", "moon", "star", "comet", "arrange"],
                    text: "The celestial order is the fundamental law of this temple: Sun leads, for it is the first light. Moon follows, steady and faithful. Star holds the center, constant in the turning heavens. And Comet comes last, the wandering traveler. Sun — Moon — Star — Comet. This sequence appears throughout the temple for a reason. When you reunite the shards with the Crystal of Light, this order is the key."
                },
                "yourself": {
                    keywords: ["yourself", "you", "priest", "atem", "atem-ra", "high priest", "who are you"],
                    text: "I was High Priest of this temple for forty years, keeper of the Crystal of Light and guardian of the celestial mysteries. When darkness came and the temple fell, I chose to remain — bound to this place until the Crystal is restored. My body rests in that sarcophagus. My spirit remains. I have waited a very long time for someone worthy to find their way here."
                },
                "sundering": {
                    keywords: ["sundering", "great sundering", "shattered", "broke", "why", "darkness", "fell"],
                    text: "The Great Sundering was a time of terrible conflict. Those who worshipped darkness sought the Crystal to corrupt its light and use it as a weapon. I could not allow it. I shattered the Crystal into four pieces — the main body and three shards — and hid them. Better that its power sleep dormant than serve evil ends. I did not expect it would take so long for a worthy seeker to come."
                },
                "library": {
                    keywords: ["library", "bookshelf", "books", "passage", "west"],
                    text: "The library holds much of our temple's knowledge. The scholars were clever — they built a hidden passage behind the westernmost bookshelf, leading to the collapsed tunnels beyond. If you press the bookshelf firmly, you will find the way. The passage connects to older parts of the temple, including paths leading further into the outer tunnels."
                },
                "light": {
                    keywords: ["light", "dark", "darkness", "torch", "lantern", "illuminate"],
                    text: "Several chambers of this temple are without natural light. You will need a light source to navigate them. A torch or lantern will serve, but flame can be extinguished. Bring me the Stone Tablets of Foundation — if you have found them — and I may be able to offer something more reliable than fire."
                },
                "crypt": {
                    keywords: ["crypt", "tomb", "sarcophagi", "sarcophagus", "coffin", "burial", "this place"],
                    text: "This is the final resting place of myself and my fellow priests. We were buried with the rites and honors of the celestial order. The largest sarcophagus — my own — held the Moon Stone shard I chose to keep close. I had hoped to watch over it in death as I did in life. I trust you have retrieved it for the good of the temple."
                },
                "puzzle": {
                    keywords: ["puzzle", "altar", "lock", "door", "solve", "unlock", "how"],
                    text: "Many of the temple's chambers are sealed with celestial locks — puzzles that require knowledge of the celestial order. The sequence Sun-Moon-Star-Comet appears on locks, altars, and doors throughout the temple. Trust the sequence, and the way will open. The altar in the ritual chamber and the Crystal's pedestal in the inner sanctum both respond to this order."
                }
            },
            give_stone_tablet: "The Sacred Tablets of Foundation... I had thought these lost forever. You found them in the entrance hall? Of course — I placed them there as a guide for any worthy seeker. Take this in exchange — the Moonfire Charm. I created it long ago for navigating the deeper tunnels. It provides constant light and will never be extinguished. Guard it well, traveler.",
            give_generic: "I have no use for such things. I am beyond material concerns. But I thank you for the thought.",
            farewell: "Go well, seeker. The temple's light depends on you.",
            unknown_topic: "I do not know of such things, or perhaps that knowledge has faded with the centuries. Ask me of the crystal, the shards, the celestial order, or the sundering — these I know well."
        }
    },

    // ===== THE SCHOLAR'S SPIRIT (Library) =====
    "scholar_spirit": {
        id: "scholar_spirit",
        name: "Scholar's Spirit",
        shortName: "Scholar",
        description: "A translucent elderly figure in scholarly robes, surrounded by softly glowing motes of light. He moves between the shelves with an air of habitual purpose, pausing now and then to peer at the spines of books he can no longer touch.",
        location: "library",
        state: "idle",
        questGiver: false,
        tradeable: false,
        dialogue: {
            greeting: "Oh! A visitor — after all this time! Forgive me, I am startled. I am — was — the temple's chief librarian. I have watched over these books in spirit for... quite some time now. You are most welcome here. What knowledge do you seek?",
            greeting_repeat: "Back again? The library's resources are at your disposal. What is it you wish to know?",
            topics: {
                "bookshelf": {
                    keywords: ["bookshelf", "shelf", "shelves", "passage", "hidden passage", "secret", "west", "push"],
                    text: "Ah, you noticed! Yes — the westernmost bookshelf is not merely a bookshelf. It is mounted on a hidden pivot. The priests used the passage behind it to move between the library and the outer tunnels without being observed. Simply push the bookshelf firmly — it will swing aside. The passage leads north and west into the older tunnel network."
                },
                "window": {
                    keywords: ["window", "balcony", "upper balcony", "rope", "hook", "climb", "high", "ledge", "reach"],
                    text: "The high window in the north wall was used for astronomical observations — the scholars would climb up with ropes to study the night sky from the balcony above. If you have a rope tied to a grappling hook, you can throw the hook to catch the ledge above the window and climb up. I saw the monks do it many times. The balcony offers a remarkable view, and I believe something was left up there long ago."
                },
                "scroll": {
                    keywords: ["scroll", "reading desk", "desk", "open scroll", "manuscript", "text"],
                    text: "The scroll on the reading desk is one of the few texts to survive in readable condition. It concerns the history of the Crystal of Light and the Great Sundering — where the shards were hidden, and why. I recommend you examine it carefully. If you have not read it already, please do. It contains vital information for any seeker."
                },
                "crystal": {
                    keywords: ["crystal", "crystal of light", "shards", "light", "power", "restore"],
                    text: "The Crystal of Light was the centrepiece of all our rituals and studies. When Atem-Ra shattered it, much of the temple's purpose was lost. The library holds records of its properties — it was said to banish all darkness within the temple when whole. Three shards are scattered through the temple; the main crystal body remains on the pedestal in the inner sanctum. Reunite them and you may restore what was lost."
                },
                "atem-ra": {
                    keywords: ["atem-ra", "atem", "high priest", "priest", "ghost in crypt", "ghost below"],
                    text: "Atem-Ra was a great man — perhaps the greatest High Priest this temple ever had. He made a terrible sacrifice, shattering the Crystal to protect it, and chose to remain bound to the crypt in spirit to guard the Moon Stone shard. If you have spoken with him, you have had the honour of speaking with a true guardian of the celestial order."
                },
                "books": {
                    keywords: ["books", "book", "tomes", "tome", "scrolls", "texts", "knowledge", "library", "reading"],
                    text: "Most have crumbled, sadly. Centuries of damp and neglect have taken their toll. But some survive — records of astronomical observations, ritual practices, philosophical texts on the nature of light and darkness. I have spent my eternity trying to preserve what I can, though a spirit's ability to interact with the physical world is... limited. Please, read what you can while you are here."
                },
                "yourself": {
                    keywords: ["yourself", "you", "librarian", "scholar", "who are you", "name"],
                    text: "I was the temple librarian — I served for thirty years, cataloguing, preserving, and teaching. When the temple fell, I chose to stay. I could not bear to leave the books unguarded. I have no regrets, though I will confess the solitude has grown... rather long. It is a genuine pleasure to have a visitor at last."
                }
            },
            give_old_manuscript: "Oh! You found the manuscript I prepared — I had tucked it away on the reading desk, hoping a worthy reader would find it. Since you have brought it to me, let me share what I know: the bookshelf on the west wall conceals a passage behind it. Push it firmly — it will reveal a corridor leading into the tunnels north and west. I hope this helps you on your way.",
            give_generic: "Ah, how kind of you to offer, but I find I have little use for physical objects these days. My needs have become rather... spiritual.",
            farewell: "Safe travels, and may the light of knowledge guide your path.",
            unknown_topic: "Hmm, I am not certain I have any useful information on that subject. Ask me about the bookshelf, the window, the scroll, or the crystal — those I can speak to with confidence."
        }
    },

    // ===== CENTURION VARRO (Barracks) =====
    "soldier_varro": {
        id: "soldier_varro",
        name: "Centurion Varro",
        shortName: "Varro",
        description: "A soldier in ancient military dress, his form slightly translucent — a ghost, but a gruff and solid-seeming one. He sits on the edge of a stone sleeping platform, polishing a sword that no longer exists.",
        location: "barracks",
        state: "idle",
        questGiver: false,
        tradeable: false,
        dialogue: {
            greeting: "Hmm? Who goes there? Living folk, by the look of you. Name's Varro — Centurion, Third Legion of the Eastern Temple Guard. We were stationed here when the priests left. Nobody came to relieve us. Eventually, well... here we are. What do you want?",
            greeting_repeat: "You again. What is it this time?",
            topics: {
                "keys": {
                    keywords: ["keys", "key", "iron key", "bronze key", "lock", "locked"],
                    text: "Keys? I know of two in this temple. The iron key — one of the priests dropped it in the dark alcove north of the storage room. I saw him do it before they all disappeared. The bronze key ended up in the collapsed tunnel east of that alcove, dropped during a cave-in. Both should still be there as far as I know. I can't pick things up anymore."
                },
                "passage": {
                    keywords: ["passage", "secret passage", "tunnel", "alcove", "dark alcove", "collapsed tunnel", "shortcut", "route"],
                    text: "There's a network of tunnels running beneath and around the temple. The dark alcove — north of the storage room — leads east into a collapsed tunnel, which in turn leads north to a hidden passage that comes out behind a bookshelf in the library. Useful if you know it's there. Take a light with you — that dark alcove is black as pitch without one."
                },
                "crystal": {
                    keywords: ["crystal", "light", "crystal of light", "priests", "purpose", "temple"],
                    text: "The crystal? I'm a soldier, not a priest. I know it existed and that it was important, and that when it went dark everything fell apart. The priests kept their business to themselves. Couldn't tell you much more than that. Try talking to the priest's ghost in the crypt if you want to know more — he's been down there long enough to know everything."
                },
                "yourself": {
                    keywords: ["yourself", "you", "varro", "centurion", "soldier", "guard", "who are you", "name"],
                    text: "I told you. Centurion Varro. I commanded the temple guard here for six years. When the priests vanished and the temple sealed itself, we had nowhere to go. We waited. Kept our posts. Eventually we stopped waiting. I still don't know what happened to the priests. I kept a journal — wrote everything I observed. I suppose it's still in the barracks somewhere."
                },
                "codex": {
                    keywords: ["codex", "journal", "your journal", "old codex", "leather codex", "book"],
                    text: "That's mine — or was. I kept careful notes of everything strange I observed in this temple: the lights in the sanctum, the priests' routines, the layout of every tunnel I could find. If you've found it and read it, you'll have a good picture of how this place connects together. There's one thing I didn't write down, though. If you give me the codex, I'll tell you."
                },
                "barracks": {
                    keywords: ["barracks", "sleeping platforms", "this room", "soldiers", "legion", "here"],
                    text: "This is where we slept and kept our gear. Not the grandest quarters, but soldiers don't get to be choosy. The lads who served with me were good men. The marks on the sleeping platform — I made those, counting the days. I stopped counting when I realised it wasn't going to matter anymore."
                },
                "layout": {
                    keywords: ["layout", "map", "rooms", "explore", "navigate", "where", "directions"],
                    text: "I explored this temple thoroughly in the years I was here. The main complex connects south and east to underground tunnels. There are gardens to the west of the temple entrance. A bell tower is accessible from the ritual chamber. The library connects to tunnels via a hidden bookshelf passage. The crypt is below the inner sanctum through a trapdoor. That about covers it."
                }
            },
            give_old_codex: "That's... that's my journal. Six years of observations — all the things I saw in this strange place. Here's what I didn't write down, because I didn't want anyone to find it: there's a loose stone in the north wall of the dark alcove, near where the iron key was left. I found a small cloth bundle behind it once. Whatever was in it, I put it back. I don't know if it's still there. Make of that what you will.",
            give_generic: "I appreciate the gesture, but I've got no use for it. Keep it — might come in handy for you.",
            farewell: "Watch your back in there. This temple has more secrets than priests.",
            unknown_topic: "Can't help you with that. Ask me about keys, passages, the tunnel layout, or the codex — that's what I know."
        }
    }

};

/**
 * Get NPC by ID
 */
export function getNPC(npcId) {
    return NPCS[npcId] ? { ...NPCS[npcId] } : null;
}

/**
 * Check if NPC exists
 */
export function npcExists(npcId) {
    return npcId in NPCS;
}
