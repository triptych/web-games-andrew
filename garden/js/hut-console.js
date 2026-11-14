// The Pocket Garden handheld, propped up on the hut's desk. It is the device from
// console/ in its default dress (the mint shell and the mint-glow screen): a
// rounded plastic slab whose face is painted on a canvas from the same colours
// as console/css/console.css (LED, game slot and hold switch along the top, the
// charcoal bezel round a backlit LCD, the brand line, the click wheel with its
// mint centre button, the speaker grille). The LCD is a second canvas that
// glows on its own and scrolls slowly through the real A to Z game list, the
// highlight stepping down a row at a time. Click it and you are on the handheld.

import * as THREE from 'three';
import { glowSprite } from './textures.js';

// the device's size on the desk (the console's own shape: width is 0.565 of the height)
const H = 0.17, W = H * 0.565, T = 0.02;
// the painted face, in pixels (same ratio)
const PH = 900, PW = Math.round(PH * 0.565);
const px = (f) => f * PH;   // a fraction of the device's height, in face pixels

// the mint shell and the mint-glow screen tint
const SHELL = { hi: '#e4fbef', mid: '#b6e9d0', lo: '#8ed1b2', edge: '#6aae8f', ink: '#2b3d35', soft: 'rgba(43, 61, 53, 0.55)' };
const WHEEL = { a: '#353b3f', b: '#1c2022', ink: '#bdf5da', cHi: '#f1fff8', c: '#bdebd5', cLo: '#93d3b5' };
const LCD = { bg: '#07100c', bg2: '#0f261c', ink: '#a8f8d3', hi1: '#c4ffe5', hi2: '#6fe1ad', hiInk: '#0a1912', bar1: '#183026', bar2: '#0c1813' };

function roundRect(x, l, t, w, h, r) {
    x.beginPath();
    x.roundRect(l, t, w, h, r);
}

/** The face layout, in face pixels, worked out once from the console's CSS. */
function layout() {
    const padT = px(0.02), padX = px(0.026), padB = px(0.022), gap = px(0.012);
    const top = { x: padX, y: padT, w: PW - padX * 2, h: px(0.026) };
    const bezel = { x: padX, y: top.y + top.h + gap, w: PW - padX * 2, h: PH * 0.51 };
    const inset = px(0.013);
    const screen = { x: bezel.x + inset, y: bezel.y + inset, w: bezel.w - inset * 2, h: bezel.h - inset * 2 };
    const deckY = bezel.y + bezel.h + gap, deckH = PH - padB - deckY;
    const brand = { y: deckY + px(0.024) };
    const grille = { y: PH - padB - px(0.012), h: px(0.012) };
    const ctrlTop = brand.y + px(0.016), ctrlH = grille.y - px(0.006) - ctrlTop;
    const ws = Math.min(ctrlH * 0.9, top.w * 0.82);
    const wheel = { cx: PW / 2, cy: ctrlTop + ctrlH / 2, r: ws / 2 };
    return { top, bezel, screen, deckY, deckH, brand, grille, wheel, padX };
}

