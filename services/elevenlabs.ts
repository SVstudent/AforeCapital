import { sanitizeTextForSpeech } from '../utils/textSanitizer';

interface ElevenLabsConfig {
    apiKey: string;
    voiceId: string;
}

interface TextToSpeechOptions {
    text: string;
    voiceId: string;
}

export class ElevenLabsService {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey.trim();
    }

    async textToSpeech({ text, voiceId }: TextToSpeechOptions): Promise<Blob> {
        const sanitizedText = sanitizeTextForSpeech(text);
        try {
            const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': this.apiKey,
                    },
                    body: JSON.stringify({
                        text: sanitizedText,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                        },
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`ElevenLabs API error (${response.status}): ${response.statusText} - ${errorText}`);
            }

            const blob = await response.blob();
            return blob;
        } catch (error: any) {
            console.error('❌ ElevenLabs textToSpeech failed:', error);
            throw new Error(`Failed to convert text to speech: ${error.message}`);
        }
    }

    async speak(text: string, voiceId: string): Promise<void> {
        console.log(`🔊 ElevenLabs: Preparing to speak... (Voice: ${voiceId})`);
        try {
            const audioBlob = await this.textToSpeech({ text, voiceId });
            console.log(`🔊 ElevenLabs: Audio blob received (${audioBlob.size} bytes)`);
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            return new Promise((resolve, reject) => {
                const playAudio = () => {
                    console.log('🔊 ElevenLabs: Starting playback...');
                    audio.play().then(() => {
                        console.log('🔊 ElevenLabs: Playback started successfully');
                        resolve();
                    }).catch((playError) => {
                        console.error('❌ ElevenLabs: Playback failed:', playError);
                        URL.revokeObjectURL(audioUrl);
                        reject(playError);
                    });
                };

                audio.onended = () => {
                    console.log('🔊 ElevenLabs: Playback ended');
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };
                audio.onerror = (event) => {
                    console.error('❌ ElevenLabs: Audio object error:', event);
                    URL.revokeObjectURL(audioUrl);
                    reject(new Error('Audio playback failed'));
                };

                playAudio();
            });
        } catch (error: any) {
            console.error('❌ ElevenLabs: speak failed:', error);
            throw new Error(`Failed to speak: ${error.message}`);
        }
    }

    async getVoices() {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
                'xi-api-key': this.apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.statusText}`);
        }

        return await response.json();
    }
}
