/**
 * Command types supported by the system
 */
export enum CommandType {
  FILE_READ = 'FILE_READ',
  FILE_LIST = 'FILE_LIST',
  SEARCH = 'SEARCH',
  STATUS = 'STATUS',
  HELP = 'HELP',
}

/**
 * Base command interface
 */
export interface BaseCommand {
  type: CommandType;
  raw: string;
}

/**
 * File read command
 */
export interface FileReadCommand extends BaseCommand {
  type: CommandType.FILE_READ;
  path: string;
}

/**
 * File list command
 */
export interface FileListCommand extends BaseCommand {
  type: CommandType.FILE_LIST;
  directory: string;
}

/**
 * Search command
 */
export interface SearchCommand extends BaseCommand {
  type: CommandType.SEARCH;
  query: string;
  pattern?: string;
}

/**
 * Status command
 */
export interface StatusCommand extends BaseCommand {
  type: CommandType.STATUS;
}

/**
 * Help command
 */
export interface HelpCommand extends BaseCommand {
  type: CommandType.HELP;
}

/**
 * Union type of all commands
 */
export type Command =
  | FileReadCommand
  | FileListCommand
  | SearchCommand
  | StatusCommand
  | HelpCommand;

/**
 * Parse result interface
 */
export interface ParseResult {
  success: boolean;
  command?: Command;
  error?: string;
}
