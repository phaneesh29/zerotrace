import { CHANNEL_A, CHANNEL_B } from '../unicode';

/**
 * Core Module 1: Canonicalization
 * Creates canonical text representation.
 */
export function canonicalize(text: string): string {
    // Strip invisible watermark characters before canonicalizing
    const stripped = text.replace(new RegExp(`[${CHANNEL_A}${CHANNEL_B}]`, 'g'), '');
    
    return stripped
        .replace(/\r\n/g, '\n')      // Normalize line endings
        .replace(/[ \t]+/g, ' ')     // Normalize horizontal whitespace
        .replace(/\n{3,}/g, '\n\n')  // Max two newlines
        .trim();                     // Remove leading/trailing whitespace
}
