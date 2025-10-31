import { db } from '../db/prisma';
import path from 'path';

/**
 * Access Control Service
 * Centralized service for managing access permissions
 */

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface PathValidationResult {
  valid: boolean;
  error?: string;
  resolvedPath?: string;
}

/**
 * Check if user has permission to access a specific path
 */
export async function checkPathPermission(
  userId: string,
  requestedPath: string
): Promise<AccessCheckResult> {
  try {
    const settings = await db.settings.findUnique({
      where: { userId },
    });

    if (!settings) {
      // No settings, allow by default
      return { allowed: true };
    }

    const accessibleDirs = settings.accessibleDirectories as string[];
    
    if (!accessibleDirs || accessibleDirs.length === 0) {
      // No restrictions configured
      return { allowed: true };
    }

    const isAccessible = validatePathAccess(requestedPath, accessibleDirs);
    
    if (!isAccessible) {
      return {
        allowed: false,
        reason: 'Path is not in accessible directories',
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking path permission:', error);
    return {
      allowed: false,
      reason: 'Permission check failed',
    };
  }
}

/**
 * Check if user can perform write operations
 */
export async function checkWritePermission(userId: string): Promise<AccessCheckResult> {
  try {
    const settings = await db.settings.findUnique({
      where: { userId },
    });

    if (!settings) {
      // No settings, default to read-only
      return {
        allowed: false,
        reason: 'Read-only mode enabled by default',
      };
    }

    if (settings.readOnlyMode) {
      return {
        allowed: false,
        reason: 'Read-only mode is enabled',
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking write permission:', error);
    return {
      allowed: false,
      reason: 'Permission check failed',
    };
  }
}

/**
 * Validate if requested path is within accessible directories
 */
export function validatePathAccess(
  requestedPath: string,
  accessibleDirs: string[]
): boolean {
  // Normalize the requested path
  const normalizedPath = path.normalize(requestedPath);

  // Check if path matches any accessible directory
  return accessibleDirs.some((dir) => {
    const normalizedDir = path.normalize(dir);
    
    // Check if requested path starts with accessible directory
    // or if they're the same
    return (
      normalizedPath === normalizedDir ||
      normalizedPath.startsWith(normalizedDir + path.sep) ||
      normalizedPath.startsWith(normalizedDir + '/')
    );
  });
}

/**
 * Validate path security (prevent directory traversal)
 */
export function validatePathSecurity(
  filePath: string,
  workspaceRoot: string
): PathValidationResult {
  try {
    // Check for suspicious patterns
    if (filePath.includes('..') || filePath.includes('~')) {
      return {
        valid: false,
        error: 'Access denied: Invalid path pattern',
      };
    }

    // Resolve the path
    const resolvedPath = path.resolve(workspaceRoot, filePath);
    
    // Ensure path is within workspace
    if (!resolvedPath.startsWith(workspaceRoot)) {
      return {
        valid: false,
        error: 'Access denied: Path is outside workspace',
      };
    }

    return {
      valid: true,
      resolvedPath,
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Path validation failed',
    };
  }
}

/**
 * Get user's accessible directories
 */
export async function getUserAccessibleDirectories(userId: string): Promise<string[]> {
  try {
    const settings = await db.settings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return [];
    }

    return (settings.accessibleDirectories as string[]) || [];
  } catch (error) {
    console.error('Error getting accessible directories:', error);
    return [];
  }
}

/**
 * Check if user is in read-only mode
 */
export async function isReadOnlyMode(userId: string): Promise<boolean> {
  try {
    const settings = await db.settings.findUnique({
      where: { userId },
    });

    if (!settings) {
      // Default to read-only for security
      return true;
    }

    return settings.readOnlyMode;
  } catch (error) {
    console.error('Error checking read-only mode:', error);
    // Default to read-only on error
    return true;
  }
}

/**
 * Validate command against access control rules
 */
export async function validateCommandAccess(
  userId: string,
  commandType: string,
  commandPayload: any
): Promise<AccessCheckResult> {
  try {
    // Extract path from command payload
    const requestedPath = commandPayload.path || commandPayload.directory;

    // Check path permission if path is present
    if (requestedPath) {
      const pathCheck = await checkPathPermission(userId, requestedPath);
      if (!pathCheck.allowed) {
        return pathCheck;
      }
    }

    // Check write permission for write commands
    const writeCommands = ['FILE_WRITE', 'FILE_DELETE', 'FILE_CREATE'];
    if (writeCommands.includes(commandType)) {
      const writeCheck = await checkWritePermission(userId);
      if (!writeCheck.allowed) {
        return writeCheck;
      }
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error validating command access:', error);
    return {
      allowed: false,
      reason: 'Access validation failed',
    };
  }
}

/**
 * Access Control Service class for dependency injection
 */
export class AccessControlService {
  async checkPathPermission(userId: string, requestedPath: string): Promise<AccessCheckResult> {
    return checkPathPermission(userId, requestedPath);
  }

  async checkWritePermission(userId: string): Promise<AccessCheckResult> {
    return checkWritePermission(userId);
  }

  validatePathAccess(requestedPath: string, accessibleDirs: string[]): boolean {
    return validatePathAccess(requestedPath, accessibleDirs);
  }

  validatePathSecurity(filePath: string, workspaceRoot: string): PathValidationResult {
    return validatePathSecurity(filePath, workspaceRoot);
  }

  async getUserAccessibleDirectories(userId: string): Promise<string[]> {
    return getUserAccessibleDirectories(userId);
  }

  async isReadOnlyMode(userId: string): Promise<boolean> {
    return isReadOnlyMode(userId);
  }

  async validateCommandAccess(
    userId: string,
    commandType: string,
    commandPayload: any
  ): Promise<AccessCheckResult> {
    return validateCommandAccess(userId, commandType, commandPayload);
  }
}

// Export singleton instance
export const accessControlService = new AccessControlService();
