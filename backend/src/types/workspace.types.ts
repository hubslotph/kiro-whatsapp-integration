/**
 * Workspace-related types for WebSocket communication with Kiro extension
 */

import { Command } from './command.types';

/**
 * Connection state enum
 */
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

/**
 * WebSocket message types
 */
export enum MessageType {
  AUTH = 'AUTH',
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  COMMAND = 'COMMAND',
  COMMAND_RESPONSE = 'COMMAND_RESPONSE',
  EVENT = 'EVENT',
  PING = 'PING',
  PONG = 'PONG',
}

/**
 * Base WebSocket message
 */
export interface WebSocketMessage {
  type: MessageType;
  payload: any;
  timestamp: number;
}

/**
 * Authentication message
 */
export interface AuthMessage extends WebSocketMessage {
  type: MessageType.AUTH;
  payload: {
    token: string;
    workspaceId: string;
  };
}

/**
 * Command message
 */
export interface CommandMessage extends WebSocketMessage {
  type: MessageType.COMMAND;
  payload: {
    id: string;
    command: Command;
  };
}

/**
 * Command response message
 */
export interface CommandResponseMessage extends WebSocketMessage {
  type: MessageType.COMMAND_RESPONSE;
  payload: {
    id: string;
    success: boolean;
    data?: any;
    error?: string;
    executionTime: number;
  };
}

/**
 * Event message from workspace
 */
export interface EventMessage extends WebSocketMessage {
  type: MessageType.EVENT;
  payload: WorkspaceEvent;
}

/**
 * Workspace event types
 */
export enum WorkspaceEventType {
  BUILD_COMPLETE = 'BUILD_COMPLETE',
  ERROR = 'ERROR',
  GIT_OPERATION = 'GIT_OPERATION',
  FILE_CHANGED = 'FILE_CHANGED',
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
  SETTINGS_LOADED = 'SETTINGS_LOADED',
}

/**
 * Workspace event
 */
export interface WorkspaceEvent {
  type: WorkspaceEventType;
  timestamp: Date;
  payload: any;
}

/**
 * Command result
 */
export interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

/**
 * File info
 */
export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  lastModified: Date;
}

/**
 * Search result
 */
export interface SearchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

/**
 * Workspace status
 */
export interface WorkspaceStatus {
  openFiles: string[];
  gitStatus?: {
    branch: string;
    hasChanges: boolean;
    ahead: number;
    behind: number;
  };
  activeTasks?: number;
  lastBuild?: {
    status: 'success' | 'failure';
    timestamp: Date;
  };
}

/**
 * Connection options
 */
export interface ConnectionOptions {
  workspaceId: string;
  token: string;
  url: string;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  timeout?: number;
}

/**
 * Event callback type
 */
export type EventCallback = (event: WorkspaceEvent) => void;
