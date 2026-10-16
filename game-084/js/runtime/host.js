// VESTA-8 runtime: the standalone player. This part is only used by exported HTML files: it builds
// a little CRT on the page, reads the keyboard, gamepads and touch, runs the cart at 60 frames a
// second and plays its sound. It is the one runtime part that touches the DOM.

export function host(V) {
    V.PLAYER_CSS = [
        '*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}',
        'html,body{margin:0;height:100%;background:#05060c;color:#e9f6ff;overflow:hidden;font:14px/1.3 ui-monospace,Menlo,Consolas,monospace;user-select:none;-webkit-user-select:none;touch-action:none}',
        'body{background:radial-gradient(ellipse at 50% 30%,#172040 0%,#070912 60%,#030407 100%)}',
        '#vx-top{position:fixed;left:0;right:0;top:0;padding:calc(6px + env(safe-area-inset-top)) 12px 6px;display:flex;justify-content:space-between;gap:8px;font-size:12px;letter-spacing:.12em;color:#7fe9ff;text-transform:uppercase;text-shadow:0 0 6px #2fb8b0}',
        '#vx-top b{color:#ffb347;font-weight:400}',
        '#vx-crt{position:fixed;border-radius:18px;overflow:hidden;background:#000;box-shadow:0 0 0 10px #15182a,0 0 0 12px #2c3150,0 0 40px 14px rgba(47,184,176,.25)}',
        '#vx-crt canvas{display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges}',
        '#vx-crt:after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55) 100%)}',
        '#vx-start{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(3,4,10,.72);z-index:5;text-align:center;padding:20px;cursor:pointer}',
        '#vx-start h1{margin:0;font-size:clamp(26px,7vw,48px);letter-spacing:.08em;color:#ffd23f;text-shadow:0 0 14px #ff8a2a}',
        '#vx-start p{margin:0;color:#9fdcff;max-width:520px}',
        '#vx-start .go{margin-top:8px;padding:12px 26px;border:1px solid #63c6ff;border-radius:999px;color:#05060c;background:#63c6ff;font-weight:700;letter-spacing:.15em;animation:vxp 1.2s ease-in-out infinite alternate}',
        '@keyframes vxp{to{box-shadow:0 0 22px #63c6ff}}',
        '#vx-pad{position:fixed;inset:0;pointer-events:none;z-index:3}',
        '#vx-pad button{position:absolute;pointer-events:auto;touch-action:none;width:64px;height:64px;border-radius:14px;border:2px solid rgba(127,233,255,.45);background:rgba(20,30,60,.55);color:#e9f6ff;font:700 20px ui-monospace,monospace}',
        '#vx-pad button.on{background:rgba(127,233,255,.45)}',
        '#vx-pad .ab{border-radius:50%;width:74px;height:74px;border-color:rgba(255,179,71,.6);background:rgba(80,40,10,.5)}',
        '.vx-hide{display:none!important}',
        '#vx-foot{position:fixed;left:0;right:0;bottom:calc(6px + env(safe-area-inset-bottom));text-align:center;font-size:11px;color:#5b6b8f;letter-spacing:.1em}',
    ].join('\n');

    V.host = {
        boot(cartData) {
            const doc = document;
            const P = V.prepare(cartData);
            const cart = P.cart;
            doc.title = cart.title;
            const style = doc.createElement('style');
            style.textContent = V.PLAYER_CSS;
            doc.head.appendChild(style);
            const el = (tag, attrs, html) => {
                const e = doc.createElement(tag);
                for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
                if (html !== undefined) e.textContent = html;
                doc.body.appendChild(e);
                return e;
            };
            const top = el('div', { id: 'vx-top' });
            top.innerHTML = '<span><b>VESTA-8</b> · </span><span>Z/Space = A · X = B · P pause</span>';
            top.firstChild.appendChild(doc.createTextNode(cart.title + (cart.author ? ' by ' + cart.author : '')));
            const crt = el('div', { id: 'vx-crt' });
            const canvas = doc.createElement('canvas');
            canvas.width = V.W; canvas.height = V.H;
            crt.appendChild(canvas);
            const ctx2 = canvas.getContext('2d');
            const img = ctx2.createImageData(V.W, V.H);
            const pad = el('div', { id: 'vx-pad', class: 'vx-hide' });
            const foot = el('div', { id: 'vx-foot' }, 'made on the VESTA-8 · ROMANCER');
            const start = el('div', { id: 'vx-start' });
            const h1 = doc.createElement('h1'); h1.textContent = cart.title; start.appendChild(h1);
            if (cart.desc) { const p = doc.createElement('p'); p.textContent = cart.desc; start.appendChild(p); }
            const go = doc.createElement('div'); go.className = 'go'; go.textContent = 'PRESS START'; start.appendChild(go);

            // ---- input
            const keys = new Set();
            const KEYMAP = {
                ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up',
                ArrowDown: 'down', KeyS: 'down', KeyZ: 'a', Space: 'a', KeyJ: 'a', Enter: 'a', KeyX: 'b', KeyK: 'b',
            };
            const touchHeld = {};
            let latched = 0;          // presses that went down and up between two frames still count once
            const press = (b) => { latched |= V.BTN[b]; };
            addEventListener('keydown', (e) => {
                const b = KEYMAP[e.code];
                if (b || e.code === 'KeyP' || e.code === 'Escape') e.preventDefault();
                if (!started) { begin(); return; }
                if (e.code === 'KeyP' || e.code === 'Escape') { paused = !paused; return; }
                if (e.code === 'KeyR') { R = V.restartRun(R); return; }
                if (b && !e.repeat) press(b);
                if (b) keys.add(b);
            });
            addEventListener('keyup', (e) => { const b = KEYMAP[e.code]; if (b) keys.delete(b); });
            addEventListener('blur', () => keys.clear());
            const buttons = [['left', '◀'], ['right', '▶'], ['up', '▲'], ['down', '▼'], ['b', 'B'], ['a', 'A']];
            const bEls = {};
            for (const [b, label] of buttons) {
                const e = doc.createElement('button');
                e.textContent = label;
                if (b === 'a' || b === 'b') e.className = 'ab';
                pad.appendChild(e);
                bEls[b] = e;
                const down = (ev) => { ev.preventDefault(); if (!started) { begin(); return; } touchHeld[b] = (touchHeld[b] || 0) + 1; press(b); e.classList.add('on'); };
                const up = (ev) => { ev.preventDefault(); touchHeld[b] = 0; e.classList.remove('on'); };
                e.addEventListener('pointerdown', down);
                e.addEventListener('pointerup', up);
                e.addEventListener('pointercancel', up);
                e.addEventListener('pointerleave', up);
            }
            const showPad = () => pad.classList.remove('vx-hide');
            if (matchMedia && matchMedia('(pointer: coarse)').matches) showPad();
            addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { showPad(); layout(); } }, { capture: true });
            start.addEventListener('click', () => begin());

            function padState() {
                let m = 0;
                const gps = navigator.getGamepads ? navigator.getGamepads() : [];
                for (const gp of gps) {
                    if (!gp || !gp.connected) continue;
                    const pb = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
                    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
                    if (pb(14) || ax < -0.4) m |= V.BTN.left;
                    if (pb(15) || ax > 0.4) m |= V.BTN.right;
                    if (pb(12) || ay < -0.4) m |= V.BTN.up;
                    if (pb(13) || ay > 0.4) m |= V.BTN.down;
                    if (pb(0)) m |= V.BTN.a;
                    if (pb(1) || pb(2)) m |= V.BTN.b;
                }
                return m;
            }

            function layout() {
                const vv = window.visualViewport;
                const w = vv ? vv.width : innerWidth, h = vv ? vv.height : innerHeight;
                const touch = !pad.classList.contains('vx-hide');
                const portrait = h > w;
                let aw = w - 40, ah = h - 70, ox = 0, oy = 30;
                if (touch && portrait) ah = h - 260;
                if (touch && !portrait) aw = w - 300;
                const s = Math.max(1, Math.min(aw / V.W, ah / V.H));
                const cw = Math.floor(V.W * s), ch = Math.floor(V.H * s);
                const left = Math.floor((w - cw) / 2) + ox, topY = touch && portrait ? 40 : Math.floor((h - ch) / 2) + oy / 2;
                Object.assign(crt.style, { left: left + 'px', top: topY + 'px', width: cw + 'px', height: ch + 'px' });
                const by = portrait ? h - 200 : h - 190;
                const place = (b, x, y) => Object.assign(bEls[b].style, { left: x + 'px', top: y + 'px' });
                place('left', 18, by + 64); place('up', 82, by); place('right', 146, by + 64); place('down', 82, by + 128);
                place('b', w - 180, by + 90); place('a', w - 96, by + 50);
                foot.classList.toggle('vx-hide', touch);
            }
            addEventListener('resize', layout);
            if (window.visualViewport) visualViewport.addEventListener('resize', layout);
            layout();

            // ---- audio
            let actx = null, synth = V.makeSynth(null);
            function initAudio() {
                if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                actx = new AC();
                synth = V.makeSynth(actx);
            }
            doc.addEventListener('visibilitychange', () => {
                if (!actx) return;
                if (doc.hidden) actx.suspend(); else actx.resume();
                if (doc.hidden) paused = true;
            });

            // ---- loop
            let R = V.newRun(P, { seed: (Date.now() % 100000) | 1 });
            let started = false, paused = false, last = 0, acc = 0;
            function begin() {
                if (started) return;
                started = true;
                initAudio();
                start.classList.add('vx-hide');
                R = V.newRun(P, { seed: (Date.now() % 100000) | 1 });
                last = performance.now();
                acc = 0;
            }
            function drain() {
                for (const e of R.events) {
                    if (e.type === 'sfx') synth.sfx(cart.sounds[e.n]);
                    else if (e.type === 'music') { if (e.on) synth.startMusic(cart.music); else synth.stopMusic(); }
                    else if (e.type === 'win') { synth.stopMusic(); synth.sfx(V.SFX_PRESETS.win); }
                    else if (e.type === 'lose') { synth.stopMusic(); synth.sfx(V.SFX_PRESETS.lose); }
                }
                R.events.length = 0;
            }
            function frame(now) {
                requestAnimationFrame(frame);
                if (started && !paused) {
                    acc += Math.min(0.1, (now - last) / 1000);
                    let n = 0;
                    while (acc >= 1 / 60 && n < 4) {
                        let m = padState() | latched;
                        for (const k of keys) m |= V.BTN[k];
                        for (const k in touchHeld) if (touchHeld[k]) m |= V.BTN[k];
                        latched = 0;
                        if (R.status !== 'run' && R.status !== 'error' && R.overT > 40 && (m & V.BTN.a) && !(R.btn & V.BTN.a)) {
                            R = V.restartRun(R);
                        } else V.stepRun(R, m);
                        drain();
                        acc -= 1 / 60;
                        n++;
                    }
                    synth.tick();
                }
                last = now;
                V.drawRun(R);
                if (paused && started) {
                    V.rectfill(R.fb, 50, 52, 60, 16, 0);
                    V.text(R.fb, 'PAUSED', 68, 57, 3);
                }
                V.toRGBA(R.fb, img.data, V.PAL_RGB);
                ctx2.putImageData(img, 0, 0);
            }
            requestAnimationFrame(frame);
        },
    };
}
