import * as vscode from 'vscode';
import * as path from 'path';
import { FileInfo, CommandResult } from '../types/workspace.types';

/**
 * File Operations Handler
 * Handles file reading, listing, and validation
 */
export class FileOperationsHandler {
  /**
   * Read file contents using VS Code API
   */
  async readFile(filePath: string): Promise<CommandResult<string>> {
    const startTime = Date.now();

    try {
      // Validate and resolve file path
      const resolvedPath = await this.validateAndResolvePath(filePath);
      if (!resolvedPath.success) {
        return {
          success: false,
          error: resolvedPath.error,
          executionTime: Date.now() - startTime
        };
      }

      const uri = vscode.Uri.file(resolvedPath.data!);

      // Check if file exists
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        return {
          success: false,
          error: `File not found: ${filePath}`,
          executionTime: Date.now() - startTime
        };
      }

      // Read file contents
      const fileData = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(fileData).toString('utf8');

      return {
        success: true,
        data: content,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * List files in a directory with traversal
   */
  async listFiles(directory: string): Promise<CommandResult<FileInfo[]>> {
    const startTime = Date.now();

    try {
      // Validate and resolve directory path
      const resolvedPath = await this.validateAndResolvePath(directory);
      if (!resolvedPath.success) {
        return {
          success: false,
          error: resolvedPath.error,
          executionTime: Date.now() - startTime
        };
      }

      const uri = vscode.Uri.file(resolvedPath.data!);

      // Check if directory exists
      let stat;
      try {
        stat = await vscode.workspace.fs.stat(uri);
      } catch {
        return {
          success: false,
          error: `Directory not found: ${directory}`,
          executionTime: Date.now() - startTime
        };
      }

      // Verify it's a directory
      if (stat.type !== vscode.FileType.Directory) {
        return {
          success: false,
          error: `Path is not a directory: ${directory}`,
          executionTime: Date.now() - startTime
        };
      }

      // Read directory contents
      const entries = await vscode.workspace.fs.readDirectory(uri);
      const fileInfos: FileInfo[] = [];

      for (const [name, type] of entries) {
        const entryPath = path.join(resolvedPath.data!, name);
        const entryUri = vscode.Uri.file(entryPath);

        try {
          const entryStat = await vscode.workspace.fs.stat(entryUri);

          fileInfos.push({
            name,
            path: entryPath,
            type: type === vscode.FileType.Directory ? 'directory' : 'file',
            size: entryStat.size,
            lastModified: new Date(entryStat.mtime)
          });
        } catch (error) {
          // Skip files that can't be accessed
          console.warn(`Could not stat file: ${entryPath}`, error);
        }
      }

      // Sort: directories first, then files, alphabetically
      fileInfos.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return {
        success: true,
        data: fileInfos,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate file path and check security constraints
   */
  private async validateAndResolvePath(filePath: string): Promise<CommandResult<string>> {
    try {
      // Get workspace folders
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return {
          success: false,
          error: 'No workspace folder open',
          executionTime: 0
        };
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;

      // Resolve path (handle relative and absolute paths)
      let resolvedPath: string;
      if (path.isAbsolute(filePath)) {
        resolvedPath = path.normalize(filePath);
      } else {
        resolvedPath = path.resolve(workspaceRoot, filePath);
      }

      // Security check: prevent directory traversal
      if (filePath.includes('..') || filePath.includes('~')) {
        return {
          success: false,
          error: 'Access denied: Invalid path pattern',
          executionTime: 0
        };
      }

      // Security check: ensure path is within workspace
      if (!resolvedPath.startsWith(workspaceRoot)) {
        return {
          success: false,
          error: 'Access denied: Path is outside workspace',
          executionTime: 0
        };
      }

      // Check accessible directories configuration
      const config = vscode.workspace.getConfiguration('kiroWhatsapp');
      const accessibleDirs = config.get<string[]>('accessibleDirectories', []);

      // If accessible directories are configured, validate against them
      if (accessibleDirs.length > 0) {
        const isAccessible = this.checkAccessibleDirectory(resolvedPath, accessibleDirs, workspaceRoot);

        if (!isAccessible) {
          return {
            success: false,
            error: 'Access denied: Path is not in accessible directories',
            executionTime: 0
          };
        }
      }

      return {
        success: true,
        data: resolvedPath,
        executionTime: 0
      };
    } catch (error) {
      return {
        success: false,
        error: `Path validation failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: 0
      };
    }
  }

  /**
   * Check if path is within accessible directories
   */
  private checkAccessibleDirectory(
    resolvedPath: string,
    accessibleDirs: string[],
    workspaceRoot: string
  ): boolean {
    return accessibleDirs.some(dir => {
      const allowedPath = path.resolve(workspaceRoot, dir);
      const normalizedResolved = path.normalize(resolvedPath);
      const normalizedAllowed = path.normalize(allowedPath);
      
      return (
        normalizedResolved === normalizedAllowed ||
        normalizedResolved.startsWith(normalizedAllowed + path.sep) ||
        normalizedResolved.startsWith(normalizedAllowed + '/')
      );
    });
  }

  /**
   * Check if read-only mode is enabled
   */
  isReadOnlyMode(): boolean {
    const config = vscode.workspace.getConfiguration('kiroWhatsapp');
    return config.get<boolean>('readOnlyMode', true);
  }
}
