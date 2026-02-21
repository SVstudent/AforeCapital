
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Classroom, Assignment, Announcement, User, ClassroomState } from './types';
import { TEACHER_ASSISTANT_PROMPT } from './constants';
import { marked } from 'marked';

interface TeacherAssistantProps {
    classroom: Classroom;
    currentUser: User;
    state: ClassroomState;
    onUpdate: (updates: Partial<ClassroomState>) => void;
}

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    action?: AssistantAction;
}

interface AssistantAction {
    type: 'CREATE_ASSIGNMENT' | 'POST_ANNOUNCEMENT' | 'GENERATE_QUIZ' | 'ANALYZE';
    data: any;
    label: string;
}

const quickActions = [
    {
        id: 'hw',
        label: 'Create Homework',
        icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
        prompt: 'Create a new homework assignment for tonight on the current topic we\'re covering.',
        color: 'indigo'
    },
    {
        id: 'analyze',
        label: 'Class Analytics',
        icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
        prompt: 'Analyze my class performance. Who needs extra help? Are there any patterns or trends I should know about?',
        color: 'emerald'
    },
    {
        id: 'prep',
        label: 'Prep Lesson',
        icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
        prompt: 'Help me prepare a lesson plan for the next topic in my curriculum.',
        color: 'violet'
    },
    {
        id: 'announce',
        label: 'Draft Announcement',
        icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
        prompt: 'Help me draft an announcement for my class about upcoming work and expectations.',
        color: 'sky'
    },
    {
        id: 'quiz',
        label: 'Generate Quiz',
        icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
        prompt: 'Generate a quick quiz based on recent topics to check student understanding.',
        color: 'amber'
    },
    {
        id: 'struggling',
        label: 'Who Needs Help?',
        icon: (className: string) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M5.636 5.636l3.536 3.536m0 5.656L5.636 19.364M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>,
        prompt: 'Based on the class data, which students appear to be struggling and might need additional support?',
        color: 'rose'
    },
];

