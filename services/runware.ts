interface ImageGenerationOptions {
    prompt: string;
    width?: number;
    height?: number;
}

export class RunwareService {
    private apiKey: string;
    private baseUrl = 'https://api.runware.ai/v1';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async generateImage({ prompt, width = 512, height = 512 }: ImageGenerationOptions): Promise<string> {
        const requestBody = {
            taskType: 'imageInference',
            taskUUID: crypto.randomUUID(),
            model: 'runware:100@1',
            positivePrompt: prompt,
            width,
            height,
            numberResults: 1,
            outputType: 'URL',
        };

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify([requestBody]),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Runware API error (${response.status}): ${errorText || response.statusText}`);
            }

            const data = await response.json();

            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                const imageUrl = data.data[0].imageURL || data.data[0].imageSrc || data.data[0].url;
                if (imageUrl) return imageUrl;
            }

            if (Array.isArray(data) && data.length > 0) {
                const imageUrl = data[0].imageURL || data[0].imageSrc || data[0].url;
                if (imageUrl) return imageUrl;
            }

            if (data.imageURL || data.imageSrc) return data.imageURL || data.imageSrc;

            throw new Error('No image URL in response');
        } catch (error: any) {
            console.error('❌ Runware generateImage failed:', error);
            throw new Error(`Failed to generate image: ${error.message}`);
        }
    }

    async drawOnCanvas(instruction: string, currentCanvasDataUrl?: string): Promise<string> {
        const response = await fetch(`${this.baseUrl}/image/edit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                instruction,
                image: currentCanvasDataUrl,
                model: 'stable-diffusion-v1-5',
            }),
        });

        if (!response.ok) {
            throw new Error(`Runware API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.images && data.images.length > 0) {
            return data.images[0].url;
        }

        throw new Error('No image generated');
    }
}
