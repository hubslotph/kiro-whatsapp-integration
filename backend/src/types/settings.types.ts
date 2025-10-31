/**
 * Settings-related types
 */

/**
 * User settings data structure
 */
export interface UserSettings {
  id: string;
  userId: string;
  notificationEnabled: boolean;
  notificationTypes: string[];
  accessibleDirectories: string[];
  readOnlyMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Settings update request
 */
export interface UpdateSettingsRequest {
  notificationEnabled?: boolean;
  notificationTypes?: string[];
  accessibleDirectories?: string[];
  readOnlyMode?: boolean;
}

/**
 * Settings change event
 */
export interface SettingsChangeEvent {
  userId: string;
  previousSettings: UserSettings;
  newSettings: UserSettings;
  changedFields: string[];
  timestamp: Date;
}
