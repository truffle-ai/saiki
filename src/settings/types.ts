/**
 * Interface for user settings
 * TODO: This is a placeholder and should be replaced with a proper schema
 */
export interface UserSettings {
    userId?: number,
    settings: {
        [key: string]: any;
    };
}

/**
 * Interface for settings provider
 */
export interface SettingsProvider {
    getUserSettings(userId?: string): Promise<UserSettings>;
    updateUserSettings(userId: string, settings: UserSettings): Promise<void>;
}