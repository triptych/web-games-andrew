// Everything you can carry. `use` items are spent from the pack panel; `keep` items cannot be dropped.

export const ITEMS = {
    sequencer: { name: 'Handheld sequencer', blurb: 'reads a living genome in the field', glyph: '▤',
        desc: 'A brick of grey plastic with a pin-hole sampler and a green screen. It reads bases off living tissue, slowly, if you hold still.' },
    kit: { name: 'Sample kit', blurb: 'vials, tweezers and a cold-pack for living specimens', glyph: '▥',
        desc: 'Twelve sealed vials, tweezers, a cold-pack and a scalpel. Takes living specimens without killing them, and cuts straps.' },
    uv: { name: 'UV lamp', blurb: 'shows markings the eye cannot see', glyph: '☼',
        desc: 'A hand lamp that throws long-wave ultraviolet. Made for fluorescent stains; good for anything that glows when it shouldn\'t.' },
    torch: { name: 'Cutting torch', blurb: 'for thorns, hatches, and worse', glyph: '♨',
        desc: 'A bottle of fuel and a blue nozzle that will cut a bulkhead. It will cut most things.' },
    stim: { name: 'Stim injector', blurb: 'one dose; restores 4 health', glyph: '✚', use: { health: 4 },
        desc: 'One spring-loaded dose of medical stimulant. Restores 4 health. Use it from the pack.' },
    mask: { name: 'Spore mask', blurb: 'filters the air where it is thick with spores', glyph: '◙',
        desc: 'A fitted filter mask. Where the air is full of spores you will be glad of it.' },
    tabs: { name: 'Focus tablets', blurb: 'restore 3 clarity, once', glyph: '◦', use: { clarity: 3 },
        desc: 'A strip of white tablets from the station medic\'s drawer. Restores 3 clarity. Use it from the pack.' },
    tuner: { name: 'Osei\'s tuner', blurb: 'brass coils tuned to three rising notes', glyph: '♪', keep: true,
        desc: 'Dr. Osei\'s hand-built device: brass, steel and a ring of coils. It hums the three notes. It seems to have been made to be answered.' },
    shard: { name: 'Lattice shard', blurb: 'humming crystal chitin', glyph: '◆', keep: true,
        desc: 'A hand-sized shard of crystalline chitin, ringed with the 4,096 motif. It hums against your palm like a held breath.' },
};

/** What the equipment locker offers. Seven things; the pack holds six. */
export const GEAR = ['sequencer', 'kit', 'uv', 'torch', 'stim', 'mask', 'tabs'];
