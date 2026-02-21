import React from 'react';

interface Resource {
    title: string;
    url: string;
    type: 'video' | 'article' | 'paper' | 'docs' | 'course';
    description: string;
    source?: string;
}

interface SessionSummaryProps {
    topics: string[];
    resources: Resource[];
    duration: string;
    onClose: () => void;
    onNewSession: () => void;
    isLoading?: boolean;
}

const typeIcons: Record<string, React.ReactNode> = {
    video: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    article: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    paper: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    docs: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    course: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
};

const typeColors: Record<string, string> = {
    video: 'text-red-400 bg-red-500/10 border-red-500/20',
    article: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    paper: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    docs: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    course: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const SessionSummary: React.FC<SessionSummaryProps> = ({
    topics,
    resources,
    duration,
    onClose,
    onNewSession,
    isLoading = false,
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0a0a0f] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Session Complete</h2>
                                <p className="text-xs text-white/40">Duration: {duration}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>

                    {/* Topics */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        {topics.map((topic, i) => (
                            <span key={i} className="px-3 py-1 bg-white/5 rounded-full text-xs font-medium text-white/60 border border-white/10">
                                {topic}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Resources */}
                <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white/40 mb-4">
                        📚 Recommended Resources
                    </h3>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-white/40">Finding the best resources for you...</p>
                        </div>
                    ) : resources.length === 0 ? (
                        <p className="text-center text-white/30 py-8">No resources found.</p>
                    ) : (
                        <div className="space-y-3">
                            {resources.map((resource, i) => (
                                <a
                                    key={i}
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-lg border ${typeColors[resource.type] || typeColors.article}`}>
                                            {typeIcons[resource.type] || typeIcons.article}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
                                                    {resource.title}
                                                </h4>
                                                <svg className="w-4 h-4 text-white/20 group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                            <p className="text-xs text-white/40 mt-1 line-clamp-2">{resource.description}</p>
                                            {resource.source && (
                                                <p className="text-[10px] text-white/30 mt-2 uppercase tracking-wider">{resource.source}</p>
                                            )}
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-medium hover:bg-white/10 transition-all"
                    >
                        Close
                    </button>
                    <button
                        onClick={onNewSession}
                        className="flex-1 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all"
                    >
                        Start New Session
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionSummary;
