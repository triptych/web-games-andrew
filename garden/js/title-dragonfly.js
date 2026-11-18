// The dragonfly on the title screen. While the island loads it flies out from
// behind the left edge of the title card, swoops round in front of it trailing
// sparkles, and slips back round behind the right edge, then out of sight
// behind the frosted glass before it comes round again (the way a fairy loops
// a castle at the start of a film).
//
// It has two layers in the title screen: .tdf-back sits under the title card
// (whose frosted glass blurs it) and .tdf-front over it. Each frame puts the
// dragonfly on an orbit round the card's middle and moves it to whichever
// layer its side of the orbit is on. Sparkles stay in the layer they were
// dropped in, so the trail goes behind the card with it.
//
// It wears the colours of your own dragonfly once you have met it on the dock
// (garden.companion). Reduced motion: it sits still on the card's corner.
// Loaded on its own, before main.js, so it flies from the first frame of the
// load; it stops once the title screen has gone.

import { BODIES, WINGS } from './dragonfly-talk.js';

const title = document.getElementById('title');
const card = title?.querySelector('.title-card');
const back = title?.querySelector('.tdf-back');
const front = title?.querySelector('.tdf-front');

const TAU = Math.PI * 2;
const SPARK_COLOURS = ['#fff6dc', '#f3d999', '#8ff6ff', '#ffffff', '#ffe08a'];

function look() {
    let mem = null;
    try {
        mem = JSON.parse(localStorage.getItem('garden.companion') || 'null');
    } catch {
        /* storage blocked: the garden's own colours */
    }
    const body = (mem?.met && BODIES.find((b) => b.id === mem.look?.body)) || BODIES[0];
    const wings = (mem?.met && WINGS.find((w) => w.id === mem.look?.wings)) || WINGS[0];
    return { body, wings, rainbow: wings.iri > 0.9 };
}

/** A dragonfly from above, heading up the page. Its colours are CSS variables. */
function dragonflySVG() {
    return `<svg viewBox="0 0 60 80" focusable="false">
<defs>
<linearGradient id="tdf-wg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--tdf-wing)" stop-opacity=".85"/><stop offset=".55" stop-color="var(--tdf-wing)" stop-opacity=".45"/><stop offset="1" stop-color="var(--tdf-tip)" stop-opacity=".9"/></linearGradient>
<linearGradient id="tdf-wgl" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="var(--tdf-wing)" stop-opacity=".85"/><stop offset=".55" stop-color="var(--tdf-wing)" stop-opacity=".45"/><stop offset="1" stop-color="var(--tdf-tip)" stop-opacity=".9"/></linearGradient>
<linearGradient id="tdf-ab" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--tdf-b)"/><stop offset=".45" stop-color="var(--tdf-a)"/><stop offset="1" stop-color="var(--tdf-b)"/></linearGradient>
</defs>
<g class="tdf-wings tdf-l">
<path class="tdf-fw" d="M27 24C20 17 6 14 2.5 18.5C1 21.5 10 25.5 27 26Z" fill="url(#tdf-wgl)"/>
<path class="tdf-hw" d="M27 30C19 30 5 33.5 3 38.5C3.5 41.5 16 38 27 32.5Z" fill="url(#tdf-wgl)"/>
<path d="M27 25L5 18.5M27 31.5L5.5 38" stroke="var(--tdf-vein)" stroke-width=".5" fill="none"/>
</g>
<g class="tdf-wings tdf-r">
<path class="tdf-fw" d="M33 24C40 17 54 14 57.5 18.5C59 21.5 50 25.5 33 26Z" fill="url(#tdf-wg)"/>
<path class="tdf-hw" d="M33 30C41 30 55 33.5 57 38.5C56.5 41.5 44 38 33 32.5Z" fill="url(#tdf-wg)"/>
<path d="M33 25L55 18.5M33 31.5L54.5 38" stroke="var(--tdf-vein)" stroke-width=".5" fill="none"/>
</g>
<path d="M30 31C32.6 31 32.4 50 31.6 64C31.3 71 30.6 76.5 30 77C29.4 76.5 28.7 71 28.4 64C27.6 50 27.4 31 30 31Z" fill="url(#tdf-ab)"/>
<path d="M30 36V75" stroke="var(--tdf-b)" stroke-width="3.6" stroke-dasharray="1.2 3.6" opacity=".75"/>
<ellipse cx="30" cy="25" rx="4.6" ry="7" fill="var(--tdf-a)"/>
<ellipse cx="29" cy="23" rx="1.6" ry="3.4" fill="#fff" opacity=".35"/>
<circle cx="30" cy="15.5" r="4.4" fill="var(--tdf-b)"/>
<circle cx="26.6" cy="13.4" r="3.5" fill="var(--tdf-eye)"/><circle cx="33.4" cy="13.4" r="3.5" fill="var(--tdf-eye)"/>
<circle cx="25.6" cy="12.3" r="1.1" fill="#fff"/><circle cx="32.4" cy="12.3" r="1.1" fill="#fff"/>
</svg>`;
}

