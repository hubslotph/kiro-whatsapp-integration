import { AppError, ErrorCategory, ErrorSeverity, ErrorResponse, WhatsAppErrorMessage } from '../types/error.types';
import { auditLogService } from './audit-log.service';

/**
 * Custom Application Error class
 */
export class ApplicationError extends Error implements AppError {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  details?: any;
  timestamp: Date;
  userMessage?: string;
  technicalMessage?: string;
  retryable: boolean;

  constructor(
    code: string,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    options?: {
      details?: any;
      userMessage?: string;
      technicalMessage?: string;
      retryable?: boolean;
    }
  ) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.timestamp = new Date();
    this.details = options?.details;
    this.userMessage = options?.userMessage;
    this.technicalMessage = options?.technicalMessage || message;
    this.retryable = options?.retryable ?? false;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Centralized Error Handler Service
 * Handles error categorization, logging, and user-friendly message translation
 */
export class ErrorHandlerService {
  /**
   * Handle an error and return a standardized AppError
   */
  handleError(error: unknown, context?: { userId?: string; operation?: string }): AppError {
    let appError: AppError;

    if (error instanceof ApplicationError) {
      appError = error;
    } else if (error instanceof Error) {
      appError = this.categorizeError(error);
    } else {
      appError = {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
        retryable: false,
      };
    }

    // Log error to database if userId is provided
    if (context?.userId) {
      this.logError(appError, context.userId, context.operation);
    }

    // Log to console for debugging
    this.logToConsole(appError, context);

    return appError;
  }

  /**
   * Categorize a generic error into an AppError
   */
  private categorizeError(error: Error): AppError {
    const message = error.message.toLowerCase();

    // Authentication errors
    if (
      message.includes('invalid verification code') ||
      message.includes('verification code') ||
      message.includes('expired code')
    ) {
      return {
        code: 'AUTH_INVALID_CODE',
        message: error.message,
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.LOW,
        timestamp: new Date(),
        userMessage: 'Invalid or expired verification code. Please request a new code.',
        retryable: true,
      };
    }

    if (
      message.includes('session expired') ||
      message.includes('invalid session') ||
      message.includes('session not found')
    ) {
      return {
        code: 'AUTH_SESSION_EXPIRED',
        message: error.message,
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
        userMessage: 'Your session has expired. Please authenticate again.',
        retryable: false,
      };
    }

    if (message.includes('unauthorized') || message.includes('not authenticated')) {
      return {
        code: 'AUTH_UNAUTHORIZED',
        message: error.message,
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
        userMessage: 'You are not authorized to perform this action.',
        retryable: false,
      };
    }

    // Command errors
    if (message.includes('file not found') || message.includes('enoent')) {
      return {
        code: 'CMD_FILE_NOT_FOUND',
        message: error.message,
        category: ErrorCategory.COMMAND,
        severity: ErrorSeverity.LOW,
        timestamp: new Date(),
        userMessage: 'The requested file was not found. Please check the file path.',
        retryable: false,
      };
    }

    if (message.includes('permission denied') || message.includes('access denied')) {
      return {
        code: 'CMD_PERMISSION_DENIED',
        message: error.message,
        category: ErrorCategory.PERMISSION,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
        userMessage: 'You do not have permission to access this resource.',
        retryable: false,
      };
    }

    if (message.includes('invalid command') || message.includes('unknown command')) {
      return {
        code: 'CMD_INVALID',
        message: error.message,
        category: ErrorCategory.COMMAND,
        severity: ErrorSeverity.LOW,
        timestamp: new Date(),
        userMessage: 'Invalid command. Type "help" to see available commands.',
        retryable: false,
      };
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        code: 'CMD_TIMEOUT',
        message: error.message,
        category: ErrorCategory.COMMAND,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
        userMessage: 'Command execution timed out. Please try again.',
        retryable: true,
      };
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return {
        code: 'VALIDATION_ERROR',
        message: error.message,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        timestamp: new Date(),
        userMessage: error.message,
        retryable: false,
      };
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('etimedout')
    ) {
      return {
        code: 'NETWORK_ERROR',
        message: error.message,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        timestamp: new Date(),
        userMessage: 'Network error occurred. Please try again in a moment.',
        retryable: true,
      };
    }

