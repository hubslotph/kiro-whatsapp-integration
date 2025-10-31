/**
 * Circuit Breaker Service
 * Implements circuit breaker pattern to prevent cascading failures
 */

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before opening circuit
  successThreshold?: number; // Number of successes in half-open before closing
  timeout?: number; // Time in ms to wait before attempting half-open
  resetTimeout?: number; // Time in ms to reset failure count
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
  onCircuitOpen?: () => void;
  onCircuitClose?: () => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

const DEFAULT_OPTIONS: Required<Omit<CircuitBreakerOptions, 'onStateChange' | 'onCircuitOpen' | 'onCircuitClose'>> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  resetTimeout: 300000, // 5 minutes
};

/**
 * Circuit Breaker class
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private resetTimer?: NodeJS.Timeout;

  private readonly options: Required<Omit<CircuitBreakerOptions, 'onStateChange' | 'onCircuitOpen' | 'onCircuitClose'>>;
  private readonly onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
  private readonly onCircuitOpen?: () => void;
  private readonly onCircuitClose?: () => void;

  constructor(private readonly name: string, options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? DEFAULT_OPTIONS.failureThreshold,
      successThreshold: options.successThreshold ?? DEFAULT_OPTIONS.successThreshold,
      timeout: options.timeout ?? DEFAULT_OPTIONS.timeout,
      resetTimeout: options.resetTimeout ?? DEFAULT_OPTIONS.resetTimeout,
    };
    this.onStateChange = options.onStateChange;
    this.onCircuitOpen = options.onCircuitOpen;
    this.onCircuitClose = options.onCircuitClose;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttemptTime && new Date() < this.nextAttemptTime) {
        throw new Error(
          `Circuit breaker "${this.name}" is OPEN. Service unavailable. Try again later.`
        );
      }
      // Transition to half-open to test the service
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = new Date();
    this.totalSuccesses++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      console.log(
        `[CircuitBreaker:${this.name}] Success in HALF_OPEN state (${this.successCount}/${this.options.successThreshold})`
      );

      if (this.successCount >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.reset();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0;
      this.clearResetTimer();
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.lastFailureTime = new Date();
    this.totalFailures++;
    this.failureCount++;

    console.warn(
      `[CircuitBreaker:${this.name}] Failure recorded (${this.failureCount}/${this.options.failureThreshold})`
    );

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state reopens the circuit
      this.transitionTo(CircuitState.OPEN);
      this.scheduleNextAttempt();
    } else if (
      this.state === CircuitState.CLOSED &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.transitionTo(CircuitState.OPEN);
      this.scheduleNextAttempt();
    } else {
      // Schedule reset of failure count
      this.scheduleReset();
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) {
      return;
    }

    const oldState = this.state;
    this.state = newState;

    console.log(`[CircuitBreaker:${this.name}] State transition: ${oldState} -> ${newState}`);

    // Call state change callback
    if (this.onStateChange) {
      try {
        this.onStateChange(oldState, newState);
      } catch (error) {
        console.error('Error in onStateChange callback:', error);
      }
    }

    // Call specific callbacks
    if (newState === CircuitState.OPEN && this.onCircuitOpen) {
      try {
        this.onCircuitOpen();
      } catch (error) {
        console.error('Error in onCircuitOpen callback:', error);
      }
    } else if (newState === CircuitState.CLOSED && this.onCircuitClose) {
      try {
        this.onCircuitClose();
      } catch (error) {
        console.error('Error in onCircuitClose callback:', error);
      }
    }
  }

  /**
   * Schedule next attempt time when circuit is open
   */
  private scheduleNextAttempt(): void {
    this.nextAttemptTime = new Date(Date.now() + this.options.timeout);
    console.log(
      `[CircuitBreaker:${this.name}] Next attempt scheduled at ${this.nextAttemptTime.toISOString()}`
    );
  }

  /**
   * Schedule reset of failure count
   */
  private scheduleReset(): void {
    this.clearResetTimer();
    this.resetTimer = setTimeout(() => {
      console.log(`[CircuitBreaker:${this.name}] Resetting failure count`);
      this.failureCount = 0;
    }, this.options.resetTimeout);
  }

  /**
   * Clear reset timer
   */
  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }

  /**
   * Reset circuit breaker to initial state
   */
  private reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = undefined;
    this.clearResetTimer();
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Manually open the circuit
   */
  open(): void {
    this.transitionTo(CircuitState.OPEN);
    this.scheduleNextAttempt();
  }

  /**
   * Manually close the circuit
   */
  close(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.reset();
  }

  /**
   * Get fallback response when circuit is open
   */
  getFallbackResponse<T>(fallback: T): T {
    if (this.state === CircuitState.OPEN) {
      console.log(`[CircuitBreaker:${this.name}] Returning fallback response`);
      return fallback;
    }
    throw new Error('Circuit is not open');
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  getBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Execute function with circuit breaker
   */
  async execute<T>(
    name: string,
    fn: () => Promise<T>,
    options?: CircuitBreakerOptions
  ): Promise<T> {
    const breaker = this.getBreaker(name, options);
    return breaker.execute(fn);
  }

  /**
   * Execute function with circuit breaker and fallback
   */
  async executeWithFallback<T>(
    name: string,
    fn: () => Promise<T>,
    fallback: T,
    options?: CircuitBreakerOptions
  ): Promise<T> {
    const breaker = this.getBreaker(name, options);
    
    try {
      return await breaker.execute(fn);
    } catch (error) {
      if (breaker.isOpen()) {
        console.log(`[CircuitBreakerManager] Using fallback for "${name}"`);
        return fallback;
      }
      throw error;
    }
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Map<string, CircuitBreakerStats> {
    const stats = new Map<string, CircuitBreakerStats>();
    this.breakers.forEach((breaker, name) => {
      stats.set(name, breaker.getStats());
    });
    return stats;
  }

  /**
   * Get statistics for a specific circuit breaker
   */
  getStats(name: string): CircuitBreakerStats | undefined {
    const breaker = this.breakers.get(name);
    return breaker?.getStats();
  }

  /**
   * Remove a circuit breaker
   */
  removeBreaker(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.breakers.clear();
  }
}

// Export singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();

// Export convenience functions
export const executeWithCircuitBreaker = <T>(
  name: string,
  fn: () => Promise<T>,
  options?: CircuitBreakerOptions
) => circuitBreakerManager.execute(name, fn, options);

export const executeWithFallback = <T>(
  name: string,
  fn: () => Promise<T>,
  fallback: T,
  options?: CircuitBreakerOptions
) => circuitBreakerManager.executeWithFallback(name, fn, fallback, options);
