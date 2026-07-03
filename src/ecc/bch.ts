/**
 * Binary BCH codec, narrow-sense, over GF(2^8) with n = 255.
 *
 * BCH is a *bit-level* cyclic code. A t-error-correcting BCH code has 2t
 * consecutive powers of alpha (alpha^1 .. alpha^2t) as roots of its generator
 * polynomial, and corrects up to t *bit* flips per block no matter where they
 * land. That complements Reed-Solomon: BCH mops up sparse, scattered bit
 * corruption (a handful of watermark characters flipped or swapped), which RS,
 * being byte-oriented, spends a whole parity symbol on per affected byte.
 *
 * Generator g(x) = LCM of the minimal polynomials of alpha^1 .. alpha^2t.
 * Decoding: syndromes -> Berlekamp-Massey (error locator) -> Chien search
 * (locations). Magnitudes are always 1 in a binary code, so we just flip.
 *
 * Polynomials here are degree-indexed (poly[d] is the coefficient of x^d),
 * matching the helpers in ./gf256.
 */

import { gfMul, gfDiv, gfAlphaPow, polyMul, polyEval, ORDER } from './gf256';

const BLOCK_N = ORDER; // 255

function degree(p: number[]): number {
    for (let d = p.length - 1; d >= 0; d--) if (p[d] !== 0) return d;
    return -1;
}

/** Cyclotomic coset of e mod 255 under multiplication by 2. */
function coset(e: number): number[] {
    const out: number[] = [];
    let x = e % ORDER;
    do {
        out.push(x);
        x = (x * 2) % ORDER;
    } while (x !== e % ORDER);
    return out;
}

/** Minimal polynomial of alpha^e over GF(2): product of (x - alpha^s), s in coset. */
function minimalPoly(e: number): number[] {
    let m = [1];
    for (const s of coset(e)) {
        // factor (x + alpha^s), degree-indexed: [alpha^s, 1]
        m = polyMul(m, [gfAlphaPow(s), 1]);
    }
    return m; // coefficients come out as 0/1
}

/** Binary polynomial remainder: dividend mod g, both degree-indexed. */
function binMod(dividend: number[], g: number[]): number[] {
    const r = dividend.slice();
    const dg = degree(g);
    for (let i = degree(r); i >= dg; i--) {
        if (r[i] === 1) {
            for (let j = 0; j <= dg; j++) r[i - dg + j] ^= g[j];
        }
    }
    return r.slice(0, dg);
}

/** Berlekamp-Massey over GF(2^8). synd is 1-indexed (synd[0] unused). */
function berlekampMassey(synd: number[], twoT: number): number[] {
    let lambda = [1];
    let B = [1];
    let L = 0;
    let m = 1;
    let b = 1;
    for (let n = 0; n < twoT; n++) {
        let delta = synd[n + 1];
        for (let i = 1; i <= L; i++) {
            if (lambda[i]) delta ^= gfMul(lambda[i], synd[n + 1 - i]);
        }
        if (delta === 0) {
            m++;
        } else if (2 * L <= n) {
            const T = lambda.slice();
            const scale = gfDiv(delta, b);
            const shifted = new Array(B.length + m).fill(0);
            for (let i = 0; i < B.length; i++) shifted[i + m] = gfMul(scale, B[i]);
            lambda = polyXor(lambda, shifted);
            L = n + 1 - L;
            B = T;
            b = delta;
            m = 1;
        } else {
            const scale = gfDiv(delta, b);
            const shifted = new Array(B.length + m).fill(0);
            for (let i = 0; i < B.length; i++) shifted[i + m] = gfMul(scale, B[i]);
            lambda = polyXor(lambda, shifted);
            m++;
        }
    }
    return lambda;
}

function polyXor(p: number[], q: number[]): number[] {
    const r = new Array(Math.max(p.length, q.length)).fill(0);
    for (let i = 0; i < p.length; i++) r[i] ^= p[i];
    for (let i = 0; i < q.length; i++) r[i] ^= q[i];
    return r;
}

export interface BCHDecodeStats {
    bits: string;
    blocks: number;
    bitsCorrected: number;
    uncorrectableBlocks: number;
}

/**
 * Binary BCH(255, k) with self-describing block framing.
 *
 * Layout before encoding: [32-bit big-endian original bit length][payload bits]
 * padded to a multiple of k, split into k-bit message blocks, each encoded to
 * a 255-bit codeword (k message bits followed by n-k parity bits).
 */
export class BCH {
    readonly t: number;
    readonly n = BLOCK_N;
    readonly k: number;
    private readonly gen: number[];

