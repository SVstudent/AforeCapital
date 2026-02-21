interface Message {
    role: 'user' | 'model';
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}

export class GeminiService {
    private apiKey: string;
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async callGemini(endpoint: string, body: any, retries = 3, delay = 2000): Promise<any> {
        try {
            const response = await fetch(
                `${this.baseUrl}/models/${endpoint}?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            );

            if (response.status === 429) {
                if (retries > 0) {
                    console.warn(`⚠️ Gemini 429 (Rate Limit) on ${endpoint}. Retrying in ${delay}ms... (${retries} attempts left)`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.callGemini(endpoint, body, retries - 1, delay * 2);
                }
                throw new Error('Gemini API rate limit exceeded (429). Please wait a moment.');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`❌ Gemini API Error (${response.status}):`, errorData);
                throw new Error(errorData.error?.message || `Gemini API error (${response.status}): ${response.statusText}`);
            }

            return await response.json();
        } catch (error: any) {
            if (retries > 0 && !error.message?.includes('429')) {
                console.warn(`🔄 Gemini network error on ${endpoint}, retrying...`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.callGemini(endpoint, body, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    async analyzeImage(imageDataUrl: string, question?: string): Promise<string> {
        const base64Data = imageDataUrl.split(',')[1];
        const mimeType = imageDataUrl.split(';')[0].split(':')[1];

        const prompt = question
            ? `The student has submitted this image with the following question: "${question}". Please analyze the image and identify what mathematical problem or concept is being shown. Provide a clear description of what you see.`
            : 'Please analyze this image and identify what mathematical problem or concept is being shown. Provide a clear description of what you see.';

        const data = await this.callGemini('gemini-2.5-flash:generateContent', {
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType, data: base64Data } }
                ]
            }]
        });

        return data.candidates[0].content.parts[0].text;
    }

    async chat(messages: Message[], systemPrompt: string): Promise<string> {
        const contents = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            ...messages.map((msg) => ({ role: msg.role, parts: msg.parts }))
        ];

        const data = await this.callGemini('gemini-2.5-flash:generateContent', {
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
        });

        return data.candidates[0].content.parts[0].text;
    }

    async analyzeCanvasForProblem(canvasDataUrl: string): Promise<string> {
        const base64Data = canvasDataUrl.split(',')[1];

        const data = await this.callGemini('gemini-2.5-flash:generateContent', {
            contents: [{
                parts: [
                    {
                        text: 'You are an expert math tutor analyzing a student\'s whiteboard work. Look at this image and identify:\n1. What problem they are working on\n2. What steps they have completed\n3. Any errors or mistakes in their work\n4. What would be helpful to circle, highlight, or annotate\n\nBe specific about WHERE errors are (e.g., "in step 2 on the left side") and WHAT is wrong. If the work is correct, say so clearly.',
                    },
                    { inlineData: { mimeType: 'image/png', data: base64Data } }
                ]
            }]
        });

        return data.candidates[0].content.parts[0].text;
    }

    async decideHelpfulAnnotations(canvasAnalysis: string, originalQuestion: string): Promise<string> {
        const data = await this.callGemini('gemini-2.5-flash:generateContent', {
            contents: [{
                parts: [{
                    text: `You are a helpful math tutor. Based on this analysis of a student's work:\n\n"${canvasAnalysis}"\n\nFor the problem: "${originalQuestion}"\n\nWhat visual annotations would be most helpful? Describe specific things to circle in red, checkmarks to add in green, or hints to write in blue. Be concrete and specific about what to annotate and why.`,
                }]
            }]
        });

        return data.candidates[0].content.parts[0].text;
    }

    async generateContextInfo(question: string, imageDataUrl?: string): Promise<any> {
        const parts: any[] = [{
            text: `You are the Lumina AI Tutor. Analyze this question and provide helpful contextual information: "${question}" Structure your response as a JSON object: { "title": "...", "blocks": [{ "type": "equation|definition|step-by-step|theorem|hint", "content": "..." }] }. Return ONLY valid JSON.`
        }];

        if (imageDataUrl) {
            const base64Data = imageDataUrl.split(',')[1];
            const mimeType = imageDataUrl.split(';')[0].split(':')[1];
            parts.push({ inlineData: { mimeType, data: base64Data } });
        }

        const data = await this.callGemini('gemini-2.5-flash:generateContent', {
            contents: [{ parts }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1000, responseMimeType: "application/json" }
        });

        const responseText = data.candidates[0].content.parts[0].text;
        try {
            return JSON.parse(responseText);
        } catch (e) {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            throw e;
        }
    }
}
