// The click wheel. Drag a finger (or the mouse) round the ring and every 15°
// is one tick; clockwise goes down the list. A tap that doesn't turn the wheel
// presses whichever of the four buttons is under it (MENU at the top, ⏮ ⏭ at
// the sides, ⏯ at the bottom). The center button selects, and holding it
// toggles the highlighted game's favorite. The mouse wheel turns it too.
//
// The four buttons are real <button>s so they stay reachable by keyboard; a
// pointer tap is handled here, and their own click only counts when it comes
// from the keyboard (event.detail === 0), so nothing fires twice.

const TICK = Math.PI / 12; // 15°, 24 ticks a turn
const HOLD_MS = 520;

const norm = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
};

function zoneOf(angle) {
    const deg = (angle * 180) / Math.PI; // 0 = right, 90 = down
    if (deg > -45 && deg <= 45) return 'next';
    if (deg > 45 && deg <= 135) return 'play';
    if (deg > -135 && deg <= -45) return 'menu';
    return 'prev';
}

/**
 * @param {HTMLElement} wheel the ring
 * @param {HTMLElement} center the center button
 * @param {{tick(dir:number):void, press(btn:string):void, select():void, hold():void, down?():void}} on
 */
export function attachWheel(wheel, center, on) {
    let drag = null;
    const glint = wheel.querySelector('.wheel-glint');
    const buttons = Object.fromEntries([...wheel.querySelectorAll('[data-btn]')].map((b) => [b.dataset.btn, b]));

    const angleOf = (e) => {
        const r = wheel.getBoundingClientRect();
        return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    };
    const showGlint = (a, on2 = true) => {
        if (!glint) return;
        glint.style.setProperty('--ga', `${(a * 180) / Math.PI + 90}deg`);
        glint.classList.toggle('on', on2);
    };
    const press = (zone, down) => buttons[zone]?.classList.toggle('pressed', down);

    wheel.addEventListener('pointerdown', (e) => {
        if (e.button > 0 || center.contains(e.target)) return;
        e.preventDefault();
        on.down?.();
        try {
            wheel.setPointerCapture(e.pointerId);
        } catch {
            /* synthetic pointer */
        }
        const a = angleOf(e);
        drag = { id: e.pointerId, last: a, acc: 0, moved: 0, ticks: 0, zone: zoneOf(a) };
        press(drag.zone, true);
        showGlint(a);
    });

    const turn = (e) => {
        const a = angleOf(e);
        const d = norm(a - drag.last);
        drag.last = a;
        drag.acc += d;
        drag.moved += Math.abs(d);
        showGlint(a);
        if (drag.moved > TICK * 0.6) press(drag.zone, false);
        while (drag.acc >= TICK) {
            drag.acc -= TICK;
            drag.ticks++;
            on.tick(1);
        }
        while (drag.acc <= -TICK) {
            drag.acc += TICK;
            drag.ticks++;
            on.tick(-1);
        }
    };
    wheel.addEventListener('pointermove', (e) => {
        if (drag && e.pointerId === drag.id) turn(e);
    });

    const end = (e, cancelled) => {
        if (!drag || e.pointerId !== drag.id) return;
        // fast moves are coalesced: count the turn up to where the finger lifted
        if (!cancelled) turn(e);
        press(drag.zone, false);
        showGlint(drag.last, false);
        if (!cancelled && drag.ticks === 0 && drag.moved < TICK * 0.6) on.press(drag.zone);
        drag = null;
    };
    wheel.addEventListener('pointerup', (e) => end(e, false));
    wheel.addEventListener('pointercancel', (e) => end(e, true));
    wheel.addEventListener('lostpointercapture', (e) => end(e, true));

    for (const [name, b] of Object.entries(buttons)) {
        b.addEventListener('click', (e) => {
            if (e.detail === 0) on.press(name);
        });
    }

    // the mouse wheel / trackpad turns it
    let wacc = 0;
    wheel.addEventListener(
        'wheel',
        (e) => {
            e.preventDefault();
            wacc += e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
            while (wacc >= 40) {
                wacc -= 40;
                on.tick(1);
            }
            while (wacc <= -40) {
                wacc += 40;
                on.tick(-1);
            }
        },
        { passive: false },
    );

    // center: tap selects, hold favorites
    let hold = null;
    center.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        e.preventDefault();
        on.down?.();
        center.classList.add('pressed');
        hold = { id: e.pointerId, fired: false };
        hold.timer = setTimeout(() => {
            if (!hold) return;
            hold.fired = true;
            center.classList.add('held');
            on.hold();
        }, HOLD_MS);
    });
    const centerEnd = (e, cancelled) => {
        if (!hold || e.pointerId !== hold.id) return;
        clearTimeout(hold.timer);
        center.classList.remove('pressed', 'held');
        if (!cancelled && !hold.fired) on.select();
        hold = null;
    };
    center.addEventListener('pointerup', (e) => centerEnd(e, false));
    center.addEventListener('pointercancel', (e) => centerEnd(e, true));
    center.addEventListener('pointerleave', (e) => centerEnd(e, true));
    center.addEventListener('click', (e) => {
        if (e.detail === 0) on.select();
    });
    center.addEventListener('contextmenu', (e) => e.preventDefault());
    wheel.addEventListener('contextmenu', (e) => e.preventDefault());

    // The wheel runs on pointer events. Cancelling its touch events as well
    // stops the browser building a scroll/fling gesture out of a spin: it
    // scrolls nothing (touch-action: none), but Chromium still swallows the
    // next tap anywhere on the page as the tap that "stops the fling".
    const cancelTouch = (e) => {
        if (e.cancelable) e.preventDefault();
    };
    wheel.addEventListener('touchstart', cancelTouch, { passive: false });
    wheel.addEventListener('touchmove', cancelTouch, { passive: false });
}
