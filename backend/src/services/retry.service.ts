/**
 * Retry Service
 * Implements retry logic for transient failures with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'retryableErrors'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Retry Service class
 */
export class RetryService {
  /**
   * Execute a function with retry logic
   * @param fn - The async function to execute
   * @param options - Retry options
   * @returns RetryResult with success status and data or error
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const {
      maxAttempts = DEFAULT_OPTIONS.maxAttempts,
      initialDelayMs = DEFAULT_OPTIONS.initialDelayMs,
      maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
      backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
      retryableErrors,
      onRetry,
    } = options;

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        const result = await fn();
        
        if (attempt > 1) {
          console.log(`Operation succeeded on attempt ${attempt}/${maxAttempts}`);
        }

        return {
          success: true,
          data: result,
          attempts: attempt,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Check if error is retryable
        if (retryableErrors && !this.isRetryableError(lastError, retryableErrors)) {
          console.log(`Non-retryable error encountered: ${lastError.message}`);
          return {
            success: false,
            error: lastError,
            attempts: attempt,
          };
        }

        console.warn(
          `Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`
        );

        // Call onRetry callback if provided
        if (onRetry) {
          try {
            onRetry(attempt, lastError);
          } catch (callbackError) {
            console.error('Error in onRetry callback:', callbackError);
          }
        }

        // Don't wait after the last attempt
        if (attempt < maxAttempts) {
          const delay = this.calculateDelay(
            attempt,
            initialDelayMs,
            maxDelayMs,
            backoffMultiplier
          );
          console.log(`Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    console.error(
      `Operation failed after ${maxAttempts} attempts: ${lastError?.message}`
    );

    return {
      success: false,
      error: lastError,
      attempts: maxAttempts,
    };
  }

  /**
   * Check if an error is retryable based on error message patterns
   */
  private isRetryableError(error: Error, retryablePatterns: string[]): boolean {
    const errorMessage = error.message.toLowerCase();
    return retryablePatterns.some((pattern) =>
      errorMessage.includes(pattern.toLowerCase())
    );
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(
    attempt: number,
    initialDelayMs: number,
    maxDelayMs: number,
    backoffMultiplier: number
  ): number {
    const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
    return Math.min(delay, maxDelayMs);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry a function with default options
   */
  async retry<T>(fn: () => Promise<T>, maxAttempts: number = 3): Promise<T> {
    const result = await this.executeWithRetry(fn, { maxAttempts });
    
    if (!result.success) {
      throw result.error || new Error('Operation failed after retries');
    }
    
    return result.data as T;
  }
}

// Export singleton instance
export const retryService = new RetryService();

// Export convenience function
export const executeWithRetry = <T>(fn: () => Promise<T>, options?: RetryOptions) =>
  retryService.executeWithRetry(fn, options);

export const retry = <T>(fn: () => Promise<T>, maxAttempts?: number) =>
  retryService.retry(fn, maxAttempts);