function start() {
    if (!title || !card || !back || !front) return;
    const L = look();
    const df = document.createElement('div');
    df.className = 'tdf' + (L.rainbow ? ' rainbow' : '');
    df.style.setProperty('--tdf-a', L.body.a);
    df.style.setProperty('--tdf-b', L.body.b);
    df.style.setProperty('--tdf-eye', L.body.eye);
    // rainbow wings are white on the island (the shimmer colours them); here they cycle through the hues
    df.style.setProperty('--tdf-wing', L.rainbow ? '#a6f2ff' : L.wings.tint);
    df.style.setProperty('--tdf-tip', L.rainbow ? '#ff9ad8' : L.wings.tip);
    df.innerHTML = `<div class="tdf-body">${dragonflySVG()}</div>`;
    const inner = df.firstElementChild;

    // reduced motion: it sits on the top right corner of the card, wings still
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        df.classList.add('still');
        front.append(df);
        const place = () => {
            const t = title.getBoundingClientRect(), c = card.getBoundingClientRect();
            df.style.transform = `translate(${c.right - t.left - 26}px, ${c.top - t.top + 4}px) rotate(-120deg) scale(0.62)`;
        };
        place();
        addEventListener('resize', place);
        return;
    }

    front.append(df);
    let theta = Math.PI * 1.5;  // start hidden, behind the middle of the card
    let wait = 0.5;             // a breath before the first flight
    let last = performance.now();
    let sparkT = 0;
    let prev = null;
    let side = 'front';
    let angle = 0;
    let stopping = false;
    let fade = 1;

    const sparkle = (x, y, layer, depth) => {
        const s = document.createElement('i');
        s.className = 'tdf-spark';
        const size = (3 + Math.random() * 5) * (0.75 + 0.35 * depth);
        const dx = (Math.random() - 0.5) * 26, dy = 18 + Math.random() * 34;
        s.style.cssText = `left:${x}px;top:${y}px;--sz:${size.toFixed(1)}px;--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;--c:${SPARK_COLOURS[(Math.random() * SPARK_COLOURS.length) | 0]};--life:${(0.9 + Math.random() * 0.8).toFixed(2)}s`;
        layer.append(s);
        s.addEventListener('animationend', () => s.remove(), { once: true });
    };

    const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (title.hidden) {
            df.remove();
            back.replaceChildren();
            front.replaceChildren();
            return;
        }
        if (title.classList.contains('gone')) stopping = true;
        if (stopping) fade = Math.max(0, fade - dt * 1.6);

        const t = title.getBoundingClientRect(), c = card.getBoundingClientRect();
        const cx = c.left - t.left + c.width / 2;
        const cy = c.top - t.top + c.height / 2;
        // just clear of the card's sides, but never off the screen
        const rx = Math.min(c.width / 2 + 46, t.width / 2 - 24);
        const ry = Math.min(c.height * 0.36, 150);

        if (wait > 0) {
            wait -= dt;
        } else {
            // slower across the front for the show, quick round the back
            const speed = Math.sin(theta) > 0 ? 0.95 : 1.9;
            theta += dt * speed * (0.85 + 0.3 * Math.abs(Math.cos(theta)));
            if (theta >= Math.PI * 3.5) {
                // a full turn: rest out of sight behind the card a while
                theta = Math.PI * 1.5;
                wait = 1.4 + Math.random() * 2.2;
            }
        }
        const th = ((theta % TAU) + TAU) % TAU;
        // the orbit: out of the left edge (θ = 0), in front (sin θ > 0) with a high swooping arc over
        // the title, behind at the right edge (θ = π), and back low behind the card
        const depth = Math.sin(th);
        const x = cx - rx * Math.cos(th);
        const y = cy - ry * 0.95 * depth - ry * 0.35 * Math.cos(th) + Math.sin(th * 3) * 7;
        const s = (0.92 + 0.5 * depth) * Math.min(1, t.width / 700 + 0.25);
        // hidden at the far side of the back of the orbit, fading in as it comes round
        const backness = Math.max(0, -depth);
        const op = (1 - Math.max(0, (backness - 0.55) / 0.35)) * fade;

        if (prev) {
            const vx = x - prev.x, vy = y - prev.y;
            if (Math.hypot(vx, vy) > 0.05) {
                const want = Math.atan2(vy, vx) + Math.PI / 2;
                let d = want - angle;
                d = Math.atan2(Math.sin(d), Math.cos(d));
                angle += d * Math.min(1, dt * 10);
            }
        }
        prev = { x, y };

        const want = depth >= 0 ? 'front' : 'back';
        if (want !== side) {
            side = want;
            (side === 'front' ? front : back).append(df);
        }
        df.style.opacity = Math.max(0, Math.min(1, op)).toFixed(3);
        df.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${angle.toFixed(3)}rad) scale(${s.toFixed(3)})`;
        df.classList.toggle('far', side === 'back');
        inner.style.setProperty('--bank', `${(Math.cos(th) * 18).toFixed(1)}deg`);

        // pixie dust from its tail while it is in sight
        sparkT -= dt;
        if (wait <= 0 && op > 0.2 && sparkT <= 0) {
            sparkT = side === 'front' ? 0.022 : 0.05;
            const tail = 34 * s;
            sparkle(x - Math.sin(angle) * tail, y + Math.cos(angle) * tail, side === 'front' ? front : back, Math.max(0, depth));
        }
        if (fade <= 0) {
            df.remove();
            return;
        }
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}

start();
