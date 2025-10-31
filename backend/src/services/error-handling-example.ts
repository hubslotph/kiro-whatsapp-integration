/**
 * Error Handling Integration Examples
 * 
 * This file demonstrates how to integrate the error handling system
 * into existing services. These are examples only - not production code.
 */

import { errorHandler, ApplicationError } from './error-handler.service';
import { ErrorCategory, ErrorSeverity } from '../types/error.types';
import { resilientWhatsApp } from './resilient-whatsapp.service';
import { retryService } from './retry.service';
import { circuitBreakerManager } from './circuit-breaker.service';

/**
 * Example 1: WhatsApp Handler Integration
 * Shows how to handle errors in the WhatsApp message handler
 */
export async function exampleWhatsAppHandler(
  phoneNumber: string,
  message: string,
  userId: string
) {
  try {
    // Process the command
    const result = await processCommand(message, userId);
    
    if (result.success && result.data) {
      // Send success response using resilient WhatsApp
      await resilientWhatsApp.sendMessage(phoneNumber, result.data);
    } else {
      // Handle command failure
      const appError = errorHandler.handleError(
        new Error(result.error || 'Command failed'),
        { userId, operation: 'processCommand' }
      );
      
      const errorMessage = errorHandler.formatForWhatsApp(appError);
      await resilientWhatsApp.sendMessage(phoneNumber, errorMessage.text);
    }
  } catch (error) {
    // Handle unexpected errors
    const appError = errorHandler.handleError(error, {
      userId,
      operation: 'handleWhatsAppMessage'
    });
    
    // Send error message with automatic retry and circuit breaker
    await resilientWhatsApp.sendErrorMessage(
      phoneNumber,
      appError.userMessage || appError.message
    );
  }
}

/**
 * Example 2: Command Execution with Retry
 * Shows how to execute commands with automatic retry
 */
export async function exampleCommandExecution(
  command: string,
  userId: string
) {
  try {
    // Execute command with retry for transient failures
    const result = await retryService.executeWithRetry(
      async () => {
        return await executeWorkspaceCommand(command);
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        retryableErrors: ['timeout', 'network', 'ECONNREFUSED'],
        onRetry: (attempt, error) => {
          console.log(`Retrying command (attempt ${attempt}): ${error.message}`);
        }
      }
    );

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      // Handle retry exhaustion
      const appError = errorHandler.handleError(result.error!, {
        userId,
        operation: 'executeCommand'
      });
      
      return {
        success: false,
        error: appError.userMessage || appError.message
      };
    }
  } catch (error) {
    const appError = errorHandler.handleError(error, {
      userId,
      operation: 'commandExecution'
    });
    
    return {
      success: false,
      error: appError.userMessage || appError.message
    };
  }
}

/**
 * Example 3: External API Call with Circuit Breaker
 * Shows how to protect external API calls with circuit breaker
 */
export async function exampleExternalApiCall(userId: string) {
  try {
    // Execute with circuit breaker protection
    const result = await circuitBreakerManager.executeWithFallback(
      'external-api',
      async () => {
        // Make the actual API call
        return await callExternalApi();
      },
      // Fallback response when circuit is open
      { status: 'unavailable', message: 'Service temporarily unavailable' },
      {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
        onCircuitOpen: () => {
          console.error('External API circuit opened - service unavailable');
        },
        onCircuitClose: () => {
          console.log('External API circuit closed - service recovered');
        }
      }
    );

    return { success: true, data: result };
  } catch (error) {
    const appError = errorHandler.handleError(error, {
      userId,
      operation: 'externalApiCall'
    });
    
    return {
      success: false,
      error: appError.userMessage || appError.message
    };
  }
}

/**
 * Example 4: Notification Delivery with Resilience
 * Shows how to deliver notifications with automatic retry and circuit breaker
 */
export async function exampleNotificationDelivery(
  phoneNumber: string,
  title: string,
  message: string,
  userId: string
) {
  try {
    // Check if WhatsApp service is available
    if (!resilientWhatsApp.isAvailable()) {
      console.warn('WhatsApp service unavailable, notification queued');
      // Queue notification for later delivery
      await queueNotification(phoneNumber, title, message);
      return { success: false, queued: true };
    }

    // Send notification with automatic retry and circuit breaker
    const success = await resilientWhatsApp.sendNotification(
      phoneNumber,
      title,
      message
    );

    if (success) {
      return { success: true };
    } else {
      // Queue for retry if delivery failed
      await queueNotification(phoneNumber, title, message);
      return { success: false, queued: true };
    }
  } catch (error) {
    const appError = errorHandler.handleError(error, {
      userId,
      operation: 'notificationDelivery'
    });
    
    console.error('Notification delivery failed:', appError.message);
    
    // Queue for retry
    await queueNotification(phoneNumber, title, message);
    return { success: false, queued: true, error: appError.message };
  }
}

