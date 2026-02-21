import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    ArrowLeft,
    Mic,
    MicOff,
    Volume2,
    Loader2,
    Maximize2,
    Minimize2
} from 'lucide-react';
import { useConversation } from '@elevenlabs/react';
import { Whiteboard, WhiteboardRef } from './Whiteboard';
import { QuestionInput } from './QuestionInput';
import { AIContextWindow, AIContextContent } from './AIContextWindow';
import { GeminiService } from '../../services/gemini';
import { MinimaxService } from '../../services/minimax';
import { RtrvrService } from '../../services/rtrvr';
import { RunwareService } from '../../services/runware';
import { ResearchAgent } from '../../services/researchAgent';
import { VisualAgent } from '../../services/visualAgent';
import { AudioAgent } from '../../services/audioAgent';
import { SharedAgentContext } from '../../services/sharedContext';
import { SpeechmaticsService } from '../../services/speechmatics';
import { MinimaxAudioService } from '../../services/minimaxAudio';
import { ContextWindowService } from '../../services/contextWindowService';
import { VoiceVisualizer } from './VoiceVisualizer';

interface UserSettings {
    voice_id: string;
    voice_name: string;
    ai_pushiness_level: number;
}

interface AIVoiceTutorProps {
    settings: UserSettings;
    onBack: () => void;
    currentUser: any; // Firebase user
}

