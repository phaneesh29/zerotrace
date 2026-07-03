/**
 * Reed-Solomon codec over GF(2^8) (systematic, narrow-sense, generator alpha=2).
 *
 * RS is a MDS code that operates on *bytes* (symbols). A code with `nsym`
 * parity symbols corrects up to floor(nsym/2) corrupted bytes per 255-byte
 * block regardless of how the bit errors fall inside those bytes. That makes
 * it the right tool for *burst* / localized tampering: editing a sentence
 * corrupts a contiguous run of watermark symbols, and RS soaks that up.
 *
 * Algorithms are the textbook ones: syndrome computation, Berlekamp-Massey to
 * find the error locator, Chien search for positions, Forney for magnitudes.
 *
 * Internal polynomial convention here is leading-coefficient-first (poly[0] is
 * the highest-degree term), which is the standard RS-for-coders layout.
 */

import { gfMul, gfDiv, gfInv, gfAlphaPow } from './gf256';

const BLOCK_N = 255; // codeword length in bytes

/* ---- leading-first polynomial helpers over GF(2^8) ---- */

function polyScale(p: number[], x: number): number[] {
    return p.map((c) => gfMul(c, x));
}

function polyAdd(p: number[], q: number[]): number[] {
    const r = new Array(Math.max(p.length, q.length)).fill(0);
    for (let i = 0; i < p.length; i++) r[i + r.length - p.length] = p[i];
    for (let i = 0; i < q.length; i++) r[i + r.length - q.length] ^= q[i];
    return r;
}

function polyMul(p: number[], q: number[]): number[] {
    const r = new Array(p.length + q.length - 1).fill(0);
    for (let j = 0; j < q.length; j++) {
        for (let i = 0; i < p.length; i++) r[i + j] ^= gfMul(p[i], q[j]);
    }
    return r;
}

function polyEval(p: number[], x: number): number {
    let y = p[0];
    for (let i = 1; i < p.length; i++) y = gfMul(y, x) ^ p[i];
    return y;
}

/** Synthetic division; returns [quotient, remainder]. */
function polyDiv(dividend: number[], divisor: number[]): [number[], number[]] {
    const out = dividend.slice();
    for (let i = 0; i < dividend.length - (divisor.length - 1); i++) {
        const coef = out[i];
        if (coef !== 0) {
            for (let j = 1; j < divisor.length; j++) {
                if (divisor[j] !== 0) out[i + j] ^= gfMul(divisor[j], coef);
            }
        }
    }
    const sep = out.length - (divisor.length - 1);
    return [out.slice(0, sep), out.slice(sep)];
}

/* ---- encode ---- */

function generatorPoly(nsym: number): number[] {
    let g = [1];
    for (let i = 0; i < nsym; i++) g = polyMul(g, [1, gfAlphaPow(i)]);
    return g;
}

/** Systematic encode: returns k data bytes followed by nsym parity bytes. */
function encodeBlock(msg: number[], nsym: number): number[] {
    const gen = generatorPoly(nsym);
    const out = new Array(msg.length + nsym).fill(0);
    for (let i = 0; i < msg.length; i++) out[i] = msg[i];
    for (let i = 0; i < msg.length; i++) {
        const coef = out[i];
        if (coef !== 0) {
            for (let j = 1; j < gen.length; j++) out[i + j] ^= gfMul(gen[j], coef);
        }
    }
    for (let i = 0; i < msg.length; i++) out[i] = msg[i]; // restore data part
    return out;
}

/* ---- decode ---- */

function calcSyndromes(msg: number[], nsym: number): number[] {
    const s = [0];
    for (let i = 0; i < nsym; i++) s.push(polyEval(msg, gfAlphaPow(i)));
    return s;
}

function findErrorLocator(synd: number[], nsym: number): number[] {
    let errLoc = [1];
    let oldLoc = [1];
    const syndShift = synd.length - nsym; // == 1
    for (let i = 0; i < nsym; i++) {
        const K = i + syndShift;
        let delta = synd[K];
        for (let j = 1; j < errLoc.length; j++) {
            delta ^= gfMul(errLoc[errLoc.length - 1 - j], synd[K - j]);
        }
        oldLoc = oldLoc.concat([0]);
        if (delta !== 0) {
            if (oldLoc.length > errLoc.length) {
                const newLoc = polyScale(oldLoc, delta);
                oldLoc = polyScale(errLoc, gfInv(delta));
                errLoc = newLoc;
            }
            errLoc = polyAdd(errLoc, polyScale(oldLoc, delta));
        }
    }
    while (errLoc.length && errLoc[0] === 0) errLoc.shift();
    return errLoc;
}

/** Chien search: return error positions as byte offsets from the block start. */
function findErrors(errLocRev: number[], nmess: number): number[] {
    const errs = errLocRev.length - 1;
    const positions: number[] = [];
    for (let i = 0; i < nmess; i++) {
        if (polyEval(errLocRev, gfAlphaPow(i)) === 0) positions.push(nmess - 1 - i);
    }
    if (positions.length !== errs) return []; // decoding failure
    return positions;
}

function findErrataLocator(coefPos: number[]): number[] {
    let eLoc = [1];
    for (const i of coefPos) eLoc = polyMul(eLoc, polyAdd([1], [gfAlphaPow(i), 0]));
    return eLoc;
}

