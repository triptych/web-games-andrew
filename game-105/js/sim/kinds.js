// The kinds of device that come through the door. Pure data: the generator turns one of these,
// a tier and a seed into a layout of slots, parts and cables.
//
// roles: [role, module, minTier, display name]. Roles with minTier 1 are always built; the others
//   join as the tier rises, up to the tier's module budget.
// wires: [from, to, kind]; "role.port" or "board.#" (the generator adds a socket on the board).

const R = (role, mod, min, name) => ({ role, mod, min, name });

export const KINDS = {
    noodlebot: {
        name: 'Noodle-bot arm', shell: 'arm', dims: [8.6, 5.2], holes: ['phil', 'phil', 'flat'], gov: false, minTier: 1,
        accent: 0xff7a3d, body: 0x8b8f99, blurb: 'a stall robot that ladles and tosses noodles',
        roles: [R('cell', 'cell', 1, 'Main cell'), R('fuse', 'fuse', 1, 'Main fuse'), R('board', 'board', 1, 'Control board'),
            R('servo', 'servo', 1, 'Ladle servo'), R('fan', 'fan', 2, 'Steam fan'), R('servo2', 'servo', 3, 'Tossing servo')],
        wires: [['cell.pos', 'fuse.in', 'pwr'], ['fuse.out', 'board.#', 'pwr'], ['cell.neg', 'board.#', 'gnd'],
            ['board.#', 'servo.sig', 'sig'], ['board.#', 'servo.pwr', 'pwr'], ['board.#', 'fan.pwr', 'pwr'],
            ['board.#', 'servo2.sig', 'sig'], ['board.#', 'servo2.pwr', 'pwr']],
        anim: 'arm', symptoms: { burnt: 'It went pop and now it smells like burnt toast.', dead: 'Dead as a doornail. No lights, nothing.' },
    },
    radio: {
        name: 'Tube radio', shell: 'radio', dims: [8.8, 5.4], holes: ['phil', 'flat'], gov: false, minTier: 1,
        accent: 0xffc24d, body: 0x6b4a36, blurb: 'a valve-and-silicon set that still picks up the old stations',
        roles: [R('cell', 'cell', 1, 'Battery'), R('fuse', 'fuse', 1, 'Line fuse'), R('board', 'board', 1, 'Tuner board'),
            R('speaker', 'speaker', 1, 'Speaker'), R('relay', 'relay', 2, 'Band relay'), R('switch', 'switch', 2, 'Band switch'), R('fan', 'fan', 4, 'Cooling fan')],
        wires: [['cell.pos', 'fuse.in', 'pwr'], ['fuse.out', 'board.#', 'pwr'], ['cell.neg', 'board.#', 'gnd'],
            ['board.#', 'speaker.sig', 'sig'], ['board.#', 'relay.in', 'pwr'], ['relay.out', 'board.#', 'sig'],
            ['switch.a', 'board.#', 'pwr'], ['switch.b', 'board.#', 'sig'], ['board.#', 'fan.pwr', 'pwr']],
        anim: 'radio', symptoms: { burnt: 'Crackles, then silence.', dead: 'Nothing but a hum, then nothing.' },
    },
    hovercoil: {
        name: 'Hover-coil unit', shell: 'coil', dims: [10.8, 6.2], holes: ['hex10', 'hex8', 'phil'], gov: false, minTier: 2,
        accent: 0x35e0ff, body: 0x5c6470, blurb: 'the lift core out of a courier hoverboard',
        roles: [R('cell', 'cell', 1, 'Lift cell'), R('fuse', 'fuse', 1, 'Surge fuse'), R('board', 'board', 1, 'Lift controller'),
            R('coil', 'coil', 1, 'Port coil'), R('coil2', 'coil', 1, 'Starboard coil'), R('fan', 'fan', 2, 'Coil cooler'), R('relay', 'relay', 3, 'Surge relay')],
        wires: [['cell.pos', 'fuse.in', 'pwr'], ['fuse.out', 'board.#', 'pwr'], ['cell.neg', 'board.#', 'gnd'],
            ['board.#', 'coil.a', 'pwr'], ['coil.b', 'board.#', 'gnd'], ['board.#', 'coil2.a', 'pwr'], ['coil2.b', 'board.#', 'gnd'],
            ['board.#', 'fan.pwr', 'pwr'], ['board.#', 'relay.in', 'pwr'], ['relay.out', 'board.#', 'sig']],
        anim: 'coil', symptoms: { burnt: 'Lost lift on the left, then a bang.', dead: 'Won\'t even spin up.' },
    },
    drone: {
        name: 'Courier drone', shell: 'drone', dims: [9.8, 6.6], holes: ['phil', 'hex8'], gov: true, minTier: 2,
        accent: 0x7dff6b, body: 0x4d5560, blurb: 'a quad-rotor with a cargo hook and a camera',
        roles: [R('cell', 'cell', 1, 'Flight cell'), R('fuse', 'fuse', 1, 'Flight fuse'), R('board', 'board', 1, 'Flight board'),
            R('fan', 'fan', 1, 'Rotor A'), R('fan2', 'fan', 1, 'Rotor B'), R('lens', 'lens', 2, 'Camera'), R('fan3', 'fan', 4, 'Rotor C'), R('relay', 'relay', 3, 'Hook relay')],
        wires: [['cell.pos', 'fuse.in', 'pwr'], ['fuse.out', 'board.#', 'pwr'], ['cell.neg', 'board.#', 'gnd'],
            ['board.#', 'fan.pwr', 'pwr'], ['board.#', 'fan2.pwr', 'pwr'], ['board.#', 'lens.sig', 'sig'],
            ['board.#', 'fan3.pwr', 'pwr'], ['board.#', 'relay.in', 'pwr'], ['relay.out', 'board.#', 'sig']],
        anim: 'drone', symptoms: { burnt: 'One rotor smoked and it flopped out of the sky.', dead: 'Power light never comes on.' },
    },
    blaster: {
        name: 'Service blaster', shell: 'blaster', dims: [11.2, 5.4], holes: ['hex8', 'phil', 'hex10'], gov: true, minTier: 2,
        accent: 0xff3d6e, body: 0x3d424d, blurb: 'a standard-issue sidearm with a charge coil and an emitter lens',
        roles: [R('cell', 'cell', 1, 'Charge cell'), R('fuse', 'fuse', 1, 'Charge fuse'), R('board', 'board', 1, 'Fire-control board'),
            R('lens', 'lens', 1, 'Emitter lens'), R('relay', 'relay', 1, 'Trigger relay'), R('coil', 'coil', 2, 'Charge coil'), R('switch', 'switch', 3, 'Selector switch')],
        wires: [['cell.pos', 'fuse.in', 'pwr'], ['fuse.out', 'board.#', 'pwr'], ['cell.neg', 'board.#', 'gnd'],
            ['board.#', 'lens.sig', 'sig'], ['board.#', 'relay.in', 'pwr'], ['relay.out', 'board.#', 'sig'],
            ['board.#', 'coil.a', 'pwr'], ['coil.b', 'board.#', 'gnd'], ['switch.a', 'board.#', 'pwr'], ['switch.b', 'board.#', 'sig']],
        anim: 'blaster', symptoms: { burnt: 'Fired once and the grip got hot enough to fry an egg.', dead: 'Trigger does nothing.' },
    },
    console: {
        name: 'Nav console', shell: 'console', dims: [11.4, 6.8], holes: ['phil', 'flat', 'hex8'], gov: false, minTier: 2,
        accent: 0x59ffb4, body: 0x40505c, blurb: 'a ship\'s navigation console, salvaged and sorely used',
        roles: [R('cell', 'cell', 1, 'Backup cell'), R('fuse', 'fuse', 1, 'Bus fuse'), R('board', 'board', 1, 'Nav board'),
            R('display', 'display', 1, 'Chart display'), R('switch', 'switch', 1, 'Mode switch'), R('display2', 'display', 3, 'Status display'),
            R('speaker', 'speaker', 3, 'Alarm speaker'), R('relay', 'relay', 4, 'Bus relay')],
        wires: [['cell.pos', 'fuse.in', 'pwr'], ['fuse.out', 'board.#', 'pwr'], ['cell.neg', 'board.#', 'gnd'],
            ['board.#', 'display.sig', 'sig'], ['switch.a', 'board.#', 'pwr'], ['switch.b', 'board.#', 'sig'],
            ['board.#', 'display2.sig', 'sig'], ['board.#', 'speaker.sig', 'sig'], ['board.#', 'relay.in', 'pwr'], ['relay.out', 'board.#', 'sig']],
        anim: 'console', symptoms: { burnt: 'The screens flicker and something stinks of hot plastic.', dead: 'Blank. Not even the boot logo.' },
    },
    cyberarm: {
        name: 'Cybernetic arm', shell: 'cyberarm', dims: [11.8, 5.8], holes: ['phil', 'hex8', 'flat'], gov: true, minTier: 3,
        accent: 0x9d6bff, body: 0x6d7480, blurb: 'a prosthetic forearm with servo fingers and a wrist actuator',
        roles: [R('cell', 'cell', 1, 'Limb cell'), R('fuse', 'fuse', 1, 'Limb fuse'), R('board', 'board', 1, 'Nerve board'),
            R('servo', 'servo', 1, 'Thumb servo'), R('actuator', 'actuator', 2, 'Wrist actuator'), R('servo2', 'servo', 2, 'Finger servo'),
            R('gear', 'gear', 3, 'Grip gears'), R('servo3', 'servo', 4, 'Elbow servo'), R('fan', 'fan', 4, 'Heat fan')],
        wires: [['cell.pos', 'fuse.in', 'pwr'], ['fuse.out', 'board.#', 'pwr'], ['cell.neg', 'board.#', 'gnd'],
            ['board.#', 'servo.sig', 'sig'], ['board.#', 'servo.pwr', 'pwr'], ['board.#', 'actuator.sig', 'sig'], ['board.#', 'actuator.pwr', 'pwr'],
            ['board.#', 'servo2.sig', 'sig'], ['board.#', 'servo2.pwr', 'pwr'], ['board.#', 'servo3.sig', 'sig'], ['board.#', 'servo3.pwr', 'pwr'], ['board.#', 'fan.pwr', 'pwr']],
        anim: 'arm', symptoms: { burnt: 'Fingers twitch and then it goes limp, smelling of ozone.', dead: 'Doesn\'t answer at all.' },
    },
    robohead: {
        name: 'Service-bot head', shell: 'head', dims: [9.8, 7.2], holes: ['phil', 'flat', 'hex8'], gov: true, minTier: 3,
        accent: 0x4dd6ff, body: 0xa0a6b0, blurb: 'a hotel concierge head with two eyes and a polite voice',
        roles: [R('cell', 'cell', 1, 'Head cell'), R('fuse', 'fuse', 1, 'Head fuse'), R('board', 'board', 1, 'Personality board'),
            R('lens', 'lens', 1, 'Left eye'), R('lens2', 'lens', 1, 'Right eye'), R('speaker', 'speaker', 1, 'Voice speaker'),
            R('servo', 'servo', 2, 'Neck servo'), R('fan', 'fan', 3, 'Skull fan')],
        wires: [['cell.pos', 'fuse.in', 'pwr'], ['fuse.out', 'board.#', 'pwr'], ['cell.neg', 'board.#', 'gnd'],
            ['board.#', 'lens.sig', 'sig'], ['board.#', 'lens2.sig', 'sig'], ['board.#', 'speaker.sig', 'sig'],
            ['board.#', 'servo.sig', 'sig'], ['board.#', 'servo.pwr', 'pwr'], ['board.#', 'fan.pwr', 'pwr']],
        anim: 'head', symptoms: { burnt: 'It says "I am delighted to" and then smoke comes out of its ears.', dead: 'Eyes dark. Nobody home.' },
    },
    cybereye: {
        name: 'Ocular implant', shell: 'eye', dims: [7.4, 5.6], holes: ['phil', 'flat'], gov: true, minTier: 3,
        accent: 0xff9f3d, body: 0x9aa0a8, blurb: 'a retinal implant cradle, magnified under the bench scope',
        roles: [R('cell', 'cell', 1, 'Micro cell'), R('board', 'board', 1, 'Optic board'), R('lens', 'lens', 1, 'Main lens'),
            R('servo', 'servo', 1, 'Iris servo'), R('fuse', 'fuse', 2, 'Guard fuse'), R('servo2', 'servo', 3, 'Focus servo')],
        wires: [['cell.pos', 'board.#', 'pwr'], ['cell.neg', 'board.#', 'gnd'], ['board.#', 'lens.sig', 'sig'],
            ['board.#', 'servo.sig', 'sig'], ['board.#', 'servo.pwr', 'pwr'], ['board.#', 'servo2.sig', 'sig'], ['board.#', 'servo2.pwr', 'pwr'], ['board.#', 'fuse.in', 'pwr']],
        anim: 'eye', symptoms: { burnt: 'Everything on the left goes white, then black.', dead: 'Left side just... gone.' },
    },
    spanner: {
        name: 'Spanner (shop-bot)', shell: 'spanner', dims: [11.4, 7.4], holes: ['phil', 'hex8', 'flat', 'hex10'], gov: false, minTier: 5,
        accent: 0xffd23d, body: 0xb59b5a, blurb: 'a one-wheeled bench companion with a work lamp for an eye',
        roles: [R('cell', 'cell', 1, 'Core cell'), R('fuse', 'fuse', 1, 'Core fuse'), R('board', 'board', 1, 'Personality board'),
            R('lens', 'lens', 1, 'Lamp eye'), R('servo', 'servo', 1, 'Neck servo'), R('speaker', 'speaker', 1, 'Voice speaker'),
            R('relay', 'relay', 1, 'Memory relay'), R('fan', 'fan', 1, 'Chest fan')],
        wires: [['cell.pos', 'fuse.in', 'pwr'], ['fuse.out', 'board.#', 'pwr'], ['cell.neg', 'board.#', 'gnd'],
            ['board.#', 'lens.sig', 'sig'], ['board.#', 'servo.sig', 'sig'], ['board.#', 'servo.pwr', 'pwr'],
            ['board.#', 'speaker.sig', 'sig'], ['board.#', 'relay.in', 'pwr'], ['relay.out', 'board.#', 'sig'], ['board.#', 'fan.pwr', 'pwr']],
        anim: 'spanner', symptoms: {},
    },
};

/** Which kinds a walk-in can bring on a given day (tiers rise through the week). */
export function kindsForTier(tier) {
    return Object.keys(KINDS).filter((k) => k !== 'spanner' && KINDS[k].minTier <= tier);
}

export const SYS_FAIL = {
    bad: (s) => `A component in the ${s} stage has failed.`,
    corr: (s) => `Resistance is high in the ${s} stage. Something is corroded.`,
    clog: (s) => `The ${s} stage is choking on gunk.`,
    seized: (s) => `The ${s} stage binds up. Something is stuck.`,
    joint: (s) => `The ${s} stage cuts in and out. A bad joint, maybe.`,
    loose: (s) => `The ${s} stage rattles. Something isn't fastened down.`,
    missing: (s) => `The ${s} stage has a part missing.`,
    unplugged: (s) => `A cable in the ${s} circuit isn't carrying anything.`,
    cut: (s) => `A cable in the ${s} circuit is broken.`,
};
