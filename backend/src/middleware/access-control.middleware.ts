import { Request, Response, NextFunction } from 'express';
import { db } from '../db/prisma';
import path from 'path';

/**
 * Access Control Middleware
 * Validates directory access and enforces read-only mode
 */

/**
 * Middleware to check directory access permissions
 * Validates that requested paths are within accessible directories
 */
export async function directoryAccessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Only apply to authenticated requests
    if (!req.user || !req.user.userId) {
      next();
      return;
    }

    // Extract path from request (command payload)
    const requestedPath = extractPathFromRequest(req);
    
    if (!requestedPath) {
      // No path to validate, continue
      next();
      return;
    }

    // Get user settings
    const settings = await db.settings.findUnique({
      where: { userId: req.user.userId },
    });

    if (!settings) {
      // No settings found, allow access (default behavior)
      next();
      return;
    }

    // Check accessible directories
    const accessibleDirs = settings.accessibleDirectories as string[];
    
    if (accessibleDirs && accessibleDirs.length > 0) {
      const isAccessible = validatePathAccess(requestedPath, accessibleDirs);
      
      if (!isAccessible) {
        // Log access denied
        const { auditLogService } = await import('../services/audit-log.service');
        await auditLogService.logAccessDenied(
          req.user.userId,
          extractCommandType(req),
          'Path is not in accessible directories',
          { path: requestedPath }
        );
        
        res.status(403).json({
          error: 'Access denied',
          message: 'The requested path is not in your accessible directories',
          code: 'PATH_NOT_ACCESSIBLE',
        });
        return;
      }
    }

    // Check read-only mode for write operations
    if (settings.readOnlyMode && isWriteOperation(req)) {
      // Log access denied
      const { auditLogService } = await import('../services/audit-log.service');
      await auditLogService.logAccessDenied(
        req.user.userId,
        extractCommandType(req),
        'Read-only mode is enabled',
        req.body
      );
      
      res.status(403).json({
        error: 'Access denied',
        message: 'Read-only mode is enabled. Write operations are not allowed',
        code: 'READ_ONLY_MODE',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error in directory access middleware:', error);
    // On error, deny access for security
    res.status(500).json({
      error: 'Access control error',
      message: 'Failed to validate access permissions',
    });
  }
}

/**
 * Extract command type from request
 */
function extractCommandType(req: Request): string {
  if (req.body && req.body.command && req.body.command.type) {
    return req.body.command.type;
  }
  return 'UNKNOWN';
}

/**
 * Extract file/directory path from request
 */
function extractPathFromRequest(req: Request): string | null {
  // Check command in body
  if (req.body && req.body.command) {
    const command = req.body.command;
    
    // Handle different command types
    if (command.path) {
      return command.path;
    }
    if (command.directory) {
      return command.directory;
    }
  }

  // Check direct path in body
  if (req.body && req.body.path) {
    return req.body.path;
  }

  // Check query params
  if (req.query && req.query.path) {
    return req.query.path as string;
  }

  return null;
}

/**
 * Validate if requested path is within accessible directories
 */
function validatePathAccess(
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
 * Check if request is a write operation
 */
function isWriteOperation(req: Request): boolean {
  // Check HTTP method
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Exclude read-only POST operations (like command execution for reads)
    if (req.body && req.body.command) {
      const command = req.body.command;
      const readOnlyCommands = ['FILE_READ', 'FILE_LIST', 'SEARCH', 'STATUS', 'HELP'];
      
      if (command.type && readOnlyCommands.includes(command.type)) {
        return false;
      }
    }
    
    return true;
  }

  return false;
}

/**
 * Validate path security (prevent directory traversal)
 */
export function validatePathSecurity(filePath: string, workspaceRoot: string): {
  valid: boolean;
  error?: string;
  resolvedPath?: string;
} {
  try {
    // Resolve the path
    const resolvedPath = path.resolve(workspaceRoot, filePath);
    
    // Ensure path is within workspace
    if (!resolvedPath.startsWith(workspaceRoot)) {
      return {
        valid: false,
        error: 'Access denied: Path is outside workspace',
      };
    }

    // Check for suspicious patterns
    if (filePath.includes('..') || filePath.includes('~')) {
      return {
        valid: false,
        error: 'Access denied: Invalid path pattern',
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
 * Check if user has permission for specific path
 */
export async function checkPathPermission(
  userId: string,
  requestedPath: string
): Promise<{ allowed: boolean; reason?: string }> {
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
export async function checkWritePermission(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
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
