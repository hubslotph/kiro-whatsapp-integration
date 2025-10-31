import { FileOperationsHandler } from './file-operations';
import { WorkspaceSearchHandler } from './search';
import { WorkspaceStatusReporter } from './status';
import { WorkspaceCommand, CommandResult } from '../types/workspace.types';

/**
 * Workspace Controller
 * Main controller that coordinates all workspace operations
 */
export class WorkspaceController {
  private fileOps: FileOperationsHandler;
  private search: WorkspaceSearchHandler;
  private status: WorkspaceStatusReporter;

  constructor() {
    this.fileOps = new FileOperationsHandler();
    this.search = new WorkspaceSearchHandler();
    this.status = new WorkspaceStatusReporter();
  }

  /**
   * Execute a workspace command
   */
  async executeCommand(command: WorkspaceCommand): Promise<CommandResult> {
    try {
      // Check read-only mode for write operations (future-proofing)
      if (this.fileOps.isReadOnlyMode()) {
        // Currently all operations are read-only, but this check is here for future extensions
      }

      switch (command.type) {
        case 'FILE_READ':
          return await this.handleFileRead(command.path);

        case 'FILE_LIST':
          return await this.handleFileList(command.directory);

        case 'SEARCH':
          return await this.handleSearch(command.query, command.pattern);

        case 'STATUS':
          return await this.handleStatus();

        default:
          return {
            success: false,
            error: `Unknown command type: ${(command as any).type}`,
            executionTime: 0
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: 0
      };
    }
  }

  /**
   * Handle FILE_READ command
   */
  private async handleFileRead(filePath: string): Promise<CommandResult<string>> {
    return await this.fileOps.readFile(filePath);
  }

  /**
   * Handle FILE_LIST command
   */
  private async handleFileList(directory: string): Promise<CommandResult> {
    const result = await this.fileOps.listFiles(directory);

    if (result.success && result.data) {
      // Format file list for display
      const formatted = result.data
        .map(file => {
          const icon = file.type === 'directory' ? '📁' : '📄';
          const size = file.type === 'file' ? ` (${this.formatFileSize(file.size)})` : '';
          return `${icon} ${file.name}${size}`;
        })
        .join('\n');

      return {
        success: true,
        data: formatted,
        executionTime: result.executionTime
      };
    }

    return result;
  }

  /**
   * Handle SEARCH command
   */
  private async handleSearch(query: string, pattern?: string): Promise<CommandResult> {
    const result = await this.search.search(query, pattern);

    if (result.success && result.data) {
      // Format search results for display
      const formatted = this.search.formatResults(result.data);

      return {
        success: true,
        data: formatted,
        executionTime: result.executionTime
      };
    }

    return result;
  }

  /**
   * Handle STATUS command
   */
  private async handleStatus(): Promise<CommandResult> {
    const result = await this.status.getStatus();

    if (result.success && result.data) {
      // Format status for display
      const formatted = this.status.formatStatus(result.data);

      return {
        success: true,
        data: formatted,
        executionTime: result.executionTime
      };
    }

    return result;
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  }
}
