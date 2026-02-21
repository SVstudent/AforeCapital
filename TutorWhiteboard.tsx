
import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';

// Whiteboard Command Types
export interface WriteCommand {
    action: 'write';
    text: string;
    x?: number;
    y?: number;
    size?: number;
    color?: string;
}

export interface DrawCommand {
    action: 'draw';
    shape: 'arrow' | 'circle' | 'rect' | 'line';
    from?: [number, number];
    to?: [number, number];
    center?: [number, number];
    radius?: number;
    width?: number;
    height?: number;
    color?: string;
}

export interface HighlightCommand {
    action: 'highlight';
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
}

export interface ClearCommand {
    action: 'clear';
}

export interface ImageCommand {
    action: 'image';
    imageData: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

export type WhiteboardCommand = WriteCommand | DrawCommand | HighlightCommand | ClearCommand | ImageCommand;

export interface TutorWhiteboardHandle {
    executeCommand: (cmd: WhiteboardCommand) => void;
    renderImage: (base64Data: string, x?: number, y?: number, width?: number, height?: number) => void;
    clear: () => void;
}

interface TutorWhiteboardProps {
    className?: string;
}

const CANVAS_WIDTH = 800;
const MIN_CANVAS_HEIGHT = 800;
const CONTENT_PADDING = 30;

const TutorWhiteboard = forwardRef<TutorWhiteboardHandle, TutorWhiteboardProps>(({ className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Use refs for everything to avoid React re-renders clearing canvas
    const currentYRef = useRef(80);
    const canvasHeightRef = useRef(MIN_CANVAS_HEIGHT);
    const renderedHashesRef = useRef<Set<string>>(new Set());
    const itemCountRef = useRef(0);
    const itemCountDisplayRef = useRef<HTMLSpanElement>(null);

    // Queue for pending operations during canvas expansion
    const pendingDrawRef = useRef<(() => void) | null>(null);
    const isExpandingRef = useRef(false);

    // Initialize canvas once
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = CANVAS_WIDTH;
        canvas.height = canvasHeightRef.current;
        canvas.style.height = `${canvasHeightRef.current}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            drawBackground(ctx, canvas.width, canvas.height);
        }
    }, []);

    // Draw background grid
    const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    };

    // Expand canvas - returns a Promise that resolves when expansion is complete
    const expandCanvas = useCallback((newHeight: number): Promise<void> => {
        return new Promise((resolve) => {
            const canvas = canvasRef.current;
            if (!canvas) {
                resolve();
                return;
            }

            if (newHeight <= canvasHeightRef.current) {
                resolve();
                return;
            }

            console.log('[Canvas] Expanding from', canvasHeightRef.current, 'to', newHeight);
            isExpandingRef.current = true;

            // Save current canvas content as image
            const imageData = canvas.toDataURL('image/png');

            // Expand canvas (this clears it)
            canvasHeightRef.current = newHeight;
            canvas.height = newHeight;
            canvas.style.height = `${newHeight}px`;

            // Redraw background
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                isExpandingRef.current = false;
                resolve();
                return;
            }
            drawBackground(ctx, canvas.width, canvas.height);

            // Restore the saved content BEFORE resolving
            const restoreImg = new Image();
            restoreImg.onload = () => {
                ctx.drawImage(restoreImg, 0, 0);
                console.log('[Canvas] Content restored after expansion');
                isExpandingRef.current = false;
                resolve();
            };
            restoreImg.onerror = () => {
                console.error('[Canvas] Failed to restore content');
                isExpandingRef.current = false;
                resolve();
            };
            restoreImg.src = imageData;
        });
    }, []);

    // Get text hash for duplicate detection
    const getTextHash = (text: string, x: number, y: number): string => {
        return `${text.trim().substring(0, 20).toLowerCase()}-${Math.round(x / 20)}-${Math.round(y / 20)}`;
    };

    // Get next Y position
    const getNextY = useCallback((heightNeeded: number): number => {
        const y = currentYRef.current;
        currentYRef.current += heightNeeded + CONTENT_PADDING;
        return y;
    }, []);

    // Update item count display
    const updateItemCount = () => {
        if (itemCountDisplayRef.current) {
            itemCountDisplayRef.current.textContent = `${itemCountRef.current} items`;
        }
    };

    // Scroll to bottom
    const scrollToLatest = useCallback(() => {
        const doScroll = () => {
            if (containerRef.current) {
                containerRef.current.scrollTo({
                    top: containerRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }
        };
        setTimeout(doScroll, 100);
        setTimeout(doScroll, 400);
    }, []);

    // Draw shape helper
    const drawShape = (ctx: CanvasRenderingContext2D, cmd: DrawCommand) => {
        ctx.strokeStyle = cmd.color || '#60a5fa';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (cmd.shape === 'arrow' && cmd.from && cmd.to) {
            ctx.beginPath();
            ctx.moveTo(cmd.from[0], cmd.from[1]);
            ctx.lineTo(cmd.to[0], cmd.to[1]);
            ctx.stroke();

            const angle = Math.atan2(cmd.to[1] - cmd.from[1], cmd.to[0] - cmd.from[0]);
            const arrowSize = 15;
            ctx.beginPath();
            ctx.moveTo(cmd.to[0], cmd.to[1]);
            ctx.lineTo(cmd.to[0] - arrowSize * Math.cos(angle - Math.PI / 6), cmd.to[1] - arrowSize * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(cmd.to[0], cmd.to[1]);
            ctx.lineTo(cmd.to[0] - arrowSize * Math.cos(angle + Math.PI / 6), cmd.to[1] - arrowSize * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
        } else if (cmd.shape === 'circle' && cmd.center && cmd.radius) {
            ctx.beginPath();
            ctx.arc(cmd.center[0], cmd.center[1], cmd.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else if (cmd.shape === 'rect' && cmd.from && cmd.width && cmd.height) {
            ctx.strokeRect(cmd.from[0], cmd.from[1], cmd.width, cmd.height);
        } else if (cmd.shape === 'line' && cmd.from && cmd.to) {
            ctx.beginPath();
            ctx.moveTo(cmd.from[0], cmd.from[1]);
            ctx.lineTo(cmd.to[0], cmd.to[1]);
            ctx.stroke();
        }
    };

    // Execute whiteboard commands
    const executeCommand = useCallback((cmd: WhiteboardCommand) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        switch (cmd.action) {
            case 'write': {
                const fontSize = cmd.size || 24;
                ctx.font = `bold ${fontSize}px "Google Sans", sans-serif`;

                const metrics = ctx.measureText(cmd.text);
                const textHeight = fontSize * 1.4;

                // ALWAYS use auto-positioning for text - ignore AI's x,y to prevent overlapping
                const x = 40; // Fixed left margin
                const y = getNextY(textHeight); // Always use next available position

                // Check for duplicate text content (regardless of position)
                const hash = `text-${cmd.text.trim().toLowerCase().substring(0, 30)}`;
                if (renderedHashesRef.current.has(hash)) {
                    console.log('[Canvas] Skipping duplicate text:', cmd.text.substring(0, 30));
                    return;
                }
                renderedHashesRef.current.add(hash);

                // Draw text with slight glow effect for better visibility
                ctx.shadowColor = 'rgba(74, 222, 128, 0.3)';
                ctx.shadowBlur = 8;
                ctx.fillStyle = cmd.color || '#4ade80';
                ctx.fillText(cmd.text, x, y);
                ctx.shadowBlur = 0;

                console.log('[Canvas] Text rendered:', cmd.text, 'at y:', y);

                itemCountRef.current++;
                updateItemCount();
                scrollToLatest();
                break;
            }

            case 'draw': {
                drawShape(ctx, cmd);
                itemCountRef.current++;
                updateItemCount();
                break;
            }

            case 'highlight': {
                ctx.fillStyle = cmd.color || 'rgba(250, 204, 21, 0.3)';
                ctx.fillRect(cmd.x, cmd.y, cmd.width, cmd.height);
                break;
            }

            case 'clear': {
                // DON'T actually clear - add a divider
                console.log('[Canvas] Adding section divider (stateful canvas)');
                const dividerY = getNextY(50);

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 1;
                ctx.setLineDash([10, 10]);
                ctx.beginPath();
                ctx.moveTo(40, dividerY);
                ctx.lineTo(CANVAS_WIDTH - 40, dividerY);
                ctx.stroke();
                ctx.setLineDash([]);
                break;
            }

            case 'image': {
                if (cmd.imageData) {
                    renderImage(cmd.imageData, cmd.x, cmd.y, cmd.width, cmd.height);
                }
                break;
            }
        }
    }, [getNextY, scrollToLatest]);

    // Render image on canvas - now properly async
    const renderImage = useCallback(async (base64Data: string, x?: number, y?: number, width?: number, height?: number) => {
        console.log('[Canvas] renderImage called, data length:', base64Data?.length || 0);

        const canvas = canvasRef.current;
        if (!canvas) {
            console.error('[Canvas] Canvas ref is null!');
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('[Canvas] Could not get 2d context!');
            return;
        }

        // Load the image first
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const imgEl = new Image();
            imgEl.onload = () => resolve(imgEl);
            imgEl.onerror = reject;
            imgEl.src = `data:image/png;base64,${base64Data}`;
        }).catch(err => {
            console.error('[Canvas] Image failed to load:', err);
            return null;
        });

        if (!img) return;

        console.log('[Canvas] Image loaded! Dimensions:', img.width, 'x', img.height);

        const imgWidth = width || Math.min(550, CANVAS_WIDTH - 80);
        const imgHeight = height || (img.height * (imgWidth / img.width));
        const imgX = x ?? (CANVAS_WIDTH - imgWidth) / 2;
        const imgY = y ?? getNextY(imgHeight + 40);

        // Ensure canvas is big enough BEFORE drawing - AWAIT the expansion
        const neededHeight = imgY + imgHeight + 100;
        if (neededHeight > canvasHeightRef.current) {
            await expandCanvas(neededHeight + 300);
        }

        // NOW draw the image (after expansion is complete)
        drawImageWithBorder(ctx, img, imgX, imgY, imgWidth, imgHeight);

        itemCountRef.current++;
        updateItemCount();
        console.log('[Canvas] Image rendered at:', imgX, imgY, 'size:', imgWidth, 'x', imgHeight);
        scrollToLatest();
    }, [getNextY, expandCanvas, scrollToLatest]);

    // Draw image with shadow and border
    const drawImageWithBorder = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, width: number, height: number) => {
        console.log('[Canvas] Drawing image with border at:', x, y);
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;
        ctx.drawImage(img, x, y, width, height);
        ctx.restore();

        // Green border
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
    };

    useImperativeHandle(ref, () => ({
        executeCommand,
        renderImage,
        clear: () => executeCommand({ action: 'clear' }),
    }), [executeCommand, renderImage]);

    return (
        <div
            ref={containerRef}
            className={`relative rounded-xl border border-white/10 overflow-y-auto overflow-x-hidden bg-[#1a1a2e] ${className || ''}`}
            style={{
                maxHeight: 'calc(100vh - 180px)',
                minHeight: '500px'
            }}
        >
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-[#1a1a2e]/95 backdrop-blur-sm border-b border-white/10 px-4 py-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Neural Canvas</span>
                <span ref={itemCountDisplayRef} className="ml-auto text-xs text-gray-500">0 items</span>
            </div>

            <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={MIN_CANVAS_HEIGHT}
                style={{
                    width: '100%',
                    height: `${MIN_CANVAS_HEIGHT}px`,
                    display: 'block'
                }}
            />
        </div>
    );
});

TutorWhiteboard.displayName = 'TutorWhiteboard';

export default TutorWhiteboard;
