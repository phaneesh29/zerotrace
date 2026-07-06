import { z } from 'zod';
import { searchTavily } from './tavily';

export interface RunAgentResult {
    text: string;
    searchResults: any;
}

export async function runAgent(prompt: string, options: { enableSearch?: boolean } = {}): Promise<RunAgentResult> {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
        throw new Error('MISTRAL_API_KEY is not set. Add it to a .env file in the project root.');
    }

    // Dynamic import for ESM packages to avoid TS1479 CommonJS/ESM errors
    const { ToolLoopAgent, tool } = await import('ai');
    const { mistral } = await import('@ai-sdk/mistral');

    const tools: Record<string, any> = {};

    if (options.enableSearch) {
        tools.webSearch = tool({
            description: 'Search the web using Tavily. Use this tool ONLY when you need real-time, current information, facts, or data that you do not know. Do NOT use it if you can answer the question with absolute certainty from your training data.',
            parameters: z.object({
                query: z.string().min(1).describe('The precise search query to look up on the web. Must be a non-empty string.'),
                searchDepth: z.enum(['basic', 'advanced']).describe('The depth of the search. You must choose "basic" for simple fact retrieval/quick lookups, and "advanced" for complex, technical, or research-oriented queries that need deep retrieval.'),
            }),
            execute: async ({ query, searchDepth }: { query: string; searchDepth?: 'basic' | 'advanced' }) => {
                if (!query || query === 'undefined') {
                    throw new Error('A valid non-empty search query string is required. Please specify a search query.');
                }
                try {
                    const response = await searchTavily(query, { searchDepth: searchDepth || 'basic', maxResults: 3 });
                    return response;
                } catch (err) {
                    console.error('Tavily search tool error:', err);
                    return { results: [], error: err instanceof Error ? err.message : String(err) };
                }
            }
        } as any);
    }

    const agent = new ToolLoopAgent({
        model: mistral('mistral-small-latest'),
        instructions: `You are a helpful and accurate assistant.
You have access to a webSearch tool which queries Tavily for web results.
IMPORTANT: ONLY use the webSearch tool if:
1. The user request asks for recent events, live data, or things that change over time.
2. The user request asks about specific details that require factual lookup.
Otherwise, do NOT use the webSearch tool and answer directly from your knowledge base.
Always formulate a concise, specific search query when using the webSearch tool.
When calling the webSearch tool, you MUST explicitly choose and supply the 'searchDepth' parameter value: use "basic" for simple, straightforward facts, and "advanced" for comprehensive, deep, or detailed queries.`,
        tools
    });

    const response = await agent.generate({
        prompt: prompt
    });

    // Extract search results from the steps
    let searchResults = null;
    if (response.steps) {
        for (const step of response.steps) {
            if (step.toolResults) {
                const searchResult = step.toolResults.find((r: any) => r.toolName === 'webSearch');
                if (searchResult && searchResult.output) {
                    searchResults = searchResult.output;
                }
            }
        }
    }

    return {
        text: response.text,
        searchResults
    };
}
