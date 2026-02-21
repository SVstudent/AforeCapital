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

const MAX_WIDTH = 400;
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
                className={`fixed bg-white rounded-lg shadow-2xl border-2 border-slate-300 transition-all duration-300 ${isDragging ? 'cursor-grabbing' : ''
                    }`}
                style={{
                    width: MAX_WIDTH,
                    maxHeight: isMinimized ? MINIMIZED_HEIGHT : MAX_HEIGHT,
                    opacity: transparency,
                    zIndex: 40,
                }}
            >
                <div className="drag-handle bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-t-lg cursor-grab active:cursor-grabbing flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <GripHorizontal className="w-4 h-4 opacity-70" />
                        <h3 className="font-semibold text-sm truncate">{content.title}</h3>
                    </div>
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={onToggleMinimize}
                            className="p-1 hover:bg-blue-800 rounded transition"
                            title={isMinimized ? 'Maximize' : 'Minimize'}
                        >
                            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-blue-800 rounded transition"
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
                                        className={`rounded-lg border-2 p-4 ${colorClass} transition-all hover:shadow-md`}
                                    >
                                        <div className="flex items-center space-x-2 mb-3">
                                            <Icon className="w-4 h-4 text-slate-600" />
                                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                                {block.type.replace('-', ' ')}
                                            </span>
                                        </div>
                                        <div className="text-sm">
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
