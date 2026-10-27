// Things you can carry. `at` is where it starts: a room id, or 'limbo' (not anywhere yet; a rule
// puts it in the world or hands it over). Potions and herbs are not here: they are counted in
// G.stock (see lore.js).

export const ITEMS = {
    satchel: {
        name: 'Marga\'s satchel', names: ['satchel', 'bag', 'marga\'s satchel', 'pack'], at: 'cottage',
        look: 'A scuffed leather satchel with a dozen small pockets, patched at the corners. It smells of dried herbs and woodsmoke. Everything a witch picks up goes in it.',
        takeText: 'You sling Marga\'s satchel over your shoulder. It is still warm from the peg beside the hearth. Or perhaps that is only you.',
    },
    kettle: {
        name: 'copper kettle', names: ['kettle', 'copper kettle', 'pot'], at: 'cottage',
        look: 'Marga\'s battered copper kettle, black on the bottom and bright on the lid. It is still warm. You can BREW with it anywhere, though you will have to be quick about the fire.',
        takeText: 'You lift the kettle off its hook. It is warm.',
    },
    lantern: {
        name: 'horn lantern', names: ['lantern', 'horn lantern', 'lamp'], at: 'cottage',
        look: (G) => G.flags.lantern_lit ? 'A horn lantern, lit with a small, steady witchflame.' : 'A horn lantern with a stub of tallow candle in it. It is not lit.',
        takeText: 'You take the lantern from its hook.',
    },
    note: {
        name: 'Marga\'s note', names: ['note', 'letter', 'paper', 'marga\'s note', 'folded paper', 'message'], at: 'cottage',
        look: 'A sheet of coarse paper, folded once, in Marga\'s looping hand. It was tucked under a teacup. You can READ it.',
        takeText: 'You fold the note into your sleeve.',
    },
    button: {
        name: 'brass crow button', names: ['button', 'crow button', 'brass button', 'brass crow'], at: 'limbo',
        look: 'A heavy brass button stamped with a crow in flight, torn from a coat with a bit of black thread still in it. The badge of the Governor\'s bailiffs. Everyone in Ashwick knows to cross the road when they see one.',
    },
    purse: {
        name: 'coin purse', names: ['purse', 'coin purse', 'coins', 'silver', 'money'], at: 'limbo',
        look: 'A small cloth purse with eight silver pennies in it: Marga\'s hearth-stone savings.',
    },
    herbal: {
        name: 'Marga\'s Herbal', names: ['herbal', 'book', 'herbarium', 'marga\'s herbal', 'grimoire'], at: 'stillroom',
        look: 'A thick, much-mended book bound in green cloth. It is Marga\'s Herbal: pressed leaves, drawings in a looping hand, and a lifetime of notes. A few pages near the back have been torn out, ragged and fresh. You can READ it, and STUDY any plant you find with it in your satchel.',
        takeText: 'You close the Herbal carefully and take it, the way you would carry a sleeping animal.',
    },
    apron: {
        name: 'nurse\'s apron', names: ['apron', 'nurse\'s apron', 'uniform'], at: 'tanner',
        look: 'A starched white nurse\'s apron with the Infirmary\'s crow stitched on the bib. It smells of carbolic.',
    },
    cap: {
        name: 'nurse\'s cap', names: ['cap', 'nurse\'s cap', 'hat'], at: 'tanner',
        look: 'A stiff white nurse\'s cap, with a crow embroidered on the band.',
    },
    scullery_key: {
        name: 'scullery key', names: ['scullery key', 'key', 'small key', 'brass key', 'back door key'], at: 'tanner',
        look: 'A small, worn brass key. Mrs. Tanner scrubs Pell\'s scullery, and this opens its back door.',
    },
    iron_key: {
        name: 'iron key', names: ['iron key', 'key', 'big key', 'heavy key'], at: 'limbo',
        look: 'A heavy iron key, black with age, with a tag in a doctor\'s hand: SALTERS\' DOOR. It is cold in your palm.',
    },
    slip: {
        name: 'delivery slip', names: ['slip', 'delivery slip', 'paper', 'docket'], at: 'limbo',
        look: 'A crumpled delivery docket. READ it.',
        readText: 'A delivery docket in a clerk\'s round hand: "To Pell\'s Cure-All, from the Cray Infirmary, Salt Wagon No. 7: forty gallons Tonic No. 9, base only (brewed by the Brine Works, Gallows Hill). Pell to dilute to taste, bottle and price at Governor\'s Rate. NOTE: Hollow Moon cargo on the same wagon: eleven persons, quiet." Someone has underlined *eleven persons* twice.',
    },
    chart: {
        name: 'patient chart', names: ['chart', 'patient chart', 'clipboard', 'bed chart'], at: 'ward',
        look: 'A clipboard with a patient\'s chart. READ it.',
        readText: 'ALDER, T., farmer. Admitted: six weeks ago. Complaint: a cough. Treatment: Tonic No. 9, two doses daily. "CONTINUE. DO NOT DISCHARGE." Every day for six weeks, in the same neat hand, the same note: "Patient fit for discharge. Retain. Fee accrues." The chart has been dated, signed and countersigned: C. Vesper.',
    },
    ledger_page: {
        name: 'ledger page', names: ['page', 'ledger page', 'ledger', 'torn page'], at: 'limbo',
        look: 'A heavy vellum page torn from the Acquisitions Ledger. READ it.',
        readText: 'ACQUISITIONS, in a doctor\'s neat hand. A list: "T. Wick, Nettlebed, 1 healer. Mrs. A. Dunmore, Foxglove Mill, 1 healer, blinded in transport. Widow Harrow, Hob Lane, 1 healer, fever. The Misses Pennywhistle, Quince Cottage, 2 healers, collared. M. Thistle, Hollow Lane, 1 healer, REFUSES." Below, in a different hand: "Quota to the Governor by the Hollow Moon: eleven. Each, at forty gallons a month, is worth a hundred patients."',
    },
    letter: {
        name: 'Governor\'s letter', names: ['letter', 'governor\'s letter', 'envelope', 'paper', 'sealed letter'], at: 'limbo',
        look: 'A letter on thick paper, with a broken wax seal: a crow. READ it.',
        readText: 'To Dr. C. Vesper, from Governor A. Cray: "My dear Cordelia. The Edict will be posted tomorrow: from the Hollow Moon, no cure may be sold or given in the county save through the Infirmary or Pell. Your kitchen witches may keep brewing for as long as we keep them breathing. The farmers will come to us for every bruise, or they will bleed. I shall ride out to the Vaults at midnight to oversee the wagons myself. Burn this. — A.C."',
    },
    pages: {
        name: 'torn pages', names: ['pages', 'torn pages', 'wintergreen rite', 'rite', 'herbal pages'], at: 'limbo',
        look: 'Three pages torn from the back of Marga\'s Herbal, folded small. READ them.',
    },
    cell_keys: {
        name: 'cell keys', names: ['keys', 'cell keys', 'key ring', 'ring'], at: 'vaults',
        look: 'A big iron ring of cell keys, hung on a hook on the nearest pillar.',
        takeText: 'You lift the ring off its hook, wincing at every jingle.',
    },
    tonic: {
        name: 'bottle of Tonic No. 9', names: ['tonic', 'bottle', 'tonic no 9', 'tonic number nine', 'no 9'], at: 'limbo',
        look: 'A squat brown bottle with a gilt label: TONIC No. 9, "THE GOVERNOR\'S OWN. Cures all that ails." The liquid inside is the colour of weak tea. Under the label, almost invisible, someone has scratched a tiny sprig of rue.',
    },
    manifest: {
        name: 'torn manifest', names: ['manifest', 'scrap', 'torn manifest', 'cart manifest', 'scrap of paper'], at: 'limbo',
        look: 'A torn corner of a cart manifest, found among the flour sacks. READ it.',
        readText: 'A torn corner: "...SALT WAGON No. 7. Foxglove Mill, one (female, old, fighting). Four crates, \"brine.\" To the Brine Vaults, Gallows Hill, by the Salt Road..." The rest has been torn away.',
    },
};
