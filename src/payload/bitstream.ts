import { ProvenancePayload } from '../types';

/**
 * Core Module 6: Bitstream Layer
 */

export function serializePayload(payload: ProvenancePayload): string {
    return JSON.stringify(payload);
}

export function deserializePayload(jsonStr: string): ProvenancePayload {
    return JSON.parse(jsonStr);
}

export function payloadToBits(payloadStr: string): string {
    let bits = '';
    for (let i = 0; i < payloadStr.length; i++) {
        const bin = payloadStr.charCodeAt(i).toString(2).padStart(8, '0');
        bits += bin;
    }
    return bits;
}

export function bitsToPayload(bits: string): string {
    let str = '';
    for (let i = 0; i < bits.length; i += 8) {
        const chunk = bits.substring(i, i + 8);
        if (chunk.length < 8) break; // Incomplete byte
        str += String.fromCharCode(parseInt(chunk, 2));
    }
    return str;
}
