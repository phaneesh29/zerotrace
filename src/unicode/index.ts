/**
 * Core Module 7: Unicode Watermark Channel
 */

export const CHANNEL_A = '\u200B'; // Zero Width Space -> 0
export const CHANNEL_B = '\u200C'; // Zero Width Non Joiner -> 1

export function bitToUnicode(bit: string): string {
    return bit === '1' ? CHANNEL_B : CHANNEL_A;
}

export function unicodeToBit(char: string): string | null {
    if (char === CHANNEL_A) return '0';
    if (char === CHANNEL_B) return '1';
    return null;
}
