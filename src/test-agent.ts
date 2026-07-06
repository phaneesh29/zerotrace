import { z } from 'zod';
import { searchTavily } from './server/lib/tavily';
import 'dotenv/config';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function runTest(prompt: string) {
    console.log('\n=======================================');
    console.log('Testing Prompt:', prompt);
    console.log('=======================================');

    const { ToolLoopAgent, tool } = await import('ai');
    const { mistral } = await import('@ai-sdk/mistral');

    const webSearchTool = tool({
        description: 'Search the web using Tavily. Use this tool ONLY when you need real-time, current information, facts, or data that you do not know. Do NOT use it if you can answer the question with absolute certainty from your training data.',
        parameters: z.object({
            query: z.string().describe('The precise search query to look up on the web'),
            searchDepth: z.enum(['basic', 'advanced']).describe('The depth of the search. You must choose "basic" for simple fact retrieval/quick lookups, and "advanced" for complex, technical, or research-oriented queries that need deep retrieval.'),
        }),
        execute: async ({ query, searchDepth }: { query: string; searchDepth?: 'basic' | 'advanced' }) => {
            console.log(`[Tool Executed] Web search query: "${query}" (depth: ${searchDepth})`);
            if (!query) {
                return { results: [], error: 'Query parameter is required' };
            }
            try {
                if (!process.env.TAVILY_API_KEY) {
                    console.log('[Mock Search] (No TAVILY_API_KEY found)');
                    return {
                        query,
                        results: [
                            { title: 'Mock Result', url: 'https://example.com', content: `This is a mock search result for: ${query}` }
                        ]
                    };
                }
                const response = await searchTavily(query, { searchDepth: searchDepth || 'basic', maxResults: 3 });
                return response;
            } catch (err) {
                console.error('Tavily search tool error:', err);
                return { results: [], error: err instanceof Error ? err.message : String(err) };
            }
        }
    } as any);

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
        tools: {
            webSearch: webSearchTool
        }
    });

    const response = await agent.generate({
        prompt: prompt
    });

    console.log('Final Agent Response:', response.text);
    console.log('Steps executed:', response.steps.length);
    let calledSearch = false;
    response.steps.forEach((step) => {
        if (step.toolCalls && step.toolCalls.some(tc => tc.toolName === 'webSearch')) {
            calledSearch = true;
        }
    });
    console.log('Called Web Search Tool:', calledSearch);
}

async function main() {
    // 1. Common knowledge - should NOT trigger search
    await runTest('What is the capital of France?');

    // 2. Real-time / recent factual info - should trigger search
    await runTest('What are the latest developments in AI as of mid 2026?');
}

main().catch(console.error);
