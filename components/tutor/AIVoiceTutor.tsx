import { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Whiteboard, WhiteboardRef } from './Whiteboard';
import { QuestionInput } from './QuestionInput';
import { AIContextWindow, AIContextContent } from './AIContextWindow';
import { ElevenLabsService } from '../../services/elevenlabs';
import { AITutorService } from '../../services/aiTutor';
import { RunwareService } from '../../services/runware';
import { GeminiService } from '../../services/gemini';
import { ContextWindowService } from '../../services/contextWindowService';

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
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(true);
    const [canvasDataUrl, setCanvasDataUrl] = useState<string>('');
    const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>('');
    const [currentQuestion, setCurrentQuestion] = useState<string>('');
    const [currentQuestionText, setCurrentQuestionText] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [contextContent, setContextContent] = useState<AIContextContent | null>(null);
    const [contextVisible, setContextVisible] = useState(false);
    const [contextMinimized, setContextMinimized] = useState(true);
    const [contextPosition, setContextPosition] = useState({ x: window.innerWidth - 440, y: 80 });
    const [contextTransparency, setContextTransparency] = useState(1.0);
    const [aiResponse, setAiResponse] = useState('');

    const elevenLabsRef = useRef<ElevenLabsService | null>(null);
    const aiTutorRef = useRef<AITutorService | null>(null);
    const runwareRef = useRef<RunwareService | null>(null);
    const geminiRef = useRef<GeminiService | null>(null);
    const recognitionRef = useRef<any>(null);
    const contextServiceRef = useRef<ContextWindowService>(new ContextWindowService());

    useEffect(() => {
        const loadSettings = async () => {
            if (currentUser?.id) {
                const contextSettings = await contextServiceRef.current.getOrCreateSettings(currentUser.id);
                setContextPosition({ x: contextSettings.x_position, y: contextSettings.y_position });
                setContextMinimized(contextSettings.is_minimized);
                setContextVisible(contextSettings.is_visible);
                setContextTransparency(contextSettings.transparency_level);
                if (contextSettings.last_shown_content) {
                    setContextContent(contextSettings.last_shown_content);
                }
            }
        };

        loadSettings();
    }, [currentUser]);

    const whiteboardRef = useRef<WhiteboardRef>(null);

    useEffect(() => {
        const elevenLabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
        const runwareKey = import.meta.env.VITE_RUNWARE_API_KEY;
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

        if (elevenLabsKey) {
            elevenLabsRef.current = new ElevenLabsService(elevenLabsKey);
        }

        if (runwareKey) {
            runwareRef.current = new RunwareService(runwareKey);
        }

        if (geminiKey) {
            geminiRef.current = new GeminiService(geminiKey);
        }

        if (settings) {
            aiTutorRef.current = new AITutorService({
                pushinessLevel: settings.ai_pushiness_level,
                conversationHistory: [],
            });
        }

        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

            try {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'en-US';

                recognitionRef.current.onresult = async (event: any) => {
                    const last = event.results.length - 1;
                    const transcript = event.results[last][0].transcript;
                    const isFinal = event.results[last].isFinal;

                    if (isFinal) {
                        setCurrentTranscript(transcript);
                        setIsListening(false);
                        await handleQuestionSubmit(transcript);
                    } else {
                        setStatusMessage(`Listening: "${transcript}"`);
                    }
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error('Speech recognition error:', event.error);
                    setIsListening(false);
                    setStatusMessage('');
                };
            } catch (error) {
                console.error('Failed to initialize speech recognition:', error);
            }
        }

        return () => {
            if (recognitionRef.current && isListening) {
                recognitionRef.current.stop();
            }
        };
    }, [settings]);

    const handleToggleListening = async () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                setCurrentTranscript('');
                setIsListening(true);
                recognitionRef.current.start();
            } catch (error) {
                console.error('Microphone access denied:', error);
            }
        }
    };

    const handleToggleSpeaking = () => {
        setIsSpeaking(!isSpeaking);
    };

    const handleQuestionSubmit = async (questionText: string, imageUrl?: string) => {
        setCurrentQuestion(questionText);
        setIsProcessing(true);
        setStatusMessage('AI is thinking...');

        try {
            if (!geminiRef.current) return;

            let whiteboardScreenshot: string | undefined = undefined;

            if (whiteboardRef.current) {
                whiteboardScreenshot = await whiteboardRef.current.captureScreenshot();
            }

            if (imageUrl) {
                setBackgroundImageUrl(imageUrl);
                setCurrentQuestionText(questionText);
                const imageAnalysis = await geminiRef.current.analyzeImage(imageUrl, questionText);
                questionText = `${questionText}\n\nImage shows: ${imageAnalysis}`;
            }

            try {
                const contextInfo = await geminiRef.current.generateContextInfo(questionText, imageUrl);
                const newContextContent: AIContextContent = {
                    title: contextInfo.title,
                    blocks: contextInfo.blocks,
                    timestamp: Date.now(),
                };
                setContextContent(newContextContent);
                setContextVisible(true);
                setContextMinimized(false);

                if (currentUser?.id) {
                    await contextServiceRef.current.updateContent(currentUser.id, newContextContent);
                }
            } catch (contextError) {
                console.error('Failed to generate context:', contextError);
            }

            await handleUserMessage(questionText, whiteboardScreenshot);
        } catch (error) {
            console.error('Error processing question:', error);
        } finally {
            setIsProcessing(false);
            setStatusMessage('');
        }
    };

    const handleUserMessage = async (message: string, canvasImageUrl?: string) => {
        if (!aiTutorRef.current) return;

        setIsProcessing(true);
        try {
            const response = await aiTutorRef.current.getResponse(message, canvasImageUrl);
            setAiResponse(response);

            if (isSpeaking && elevenLabsRef.current) {
                const wasListening = isListening;
                if (wasListening) recognitionRef.current?.stop();

                await elevenLabsRef.current.speak(response, settings.voice_id);

                if (wasListening) recognitionRef.current?.start();
            }
        } catch (error) {
            console.error('Error getting AI response:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col relative bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
            <button
                onClick={onBack}
                className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 transition text-sm font-medium"
            >
                <ArrowLeft className="w-4 h-4" />
                <span>Exit Session</span>
            </button>

            <div className="flex-1 overflow-hidden relative">
                <Whiteboard
                    ref={whiteboardRef}
                    onCanvasUpdate={setCanvasDataUrl}
                    backgroundImageUrl={backgroundImageUrl}
                    questionText={currentQuestionText}
                    isListening={isListening}
                    isSpeaking={isSpeaking}
                    onToggleListening={handleToggleListening}
                    onToggleSpeaking={handleToggleSpeaking}
                />
            </div>

            <AIContextWindow
                content={contextContent}
                isVisible={contextVisible}
                isMinimized={contextMinimized}
                position={contextPosition}
                transparency={contextTransparency}
                onClose={() => setContextVisible(false)}
                onToggleMinimize={() => setContextMinimized(!contextMinimized)}
                onPositionChange={(x, y) => currentUser?.id && contextServiceRef.current.updatePosition(currentUser.id, x, y)}
            />

            <QuestionInput
                onSubmit={handleQuestionSubmit}
                disabled={isProcessing}
                isListening={isListening}
                isSpeaking={isSpeaking}
                onToggleListening={handleToggleListening}
                onToggleSpeaking={handleToggleSpeaking}
            />

            {(isProcessing || statusMessage || currentTranscript || (aiResponse && !isSpeaking)) && (
                <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-lg px-4">
                    <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg border border-slate-200">
                        {currentTranscript && (
                            <div className="mb-2">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">You said</p>
                                <p className="text-slate-800 font-medium text-sm">{currentTranscript}</p>
                            </div>
                        )}
                        {statusMessage && (
                            <p className="text-blue-600 font-semibold text-sm animate-pulse flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                                {statusMessage}
                            </p>
                        )}
                        {aiResponse && !isSpeaking && (
                            <div className="border-t border-slate-100 mt-2 pt-2">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">AI Response</p>
                                <p className="text-slate-800 text-sm whitespace-pre-wrap">{aiResponse}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
