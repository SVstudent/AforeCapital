import { AIContextContent } from '../components/tutor/AIContextWindow';

export interface ContextWindowSettings {
    id?: string;
    user_id: string;
    x_position: number;
    y_position: number;
    is_minimized: boolean;
    is_visible: boolean;
    auto_show_enabled: boolean;
    transparency_level: number;
    last_shown_content: AIContextContent | null;
}

const STORAGE_KEY = 'lumina_context_window_settings';

export class ContextWindowService {
    private getLocalSettings(): Record<string, ContextWindowSettings> {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.error('Error reading settings from localStorage:', e);
            return {};
        }
    }

    private saveLocalSettings(allSettings: Record<string, ContextWindowSettings>) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(allSettings));
        } catch (e) {
            console.error('Error saving settings to localStorage:', e);
        }
    }

    async getSettings(userId: string): Promise<ContextWindowSettings | null> {
        const allSettings = this.getLocalSettings();
        return allSettings[userId] || null;
    }

    async createSettings(settings: Omit<ContextWindowSettings, 'id'>): Promise<ContextWindowSettings | null> {
        const allSettings = this.getLocalSettings();
        const newSettings = {
            ...settings,
            id: Math.random().toString(36).substring(7)
        };
        allSettings[settings.user_id] = newSettings;
        this.saveLocalSettings(allSettings);
        return newSettings;
    }

    async updateSettings(userId: string, updates: Partial<ContextWindowSettings>): Promise<boolean> {
        const allSettings = this.getLocalSettings();
        if (!allSettings[userId]) return false;

        allSettings[userId] = {
            ...allSettings[userId],
            ...updates
        };
        this.saveLocalSettings(allSettings);
        return true;
    }

    async updatePosition(userId: string, x: number, y: number): Promise<boolean> {
        return this.updateSettings(userId, { x_position: x, y_position: y });
    }

    async updateVisibility(userId: string, isVisible: boolean): Promise<boolean> {
        return this.updateSettings(userId, { is_visible: isVisible });
    }

    async updateMinimized(userId: string, isMinimized: boolean): Promise<boolean> {
        return this.updateSettings(userId, { is_minimized: isMinimized });
    }

    async updateContent(userId: string, content: AIContextContent | null): Promise<boolean> {
        return this.updateSettings(userId, { last_shown_content: content });
    }

    async getOrCreateSettings(userId: string): Promise<ContextWindowSettings> {
        let settings = await this.getSettings(userId);

        if (!settings) {
            const newSettings: Omit<ContextWindowSettings, 'id'> = {
                user_id: userId,
                x_position: 40,
                y_position: 140,
                is_minimized: true,
                is_visible: false,
                auto_show_enabled: true,
                transparency_level: 1.0,
                last_shown_content: null,
            };

            const created = await this.createSettings(newSettings);
            return created || (newSettings as ContextWindowSettings);
        }

        return settings;
    }
}
