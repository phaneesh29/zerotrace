import * as fs from 'fs';
import * as path from 'path';
import { ProvenancePayload } from '../../types';
import { stripWatermark } from '../../detector';

const HISTORY_FILE = path.join(process.cwd(), 'watermark_history.json');

export interface HistoryEntry {
    prompt: string;
    generatedText: string;
    watermarkedText: string;
    payload: ProvenancePayload;
    timestamp: string;
}

function loadHistory(): HistoryEntry[] {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error loading history:', e);
    }
    return [];
}

function saveHistory(history: HistoryEntry[]) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving history:', e);
    }
}

export function addToHistory(entry: HistoryEntry) {
    const history = loadHistory();
    history.push(entry);
    saveHistory(history);
}

// Compute Jaccard similarity between two word sets
function getJaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().match(/\b\w+\b/g) || []);
    const words2 = new Set(text2.toLowerCase().match(/\b\w+\b/g) || []);
    
    if (words1.size === 0 && words2.size === 0) return 1.0;
    if (words1.size === 0 || words2.size === 0) return 0.0;
    
    let intersectionSize = 0;
    for (const word of words1) {
        if (words2.has(word)) {
            intersectionSize++;
        }
    }
    
    const unionSize = words1.size + words2.size - intersectionSize;
    return intersectionSize / unionSize;
}

export function lookupHistory(currentText: string, documentHash?: string): HistoryEntry | null {
    const history = loadHistory();
    if (history.length === 0) return null;

    const cleanCurrent = stripWatermark(currentText).trim();

    // 1. If we have the document hash, try exact match first
    if (documentHash) {
        const exactMatch = history.find(entry => entry.payload.documentHash === documentHash);
        if (exactMatch) return exactMatch;
    }

    // 2. Compute similarity against all entries
    let bestMatch: HistoryEntry | null = null;
    let bestSimilarity = 0.0;

    for (const entry of history) {
        const similarity = getJaccardSimilarity(cleanCurrent, entry.generatedText);
        if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = entry;
        }
    }

    // Return the match if similarity is above a threshold (e.g., 30% word overlap)
    if (bestSimilarity >= 0.3) {
        return bestMatch;
    }

    return null;
}