function findErrorEvaluator(synd: number[], errLoc: number[], nsym: number): number[] {
    const divisor = [1, ...new Array(nsym + 1).fill(0)];
    const [, remainder] = polyDiv(polyMul(synd, errLoc), divisor);
    return remainder;
}

/** Forney: compute and apply error magnitudes. */
function correctErrata(msg: number[], synd: number[], errPos: number[]): number[] {
    const coefPos = errPos.map((p) => msg.length - 1 - p);
    const errLoc = findErrataLocator(coefPos);
    const syndRev = synd.slice().reverse();
    const errEval = findErrorEvaluator(syndRev, errLoc, errLoc.length - 1).reverse();

    const X: number[] = coefPos.map((cp) => gfAlphaPow(-(BLOCK_N - cp)));

    const E = new Array(msg.length).fill(0);
    for (let i = 0; i < X.length; i++) {
        const XiInv = gfInv(X[i]);
        let denom = 1;
        for (let j = 0; j < X.length; j++) {
            if (j !== i) denom = gfMul(denom, 1 ^ gfMul(XiInv, X[j]));
        }
        let y = polyEval(errEval.slice().reverse(), XiInv);
        y = gfMul(X[i], y);
        E[errPos[i]] = gfDiv(y, denom);
    }
    return polyAdd(msg, E);
}

export interface RSBlockResult {
    data: number[]; // k recovered data bytes
    corrected: number; // number of byte errors corrected (0 if clean)
    uncorrectable: boolean; // true if syndromes were nonzero but not fixable
}

/** Decode one 255-byte block, returning the k data bytes plus repair stats. */
function decodeBlock(block: number[], nsym: number): RSBlockResult {
    const k = block.length - nsym;
    let msg = block.slice();
    const synd = calcSyndromes(msg, nsym);
    if (Math.max(...synd) === 0) {
        return { data: msg.slice(0, k), corrected: 0, uncorrectable: false };
    }
    const errLoc = findErrorLocator(synd, nsym);
    const errPos = findErrors(errLoc.slice().reverse(), msg.length);
    if (errPos.length === 0) {
        // Too many errors to locate: report and fall back to raw bytes.
        return { data: block.slice(0, k), corrected: 0, uncorrectable: true };
    }
    msg = correctErrata(msg, synd, errPos);
    const check = calcSyndromes(msg, nsym);
    if (Math.max(...check) > 0) {
        return { data: block.slice(0, k), corrected: 0, uncorrectable: true };
    }
    return { data: msg.slice(0, k), corrected: errPos.length, uncorrectable: false };
}

/* ---- bit <-> byte helpers ---- */

function bitsToBytes(bits: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8).padEnd(8, '0'), 2));
    }
    return bytes;
}

function bytesToBits(bytes: number[]): string {
    return bytes.map((b) => b.toString(2).padStart(8, '0')).join('');
}

export interface RSDecodeStats {
    bits: string;
    blocks: number;
    bytesCorrected: number;
    uncorrectableBlocks: number;
}

/**
 * Byte-oriented Reed-Solomon with self-describing block framing.
 *
 * Layout before RS encoding:
 *   [4-byte big-endian original bit length][ceil(L/8) payload bytes]
 * padded with zeros up to a multiple of k, then split into k-byte blocks,
 * each expanded to a 255-byte codeword.
 */
export class ReedSolomon {
    private readonly nsym: number;
    private readonly k: number;

    /** @param nsym number of parity bytes per block (corrects nsym/2 bytes). */
    constructor(nsym: number = 16) {
        if (nsym < 2 || nsym >= BLOCK_N) throw new Error('nsym out of range');
        this.nsym = nsym;
        this.k = BLOCK_N - nsym;
    }

    encode(bits: string): string {
        const payload = bitsToBytes(bits);
        const L = bits.length;
        const header = [(L >>> 24) & 0xff, (L >>> 16) & 0xff, (L >>> 8) & 0xff, L & 0xff];
        const data = header.concat(payload);
        while (data.length % this.k !== 0) data.push(0);

        const codeBytes: number[] = [];
        for (let i = 0; i < data.length; i += this.k) {
            codeBytes.push(...encodeBlock(data.slice(i, i + this.k), this.nsym));
        }
        return bytesToBits(codeBytes);
    }

    decodeWithStats(bits: string): RSDecodeStats {
        const codeBytes = bitsToBytes(bits);
        const data: number[] = [];
        let bytesCorrected = 0;
        let uncorrectableBlocks = 0;
        let blocks = 0;

        for (let i = 0; i + BLOCK_N <= codeBytes.length; i += BLOCK_N) {
            const res = decodeBlock(codeBytes.slice(i, i + BLOCK_N), this.nsym);
            data.push(...res.data);
            bytesCorrected += res.corrected;
            if (res.uncorrectable) uncorrectableBlocks++;
            blocks++;
        }

        const L = ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0;
        const payloadBits = bytesToBits(data.slice(4));
        const bitLen = Math.min(L, payloadBits.length);
        return {
            bits: payloadBits.substring(0, bitLen),
            blocks,
            bytesCorrected,
            uncorrectableBlocks,
        };
    }

    decode(bits: string): string {
        return this.decodeWithStats(bits).bits;
    }
}
