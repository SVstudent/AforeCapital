import { useState, useRef } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import { X, Minimize2, Maximize2, GripHorizontal, Lightbulb, BookOpen, ListOrdered, Calculator } from 'lucide-react';
import { MathContent } from './MathContent';

export type ContextContentType = 'equation' | 'definition' | 'step-by-step' | 'theorem' | 'hint' | 'tip';

export interface ContentBlock {
    type: ContextContentType;
    content: string;
}

export interface AIContextContent {
    title: string;
    blocks: ContentBlock[];
    timestamp: number;
}

interface AIContextWindowProps {
    content: AIContextContent | null;
    isVisible: boolean;
    isMinimized: boolean;
    position: { x: number; y: number };
    transparency: number;
    onClose: () => void;
    onToggleMinimize: () => void;
    onPositionChange: (x: number, y: number) => void;
}

const MAX_WIDTH = 320;
const MAX_HEIGHT = 600;
const MINIMIZED_HEIGHT = 48;

const contentTypeIcons = {
    equation: Calculator,
    definition: BookOpen,
    'step-by-step': ListOrdered,
    theorem: BookOpen,
    hint: Lightbulb,
    tip: Lightbulb,
};

const contentTypeColors = {
    equation: 'bg-blue-50 border-blue-200',
    definition: 'bg-green-50 border-green-200',
    'step-by-step': 'bg-purple-50 border-purple-200',
    theorem: 'bg-orange-50 border-orange-200',
    hint: 'bg-yellow-50 border-yellow-200',
    tip: 'bg-yellow-50 border-yellow-200',
};

export function AIContextWindow({
    content,
    isVisible,
    isMinimized,
    position,
    transparency,
    onClose,
    onToggleMinimize,
    onPositionChange,
}: AIContextWindowProps) {
    const nodeRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleDrag = (_e: DraggableEvent, data: DraggableData) => {
        setIsDragging(true);
    };

    const handleStop = (_e: DraggableEvent, data: DraggableData) => {
        setIsDragging(false);
        onPositionChange(data.x, data.y);
    };

    if (!isVisible || !content) {
        return null;
    }

    return (
        <Draggable
            nodeRef={nodeRef}
            position={position}
            onDrag={handleDrag}
            onStop={handleStop}
            handle=".drag-handle"
            bounds="parent"
        >
            <div
                ref={nodeRef}
                className={`absolute bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 transition-opacity duration-300 ${isDragging ? 'cursor-grabbing scale-[1.02]' : ''
                    }`}
                style={{
                    width: MAX_WIDTH,
                    maxHeight: isMinimized ? MINIMIZED_HEIGHT : MAX_HEIGHT,
                    opacity: transparency,
                    zIndex: 50,
                }}
            >
                <div className="drag-handle bg-white/50 backdrop-blur-sm border-b border-slate-100 px-4 py-3 rounded-t-2xl cursor-grab active:cursor-grabbing flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm shadow-blue-100">
                            <Lightbulb className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="font-bold text-sm text-slate-800 tracking-tight truncate">{content.title}</h3>
                    </div>
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={onToggleMinimize}
                            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                            title={isMinimized ? 'Maximize' : 'Minimize'}
                        >
                            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                            title="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {!isMinimized && (
                    <div className="overflow-y-auto" style={{ maxHeight: MAX_HEIGHT - MINIMIZED_HEIGHT }}>
                        <div className="p-4 space-y-4">
                            {content.blocks.map((block, index) => {
                                const Icon = contentTypeIcons[block.type];
                                const colorClass = contentTypeColors[block.type];

                                return (
                                    <div
                                        key={index}
                                        className={`rounded-2xl border p-4 ${colorClass} transition-all hover:shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-500`}
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <div className="flex items-center space-x-2 mb-3">
                                            <div className="bg-white/60 p-1 rounded-md">
                                                <Icon className="w-3.5 h-3.5 text-slate-700" />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                {block.type.replace('-', ' ')}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-700 leading-relaxed font-medium">
                                            <MathContent content={block.content} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </Draggable>
    );
}