    // Database errors
    if (
      message.includes('database') ||
      message.includes('prisma') ||
      message.includes('connection') ||
      message.includes('query')
    ) {
      return {
        code: 'DATABASE_ERROR',
        message: error.message,
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.HIGH,
        timestamp: new Date(),
        userMessage: 'A database error occurred. Please try again later.',
        retryable: true,
      };
    }

    // Workspace errors
    if (message.includes('workspace not connected') || message.includes('workspace')) {
      return {
        code: 'SYSTEM_WORKSPACE_DISCONNECTED',
        message: error.message,
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        timestamp: new Date(),
        userMessage: 'Workspace is not connected. Please ensure the Kiro extension is running.',
        retryable: true,
      };
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return {
        code: 'SYSTEM_RATE_LIMIT',
        message: error.message,
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
        userMessage: 'Too many requests. Please wait a moment before trying again.',
        retryable: true,
      };
    }

    // Default system error
    return {
      code: 'SYSTEM_ERROR',
      message: error.message,
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.MEDIUM,
      timestamp: new Date(),
      userMessage: 'An unexpected error occurred. Please try again.',
      retryable: true,
    };
  }

  /**
   * Translate error to user-friendly message
   */
  translateErrorMessage(error: AppError): string {
    return error.userMessage || error.message;
  }

  /**
   * Format error for WhatsApp display
   */
  formatForWhatsApp(error: AppError, includeHelp: boolean = true): WhatsAppErrorMessage {
    const userMessage = this.translateErrorMessage(error);
    
    let text = `❌ *Error*\n\n${userMessage}`;

    // Add retry suggestion for retryable errors
    if (error.retryable) {
      text += '\n\n💡 This error may be temporary. Please try again.';
    }

    // Add help suggestion for command errors
    if (includeHelp && error.category === ErrorCategory.COMMAND) {
      text += '\n\nType "help" for available commands.';
    }

    return {
      text,
      includeHelp,
    };
  }

  /**
   * Format error for API response
   */
  formatForAPI(error: AppError): ErrorResponse {
    return {
      success: false,
      error: {
        code: error.code,
        message: this.translateErrorMessage(error),
        details: error.details,
      },
      timestamp: error.timestamp.toISOString(),
    };
  }

  /**
   * Log error to database
   */
  private async logError(error: AppError, userId: string, operation?: string): Promise<void> {
    try {
      await auditLogService.createAuditLog({
        userId,
        commandType: operation || 'ERROR',
        commandPayload: {
          code: error.code,
          category: error.category,
          severity: error.severity,
          details: error.details,
        },
        status: 'FAILURE',
        errorMessage: error.technicalMessage || error.message,
      });
    } catch (logError) {
      // Don't throw - logging errors should not break the main flow
      console.error('Failed to log error to database:', logError);
    }
  }

  /**
   * Log error to console
   */
  private logToConsole(error: AppError, context?: { userId?: string; operation?: string }): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = [
      `[${error.category}] ${error.code}: ${error.message}`,
      context?.userId ? `User: ${context.userId}` : null,
      context?.operation ? `Operation: ${context.operation}` : null,
      error.details ? `Details: ${JSON.stringify(error.details)}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    console[logLevel](logMessage);
  }

  /**
   * Get console log level based on error severity
   */
  private getLogLevel(severity: ErrorSeverity): 'log' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'log';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error';
      default:
        return 'log';
    }
  }

  /**
   * Create a custom application error
   */
  createError(
    code: string,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    options?: {
      details?: any;
      userMessage?: string;
      technicalMessage?: string;
      retryable?: boolean;
    }
  ): ApplicationError {
    return new ApplicationError(code, message, category, severity, options);
  }

  /**
   * Check if an error is retryable
   */
  isRetryable(error: unknown): boolean {
    if (error instanceof ApplicationError) {
      return error.retryable;
    }
    
    const appError = this.handleError(error);
    return appError.retryable;
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandlerService();

// Export convenience functions
export const handleError = (error: unknown, context?: { userId?: string; operation?: string }) =>
  errorHandler.handleError(error, context);

export const formatErrorForWhatsApp = (error: AppError, includeHelp?: boolean) =>
  errorHandler.formatForWhatsApp(error, includeHelp);

export const formatErrorForAPI = (error: AppError) => errorHandler.formatForAPI(error);

export const createError = (
  code: string,
  message: string,
  category: ErrorCategory,
  severity?: ErrorSeverity,
  options?: any
) => errorHandler.createError(code, message, category, severity, options);
