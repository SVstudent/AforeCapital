import { MinimaxService } from './minimax';
import { RunwareService } from './runware';
import { WhiteboardRef } from '../components/tutor/Whiteboard';
import { SharedAgentContext } from './sharedContext';

export interface VisualAgentTask {
    type: 'text' | 'shape' | 'image' | 'clear';
    params: any;
}

export class VisualAgent {
    private minimax: MinimaxService;
    private runware: RunwareService;
    private whiteboard: WhiteboardRef | null = null;
    private sharedContext: SharedAgentContext | null = null;

    constructor(minimax: MinimaxService, runware: RunwareService, sharedContext?: SharedAgentContext) {
        this.minimax = minimax;
        this.runware = runware;
        if (sharedContext) this.sharedContext = sharedContext;
    }

    setSharedContext(context: SharedAgentContext) {
        this.sharedContext = context;
    }

    setWhiteboard(whiteboard: WhiteboardRef) {
        this.whiteboard = whiteboard;
    }

    async createVisual(request: string, currentContext?: string): Promise<string> {
        if (!this.whiteboard) return "Error: Visual Agent not connected to whiteboard.";

        console.log('🎨 Visual Agent (MiniMax): Designing visuals for:', request);

        // Step 1: Design - Use MiniMax to create a JSON execution plan
        const contextSnapshot = this.sharedContext?.getSnapshot() || "";
        const bounds = this.sharedContext?.getOccupiedBounds() || { x: 0, y: 0, width: 0, height: 0 };

        // Strategy: Suggest a new "Working Area" to avoid overlaps
        const suggestedY = bounds.height > 0 ? bounds.y + bounds.height + 200 : 100;

        const designPrompt = `You are the Visual Design Specialist for Lumina AI Tutor. 
        The student needs help with: "${request}"
        ${contextSnapshot ? `Shared Session context: ${contextSnapshot}` : ""}
        
        CRITICAL: DO NOT WIPE THE BOARD. We are working on an INFINITE canvas.
        Place your new content in a fresh area to avoid overlapping existing items.
        CURRENT OCCUPIED BOUNDS: x:${bounds.x}, y:${bounds.y}, width:${bounds.width}, height:${bounds.height}
        SUGGESTED STARTING Y-OFFSET: ${suggestedY}
        
        The viewport is effectively infinite. Use x: 0-1000 range for width, but feel free to expand Y downwards.
        
        Design a PROFESSIONAL, infographic-style layout. 
        Exploit the full Tool Suite:
        - text: Use for headings, labels, and structured bullet points. { "type": "text", "params": { "text": "Heading", "x": 100, "y": 100, "fontSize": 32 } }
        - shape: Use 'rect' for framing info-boxes, 'arrows' for showing steps/flows, and 'circle' for diagram highlights. { "type": "shape", "params": { "type": "rect", "x": 100, "y": 100, "width": 200, "height": 100 } }
        - image: MiniMax T2I for pedagogical illustrations. REQUIRED: A descriptive "prompt" must be provided in params. { "type": "image", "params": { "prompt": "illustration of mitosis", "x": 100, "y": 100, "width": 200, "height": 200 } }
        
        Return ONLY a JSON array. No markdown.
        Example: [{"type": "text", "params": {"text": "Step 1", "x": 50, "y": ${suggestedY}}}]`;

        const planText = await this.minimax.chat([{ role: 'user', content: designPrompt }], "You are a Master Visual Designer Powered by MiniMax.");
        console.log('🎨 Visual Agent: Received plan text:', planText);

        try {
            const jsonMatch = planText.match(/\[[\s\S]*\]/);
            const cleanJson = jsonMatch ? jsonMatch[0] : planText.replace(/```json|```/g, '').trim();
            const plan: VisualAgentTask[] = JSON.parse(cleanJson);

            // ENFORCE NON-OVERLAPPING: Shift the entire plan down if any item falls within occupied bounds
            const safeMinY = bounds.height > 0 ? bounds.y + bounds.height + 100 : 50;
            let planMinY = Infinity;
            for (const task of plan) {
                const taskY = Number(task.params.y ?? task.params.y1) || 0;
                if (taskY < planMinY) planMinY = taskY;
            }
            const yShift = planMinY < safeMinY ? safeMinY - planMinY : 0;
            if (yShift > 0) {
                console.log(`🎨 Visual Agent: Shifting plan down by ${yShift}px to avoid overlap (safeMinY=${safeMinY}, planMinY=${planMinY})`);
                for (const task of plan) {
                    if (task.params.y !== undefined) task.params.y = Number(task.params.y) + yShift;
                    if (task.params.y1 !== undefined) task.params.y1 = Number(task.params.y1) + yShift;
                    if (task.params.y2 !== undefined) task.params.y2 = Number(task.params.y2) + yShift;
                }
            }

            // Step 2: Execution & Spatial Registration
            let tasksExecuted = 0;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            for (const task of plan) {
                // Determine base x/y
                let x = Number(task.params.x ?? task.params.x1) || 0;
                let y = Number(task.params.y ?? task.params.y1) || 0;

                // Handle different shape param conventions (width/height vs dx/dy vs x2/y2)
                let w = 200;
                let h = 100;

                if (task.params.width !== undefined) w = Number(task.params.width);
                else if (task.params.dx !== undefined) w = Number(task.params.dx);
                else if (task.params.x2 !== undefined) w = Math.abs(Number(task.params.x2) - x);

                if (task.params.height !== undefined) h = Number(task.params.height);
                else if (task.params.dy !== undefined) h = Number(task.params.dy);
                else if (task.params.y2 !== undefined) h = Math.abs(Number(task.params.y2) - y);

                // Ensure absolute sizes
                w = Math.max(Math.abs(w), 1);
                h = Math.max(Math.abs(h), 1);

                // Track bounds of new items
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + w);
                maxY = Math.max(maxY, y + h);

                switch (task.type) {
                    case 'text':
                        this.whiteboard.drawText(task.params.text, x, y, task.params.color, task.params.fontSize);
                        this.sharedContext?.logVisualAct(`Added text: "${task.params.text.substring(0, 30)}..." at (${x}, ${y})`);
                        tasksExecuted++;
                        break;
                    case 'shape':
                        this.whiteboard.drawShape(task.params.type, x, y, w, h, task.params.color);
                        this.sharedContext?.logVisualAct(`Drew ${task.params.type} at (${x}, ${y}) size ${w}x${h}`);
                        tasksExecuted++;
                        break;
                    case 'image':
                        try {
                            console.log('🎨 VisualAgent: Generating image with prompt:', task.params.prompt);
                            let imageUrl: string;
                            try {
                                imageUrl = await this.minimax.generateImage(task.params.prompt);
                                console.log('✅ MiniMax image URL:', imageUrl?.substring(0, 80));
                            } catch (minimaxErr) {
                                console.warn('⚠️ MiniMax image failed, trying Runware fallback:', minimaxErr);
                                imageUrl = await this.runware.generateImage({
                                    prompt: task.params.prompt,
                                    width: w,
                                    height: h
                                });
                                console.log('✅ Runware fallback image URL:', imageUrl?.substring(0, 80));
                            }
                            if (imageUrl) {
                                this.whiteboard.drawImage(imageUrl, x, y, w, h);
                                this.sharedContext?.logVisualAct(`Generated image for "${task.params.prompt}" at (${x}, ${y})`);
                                tasksExecuted++;
                            } else {
                                console.error('❌ No image URL returned from any service');
                            }
                        } catch (imgErr: any) {
                            console.error('❌ VisualAgent: All image generation failed:', imgErr.message);
                            // Draw a text placeholder instead
                            this.whiteboard.drawText(`[Image: ${task.params.prompt}]`, x, y, '#ef4444', 16);
                            this.sharedContext?.logVisualAct(`Image generation failed for "${task.params.prompt}" - placed text placeholder`);
                            tasksExecuted++;
                        }
                        break;
                    case 'clear':
                        // Discourage auto-clear, but support if explicitly requested by lead
                        this.whiteboard.clear();
                        this.sharedContext?.logVisualAct("Cleared the whiteboard.");
                        tasksExecuted++;
                        break;
                }
            }

            // Step 3: Register new region and Focus Camera
            if (tasksExecuted > 0) {
                const newWidth = maxX - minX;
                const newHeight = maxY - minY;
                this.sharedContext?.registerRegion({ x: minX, y: minY, width: newWidth, height: newHeight });

                console.log(`🎨 Visual Agent: Directing camera to focus on (${minX}, ${minY}) size ${newWidth}x${newHeight}`);
                this.whiteboard.focusOnArea(minX, minY, newWidth, newHeight);
            }

            return `Visual Agent successfully added ${tasksExecuted} persistent items to the infinite board.`;
        } catch (error: any) {
            console.error('🎨 Visual Agent: Design or Execution failed:', error);
            return `Error in visual design: ${error.message}`;
        }
    }
}
