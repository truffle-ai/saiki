import { SettingsProvider, UserSettings } from "../types.js";
import { settings } from "./settings/settings.js";

export class FileSettingsProvider implements SettingsProvider {
    private settings: UserSettings = settings;

    async getUserSettings(userId?: string): Promise<UserSettings> {
        return this.settings;
    }

    async updateUserSettings(userId: string, settings: UserSettings): Promise<void> {
        // TODO: write to file
    }
}
