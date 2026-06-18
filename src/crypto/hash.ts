import { createHash } from 'crypto';
import { canonicalize } from '../utils/canonicalize';

/**
 * Core Module 2: Document Hashing
 */
export function hashDocument(text: string): string {
    const canonicalText = canonicalize(text);
    return createHash('sha256').update(canonicalText, 'utf8').digest('hex');
}
