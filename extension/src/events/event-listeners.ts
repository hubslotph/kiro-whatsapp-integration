/**
 * Workspace event listeners
 * Registers listeners for VS Code events and converts them to workspace events
 */

import * as vscode from 'vscode';
import {
  WorkspaceEvent,
  WorkspaceEventType,
  BuildCompleteEvent,
  ErrorEvent,
  GitOperationEvent,
  FileChangedEvent,
  EventCallback,
} from './event-types';

/**
 * Event listener manager
 * Manages all workspace event listeners
 */
export class EventListenerManager {
  private disposables: vscode.Disposable[] = [];
  private eventCallbacks: EventCallback[] = [];
  private diagnosticCollection: Map<string, vscode.Diagnostic[]> = new Map();

  /**
   * Register all event listeners
   */
  register(context: vscode.ExtensionContext): void {
    // Register diagnostic (error) listeners
    this.registerDiagnosticListeners(context);

    // Register Git operation listeners
    this.registerGitListeners(context);

    // Register file change listeners
    this.registerFileChangeListeners(context);

    // Register task/build listeners
    this.registerTaskListeners(context);
  }

  /**
   * Register diagnostic listeners for error events
   */
  private registerDiagnosticListeners(context: vscode.ExtensionContext): void {
    // Listen to diagnostic changes (errors, warnings, etc.)
    const diagnosticListener = vscode.languages.onDidChangeDiagnostics((event) => {
      for (const uri of event.uris) {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        const previousDiagnostics = this.diagnosticCollection.get(uri.toString()) || [];

        // Check for new errors
        const newErrors = diagnostics.filter(
          (diag) =>
            diag.severity === vscode.DiagnosticSeverity.Error &&
            !previousDiagnostics.some((prev) => this.diagnosticsEqual(prev, diag))
        );

        // Emit error events for new errors
        for (const diagnostic of newErrors) {
          const errorEvent: ErrorEvent = {
            type: WorkspaceEventType.ERROR,
            timestamp: new Date(),
            payload: {
              message: diagnostic.message,
              source: diagnostic.source || 'unknown',
              severity: this.mapSeverity(diagnostic.severity),
              file: uri.fsPath,
              line: diagnostic.range.start.line + 1,
              column: diagnostic.range.start.character + 1,
            },
          };

          this.emitEvent(errorEvent);
        }

        // Update stored diagnostics
        this.diagnosticCollection.set(uri.toString(), diagnostics);
      }
    });

    this.disposables.push(diagnosticListener);
    context.subscriptions.push(diagnosticListener);
  }

  /**
   * Register Git operation listeners
   */
  private registerGitListeners(context: vscode.ExtensionContext): void {
    // Get Git extension
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension) {
      console.log('Git extension not found, Git event listeners not registered');
      return;
    }

