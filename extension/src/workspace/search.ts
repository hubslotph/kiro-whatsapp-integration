import * as vscode from 'vscode';
import { SearchResult, CommandResult } from '../types/workspace.types';

/**
 * Workspace Search Handler
 * Handles code search functionality using VS Code API
 */
export class WorkspaceSearchHandler {
  private readonly MAX_RESULTS = 10;

  /**
   * Search workspace for text or regex pattern
   */
  async search(query: string, pattern?: string): Promise<CommandResult<SearchResult[]>> {
    const startTime = Date.now();

    try {
      // Validate query
      if (!query || query.trim().length === 0) {
        return {
          success: false,
          error: 'Search query cannot be empty',
          executionTime: Date.now() - startTime
        };
      }

      // Get workspace folders
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return {
          success: false,
          error: 'No workspace folder open',
          executionTime: Date.now() - startTime
        };
      }

      // Determine if using regex or exact match
      const isRegex = pattern === 'regex';
      let searchRegex: RegExp;

      if (isRegex) {
        try {
          searchRegex = new RegExp(query, 'gi');
        } catch (error) {
          return {
            success: false,
            error: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
            executionTime: Date.now() - startTime
          };
        }
      } else {
        // Create regex for exact match (case-insensitive)
        searchRegex = new RegExp(this.escapeRegex(query), 'gi');
      }

      // Perform search by finding files and searching their content
      const results: SearchResult[] = [];

      // Find all files in workspace (excluding common ignore patterns)
      const files = await vscode.workspace.findFiles(
        '**/*',
        '**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/build/**',
        1000 // Limit to 1000 files for performance
      );

      // Search through files
      for (const fileUri of files) {
        if (results.length >= this.MAX_RESULTS) {
          break;
        }

        try {
          // Read file content
          const document = await vscode.workspace.openTextDocument(fileUri);
          const text = document.getText();

          // Search for matches in file
          let match;
          searchRegex.lastIndex = 0; // Reset regex

          while ((match = searchRegex.exec(text)) !== null && results.length < this.MAX_RESULTS) {
            // Get line number and content
            const position = document.positionAt(match.index);
            const line = document.lineAt(position.line);

            results.push({
              filePath: fileUri.fsPath,
              lineNumber: position.line + 1, // 1-indexed for display
              lineContent: line.text.trim(),
              matchStart: position.character,
              matchEnd: position.character + match[0].length
            });
          }
        } catch (error) {
          // Skip files that can't be read (binary files, etc.)
          continue;
        }
      }

      return {
        success: true,
        data: results,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Escape special regex characters for exact match search
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Format search results for display
   */
  formatResults(results: SearchResult[], totalMatches?: number): string {
    if (results.length === 0) {
      return 'No matches found';
    }

    let output = `Found ${results.length} matches`;
    if (totalMatches && totalMatches > results.length) {
      output += ` (showing first ${results.length} of ${totalMatches})`;
    }
    output += ':\n\n';

    for (const result of results) {
      output += `📄 ${result.filePath}:${result.lineNumber}\n`;
      output += `   ${result.lineContent}\n\n`;
    }

    return output;
  }
}
