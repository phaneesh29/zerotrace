import { tavily } from '@tavily/core';

export interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
}

export interface TavilySearchResponse {
    query: string;
    answer?: string;
    results: TavilySearchResult[];
    responseTime: number;
}

export async function searchTavily(
    query: string, 
    options: { searchDepth?: 'basic' | 'advanced'; maxResults?: number } = {}
): Promise<TavilySearchResponse> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
        throw new Error('TAVILY_API_KEY is not set. Add it to a .env file in the project root.');
    }

    const tvly = tavily({ apiKey });
    
    // Note: the tavily core library returns camelCase or snake_case depending on version.
    // Let's standardise the return format.
    const rawResponse = await tvly.search(query, {
        searchDepth: options.searchDepth || 'basic',
        maxResults: options.maxResults || 5,
        includeAnswer: true,
    }) as any;

    return {
        query: rawResponse.query,
        answer: rawResponse.answer,
        results: (rawResponse.results || []).map((r: any) => ({
            title: r.title,
            url: r.url,
            content: r.content,
            score: r.score
        })),
        responseTime: rawResponse.response_time || 0
    };
}
