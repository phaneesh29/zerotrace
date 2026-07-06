import { ProvenancePayload } from '../types';

/**
 * Core Module 6: Bitstream Layer
 */

export function serializePayload(payload: ProvenancePayload): string {
    const compact = {
        v: payload.version,
        p: payload.provider === 'zerotrace-web' ? 'zt' : payload.provider,
        m: payload.modelId === 'mistral-small-latest' ? 'ms-l' : payload.modelId,
        t: Math.floor(new Date(payload.timestamp).getTime() / 1000), // Epoch seconds
        n: payload.nonce.substring(0, 6), // Truncate nonce to 6 chars to save space
        h: payload.documentHash
    };
    return JSON.stringify(compact);
}

export function deserializePayload(jsonStr: string): ProvenancePayload {
    const compact = JSON.parse(jsonStr);
    return {
        version: compact.v,
        provider: compact.p === 'zt' ? 'zerotrace-web' : compact.p,
        modelId: compact.m === 'ms-l' ? 'mistral-small-latest' : compact.m,
        timestamp: new Date(compact.t * 1000).toISOString(),
        nonce: compact.n,
        documentHash: compact.h
    };
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
