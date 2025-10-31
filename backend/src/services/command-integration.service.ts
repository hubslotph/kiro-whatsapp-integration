/**
 * Command Execution Integration Service
 * Wires together command execution flow components:
 * - WhatsApp message handler → Command parser
 * - Command parser → Workspace manager client
 * - Workspace controller responses → WhatsApp sender
 */

import { commandService } from './command.service';
import { whatsappSender } from './whatsapp-sender.service';
import { workspaceManagerService } from './workspace-manager-wrapper.service';
import { auditLogService } from './audit-log.service';
import { accessControlService } from './access-control.service';
import { Command } from '../types/command.types';

/**
 * Execute command from WhatsApp message
 * Integrates: WhatsApp message → Command parser → Workspace manager → WhatsApp sender
 */
export async function executeCommandFromWhatsApp(
  phoneNumber: string,
  userId: string,
  messageText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Parse and validate command
    const processResult = commandService.process(messageText);

    if (!processResult.success || !processResult.command) {
      // Send error message via WhatsApp
      const errorMessage = processResult.error || 'Failed to parse command';
      await whatsappSender.sendErrorMessage(phoneNumber, errorMessage);

      // Log failed command parsing
      await auditLogService.logCommandExecution(
        userId,
        { type: 'UNKNOWN' } as any,
        false,
        errorMessage
      );

      return {
        success: false,
        error: errorMessage
      };
    }

    const command = processResult.command;

    // Check access control for file operations
    if (command.type === 'FILE_READ' || command.type === 'FILE_LIST') {
      const path = command.type === 'FILE_READ' ? command.path : command.directory;
      const accessResult = await accessControlService.checkPathPermission(userId, path);
      const hasAccess = accessResult.allowed;

      if (!hasAccess) {
        const errorMessage = `Access denied: You don't have permission to access "${path}"`;
        await whatsappSender.sendErrorMessage(phoneNumber, errorMessage);

        // Log access denied
        await auditLogService.logCommandExecution(userId, command, false, errorMessage);

        return {
          success: false,
          error: errorMessage
        };
      }
    }

    // Handle HELP command locally (no workspace needed)
    if (command.type === 'HELP') {
      const helpMessage = getHelpMessage();
      await whatsappSender.sendMessage(phoneNumber, helpMessage);

      // Log successful help command
      await auditLogService.logCommandExecution(userId, command, true);

      return { success: true };
    }

    // Execute command via workspace manager
    const result = await commandService.executeCommand(messageText, userId);

    if (result.success && result.data) {
      // Send successful response via WhatsApp
      await whatsappSender.sendMessage(phoneNumber, result.data);

      return { success: true };
    } else {
      // Send error response via WhatsApp
      const errorMessage = result.error || 'Command execution failed';
      await whatsappSender.sendErrorMessage(phoneNumber, errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    }
  } catch (error) {
    console.error('Error executing command from WhatsApp:', error);

    // Send error message via WhatsApp
    const errorMessage = 'An error occurred while executing your command. Please try again.';
    await whatsappSender.sendErrorMessage(phoneNumber, errorMessage);

    // Log error
    await auditLogService.logCommandExecution(
      userId,
      { type: 'UNKNOWN' } as any,
      false,
      error instanceof Error ? error.message : 'Unknown error'
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Command execution failed'
    };
  }
}

/**
 * Execute command with workspace manager
 * Integrates: Command → Workspace manager client → Result formatting
 */
export async function executeCommandWithWorkspace(
  command: Command,
  userId: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    // Check if workspace is connected
    const client = workspaceManagerService.getAnyConnectedClient();
    if (!client || !client.isConnected()) {
      return {
        success: false,
        error: 'Workspace not connected. Please ensure Kiro extension is running.'
      };
    }

    // Execute command via workspace manager
    const result = await client.executeCommand(command);

    if (result.success && result.data) {
      // Format result for display
      const formattedData = formatCommandResult(command, result.data);

      // Log successful execution
      await auditLogService.logCommandExecution(userId, command, true);

      return {
        success: true,
        data: formattedData
      };
    } else {
      // Log failed execution
      await auditLogService.logCommandExecution(userId, command, false, result.error);

      return {
        success: false,
        error: result.error || 'Command execution failed'
      };
    }
  } catch (error) {
    console.error('Error executing command with workspace:', error);

    // Log error
    await auditLogService.logCommandExecution(
      userId,
      command,
      false,
      error instanceof Error ? error.message : 'Unknown error'
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Command execution failed'
    };
  }
}

/**
 * Format command result for WhatsApp display
 */
function formatCommandResult(command: Command, data: string): string {
  switch (command.type) {
    case 'FILE_READ':
      return `📄 *File: ${command.path}*\n\n${data}`;

    case 'FILE_LIST':
      return `📁 *Directory: ${command.directory}*\n\n${data}`;

    case 'SEARCH':
      return `🔍 *Search: "${command.query}"*\n\n${data}`;

    case 'STATUS':
      return `📊 *Workspace Status*\n\n${data}`;

    default:
      return data;
  }
}

/**
 * Get help message with available commands
 */
function getHelpMessage(): string {
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

/**
 * Send command result via WhatsApp
 * Integrates: Command result → WhatsApp sender (with chunking)
 */
export async function sendCommandResultViaWhatsApp(
  phoneNumber: string,
  result: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await whatsappSender.sendMessage(phoneNumber, result);
    return { success: true };
  } catch (error) {
    console.error('Error sending command result via WhatsApp:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send result'
    };
  }
}

/**
 * Send command error via WhatsApp
 * Integrates: Error → WhatsApp sender (with friendly formatting)
 */
export async function sendCommandErrorViaWhatsApp(
  phoneNumber: string,
  error: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await whatsappSender.sendErrorMessage(phoneNumber, error);
    return { success: true };
  } catch (err) {
    console.error('Error sending command error via WhatsApp:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send error'
    };
  }
}
