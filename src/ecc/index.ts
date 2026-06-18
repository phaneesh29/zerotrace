/**
 * Core Module 5: Error Correction
 */

export interface ECCAlgorithm {
    encode(bits: string): string;
    decode(encodedBits: string): string;
}

export class RepetitionCode implements ECCAlgorithm {
    constructor(private repetitions: number = 3) {}

    encode(bits: string): string {
        let encoded = '';
        for (const bit of bits) {
            encoded += bit.repeat(this.repetitions);
        }
        return encoded;
    }

    decode(encodedBits: string): string {
        let decoded = '';
        for (let i = 0; i < encodedBits.length; i += this.repetitions) {
            const chunk = encodedBits.substring(i, i + this.repetitions);
            const countOnes = chunk.split('1').length - 1;
            decoded += countOnes > (this.repetitions / 2) ? '1' : '0';
        }
        return decoded;
    }
}
