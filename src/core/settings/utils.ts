import { UserSettings } from './types.js';

const defaultSettings: UserSettings = {
    toolApprovalRequired: false,
};

export function getDefaultUserSettings(): UserSettings {
    return defaultSettings;
}
