import { KeyObject } from 'crypto';
import { DetectionResult, ProvenancePayload } from '../types';
import { hashDocument } from '../crypto/hash';
import { verifyPayload } from '../crypto/signature';
import { deserializePayload, bitsToPayload } from '../payload/bitstream';
import { ConcatenatedCode } from '../ecc';
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

    // ECC Decoding: BCH inner + Reed-Solomon outer, with repair telemetry.
    const ecc = new ConcatenatedCode();
    const report = ecc.decodeWithReport(rawBits);
    const decodedBits = report.bits;
    const eccStats = {
        bchBitsCorrected: report.bchBitsCorrected,
        rsBytesCorrected: report.rsBytesCorrected,
        uncorrectableBlocks: report.uncorrectableBlocks,
        totalCorrections: report.totalCorrections,
    };

    if (report.totalCorrections > 0) {
        warnings.push(
            `ECC repaired ${report.totalCorrections} symbol(s) ` +
            `(BCH ${report.bchBitsCorrected} bit(s), RS ${report.rsBytesCorrected} byte(s)) ` +
            `- payload was partially corrupted.`
        );
    }
    if (report.uncorrectableBlocks > 0) {
        warnings.push(
            `${report.uncorrectableBlocks} ECC block(s) were beyond repair - heavy tampering.`
        );
    }

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

    // Base integrity from payload/hash, then penalized by how much repair the
    // ECC had to do. A pristine watermark needs zero corrections; every symbol
    // the codes fix is graded evidence of tampering.
    let integrityScore = payloadRecovered && recoveredPayload?.documentHash === currentHash ? 1.0 : (payloadRecovered ? 0.5 : 0.0);
    if (report.uncorrectableBlocks > 0) {
        integrityScore = Math.min(integrityScore, 0.25);
    } else if (report.totalCorrections > 0) {
        // Scale penalty with the amount of correction (caps at ~0.5 off).
        integrityScore = Math.max(0, integrityScore - Math.min(0.5, report.totalCorrections * 0.05));
    }

    return {
        detected,
        confidence: detected ? (signatureValid ? 1.0 : 0.7) : 0.0,
        signatureValid,
        payloadRecovered,
        integrityScore,
        recoveredPayload,
        warnings,
        ecc: eccStats
    };
}
