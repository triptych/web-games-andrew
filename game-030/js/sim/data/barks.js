// Short voiced battle lines: a hero calls an ability out, cheers a win or falls. Rationed in js/audio.js (one at
// a time, and not every turn) so battles don't turn into chatter. Keys are ability ids, plus win and ko.

export const BARKS = {
    wick: { overclock: 'Tighten up!', patch: 'Hold still, this might sting.', scatter: 'Catch!', jury_rig: 'Spanner in the works!', win: 'Nice and tidy.', ko: 'Ow. Just... ow.' },
    trina: { zap: 'Zap!', storm: 'Sprocket storm!', rust_dust: 'Rust never sleeps!', tune_up: 'Now we\'re cooking!', win: 'I knew that would work.', ko: 'That was... unplanned.' },
    mabel: { tea_time: 'Have a nice cuppa.', clang: 'Mind your manners!', warm_scone: 'Scones all round!', blanket: 'Snug as a bug!', win: 'And stay out of my kitchen.', ko: 'Oh, my poor oven...' },
    bigbertha: { gear_slam: 'GEAR SLAM!', steam: 'Hot enough for you?', shed_cogs: 'Cogs! To me!', temper: 'NOW I\'M CROSS!' },
};
