export interface CanvasRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface AgentSharedState {
    lastBoardAnalysis: string;
    lastResearchSummary: string;
    currentEducationalGoal: string;
    sessionStartTime: number;
    occupiedRegions: CanvasRegion[];
    visualHistory: string[];
}

export class SharedAgentContext {
    private state: AgentSharedState = {
        lastBoardAnalysis: "The whiteboard is currently empty.",
        lastResearchSummary: "No research has been conducted yet.",
        currentEducationalGoal: "General Tutoring",
        sessionStartTime: Date.now(),
        occupiedRegions: [],
        visualHistory: []
    };

    updateBoardAnalysis(analysis: string) {
        this.state.lastBoardAnalysis = analysis;
    }

    logVisualAct(description: string) {
        this.state.visualHistory.push(`[${new Date().toLocaleTimeString()}] ${description}`);
        // Keep only top 10 relevant visual acts
        if (this.state.visualHistory.length > 10) {
            this.state.visualHistory.shift();
        }
    }

    updateResearchSummary(summary: string) {
        this.state.lastResearchSummary = summary;
    }

    updateGoal(goal: string) {
        this.state.currentEducationalGoal = goal;
    }

    registerRegion(region: CanvasRegion) {
        this.state.occupiedRegions.push(region);
    }

    getOccupiedBounds(): CanvasRegion {
        if (this.state.occupiedRegions.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.state.occupiedRegions.forEach(r => {
            minX = Math.min(minX, r.x);
            minY = Math.min(minY, r.y);
            maxX = Math.max(maxX, r.x + r.width);
            maxY = Math.max(maxY, r.y + r.height);
        });
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    getSnapshot(): string {
        const bounds = this.getOccupiedBounds();
        const historyText = this.state.visualHistory.length > 0
            ? this.state.visualHistory.join('\n- ')
            : "No items drawn yet.";

        return `
        [SESSION CONTEXT]
        - Goal: ${this.state.currentEducationalGoal}
        - Board Analysis (Vision): ${this.state.lastBoardAnalysis}
        - Recent Board Additions:
        - ${historyText}
        - Research Context: ${this.state.lastResearchSummary}
        - Active Area (Bounds): x:${bounds.x}, y:${bounds.y}, w:${bounds.width}, h:${bounds.height}
        `;
    }

    getState(): AgentSharedState {
        return { ...this.state };
    }
}
