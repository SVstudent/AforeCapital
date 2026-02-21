import { useState } from 'react';
import { Upload, Send, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';

interface QuestionInputProps {
    onSubmit: (question: string, imageUrl?: string) => void;
    disabled?: boolean;
    isListening: boolean;
    isSpeaking: boolean;
    onToggleListening: () => void;
    onToggleSpeaking: () => void;
}

export function QuestionInput({ onSubmit, disabled = false, isListening, isSpeaking, onToggleListening, onToggleSpeaking }: QuestionInputProps) {
    const [questionText, setQuestionText] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [inputMode, setInputMode] = useState<'text' | 'image'>('text');

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setImagePreview(dataUrl);
            setInputMode('image');
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = () => {
        if (inputMode === 'text' && questionText.trim()) {
            onSubmit(questionText);
            setQuestionText('');
        } else if (inputMode === 'image' && imagePreview) {
            onSubmit(questionText || 'Please help me solve this problem from the image', imagePreview);
            setImagePreview(null);
            setQuestionText('');
        }
    };

    const handleClearImage = () => {
        setImagePreview(null);
        setInputMode('text');
    };

    return (
        <div className="bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 relative z-40">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-end space-x-3">
                    <div className="flex-1 relative">
                        {imagePreview && (
                            <div className="absolute bottom-full mb-3 left-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="relative inline-block group">
                                    <img
                                        src={imagePreview}
                                        alt="Question preview"
                                        className="max-h-24 rounded-xl border-2 border-white shadow-lg ring-1 ring-slate-200"
                                    />
                                    <button
                                        onClick={handleClearImage}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600 shadow-sm transition-transform hover:scale-110"
                                    >
                                        <span className="text-xs">×</span>
                                    </button>
                                </div>
                            </div>
                        )}
                        <textarea
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                            placeholder={
                                imagePreview
                                    ? 'Add context to your image...'
                                    : 'Ask Lumina a question or type details here...'
                            }
                            disabled={disabled}
                            rows={1}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[52px] max-h-32 text-slate-700"
                            style={{ height: 'auto' }}
                        />
                    </div>

                    <div className="flex items-center space-x-3 pb-1">
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <label className="flex items-center justify-center w-10 h-10 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg cursor-pointer transition-all disabled:opacity-50">
                                <Upload className="w-5 h-5" />
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={disabled}
                                    className="hidden"
                                />
                            </label>

                            <button
                                onClick={handleSubmit}
                                disabled={disabled || (!questionText.trim() && !imagePreview)}
                                className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-200 hover:scale-105 active:scale-95 ml-1"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                                onClick={onToggleSpeaking}
                                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${isSpeaking ? 'bg-green-100 text-green-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                title={isSpeaking ? 'AI Voice Enabled' : 'AI Voice Disabled'}
                            >
                                {isSpeaking ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                            </button>

                            <button
                                onClick={onToggleListening}
                                disabled={disabled && !isListening} // Allow clicking to stop if listening
                                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ml-1 ${isListening ? 'bg-red-500 text-white shadow-lg animate-pulse' : 'text-slate-400 hover:text-blue-600 hover:bg-white'
                                    }`}
                                title={isListening ? 'End Live Session' : 'Start Voice Input'}
                            >
                                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
