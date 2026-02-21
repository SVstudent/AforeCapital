
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Classroom, User } from './types';
import { MASTER_TUTOR_PROMPT } from './constants';
import TutorWhiteboard, { TutorWhiteboardHandle, WhiteboardCommand } from './TutorWhiteboard';
import SessionSummary from './SessionSummary';
import { saveLuminaSession } from './lib/firestore';

interface LuminaSyncProps {
  embedded?: boolean;
  onClose?: () => void;
  classroom?: Classroom;
  currentUser?: User;
}

// Helper: Base64 Encoding
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Base64 Decoding
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper: PCM Decoding
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Helper: Parse whiteboard commands from AI text
function parseWhiteboardCommands(text: string): WhiteboardCommand[] {
  const commands: WhiteboardCommand[] = [];
  const regex = /\[BOARD:(\{.*?\})\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const cmd = JSON.parse(match[1]);
      if (cmd.action) commands.push(cmd as WhiteboardCommand);
    } catch (e) {
      console.warn('Failed to parse whiteboard command:', match[1]);
    }
  }
  return commands;
}

// Helper: Parse image generation commands from AI text
function parseImageCommands(text: string): string[] {
  const prompts: string[] = [];
  const regex = /\[IMAGE:([^\]]+)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    prompts.push(match[1].trim());
  }
  return prompts;
}

