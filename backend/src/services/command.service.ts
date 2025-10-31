import { CommandParserService } from './command-parser.service';
import { CommandValidatorService } from './command-validator.service';
import { Command, ParseResult } from '../types/command.types';
import { ValidationResult } from '../types/validation.types';
import { WorkspaceManagerClient } from './workspace-manager.service';
import { CommandResult } from '../types/workspace.types';

/**
 * Combined result of parsing and validation
 */
export interface CommandProcessResult {
  success: boolean;
  command?: Command;
  error?: string;
  validationErrors?: string[];
}

/**
 * Result of command execution
 */
export interface CommandExecutionResult {
  success: boolean;
  data?: string;
  error?: string;
  commandType?: string;
}

/**
 * Command Service
 * Combines parsing and validation into a single service
 */
export class CommandService {
  private parser: CommandParserService;
  private validator: CommandValidatorService;
  private workspaceClient: WorkspaceManagerClient | null = null;

  constructor() {
    this.parser = new CommandParserService();
    this.validator = new CommandValidatorService();
  }

  /**
   * Set workspace manager client for command execution
   * @param client - Workspace manager client instance
   */
  setWorkspaceClient(client: WorkspaceManagerClient): void {
    this.workspaceClient = client;
  }

  /**
   * Get workspace manager client
   */
  getWorkspaceClient(): WorkspaceManagerClient | null {
    return this.workspaceClient;
  }

  /**
   * Process a message: parse and validate
   * @param message - The raw message from the user
   * @returns CommandProcessResult with the processed command or errors
   */
  process(message: string): CommandProcessResult {
    // Step 1: Parse the message
    const parseResult: ParseResult = this.parser.parse(message);

    if (!parseResult.success || !parseResult.command) {
      return {
        success: false,
        error: parseResult.error || 'Failed to parse command',
      };
    }

    // Step 2: Validate the parsed command
    const validationResult: ValidationResult = this.validator.validate(
      parseResult.command
    );

    if (!validationResult.valid) {
      return {
        success: false,
        command: parseResult.command,
        error: 'Command validation failed',
        validationErrors: validationResult.errors,
      };
    }

    // Success: command is parsed and valid
    return {
      success: true,
      command: parseResult.command,
    };
  }

  /**
   * Parse a message without validation
   * @param message - The raw message from the user
   * @returns ParseResult
   */
  parse(message: string): ParseResult {
    return this.parser.parse(message);
  }

  /**
   * Validate a command without parsing
   * @param command - The command to validate
   * @returns ValidationResult
   */
  validate(command: Command): ValidationResult {
    return this.validator.validate(command);
  }

