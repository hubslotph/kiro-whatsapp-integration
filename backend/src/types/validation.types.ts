/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validation error messages
 */
export const ValidationErrors = {
  // File path validation
  INVALID_PATH_FORMAT: 'Invalid path format',
  PATH_REQUIRED: 'File path is required',
  PATH_TOO_LONG: 'Path exceeds maximum length of 500 characters',
  ABSOLUTE_PATH_NOT_ALLOWED: 'Absolute paths are not allowed for security reasons',
  PATH_TRAVERSAL_DETECTED: 'Path traversal detected (../ is not allowed)',
  
  // Directory validation
  DIRECTORY_REQUIRED: 'Directory path is required',
  INVALID_DIRECTORY_FORMAT: 'Invalid directory format',
  
  // Search validation
  QUERY_REQUIRED: 'Search query is required',
  QUERY_TOO_SHORT: 'Search query must be at least 2 characters',
  QUERY_TOO_LONG: 'Search query exceeds maximum length of 200 characters',
  INVALID_PATTERN: 'Invalid regex pattern',
  PATTERN_TOO_LONG: 'Pattern exceeds maximum length of 200 characters',
  
  // General
  UNKNOWN_COMMAND_TYPE: 'Unknown command type',
} as const;
