import {
  Command,
  CommandType,
  FileReadCommand,
  FileListCommand,
  SearchCommand,
} from '../types/command.types';
import {
  ValidationResult,
  ValidationErrors,
} from '../types/validation.types';

/**
 * Validation configuration
 */
const VALIDATION_CONFIG = {
  PATH_MAX_LENGTH: 500,
  QUERY_MIN_LENGTH: 2,
  QUERY_MAX_LENGTH: 200,
  PATTERN_MAX_LENGTH: 200,
};

/**
 * Command Validator Service
 * Validates parsed commands against business rules
 */
export class CommandValidatorService {
  /**
   * Validate a command
   * @param command - The parsed command to validate
   * @returns ValidationResult with validation status and errors
   */
  validate(command: Command): ValidationResult {
    const errors: string[] = [];

    switch (command.type) {
      case CommandType.FILE_READ:
        this.validateFileReadCommand(command, errors);
        break;

      case CommandType.FILE_LIST:
        this.validateFileListCommand(command, errors);
        break;

      case CommandType.SEARCH:
        this.validateSearchCommand(command, errors);
        break;

      case CommandType.STATUS:
      case CommandType.HELP:
        // No validation needed for these commands
        break;

      default:
        errors.push(ValidationErrors.UNKNOWN_COMMAND_TYPE);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate FILE_READ command
   */
  private validateFileReadCommand(
    command: FileReadCommand,
    errors: string[]
  ): void {
    this.validatePath(command.path, errors);
  }

  /**
   * Validate FILE_LIST command
   */
  private validateFileListCommand(
    command: FileListCommand,
    errors: string[]
  ): void {
    if (!command.directory) {
      errors.push(ValidationErrors.DIRECTORY_REQUIRED);
      return;
    }

    this.validatePath(command.directory, errors, true);
  }

  /**
   * Validate SEARCH command
   */
  private validateSearchCommand(
    command: SearchCommand,
    errors: string[]
  ): void {
    // Validate query
    if (!command.query) {
      errors.push(ValidationErrors.QUERY_REQUIRED);
    } else {
      if (command.query.length < VALIDATION_CONFIG.QUERY_MIN_LENGTH) {
        errors.push(ValidationErrors.QUERY_TOO_SHORT);
      }
      if (command.query.length > VALIDATION_CONFIG.QUERY_MAX_LENGTH) {
        errors.push(ValidationErrors.QUERY_TOO_LONG);
      }
    }

    // Validate pattern if provided
    if (command.pattern) {
      if (command.pattern.length > VALIDATION_CONFIG.PATTERN_MAX_LENGTH) {
        errors.push(ValidationErrors.PATTERN_TOO_LONG);
      }

      // Try to validate regex pattern
      try {
        new RegExp(command.pattern);
      } catch (e) {
        errors.push(ValidationErrors.INVALID_PATTERN);
      }
    }
  }

  /**
   * Validate file/directory path
   * @param path - The path to validate
   * @param errors - Array to collect errors
   * @param isDirectory - Whether this is a directory path
   */
  private validatePath(
    path: string,
    errors: string[],
    isDirectory: boolean = false
  ): void {
    if (!path) {
      errors.push(
        isDirectory
          ? ValidationErrors.DIRECTORY_REQUIRED
          : ValidationErrors.PATH_REQUIRED
      );
      return;
    }

    // Check path length
    if (path.length > VALIDATION_CONFIG.PATH_MAX_LENGTH) {
      errors.push(ValidationErrors.PATH_TOO_LONG);
    }

    // Check for absolute paths (security concern)
    // Windows: C:\, D:\, etc. or \\network\path
    // Unix: /path
    if (this.isAbsolutePath(path)) {
      errors.push(ValidationErrors.ABSOLUTE_PATH_NOT_ALLOWED);
    }

    // Check for path traversal attempts
    if (this.hasPathTraversal(path)) {
      errors.push(ValidationErrors.PATH_TRAVERSAL_DETECTED);
    }

    // Validate path format (no invalid characters)
    if (!this.isValidPathFormat(path)) {
      errors.push(
        isDirectory
          ? ValidationErrors.INVALID_DIRECTORY_FORMAT
          : ValidationErrors.INVALID_PATH_FORMAT
      );
    }
  }

  /**
   * Check if path is absolute
   */
  private isAbsolutePath(path: string): boolean {
    // Windows absolute paths: C:\, D:\, \\network
    if (/^[a-zA-Z]:[\\\/]/.test(path) || /^\\\\/.test(path)) {
      return true;
    }

    // Unix absolute paths: /path
    if (path.startsWith('/')) {
      return true;
    }

    return false;
  }

  /**
   * Check for path traversal attempts
   */
  private hasPathTraversal(path: string): boolean {
    // Check for ../ or ..\\ patterns
    return /\.\.[\\/]/.test(path) || path.includes('..');
  }

  /**
   * Validate path format (check for invalid characters)
   */
  private isValidPathFormat(path: string): boolean {
    // Disallow control characters and other dangerous characters
    // Allow: alphanumeric, spaces, dots, hyphens, underscores, forward/back slashes
    const invalidChars = /[<>:"|?*\x00-\x1F]/;
    return !invalidChars.test(path);
  }
}