  /**
   * Execute a command (parse, validate, and execute)
   * @param message - The raw message from the user
   * @param userId - The user ID executing the command
   * @returns CommandExecutionResult
   */
  async executeCommand(message: string, userId: string): Promise<CommandExecutionResult> {
    // Process the command (parse and validate)
    const processResult = this.process(message);

    if (!processResult.success || !processResult.command) {
      // Log failed command parsing
      if (userId) {
        const { auditLogService } = await import('./audit-log.service');
        await auditLogService.logCommandExecution(
          userId,
          { type: 'UNKNOWN' } as any,
          false,
          processResult.error || 'Failed to process command'
        );
      }
      
      return {
        success: false,
        error: processResult.error || 'Failed to process command',
        commandType: 'UNKNOWN',
      };
    }

    const command = processResult.command;

    // Handle HELP command locally (no workspace needed)
    if (command.type === 'HELP') {
      // Log successful help command
      if (userId) {
        const { auditLogService } = await import('./audit-log.service');
        await auditLogService.logCommandExecution(userId, command, true);
      }
      
      return {
        success: true,
        data: this.getHelpMessage(),
        commandType: command.type,
      };
    }

    // Execute command via workspace manager if available
    if (this.workspaceClient && this.workspaceClient.isConnected()) {
      try {
        const result: CommandResult = await this.workspaceClient.executeCommand(command);
        
        // Log command execution
        if (userId) {
          const { auditLogService } = await import('./audit-log.service');
          await auditLogService.logCommandExecution(
            userId,
            command,
            result.success,
            result.error
          );
        }
        
        return {
          success: result.success,
          data: this.formatCommandResult(command, result),
          error: result.error,
          commandType: command.type,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Command execution failed';
        
        // Log failed command execution
        if (userId) {
          const { auditLogService } = await import('./audit-log.service');
          await auditLogService.logCommandExecution(userId, command, false, errorMessage);
        }
        
        return {
          success: false,
          error: errorMessage,
          commandType: command.type,
        };
      }
    }

    // Fallback: return placeholder response if workspace not connected
    try {
      let response: string;

      switch (command.type) {
        case 'FILE_READ':
          response = `📄 Reading file: ${command.path}\n\n[Workspace not connected. Please ensure Kiro extension is running.]`;
          break;
        case 'FILE_LIST':
          response = `📁 Listing directory: ${command.directory}\n\n[Workspace not connected. Please ensure Kiro extension is running.]`;
          break;
        case 'SEARCH':
          response = `🔍 Searching for: "${command.query}"\n\n[Workspace not connected. Please ensure Kiro extension is running.]`;
          break;
        case 'STATUS':
          response = `📊 Workspace Status\n\n[Workspace not connected. Please ensure Kiro extension is running.]`;
          break;
        default:
          // Log unknown command
          if (userId) {
            const { auditLogService } = await import('./audit-log.service');
            await auditLogService.logCommandExecution(userId, command, false, 'Unknown command type');
          }
          
          return {
            success: false,
            error: 'Unknown command type',
            commandType: 'UNKNOWN',
          };
      }

      // Log workspace not connected
      if (userId) {
        const { auditLogService } = await import('./audit-log.service');
        await auditLogService.logCommandExecution(userId, command, false, 'Workspace not connected');
      }

      return {
        success: false,
        data: response,
        error: 'Workspace not connected',
        commandType: command.type,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Command execution failed';
      
      // Log execution error
      if (userId) {
        const { auditLogService } = await import('./audit-log.service');
        await auditLogService.logCommandExecution(userId, command, false, errorMessage);
      }
      
      return {
        success: false,
        error: errorMessage,
        commandType: command.type,
      };
    }
  }

  /**
   * Format command result for display
   * @param command - The executed command
   * @param result - The command result from workspace
   * @returns Formatted string for display
   */
  private formatCommandResult(command: Command, result: CommandResult): string {
    if (!result.success || !result.data) {
      return result.error || 'Command execution failed';
    }

    const cacheIndicator = (result as any).fromCache ? ' (cached)' : '';

    switch (command.type) {
      case 'FILE_READ':
        return `📄 *File: ${command.path}*${cacheIndicator}\n\n${result.data}`;
      
      case 'FILE_LIST':
        return `📁 *Directory: ${command.directory}*${cacheIndicator}\n\n${result.data}`;
      
      case 'SEARCH':
        return `🔍 *Search: "${command.query}"*\n\n${result.data}`;
      
      case 'STATUS':
        return `📊 *Workspace Status*${cacheIndicator}\n\n${result.data}`;
      
      default:
        return result.data;
    }
  }

  /**
   * Get help message with available commands
   * @returns Help message string
   */
  private getHelpMessage(): string {
    return `📚 *Kiro WhatsApp Integration - Available Commands*

*File Operations:*
• \`read <path>\` - Read file contents
• \`list <directory>\` - List files in directory

*Search:*
• \`search <query>\` - Search for text in workspace

*Workspace:*
• \`status\` - Get workspace status

*Help:*
• \`help\` - Show this help message

*Examples:*
• \`read src/index.ts\`
• \`list src/components\`
• \`search "function main"\`
• \`status\``;
  }
}

// Export singleton instance
export const commandService = new CommandService();
