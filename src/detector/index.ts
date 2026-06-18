import { KeyObject } from 'crypto';
import { DetectionResult, ProvenancePayload } from '../types';
import { hashDocument } from '../crypto/hash';
import { verifyPayload } from '../crypto/signature';
import { deserializePayload, bitsToPayload } from '../payload/bitstream';
import { RepetitionCode } from '../ecc';
import { CHANNEL_A, CHANNEL_B, unicodeToBit } from '../unicode';
import { getPlacementPositions } from '../watermark/placement';
import { canonicalize } from '../utils/canonicalize';

export function stripWatermark(text: string): string {
    return text.replace(new RegExp(`[${CHANNEL_A}${CHANNEL_B}]`, 'g'), '');
}

export function extractBits(text: string, secretKey: string, documentHash: string, nonce: string, numBits: number): string {
    const cleanText = stripWatermark(text);
    const positions = getPlacementPositions(cleanText, secretKey, documentHash, nonce, numBits);
    
    // This requires recovering the exact placements and reading the characters
    // Since characters shift the string, a robust extractor scans for zero-width chars
    // Here we'll do a simplified scan: extract all embedded bits in order of their occurrence
    
    let extractedBits = '';
    for (const char of text) {
        const bit = unicodeToBit(char);
        if (bit !== null) {
            extractedBits += bit;
        }
    }
    return extractedBits;
}

export function detectWatermark(
    text: string,
    publicKey: KeyObject,
    secretKey: string
): DetectionResult {
    const cleanText = stripWatermark(text);
    const currentHash = hashDocument(cleanText);

    let warnings: string[] = [];
    let detected = false;
    let signatureValid = false;
    let payloadRecovered = false;
    let recoveredPayload: ProvenancePayload | undefined = undefined;

    // Extract raw bits
    const rawBits = extractBits(text, secretKey, currentHash, "", 0); // simplified extraction
    
    if (rawBits.length === 0) {
        return { detected, confidence: 0, signatureValid, payloadRecovered, integrityScore: 0, warnings };
    }

    // ECC Decoding
    const ecc = new RepetitionCode(3);
    const decodedBits = ecc.decode(rawBits);

    // Bitstream to JSON
    let wrapperJson = '';
    try {
        wrapperJson = bitsToPayload(decodedBits);
        const wrapper = JSON.parse(wrapperJson);
        const payloadStr = wrapper.p;
        const signature = wrapper.s;

        recoveredPayload = deserializePayload(payloadStr);
        payloadRecovered = true;
        detected = true;

        // Signature verification
        signatureValid = verifyPayload(payloadStr, signature, publicKey);
        if (!signatureValid) warnings.push("Signature verification failed.");

        // Integrity check
        if (recoveredPayload.documentHash !== currentHash) {
            warnings.push("Document hash mismatch. Text was tampered.");
        }

    } catch (e) {
        warnings.push("Failed to parse payload bitstream.");
        detected = rawBits.length > 50; // Partial detection
    }

    const integrityScore = payloadRecovered && recoveredPayload?.documentHash === currentHash ? 1.0 : (payloadRecovered ? 0.5 : 0.0);

    return {
        detected,
        confidence: detected ? (signatureValid ? 1.0 : 0.7) : 0.0,
        signatureValid,
        payloadRecovered,
        integrityScore,
        recoveredPayload,
        warnings
    };
}
