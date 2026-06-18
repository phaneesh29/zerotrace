import { createHmac } from 'crypto';

/**
 * Core Module 8: Keyed Placement Engine
 */
export function getPlacementPositions(text: string, secretKey: string, documentHash: string, nonce: string, numBits: number): number[] {
    const boundaries = Array.from(text.matchAll(/\b/g)).map(m => m.index as number);
    
    if (boundaries.length === 0) {
        throw new Error("Text too short or has no word boundaries.");
    }

    const positions: number[] = [];
    let seed = createHmac('sha256', secretKey)
                .update(documentHash + nonce)
                .digest('hex');

    for (let i = 0; i < numBits; i++) {
        const hash = createHmac('sha256', secretKey).update(seed).digest('hex');
        const rand = parseInt(hash.substring(0, 8), 16) / 0xffffffff;
        
        const index = Math.floor(rand * boundaries.length);
        positions.push(boundaries[index]);
        
        // Update seed for next bit
        seed = hash;
    }
    
    // Sort positions descending to allow insertion without shifting subsequent indices
    // Reverse them if they are identical so that they are inserted in the correct order
    // Wait, if we sort descending, equal positions will maintain their relative order?
    // Actually, to ensure B1 is inserted before B2 at the same index, we should sort by pos descending, then original index descending.
    const posWithOriginalIndices = positions.map((pos, idx) => ({ pos, idx }));
    posWithOriginalIndices.sort((a, b) => {
        if (b.pos !== a.pos) return b.pos - a.pos;
        return b.idx - a.idx;
    });
    
    return posWithOriginalIndices.map(p => p.pos);
}
