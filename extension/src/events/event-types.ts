/**
 * Event types for workspace events
 */

export enum WorkspaceEventType {
  BUILD_COMPLETE = 'BUILD_COMPLETE',
  ERROR = 'ERROR',
  GIT_OPERATION = 'GIT_OPERATION',
  FILE_CHANGED = 'FILE_CHANGED',
}

/**
 * Base workspace event
 */
export interface WorkspaceEvent {
  type: WorkspaceEventType;
  timestamp: Date;
  payload: any;
}

/**
 * Build complete event
 */
export interface BuildCompleteEvent extends WorkspaceEvent {
  type: WorkspaceEventType.BUILD_COMPLETE;
  payload: {
    status: 'success' | 'failure';
    duration: number;
    errors?: number;
    warnings?: number;
  };
}

/**
 * Error event
 */
export interface ErrorEvent extends WorkspaceEvent {
  type: WorkspaceEventType.ERROR;
  payload: {
    message: string;
    source: string;
    severity: 'error' | 'warning' | 'info';
    file?: string;
    line?: number;
    column?: number;
  };
}

/**
 * Git operation event
 */
export interface GitOperationEvent extends WorkspaceEvent {
  type: WorkspaceEventType.GIT_OPERATION;
  payload: {
    operation: 'commit' | 'push' | 'pull' | 'checkout' | 'merge';
    branch?: string;
    success: boolean;
    message?: string;
  };
}

/**
 * File changed event
 */
export interface FileChangedEvent extends WorkspaceEvent {
  type: WorkspaceEventType.FILE_CHANGED;
  payload: {
    filePath: string;
    changeType: 'created' | 'modified' | 'deleted';
  };
}

/**
 * Event callback type
 */
export type EventCallback = (event: WorkspaceEvent) => void;
