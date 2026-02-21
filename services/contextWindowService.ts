import { supabase } from '../lib/supabase';
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
    async getSettings(userId: string): Promise<ContextWindowSettings | null> {
        const { data, error } = await supabase
            .from('context_window_settings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching context window settings:', error);
            return null;
        }

        if (!data) {
            return null;
        }

        return {
            id: data.id,
            user_id: data.user_id,
            x_position: data.x_position,
            y_position: data.y_position,
            is_minimized: data.is_minimized,
            is_visible: data.is_visible,
            auto_show_enabled: data.auto_show_enabled,
            transparency_level: data.transparency_level,
            last_shown_content: data.last_shown_content as AIContextContent | null,
        };
    }

    async createSettings(settings: Omit<ContextWindowSettings, 'id'>): Promise<ContextWindowSettings | null> {
        const { data, error } = await supabase
            .from('context_window_settings')
            .insert([
                {
                    user_id: settings.user_id,
                    x_position: settings.x_position,
                    y_position: settings.y_position,
                    is_minimized: settings.is_minimized,
                    is_visible: settings.is_visible,
                    auto_show_enabled: settings.auto_show_enabled,
                    transparency_level: settings.transparency_level,
                    last_shown_content: settings.last_shown_content,
                },
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating context window settings:', error);
            return null;
        }

        return {
            id: data.id,
            user_id: data.user_id,
            x_position: data.x_position,
            y_position: data.y_position,
            is_minimized: data.is_minimized,
            is_visible: data.is_visible,
            auto_show_enabled: data.auto_show_enabled,
            transparency_level: data.transparency_level,
            last_shown_content: data.last_shown_content as AIContextContent | null,
        };
    }

    async updateSettings(userId: string, updates: Partial<ContextWindowSettings>): Promise<boolean> {
        const { error } = await supabase
            .from('context_window_settings')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

        if (error) {
            console.error('Error updating context window settings:', error);
            return false;
        }

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

            settings = await this.createSettings(newSettings);

            if (!settings) {
                return newSettings as ContextWindowSettings;
            }
        }

        return settings;
    }
}
