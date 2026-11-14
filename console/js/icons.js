// Little line icons for the menus, drawn on a 16×16 grid with square caps so
// they read as pixels on the LCD. They use currentColor, so they glow with
// whatever screen tint is picked.

const svg = (body, cls = '') =>
    `<svg class="ico ${cls}" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter">${body}</svg>`;

export const ICONS = {
    all: svg('<rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/>'),
    new: svg('<path d="M8 1.5v4M8 10.5v4M1.5 8h4M10.5 8h4M4 4l1.8 1.8M10.2 10.2L12 12M12 4l-1.8 1.8M5.8 10.2L4 12"/>'),
    genres: svg('<path d="M2 3h5l1.5 2H14v8H2z"/><path d="M2 7h12"/>'),
    fav: svg('<path d="M8 1.8l1.9 4 4.3.5-3.2 3 .9 4.3L8 11.4l-3.9 2.2.9-4.3-3.2-3 4.3-.5z"/>'),
    recent: svg('<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 2"/>'),
    cover: svg('<path d="M1.5 4l3 1v6l-3 1z"/><rect x="5.5" y="3" width="5" height="10"/><path d="M14.5 4l-3 1v6l3 1z"/>'),
    search: svg('<circle cx="6.5" cy="6.5" r="4.3"/><path d="M10 10l4.5 4.5"/>'),
    shuffle: svg('<path d="M1.5 4.5h3l6 7h4M1.5 11.5h3l1.8-2.1M9 6.6l1.5-2.1h4"/><path d="M12.5 2.5l2 2-2 2M12.5 9.5l2 2-2 2"/>'),
    settings: svg('<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/>'),
    about: svg('<circle cx="8" cy="8" r="6.3"/><path d="M8 7v4.5M8 4.4v.2"/>'),
    sound: svg('<path d="M2 6h3l4-3v10l-4-3H2z"/><path d="M11.5 5.5a3.5 3.5 0 010 5M13.5 3.5a6.3 6.3 0 010 9"/>'),
    haptics: svg('<rect x="5" y="2" width="6" height="12" rx="1"/><path d="M2 5v6M14 5v6"/>'),
    shell: svg('<rect x="3" y="1.5" width="10" height="13" rx="2"/><rect x="5" y="3.5" width="6" height="4"/><circle cx="8" cy="11" r="1.8"/>'),
    screen: svg('<rect x="1.5" y="2.5" width="13" height="9"/><path d="M5 14.5h6M8 11.5v3"/>'),
    tab: svg('<path d="M9 2.5h4.5V7M13.5 2.5L8 8"/><path d="M11.5 9.5v4h-9v-9h4"/>'),
    trash: svg('<path d="M2.5 4h11M6 4V2.5h4V4M4 4l.8 10h6.4L12 4"/>'),
    garden: svg('<path d="M8 14.5V7"/><path d="M8 9c-3.5 0-5-2-5-5 3 0 5 1.5 5 5zM8 7.5c0-3 1.7-5 5-5 0 3.3-1.7 5-5 5z"/>'),
    list: svg('<path d="M5 4h9M5 8h9M5 12h9M2 4h.5M2 8h.5M2 12h.5"/>'),
    person: svg('<circle cx="8" cy="5.5" r="3"/><path d="M2.5 14.5c.5-3 2.6-4.5 5.5-4.5s5 1.5 5.5 4.5"/>'),
    keys: svg('<rect x="1.5" y="4" width="13" height="8" rx="1"/><path d="M4 7h.5M7 7h.5M10 7h.5M5 9.5h6"/>'),
    play: svg('<path d="M4.5 2.5v11l9-5.5z" fill="currentColor"/>'),
    chip: svg('<rect x="4" y="4" width="8" height="8"/><path d="M6 1.5v2.5M10 1.5v2.5M6 12v2.5M10 12v2.5M1.5 6H4M1.5 10H4M12 6h2.5M12 10h2.5"/>'),
};
