/**
 * Interface for user settings
 * We can add more settings here that are user-specific
 */
export interface UserSettings {
    toolApprovalRequired: boolean;
}

/**
 * Interface for settings provider
 * Possible implementations:
 * - In-memory settings provider
 * - File-based settings provider
 * - Database-based settings provider
 */
export interface SettingsProvider {
    getUserSettings(userId?: string): Promise<UserSettings>;
    updateUserSettings(userId: string, settings: UserSettings): Promise<void>;
}
