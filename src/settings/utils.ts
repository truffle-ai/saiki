import { UserSettings } from "./types.js";

const defaultSettings: UserSettings = {
    userId: 1,
    settings: {
        toolApprovalRequired: false,
    },
};

export function getDefaultUserSettings(): UserSettings {
    return defaultSettings;
}
