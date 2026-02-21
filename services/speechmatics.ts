export class SpeechmaticsService {
    private apiKey: string;
    private socket: WebSocket | null = null;
    private onTranscriptCallback: (text: string, isFinal: boolean) => void = () => { };

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    onTranscript(callback: (text: string, isFinal: boolean) => void) {
        this.onTranscriptCallback = callback;
    }

    async start(sampleRate: number = 16000) {
        console.log('🎙️ Speechmatics: Starting real-time transcription...');
        const url = `wss://eu2.rt.speechmatics.io/v2/en?auth_token=${this.apiKey}`;

        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            const config = {
                message: 'StartRecognition',
                audio_format: {
                    type: 'raw',
                    encoding: 'pcm_f32le', // Common for browser audio
                    sample_rate: sampleRate
                },
                transcription_config: {
                    language: 'en',
                    operating_point: 'enhanced', // The elite model
                    enable_partials: true
                }
            };
            this.socket?.send(JSON.stringify(config));
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.message === 'AddTranscript') {
                const text = data.metadata.transcript;
                this.onTranscriptCallback(text, true);
            } else if (data.message === 'AddPartialTranscript') {
                const text = data.metadata.transcript;
                this.onTranscriptCallback(text, false);
            }
        };

        this.socket.onerror = (error) => {
            console.error('❌ Speechmatics WebSocket Error:', error);
        };
    }

    sendAudio(data: ArrayBuffer) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(data);
        }
    }

    stop() {
        if (this.socket) {
            this.socket.close();
        }
    }
}
