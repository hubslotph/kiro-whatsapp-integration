import {
  Command,
  CommandType,
  FileReadCommand,
  FileListCommand,
  SearchCommand,
  StatusCommand,
  HelpCommand,
  ParseResult,
} from '../types/command.types';

/**
 * Command patterns for parsing user messages
 */
const COMMAND_PATTERNS = {
  // FILE_READ: read <path>, show <path>, cat <path>, file <path>
  FILE_READ: /^(?:read|show|cat|file|open)\s+(.+)$/i,

  // FILE_LIST: list <directory>, ls <directory>, dir <directory>
  FILE_LIST: /^(?:list|ls|dir|files)\s*(.*)$/i,

  // SEARCH: search <query>, find <query>, grep <query>
  // Optional: search <query> in <pattern>, find <query> pattern:<pattern>
  SEARCH: /^(?:search|find|grep)\s+(.+?)(?:\s+(?:in|pattern:)\s*(.+))?$/i,

  // STATUS: status, workspace, info
  STATUS: /^(?:status|workspace|info)$/i,

  // HELP: help, commands, ?
  HELP: /^(?:help|commands|\?)$/i,
};

/**
 * Command Parser Service
 * Parses user messages into structured command objects
 */
export class CommandParserService {
  /**
   * Parse a message string into a Command object
   * @param message - The raw message from the user
   * @returns ParseResult containing the parsed command or error
   */
  parse(message: string): ParseResult {
    // Normalize the message: trim and collapse multiple spaces
    const normalized = this.normalizeMessage(message);

    if (!normalized) {
      return {
        success: false,
        error: 'Empty message',
      };
    }

    // Try to match against each command pattern
    const command = this.matchCommand(normalized);

    if (!command) {
      return {
        success: false,
        error: `Unknown command. Type "help" to see available commands.`,
      };
    }

    return {
      success: true,
      command,
    };
  }

  /**
   * Normalize message for parsing
   * - Trim whitespace
   * - Collapse multiple spaces
   * - Convert to lowercase for case-insensitive matching
   */
  private normalizeMessage(message: string): string {
    return message.trim().replace(/\s+/g, ' ');
  }

  /**
   * Match the normalized message against command patterns
   */
  private matchCommand(normalized: string): Command | null {
    // Try FILE_READ
    const fileReadMatch = normalized.match(COMMAND_PATTERNS.FILE_READ);
    if (fileReadMatch) {
      return this.createFileReadCommand(normalized, fileReadMatch[1].trim());
    }

    // Try FILE_LIST
    const fileListMatch = normalized.match(COMMAND_PATTERNS.FILE_LIST);
    if (fileListMatch) {
      return this.createFileListCommand(
        normalized,
        fileListMatch[1]?.trim() || '.'
      );
    }

    // Try SEARCH
    const searchMatch = normalized.match(COMMAND_PATTERNS.SEARCH);
    if (searchMatch) {
      return this.createSearchCommand(
        normalized,
        searchMatch[1].trim(),
        searchMatch[2]?.trim()
      );
    }

    // Try STATUS
    const statusMatch = normalized.match(COMMAND_PATTERNS.STATUS);
    if (statusMatch) {
      return this.createStatusCommand(normalized);
    }

    // Try HELP
    const helpMatch = normalized.match(COMMAND_PATTERNS.HELP);
    if (helpMatch) {
      return this.createHelpCommand(normalized);
    }

    return null;
  }

  /**
   * Create a FILE_READ command
   */
  private createFileReadCommand(
    raw: string,
    path: string
  ): FileReadCommand {
    return {
      type: CommandType.FILE_READ,
      raw,
      path,
    };
  }

  /**
   * Create a FILE_LIST command
   */
  private createFileListCommand(
    raw: string,
    directory: string
  ): FileListCommand {
    return {
      type: CommandType.FILE_LIST,
      raw,
      directory,
    };
  }

  /**
   * Create a SEARCH command
   */
  private createSearchCommand(
    raw: string,
    query: string,
    pattern?: string
  ): SearchCommand {
    return {
      type: CommandType.SEARCH,
      raw,
      query,
      pattern,
    };
  }

  /**
   * Create a STATUS command
   */
  private createStatusCommand(raw: string): StatusCommand {
    return {
      type: CommandType.STATUS,
      raw,
    };
  }

  /**
   * Create a HELP command
   */
  private createHelpCommand(raw: string): HelpCommand {
    return {
      type: CommandType.HELP,
      raw,
    };
  }
}
