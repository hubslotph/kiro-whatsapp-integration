# Error Handling and Recovery System

This document describes the centralized error handling and recovery system implemented for the Kiro WhatsApp Integration.

## Overview

The error handling system provides:
- **Centralized error categorization and handling**
- **User-friendly error message translation**
- **Automatic retry logic for transient failures**
- **Circuit breaker pattern for external service protection**
- **Comprehensive error logging and auditing**

## Components

### 1. Error Handler Service (`error-handler.service.ts`)

The centralized error handler categorizes errors, translates them to user-friendly messages, and logs them appropriately.

#### Error Categories

- `AUTHENTICATION` - Authentication and authorization errors
- `COMMAND` - Command parsing and execution errors
- `SYSTEM` - System-level errors (workspace, rate limiting)
- `VALIDATION` - Input validation errors
- `PERMISSION` - Access control and permission errors
- `NETWORK` - Network connectivity errors
- `DATABASE` - Database operation errors

#### Error Severity Levels

- `LOW` - Minor issues that don't significantly impact functionality
- `MEDIUM` - Moderate issues that may affect user experience
- `HIGH` - Serious issues that prevent operations
- `CRITICAL` - Critical failures requiring immediate attention

#### Usage Example

```typescript
import { errorHandler, ApplicationError, ErrorCategory, ErrorSeverity } from './services';

// Handle any error
try {
  await someOperation();
} catch (error) {
  const appError = errorHandler.handleError(error, {
    userId: 'user-123',
    operation: 'someOperation'
  });
  
  // Format for WhatsApp
  const whatsappMessage = errorHandler.formatForWhatsApp(appError);
  await whatsappSender.sendMessage(phoneNumber, whatsappMessage.text);
  
  // Format for API response
  const apiResponse = errorHandler.formatForAPI(appError);
  res.status(500).json(apiResponse);
}

// Create custom error
throw new ApplicationError(
  'CUSTOM_ERROR',
  'Something went wrong',
  ErrorCategory.SYSTEM,
  ErrorSeverity.HIGH,
  {
    userMessage: 'Please try again later',
    retryable: true,
    details: { additionalInfo: 'value' }
  }
);
```

### 2. Retry Service (`retry.service.ts`)

Implements retry logic with exponential backoff for transient failures.

#### Features

- Configurable maximum attempts
- Exponential backoff with configurable multiplier
- Maximum delay cap
- Selective retry based on error patterns
- Retry callbacks for monitoring

#### Usage Example

```typescript
import { retryService } from './services';

// Simple retry
const result = await retryService.retry(
  async () => await fetchData(),
  3 // max attempts
);

// Advanced retry with options
const result = await retryService.executeWithRetry(
  async () => await apiCall(),
  {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['network', 'timeout', 'ECONNREFUSED'],
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}: ${error.message}`);
    }
  }
);

if (result.success) {
  console.log('Operation succeeded:', result.data);
} else {
  console.error('Operation failed:', result.error);
}
```

### 3. Circuit Breaker Service (`circuit-breaker.service.ts`)

Implements the circuit breaker pattern to prevent cascading failures when external services are unavailable.

#### Circuit States

- `CLOSED` - Normal operation, requests pass through
- `OPEN` - Circuit is open, requests fail fast without calling the service
- `HALF_OPEN` - Testing if service has recovered

#### Features

- Configurable failure threshold
- Configurable success threshold for recovery
- Automatic state transitions
- Statistics tracking
- State change callbacks

#### Usage Example

```typescript
import { circuitBreakerManager } from './services';

// Execute with circuit breaker
try {
  const result = await circuitBreakerManager.execute(
    'external-api',
    async () => await externalApiCall(),
    {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      onCircuitOpen: () => {
        console.error('Circuit opened - service unavailable');
      }
    }
  );
} catch (error) {
  console.error('Operation failed:', error);
}

