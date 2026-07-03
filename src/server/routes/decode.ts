import { Router, Request, Response } from 'express';
import { KeyObject } from 'crypto';
import { detectWatermark } from '../../detector';
import { SECRET_KEY } from '../../config';

export function createDecodeRouter(publicKey: KeyObject): Router {
    const router = Router();

    router.post('/decode', (req: Request, res: Response) => {
        try {
            const { text } = req.body ?? {};

            if (typeof text !== 'string' || text.length === 0) {
                return res.status(400).json({ error: 'Field "text" (non-empty string) is required.' });
            }

            const result = detectWatermark(text, publicKey, SECRET_KEY);
            res.json(result);
        } catch (err) {
            console.error('Error during decode:', err);
            res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error during decode.' });
        }
    });

    return router;
}
