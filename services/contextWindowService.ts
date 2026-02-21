import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
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

export class ContextWindowService {
    private client: ConvexHttpClient;

    constructor() {
        const convexUrl = import.meta.env.VITE_CONVEX_URL || '';
        this.client = new ConvexHttpClient(convexUrl);
    }

    async getSettings(userId: string): Promise<ContextWindowSettings | null> {
        try {
            const data = await this.client.query(api.contextWindowSettings.get, { userId });
            if (!data) return null;

            return {
                id: data._id,
                user_id: data.userId,
                x_position: data.xPosition,
                y_position: data.yPosition,
                is_minimized: data.isMinimized,
                is_visible: data.isVisible,
                auto_show_enabled: data.autoShowEnabled,
                transparency_level: data.transparencyLevel,
                last_shown_content: data.lastShownContent as AIContextContent | null,
            };
        } catch (error) {
            console.error('Error fetching context window settings:', error);
            return null;
        }
    }

    async createSettings(settings: Omit<ContextWindowSettings, 'id'>): Promise<ContextWindowSettings | null> {
        try {
            const data = await this.client.mutation(api.contextWindowSettings.create, {
                userId: settings.user_id,
                xPosition: settings.x_position,
                yPosition: settings.y_position,
                isMinimized: settings.is_minimized,
                isVisible: settings.is_visible,
                autoShowEnabled: settings.auto_show_enabled,
                transparencyLevel: settings.transparency_level,
                lastShownContent: settings.last_shown_content,
            });

            if (!data) return null;

            return {
                id: data._id,
                user_id: data.userId,
                x_position: data.xPosition,
                y_position: data.yPosition,
                is_minimized: data.isMinimized,
                is_visible: data.isVisible,
                auto_show_enabled: data.autoShowEnabled,
                transparency_level: data.transparencyLevel,
                last_shown_content: data.lastShownContent as AIContextContent | null,
            };
        } catch (error) {
            console.error('Error creating context window settings:', error);
            return null;
        }
    }

    async updateSettings(userId: string, updates: Partial<ContextWindowSettings>): Promise<boolean> {
        try {
            const convexUpdates: Record<string, any> = { userId };
            if (updates.x_position !== undefined) convexUpdates.xPosition = updates.x_position;
            if (updates.y_position !== undefined) convexUpdates.yPosition = updates.y_position;
            if (updates.is_minimized !== undefined) convexUpdates.isMinimized = updates.is_minimized;
            if (updates.is_visible !== undefined) convexUpdates.isVisible = updates.is_visible;
            if (updates.auto_show_enabled !== undefined) convexUpdates.autoShowEnabled = updates.auto_show_enabled;
            if (updates.transparency_level !== undefined) convexUpdates.transparencyLevel = updates.transparency_level;
            if (updates.last_shown_content !== undefined) convexUpdates.lastShownContent = updates.last_shown_content;

            await this.client.mutation(api.contextWindowSettings.update, convexUpdates as any);
            return true;
        } catch (error) {
            console.error('Error updating context window settings:', error);
            return false;
        }
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

            settings = await this.createSettings(newSettings);

            if (!settings) {
                return newSettings as ContextWindowSettings;
            }
        }

        return settings;
    }
}
