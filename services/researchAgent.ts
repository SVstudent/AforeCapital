import { MinimaxService } from './minimax';
import { RtrvrService } from './rtrvr';
import { VisualAgent } from './visualAgent';
import { AudioAgent } from './audioAgent';
import { SharedAgentContext } from './sharedContext';

export class ResearchAgent {
    private minimax: MinimaxService;
    private rtrvr: RtrvrService;
    private visualAgent: VisualAgent | null = null;
    private audioAgent: AudioAgent | null = null;
    private sharedContext: SharedAgentContext | null = null;

    constructor(minimax: MinimaxService, rtrvr: RtrvrService, visualAgent?: VisualAgent, audioAgent?: AudioAgent, sharedContext?: SharedAgentContext) {
        this.minimax = minimax;
        this.rtrvr = rtrvr;
        if (visualAgent) this.visualAgent = visualAgent;
        if (audioAgent) this.audioAgent = audioAgent;
        if (sharedContext) this.sharedContext = sharedContext;
    }

    setSharedContext(context: SharedAgentContext) {
        this.sharedContext = context;
    }

    setVisualAgent(agent: VisualAgent) {
        this.visualAgent = agent;
    }

    setAudioAgent(agent: AudioAgent) {
        this.audioAgent = agent;
    }

    async conductResearch(query: string, context?: string): Promise<string> {
        console.log('🔍 Research Agent (MiniMax): Planning search for:', query);

        // Step 1: Reasoning - Use MiniMax to formulate the best search strategy
        const contextSnapshot = this.sharedContext?.getSnapshot() || "";
        const searchPlanPrompt = `You are a Research Specialist for the Lumina AI Tutor. 
        A student has asked: "${query}"
        
        ${contextSnapshot ? `Shared Session context: ${contextSnapshot}` : ""}
        ${context ? `Direct context: ${context}` : ''}
        
        Your goal is to formulate a search strategy. What specific details, facts, or data points are needed to provide a world-class educational answer? 
        Return 3 highly specific search queries, each on a new line.`;

        const searchQueriesText = await this.minimax.chat([{ role: 'user', content: searchPlanPrompt }], "You are a Research Intelligence Assistant Powered by MiniMax.");
        const queries = searchQueriesText.split('\n').filter(q => q.trim().length > 0).slice(0, 3);

        console.log('🔍 Research Agent: Executing queries:', queries);

        // Step 2: Execution - Call rtrvr.ai for each query
        const results = await Promise.all(queries.map(q => this.rtrvr.quickSearch(q)));
        const combinedResults = results.join('\n---\n');

        // Step 3: Synthesis - Use MiniMax to distilling findings
        console.log('🔍 Research Agent: Synthesizing findings...');
        const synthesisPrompt = `You are a Research Specialist for the Lumina AI Tutor. 
        ${contextSnapshot ? `Shared Session context: ${contextSnapshot}` : ""}

        Based on these fresh search results:
        ${combinedResults}
        
        Synthesize the info. Then, decide if a visual aid (diagram) or an audio soundscape would help explain this better.
        Return your response in this A2A JSON format:
        {
          "content": "the educational synthesis text",
          "needs_visual": true/false,
          "visual_request": "description for visual specialist",
          "needs_audio": true/false,
          "audio_request": "description for sound specialist"
        }
        Return ONLY the JSON.`;

        const synthesisRaw = await this.minimax.chat([{ role: 'user', content: synthesisPrompt }], "You are a Research Synthesis Specialist Powered by MiniMax.");

        try {
            const synthesisData = JSON.parse(synthesisRaw.replace(/```json|```/g, '').trim());

            // Step 4: A2A Communication
            const a2aPromises = [];

            if (synthesisData.needs_visual && this.visualAgent) {
                console.log('🔍➡️🎨 A2A: Research triggering Visual:', synthesisData.visual_request);
                this.sharedContext?.logVisualAct(`Research Agent triggered Visualist for: "${synthesisData.visual_request}"`);
                a2aPromises.push(this.visualAgent.createVisual(synthesisData.visual_request));
            }

            if (synthesisData.needs_audio && this.audioAgent) {
                console.log('🔍➡️🎵 A2A: Research triggering Audio:', synthesisData.audio_request);
                this.sharedContext?.logVisualAct(`Research Agent triggered Audio Specialist for: "${synthesisData.audio_request}"`);
                a2aPromises.push(this.audioAgent.createEducationalAudio(synthesisData.audio_request));
            }

            if (a2aPromises.length > 0) {
                await Promise.all(a2aPromises);
            }

            this.sharedContext?.updateResearchSummary(`Latest Findings: ${synthesisData.content.substring(0, 100)}...`);
            return synthesisData.content;
        } catch (error) {
            console.warn('🔍 Research Agent: Failed to parse A2A JSON, falling back to raw text.', error);
            return synthesisRaw;
        }
    }
}