/** Paints the shell, the bezel (the screen is left black: the LCD sits on top of it) and the wheel. */
function paintFace(L) {
    const c = document.createElement('canvas');
    c.width = PW;
    c.height = PH;
    const x = c.getContext('2d');
    const R = px(0.058);
    // the plastic: the 155deg gradient, its edge, an inner highlight
    const ang = (155 - 90) * (Math.PI / 180);
    const len = Math.abs(PW * Math.cos(ang)) + Math.abs(PH * Math.sin(ang));
    const dx = (Math.cos(ang) * len) / 2, dy = (Math.sin(ang) * len) / 2;
    const g = x.createLinearGradient(PW / 2 - dx, PH / 2 - dy, PW / 2 + dx, PH / 2 + dy);
    g.addColorStop(0, SHELL.hi);
    g.addColorStop(0.36, SHELL.mid);
    g.addColorStop(1, SHELL.lo);
    roundRect(x, 0, 0, PW, PH, R);
    x.fillStyle = g;
    x.fill();
    x.save();
    x.clip();
    // plastic grain
    const id = x.getImageData(0, 0, PW, PH), d = id.data;
    let s = 1234567;
    for (let i = 0; i < d.length; i += 4) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const n = ((s >> 8) % 13) - 6;
        d[i] += n;
        d[i + 1] += n;
        d[i + 2] += n;
    }
    x.putImageData(id, 0, 0);
    // the specular sheen in the top-left corner
    const sh = x.createRadialGradient(PW * 0.18, 0, 0, PW * 0.18, 0, PW * 0.7);
    sh.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    sh.addColorStop(1, 'rgba(255, 255, 255, 0)');
    x.fillStyle = sh;
    x.fillRect(0, 0, PW, PH * 0.4);
    x.restore();
    roundRect(x, 2, 2, PW - 4, PH - 4, R - 2);
    x.lineWidth = 4;
    x.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    x.stroke();
    roundRect(x, 1, 1, PW - 2, PH - 2, R);
    x.lineWidth = 3;
    x.strokeStyle = SHELL.edge;
    x.stroke();

    // the top edge: LED (drawn lit, as it is when the console is on), the game slot, the hold switch
    const { top } = L;
    const cy = top.y + top.h / 2;
    const lx = top.x + top.w * 0.04 + px(0.0055);
    const led = x.createRadialGradient(lx, cy, 0, lx, cy, px(0.02));
    led.addColorStop(0, 'rgba(125, 255, 184, 0.8)');
    led.addColorStop(1, 'rgba(125, 255, 184, 0)');
    x.fillStyle = led;
    x.fillRect(lx - px(0.02), cy - px(0.02), px(0.04), px(0.04));
    x.beginPath();
    x.arc(lx, cy, px(0.0055), 0, Math.PI * 2);
    x.fillStyle = '#7dffb8';
    x.fill();
    const sw = top.w * 0.46, sH = top.h * 0.62;
    roundRect(x, PW / 2 - sw / 2, cy - sH / 2, sw, sH, sH / 2);
    const sg = x.createLinearGradient(0, cy - sH / 2, 0, cy + sH / 2);
    sg.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
    sg.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
    x.fillStyle = sg;
    x.fill();
    x.font = `700 ${px(0.0095) * 0.8}px "Rubik", "Segoe UI", system-ui, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255, 255, 255, 0.4)';
    x.fillText('G A M E   S L O T', PW / 2, cy + 1);
    const hf = px(0.0095);
    x.font = `700 ${hf}px "Rubik", "Segoe UI", system-ui, sans-serif`;
    x.textAlign = 'right';
    x.fillStyle = SHELL.soft;
    const hx = top.x + top.w * 0.96;
    x.fillText('H O L D', hx, cy + 1);
    const tw = x.measureText('H O L D').width;
    const iw = hf * 2.4, ih = hf * 1.1, ix = hx - tw - hf * 0.5 - iw;
    roundRect(x, ix, cy - ih / 2, iw, ih, ih / 2);
    x.fillStyle = 'rgba(0, 0, 0, 0.25)';
    x.fill();
    roundRect(x, ix + 2, cy - ih / 2 + 2, iw * 0.45, ih - 4, ih / 2);
    x.fillStyle = SHELL.hi;
    x.fill();

    // the charcoal bezel, and the black glass the LCD lights up
    const { bezel, screen } = L;
    roundRect(x, bezel.x, bezel.y + 2, bezel.w, bezel.h, px(0.026));
    x.fillStyle = 'rgba(255, 255, 255, 0.55)';
    x.fill();
    const bg = x.createLinearGradient(bezel.x, bezel.y, bezel.x + bezel.w * 0.2, bezel.y + bezel.h);
    bg.addColorStop(0, '#2a2f32');
    bg.addColorStop(0.6, '#15181a');
    bg.addColorStop(1, '#1b1f21');
    roundRect(x, bezel.x, bezel.y, bezel.w, bezel.h, px(0.026));
    x.fillStyle = bg;
    x.fill();
    roundRect(x, screen.x, screen.y, screen.w, screen.h, px(0.01));
    x.fillStyle = '#000';
    x.fill();

    // the brand line: pocket**garden** and the model number
    const by = L.brand.y;
    const bf = px(0.022);
    x.textBaseline = 'alphabetic';
    x.textAlign = 'left';
    x.font = `500 ${bf}px "Rubik", "Segoe UI", system-ui, sans-serif`;
    const bx = L.padX + top.w * 0.03;
    x.fillStyle = 'rgba(255, 255, 255, 0.35)';
    x.fillText('pocket', bx, by + 1);
    x.fillStyle = SHELL.ink;
    x.fillText('pocket', bx, by);
    const pw = x.measureText('pocket').width;
    x.font = `800 ${bf}px "Rubik", "Segoe UI", system-ui, sans-serif`;
    x.fillStyle = 'rgba(255, 255, 255, 0.35)';
    x.fillText('garden', bx + pw, by + 1);
    x.fillStyle = SHELL.ink;
    x.fillText('garden', bx + pw, by);
    x.font = `400 ${px(0.011)}px "Silkscreen", ui-monospace, monospace`;
    x.textAlign = 'right';
    x.fillStyle = SHELL.soft;
    x.fillText('PG', PW - L.padX - top.w * 0.03, by);

    // the click wheel: a dark ring with its labels, the mint centre button
    const { cx: wx, cy: wy, r } = L.wheel;
    x.beginPath();
    x.arc(wx, wy, r + r * 0.024, 0, Math.PI * 2);
    x.fillStyle = '#5b8e77';
    x.fill();
    x.beginPath();
    x.arc(wx, wy - r * 0.012, r + r * 0.024, Math.PI * 1.1, Math.PI * 1.9);
    x.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    x.lineWidth = r * 0.02;
    x.stroke();
    const wg = x.createRadialGradient(wx, wy, 0, wx, wy, r);
    wg.addColorStop(0, WHEEL.a);
    wg.addColorStop(0.74, WHEEL.b);
    wg.addColorStop(1, WHEEL.b);
    x.beginPath();
    x.arc(wx, wy, r, 0, Math.PI * 2);
    x.fillStyle = wg;
    x.fill();
    const wsh = x.createRadialGradient(wx, wy - r * 0.44, 0, wx, wy - r * 0.44, r * 1.1);
    wsh.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    wsh.addColorStop(1, 'rgba(255, 255, 255, 0)');
    x.fillStyle = wsh;
    x.fill();
    // the 24 detents
    x.fillStyle = 'rgba(189, 245, 218, 0.22)';
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        x.beginPath();
        x.arc(wx + Math.sin(a) * r * 0.675, wy - Math.cos(a) * r * 0.675, r * 0.018, 0, Math.PI * 2);
        x.fill();
    }
    x.fillStyle = WHEEL.ink;
    x.strokeStyle = WHEEL.ink;
    x.globalAlpha = 0.86;
    x.font = `800 ${r * 2 * 0.066}px "Rubik", "Segoe UI", system-ui, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('MENU', wx, wy - r * 0.78);
    // the three little icons, drawn from the console's SVG paths (a 24 by 12 box)
    const icon = (ox, oy, path) => {
        const k = (r * 2 * 0.13) / 24;
        x.save();
        x.translate(ox - 12 * k, oy - 6 * k);
        x.scale(k, k);
        x.lineWidth = 1.6;
        x.lineJoin = 'round';
        const p = new Path2D(path);
        x.fill(p);
        x.stroke(p);
        x.restore();
    };
    icon(wx - r * 0.76, wy, 'M2 1v10M12 1L3 6l9 5zM22 1l-9 5 9 5z');
    icon(wx + r * 0.76, wy, 'M22 1v10M12 1l9 5-9 5zM2 1l9 5-9 5z');
    icon(wx, wy + r * 0.78, 'M3 1l8 5-8 5zM15 1v10M20 1v10');
    x.globalAlpha = 1;
    // the centre button, with its shadow ring
    const cr = r * 0.38;
    x.beginPath();
    x.arc(wx, wy + cr * 0.05, cr + r * 0.016, 0, Math.PI * 2);
    x.fillStyle = 'rgba(0, 0, 0, 0.5)';
    x.fill();
    const cg = x.createRadialGradient(wx, wy - cr * 0.2, 0, wx, wy - cr * 0.2, cr * 1.15);
    cg.addColorStop(0, WHEEL.cHi);
    cg.addColorStop(0.55, WHEEL.c);
    cg.addColorStop(1, WHEEL.cLo);
    x.beginPath();
    x.arc(wx, wy, cr, 0, Math.PI * 2);
    x.fillStyle = cg;
    x.fill();
    const ch = x.createRadialGradient(wx, wy - cr * 0.56, 0, wx, wy - cr * 0.56, cr * 0.9);
    ch.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    ch.addColorStop(1, 'rgba(255, 255, 255, 0)');
    x.fillStyle = ch;
    x.fill();

    // the speaker grille
    const gw = PW * 0.26;
    x.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let gx = PW / 2 - gw / 2 + 3; gx < PW / 2 + gw / 2; gx += 8) {
        x.beginPath();
        x.arc(gx, L.grille.y + L.grille.h / 2, 1.8, 0, Math.PI * 2);
        x.fill();
    }

    // everything outside the rounded body is see-through
    x.globalCompositeOperation = 'destination-in';
    roundRect(x, 0, 0, PW, PH, R);
    x.fill();
    return c;
}

