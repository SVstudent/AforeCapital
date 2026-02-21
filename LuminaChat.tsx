
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { User, Classroom } from './types';
import { marked } from 'marked';
import { saveLuminaSession, updateLuminaSession } from './lib/firestore';

interface LuminaChatProps {
    onClose: () => void;
    classroom?: Classroom;
    currentUser: User;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

const LuminaChat: React.FC<LuminaChatProps> = ({ onClose, classroom, currentUser }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const aiClientRef = useRef<any>(null);
    const sessionIdRef = useRef<string | null>(null);
    const hasSynthesizedRef = useRef(false);

    useEffect(() => {
        aiClientRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // Initial greeting
        setMessages([{
            role: 'assistant',
            content: `Hey ${currentUser.name}! I'm your Lumina AI Assistant. How can I help you with your studies or class management today?`,
            timestamp: Date.now()
        }]);
    }, [currentUser.name]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || !aiClientRef.current) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: text,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            const context = classroom
                ? `You are a helpful education assistant for a student named ${currentUser.name} in the class ${classroom.name} (taught by ${classroom.teacher}).`
                : `You are a helpful education assistant for ${currentUser.name}.`;

            const response = await aiClientRef.current.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    { role: 'user', parts: [{ text: context }] },
                    ...messages.map(m => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    })),
                    { role: 'user', parts: [{ text: text }] }
                ],
                config: {
                    tools: [{ googleSearch: {} }],
                }
            });

            const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || 'I apologize, I could not generate a response.';
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: responseText,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, assistantMessage]);

            // Sync with Firestore
            if (classroom?.id && currentUser?.id) {
                const allMessages = [...messages, userMessage, assistantMessage];

                if (!sessionIdRef.current) {
                    // Start new session
                    saveLuminaSession({
                        studentId: currentUser.id,
                        studentName: currentUser.name,
                        classroomId: classroom.id,
                        assignmentId: 'chat-session',
                        messages: allMessages,
                        summary: 'Text Tutoring Session',
                        startTime: Date.now(),
                        lastActive: Date.now(),
                        topicsCovered: [],
                        engagementScore: 1
                    }).then(id => {
                        sessionIdRef.current = id;
                    }).catch(console.error);
                } else {
                    // Update existing session
                    updateLuminaSession(sessionIdRef.current, {
                        messages: allMessages,
                        engagementScore: Math.min(10, Math.ceil(allMessages.length / 2))
                    }).catch(console.error);

                    // Periodically re-synthesize summary/topics if not done yet
                    if (allMessages.length >= 4 && !hasSynthesizedRef.current) {
                        hasSynthesizedRef.current = true;
                        // Extraction logic
                        aiClientRef.current.models.generateContent({
                            model: 'gemini-1.5-flash',
                            contents: [{ role: 'user', parts: [{ text: `Based on this conversation, what is the main topic? Return JSON: { "topic": "Name" }. Conversation: ${allMessages.map(m => m.content).join('\n')}` }] }]
                        }).then((r: any) => {
                            const text = r.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            const match = text.match(/\{.*\}/);
                            if (match) {
                                const data = JSON.parse(match[0]);
                                updateLuminaSession(sessionIdRef.current!, {
                                    summary: data.topic || 'Lumina Tutoring',
                                    topicsCovered: [data.topic].filter(Boolean)
                                });
                            }
                        }).catch(console.error);
                    }
                }
            }
        } catch (err) {
            console.error('[LuminaChat] Error:', err);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'I encountered an error. Please try again.',
                timestamp: Date.now()
            }]);
        } finally {
            setIsLoading(true); // Wait for the state update
            setTimeout(() => setIsLoading(false), 300);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-violet-700 flex items-center justify-between shadow-lg relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-white shadow-inner">
                        <span className="text-xl">✨</span>
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Lumina Assistant</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                            <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest italic">Neural Link Online</span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 custom-scrollbar">
                {messages.map((message, i) => (
                    <div key={i} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                        <div className={`max-w-[85%] ${message.role === 'user' ? 'order-1' : 'order-1'} group`}>
                            <div className={`rounded-[1.5rem] px-5 py-4 ${message.role === 'user'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 rounded-tr-sm'
                                : 'bg-white border border-slate-100 text-slate-800 shadow-sm rounded-tl-sm'
                                }`}>
                                <div className="prose prose-sm max-w-none prose-slate"
                                    dangerouslySetInnerHTML={{ __html: marked.parse(message.content) }} />
                            </div>
                            <div className={`text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tighter ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                        <div className="bg-white border border-slate-100 rounded-[1.5rem] rounded-tl-sm px-5 py-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <span className="text-[10px] text-indigo-500 font-black uppercase tracking-widest italic">Synthesizing...</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                <form
                    onSubmit={(e) => { e.preventDefault(); sendMessage(inputText); }}
                    className="flex items-center gap-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-2 focus-within:border-indigo-500/20 focus-within:bg-white transition-all shadow-inner"
                >
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Ask me anything..."
                        className="flex-1 px-4 py-2 bg-transparent text-sm font-medium text-slate-700 placeholder-slate-400 outline-none"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !inputText.trim()}
                        className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-40 transition-all active:scale-90 hover:-translate-y-1"
                    >
                        <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LuminaChat;
