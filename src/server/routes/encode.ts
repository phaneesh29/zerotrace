import { Router, Request, Response } from 'express';
import { KeyObject } from 'crypto';
import { embedWatermark } from '../../watermark/embedder';
import { ProvenancePayload } from '../../types';
import { runAgent } from '../lib/agent';
import { SECRET_KEY } from '../../config';
import { addToHistory } from '../lib/history';

export function createEncodeRouter(privateKey: KeyObject): Router {
    const router = Router();

    router.post('/encode', async (req: Request, res: Response) => {
        try {
            const { prompt, model } = req.body ?? {};

            if (typeof prompt !== 'string' || prompt.trim().length === 0) {
                return res.status(400).json({ error: 'Field "prompt" (non-empty string) is required.' });
            }

            // Run ToolLoopAgent autonomously, always allowing it to search when needed
            const { text: generatedText, searchResults } = await runAgent(prompt, { 
                enableSearch: true 
            });

            const payload: ProvenancePayload = {
                version: '1.0',
                provider: 'zerotrace-web',
                modelId: model || 'mistral-small-latest',
                timestamp: new Date().toISOString(),
                nonce: Math.random().toString(36).substring(2, 15),
                documentHash: '', // populated by embedWatermark
            };

            const watermarkedText = embedWatermark(generatedText, payload, privateKey, SECRET_KEY);

            // Save to persistent history
            addToHistory({
                prompt,
                generatedText,
                watermarkedText,
                payload,
                timestamp: payload.timestamp
            });

            res.json({
                prompt,
                generatedText,
                watermarkedText,
                payload,
                searchResults,
            });
        } catch (err) {
            console.error('Error during encode:', err);
            res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error during encode.' });
        }
    });

    return router;
}