    // Activate Git extension if not already active
    gitExtension.activate().then((gitApi) => {
      if (!gitApi || !gitApi.repositories || gitApi.repositories.length === 0) {
        console.log('No Git repositories found');
        return;
      }

      // Listen to repository state changes
      for (const repository of gitApi.repositories) {
        // Listen to HEAD changes (branch changes, commits)
        const headListener = repository.state.onDidChange(() => {
          const head = repository.state.HEAD;
          if (head) {
            // Detect operation type based on state changes
            const gitEvent: GitOperationEvent = {
              type: WorkspaceEventType.GIT_OPERATION,
              timestamp: new Date(),
              payload: {
                operation: 'commit', // Default to commit, can be enhanced
                branch: head.name,
                success: true,
                message: `Branch: ${head.name || 'unknown'}`,
              },
            };

            this.emitEvent(gitEvent);
          }
        });

        this.disposables.push(headListener);
        context.subscriptions.push(headListener);
      }

      // Listen for new repositories
      const repoListener = gitApi.onDidOpenRepository((repository: any) => {
        const headListener = repository.state.onDidChange(() => {
          const head = repository.state.HEAD;
          if (head) {
            const gitEvent: GitOperationEvent = {
              type: WorkspaceEventType.GIT_OPERATION,
              timestamp: new Date(),
              payload: {
                operation: 'commit',
                branch: head.name,
                success: true,
                message: `Branch: ${head.name || 'unknown'}`,
              },
            };

            this.emitEvent(gitEvent);
          }
        });

        this.disposables.push(headListener);
        context.subscriptions.push(headListener);
      });

      this.disposables.push(repoListener);
      context.subscriptions.push(repoListener);
    });
  }

  /**
   * Register file change listeners
   */
  private registerFileChangeListeners(context: vscode.ExtensionContext): void {
    // Listen to file system changes
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');

    // File created
    const createListener = fileWatcher.onDidCreate((uri) => {
      const fileEvent: FileChangedEvent = {
        type: WorkspaceEventType.FILE_CHANGED,
        timestamp: new Date(),
        payload: {
          filePath: uri.fsPath,
          changeType: 'created',
        },
      };

      this.emitEvent(fileEvent);
    });

    // File changed
    const changeListener = fileWatcher.onDidChange((uri) => {
      const fileEvent: FileChangedEvent = {
        type: WorkspaceEventType.FILE_CHANGED,
        timestamp: new Date(),
        payload: {
          filePath: uri.fsPath,
          changeType: 'modified',
        },
      };

      this.emitEvent(fileEvent);
    });

    // File deleted
    const deleteListener = fileWatcher.onDidDelete((uri) => {
      const fileEvent: FileChangedEvent = {
        type: WorkspaceEventType.FILE_CHANGED,
        timestamp: new Date(),
        payload: {
          filePath: uri.fsPath,
          changeType: 'deleted',
        },
      };

      this.emitEvent(fileEvent);
    });

    this.disposables.push(fileWatcher, createListener, changeListener, deleteListener);
    context.subscriptions.push(fileWatcher, createListener, changeListener, deleteListener);
  }

  /**
   * Register task/build listeners
   */
  private registerTaskListeners(context: vscode.ExtensionContext): void {
    // Listen to task execution
    const taskStartTime = new Map<vscode.Task, number>();

    const taskStartListener = vscode.tasks.onDidStartTask((event) => {
      taskStartTime.set(event.execution.task, Date.now());
    });

    const taskEndListener = vscode.tasks.onDidEndTask((event) => {
      const startTime = taskStartTime.get(event.execution.task);
      const duration = startTime ? Date.now() - startTime : 0;
      taskStartTime.delete(event.execution.task);

      // Get diagnostics to count errors and warnings
      let errorCount = 0;
      let warningCount = 0;

      vscode.languages.getDiagnostics().forEach(([_uri, diagnostics]) => {
        diagnostics.forEach((diag) => {
          if (diag.severity === vscode.DiagnosticSeverity.Error) {
            errorCount++;
          } else if (diag.severity === vscode.DiagnosticSeverity.Warning) {
            warningCount++;
          }
        });
      });

      const buildEvent: BuildCompleteEvent = {
        type: WorkspaceEventType.BUILD_COMPLETE,
        timestamp: new Date(),
        payload: {
          status: errorCount > 0 ? 'failure' : 'success',
          duration,
          errors: errorCount,
          warnings: warningCount,
        },
      };

      this.emitEvent(buildEvent);
    });

    this.disposables.push(taskStartListener, taskEndListener);
    context.subscriptions.push(taskStartListener, taskEndListener);
  }

  /**
   * Subscribe to events
   */
  subscribe(callback: EventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(callback: EventCallback): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index > -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  /**
   * Emit an event to all subscribers
   */
  private emitEvent(event: WorkspaceEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in event callback:', error);
      }
    }
  }

  /**
   * Check if two diagnostics are equal
   */
  private diagnosticsEqual(a: vscode.Diagnostic, b: vscode.Diagnostic): boolean {
    return (
      a.message === b.message &&
      a.severity === b.severity &&
      a.range.start.line === b.range.start.line &&
      a.range.start.character === b.range.start.character &&
      a.range.end.line === b.range.end.line &&
      a.range.end.character === b.range.end.character
    );
  }

  /**
   * Map VS Code diagnostic severity to event severity
   */
  private mapSeverity(
    severity: vscode.DiagnosticSeverity
  ): 'error' | 'warning' | 'info' {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return 'error';
      case vscode.DiagnosticSeverity.Warning:
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Dispose all listeners
   */
  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.eventCallbacks = [];
    this.diagnosticCollection.clear();
  }
}