/**
 * Example 5: Custom Error Creation
 * Shows how to create custom application errors
 */
export function exampleCustomError() {
  // Create a custom error with all details
  throw new ApplicationError(
    'WORKSPACE_BUSY',
    'Workspace is currently processing another request',
    ErrorCategory.SYSTEM,
    ErrorSeverity.MEDIUM,
    {
      userMessage: 'Your workspace is busy. Please try again in a moment.',
      technicalMessage: 'Workspace lock acquired by another process',
      retryable: true,
      details: {
        lockHolder: 'process-123',
        queueLength: 5
      }
    }
  );
}

/**
 * Example 6: Error Handling in Express Route
 * Shows how to handle errors in Express routes
 */
export async function exampleExpressRoute(req: any, res: any) {
  try {
    const { userId } = req.user;
    const { command } = req.body;

    const result = await executeCommand(command, userId);

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      const appError = errorHandler.handleError(
        new Error(result.error),
        { userId, operation: 'apiCommand' }
      );
      
      const apiResponse = errorHandler.formatForAPI(appError);
      res.status(400).json(apiResponse);
    }
  } catch (error) {
    const appError = errorHandler.handleError(error, {
      userId: req.user?.userId,
      operation: 'apiRequest'
    });
    
    const apiResponse = errorHandler.formatForAPI(appError);
    const statusCode = appError.severity === ErrorSeverity.HIGH ? 500 : 400;
    res.status(statusCode).json(apiResponse);
  }
}

/**
 * Example 7: Monitoring Circuit Breaker Health
 * Shows how to monitor circuit breaker health
 */
export function exampleCircuitBreakerMonitoring() {
  // Get all circuit breaker statistics
  const allStats = circuitBreakerManager.getAllStats();
  
  const healthReport = {
    timestamp: new Date().toISOString(),
    circuits: [] as any[]
  };

  allStats.forEach((stats, name) => {
    const successRate = stats.totalRequests > 0
      ? (stats.totalSuccesses / stats.totalRequests * 100).toFixed(2)
      : '0.00';

    healthReport.circuits.push({
      name,
      state: stats.state,
      successRate: `${successRate}%`,
      totalRequests: stats.totalRequests,
      totalFailures: stats.totalFailures,
      currentFailures: stats.failureCount,
      lastFailure: stats.lastFailureTime,
      lastSuccess: stats.lastSuccessTime
    });
  });

  return healthReport;
}

/**
 * Example 8: Graceful Degradation
 * Shows how to implement graceful degradation
 */
export async function exampleGracefulDegradation(
  phoneNumber: string,
  data: any,
  userId: string
) {
  try {
    // Try to send full data
    const fullMessage = formatFullMessage(data);
    const success = await resilientWhatsApp.sendMessage(phoneNumber, fullMessage);
    
    if (success) {
      return { success: true, mode: 'full' };
    }
  } catch (error) {
    console.warn('Full message delivery failed, trying simplified version');
  }

  try {
    // Fallback to simplified message
    const simplifiedMessage = formatSimplifiedMessage(data);
    const success = await resilientWhatsApp.sendMessage(phoneNumber, simplifiedMessage);
    
    if (success) {
      return { success: true, mode: 'simplified' };
    }
  } catch (error) {
    console.warn('Simplified message delivery failed, trying minimal version');
  }

  try {
    // Final fallback to minimal message
    const minimalMessage = 'Update available. Please check your workspace.';
    const success = await resilientWhatsApp.sendMessage(phoneNumber, minimalMessage);
    
    return { success, mode: 'minimal' };
  } catch (error) {
    const appError = errorHandler.handleError(error, {
      userId,
      operation: 'gracefulDegradation'
    });
    
    return { success: false, error: appError.message };
  }
}

// Mock functions for examples
async function processCommand(_message: string, _userId: string): Promise<any> {
  return { success: true, data: 'Command result' };
}

async function executeWorkspaceCommand(_command: string): Promise<any> {
  return { result: 'Command executed' };
}

async function callExternalApi(): Promise<any> {
  return { data: 'API response' };
}

async function queueNotification(_phoneNumber: string, _title: string, _message: string): Promise<void> {
  console.log('Notification queued for later delivery');
}

async function executeCommand(_command: string, _userId: string): Promise<any> {
  return { success: true, data: 'Result' };
}

function formatFullMessage(data: any): string {
  return JSON.stringify(data, null, 2);
}

function formatSimplifiedMessage(data: any): string {
  return `Update: ${data.summary || 'Data updated'}`;
}
