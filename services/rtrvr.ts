export interface RtrvrAgentOptions {
    prompt: string;
    webhookUrl?: string;
}

export class RtrvrService {
    private apiKey: string;
    private baseUrl = '/api/rtrvr';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async runAgent({ prompt, webhookUrl }: RtrvrAgentOptions): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/agent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    input: prompt,
                    ...(webhookUrl && { webhook_url: webhookUrl }),
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`rtrvr.ai API error (${response.status}): ${errorText || response.statusText}`);
            }

            return await response.json();
        } catch (error: any) {
            console.error('❌ rtrvr.ai runAgent failed:', error);
            throw new Error(`Failed to run web agent: ${error.message}`);
        }
    }

    async quickSearch(query: string): Promise<string> {
        // A simplified wrapper for searching and getting a summary
        const result = await this.runAgent({
            prompt: `Search the web for the latest information about: "${query}". Provide a concise summary of the key findings.`,
        });

        // rtrvr.ai returns { result: { text: "..." }, output: [...] }
        return result?.result?.text || result?.output || result?.result || 'No search results found.';
    }
}
