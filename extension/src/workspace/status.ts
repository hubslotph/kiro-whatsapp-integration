import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceStatus, CommandResult } from '../types/workspace.types';

/**
 * Workspace Status Reporter
 * Gathers and reports workspace metadata and status
 */
export class WorkspaceStatusReporter {
  /**
   * Get comprehensive workspace status
   */
  async getStatus(): Promise<CommandResult<WorkspaceStatus>> {
    const startTime = Date.now();

    try {
      // Get workspace folders
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return {
          success: false,
          error: 'No workspace folder open',
          executionTime: Date.now() - startTime
        };
      }

      const workspaceFolder = workspaceFolders[0];
      const workspacePath = workspaceFolder.uri.fsPath;
      const workspaceName = workspaceFolder.name;

      // Get open files
      const openFiles = vscode.workspace.textDocuments
        .filter(doc => !doc.isUntitled && doc.uri.scheme === 'file')
        .map(doc => path.relative(workspacePath, doc.uri.fsPath));

      // Get Git status
      const gitInfo = await this.getGitStatus(workspaceFolder.uri);

      // Get active tasks count
      const activeTasks = await this.getActiveTasksCount();

      const status: WorkspaceStatus = {
        workspaceName,
        workspacePath,
        openFiles,
        gitBranch: gitInfo.branch,
        gitStatus: gitInfo.status,
        activeTasks
      };

      return {
        success: true,
        data: status,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get workspace status: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get Git repository status
   */
  private async getGitStatus(workspaceUri: vscode.Uri): Promise<{
    branch?: string;
    status?: string;
  }> {
    try {
      // Try to get Git extension
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (!gitExtension) {
        return {};
      }

      if (!gitExtension.isActive) {
        await gitExtension.activate();
      }

      const git = gitExtension.exports.getAPI(1);
      if (!git) {
        return {};
      }

      // Find repository for workspace
      const repository = git.repositories.find((repo: any) =>
        workspaceUri.fsPath.startsWith(repo.rootUri.fsPath)
      );

      if (!repository) {
        return {};
      }

      // Get current branch
      const branch = repository.state.HEAD?.name || 'unknown';

      // Get status summary
      const changes = repository.state.workingTreeChanges.length;
      const staged = repository.state.indexChanges.length;

      let status = 'clean';
      if (changes > 0 || staged > 0) {
        const parts: string[] = [];
        if (staged > 0) parts.push(`${staged} staged`);
        if (changes > 0) parts.push(`${changes} modified`);
        status = parts.join(', ');
      }

      return { branch, status };
    } catch (error) {
      console.warn('Could not get Git status:', error);
      return {};
    }
  }

  /**
   * Get count of active tasks
   */
  private async getActiveTasksCount(): Promise<number> {
    try {
      // Get all tasks from task provider
      const tasks = await vscode.tasks.fetchTasks();
      return tasks.length;
    } catch (error) {
      console.warn('Could not get tasks count:', error);
      return 0;
    }
  }

  /**
   * Format workspace status for WhatsApp display
   */
  formatStatus(status: WorkspaceStatus): string {
    let output = `📊 *Workspace Status*\n\n`;
    output += `📁 *Name:* ${status.workspaceName}\n`;
    output += `📂 *Path:* ${status.workspacePath}\n\n`;

    // Git information
    if (status.gitBranch) {
      output += `🌿 *Git Branch:* ${status.gitBranch}\n`;
      output += `📝 *Git Status:* ${status.gitStatus || 'clean'}\n\n`;
    }

    // Open files
    output += `📄 *Open Files:* ${status.openFiles.length}\n`;
    if (status.openFiles.length > 0) {
      const displayFiles = status.openFiles.slice(0, 5);
      for (const file of displayFiles) {
        output += `   • ${file}\n`;
      }
      if (status.openFiles.length > 5) {
        output += `   ... and ${status.openFiles.length - 5} more\n`;
      }
      output += '\n';
    }

    // Active tasks
    output += `✅ *Active Tasks:* ${status.activeTasks}\n`;

    return output;
  }
}
