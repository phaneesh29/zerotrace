/* Standalone correctness check: run with `npx tsx src/ecc/selftest.ts`. */
import { ReedSolomon, BCH, ConcatenatedCode } from './index';

// Deterministic PRNG so runs are reproducible (no Math.random).
let seed = 0x2545f491;
function rnd(): number {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 1000) / 1000;
}

function randomBits(n: number): string {
    let s = '';
    for (let i = 0; i < n; i++) s += rnd() < 0.5 ? '0' : '1';
    return s;
}

function flipBits(bits: string, count: number): string {
    const a = bits.split('');
    for (let i = 0; i < count; i++) {
        const p = Math.floor(rnd() * a.length);
        a[p] = a[p] === '1' ? '0' : '1';
    }
    return a.join('');
}

/** Corrupt a contiguous burst of bits (simulates deleting/editing a region). */
function burst(bits: string, start: number, len: number): string {
    const a = bits.split('');
    for (let i = start; i < start + len && i < a.length; i++) a[i] = a[i] === '1' ? '0' : '1';
    return a.join('');
}

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
    if (cond) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; console.log(`  FAIL ${name}`); }
}

console.log('Reed-Solomon (nsym=16 -> corrects 8 bytes/block):');
{
    const rs = new ReedSolomon(16);
    const msg = randomBits(1500);
    check('clean round trip', rs.decode(rs.encode(msg)) === msg);
    // Corrupt 8 whole bytes in the first block (byte-aligned 64-bit burst).
    const enc = rs.encode(msg);
    const dmg = burst(enc, 96, 64);
    const st = rs.decodeWithStats(dmg);
    check('recovers 8-byte burst', st.bits === msg);
    check('reports corrections > 0', st.bytesCorrected > 0);
}

console.log('BCH (t=8 -> corrects 8 bits/block):');
{
    const bch = new BCH(8);
    const msg = randomBits(1500);
    check('clean round trip', bch.decode(bch.encode(msg)) === msg);
    // Flip 8 scattered bits inside the first 255-bit block.
    let enc = bch.encode(msg);
    enc = flipBits(enc.substring(0, 255), 8) + enc.substring(255);
    const st = bch.decodeWithStats(enc);
    check('recovers 8 scattered flips', st.bits === msg);
    check('reports bitsCorrected > 0', st.bitsCorrected > 0);
}

console.log('Concatenated BCH+RS:');
{
    const cc = new ConcatenatedCode(16, 8);
    const msg = randomBits(1200);
    check('clean round trip', cc.decode(cc.encode(msg)) === msg);
    const clean = cc.decodeWithReport(cc.encode(msg));
    check('clean => not tampered', clean.tampered === false && clean.bits === msg);

    // Mixed damage: scattered flips + a burst.
    let enc = cc.encode(msg);
    enc = flipBits(enc, 20);
    enc = burst(enc, 400, 40);
    const rep = cc.decodeWithReport(enc);
    check('recovers mixed damage', rep.bits === msg);
    check('flags tampering', rep.tampered === true);
    console.log(`     -> bchBits=${rep.bchBitsCorrected} rsBytes=${rep.rsBytesCorrected} uncorrectable=${rep.uncorrectableBlocks}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
