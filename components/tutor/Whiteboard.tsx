import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Eraser, Pencil, Trash2, Move } from 'lucide-react';

interface WhiteboardProps {
    onCanvasUpdate?: (canvasDataUrl: string) => void;
    backgroundImageUrl?: string;
    questionText?: string;
    isListening?: boolean;
    isSpeaking?: boolean;
    onToggleListening?: () => void;
    onToggleSpeaking?: () => void;
}

export interface WhiteboardRef {
    captureScreenshot: () => Promise<string>;
    drawText: (text: string, x: number, y: number, color?: string, fontSize?: number) => void;
    drawShape: (type: 'circle' | 'rect' | 'arrow', x: number, y: number, width: number, height: number, color?: string) => void;
    drawImage: (url: string, x: number, y: number, width: number, height: number) => void;
    drawResearchResults: (query: string, findings: string) => void;
    clear: () => void;
    focusOnArea: (x: number, y: number, width: number, height: number) => void;
}

interface Stroke {
    points: { x: number; y: number }[];
    color: string;
    width: number;
    tool: 'pencil' | 'eraser' | 'move';
}

interface AgentItem {
    id: string;
    type: 'text' | 'shape' | 'image';
    params: any;
}

export const Whiteboard = forwardRef<WhiteboardRef, WhiteboardProps>(({
    onCanvasUpdate,
    backgroundImageUrl,
    questionText,
    isListening = false,
    isSpeaking = false,
    onToggleListening,
    onToggleSpeaking
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const backgroundRef = useRef<HTMLImageElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [textBackgroundUrl, setTextBackgroundUrl] = useState<string>('');
    const [tool, setTool] = useState<'pencil' | 'eraser' | 'move'>('pencil');
    const [color, setColor] = useState('#1e40af');
    const [lineWidth, setLineWidth] = useState(3);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const [viewMatrix, setViewMatrix] = useState({ x: 0, y: 0, scale: 1 });
    const viewMatrixRef = useRef({ x: 0, y: 0, scale: 1 });
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [agentItems, setAgentItems] = useState<AgentItem[]>([]);
    const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (questionText && !backgroundImageUrl) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 1024;
            tempCanvas.height = 768;
            const ctx = tempCanvas.getContext('2d');
            if (!ctx) return;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

            ctx.fillStyle = '#1e293b';
            ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            const maxWidth = 700;
            const lineHeight = 36;
            const x = 40;
            let y = 40;

            const words = questionText.split(' ');
            let line = '';

            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && i > 0) {
                    ctx.fillText(line, x, y);
                    line = words[i] + ' ';
                    y += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, x, y);

            setTextBackgroundUrl(tempCanvas.toDataURL('image/png'));
        } else if (!questionText && !backgroundImageUrl) {
            setTextBackgroundUrl('');
        }
    }, [questionText, backgroundImageUrl]);

    useImperativeHandle(ref, () => ({
        captureScreenshot: async (): Promise<string> => {
            const canvas = canvasRef.current;
            const backgroundImg = backgroundRef.current;
            if (!canvas) return '';

            const compositeCanvas = document.createElement('canvas');
            const ctx = compositeCanvas.getContext('2d');
            if (!ctx) return '';

            const rect = canvas.getBoundingClientRect();
            compositeCanvas.width = rect.width;
            compositeCanvas.height = rect.height;

            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

            if (backgroundImg && (backgroundImageUrl || textBackgroundUrl)) {
                ctx.save();
                ctx.translate(viewMatrix.x, viewMatrix.y);
                ctx.scale(viewMatrix.scale, viewMatrix.scale);
                ctx.drawImage(backgroundImg, 0, 0);
                ctx.restore();
            }

            // Draw all current items to screenshot
            drawAllContent(ctx, true);

            try {
                return compositeCanvas.toDataURL('image/png');
            } catch (e) {
                console.warn('⚠️ Canvas tainted by cross-origin images, capturing without them');
                // Fallback: return a blank canvas with just strokes
                const fallbackCanvas = document.createElement('canvas');
                const fallbackCtx = fallbackCanvas.getContext('2d');
                if (!fallbackCtx) return '';
                fallbackCanvas.width = rect.width;
                fallbackCanvas.height = rect.height;
                fallbackCtx.fillStyle = 'white';
                fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
                return fallbackCanvas.toDataURL('image/png');
            }
        },
        drawText: (text: string, x: number, y: number, color?: string, fontSize?: number) => {
            setAgentItems(prev => [...prev, {
                id: Math.random().toString(36),
                type: 'text',
                params: { text, x, y, color, fontSize }
            }]);
        },
        drawShape: (type: 'circle' | 'rect' | 'arrow', x: number, y: number, width: number, height: number, color?: string) => {
            setAgentItems(prev => [...prev, {
                id: Math.random().toString(36),
                type: 'shape',
                params: { type, x, y, width, height, color }
            }]);
        },
        drawImage: (url: string, x: number, y: number, width: number, height: number) => {
            console.log('🖼️ Whiteboard.drawImage called:', { url: url?.substring(0, 80), x, y, width, height });
            setAgentItems(prev => [...prev, {
                id: Math.random().toString(36),
                type: 'image',
                params: { url, x, y, width, height }
            }]);
        },
        clear: () => {
            setStrokes([]);
            setAgentItems([]);
            clearCanvas();
        },
        drawResearchResults: (query: string, findings: string) => {
            // Calculate the bottom-most Y of all existing agent items
            let bottomY = 0;
            agentItems.forEach(item => {
                let itemBottom = 0;
                if (item.type === 'text') {
                    itemBottom = (item.params.y || 0) + (item.params.fontSize || 20) + 10;
                } else if (item.type === 'shape') {
                    itemBottom = (item.params.y || 0) + (item.params.height || 100);
                } else if (item.type === 'image') {
                    itemBottom = (item.params.y || 0) + (item.params.height || 200);
                }
                if (itemBottom > bottomY) bottomY = itemBottom;
            });

            // Add padding below existing content
            const startY = Math.max(bottomY + 60, 50);
            const boxX = 50;
            const boxWidth = 800;
            const padding = 20;
            const lineHeight = 26;
            const headerHeight = 50;

            // Word-wrap findings into lines
            const maxCharsPerLine = 85;
            const rawLines = findings.split('\n').filter(l => l.trim());
            const wrappedLines: string[] = [];
            rawLines.forEach(line => {
                if (line.length <= maxCharsPerLine) {
                    wrappedLines.push(line);
                } else {
                    const words = line.split(' ');
                    let current = '';
                    words.forEach(word => {
                        if ((current + ' ' + word).length > maxCharsPerLine) {
                            wrappedLines.push(current);
                            current = word;
                        } else {
                            current = current ? current + ' ' + word : word;
                        }
                    });
                    if (current) wrappedLines.push(current);
                }
            });

            const contentHeight = headerHeight + padding * 2 + wrappedLines.length * lineHeight + 20;
            const newItems: AgentItem[] = [];

            // Background box
            newItems.push({
                id: Math.random().toString(36),
                type: 'shape',
                params: { type: 'rect', x: boxX, y: startY, width: boxWidth, height: contentHeight, color: '#e8f4fd', stroke: '#3b82f6', strokeWidth: 2 }
            });

            // Header bar
            newItems.push({
                id: Math.random().toString(36),
                type: 'shape',
                params: { type: 'rect', x: boxX, y: startY, width: boxWidth, height: headerHeight, color: '#3b82f6' }
            });

            // Title
            newItems.push({
                id: Math.random().toString(36),
                type: 'text',
                params: { text: `📚 Research: ${query}`, x: boxX + padding, y: startY + 14, color: '#ffffff', fontSize: 22 }
            });

            // Content lines
            wrappedLines.forEach((line, i) => {
                newItems.push({
                    id: Math.random().toString(36),
                    type: 'text',
                    params: { text: line, x: boxX + padding, y: startY + headerHeight + padding + i * lineHeight, color: '#1e293b', fontSize: 15 }
                });
            });

            setAgentItems(prev => [...prev, ...newItems]);

            // Focus camera on the research results box
            setTimeout(() => {
                const whiteboardRef = ref as React.RefObject<WhiteboardRef>;
                whiteboardRef?.current?.focusOnArea(boxX, startY, boxWidth, contentHeight);
            }, 100);
        },
        focusOnArea: (x: number, y: number, width: number, height: number) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const padding = 100;

            // Calculate scale to fit area with padding
            const scaleX = rect.width / (width + padding * 2);
            const scaleY = rect.height / (height + padding * 2);
            const newScale = Math.min(Math.min(scaleX, scaleY), 1.0); // Don't zoom in past 100%

            // Center the area
            const newX = (rect.width / 2) - (x + width / 2) * newScale;
            const newY = (rect.height / 2) - (y + height / 2) * newScale;

            animateViewMatrix({ x: newX, y: newY, scale: newScale });
        }
    }));

    const animateViewMatrix = (target: { x: number, y: number, scale: number }) => {
        const start = { ...viewMatrixRef.current };
        const duration = 1000;
        const startTime = performance.now();

        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);

            const current = {
                x: start.x + (target.x - start.x) * ease,
                y: start.y + (target.y - start.y) * ease,
                scale: start.scale + (target.scale - start.scale) * ease
            };

            setViewMatrix(current);
            viewMatrixRef.current = current;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.resetTransform();
            ctx.scale(dpr, dpr);
            drawAll();
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    useEffect(() => {
        drawAll();
    }, [viewMatrix, strokes, agentItems]);

    const drawAll = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        const dpr = window.devicePixelRatio || 1;
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawAllContent(ctx);
    };

    const drawAllContent = (ctx: CanvasRenderingContext2D, isStatic = false) => {
        const vm = viewMatrix;
        ctx.save();
        if (!isStatic) {
            ctx.translate(vm.x, vm.y);
            ctx.scale(vm.scale, vm.scale);
        }

        // Draw agent items
        agentItems.forEach(item => {
            if (item.type === 'text') {
                ctx.fillStyle = item.params.color || '#1e40af';
                ctx.font = `bold ${item.params.fontSize || 24}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
                ctx.fillText(item.params.text, item.params.x, item.params.y);
            } else if (item.type === 'shape') {
                const { x, y, width: w, height: h, type, color, stroke, strokeWidth } = item.params;
                ctx.beginPath();
                if (type === 'circle') ctx.arc(x + (w || 0) / 2, y + (h || 0) / 2, (w || 0) / 2, 0, Math.PI * 2);
                else if (type === 'rect') ctx.rect(x, y, w, h);
                else if (type === 'arrow') {
                    const headlen = 15;
                    const tox = x + w, toy = y + h;
                    const angle = Math.atan2(h, w);
                    ctx.moveTo(x, y); ctx.lineTo(tox, toy);
                    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
                    ctx.moveTo(tox, toy);
                    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
                }
                // Fill if color is provided
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fill();
                }
                // Only stroke if explicitly requested via stroke param
                if (stroke) {
                    ctx.strokeStyle = stroke;
                    ctx.lineWidth = strokeWidth || 2;
                    ctx.stroke();
                } else if (!color) {
                    // No fill and no explicit stroke — default outline behavior
                    ctx.strokeStyle = '#1e40af';
                    ctx.lineWidth = strokeWidth || 3;
                    ctx.stroke();
                }
            } else if (item.type === 'image') {
                let img = imageCacheRef.current[item.params.url];
                if (!img) {
                    img = new Image();
                    // NOTE: Do NOT set crossOrigin="anonymous" — MiniMax CDN doesn't support CORS
                    // Without it, images load normally but canvas becomes tainted (handled in captureScreenshot)
                    img.onload = () => {
                        console.log('✅ Image loaded successfully:', item.params.url?.substring(0, 60));
                        imageCacheRef.current[item.params.url] = img!;
                        drawAll();
                    };
                    img.onerror = (e) => {
                        console.error('❌ Image failed to load:', item.params.url?.substring(0, 80), e);
                        // Draw a placeholder to show where the image should be
                        const placeholderImg = new Image();
                        // Mark as failed so we don't retry forever
                        imageCacheRef.current[item.params.url] = placeholderImg;
                    };
                    img.src = item.params.url;
                }
                if (img.complete && img.naturalWidth > 0) {
                    ctx.drawImage(img, item.params.x, item.params.y, item.params.width, item.params.height);
                } else if (img.complete && img.naturalWidth === 0) {
                    // Draw error placeholder
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6, 4]);
                    ctx.strokeRect(item.params.x, item.params.y, item.params.width, item.params.height);
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#fef2f2';
                    ctx.fillRect(item.params.x + 1, item.params.y + 1, item.params.width - 2, item.params.height - 2);
                    ctx.fillStyle = '#ef4444';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('⚠️ Image failed to load', item.params.x + item.params.width / 2, item.params.y + item.params.height / 2);
                    ctx.textAlign = 'start';
                }
            }
        });

        // Draw manual strokes
        strokes.forEach(stroke => {
            if (stroke.points.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
            ctx.lineWidth = stroke.tool === 'eraser' ? stroke.width * 3 : stroke.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';

            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
        });

        ctx.restore();
    };

    const getMousePos = (e: React.MouseEvent | React.WheelEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Map screen pixels to "World Space" coordinates
        return {
            x: (screenX - viewMatrix.x) / viewMatrix.scale,
            y: (screenY - viewMatrix.y) / viewMatrix.scale
        };
    };

    const handleWheel = (e: React.WheelEvent) => {
        const mousePos = getMousePos(e);
        const zoomSpeed = 0.001;
        const delta = -e.deltaY;
        const newScale = Math.min(Math.max(viewMatrix.scale + delta * zoomSpeed, 0.1), 5);

        const scaleRatio = newScale / viewMatrix.scale;

        const newX = mousePos.x - (mousePos.x - viewMatrix.x) * scaleRatio;
        const newY = mousePos.y - (mousePos.y - viewMatrix.y) * scaleRatio;

        const newMatrix = { x: newX, y: newY, scale: newScale };
        setViewMatrix(newMatrix);
        viewMatrixRef.current = newMatrix;
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        // Pan mode: move tool, middle click, or shift+click
        if (tool === 'move' || e.buttons === 4 || (e.shiftKey && e.buttons === 1)) {
            setIsDrawing(false);
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            lastPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            return;
        }

        setIsDrawing(true);
        const pos = getMousePos(e);
        setStrokes(prev => [...prev, {
            points: [pos],
            color,
            width: lineWidth,
            tool
        }]);
        lastPosRef.current = pos;
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        // Handle Panning (move tool, middle click, or shift+click)
        if (tool === 'move' || e.buttons === 4 || (e.shiftKey && e.buttons === 1)) {
            if (!lastPosRef.current) return;
            const dx = screenPos.x - lastPosRef.current.x;
            const dy = screenPos.y - lastPosRef.current.y;
            const newMatrix = { ...viewMatrix, x: viewMatrix.x + dx, y: viewMatrix.y + dy };
            setViewMatrix(newMatrix);
            viewMatrixRef.current = newMatrix;
            lastPosRef.current = screenPos;
            return;
        }

        if (!isDrawing) return;

        const worldPos = getMousePos(e);
        setStrokes(prev => {
            const last = prev[prev.length - 1];
            if (!last) return prev;
            const updated = { ...last, points: [...last.points, worldPos] };
            return [...prev.slice(0, -1), updated];
        });
        lastPosRef.current = worldPos;
    };

    const handleMouseUp = () => {
        if (tool === 'move') {
            lastPosRef.current = null;
            return;
        }

        if (!isDrawing) return;

        setIsDrawing(false);
        lastPosRef.current = null;

        if (canvasRef.current && onCanvasUpdate) {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            onCanvasUpdate(dataUrl);
        }
    };

    const notifyCanvasChange = () => {
        if (canvasRef.current && onCanvasUpdate) {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            onCanvasUpdate(dataUrl);
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        notifyCanvasChange();
    };

    return (
        <div className="h-full flex flex-col">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col space-y-3 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-slate-200">
                <button
                    onClick={() => setTool('pencil')}
                    className={`p-3 rounded-xl transition-all duration-200 ${tool === 'pencil' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110' : 'text-slate-600 hover:bg-slate-100'}`}
                    title="Pencil"
                >
                    <Pencil className="w-5 h-5" />
                </button>

                <button
                    onClick={() => setTool('eraser')}
                    className={`p-3 rounded-xl transition-all duration-200 ${tool === 'eraser' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110' : 'text-slate-600 hover:bg-slate-100'}`}
                    title="Eraser"
                >
                    <Eraser className="w-5 h-5" />
                </button>

                <button
                    onClick={() => setTool('move')}
                    className={`p-3 rounded-xl transition-all duration-200 ${tool === 'move' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110' : 'text-slate-600 hover:bg-slate-100'}`}
                    title="Pan / Move"
                >
                    <Move className="w-5 h-5" />
                </button>

                <div className="h-px bg-slate-200 mx-2 my-1" />

                <div className="flex flex-col items-center space-y-2 py-2">
                    <div
                        className="w-8 h-8 rounded-full border-2 border-slate-200 cursor-pointer overflow-hidden shadow-sm hover:scale-105 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={() => document.getElementById('colorPicker')?.click()}
                    />
                    <input
                        id="colorPicker"
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="hidden"
                    />
                </div>

                <div className="group relative flex flex-col items-center py-2">
                    <div className="absolute left-full ml-4 bg-white px-3 py-2 rounded-lg shadow-xl border border-slate-200 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex items-center space-x-3 w-40">
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={lineWidth}
                            onChange={(e) => setLineWidth(Number(e.target.value))}
                            className="w-full accent-blue-600 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-500 min-w-[24px]">{lineWidth}px</span>
                    </div>
                    <div className="w-8 h-8 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                        <div
                            className="rounded-full bg-current"
                            style={{ width: Math.max(2, lineWidth), height: Math.max(2, lineWidth), maxWidth: '100%', maxHeight: '100%' }}
                        />
                    </div>
                </div>

                <div className="h-px bg-slate-200 mx-2 my-1" />

                <button
                    onClick={clearCanvas}
                    className="p-3 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                    title="Clear Canvas"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>

            <div ref={containerRef} className="flex-1 relative bg-white overflow-hidden">
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        transform: `translate(${viewMatrix.x}px, ${viewMatrix.y}px) scale(${viewMatrix.scale})`,
                        transformOrigin: '0 0'
                    }}
                >
                    {(backgroundImageUrl || textBackgroundUrl) && (
                        <img
                            ref={backgroundRef}
                            src={backgroundImageUrl || textBackgroundUrl}
                            alt="Whiteboard background"
                            className={`${backgroundImageUrl ? 'rounded-lg shadow-lg border-2 border-slate-300' : ''}`}
                            style={{
                                top: backgroundImageUrl ? '20px' : 0,
                                left: backgroundImageUrl ? '20px' : 0,
                                width: 'auto',
                                height: 'auto',
                                maxWidth: backgroundImageUrl ? '30%' : '100%',
                                maxHeight: backgroundImageUrl ? '30%' : '100%',
                            }}
                        />
                    )}
                </div>

                <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                    className={`absolute inset-0 w-full h-full ${tool === 'move' ? (isDrawing ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'}`}
                    style={{ background: 'transparent' }}
                />

                <div className="absolute right-4 bottom-4 flex items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>Zoom: {Math.round(viewMatrix.scale * 100)}%</span>
                    <div className="w-px h-3 bg-slate-200" />
                    <button
                        onClick={() => {
                            const reset = { x: 0, y: 0, scale: 1 };
                            setViewMatrix(reset);
                            viewMatrixRef.current = reset;
                        }}
                        className="hover:text-blue-600 transition-colors"
                    >
                        Reset View
                    </button>
                </div>
            </div>
        </div>
    );
});