const TeacherAssistant: React.FC<TeacherAssistantProps> = ({
    classroom,
    currentUser,
    state,
    onUpdate
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const aiClientRef = useRef<any>(null);

    const { assignments, announcements } = state;

    // Initialize AI client
    useEffect(() => {
        aiClientRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Build classroom context for AI
    const buildContext = () => {
        const studentList = classroom.students?.join(', ') || 'No students enrolled';

        const assignmentsSummary = assignments.map(a => ({
            title: a.title,
            topic: a.topic,
            dueDate: a.dueDate,
            status: a.status,
            type: a.type,
            hasSubmissions: !!a.submission,
            grade: a.grade || 'Not graded'
        }));

        const recentAnnouncements = announcements.slice(0, 5).map(a => ({
            content: a.content.substring(0, 100),
            timestamp: new Date(a.timestamp).toLocaleDateString()
        }));

        return `
CLASSROOM CONTEXT:
==================
Class Name: ${classroom.name}
Section: ${classroom.section}
Teacher: ${classroom.teacher}
Total Students: ${classroom.studentCount}
Student Names: ${studentList}

ASSIGNMENTS (${assignments.length} total):
${JSON.stringify(assignmentsSummary, null, 2)}

RECENT ANNOUNCEMENTS (${announcements.length} total):
${JSON.stringify(recentAnnouncements, null, 2)}

TODAY'S DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
==================
`;
    };

    // Send message to AI
    const sendMessage = async (text: string) => {
        if (!text.trim() || !aiClientRef.current) return;

        const userMessage: Message = {
            role: 'user',
            content: text,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            const context = buildContext();
            const systemPrompt = TEACHER_ASSISTANT_PROMPT.replace('{{CONTEXT}}', context);

            const response = await aiClientRef.current.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt }] },
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

            // Check for actionable JSON in response
            let action: AssistantAction | undefined;
            const actionMatch = responseText.match(/\[ACTION:(\{.*?\})\]/s);
            if (actionMatch) {
                try {
                    const actionData = JSON.parse(actionMatch[1]);
                    action = actionData as AssistantAction;
                } catch (e) {
                    console.warn('Failed to parse action:', e);
                }
            }

            const cleanedResponse = responseText.replace(/\[ACTION:\{.*?\}\]/s, '').trim();

            const assistantMessage: Message = {
                role: 'assistant',
                content: cleanedResponse,
                timestamp: Date.now(),
                action
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            console.error('[TeacherAssistant] Error:', err);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'I encountered an error. Please try again.',
                timestamp: Date.now()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Execute an action (create assignment, post announcement, etc.)
    const executeAction = (action: AssistantAction) => {
        switch (action.type) {
            case 'CREATE_ASSIGNMENT':
                const newAssignment: Assignment = {
                    id: `ai-${Date.now()}`,
                    title: action.data.title || 'New Assignment',
                    description: action.data.description || '',
                    dueDate: action.data.dueDate || 'Next Week',
                    topic: action.data.topic || classroom.name,
                    status: 'assigned',
                    type: action.data.type || 'assignment',
                    attachments: [],
                    rubric: []
                };
                onUpdate({ assignments: [...assignments, newAssignment] });
                setMessages(prev => [...prev, {
                    role: 'system',
                    content: `Assignment "${newAssignment.title}" has been created and added to Classwork!`,
                    timestamp: Date.now()
                }]);
                break;

            case 'POST_ANNOUNCEMENT':
                const newAnnouncement: Announcement = {
                    id: `ai-${Date.now()}`,
                    author: currentUser.name,
                    content: action.data.content || '',
                    timestamp: Date.now(),
                    comments: 0,
                    role: currentUser.role
                };
                onUpdate({ announcements: [newAnnouncement, ...announcements] });
                setMessages(prev => [...prev, {
                    role: 'system',
                    content: `Announcement posted to the class stream!`,
                    timestamp: Date.now()
                }]);
                break;

            default:
                console.log('Unknown action type:', action.type);
        }
    };

    const handleQuickAction = (prompt: string) => {
        setInputText(prompt);
        sendMessage(prompt);
    };

    return (
        <div className="flex h-full bg-[#f8f9fa] rounded-xl overflow-hidden">
            {/* Sidebar - Class Context */}
            {showSidebar && (
                <div className="w-72 bg-white border-r border-[#dadce0] flex flex-col">
                    <div className="p-4 border-b border-[#dadce0]">
                        <h3 className="text-sm font-bold text-[#3c4043] flex items-center gap-2">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            Class Overview
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Class Stats */}
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                            <div className="text-2xl font-bold text-emerald-600">{classroom.studentCount}</div>
                            <div className="text-xs text-emerald-600/70 font-medium">Students Enrolled</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                                <div className="text-lg font-bold text-blue-600">{assignments.filter(a => a.status === 'assigned').length}</div>
                                <div className="text-[10px] text-blue-600/70 font-medium">Active</div>
                            </div>
                            <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                                <div className="text-lg font-bold text-amber-600">{assignments.filter(a => a.status === 'turned-in').length}</div>
                                <div className="text-[10px] text-amber-600/70 font-medium">To Grade</div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="space-y-4 pt-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Quick Actions</h4>
                            <div className="space-y-2">
                                {quickActions.map(action => (
                                    <button
                                        key={action.id}
                                        onClick={() => handleQuickAction(action.prompt)}
                                        className="w-full text-left px-4 py-3 rounded-[1.25rem] text-sm font-bold text-slate-600 bg-white border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 hover:text-indigo-600 transition-all flex items-center gap-3 group shadow-sm hover:shadow-md"
                                    >
                                        <div className={`p-2 rounded-xl bg-${action.color}-50 text-${action.color}-600 group-hover:scale-110 transition-transform`}>
                                            {action.icon('w-4 h-4')}
                                        </div>
                                        <span>{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Recent Topics */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-[#5f6368] uppercase tracking-wider">Recent Topics</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {[...new Set(assignments.map(a => a.topic))].slice(0, 5).map(topic => (
                                    <span key={topic} className="px-2 py-1 bg-gray-100 rounded-full text-xs text-[#5f6368]">
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="p-4 bg-white border-b border-[#dadce0] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5 text-[#5f6368]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div>
                            <h2 className="text-lg font-bold text-[#3c4043]">Lumina Teaching Assistant</h2>
                            <p className="text-xs text-[#5f6368]">AI-powered class management for {classroom.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            {currentUser.name}
                        </span>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-[#3c4043]">Hello, {currentUser.name}!</h3>
                                <p className="text-sm text-[#5f6368] max-w-md">
                                    I'm your Lumina teaching assistant. I have full context of your {classroom.name} class
                                    with {classroom.studentCount} students. How can I help you today?
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3 justify-center max-w-2xl">
                                {quickActions.slice(0, 6).map(action => (
                                    <button
                                        key={action.id}
                                        onClick={() => handleQuickAction(action.prompt)}
                                        className="px-6 py-3 bg-white border border-slate-200/60 rounded-2xl text-[14px] font-black tracking-tight text-slate-700 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-xl hover:shadow-indigo-100 hover:-translate-y-1 transition-all flex items-center gap-3 group"
                                    >
                                        <div className={`text-${action.color}-500 group-hover:scale-110 transition-transform`}>
                                            {action.icon('w-5 h-5')}
                                        </div>
                                        <span>{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((message, i) => (
                        <div
                            key={i}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[80%] ${message.role === 'system' ? 'w-full' : ''}`}>
                                {message.role === 'system' ? (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {message.content}
                                    </div>
                                ) : (
                                    <div
                                        className={`rounded-2xl px-4 py-3 ${message.role === 'user'
                                            ? 'bg-[#1a73e8] text-white'
                                            : 'bg-white border border-[#dadce0] text-[#3c4043]'
                                            }`}
                                    >
                                        {message.role === 'assistant' ? (
                                            <div
                                                className="prose prose-sm max-w-none"
                                                dangerouslySetInnerHTML={{ __html: marked.parse(message.content) }}
                                            />
                                        ) : (
                                            <p className="text-sm">{message.content}</p>
                                        )}

                                        {/* Actionable Button */}
                                        {message.action && (
                                            <button
                                                onClick={() => executeAction(message.action!)}
                                                className="mt-3 w-full py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                </svg>
                                                {message.action.label}
                                            </button>
                                        )}
                                    </div>
                                )}
                                <div className="text-[10px] text-[#9aa0a6] mt-1 px-2">
                                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-[#dadce0] rounded-2xl px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-[#1a73e8] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-[#1a73e8] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-[#1a73e8] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t border-[#dadce0]">
                    <form
                        onSubmit={(e) => { e.preventDefault(); sendMessage(inputText); }}
                        className="flex items-center gap-3"
                    >
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Ask me anything about your class..."
                            className="flex-1 px-4 py-3 bg-[#f1f3f4] rounded-xl text-sm text-[#3c4043] placeholder-[#9aa0a6] outline-none focus:ring-2 focus:ring-[#1a73e8]/20 transition-all"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !inputText.trim()}
                            className="p-3 bg-[#1a73e8] text-white rounded-xl hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TeacherAssistant;
