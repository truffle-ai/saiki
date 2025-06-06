import { SettingsProvider, UserSettings } from './types.js';
import { getDefaultUserSettings } from './utils.js';

export class InMemorySettingsProvider implements SettingsProvider {
    private userSettings: UserSettings = getDefaultUserSettings();

    async getUserSettings(userId?: string): Promise<UserSettings> {
        return this.userSettings;
    }

    async updateUserSettings(userId: string, settings: UserSettings): Promise<void> {
        this.userSettings = settings;
    }
}
