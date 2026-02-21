export class MinimaxAudioService {
    private apiKey: string;
    private groupId: string;
    private baseUrl = 'https://api.minimax.chat/v1/audio/music_generation'; // For music/creative audio

    constructor(apiKey: string, groupId: string) {
        this.apiKey = apiKey;
        this.groupId = groupId;
    }

    async generateEducationalAudio(prompt: string, lyrics?: string): Promise<string> {
        console.log('🎵 MiniMax Audio: Generating creative audio for:', prompt);

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'minimax-music-01', // High-quality music/audio model
                    prompt: prompt,
                    lyrics: lyrics || "",
                    voice_setting: {
                        voice_id: "male-eng-2", // Default educational voice
                        speed: 1.0,
                        vol: 1.0
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`MiniMax Audio Error: ${errorData.base_resp?.status_msg || response.statusText}`);
            }

            const data = await response.json();
            return data.data?.audio_url || ""; // Returns the generated audio URL
        } catch (error: any) {
            console.error('❌ MiniMax Audio generation failed:', error);
            throw error;
        }
    }
}
