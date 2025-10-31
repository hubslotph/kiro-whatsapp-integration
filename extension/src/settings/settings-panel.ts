import * as vscode from 'vscode';

/**
 * Settings data structure
 */
export interface SettingsData {
  notificationEnabled: boolean;
  notificationTypes: string[];
  accessibleDirectories: string[];
  readOnlyMode: boolean;
}

/**
 * Settings webview panel manager
 */
export class SettingsPanel {
  public static currentPanel: SettingsPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _onSettingsChanged: vscode.EventEmitter<SettingsData>;

  private constructor(panel: vscode.WebviewPanel, _extensionUri: vscode.Uri) {
    this._panel = panel;
    this._onSettingsChanged = new vscode.EventEmitter<SettingsData>();

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        this._handleMessage(message);
      },
      null,
      this._disposables
    );
  }

  /**
   * Create or show the settings panel
   */
  public static createOrShow(extensionUri: vscode.Uri): SettingsPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel._panel.reveal(column);
      return SettingsPanel.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'kiroWhatsappSettings',
      'Kiro WhatsApp Settings',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
    return SettingsPanel.currentPanel;
  }

  /**
   * Event fired when settings are changed
   */
  public get onSettingsChanged(): vscode.Event<SettingsData> {
    return this._onSettingsChanged.event;
  }

  /**
   * Load current settings from backend
   */
  public async loadSettings(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('kiroWhatsapp');
      const backendUrl = config.get<string>('backendUrl', 'http://localhost:3000');
      const token = await this._getAuthToken();

      if (!token) {
        vscode.window.showWarningMessage('Not authenticated. Please authenticate first.');
        return;
      }

      const response = await fetch(`${backendUrl}/api/settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.statusText}`);
      }

      const settings = await response.json();
      this._panel.webview.postMessage({
        type: 'loadSettings',
        settings,
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load settings: ${error}`);
    }
  }

  /**
   * Dispose of the panel
   */
  public dispose(): void {
    SettingsPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();
    this._onSettingsChanged.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Update the webview content
   */
  private _update(): void {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  /**
   * Handle messages from the webview
   */
  private async _handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'saveSettings':
        await this._saveSettings(message.settings);
        break;
      case 'loadSettings':
        await this.loadSettings();
        break;
      case 'selectDirectory':
        await this._selectDirectory();
        break;
    }
  }

  /**
   * Save settings to backend
   */
  private async _saveSettings(settings: SettingsData): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('kiroWhatsapp');
      const backendUrl = config.get<string>('backendUrl', 'http://localhost:3000');
      const token = await this._getAuthToken();

      if (!token) {
        vscode.window.showWarningMessage('Not authenticated. Please authenticate first.');
        return;
      }

      const response = await fetch(`${backendUrl}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.statusText}`);
      }

      vscode.window.showInformationMessage('Settings saved successfully');
      this._onSettingsChanged.fire(settings);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save settings: ${error}`);
    }
  }

  /**
   * Get authentication token from secure storage
   */
  private async _getAuthToken(): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration('kiroWhatsapp');
    return config.get<string>('authToken');
  }

  /**
   * Open directory picker
   */
  private async _selectDirectory(): Promise<void> {
    const result = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Directory',
    });

    if (result && result[0]) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const relativePath = vscode.workspace.asRelativePath(result[0]);
        this._panel.webview.postMessage({
          type: 'directorySelected',
          path: relativePath,
        });
      }
    }
  }

  /**
   * Generate HTML for the webview
   */
  private _getHtmlForWebview(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kiro WhatsApp Settings</title>
  <style>
    body {
      padding: 20px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    h1 {
      font-size: 24px;
      margin-bottom: 20px;
    }
    h2 {
      font-size: 18px;
      margin-top: 30px;
      margin-bottom: 15px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 5px;
    }
    .setting-group {
      margin-bottom: 25px;
    }
    .setting-item {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
    }
    input[type="checkbox"] {
      margin-right: 8px;
    }
    .checkbox-group {
      margin-left: 20px;
    }
    .checkbox-item {
      margin-bottom: 8px;
    }
    .directory-list {
      list-style: none;
      padding: 0;
      margin: 10px 0;
    }
    .directory-item {
      display: flex;
      align-items: center;
      padding: 8px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      margin-bottom: 5px;
      border-radius: 3px;
    }
    .directory-item span {
      flex: 1;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 13px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    button.danger {
      background: #d32f2f;
      color: white;
      margin-left: 8px;
    }
    .button-group {
      margin-top: 30px;
      display: flex;
      gap: 10px;
    }
    .description {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <h1>Kiro WhatsApp Integration Settings</h1>

  <div class="setting-group">
    <h2>Notifications</h2>
    
    <div class="setting-item">
      <label>
        <input type="checkbox" id="notificationEnabled" />
        Enable WhatsApp Notifications
      </label>
      <div class="description">Receive workspace event notifications via WhatsApp</div>
    </div>

    <div class="setting-item">
      <label>Notification Types:</label>
      <div class="checkbox-group">
        <div class="checkbox-item">
          <label>
            <input type="checkbox" class="notification-type" value="BUILD_COMPLETE" />
            Build Complete
          </label>
        </div>
        <div class="checkbox-item">
          <label>
            <input type="checkbox" class="notification-type" value="ERROR" />
            Errors
          </label>
        </div>
        <div class="checkbox-item">
          <label>
            <input type="checkbox" class="notification-type" value="GIT_OPERATION" />
            Git Operations
          </label>
        </div>
        <div class="checkbox-item">
          <label>
            <input type="checkbox" class="notification-type" value="FILE_CHANGED" />
            File Changes
          </label>
        </div>
      </div>
    </div>
  </div>

  <div class="setting-group">
    <h2>Workspace Access</h2>
    
    <div class="setting-item">
      <label>
        <input type="checkbox" id="readOnlyMode" />
        Read-Only Mode
      </label>
      <div class="description">Restrict WhatsApp commands to read-only operations</div>
    </div>

    <div class="setting-item">
      <label>Accessible Directories:</label>
      <div class="description">Specify which directories can be accessed via WhatsApp</div>
      <ul class="directory-list" id="directoryList"></ul>
      <button class="secondary" id="addDirectory">Add Directory</button>
    </div>
  </div>

  <div class="button-group">
    <button id="saveButton">Save Settings</button>
    <button class="secondary" id="cancelButton">Cancel</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentSettings = {
      notificationEnabled: true,
      notificationTypes: [],
      accessibleDirectories: [],
      readOnlyMode: true
    };

    // Load settings on startup
    window.addEventListener('load', () => {
      vscode.postMessage({ type: 'loadSettings' });
    });

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'loadSettings':
          loadSettings(message.settings);
          break;
        case 'directorySelected':
          addDirectory(message.path);
          break;
      }
    });

    // Load settings into form
    function loadSettings(settings) {
      currentSettings = settings;
      
      document.getElementById('notificationEnabled').checked = settings.notificationEnabled;
      document.getElementById('readOnlyMode').checked = settings.readOnlyMode;
      
      // Load notification types
      const typeCheckboxes = document.querySelectorAll('.notification-type');
      typeCheckboxes.forEach(checkbox => {
        checkbox.checked = settings.notificationTypes.includes(checkbox.value);
      });
      
      // Load directories
      renderDirectories();
    }

    // Render directory list
    function renderDirectories() {
      const list = document.getElementById('directoryList');
      list.innerHTML = '';
      
      if (currentSettings.accessibleDirectories.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No directories configured (all directories accessible)';
        li.style.color = 'var(--vscode-descriptionForeground)';
        list.appendChild(li);
        return;
      }
      
      currentSettings.accessibleDirectories.forEach((dir, index) => {
        const li = document.createElement('li');
        li.className = 'directory-item';
        
        const span = document.createElement('span');
        span.textContent = dir;
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.className = 'danger';
        removeBtn.onclick = () => removeDirectory(index);
        
        li.appendChild(span);
        li.appendChild(removeBtn);
        list.appendChild(li);
      });
    }

    // Add directory
    function addDirectory(path) {
      if (!currentSettings.accessibleDirectories.includes(path)) {
        currentSettings.accessibleDirectories.push(path);
        renderDirectories();
      }
    }

    // Remove directory
    function removeDirectory(index) {
      currentSettings.accessibleDirectories.splice(index, 1);
      renderDirectories();
    }

    // Save settings
    document.getElementById('saveButton').addEventListener('click', () => {
      const settings = {
        notificationEnabled: document.getElementById('notificationEnabled').checked,
        notificationTypes: Array.from(document.querySelectorAll('.notification-type:checked'))
          .map(cb => cb.value),
        accessibleDirectories: currentSettings.accessibleDirectories,
        readOnlyMode: document.getElementById('readOnlyMode').checked
      };
      
      vscode.postMessage({
        type: 'saveSettings',
        settings
      });
    });

    // Cancel
    document.getElementById('cancelButton').addEventListener('click', () => {
      vscode.postMessage({ type: 'loadSettings' });
    });

    // Add directory button
    document.getElementById('addDirectory').addEventListener('click', () => {
      vscode.postMessage({ type: 'selectDirectory' });
    });
  </script>
</body>
</html>`;
  }
}
