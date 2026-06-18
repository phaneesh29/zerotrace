import { KeyObject } from 'crypto';
import { ProvenancePayload } from '../types';
import { hashDocument } from '../crypto/hash';
import { signPayload } from '../crypto/signature';
import { serializePayload, payloadToBits } from '../payload/bitstream';
import { RepetitionCode } from '../ecc';
import { bitToUnicode } from '../unicode';
import { getPlacementPositions } from './placement';

export function embedWatermark(
    text: string,
    payload: ProvenancePayload,
    privateKey: KeyObject,
    secretKey: string
): string {
    // 1. Hash Document
    payload.documentHash = hashDocument(text);

    // 2. Serialize and Sign
    const payloadStr = serializePayload(payload);
    const signature = signPayload(payloadStr, privateKey);

    // Wrapper containing both
    const wrapper = JSON.stringify({ p: payloadStr, s: signature });

    // 3. Bitstream
    const bits = payloadToBits(wrapper);

    // 4. ECC Encoding
    const ecc = new RepetitionCode(3);
    const encodedBits = ecc.encode(bits);

    // 5. Keyed Placement
    const positions = getPlacementPositions(text, secretKey, payload.documentHash, payload.nonce, encodedBits.length);

    // 6. Unicode Encode and Embed (iterating backwards to preserve indices)
    let watermarkedText = text;
    for (let i = 0; i < encodedBits.length; i++) {
        // Since positions are sorted descending
        const pos = positions[i];
        const bit = encodedBits[encodedBits.length - 1 - i]; // get matching bit for the position
        const unicodeChar = bitToUnicode(bit);
        
        watermarkedText = watermarkedText.substring(0, pos) + unicodeChar + watermarkedText.substring(pos);
    }

    return watermarkedText;
}
