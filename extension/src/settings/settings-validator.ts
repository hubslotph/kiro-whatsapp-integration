import { SettingsData } from './settings-panel';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Settings validator
 */
export class SettingsValidator {
  /**
   * Validate settings data
   */
  public static validate(settings: SettingsData): ValidationResult {
    const errors: string[] = [];

    // Validate notification types
    if (settings.notificationEnabled && settings.notificationTypes.length === 0) {
      errors.push('At least one notification type must be selected when notifications are enabled');
    }

    // Validate notification types are valid
    const validTypes = ['BUILD_COMPLETE', 'ERROR', 'GIT_OPERATION', 'FILE_CHANGED'];
    for (const type of settings.notificationTypes) {
      if (!validTypes.includes(type)) {
        errors.push(`Invalid notification type: ${type}`);
      }
    }

    // Validate accessible directories
    for (const dir of settings.accessibleDirectories) {
      if (!dir || dir.trim() === '') {
        errors.push('Directory paths cannot be empty');
        break;
      }

      // Check for invalid characters
      if (dir.includes('..')) {
        errors.push('Directory paths cannot contain ".." (parent directory references)');
        break;
      }

      // Check for absolute paths (should be relative)
      if (dir.startsWith('/') || /^[A-Za-z]:/.test(dir)) {
        errors.push('Directory paths should be relative to workspace root');
        break;
      }
    }

    // Check for duplicate directories
    const uniqueDirs = new Set(settings.accessibleDirectories);
    if (uniqueDirs.size !== settings.accessibleDirectories.length) {
      errors.push('Duplicate directories are not allowed');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitize settings data
   */
  public static sanitize(settings: SettingsData): SettingsData {
    return {
      notificationEnabled: Boolean(settings.notificationEnabled),
      notificationTypes: settings.notificationTypes.filter((type) =>
        ['BUILD_COMPLETE', 'ERROR', 'GIT_OPERATION', 'FILE_CHANGED'].includes(type)
      ),
      accessibleDirectories: settings.accessibleDirectories
        .map((dir) => dir.trim())
        .filter((dir) => dir !== '' && !dir.includes('..'))
        .filter((dir, index, self) => self.indexOf(dir) === index), // Remove duplicates
      readOnlyMode: Boolean(settings.readOnlyMode),
    };
  }
}