const LuminaSync: React.FC<LuminaSyncProps> = ({ embedded, onClose, classroom, currentUser }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcriptions, setTranscriptions] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Session summary states
  const [showSummary, setShowSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [sessionTopics, setSessionTopics] = useState<string[]>([]);
  const [sessionResources, setSessionResources] = useState<any[]>([]);
  const [sessionDuration, setSessionDuration] = useState('');
  const sessionStartTimeRef = useRef<number>(0);

  // Real-time state for subtitles (visual only)
  const [displayInput, setDisplayInput] = useState('');
  const [displayOutput, setDisplayOutput] = useState('');

  // Refs for logic consistency in async callbacks
  const inputTranscriptRef = useRef('');
  const outputTranscriptRef = useRef('');
  const sessionRef = useRef<any>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const whiteboardRef = useRef<TutorWhiteboardHandle>(null);
  const isActiveRef = useRef(false); // Track active state in refs for callbacks
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const aiClientRef = useRef<any>(null); // Store AI client for image generation

  // Generate image using Gemini and render on canvas (OPTIMIZED)
  const generateCanvasImage = async (prompt: string) => {
    if (!aiClientRef.current || !whiteboardRef.current) {
      console.warn('[LUMINA] Cannot generate image - client or whiteboard not ready');
      return;
    }

    console.log('[LUMINA] Generating image:', prompt);
    const startTime = Date.now();
    try {
      // Simplified prompt for faster generation
      const response = await aiClientRef.current.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: `Educational diagram: ${prompt}. Clean, labeled, white background.`,
      });

      // Find image data in response parts
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          console.log(`[LUMINA] Image generated in ${Date.now() - startTime}ms, rendering on canvas...`);
          whiteboardRef.current?.renderImage(part.inlineData.data);
          return; // Only render first image
        }
        if (part.text) {
          console.log('[LUMINA] Image generation text response:', part.text);
        }
      }

      console.warn('[LUMINA] No image data found in response:', response);
    } catch (err) {
      console.error('[LUMINA] Image generation failed:', err);
    }
  };

  // Track if we've already generated an image for this turn
  const imageGeneratedRef = useRef(false);

  // Analyze conversation and generate image if appropriate
  const analyzeAndGenerateImage = async (userText: string, modelText: string) => {
    if (!aiClientRef.current || imageGeneratedRef.current) return;

    console.log('[LUMINA] Analyzing conversation for visual needs...');
    console.log('[LUMINA] User said:', userText);
    console.log('[LUMINA] Model said:', modelText);

    // Check if the conversation mentions visuals/diagrams/graphs
    const fullConvo = (userText + ' ' + modelText).toLowerCase();
    const visualKeywords = ['draw', 'show', 'graph', 'diagram', 'visual', 'picture', 'illustrat', 'parabola', 'function', 'plot', 'curve', 'shape', 'circle', 'triangle', 'wave'];

    const needsVisual = visualKeywords.some(kw => fullConvo.includes(kw));

    if (!needsVisual) {
      console.log('[LUMINA] No visual content detected in conversation');
      return;
    }

    imageGeneratedRef.current = true; // Prevent duplicate generations

    try {
      // Use Gemini 2.5 Flash to analyze what image should be generated
      const analysisResponse = await aiClientRef.current.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Based on this tutoring conversation, what educational diagram or graph should be shown?

User: "${userText}"
Tutor: "${modelText}"

Reply with ONLY a brief description of the image to generate (e.g. "A parabola graph showing y = x^2 with labeled x and y axes"). If no image is needed, reply with "NONE".`,
      });

      const analysisText = analysisResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('[LUMINA] Image analysis result:', analysisText);

      if (analysisText.toUpperCase().includes('NONE') || analysisText.length < 5) {
        console.log('[LUMINA] Analysis says no image needed');
        return;
      }

      // Generate the image
      await generateCanvasImage(analysisText.trim());

    } catch (err) {
      console.error('[LUMINA] Image analysis failed:', err);
    }
  };

  // Auto-scroll subtitles
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcriptions, displayInput, displayOutput]);

  // Compile resources at end of session using Gemini + Google Search
  const compileResources = useCallback(async () => {
    if (!aiClientRef.current || transcriptions.length === 0) {
      console.log('[LUMINA] No transcript to compile resources from');
      return;
    }

    setSummaryLoading(true);
    setShowSummary(true);

    // Calculate session duration
    const durationMs = Date.now() - sessionStartTimeRef.current;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    setSessionDuration(`${minutes}m ${seconds}s`);

    try {
      // Extract conversation content
      const conversationText = transcriptions
        .map((t: { role: string; text: string }) => `${t.role}: ${t.text}`)
        .join('\n');

      console.log('[LUMINA] Compiling resources from conversation...');

      // Use Gemini with Google Search to find real resources
      const response = await aiClientRef.current.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze this tutoring conversation and provide educational resources.

CONVERSATION:
${conversationText.substring(0, 3000)}

INSTRUCTIONS:
1. Identify the 3-5 main topics discussed
2. Find 6-8 real, existing educational resources (must be real URLs that exist)
3. Include variety: YouTube tutorials, Khan Academy, Wikipedia, official documentation, research papers

Respond in this exact JSON format:
{
  "topics": ["topic1", "topic2", "topic3"],
  "resources": [
    {
      "title": "Resource Title",
      "url": "https://real-url.com",
      "type": "video|article|paper|docs|course",
      "description": "Brief description",
      "source": "YouTube|Khan Academy|Wikipedia|etc"
    }
  ]
}

IMPORTANT: Only include real, working URLs. Prefer well-known educational sites.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('[LUMINA] Resource response:', text);

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        setSessionTopics(data.topics || []);
        setSessionResources(data.resources || []);

        // Save session to Firestore for Analytics
        if (classroom?.id && currentUser?.id) {
          saveLuminaSession({
            studentId: currentUser.id,
            studentName: currentUser.name,
            classroomId: classroom.id,
            assignmentId: 'voice-session',
            startTime: sessionStartTimeRef.current,
            lastActive: Date.now(),
            messages: transcriptions.map((t: { role: string; text: string }) => ({
              role: t.role === 'model' ? 'assistant' : 'user',
              content: t.text,
              timestamp: Date.now()
            })),
            summary: data.topics?.join(', ') || 'Lumina Tutoring Session',
            topicsCovered: data.topics || [],
            resourcesCompiled: data.resources?.map((r: any) => r.url) || [],
            engagementScore: Math.min(10, Math.ceil(transcriptions.length / 2))
          }).catch(err => console.error('[LUMINA] Failed to save session:', err));
        }

        console.log('[LUMINA] Compiled', data.resources?.length || 0, 'resources');
      }
    } catch (err) {
      console.error('[LUMINA] Failed to compile resources:', err);
      setSessionTopics(['Session Complete']);
      setSessionResources([]);
    } finally {
      setSummaryLoading(false);
    }
  }, [transcriptions]);

  const stopSession = useCallback(() => {
    console.log('[LUMINA] Stopping session...');
    isActiveRef.current = false;

    // Disconnect audio processing first
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        console.warn('[LUMINA] Error closing session:', e);
      }
      sessionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      streamRef.current = null;
    }

    sourcesRef.current.forEach((source: AudioBufferSourceNode) => {
      try { source.stop(); } catch (e) { /* ignore */ }
    });
    sourcesRef.current.clear();

    setIsActive(false);
    setIsConnecting(false);

    // Compile resources after session ends
    compileResources();
  }, [compileResources]);

  const startSession = async () => {
    if (isConnecting || isActive) return;
    setIsConnecting(true);
    setShowWhiteboard(true); // Show whiteboard when session starts
    setShowSummary(false); // Hide any previous summary
    sessionStartTimeRef.current = Date.now(); // Track session start time

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      aiClientRef.current = ai; // Store for image generation

      inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const contextInstruction = classroom
        ? `\n\n[USER CONTEXT]\nClassroom: ${classroom.name}\nTeacher: ${classroom.teacher}\nStudent: ${currentUser?.name}\n\nYou are LUMINA, a voice-native Socratic mentor. Speak naturally, ask deep questions, and listen closely to the student's reasoning.`
        : "";

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO], // Native audio model only supports AUDIO output
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: MASTER_TUTOR_PROMPT + contextInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('[LUMINA] WebSocket opened successfully');
            isActiveRef.current = true;
            setIsActive(true);
            setIsConnecting(false);

            const source = inputAudioCtxRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioCtxRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e: AudioProcessingEvent) => {
              // Only send audio if session is still active
              if (!isActiveRef.current || !sessionRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };

              try {
                sessionRef.current?.sendRealtimeInput({ media: pcmBlob });
              } catch (err) {
                console.warn('[LUMINA] Error sending audio:', err);
              }
            };

            source.connect(scriptProcessor);
            // Connect to a dummy destination to keep the processor running
            // but don't actually output anything
            const dummyGain = inputAudioCtxRef.current!.createGain();
            dummyGain.gain.value = 0;
            scriptProcessor.connect(dummyGain);
            dummyGain.connect(inputAudioCtxRef.current!.destination);

            // Send initial greeting prompt to LUMINA
            const studentName = currentUser?.name || 'there';
            sessionPromise.then(session => {
              if (session) {
                session.sendClientContent({
                  turns: [{
                    role: 'user',
                    parts: [{
                      text: `[START SESSION] Greet the student warmly by saying "Hey ${studentName}, what do you need help with today?" in a friendly, encouraging voice. Then use the whiteboard to write "Welcome ${studentName}!" at the top.`
                    }]
                  }]
                });
              }
            });
          },
          onmessage: async (message: LiveServerMessage) => {
            // Transcription logic
            if (message.serverContent?.inputTranscription) {
              inputTranscriptRef.current += message.serverContent.inputTranscription.text;
              setDisplayInput(inputTranscriptRef.current);
            }
            if (message.serverContent?.outputTranscription) {
              const newText = message.serverContent.outputTranscription.text;
              outputTranscriptRef.current += newText;
              setDisplayOutput(outputTranscriptRef.current);

              // Parse and execute any whiteboard commands in real-time
              const commands = parseWhiteboardCommands(newText);
              commands.forEach(cmd => {
                if (whiteboardRef.current) {
                  whiteboardRef.current.executeCommand(cmd);
                }
              });
              // Note: Image generation moved to turnComplete to avoid flickering
            }
            if (message.serverContent?.turnComplete) {
              const fullIn = inputTranscriptRef.current;
              const fullOut = outputTranscriptRef.current;

              // Analyze conversation for image needs (at turn end, not during streaming)
              imageGeneratedRef.current = false; // Reset for new turn
              analyzeAndGenerateImage(fullIn, fullOut);

              setTranscriptions((prev: { role: 'user' | 'model', text: string }[]) => [
                ...prev,
                { role: 'user' as const, text: fullIn },
                { role: 'model' as const, text: fullOut.replace(/\[BOARD:\{.*?\}\]/g, '').replace(/\[IMAGE:[^\]]+\]/g, '') }
              ].filter(t => t.text.trim() !== ''));

              inputTranscriptRef.current = '';
              outputTranscriptRef.current = '';
              setDisplayInput('');
              setDisplayOutput('');
            }

            // Audio Playback logic
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioCtxRef.current) {
              const ctx = outputAudioCtxRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            // Check for text parts with whiteboard commands
            const textParts = message.serverContent?.modelTurn?.parts?.filter(p => p.text);
            if (textParts) {
              textParts.forEach(part => {
                if (part.text) {
                  const commands = parseWhiteboardCommands(part.text);
                  commands.forEach(cmd => {
                    if (whiteboardRef.current) {
                      whiteboardRef.current.executeCommand(cmd);
                    }
                  });
                }
              });
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach((s: AudioBufferSourceNode) => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              outputTranscriptRef.current = '';
              setDisplayOutput('');
            }
          },
          onclose: (event: any) => {
            console.log('[LUMINA] WebSocket closed:', {
              code: event?.code,
              reason: event?.reason,
              wasClean: event?.wasClean
            });
            // Only update state if we were actively connected
            if (isActiveRef.current) {
              isActiveRef.current = false;
              setIsActive(false);
              setIsConnecting(false);
            }
          },
          onerror: (e) => {
            console.error('[LUMINA] WebSocket error:', e);
            isActiveRef.current = false;
            setIsActive(false);
            setIsConnecting(false);
          },
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Link Establishment Failure:", err);
      setIsConnecting(false);
    }
  };

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      console.log('[LUMINA] Component unmounting, cleaning up...');
      isActiveRef.current = false;

      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
      }
      if (sessionRef.current) {
        try { sessionRef.current.close(); } catch (e) { /* ignore */ }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      sourcesRef.current.forEach((source: AudioBufferSourceNode) => {
        try { source.stop(); } catch (e) { /* ignore */ }
      });
    };
  }, []); // Empty deps - only run on unmount

  return (
    <div className={`flex flex-col bg-[#050505] text-white overflow-hidden transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'} ${embedded && !isFullscreen ? '' : 'rounded-3xl shadow-2xl'}`}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/5 z-20 bg-[#050505]">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-[#25A667] shadow-[0_0_10px_#25A667]' : 'bg-white/10'}`}></div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 italic">Lumina Neural Link</span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <>
              <button
                onClick={() => setShowWhiteboard(!showWhiteboard)}
                className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${showWhiteboard ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-white/10'}`}
              >
                {showWhiteboard ? '✓ Canvas' : 'Canvas'}
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${isFullscreen ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-white/40 border border-white/10'}`}
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </button>
            </>
          )}
          {onClose && (
            <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Content - Side by Side when whiteboard active */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Voice Interface */}
        <div className={`${isActive && showWhiteboard ? 'w-1/3' : 'w-full'} flex flex-col transition-all duration-500`}>
          {/* Main Immersive Interface */}
          <div className="flex-1 relative flex flex-col items-center justify-center p-4 overflow-hidden">
            {/* Immersive Neural Visualizer */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[80px] transition-transform duration-1000 ${isActive ? 'scale-150 animate-pulse' : 'scale-75'}`}></div>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-sm text-center">
              {isActive ? (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-700">
                  {/* Voice Orb */}
                  <div className="relative mx-auto">
                    <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30 shadow-[0_0_40px_rgba(37,166,103,0.15)] gap-1.5 px-4 backdrop-blur-md">
                      <div className="flex-1 w-1.5 bg-emerald-400 rounded-full animate-voice-wave" style={{ animationDelay: '0ms' }}></div>
                      <div className="flex-1 w-1.5 bg-emerald-400 rounded-full animate-voice-wave" style={{ animationDelay: '200ms' }}></div>
                      <div className="flex-1 w-1.5 bg-emerald-400 rounded-full animate-voice-wave" style={{ animationDelay: '400ms', height: '100%' }}></div>
                      <div className="flex-1 w-1.5 bg-emerald-400 rounded-full animate-voice-wave" style={{ animationDelay: '200ms' }}></div>
                      <div className="flex-1 w-1.5 bg-emerald-400 rounded-full animate-voice-wave" style={{ animationDelay: '0ms' }}></div>
                    </div>
                    <div className="absolute -inset-4 bg-emerald-500/10 rounded-full animate-pulse-slow"></div>
                    <div className="absolute -inset-8 bg-emerald-500/5 rounded-full animate-ping-slow"></div>
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-xl font-bold tracking-tighter italic">Synchronized</h2>
                    <p className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em]">Neural Interface Active</p>
                  </div>

                  <button
                    onClick={stopSession}
                    className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-[0.15em] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" strokeWidth="1.5" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black tracking-tighter">Lumina Sync</h2>
                    <p className="text-xs text-white/40 leading-relaxed max-w-[260px] mx-auto font-medium">Voice + Whiteboard tutoring powered by neural AI.</p>
                  </div>
                  <button
                    onClick={startSession}
                    disabled={isConnecting}
                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.15em] shadow-2xl transition-all ${isConnecting ? 'bg-white/10 text-white/20' : 'bg-emerald-500 text-white hover:scale-[1.02] hover:shadow-emerald-500/20'
                      }`}
                  >
                    {isConnecting ? 'Connecting...' : 'Start Session'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Subtitle Box - Proper contained widget */}
          <div className={`${isActive || transcriptions.length > 0 ? 'min-h-[100px] max-h-[140px]' : 'h-12'} mx-3 mb-3 bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 p-3 overflow-hidden transition-all duration-300`}>
            <div
              ref={transcriptScrollRef}
              className="h-full overflow-y-auto space-y-2 scroll-smooth"
            >
              {transcriptions.slice(-4).map((t, i) => (
                <div key={i} className={`flex ${t.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                  <p className={`text-xs max-w-[85%] px-3 py-1.5 rounded-lg leading-relaxed ${t.role === 'model' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/60'}`}>
                    {t.text.length > 120 ? t.text.substring(0, 120) + '...' : t.text}
                  </p>
                </div>
              ))}

              {(displayInput || displayOutput) && (
                <div className="space-y-2 animate-in fade-in duration-300">
                  {displayInput && (
                    <div className="flex justify-end">
                      <p className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/40 italic max-w-[85%]">{displayInput.substring(0, 60)}...</p>
                    </div>
                  )}
                  {displayOutput && (
                    <div className="flex justify-start">
                      <p className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 animate-pulse max-w-[85%]">{displayOutput.substring(0, 80)}</p>
                    </div>
                  )}
                </div>
              )}

              {!isActive && !isConnecting && transcriptions.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[9px] uppercase font-black tracking-[0.3em] text-white/20 italic">Live Transcript</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Whiteboard Canvas - Scrollable */}
        {isActive && showWhiteboard && (
          <div className="w-2/3 p-3 flex flex-col animate-in slide-in-from-right duration-500">
            <TutorWhiteboard ref={whiteboardRef} className="w-full h-full" />
          </div>
        )}
      </div>

      <style>{`
        .mask-fade-top {
          mask-image: linear-gradient(to top, black 80%, transparent 100%);
        }
        @keyframes voice-wave {
          0%, 100% { transform: scaleY(0.3); opacity: 0.4; }
          50% { transform: scaleY(1.5); opacity: 1; }
        }
        .animate-voice-wave {
          animation: voice-wave 1.2s ease-in-out infinite;
          transform-origin: center;
          height: 16px;
        }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.1; }
          50% { transform: scale(1.1); opacity: 0.2; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.2; }
          100% { transform: scale(2); opacity: 0; }
        }
        .animate-ping-slow {
          animation: ping-slow 4s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>

      {/* Session Summary Modal */}
      {showSummary && (
        <SessionSummary
          topics={sessionTopics}
          resources={sessionResources}
          duration={sessionDuration}
          isLoading={summaryLoading}
          onClose={() => setShowSummary(false)}
          onNewSession={() => {
            setShowSummary(false);
            setTranscriptions([]);
            startSession();
          }}
        />
      )}
    </div>
  );
};

export default LuminaSync;