// Execute with fallback
const result = await circuitBreakerManager.executeWithFallback(
  'external-api',
  async () => await externalApiCall(),
  { fallbackData: 'default' }, // fallback value
  { failureThreshold: 5 }
);

// Get circuit breaker statistics
const stats = circuitBreakerManager.getStats('external-api');
console.log('Circuit state:', stats?.state);
console.log('Total requests:', stats?.totalRequests);
console.log('Failure count:', stats?.failureCount);
```

### 4. Resilient WhatsApp Service (`resilient-whatsapp.service.ts`)

Combines retry logic and circuit breaker for fault-tolerant WhatsApp messaging.

#### Features

- Automatic retry on transient failures
- Circuit breaker protection
- Message chunking for long messages
- Fallback messages when service is unavailable
- Health status monitoring

#### Usage Example

```typescript
import { resilientWhatsApp } from './services';

// Send message with automatic retry and circuit breaker
const success = await resilientWhatsApp.sendMessage(
  phoneNumber,
  'Your message here'
);

// Send error message with fallback
await resilientWhatsApp.sendErrorMessage(
  phoneNumber,
  'An error occurred'
);

// Send notification
await resilientWhatsApp.sendNotification(
  phoneNumber,
  'Build Complete',
  'Your build finished successfully'
);

// Check service availability
if (resilientWhatsApp.isAvailable()) {
  console.log('WhatsApp service is available');
}

// Get health status
const health = resilientWhatsApp.getHealthStatus();
console.log('Circuit state:', health.circuitState);
console.log('Available:', health.available);
```

## Integration with Existing Services

### WhatsApp Handler Integration

Update `whatsapp-handler.service.ts` to use the resilient WhatsApp service:

```typescript
import { resilientWhatsApp } from './resilient-whatsapp.service';
import { errorHandler } from './error-handler.service';

// In message handler
try {
  const result = await commandService.executeCommand(message, userId);
  
  if (result.success && result.data) {
    await resilientWhatsApp.sendMessage(phoneNumber, result.data);
  } else {
    const appError = errorHandler.handleError(
      new Error(result.error || 'Command failed'),
      { userId, operation: 'executeCommand' }
    );
    const errorMessage = errorHandler.formatForWhatsApp(appError);
    await resilientWhatsApp.sendMessage(phoneNumber, errorMessage.text);
  }
} catch (error) {
  const appError = errorHandler.handleError(error, {
    userId,
    operation: 'handleMessage'
  });
  await resilientWhatsApp.sendErrorMessage(phoneNumber, appError.message);
}
```

### Command Service Integration

Update command execution to use error handler:

```typescript
import { errorHandler, ErrorCategory, ErrorSeverity } from './error-handler.service';

async executeCommand(message: string, userId: string): Promise<CommandExecutionResult> {
  try {
    // ... command execution logic
  } catch (error) {
    const appError = errorHandler.handleError(error, {
      userId,
      operation: 'executeCommand'
    });
    
    return {
      success: false,
      error: appError.userMessage || appError.message,
      commandType: 'UNKNOWN',
    };
  }
}
```

### Notification Service Integration

Update notification delivery to use resilient WhatsApp:

```typescript
import { resilientWhatsApp } from './resilient-whatsapp.service';

async deliverNotification(notification: Notification): Promise<boolean> {
  return await resilientWhatsApp.sendNotification(
    notification.phoneNumber,
    notification.title,
    notification.message
  );
}
```

## Error Logging

All errors are automatically logged to the audit log when a `userId` is provided:

```typescript
const appError = errorHandler.handleError(error, {
  userId: 'user-123',
  operation: 'someOperation'
});
// Error is automatically logged to audit_logs table
```

## Monitoring and Debugging

### Circuit Breaker Statistics

```typescript
import { circuitBreakerManager } from './services';

// Get all circuit breaker stats
const allStats = circuitBreakerManager.getAllStats();
allStats.forEach((stats, name) => {
  console.log(`${name}:`, stats);
});

