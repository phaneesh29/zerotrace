/**
 * Minimal Mistral chat-completion client.
 * Docs: https://docs.mistral.ai/api/#tag/chat
 */

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_MODEL = 'mistral-small-latest';

export interface GenerateOptions {
    model?: string;
}

export async function generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
        throw new Error('MISTRAL_API_KEY is not set. Add it to a .env file in the project root.');
    }

    const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: options.model || DEFAULT_MODEL,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Mistral API error ${response.status}: ${body}`);
    }

    const data = await response.json() as any;
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.length === 0) {
        throw new Error('Mistral API returned an empty response.');
    }
    return text;
}