    /** @param t number of correctable bit errors per 255-bit block. */
    constructor(t: number = 8) {
        if (t < 1) throw new Error('t must be >= 1');
        const covered = new Set<number>();
        let g = [1];
        for (let i = 1; i <= 2 * t; i++) {
            if (covered.has(i % ORDER)) continue;
            for (const s of coset(i)) covered.add(s);
            g = polyMul(g, minimalPoly(i));
        }
        this.gen = g;
        this.t = t;
        this.k = this.n - degree(g);
        if (this.k <= 0) throw new Error('t too large for n=255');
    }

    private encodeBlock(msgBits: number[]): number[] {
        // Place message bits in the high coefficients x^{n-1} .. x^{n-k}.
        const D = new Array(this.n).fill(0);
        for (let j = 0; j < this.k; j++) D[this.n - 1 - j] = msgBits[j] ?? 0;
        const parity = binMod(D, this.gen); // occupies x^{n-k-1} .. x^0
        const co = D.slice();
        for (let d = 0; d < parity.length; d++) co[d] ^= parity[d];
        return co; // degree-indexed codeword
    }

    private decodeBlock(co: number[]): { msg: number[]; corrected: number; uncorrectable: boolean } {
        const twoT = 2 * this.t;
        const synd = [0];
        let anyError = false;
        for (let i = 1; i <= twoT; i++) {
            const s = polyEval(co, gfAlphaPow(i));
            synd.push(s);
            if (s !== 0) anyError = true;
        }
        const readMsg = (c: number[]) => {
            const out: number[] = [];
            for (let j = 0; j < this.k; j++) out.push(c[this.n - 1 - j]);
            return out;
        };
        if (!anyError) return { msg: readMsg(co), corrected: 0, uncorrectable: false };

        const lambda = berlekampMassey(synd, twoT);
        const errs = degree(lambda);
        // Chien search: position p is an error iff lambda(alpha^{-p}) == 0.
        const fixed = co.slice();
        const positions: number[] = [];
        for (let p = 0; p < this.n; p++) {
            if (polyEval(lambda, gfAlphaPow(-p)) === 0) positions.push(p);
        }
        if (positions.length !== errs || errs === 0) {
            return { msg: readMsg(co), corrected: 0, uncorrectable: true };
        }
        for (const p of positions) fixed[p] ^= 1;
        // Verify all syndromes now vanish.
        for (let i = 1; i <= twoT; i++) {
            if (polyEval(fixed, gfAlphaPow(i)) !== 0) {
                return { msg: readMsg(co), corrected: 0, uncorrectable: true };
            }
        }
        return { msg: readMsg(fixed), corrected: positions.length, uncorrectable: false };
    }

    encode(bits: string): string {
        const L = bits.length;
        const header =
            ((L >>> 24) & 0xff).toString(2).padStart(8, '0') +
            ((L >>> 16) & 0xff).toString(2).padStart(8, '0') +
            ((L >>> 8) & 0xff).toString(2).padStart(8, '0') +
            (L & 0xff).toString(2).padStart(8, '0');
        let data = header + bits;
        while (data.length % this.k !== 0) data += '0';

        let out = '';
        for (let i = 0; i < data.length; i += this.k) {
            const block = data.substring(i, i + this.k).split('').map((c) => (c === '1' ? 1 : 0));
            const co = this.encodeBlock(block);
            // Emit codeword high-to-low so the first k bits are the message.
            for (let d = this.n - 1; d >= 0; d--) out += co[d] ? '1' : '0';
        }
        return out;
    }

    decodeWithStats(bits: string): BCHDecodeStats {
        let dataBits = '';
        let blocks = 0;
        let bitsCorrected = 0;
        let uncorrectableBlocks = 0;

        for (let i = 0; i + this.n <= bits.length; i += this.n) {
            const chunk = bits.substring(i, i + this.n);
            // Rebuild degree-indexed codeword from high-to-low bit order.
            const co = new Array(this.n).fill(0);
            for (let d = 0; d < this.n; d++) co[this.n - 1 - d] = chunk[d] === '1' ? 1 : 0;
            const res = this.decodeBlock(co);
            dataBits += res.msg.map((b) => (b ? '1' : '0')).join('');
            bitsCorrected += res.corrected;
            if (res.uncorrectable) uncorrectableBlocks++;
            blocks++;
        }

        const headerBits = dataBits.substring(0, 32);
        const L = parseInt(headerBits || '0', 2) >>> 0;
        const payload = dataBits.substring(32);
        const bitLen = Math.min(L, payload.length);
        return { bits: payload.substring(0, bitLen), blocks, bitsCorrected, uncorrectableBlocks };
    }

    decode(bits: string): string {
        return this.decodeWithStats(bits).bits;
    }
}