// Get specific circuit breaker stats
const whatsappStats = circuitBreakerManager.getStats('whatsapp-api');
console.log('WhatsApp Circuit:', whatsappStats);
```

### Error Statistics

Query audit logs for error statistics:

```typescript
import { auditLogService } from './services';

const stats = await auditLogService.getAuditLogStats('user-123');
console.log('Total commands:', stats.totalCommands);
console.log('Failed commands:', stats.failedCommands);
console.log('Success rate:', 
  (stats.successfulCommands / stats.totalCommands * 100).toFixed(2) + '%'
);
```

## Best Practices

1. **Always use error handler for consistent error handling**
   ```typescript
   const appError = errorHandler.handleError(error, { userId, operation });
   ```

2. **Use retry service for transient failures**
   ```typescript
   await retryService.retry(async () => await operation(), 3);
   ```

3. **Use circuit breaker for external services**
   ```typescript
   await circuitBreakerManager.execute('service-name', async () => await call());
   ```

4. **Provide user context for better logging**
   ```typescript
   errorHandler.handleError(error, { userId: 'user-123', operation: 'readFile' });
   ```

5. **Use resilient WhatsApp service instead of direct WhatsApp client**
   ```typescript
   await resilientWhatsApp.sendMessage(phoneNumber, message);
   ```

6. **Create custom errors with appropriate categories**
   ```typescript
   throw new ApplicationError(
     'CUSTOM_ERROR',
     'Technical message',
     ErrorCategory.SYSTEM,
     ErrorSeverity.HIGH,
     { userMessage: 'User-friendly message', retryable: true }
   );
   ```

## Testing

### Testing Error Handler

```typescript
import { errorHandler, ErrorCategory } from './services';

// Test error categorization
const error = new Error('File not found');
const appError = errorHandler.handleError(error);
expect(appError.category).toBe(ErrorCategory.COMMAND);
expect(appError.code).toBe('CMD_FILE_NOT_FOUND');

// Test WhatsApp formatting
const whatsappMessage = errorHandler.formatForWhatsApp(appError);
expect(whatsappMessage.text).toContain('❌');
```

### Testing Retry Service

```typescript
import { retryService } from './services';

let attempts = 0;
const result = await retryService.executeWithRetry(
  async () => {
    attempts++;
    if (attempts < 3) throw new Error('Temporary failure');
    return 'success';
  },
  { maxAttempts: 3 }
);

expect(result.success).toBe(true);
expect(result.attempts).toBe(3);
```

### Testing Circuit Breaker

```typescript
import { CircuitBreaker, CircuitState } from './services';

const breaker = new CircuitBreaker('test', { failureThreshold: 2 });

// Trigger failures
for (let i = 0; i < 2; i++) {
  try {
    await breaker.execute(async () => { throw new Error('fail'); });
  } catch (e) {}
}

expect(breaker.getState()).toBe(CircuitState.OPEN);
```

## Configuration

### Environment Variables

```env
# Retry configuration
RETRY_MAX_ATTEMPTS=3
RETRY_INITIAL_DELAY_MS=1000
RETRY_MAX_DELAY_MS=10000

# Circuit breaker configuration
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=2
CIRCUIT_BREAKER_TIMEOUT_MS=60000
```

## Troubleshooting

### Circuit Breaker Stuck Open

If a circuit breaker is stuck open:

```typescript
import { resilientWhatsApp } from './services';

// Manually reset the circuit breaker
resilientWhatsApp.resetCircuitBreaker();
```

### High Retry Rates

Monitor retry statistics and adjust retry configuration:

```typescript
// Reduce max attempts for faster failure
const result = await retryService.executeWithRetry(fn, { maxAttempts: 2 });
```

### Error Message Not User-Friendly

Create custom error with user message:

```typescript
throw new ApplicationError(
  'CUSTOM_ERROR',
  'Technical error message',
  ErrorCategory.SYSTEM,
  ErrorSeverity.MEDIUM,
  {
    userMessage: 'Something went wrong. Please try again.',
    retryable: true
  }
);
```
