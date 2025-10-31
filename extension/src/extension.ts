import * as vscode from 'vscode';
import { WebSocketServerManager } from './websocket/server';
import { SettingsPanel } from './settings/settings-panel';

let wsServerManager: WebSocketServerManager | undefined;

/**
 * Extension activation function
 * Called when the extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Kiro WhatsApp Integration extension is now active');

  // Initialize WebSocket server manager
  wsServerManager = new WebSocketServerManager(context);

  // Register all commands
  registerCommands(context);

  // Auto-start server if configured
  const config = vscode.workspace.getConfiguration('kiroWhatsapp');
  const autoStart = config.get<boolean>('autoStart', true);

  if (autoStart) {
    try {
      await wsServerManager.start();
      vscode.window.showInformationMessage('Kiro WhatsApp: WebSocket server started automatically');
    } catch (error) {
      vscode.window.showErrorMessage(`Kiro WhatsApp: Failed to auto-start server - ${error}`);
    }
  }

  console.log('Kiro WhatsApp Integration extension activation complete');
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
  // Open settings command (VS Code native settings)
  const openSettings = vscode.commands.registerCommand('kiro-whatsapp.openSettings', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'kiroWhatsapp');
  });

  // Open settings panel command (custom webview)
  const openSettingsPanel = vscode.commands.registerCommand('kiro-whatsapp.openSettingsPanel', () => {
    const panel = SettingsPanel.createOrShow(context.extensionUri);
    panel.loadSettings();
  });

  // Start WebSocket server command
  const startServer = vscode.commands.registerCommand('kiro-whatsapp.startServer', async () => {
    if (!wsServerManager) {
      vscode.window.showErrorMessage('Kiro WhatsApp: Server manager not initialized');
      return;
    }

    try {
      await wsServerManager.start();
      vscode.window.showInformationMessage('Kiro WhatsApp: WebSocket server started');
    } catch (error) {
      vscode.window.showErrorMessage(`Kiro WhatsApp: Failed to start server - ${error}`);
    }
  });

  // Stop WebSocket server command
  const stopServer = vscode.commands.registerCommand('kiro-whatsapp.stopServer', async () => {
    if (!wsServerManager) {
      vscode.window.showErrorMessage('Kiro WhatsApp: Server manager not initialized');
      return;
    }

    try {
      await wsServerManager.stop();
      vscode.window.showInformationMessage('Kiro WhatsApp: WebSocket server stopped');
    } catch (error) {
      vscode.window.showErrorMessage(`Kiro WhatsApp: Failed to stop server - ${error}`);
    }
  });

  // Show connection status command
  const showStatus = vscode.commands.registerCommand('kiro-whatsapp.showStatus', () => {
    if (!wsServerManager) {
      vscode.window.showInformationMessage('Kiro WhatsApp: Server manager not initialized');
      return;
    }

    const status = wsServerManager.getStatus();
    const message = `WebSocket Server Status:
- Running: ${status.isRunning ? 'Yes' : 'No'}
- Port: ${status.port}
- Active Connections: ${status.activeConnections}
- Uptime: ${status.uptime}`;

    vscode.window.showInformationMessage(message, { modal: false });
  });

  // Add all commands to subscriptions for cleanup
  context.subscriptions.push(openSettings, openSettingsPanel, startServer, stopServer, showStatus);
}

/**
 * Extension deactivation function
 * Called when the extension is deactivated
 */
export async function deactivate() {
  console.log('Kiro WhatsApp Integration extension is deactivating...');

  // Stop WebSocket server if running
  if (wsServerManager) {
    try {
      await wsServerManager.stop();
      console.log('WebSocket server stopped successfully');
    } catch (error) {
      console.error('Error stopping WebSocket server:', error);
    }
  }

  console.log('Kiro WhatsApp Integration extension deactivated');
}
