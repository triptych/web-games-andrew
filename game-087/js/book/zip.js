// A small zip writer (store only, no compression) and reader, for EPUB files. Pure.
// An EPUB is a zip whose first entry is an uncompressed file called "mimetype"; storing everything keeps
// that rule trivially true and needs no deflate.

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

export function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

const enc = new TextEncoder();
const toBytes = (d) => (typeof d === 'string' ? enc.encode(d) : d);

/** files: [{ name, data: string | Uint8Array }] in order. date: { y, m, d } for the DOS timestamp. */
export function zip(files, date = { y: 2026, m: 1, d: 1 }) {
    const dosTime = 0;
    const dosDate = ((Math.max(1980, date.y) - 1980) << 9) | (date.m << 5) | date.d;
    const locals = [], centrals = [];
    let offset = 0;
    for (const f of files) {
        const name = enc.encode(f.name);
        const data = toBytes(f.data);
        const crc = crc32(data);
        const lh = new Uint8Array(30 + name.length);
        const lv = new DataView(lh.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 10, true);           // version needed
        lv.setUint16(6, 0x0800, true);       // UTF-8 names
        lv.setUint16(8, 0, true);            // stored
        lv.setUint16(10, dosTime, true);
        lv.setUint16(12, dosDate, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, data.length, true);
        lv.setUint32(22, data.length, true);
        lv.setUint16(26, name.length, true);
        lv.setUint16(28, 0, true);
        lh.set(name, 30);
        locals.push(lh, data);

        const ch = new Uint8Array(46 + name.length);
        const cv = new DataView(ch.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 10, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, dosTime, true);
        cv.setUint16(14, dosDate, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, name.length, true);
        cv.setUint32(42, offset, true);
        ch.set(name, 46);
        centrals.push(ch);
        offset += lh.length + data.length;
    }
    const cdSize = centrals.reduce((a, c) => a + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    const parts = [...locals, ...centrals, end];
    const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}

/** Read back a stored zip: [{ name, data, crcOk, method, offset }]. Used by the tests to check an EPUB. */
export function unzip(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let e = bytes.length - 22;
    while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('no end of central directory');
    const count = v.getUint16(e + 10, true);
    let p = v.getUint32(e + 16, true);
    const dec = new TextDecoder();
    const out = [];
    for (let i = 0; i < count; i++) {
        if (v.getUint32(p, true) !== 0x02014b50) throw new Error('bad central header');
        const method = v.getUint16(p + 10, true);
        const crc = v.getUint32(p + 16, true);
        const size = v.getUint32(p + 20, true);
        const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
        const off = v.getUint32(p + 42, true);
        const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
        const lnlen = v.getUint16(off + 26, true), lxlen = v.getUint16(off + 28, true);
        const data = bytes.subarray(off + 30 + lnlen + lxlen, off + 30 + lnlen + lxlen + size);
        out.push({ name, data, method, offset: off, crcOk: crc32(data) === crc, extra: lxlen });
        p += 46 + nlen + xlen + clen;
    }
    return out;
}