/** "The Hut" sorts as "Hut": the console's All Games rule. */
const sortKey = (t) => t.replace(/^the\s+/i, '').toLowerCase();

export class HutConsole {
    /**
     * @param {object} o { scene, mats, renderer, titles, x, y (desk top), z, yaw }
     */
    constructor(o) {
        this.titles = (o.titles?.length ? [...o.titles] : ['Pocket Garden']).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
        this.L = layout();
        this.hover = 0;
        this.target = 0;
        this.row = 0;
        this.tick = 0;
        this.press = 0;

        const faceTex = new THREE.CanvasTexture(paintFace(this.L));
        faceTex.colorSpace = THREE.SRGBColorSpace;
        faceTex.anisotropy = o.renderer?.capabilities.getMaxAnisotropy?.() ?? 1;

        // the LCD, lit from behind: its own canvas, redrawn when the highlight moves
        const S = this.L.screen;
        this.lcd = document.createElement('canvas');
        this.lcd.width = Math.round(S.w);
        this.lcd.height = Math.round(S.h);
        this.lcdTex = new THREE.CanvasTexture(this.lcd);
        this.lcdTex.colorSpace = THREE.SRGBColorSpace;
        this.lcdTex.anisotropy = faceTex.anisotropy;
        this._drawLCD();

        // the body: a rounded slab of mint plastic with soft edges
        const R = H * 0.058, bev = T * 0.3;
        const shape = new THREE.Shape();
        shape.moveTo(-W / 2 + R, -H / 2);
        shape.lineTo(W / 2 - R, -H / 2);
        shape.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R);
        shape.lineTo(W / 2, H / 2 - R);
        shape.quadraticCurveTo(W / 2, H / 2, W / 2 - R, H / 2);
        shape.lineTo(-W / 2 + R, H / 2);
        shape.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - R);
        shape.lineTo(-W / 2, -H / 2 + R);
        shape.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2);
        const body = new THREE.ExtrudeGeometry(shape, { depth: T - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.6, bevelSegments: 3, curveSegments: 6 });
        body.translate(0, 0, -T / 2 + bev);
        const plastic = new THREE.MeshStandardMaterial({ color: 0xa6dcc2, roughness: 0.45, metalness: 0 });

        const device = new THREE.Group();
        device.add(new THREE.Mesh(body, plastic));
        // the painted face, just proud of the front
        const face = new THREE.Mesh(
            new THREE.PlaneGeometry(W, H),
            new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, alphaTest: 0.5, roughness: 0.42, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 0.1 }),
        );
        face.position.z = T / 2 + 0.0004;
        device.add(face);
        // the LCD over the bezel's black glass
        const toW = (pxv) => (pxv / PH) * H;
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(toW(S.w), toW(S.h)), new THREE.MeshBasicMaterial({ map: this.lcdTex, toneMapped: false }));
        screen.position.set(toW(S.x + S.w / 2) - W / 2, H / 2 - toW(S.y + S.h / 2), T / 2 + 0.0008);
        this.screen = screen;
        device.add(screen);
        // a little wooden stand: a base plate with a rail along the front, and a strut
        // behind, so the device leans back toward whoever is at the desk
        const lean = 0.42;   // radians back from upright
        const base = 0.005;  // the plate's thickness
        const cl = Math.cos(lean), sl = Math.sin(lean);
        const holder = new THREE.Group();
        device.rotation.x = -lean;
        // its bottom-back edge rests on the plate, over the stand's origin
        device.position.set(0, base + (H / 2) * cl + (T / 2) * sl, -(H / 2) * sl + (T / 2) * cl);
        holder.add(device);
        const wood = o.mats.darkWood;
        const plate = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, base, 0.12), wood);
        plate.position.set(0, base / 2, -0.04);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.012, 0.01), wood);
        rail.position.set(0, base + 0.006, T * cl + 0.006);
        // the strut: from a point on the device's back to the back of the plate
        const ty = 0.2 * H, top = new THREE.Vector3(0, ty * cl + (T / 2) * sl, -ty * sl - (T / 2) * cl).add(device.position);
        const foot = new THREE.Vector3(0, base, -0.095);
        const dir = top.clone().sub(foot);
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.018, dir.length(), 0.006), wood);
        strut.position.copy(foot).add(top).multiplyScalar(0.5);
        strut.rotation.x = Math.atan2(dir.z, dir.y);
        holder.add(plate, rail, strut);
        holder.position.set(o.x, o.y, o.z);
        holder.rotation.y = o.yaw ?? 0;
        this.holder = holder;
        this.device = device;
        this.lean = lean;
        this.restY = device.position.y;

        // a soft mint glow off the screen, brighter when the pointer is on it
        this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0x7dffb8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.18 }));
        this.glow.scale.set(0.3, 0.3, 1);
        this.light = new THREE.PointLight(0x7dffb8, 0.5, 1.4, 2);
        holder.add(this.glow, this.light);

        // a generous invisible target round the whole device
        this.hit = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
        this.hit.userData.kind = 'console';
        holder.add(this.hit);
        o.scene.add(holder);
        holder.updateMatrixWorld(true);
        this._placeAttachments();
        this.pos = new THREE.Vector3();
        this.screen.getWorldPosition(this.pos);
    }

    _placeAttachments() {
        const c = new THREE.Vector3();
        this.screen.getWorldPosition(c);
        this.holder.worldToLocal(c);
        const n = new THREE.Vector3(0, Math.sin(this.lean), Math.cos(this.lean)).multiplyScalar(0.03);
        this.glow.position.copy(c).add(n);
        this.light.position.copy(c).add(n.multiplyScalar(3));
        this.hit.position.copy(this.device.position);
    }

    get pickables() {
        return [this.hit];
    }

    /** The menu on the LCD: a status bar and the A to Z list, one row lit. */
    _drawLCD() {
        const c = this.lcd, x = c.getContext('2d');
        const w = c.width, h = c.height;
        const bg = x.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 1.1);
        bg.addColorStop(0, LCD.bg2);
        bg.addColorStop(0.72, LCD.bg);
        bg.addColorStop(1, LCD.bg);
        x.fillStyle = bg;
        x.fillRect(0, 0, w, h);
        // the status bar
        const sb = h * 0.1;
        const sg = x.createLinearGradient(0, 0, 0, sb);
        sg.addColorStop(0, LCD.bar1);
        sg.addColorStop(1, LCD.bar2);
        x.fillStyle = sg;
        x.fillRect(0, 0, w, sb);
        x.fillStyle = 'rgba(168, 248, 211, 0.25)';
        x.fillRect(0, sb - 1, w, 1);
        x.fillStyle = LCD.ink;
        x.textBaseline = 'middle';
        x.font = `600 ${sb * 0.48}px "Chakra Petch", "Segoe UI", system-ui, sans-serif`;
        x.textAlign = 'left';
        x.fillText('▶', w * 0.04, sb / 2);
        x.textAlign = 'center';
        x.fillText('All Games', w / 2, sb / 2);
        // the battery
        const bw = sb * 0.7, bh = sb * 0.36, bx = w * 0.95 - bw, by = sb / 2 - bh / 2;
        x.strokeStyle = LCD.ink;
        x.lineWidth = 1.5;
        x.strokeRect(bx, by, bw, bh);
        x.fillRect(bx + bw, by + bh * 0.3, 2.5, bh * 0.4);
        x.fillRect(bx + 2, by + 2, (bw - 4) * 0.8, bh - 4);
        // the rows: seven on screen, the lit one moving down and the list following it
        const rows = 7, rh = (h - sb) / rows, n = this.titles.length;
        const first = Math.max(0, Math.min(n - rows, this.row - 3));
        x.font = `500 ${rh * 0.44}px "Chakra Petch", "Segoe UI", system-ui, sans-serif`;
        x.textAlign = 'left';
        for (let i = 0; i < rows && first + i < n; i++) {
            const k = first + i, y = sb + i * rh;
            const lit = k === this.row;
            if (lit) {
                const hg = x.createLinearGradient(0, y, 0, y + rh);
                hg.addColorStop(0, LCD.hi1);
                hg.addColorStop(1, LCD.hi2);
                x.fillStyle = hg;
                x.fillRect(0, y + 1, w, rh - 2);
            }
            x.fillStyle = lit ? LCD.hiInk : LCD.ink;
            let t = this.titles[k];
            const max = w * 0.82;
            if (x.measureText(t).width > max) {
                while (t.length > 1 && x.measureText(t + '…').width > max) t = t.slice(0, -1);
                t += '…';
            }
            x.fillText(t, w * 0.05, y + rh / 2);
            x.textAlign = 'right';
            x.fillText('›', w * 0.95, y + rh / 2);
            x.textAlign = 'left';
        }
        // the scroll bar
        if (n > rows) {
            const th = Math.max(8, (h - sb) * (rows / n));
            x.fillStyle = 'rgba(168, 248, 211, 0.35)';
            x.fillRect(w - 4, sb + ((h - sb - th) * first) / (n - rows), 3, th);
        }
        // scanlines and the glass's sheen
        x.fillStyle = 'rgba(0, 0, 0, 0.16)';
        for (let y = 0; y < h; y += 3) x.fillRect(0, y, w, 1);
        const gl = x.createLinearGradient(0, 0, w, h);
        gl.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gl.addColorStop(0.35, 'rgba(255, 255, 255, 0)');
        x.fillStyle = gl;
        x.fillRect(0, 0, w, h);
        this.lcdTex.needsUpdate = true;
    }

    setHover(on) {
        this.target = on ? 1 : 0;
    }

    /** Clicked: the screen flashes as it does when a cartridge boots. */
    boot() {
        this.press = 1;
    }

    update(dt, t, away = false) {
        if (away) return;
        this.hover += (this.target - this.hover) * Math.min(1, dt * 8);
        // the highlight steps down the list, quicker while the pointer is on it
        this.tick += dt * (1 + this.hover * 2.5);
        if (this.tick > 1.1) {
            this.tick = 0;
            this.row = (this.row + 1) % this.titles.length;
            this._drawLCD();
        }
        this.press = Math.max(0, this.press - dt * 2.5);
        this.device.position.y = this.restY + this.hover * 0.012;
        this.screen.material.color.setScalar(1 + this.press * 1.5);
        this.glow.material.opacity = 0.14 + 0.04 * Math.sin(t * 2.2) + this.hover * 0.25 + this.press * 0.6;
        this.glow.scale.setScalar(0.26 + this.hover * 0.12 + this.press * 0.3);
        this.light.intensity = 0.45 + this.hover * 0.6 + this.press * 2;
    }
}
