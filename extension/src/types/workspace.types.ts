/**
 * Workspace command types and interfaces
 */

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  lastModified: Date;
}

export interface SearchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

export interface WorkspaceStatus {
  workspaceName: string;
  workspacePath: string;
  openFiles: string[];
  gitBranch?: string;
  gitStatus?: string;
  activeTasks: number;
}

export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime: number;
}

export type WorkspaceCommand =
  | { type: 'FILE_READ'; path: string }
  | { type: 'FILE_LIST'; directory: string }
  | { type: 'SEARCH'; query: string; pattern?: string }
  | { type: 'STATUS' };
