// Export all services
export { CommandService } from './command.service';
export { CommandParserService } from './command-parser.service';
export { CommandValidatorService } from './command-validator.service';
export { WorkspaceManagerClient, WorkspaceManagerFactory } from './workspace-manager.service';
export { workspaceManagerService } from './workspace-manager-wrapper.service';
export { notificationDispatcher } from './notification-dispatcher.service';
export { notificationSettingsService } from './notification-settings.service';
export { notificationService } from './notification.service';
export { SettingsService } from './settings.service';
export { SettingsBroadcasterService } from './settings-broadcaster.service';
export { AccessControlService, accessControlService } from './access-control.service';
export { AuditLogService, auditLogService } from './audit-log.service';
export { ErrorHandlerService, errorHandler, ApplicationError } from './error-handler.service';
export { RetryService, retryService } from './retry.service';
export { CircuitBreaker, CircuitBreakerManager, circuitBreakerManager, CircuitState } from './circuit-breaker.service';
export { ResilientWhatsAppService, resilientWhatsApp } from './resilient-whatsapp.service';

// Export auth integration functions
export {
  requestVerificationCodeViaWhatsApp,
  verifyCodeAndNotify,
  authorizeCommand,
  authorizeCommandByPhoneNumber,
  notifySessionExpired,
  notifyAuthenticationRequired,
} from './auth-integration.service';

// Export command integration functions
export {
  executeCommandFromWhatsApp,
  executeCommandWithWorkspace,
  sendCommandResultViaWhatsApp,
  sendCommandErrorViaWhatsApp,
} from './command-integration.service';

// Export notification integration functions
export {
  subscribeToWorkspaceEvents,
  initializeEventSubscriptions,
  unsubscribeFromWorkspaceEvents,
  broadcastEventToWorkspaces,
  handleEventFromExtension,
} from './notification-integration.service';

// Re-export types for convenience
export type {
  Command,
  CommandType,
  FileReadCommand,
  FileListCommand,
  SearchCommand,
  StatusCommand,
  HelpCommand,
  ParseResult,
} from '../types/command.types';

export type {
  ValidationResult,
} from '../types/validation.types';

export type {
  CommandProcessResult,
} from './command.service';

export type {
  ConnectionState,
  ConnectionOptions,
  WorkspaceEvent,
  WorkspaceEventType,
  CommandResult,
  FileInfo,
  SearchResult,
  WorkspaceStatus,
  EventCallback,
} from '../types/workspace.types';

export type {
  Notification,
  NotificationType,
  NotificationPriority,
  BatchedNotifications,
  NotificationQueueItem,
  NotificationDeliveryResult,
} from '../types/notification.types';

export type {
  UserSettings,
  UpdateSettingsRequest,
  SettingsChangeEvent,
} from '../types/settings.types';

export type {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  ErrorResponse,
  WhatsAppErrorMessage,
} from '../types/error.types';

export type {
  RetryOptions,
  RetryResult,
} from './retry.service';

export type {
  CircuitBreakerOptions,
  CircuitBreakerStats,
} from './circuit-breaker.service';
