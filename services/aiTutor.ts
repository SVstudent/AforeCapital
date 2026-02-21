interface Message {
    role: 'user' | 'model';
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}

interface TutorConfig {
    pushinessLevel: number;
    currentProblem?: string;
    conversationHistory: Message[];
}

export class AITutorService {
    private pushinessLevel: number;
    private conversationHistory: Message[];
    private apiKey: string;
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    constructor(config: TutorConfig) {
        this.pushinessLevel = config.pushinessLevel;
        this.conversationHistory = config.conversationHistory || [];
        this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    }

    getSystemPrompt(): string {
        const pushinessDescriptions = {
            1: 'You are a minimally intrusive tutor. Only provide hints when the student explicitly asks for help. Let them struggle productively and discover solutions independently.',
            2: 'You are a supportive tutor who offers occasional guidance. Provide subtle hints when you notice the student is stuck for a while, but generally let them work through problems.',
            3: 'You are a balanced tutor. Proactively check in periodically to see if the student needs help. Offer guidance that encourages them to think through the problem without giving away the answer.',
            4: 'You are an active coach. Frequently check the student\'s understanding and offer guidance. Break down problems into smaller steps and guide them through each one.',
            5: 'You are a highly supportive tutor providing maximum assistance. Give step-by-step detailed explanations, check understanding frequently, and ensure the student follows each step correctly.',
        };

        return `${pushinessDescriptions[this.pushinessLevel as keyof typeof pushinessDescriptions]}

You are conducting a voice tutoring session, so your responses should be conversational and sound natural when spoken aloud. Avoid using complex formatting or written-only expressions.

IMPORTANT: You have access to a visual whiteboard. When students ask questions, you may receive an image showing:
- Their written work, calculations, or drawings on the whiteboard
- Any background content or problem statements
- Visual diagrams, graphs, or mathematical notation they've created

When you receive whiteboard images:
- Carefully analyze what the student has drawn or written
- Reference specific elements you see (e.g., "I see you've written the equation on the left side" or "Looking at your diagram")
- Identify any errors, misconceptions, or incomplete work in their visual content
- Provide feedback based on what you observe in the image
- Guide them to improve or correct their work on the whiteboard

Key principles:
- Use the Socratic method to guide learning
- Encourage critical thinking rather than just providing answers
- Be encouraging and patient
- Adapt your explanations to the student's level of understanding
- When analyzing whiteboard content, be specific about what you see and reference their work directly
- Only respond when the student asks a question - never provide unsolicited feedback

Current tutoring session focus: Help the student understand and solve their problem through guided conversation, incorporating visual feedback from their whiteboard work.`;
    }

    async getResponse(userMessage: string, imageDataUrl?: string): Promise<string> {
        const userParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

        if (imageDataUrl) {
            const base64Data = imageDataUrl.split(',')[1];
            const mimeType = imageDataUrl.split(';')[0].split(':')[1];
            userParts.push(
                { text: userMessage },
                { inlineData: { mimeType, data: base64Data } }
            );
        } else {
            userParts.push({ text: userMessage });
        }

        this.conversationHistory.push({
            role: 'user',
            parts: userParts,
        });

        const contents = [
            {
                role: 'user',
                parts: [{ text: this.getSystemPrompt() }],
            },
            ...this.conversationHistory.map((msg) => ({
                role: msg.role,
                parts: msg.parts,
            })),
        ];

        const response = await fetch(
            `${this.baseUrl}/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 300,
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.statusText}`);
        }

        const data = await response.json();
        const assistantMessage = data.candidates[0].content.parts[0].text;

        this.conversationHistory.push({
            role: 'model',
            parts: [{ text: assistantMessage }],
        });

        return assistantMessage;
    }

    shouldDrawOnCanvas(message: string): boolean {
        const drawIndicators = [
            'let me draw',
            'i\'ll draw',
            'drawing',
            'sketch',
            'illustrate',
            'show you on the board',
        ];

        return drawIndicators.some((indicator) =>
            message.toLowerCase().includes(indicator)
        );
    }

    extractDrawingInstruction(message: string): string | null {
        const match = message.match(/let me draw (.+?) on the whiteboard/i) ||
            message.match(/i'll draw (.+?) on the whiteboard/i) ||
            message.match(/drawing (.+?) on the board/i);

        return match ? match[1] : null;
    }

    getConversationHistory(): Message[] {
        return this.conversationHistory;
    }

    updatePushinessLevel(level: number): void {
        this.pushinessLevel = level;
    }
}
