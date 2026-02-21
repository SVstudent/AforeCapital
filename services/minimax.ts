export interface MinimaxMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class MinimaxService {
    private apiKey: string;
    private groupId: string;
    private baseUrl = 'https://api.minimax.io/v1/text/chatcompletion_v2';
    private imgUrl = 'https://api.minimax.io/v1/image_generation';

    constructor(apiKey: string, groupId: string) {
        this.apiKey = apiKey;
        this.groupId = groupId;
    }

    async chat(messages: MinimaxMessage[], systemPrompt?: string): Promise<string> {
        // ... (existing code, unchanged logic)
        const fullMessages = systemPrompt
            ? [{ role: 'system', content: systemPrompt } as MinimaxMessage, ...messages]
            : messages;

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'MiniMax-Text-01',
                    messages: fullMessages,
                    max_tokens: 4096,
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`MiniMax API Error: ${errorData.base_resp?.status_msg || response.statusText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "";
        } catch (error: any) {
            console.error('❌ Minimax Chat Error:', error);
            throw error;
        }
    }

    async generateImage(prompt: string): Promise<string> {
        if (!prompt || prompt.trim().length === 0) {
            throw new Error('MiniMax requires a non-empty text prompt for image generation.');
        }
        console.log('🎨 MiniMax: Generating image for:', prompt);
        try {
            const response = await fetch(this.imgUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'image-01',
                    prompt: prompt,
                    response_format: 'url'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`MiniMax Image Error: ${errorData.base_resp?.status_msg || response.statusText}`);
            }

            const data = await response.json();

            // International API format: data.image_urls is an array of strings
            if (data.data?.image_urls && data.data.image_urls.length > 0) {
                return data.data.image_urls[0];
            }

            // Fallback for different API versions
            if (data.data?.[0]?.url) {
                return data.data[0].url;
            }

            if (data.base_resp?.status_code !== 0) {
                throw new Error(data.base_resp?.status_msg || 'Unknown MiniMax error');
            }

            throw new Error('No image URL returned from MiniMax');
        } catch (error: any) {
            console.error('❌ MiniMax Image Gen Error:', error);
            throw error;
        }
    }
}
