import { useState } from 'react';
import { BookOpen, Volume2, Sliders, ArrowRight } from 'lucide-react';

interface LandingPageProps {
    onStart: (voiceId: string, voiceName: string, pushinessLevel: number) => void;
}

const VOICES = [
    { id: 'Myn1LuZgd2qPMOg9BNtC', name: 'Pirate Tutor', description: 'Adventurous and fun' },
    { id: 'KTPVrSVAEUSJRClDzBw7', name: 'Cowboy Tutor', description: 'Down-to-earth and friendly' },
    { id: '8Ln42OXYupYsag45MAUy', name: 'Science Enthusiast', description: 'Curious and inspiring' },
    { id: '8AhzPX8Hll0IUrRKqLix', name: 'Australian Tutor', description: 'Laid-back and encouraging' },
    { id: '8z5UhJ1uv7X8TN5yg8oI', name: 'British Tutor', description: 'Articulate and sophisticated' },
];

const PUSHINESS_LABELS = [
    'Minimal Guidance',
    'Light Support',
    'Balanced',
    'Active Coaching',
    'Maximum Support',
];

export function LandingPage({ onStart }: LandingPageProps) {
    const [selectedVoice, setSelectedVoice] = useState(VOICES[0]);
    const [pushinessLevel, setPushinessLevel] = useState(3);

    const handleStart = () => {
        onStart(selectedVoice.id, selectedVoice.name, pushinessLevel);
    };

    return (
        <div className="flex-1 bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4 rounded-xl overflow-auto">
            <div className="max-w-2xl w-full">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center bg-blue-600 p-4 rounded-2xl mb-4 shadow-lg">
                        <BookOpen className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-slate-800 mb-2">Lumina Voice Tutor</h1>
                    <p className="text-lg text-slate-600">
                        Personalized voice interaction and collaborative whiteboard
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-8">
                    <div>
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <Volume2 className="w-5 h-5 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800">Select Voice</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {VOICES.map((voice) => (
                                <button
                                    key={voice.id}
                                    onClick={() => setSelectedVoice(voice)}
                                    className={`p-4 rounded-xl border-2 text-left transition ${selectedVoice.id === voice.id
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                >
                                    <h4 className="font-semibold text-slate-800">{voice.name}</h4>
                                    <p className="text-sm text-slate-600 mt-1">{voice.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-slate-200 pt-8">
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <Sliders className="w-5 h-5 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800">AI Guidance Level</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                                <span>How hands-on should your tutor be?</span>
                                <span className="text-blue-600">{PUSHINESS_LABELS[pushinessLevel - 1]}</span>
                            </div>

                            <input
                                type="range"
                                min="1"
                                max="5"
                                value={pushinessLevel}
                                onChange={(e) => setPushinessLevel(Number(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />

                            <div className="flex justify-between text-xs text-slate-500">
                                <span>Minimal</span>
                                <span>Light</span>
                                <span>Balanced</span>
                                <span>Active</span>
                                <span>Maximum</span>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-4 mt-4">
                                <p className="text-sm text-slate-700 leading-relaxed">
                                    {pushinessLevel === 1 &&
                                        'Only provides hints when you explicitly ask for help. Encourages independent problem-solving.'}
                                    {pushinessLevel === 2 &&
                                        'Offers occasional guidance when you seem stuck, but generally lets you work through problems.'}
                                    {pushinessLevel === 3 &&
                                        'Proactively checks in periodically and offers balanced guidance without giving away answers.'}
                                    {pushinessLevel === 4 &&
                                        'Frequently checks your understanding and guides you through problems step-by-step.'}
                                    {pushinessLevel === 5 &&
                                        'Provides maximum assistance with detailed explanations and frequent check-ins at each step.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleStart}
                        className="w-full flex items-center justify-center space-x-3 bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition shadow-lg hover:shadow-xl"
                    >
                        <span>Start Tutoring Session</span>
                        <ArrowRight className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
}
