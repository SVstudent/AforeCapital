import { MinimaxService } from './minimax';
import { MinimaxAudioService } from './minimaxAudio';
import { SharedAgentContext } from './sharedContext';

export class AudioAgent {
    private minimaxLLM: MinimaxService;
    private minimaxAudio: MinimaxAudioService;
    private sharedContext: SharedAgentContext | null = null;

    constructor(llm: MinimaxService, audio: MinimaxAudioService, sharedContext?: SharedAgentContext) {
        this.minimaxLLM = llm;
        this.minimaxAudio = audio;
        if (sharedContext) this.sharedContext = sharedContext;
    }

    setSharedContext(context: SharedAgentContext) {
        this.sharedContext = context;
    }

    async createEducationalAudio(request: string): Promise<string> {
        console.log('🎵 Audio Agent: Designing sound for:', request);

        // Step 1: Design - Use MiniMax LLM to design the music/audio prompt
        const contextSnapshot = this.sharedContext?.getSnapshot() || "";
        const designPrompt = `You are the Creative Sound Specialist for Lumina AI Tutor. 
        The student is asking about: "${request}"
        ${contextSnapshot ? `Shared Session context: ${contextSnapshot}` : ""}
        
        Your goal is to design a prompt for a music/audio generation system to create a short (10-30s) educational snippet or soundscape.
        Examples:
        - "Lo-fi study beat with subtle ocean waves for concentration"
        - "A 17th-century harpsichord piece in a minor key to illustrate the Baroque era"
        - "An industrial soundscape with rhythmic clanking for the Industrial Revolution"

        Return ONLY the prompt string.`;

        const audioPrompt = await this.minimaxLLM.chat([{ role: 'user', content: designPrompt }], "You are a Master Sound Designer Powered by MiniMax.");

        // Step 2: Generation - Call MiniMax Audio API
        const audioUrl = await this.minimaxAudio.generateEducationalAudio(audioPrompt);

        return audioUrl ? `Audio snippet generated: ${audioUrl}` : "Error generating audio.";
    }
}
