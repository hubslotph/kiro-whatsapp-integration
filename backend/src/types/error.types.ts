/**
 * Error types and interfaces for centralized error handling
 */

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  COMMAND = 'COMMAND',
  SYSTEM = 'SYSTEM',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Base application error interface
 */
export interface AppError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  details?: any;
  timestamp: Date;
  userMessage?: string;
  technicalMessage?: string;
  retryable: boolean;
}

/**
 * Error response format for API responses
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

/**
 * WhatsApp formatted error message
 */
export interface WhatsAppErrorMessage {
  text: string;
  includeHelp: boolean;
}
