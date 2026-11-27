// Every voiced line: who says it and the subtitle. The audio file is audio/vo-<id>.mp3.

export const LINES = {
    'rin-launch':      { who: 'rin', text: "Hayate, launching! Let's ride the current!" },
    'rin-jump':        { who: 'rin', text: 'Hayate... JUMP!' },
    'rin-boss':        { who: 'rin', text: "That's a fortress. Tomo, I'm going in!" },
    'rin-core':        { who: 'rin', text: 'Its core is open. Now!' },
    'rin-bosskill':    { who: 'rin', text: 'Down it goes! On to the next sector!' },
    'rin-lowhull':     { who: 'rin', text: "Hull's breaking up... hang in there, Hayate!" },
    'rin-overdrive':   { who: 'rin', text: 'Overdrive! Full throttle!' },
    'rin-over':        { who: 'rin', text: "Sorry, Tomo... I'll be back." },
    'rin-victory':     { who: 'rin', text: 'The river is free! Hayate, mission complete!' },
    'tomo-start':      { who: 'tomo', text: 'All systems green. Good luck out there, Rin!' },
    'tomo-fuel':       { who: 'tomo', text: "Rin, fuel's running low! Hit a depot!" },
    'tomo-mini':       { who: 'tomo', text: 'Heavy unit coming in! Watch its guns!' },
    'tomo-boss':       { who: 'tomo', text: 'Boss incoming! Its core is shielded. Break the outer guns first!' },
    'tomo-overdrive':  { who: 'tomo', text: "It's going into overdrive! Watch the warning lines!" },
    'tomo-dock':       { who: 'tomo', text: "Nice work, Rin! Bring her into the dock. I'll patch you up." },
    'kurogane-taunt':  { who: 'kurogane', text: 'So, the little boat dares to sail my river.' },
    'kurogane-final':  { who: 'kurogane', text: 'Tetsuren will crush you beneath the Iron Lotus!' },
    'kurogane-defeat': { who: 'kurogane', text: 'Impossible... my fleet...' },
};

export const CAST = {
    rin: { name: 'RIN', full: 'Rin Kazamatsuri', color: '#46e0ff' },
    tomo: { name: 'TOMO', full: 'Tomo Ishida', color: '#ffb63c' },
    kurogane: { name: 'KUROGANE', full: 'Commodore Kurogane', color: '#ff3d5a' },
};
