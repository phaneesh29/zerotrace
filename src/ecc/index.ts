/**
 * Core Module 5: Error Correction
 *
 * The watermark bitstream is protected by a *concatenated* error-correcting
 * code (the industry-standard construction used in deep-space, storage, and
 * broadcast systems):
 *
 *   data --> [ Reed-Solomon outer ] --> [ BCH inner ] --> embedded bits
 *
 * and the reverse on extraction:
 *
 *   extracted bits --> [ BCH inner ] --> [ Reed-Solomon outer ] --> data
 *
 * Why two codes instead of the old 3x repetition:
 *   - BCH (inner) cleans up *scattered bit flips* — individual watermark
 *     characters that get swapped or corrupted. It corrects t bits per block
 *     but is defeated by a long burst.
 *   - Reed-Solomon (outer) is byte-oriented, so any residual burst that the
 *     inner code turns into a clustered error is seen by RS as just a few bad
 *     *symbols*, which it corrects. This is exactly the "burst tampering"
 *     case: deleting/editing a sentence wipes a contiguous run of symbols.
 *
 * Repetition-3 could only ever fix 1 error per 3 bits (a 33% overhead for very
 * weak protection and no real detection signal). The concatenated code both
 * corrects far more damage and, crucially for provenance, reports *how much*
 * correction was needed and whether any block was beyond repair — a direct,
 * quantitative tamper signal.
 */

import { ReedSolomon, RSDecodeStats } from './reedSolomon';
import { BCH, BCHDecodeStats } from './bch';

export interface ECCAlgorithm {
    encode(bits: string): string;
    decode(encodedBits: string): string;
}

/** Legacy repetition code, kept for comparison/back-compat. */
export class RepetitionCode implements ECCAlgorithm {
    constructor(private repetitions: number = 3) {}

    encode(bits: string): string {
        let encoded = '';
        for (const bit of bits) encoded += bit.repeat(this.repetitions);
        return encoded;
    }

    decode(encodedBits: string): string {
        let decoded = '';
        for (let i = 0; i < encodedBits.length; i += this.repetitions) {
            const chunk = encodedBits.substring(i, i + this.repetitions);
            const countOnes = chunk.split('1').length - 1;
            decoded += countOnes > this.repetitions / 2 ? '1' : '0';
        }
        return decoded;
    }
}

export interface TamperReport {
    /** Recovered payload bits. */
    bits: string;
    /** Bit errors repaired by the BCH inner stage. */
    bchBitsCorrected: number;
    /** Byte errors repaired by the Reed-Solomon outer stage. */
    rsBytesCorrected: number;
    /** Blocks the codes could not fully repair (strong tamper evidence). */
    uncorrectableBlocks: number;
    /** Total symbols repaired across both stages. */
    totalCorrections: number;
    /** True when the codes had to repair or gave up on something. */
    tampered: boolean;
}

/**
 * Concatenated BCH-inner / Reed-Solomon-outer code.
 * Implements ECCAlgorithm, and additionally exposes decode statistics that the
 * detector uses as a graded tamper score.
 */
export class ConcatenatedCode implements ECCAlgorithm {
    private readonly rs: ReedSolomon;
    private readonly bch: BCH;

    /**
     * @param rsParity number of RS parity bytes/block (corrects rsParity/2 bytes)
     * @param bchT     BCH bit-errors corrected per 255-bit block
     */
    constructor(rsParity: number = 16, bchT: number = 8) {
        this.rs = new ReedSolomon(rsParity);
        this.bch = new BCH(bchT);
    }

    encode(bits: string): string {
        // Outer (RS) first, then inner (BCH) wraps it for transmission.
        return this.bch.encode(this.rs.encode(bits));
    }

    decode(encodedBits: string): string {
        return this.rs.decode(this.bch.decode(encodedBits));
    }

    /** Decode while collecting per-stage repair statistics for tamper scoring. */
    decodeWithReport(encodedBits: string): TamperReport {
        const bchStats: BCHDecodeStats = this.bch.decodeWithStats(encodedBits);
        const rsStats: RSDecodeStats = this.rs.decodeWithStats(bchStats.bits);
        const uncorrectableBlocks = bchStats.uncorrectableBlocks + rsStats.uncorrectableBlocks;
        const totalCorrections = bchStats.bitsCorrected + rsStats.bytesCorrected;
        return {
            bits: rsStats.bits,
            bchBitsCorrected: bchStats.bitsCorrected,
            rsBytesCorrected: rsStats.bytesCorrected,
            uncorrectableBlocks,
            totalCorrections,
            tampered: totalCorrections > 0 || uncorrectableBlocks > 0,
        };
    }
}

export { ReedSolomon } from './reedSolomon';
export { BCH } from './bch';
