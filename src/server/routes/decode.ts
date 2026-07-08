import { Router, Request, Response } from 'express';
import { KeyObject } from 'crypto';
import { detectWatermark } from '../../detector';
import { SECRET_KEY } from '../../config';
import { lookupHistory } from '../lib/history';

export function createDecodeRouter(publicKey: KeyObject): Router {
    const router = Router();

    router.post('/decode', (req: Request, res: Response) => {
        try {
            const { text } = req.body ?? {};

            if (typeof text !== 'string' || text.length === 0) {
                return res.status(400).json({ error: 'Field "text" (non-empty string) is required.' });
            }

            // Look up in history to find original watermarked text
            const historyEntry = lookupHistory(text);
            const watermarkedOriginal = historyEntry?.watermarkedText;

            const result = detectWatermark(text, publicKey, SECRET_KEY, watermarkedOriginal);
            
            res.json({
                ...result,
                originalText: historyEntry?.generatedText
            });
        } catch (err) {
            console.error('Error during decode:', err);
            res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error during decode.' });
        }
    });

    return router;
}