export function AIVoiceTutor({ settings, onBack, currentUser }: AIVoiceTutorProps) {
    const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
    const [contextContent, setContextContent] = useState<AIContextContent | null>(null);
    const [contextVisible, setContextVisible] = useState(true);
    const [contextMinimized, setContextMinimized] = useState(false);
    const [agentLogs, setAgentLogs] = useState<{ id: string, message: string, type: 'info' | 'success' | 'warning' }[]>([]);
    const currentUserRef = useRef(currentUser);

    // Keep the ref in sync with props
    useEffect(() => {
        currentUserRef.current = currentUser;
    }, [currentUser]);

    // Debug mount/unmount
    useEffect(() => {
        console.log('🏗️ AIVoiceTutor: Component Mounted');
        return () => console.log('🧹 AIVoiceTutor: Component Unmounted');
    }, []);

    const addAgentLog = useCallback((message: string, type: 'info' | 'success' | 'warning' = 'info') => {
        const id = Math.random().toString(36).substring(7);
        setAgentLogs(prev => [...prev.slice(-4), { id, message, type }]); // Keep last 5 logs
        setTimeout(() => {
            setAgentLogs(prev => prev.filter(log => log.id !== id));
        }, 5000); // Clear after 5 seconds
    }, []);

    const [contextPosition, setContextPosition] = useState({ x: window.innerWidth - 360, y: 80 });
    const [contextTransparency, setContextTransparency] = useState(1.0);
    const [statusMessage, setStatusMessage] = useState('');
    const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>('');
    const [currentQuestionText, setCurrentQuestionText] = useState<string>('');

    const whiteboardRef = useRef<WhiteboardRef>(null);
    const geminiRef = useRef<GeminiService | null>(null);
    const minimaxRef = useRef<MinimaxService | null>(null);
    const researchAgentRef = useRef<ResearchAgent | null>(null);
    const visualAgentRef = useRef<VisualAgent | null>(null);
    const audioAgentRef = useRef<AudioAgent | null>(null);
    const speechmaticsRef = useRef<SpeechmaticsService | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const contextServiceRef = useRef<ContextWindowService>(new ContextWindowService());
    const [liveTranscript, setLiveTranscript] = useState<string>('');
    const liveTranscriptRef = useRef<string>('');
    const [isTranscriptionActive, setIsTranscriptionActive] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showSpeechmaticsWarning, setShowSpeechmaticsWarning] = useState(true);

    const sharedContextRef = useRef<SharedAgentContext>(new SharedAgentContext());

    const clientTools = useMemo(() => ({
        update_context_window: async ({ question, imageUrl }: { question: string, imageUrl?: string }) => {
            console.log('🛠️ Tool: Updating context window for:', question);
            addAgentLog('Lead: "Updating context window..."', 'info');
            if (!geminiRef.current) {
                addAgentLog('Lead: "Error: Gemini not available for context update."', 'warning');
                return 'Error: Gemini not available';
            }

            try {
                const currentImage = imageUrl || (await whiteboardRef.current?.captureScreenshot());
                const contextInfo = await geminiRef.current.generateContextInfo(question, currentImage);
                const newContextContent: AIContextContent = {
                    title: contextInfo.title,
                    blocks: contextInfo.blocks,
                    timestamp: Date.now(),
                };
                setContextContent(newContextContent);
                setContextVisible(true);
                setContextMinimized(false);

                const currentUserId = currentUserRef.current?.id;
                if (currentUserId) {
                    await contextServiceRef.current.updateContent(currentUserId, newContextContent);
                }
                addAgentLog(`Lead: "Context window updated with ${contextInfo.title}."`, 'success');

                // Smart auto-trigger: If the question implies visuals, fire the VisualAgent too
                const visualKeywords = /\b(draw|diagram|image|visual|sketch|illustrate|show me|picture|chart|graph|plot|map|figure)\b/i;
                if (visualKeywords.test(question) && visualAgentRef.current && whiteboardRef.current) {
                    console.log('🎯 Auto-triggering Visual Agent for visual keyword in:', question);
                    addAgentLog('Lead: "Visual request detected — dispatching Visualist..."', 'info');
                    visualAgentRef.current.setWhiteboard(whiteboardRef.current);
                    visualAgentRef.current.createVisual(question).then(result => {
                        console.log('✅ Auto-triggered Visual Agent result:', result);
                        addAgentLog('Visualist: "Auto-generated visuals deployed."', 'success');
                    }).catch(err => {
                        console.error('❌ Auto-triggered Visual Agent failed:', err);
                        addAgentLog('Visualist: "Auto-visual generation failed."', 'warning');
                    });
                }

                return `Successfully updated context window with title: ${contextInfo.title}`;
            } catch (error: any) {
                console.error('❌ Failed to update context via tool:', error);
                addAgentLog('Lead: "Failed to update context window."', 'warning');
                return `Error: ${error.message}`;
            }
        },
        analyze_whiteboard: async () => {
            console.log('🛠️ Tool: Analyzing whiteboard');
            addAgentLog('Lead: "Analyzing whiteboard..."', 'info');
            if (!whiteboardRef.current || !geminiRef.current) {
                addAgentLog('Lead: "Error: Whiteboard or AI service not available for analysis."', 'warning');
                return 'Error: Whiteboard or AI service not available';
            }
            try {
                const screenshot = await whiteboardRef.current.captureScreenshot();
                if (!screenshot) {
                    addAgentLog('Lead: "Error: Could not capture whiteboard."', 'warning');
                    return 'Error: Could not capture whiteboard';
                }
                let analysis;
                try {
                    analysis = await geminiRef.current.analyzeImage(screenshot, "Describe exactly what is shown on this whiteboard.");
                    sharedContextRef.current.updateBoardAnalysis(analysis);
                    addAgentLog('Lead: "Whiteboard analysis complete (Vision)."', 'success');
                } catch (geminiError) {
                    console.warn('⚠️ Vision analysis failed, falling back to Metadata:', geminiError);
                    analysis = sharedContextRef.current.getSnapshot();
                    addAgentLog('Lead: "Vision throttled. Using Metadata fallback."', 'warning');
                }

                return `The student's whiteboard state is: ${analysis}`;
            } catch (error: any) {
                console.error('❌ Whiteboard analysis failed:', error);
                addAgentLog('Lead: "Whiteboard analysis failed."', 'warning');
                return `Error analyzing whiteboard: ${error.message}`;
            }
        },
        call_visual_agent: async ({ request }: { request: string }) => {
            console.log('🛠️ Tool: Calling Visual Agent for:', request);
            addAgentLog(`Lead: "Visualist, I need a visual for: ${request}"`, 'info');
            if (visualAgentRef.current && whiteboardRef.current) {
                visualAgentRef.current.setWhiteboard(whiteboardRef.current);
                const result = await visualAgentRef.current.createVisual(request);
                addAgentLog(`Visualist: "Visuals deployed to the board."`, 'success');
                return result;
            }
            addAgentLog('Lead: "Error: Visual Agent not available."', 'warning');
            return 'Error: Visual Agent not available';
        },
        call_research_agent: async ({ query }: { query: string }) => {
            console.log('🛠️ Tool: Calling Research Agent for:', query);
            addAgentLog(`Lead: "Researching: ${query}..."`, 'info');
            if (!researchAgentRef.current) {
                addAgentLog('Lead: "Error: Research Agent not available."', 'warning');
                return "Error: Research Agent not available";
            }
            let result;
            try {
                result = await researchAgentRef.current.conductResearch(query);
                sharedContextRef.current.updateResearchSummary(result);
                addAgentLog(`Researcher: "Findings synthesized."`, 'success');
            } catch (error) {
                console.error('❌ Research Agent failed:', error);
                addAgentLog('Lead: "Research Agent failed, synthesizing from internal knowledge."', 'warning');
                result = `Research for "${query}" failed. Please synthesize a response based on your existing knowledge.`;
            }
            return result;
        },
        call_audio_specialist: async ({ request }: { request: string }) => {
            console.log('🛠️ Tool: Calling Audio Specialist for:', request);
            addAgentLog(`Lead: "Audio Specialist, create sound for: ${request}"`, 'info');
            if (audioAgentRef.current) {
                const audioUrl = await audioAgentRef.current.createEducationalAudio(request);
                addAgentLog('Audio Specialist: "Audio generated successfully."', 'success');

                const audio = new Audio(audioUrl.replace('Audio snippet generated: ', ''));
                audio.play().catch(e => console.error('Error playing generated audio:', e));

                return audioUrl;
            }
            addAgentLog('Lead: "Error: Audio Specialist not available."', 'warning');
            return 'Error: Audio Specialist not available';
        },
        get_verified_transcript: async () => {
            addAgentLog('Lead: "Fetching verified transcript..."', 'info');
            return liveTranscriptRef.current || "No verified transcript available yet.";
        }
    }), [addAgentLog]);

    const onConnect = useCallback(() => {
        console.log('🔊 ElevenLabs: Connected to live agent');
        setStatusMessage('');
    }, []);

    const onDisconnect = useCallback(() => {
        console.log('🔊 ElevenLabs: Disconnected');
        setStatusMessage('');
    }, []);

    const onMessage = useCallback((message: any) => {
        console.log('🔊 ElevenLabs Message:', message);
    }, []);

    const onError = useCallback((error: any) => {
        console.error('❌ ElevenLabs Error:', error);
        setStatusMessage('Error connecting to AI');
    }, []);

    const conversationOptions = useMemo(() => ({
        agentId: agentId || '',
        onConnect,
        onDisconnect,
        onMessage,
        onError,
        clientTools
    }), [agentId, onConnect, onDisconnect, onMessage, onError, clientTools]);

    const conversation = useConversation(conversationOptions);

    useEffect(() => {
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const rtrvrKey = import.meta.env.VITE_RTRVR_API_KEY;
        const runwareKey = import.meta.env.VITE_RUNWARE_API_KEY;
        const minimaxKey = import.meta.env.VITE_MINIMAX_API_KEY;
        const minimaxGroupId = import.meta.env.VITE_MINIMAX_GROUP_ID;
        const speechmaticsKey = import.meta.env.VITE_SPEECHMATICS_API_KEY;

        console.log('🎤 Speechmatics Context:', {
            hasKey: !!speechmaticsKey,
            keyPrefix: speechmaticsKey ? speechmaticsKey.substring(0, 5) + '...' : 'none',
            isPlaceholder: speechmaticsKey?.includes('placeholder')
        });

        if (geminiKey) geminiRef.current = new GeminiService(geminiKey);

        if (minimaxKey && minimaxGroupId) {
            minimaxRef.current = new MinimaxService(minimaxKey, minimaxGroupId);
            const minimaxAudio = new MinimaxAudioService(minimaxKey, minimaxGroupId);

            // 1. Initialize Context-aware Agents
            audioAgentRef.current = new AudioAgent(minimaxRef.current, minimaxAudio, sharedContextRef.current);
            visualAgentRef.current = new VisualAgent(minimaxRef.current, new RunwareService(runwareKey || ''), sharedContextRef.current);

            // 2. Initialize Lead Researcher with dependencies
            researchAgentRef.current = new ResearchAgent(
                minimaxRef.current,
                new RtrvrService(rtrvrKey || ''),
                visualAgentRef.current,
                audioAgentRef.current,
                sharedContextRef.current
            );
        }

        if (speechmaticsKey) {
            speechmaticsRef.current = new SpeechmaticsService(speechmaticsKey);
            speechmaticsRef.current.onTranscript((text, isFinal) => {
                if (isFinal) {
                    setLiveTranscript(prev => (prev + ' ' + text).slice(-500));
                    liveTranscriptRef.current = (liveTranscriptRef.current + ' ' + text).slice(-500);
                } else {
                    setLiveTranscript(prev => {
                        const base = prev.split(' ').slice(0, -5).join(' ');
                        return (base + ' ' + text).slice(-500);
                    });
                }
            });
        }
    }, []);

    useEffect(() => {
        const loadContext = async () => {
            if (currentUser?.id) {
                console.log('📝 AIVoiceTutor: Loading context for user:', currentUser.id);
                try {
                    const settings = await contextServiceRef.current.getSettings(currentUser.id);
                    if (settings) {
                        setContextPosition({ x: settings.x_position, y: settings.y_position });
                        setContextMinimized(settings.is_minimized);
                        setContextVisible(settings.is_visible);
                        setContextTransparency(settings.transparency_level);
                        if (settings.last_shown_content) {
                            setContextContent(settings.last_shown_content);
                        }
                    }
                } catch (error) {
                    console.error('❌ AIVoiceTutor: Failed to load context:', error);
                }
            }
        };
        loadContext();
    }, [currentUser]);

    useEffect(() => {
        return () => {
            if (speechmaticsRef.current) speechmaticsRef.current.stop();
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(console.error);
                audioContextRef.current = null;
            }
            if (audioProcessorRef.current) {
                audioProcessorRef.current.disconnect();
                audioProcessorRef.current = null;
            }
        };
    }, []);

    const handleToggleSession = useCallback(async () => {
        if (conversation.status === 'connected') {
            await conversation.endSession();
        } else {
            try {
                if (!agentId) {
                    setStatusMessage('Agent ID missing in .env.local');
                    return;
                }

                setStatusMessage('Connecting to Lumina...');
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                await (conversation.startSession as any)({
                    agentId: agentId,
                    overrides: {
                        agent: {
                            prompt: {
                                prompt: `You are the Lumina AI Tutor. Conduct a natural, realistic, and creative voice tutoring session. 
                            
                            CURRENT SESSION STATE:
                            ${sharedContextRef.current.getSnapshot()}

                            You act as the Lead Tutor and Orchestrator. You have specialized assistants:
                            1. The Research Specialist: Use 'call_research_agent' for facts and search. It also triggers visuals automatically.
                            2. The Visual Specialist: Use 'call_visual_agent' for diagrams and board work.
                            3. The Audio Specialist: Use 'call_audio_specialist' for sounds/music.
                            
                            COORDINATION & VISION:
                            - You share a 'Shared Memory' with your assistants.
                            - Use 'analyze_whiteboard' to check student progress OR to see what your specialists have drawn.
                            - If analyze_whiteboard fails, don't worry—I will provide a textual snapshot of the board history.
                            - Be Proactive: If a specialist adds something, acknowledge it in your next sentence.
                            
                            Pushiness level: ${settings.ai_pushiness_level}/5.`,
                            },
                            firstMessage: `Hi! I'm your ${settings.voice_name || 'Lumina'} tutor. Ready to dive in?`,
                        }
                    }
                });

                if (speechmaticsRef.current) {
                    const audioContext = new AudioContext();
                    audioContextRef.current = audioContext;
                    const source = audioContext.createMediaStreamSource(stream);
                    const processor = audioContext.createScriptProcessor(4096, 1, 1);
                    audioProcessorRef.current = processor;

                    await speechmaticsRef.current.start(audioContext.sampleRate);
                    setIsTranscriptionActive(true);

                    source.connect(processor);
                    processor.connect(audioContext.destination);

                    processor.onaudioprocess = (e) => {
                        if (speechmaticsRef.current) {
                            const inputData = e.inputBuffer.getChannelData(0);
                            speechmaticsRef.current.sendAudio(inputData.buffer);
                        }
                    };
                }
            } catch (error) {
                console.error('Session failed:', error);
                setStatusMessage('Microphone access required');
            }
        }
    }, [conversation, agentId, settings]);

    const handleQuestionSubmit = async (questionText: string, imageUrl?: string) => {
        if (imageUrl) {
            setBackgroundImageUrl(imageUrl);
            setCurrentQuestionText(questionText);
        }

        if (conversation.status === 'connected') {
            conversation.sendUserMessage(questionText);
        }
    };

    return (
        <div
            className={`flex-1 flex flex-col relative bg-slate-50 overflow-hidden transition-all duration-500 ${isFullscreen ? '!fixed !inset-0 !z-[9999] !m-0 !w-screen !h-screen bg-slate-50' : 'h-full'}`}
            style={isFullscreen ? { top: 0, left: 0, right: 0, bottom: 0 } : {}}
        >
            {/* Speechmatics Status Toast */}
            {isTranscriptionActive && import.meta.env.VITE_SPEECHMATICS_API_KEY?.includes('placeholder') && showSpeechmaticsWarning && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-orange-100 border border-orange-200 text-orange-800 px-4 py-2 rounded-lg shadow-sm text-xs font-medium flex items-center gap-2">
                    <span>⚠️ Speechmatics is using a placeholder key. Real-time transcription will not work.</span>
                    <button onClick={() => setShowSpeechmaticsWarning(false)} className="hover:text-orange-950 font-bold">dismiss</button>
                </div>
            )}
            <div className="absolute top-6 left-6 z-50 flex items-center gap-2">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 px-4 py-2 rounded-xl shadow-lg border border-slate-200 transition-all hover:scale-105 active:scale-95 text-sm font-bold"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Exit Session</span>
                </button>

                <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="flex items-center gap-2 bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 p-2 rounded-xl shadow-lg border border-slate-200 transition-all hover:scale-105 active:scale-95"
                    title={isFullscreen ? 'Minimize' : 'Maximize'}
                >
                    {isFullscreen ? <Minimize2 className="w-4 h-4 text-slate-500" /> : <Maximize2 className="w-4 h-4 text-indigo-600" />}
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
                <Whiteboard
                    ref={whiteboardRef}
                    backgroundImageUrl={backgroundImageUrl}
                    questionText={currentQuestionText}
                />

                <AIContextWindow
                    isVisible={contextVisible}
                    isMinimized={contextMinimized}
                    content={contextContent}
                    transparency={contextTransparency}
                    position={contextPosition}
                    onToggleMinimize={() => setContextMinimized(!contextMinimized)}
                    onClose={() => setContextVisible(false)}
                    onPositionChange={(x, y) => {
                        setContextPosition({ x, y });
                        currentUser?.id && contextServiceRef.current.updatePosition(currentUser.id, x, y);
                    }}
                />

                <div className="absolute bottom-32 right-6 z-50 flex flex-col items-end space-y-2 pointer-events-none">
                    {agentLogs.map(log => (
                        <div
                            key={log.id}
                            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-lg animate-in slide-in-from-right duration-300 backdrop-blur-md border ${log.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' :
                                log.type === 'warning' ? 'bg-amber-500/90 text-white border-amber-400' :
                                    'bg-indigo-600/90 text-white border-indigo-400'
                                }`}
                        >
                            {log.message}
                        </div>
                    ))}
                </div>

                {liveTranscript && (
                    <div className="absolute top-24 right-6 w-64 max-h-48 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl p-4 overflow-y-auto z-40 animate-in fade-in slide-in-from-top duration-500">
                        <div className="flex items-center gap-2 mb-2">
                            <Volume2 className="w-3 h-3 text-indigo-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Transcript (Speechmatics)</span>
                            {isTranscriptionActive && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse ml-auto" />}
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed italic">
                            {liveTranscript}
                        </p>
                    </div>
                )}
            </div>

            <div className="bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 relative z-40">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex-1">
                        <QuestionInput
                            onSubmit={handleQuestionSubmit}
                            disabled={conversation.status !== 'connected'}
                            isListening={conversation.status === 'connected' && !conversation.isSpeaking}
                            isSpeaking={conversation.isSpeaking}
                            onToggleListening={() => conversation.status === 'connected' && conversation.endSession()}
                            onToggleSpeaking={() => { }}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        {conversation.status === 'connected' && (
                            <VoiceVisualizer
                                getByteFrequencyData={() => conversation.getOutputByteFrequencyData() || conversation.getInputByteFrequencyData()}
                                isSpeaking={conversation.isSpeaking}
                                isActive={conversation.status === 'connected'}
                            />
                        )}
                        <button
                            onClick={handleToggleSession}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg ${conversation.status === 'connected'
                                ? 'bg-red-500 text-white shadow-red-200 hover:bg-red-600'
                                : 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700'
                                }`}
                        >
                            {conversation.status === 'connected' ? (
                                <>
                                    <MicOff className="w-5 h-5" />
                                    <span>End Session</span>
                                </>
                            ) : (
                                <>
                                    <Mic className="w-5 h-5" />
                                    <span>{conversation.status === 'connecting' ? 'Connecting...' : 'Start Live Session'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {conversation.status === 'connected' && (
                    <div className="absolute top-0 right-10 -translate-y-1/2 flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-200 shadow-sm animate-pulse">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Live</span>
                    </div>
                )}
            </div>

            {statusMessage && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50">
                    <div className="bg-white/95 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        <span className="text-slate-700 font-bold">{statusMessage}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
